import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const dx = resolve('scripts/dx.mjs');

describe('dx command', () => {
  it('documents its safe non-interactive modes', () => {
    const result = spawnSync(process.execPath, [dx, '--help'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--seed');
    expect(result.stdout).toContain('--setup-only');
  });

  it('rejects unknown options before setup', () => {
    const result = spawnSync(process.execPath, [dx, '--unknown'], { encoding: 'utf8' });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('unknown option --unknown');
  });
});
