/**
 * A strict, minimal XML well-formedness checker for the SVG we generate (no DTDs, no CDATA, no
 * processing instructions, no comments are expected). Returns null when well formed, else a reason.
 */
export function xmlProblem(xml: string): string | null {
  const stack: string[] = [];
  let i = 0;
  let roots = 0;
  const name = /^[A-Za-z_][\w.-]*(:[A-Za-z_][\w.-]*)?/;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const textPart = lt < 0 ? xml.slice(i) : xml.slice(i, lt);
    if (/[<>]/.test(textPart.replace(/&(amp|lt|gt|quot|apos);/g, '')))
      return `raw < or > in text at ${i}`;
    if (/&(?!(amp|lt|gt|quot|apos);)/.test(textPart)) return `bare & in text at ${i}`;
    for (const ch of textPart) {
      const c = ch.codePointAt(0) ?? 0;
      if ((c < 0x20 && c !== 9 && c !== 10 && c !== 13) || (c >= 0xd800 && c <= 0xdfff))
        return `invalid character U+${c.toString(16)}`;
    }
    if (textPart.trim() !== '' && stack.length === 0) return 'text outside the root element';
    if (lt < 0) break;
    const gt = xml.indexOf('>', lt);
    if (gt < 0) return 'unterminated tag';
    const tag = xml.slice(lt + 1, gt);
    if (tag.startsWith('/')) {
      const n = tag.slice(1);
      if (stack.pop() !== n) return `mismatched close </${n}>`;
    } else {
      const self = tag.endsWith('/');
      const body = self ? tag.slice(0, -1) : tag;
      const m = name.exec(body);
      if (!m) return `bad tag name at ${lt}`;
      let rest = body.slice(m[0].length);
      const seen = new Set<string>();
      while (rest.trim() !== '') {
        const am = /^\s+([A-Za-z_:][\w:.-]*)="([^"<]*)"/.exec(rest);
        if (!am) return `bad attribute syntax in <${m[0]}>`;
        if (seen.has(am[1] as string)) return `duplicate attribute ${am[1]}`;
        seen.add(am[1] as string);
        if (/&(?!(amp|lt|gt|quot|apos);)/.test(am[2] as string))
          return `bare & in attribute ${am[1]}`;
        rest = rest.slice(am[0].length);
      }
      if (stack.length === 0) roots += 1;
      if (!self) stack.push(m[0]);
    }
    i = gt + 1;
  }
  if (stack.length > 0) return `unclosed <${stack[stack.length - 1]}>`;
  return roots === 1 ? null : `expected one root element, found ${roots}`;
}
