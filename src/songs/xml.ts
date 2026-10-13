/**
 * A tiny XML reader for the song importers: just enough XML 1.0 to read MusicXML
 * (elements, attributes, text, CDATA and character/entity references). Comments,
 * processing instructions and the DOCTYPE are skipped, namespace prefixes are dropped
 * from element names, and small mistakes (a stray or missing end tag) are tolerated.
 *
 * It is plain TypeScript with no DOM, so the importers behave the same in the
 * browser, in Node tests and in command-line scripts.
 */

export interface XmlElement {
  /** Local element name (namespace prefix removed). */
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  /** Text directly inside the element, entities decoded (whitespace-only runs are dropped). */
  text: string;
}

export class XmlError extends Error {}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

/** Replace character and predefined entity references ("&amp;", "&#233;", "&#xE9;"). */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][\w.-]*);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

const localName = (qname: string) => {
  const i = qname.indexOf(':');
  return i >= 0 ? qname.slice(i + 1) : qname;
};

const ATTR_RE = /\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/y;
const NAME_RE = /[^\s/>]+/y;

/** Skip a "<!DOCTYPE …>" (with an optional [internal subset]) or other "<!…>" declaration. */
function skipDeclaration(s: string, at: number): number {
  let depth = 0;
  let quote = '';
  for (let i = at + 2; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[') depth++;
    else if (c === ']') depth--;
    else if (c === '>' && depth <= 0) return i + 1;
  }
  throw new XmlError('Unterminated <!…> declaration.');
}

/** Parse an XML document and return its root element. Throws XmlError if there is none. */
export function parseXml(src: string): XmlElement {
  const s = src.charCodeAt(0) === 0xfeff ? src.slice(1) : src;
  const doc: XmlElement = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlElement[] = [doc];
  const top = () => stack[stack.length - 1];
  const addText = (raw: string) => {
    if (stack.length > 1 && /\S/.test(raw)) top().text += decodeEntities(raw);
  };
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) {
      addText(s.slice(i));
      break;
    }
    if (lt > i) addText(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) {
      const e = s.indexOf('-->', lt + 4);
      if (e < 0) throw new XmlError('Unterminated comment.');
      i = e + 3;
    } else if (s.startsWith('<![CDATA[', lt)) {
      const e = s.indexOf(']]>', lt + 9);
      if (e < 0) throw new XmlError('Unterminated CDATA section.');
      if (stack.length > 1) top().text += s.slice(lt + 9, e);
      i = e + 3;
    } else if (s.startsWith('<?', lt)) {
      const e = s.indexOf('?>', lt + 2);
      if (e < 0) throw new XmlError('Unterminated processing instruction.');
      i = e + 2;
    } else if (s.startsWith('<!', lt)) {
      i = skipDeclaration(s, lt);
    } else if (s[lt + 1] === '/') {
      const e = s.indexOf('>', lt);
      if (e < 0) throw new XmlError('Unterminated end tag.');
      const name = localName(s.slice(lt + 2, e).trim());
      // close the matching open element; ignore a stray end tag
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      }
      i = e + 1;
    } else {
      NAME_RE.lastIndex = lt + 1;
      const nm = NAME_RE.exec(s);
      if (!nm) {
        // a lone "<" in text
        addText('<');
        i = lt + 1;
        continue;
      }
      const el: XmlElement = { name: localName(nm[0]), attrs: {}, children: [], text: '' };
      let p = lt + 1 + nm[0].length;
      for (;;) {
        ATTR_RE.lastIndex = p;
        const a = ATTR_RE.exec(s);
        if (!a || a.index !== p) break;
        el.attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
        p = ATTR_RE.lastIndex;
      }
      while (p < s.length && /\s/.test(s[p])) p++;
      const selfClosing = s[p] === '/';
      const gt = s.indexOf('>', p);
      if (gt < 0) throw new XmlError(`Unterminated start tag <${el.name}>.`);
      top().children.push(el);
      if (!selfClosing) stack.push(el);
      i = gt + 1;
    }
  }
  const root = doc.children[0];
  if (!root) throw new XmlError('No XML element found.');
  return root;
}

// ---------------------------------------------------------------------------
// Small query helpers
// ---------------------------------------------------------------------------

/** First child element with this name. */
export function child(el: XmlElement | undefined, name: string): XmlElement | undefined {
  return el?.children.find(c => c.name === name);
}

/** All child elements with this name (or all children). */
export function kids(el: XmlElement | undefined, name?: string): XmlElement[] {
  if (!el) return [];
  return name ? el.children.filter(c => c.name === name) : el.children;
}

/** Follow a path of child names ("identification", "encoding", "software"). */
export function path(el: XmlElement | undefined, ...names: string[]): XmlElement | undefined {
  let cur = el;
  for (const n of names) cur = child(cur, n);
  return cur;
}

/** Trimmed text of an element ('' when missing). */
export function textOf(el: XmlElement | undefined): string {
  return el ? el.text.trim() : '';
}

/** Trimmed text of the first child with this name ('' when missing). */
export function childText(el: XmlElement | undefined, name: string): string {
  return textOf(child(el, name));
}

/** Numeric content of the first child with this name, or undefined. */
export function childNumber(el: XmlElement | undefined, name: string): number | undefined {
  const t = childText(el, name);
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Bytes → text
// ---------------------------------------------------------------------------

/**
 * Decode an XML file's bytes: honours a byte-order mark (UTF-8 / UTF-16), detects
 * BOM-less UTF-16 and the encoding named in the XML declaration; defaults to UTF-8.
 */
export function decodeXmlBytes(bytes: Uint8Array): string {
  const b = bytes;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  if (b[0] === 0x3c && b[1] === 0x00) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0x00 && b[1] === 0x3c) return new TextDecoder('utf-16be').decode(b);
  const head = String.fromCharCode(...b.subarray(0, Math.min(200, b.length)));
  const enc = /^<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)?.[1];
  if (enc && !/^utf-?8$/i.test(enc)) {
    try {
      return new TextDecoder(enc).decode(b);
    } catch {
      // unknown label: fall through to UTF-8
    }
  }
  return new TextDecoder('utf-8').decode(b);
}
