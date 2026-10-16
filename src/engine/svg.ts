/** A tiny SVG node tree and its deterministic serializer (docs/spec/01-rendering.md). */

export interface SvgNode {
  tag: string;
  attrs: [string, string][];
  children: (SvgNode | string)[];
}

export function el(
  tag: string,
  attrs: [string, string | number][] = [],
  children: (SvgNode | string)[] = [],
): SvgNode {
  return { tag, attrs: attrs.map(([k, v]) => [k, typeof v === 'number' ? fmt(v) : v]), children };
}

/** Rounds to 2 decimals, never writes -0, uses the shortest round-trip form. */
export function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

/** Removes characters that XML 1.0 cannot carry (controls except tab/newline, lone surrogates). */
export function xmlSafe(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (d >= 0xdc00 && d <= 0xdfff) {
        out += text[i] + (text[i + 1] ?? '');
        i += 1;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0xfffe || c === 0xffff) continue;
    out += text[i];
  }
  return out;
}

export function escapeXml(text: string): string {
  return xmlSafe(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function serializeSvg(node: SvgNode): string {
  const attrs = node.attrs.map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('');
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`;
  const inner = node.children
    .map((c) => (typeof c === 'string' ? escapeXml(c) : serializeSvg(c)))
    .join('');
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

/** Path data from a list of commands, numbers formatted with fmt. */
export function pathData(parts: (string | number)[]): string {
  return parts.map((p) => (typeof p === 'number' ? fmt(p) : p)).join(' ');
}
