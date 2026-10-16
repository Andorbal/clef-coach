/**
 * Lesson text: paragraphs split by blank lines, "- " lines as a list, **bold** and *italic*.
 * Just enough formatting for short explanations, with no HTML in the course files.
 */
import { Fragment, type ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] ? <strong key={i++}>{m[1]}</strong> : <em key={i++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={`sl-prose ${className ?? ''}`}>
      {blocks.map((b, bi) => {
        const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.every(l => l.startsWith('- '))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && ' '}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
