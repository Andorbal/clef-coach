/**
 * Transcribe photos / PDFs of sheet music or tablature into a Clef Coach song with
 * Claude, using the player's own API key. Shared by the in-app importer (browser)
 * and the `clefsong scan` command-line tool (Node) – the caller creates the client.
 *
 * Each answer is checked with the song-format validator; if it doesn't load, the
 * validator's messages go back to the model for a corrected version (a few rounds).
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { InstrumentId } from '../music/instruments';
import type { SongDef } from '../music/parse';
import { SongFormatError, parseSongDoc } from './format';
import { TRANSCRIBE_RULES, repairTask, transcribeTask } from './llmPrompt';

export const DEFAULT_TRANSCRIBE_MODEL = 'claude-opus-5-5';

export type ScanMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/pdf';

export interface ScanFile {
  mediaType: ScanMediaType;
  /** base64, no data: prefix */
  data: string;
  name?: string;
}

export interface TranscribeOptions {
  instrument?: InstrumentId;
  title?: string;
  hints?: string;
  model?: string;
  /** rounds of "here's what's wrong, please fix it" (default 2) */
  repairs?: number;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

export interface TranscribeResult {
  song: SongDef;
  warnings: string[];
  /** the JSON as the model wrote it */
  raw: string;
  attempts: number;
  /** tokens used across all attempts */
  usage: { input: number; output: number };
  /** the model that produced the final answer (a refusal fallback may differ) */
  model: string;
}

export class TranscribeError extends Error {
  raw?: string;
  issues?: string[];
  constructor(message: string, raw?: string, issues?: string[]) {
    super(message);
    this.raw = raw;
    this.issues = issues;
  }
}

export function mediaTypeFor(name: string, fallback?: string): ScanMediaType | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const byExt: Record<string, ScanMediaType> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
  if (byExt[ext]) return byExt[ext];
  if (fallback && (Object.values(byExt) as string[]).includes(fallback)) return fallback as ScanMediaType;
  return null;
}

function fileBlock(f: ScanFile): Anthropic.Beta.BetaContentBlockParam {
  if (f.mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data }, title: f.name };
  }
  return { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } };
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
}

/** Pull the JSON object out of an answer (code fences or surrounding prose tolerated). */
export function extractJson(text: string): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

export async function transcribeSheetMusic(client: Anthropic, files: ScanFile[], opts: TranscribeOptions = {}): Promise<TranscribeResult> {
  if (!files.length) throw new TranscribeError('Add at least one photo or PDF of the music.');
  const model = opts.model ?? DEFAULT_TRANSCRIBE_MODEL;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [...files.map(fileBlock), { type: 'text', text: transcribeTask({ instrument: opts.instrument, title: opts.title, hints: opts.hints, pages: files.length }) }],
    },
  ];
  const usage = { input: 0, output: 0 };
  const rounds = 1 + (opts.repairs ?? 2);
  let lastRaw = '';
  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= rounds; attempt++) {
    opts.onProgress?.(attempt === 1 ? 'Reading the music…' : `Fixing ${lastIssues.length} problem${lastIssues.length === 1 ? '' : 's'} (round ${attempt - 1})…`);
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        // reading dense notation bar by bar is careful work
        output_config: { effort: 'high' },
        // if a safety classifier declines, the API retries on a recommended model
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: TRANSCRIBE_RULES,
        messages,
      },
      { signal: opts.signal },
    );
    const response = await stream.finalMessage();
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    if (response.stop_reason === 'refusal') {
      throw new TranscribeError('Claude declined to transcribe this. Try a clearer photo, or a different page.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new TranscribeError('The music is too long to transcribe in one go. Try fewer pages at a time.');
    }
    const text = textOf(response.content);
    lastRaw = extractJson(text);
    try {
      const parsed = parseSongDoc(lastRaw);
      return { song: parsed.song, warnings: parsed.warnings, raw: lastRaw, attempts: attempt, usage, model: response.model };
    } catch (e) {
      lastIssues = e instanceof SongFormatError ? e.issues : [(e as Error).message];
      // keep the whole answer (including thinking blocks) and ask for a fix
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: repairTask(lastIssues) });
    }
  }
  throw new TranscribeError(`The transcription still has ${lastIssues.length} problem${lastIssues.length === 1 ? '' : 's'}. You can fix them by hand below.`, lastRaw, lastIssues);
}
