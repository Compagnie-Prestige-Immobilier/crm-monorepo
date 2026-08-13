import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const mobile = resolve(root, 'apps/mobile');

if (existsSync(resolve(root, '.env'))) {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined)
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const children = new Set();
let flutterProcess;
let stopping = false;

function run(command, args, cwd = root, options = {}) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: options.interactive ? ['pipe', 'inherit', 'inherit'] : 'inherit',
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
  if (!isListening(3001)) run('pnpm', ['--filter', '@crm/api', 'dev']);
  if (!isListening(3000)) run('pnpm', ['--filter', '@crm/web', 'dev']);
  flutterProcess = run('flutter', ['run', '-d', 'emulator-5554'], mobile, { interactive: true });
}

function isListening(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${String(port)}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 && result.stdout.trim().split('\n').length > 1;
}

function waitForAndroid() {
  const adb = spawn('adb', ['wait-for-device'], { stdio: 'inherit' });
  let started = false;
  const launch = (message) => {
    if (started || stopping) return;
    started = true;
    if (message) console.warn(message);
    startApps();
  };
  const timeout = setTimeout(() => {
    adb.kill('SIGTERM');
    launch('[dx] Android non disponible après 15s; API et web démarrent quand même.');
  }, 15_000);
  adb.on('exit', (code) => {
    if (stopping) return;
    clearTimeout(timeout);
    launch(code !== 0 ? '[dx] Android indisponible; API et web démarrent quand même.' : '');
  });
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

const devices = spawnSync('adb', ['devices'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
if (/^emulator-\d+\s+device$/m.test(devices.stdout ?? '')) {
  waitForAndroid();
} else {
  const emulator = spawn('flutter', ['emulators', '--launch', 'Pixel_10_Pro_XL'], {
    cwd: mobile,
    env: process.env,
    stdio: 'inherit',
  });
  children.add(emulator);
  emulator.on('exit', () => children.delete(emulator));
  emulator.on('exit', waitForAndroid);
}

process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.on('data', (data) => {
  const key = data.toString();
  if (key === '\u0003') {
    shutdown();
    return;
  }
  if (key.toLowerCase() === 'r' && flutterProcess?.stdin.writable) {
    console.log('[dx] hot restart Flutter…');
    flutterProcess.stdin.write('R');
  }
});

function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('\n[dx] arrêt des services…');
  stopApps();
  process.stdin.setRawMode?.(false);
  // Laisser les groupes de processus recevoir SIGTERM avant de quitter : avec
  // `pnpm dev`, le serveur réel est un petit-enfant du shell pnpm.
  setTimeout(() => {
    spawnSync('docker', ['compose', '-f', 'infra/docker/docker-compose.yml', 'stop'], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
    process.exit(0);
  }, 250);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
