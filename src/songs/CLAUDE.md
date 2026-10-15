# src/songs: song files and importers

Every import ends up as a **Clef Coach song document** (`format.ts` `SongDoc`, on disk
`{ format: 'clef-coach-song', version: 1, … }`). It is validated by `parseSongDoc` and
turned into the in-memory `SongDef` (`music/parse.ts`), whose staves are strings in the text
note language (`C4/q@3 [C4 E4]/h |`, grammar at the top of `music/parse.ts`). Songs are
stored as `SongDef` in `data.songs`. The built-in library is `src/content/songs/*Library.ts`.

- `format.ts`:
  - `parseSongDoc` validates bar by bar and throws `SongFormatError(issues[])` with messages
    that say what to fix. It also returns warnings.
  - The other exports: `songToDoc`/`songToJson`, `parseChordTimeline`, `songSections`
    (phrases), `alignLyrics`, and `newSongId` (`user-<slug>-xxxxx`).
- `importers.ts` `importBytes(name, bytes, opts)` is the single entry point. It picks a kind
  by extension or by sniffing, **dynamically imports** the importer (so each is a lazy chunk),
  then re-validates through `parseSongDoc`.
  - `musicxml.ts` (with `xml.ts`, a tiny XML parser, and `zip.ts` for .mxl): the biggest
    module. It handles parts, voices, cross-staff notes, clef/key/meter changes, repeats,
    tuplets, chord symbols, lyrics and band parts.
  - `midi.ts`: tracks become a grand staff, notes are quantised, chord symbols are inferred
    from a chord track, and other tracks become band parts.
  - `guitarpro.ts`: loads alphaTab lazily (1.2 MB chunk) and converts to MusicXML-style parts
    for `musicxml.ts`'s `buildSong`.
  - `tabtext.ts`: tab pasted from the web (rhythm from spacing, or from Claude).
  - `importkit.ts`: shared helpers for quantising, measure layout, writing voices, key
    estimation, instrument guessing and band parts.
- `bulk.ts`: many files, zip archives, folder tags and duplicate detection (UI in
  `screens/BulkImport.tsx`).
- `transcribe.ts` scans sheet music or tab photos with Claude through `@anthropic-ai/sdk`:
  - **Request:** the browser uses `dangerouslyAllowBrowser` with the user's own key
    (`clefcoach.anthropicKey`); the CLI reads `ANTHROPIC_API_KEY`. It streams from the model,
    then sends a few repair rounds with the validator's issues.
  - **Prompts:** in `llmPrompt.ts` (`SONG_FORMAT_GUIDE`, `TRANSCRIBE_RULES`, `manualPrompt`).

**Keep in sync:** a format change touches `format.ts`, `docs/song-format.md`,
`SONG_FORMAT_GUIDE` (llmPrompt.ts) and the grammar comment in `music/parse.ts`. The CLI
(`npm run clefsong -- validate|convert|scan|prompt`) runs these same modules through Vite's
module runner (`tools/clefsong.mjs`).

**Tests:**

- Each importer has a `*.test.ts` with inline fixtures. Guitar Pro fixtures are built with
  alphaTab's AlphaTex → Gp7Exporter rather than binary files.
- `content/songs/songs.test.ts` checks every library song: it parses, stays in its group's
  range, can be fingered and has a blurb.
- E2E: `e2e/songs.spec.ts`, `library.spec.ts`, `tabs.spec.ts`.
