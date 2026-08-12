import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const mobile = resolve(root, 'apps/mobile');

if (existsSync(resolve(root, '.env'))) {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const children = new Set();
let stopping = false;

function run(command, args, cwd = root, options = {}) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: options.interactive ? ['ignore', 'inherit', 'inherit'] : 'inherit',
    detached: process.platform !== 'win32',
  });
  children.add(child);
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!stopping && code !== 0) console.error(`[dx] ${command} arrêté (${signal ?? code})`);
  });
  return child;
}

function stopApps() {
  for (const child of children) {
    if (child.pid === undefined) continue;
    try {
      if (process.platform === 'win32') child.kill();
      else process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  children.clear();
}

function startApps() {
  console.log('[dx] API : http://localhost:3001 · web : http://localhost:3000');
  run('pnpm', ['--filter', '@crm/api', 'dev']);
  run('pnpm', ['--filter', '@crm/web', 'dev']);
  run('flutter', ['run', '-d', 'emulator-5554'], mobile, { interactive: true });
}

function restart() {
  console.log('[dx] redémarrage…');
  stopApps();
  setTimeout(startApps, 500);
}

console.log('[dx] démarrage de Postgres, migrations et seed…');
for (const [command, args] of [
  ['docker', ['compose', '-f', 'infra/docker/docker-compose.yml', 'up', '-d']],
  ['pnpm', ['db:deploy']],
  ['pnpm', ['db:seed']],
]) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const emulator = spawn('flutter', ['emulators', '--launch', 'Pixel_10_Pro_XL'], {
  cwd: mobile,
  env: process.env,
  stdio: 'inherit',
});
children.add(emulator);
emulator.on('exit', () => children.delete(emulator));
emulator.on('exit', () => {
  const adb = spawnSync('adb', ['wait-for-device'], { stdio: 'inherit' });
  if (adb.status !== 0) console.warn('[dx] Android indisponible; Flutter sera relancé quand même.');
  startApps();
});

process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.on('data', (data) => {
  if (data.toString().toLowerCase() === 'r') restart();
});

function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('\n[dx] arrêt des services…');
  stopApps();
  process.stdin.setRawMode?.(false);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
