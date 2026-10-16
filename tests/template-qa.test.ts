import { describe, expect, it } from 'vitest';
import { TEMPLATE_IDS, buildTemplate, runQa } from '../src/engine';

describe('templates start clean', () => {
  it('no visual QA finding of any kind for seeds 0 to 40 (layout jitter included)', () => {
    const counts = new Map<string, number>();
    for (const id of TEMPLATE_IDS) {
      for (let seed = 0; seed <= 40; seed += 1) {
        for (const f of runQa(buildTemplate(id, { seed }))) {
          const k = `${id} ${f.code} ${f.objectId ?? ''} ${f.otherId ?? ''}`.trim();
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
    // grouped as "template code object [other]: number of seeds"
    expect([...counts].map(([k, n]) => `${k}: ${n}`)).toEqual([]);
  });
});
