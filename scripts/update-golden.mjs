// Rewrites tests/golden/*.svg from the current renderer. Run only when a rendering change is
// intended, then review the diff: a golden change is a visible change for every saved scene.
import { spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['vitest', 'run', 'tests/render.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, UPDATE_GOLDEN: '1' },
});
process.exit(result.status ?? 1);
