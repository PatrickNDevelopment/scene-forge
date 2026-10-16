/**
 * Renders an engine SvgNode tree as React elements. No innerHTML: text stays text, so the canvas can
 * never execute markup, and it is the very same tree the exporter serializes.
 */
import { createElement, type ReactNode } from 'react';
import type { SvgNode } from '../engine';

function propName(attr: string): string {
  if (attr === 'class') return 'className';
  if (attr.startsWith('data-') || attr.startsWith('aria-')) return attr;
  return attr.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

export function toReact(
  node: SvgNode,
  key?: number,
  extra: Record<string, unknown> = {},
): ReactNode {
  const props: Record<string, unknown> = key === undefined ? {} : { key };
  for (const [k, v] of node.attrs) props[propName(k)] = v;
  Object.assign(props, extra);
  const children = node.children.map((c, i) => (typeof c === 'string' ? c : toReact(c, i)));
  return createElement(node.tag, props, ...children);
}
