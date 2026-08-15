#!/usr/bin/env node
//
// Génère packages/api-client-dart/lib depuis apps/api/openapi.json.
//
//   pnpm mobile:client:generate                      (racine)
//   pnpm --filter @crm/api-client-dart generate      (via turbo)
//
// Enchaînement : openapi-generator (JVM) → dart pub get → build_runner →
// dart format. Chaque prérequis manquant produit un message actionnable, pas
// une trace de pile.
//
// ---------------------------------------------------------------------------
// Pourquoi JAVA_HOME est épinglé explicitement
// ---------------------------------------------------------------------------
// Sur les postes de l'équipe, le JDK vient de SDKMAN. SDKMAN ne s'installe que
// dans l'init du shell interactif : il n'écrit rien dans
// /Library/Java/JavaVirtualMachines, donc `/usr/libexec/java_home` répond
// « Unable to locate a Java Runtime » alors que `java -version` fonctionne
// parfaitement dans un terminal. Or turbo lance ses tâches dans un shell non
// interactif : tout ce qui résout Java via java_home — et
// @openapitools/openapi-generator-cli le fait — échoue avec un message qui
// laisse croire que le JDK n'est pas installé.
//
// On résout donc dans cet ordre : JAVA_HOME existant → SDKMAN → java_home →
// `java` sur le PATH (remonté depuis le lien réel), et on exporte le résultat
// dans l'environnement de l'enfant.
// ---------------------------------------------------------------------------

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, normalize, relative as relative_, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageDir = join(repoRoot, 'packages', 'api-client-dart');
const spec = join(repoRoot, 'apps', 'api', 'openapi.json');
const openapitools = join(repoRoot, 'openapitools.json');

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const which = (binary) => {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [binary], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.split('\n')[0]?.trim() || null;
};

const run = (command, args, options = {}) => {
  console.log(`\n▸ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: packageDir,
    stdio: 'inherit',
    ...options,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) fail(`${command} n'a pas pu être lancé : ${result.error.message}`);
  if (result.status !== 0) fail(`${command} a échoué (code ${String(result.status)}).`);
};

const runAtRoot = (command, args, options = {}) => {
  console.log(`\n▸ (${repoRoot}) ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.error) fail(`${command} n'a pas pu être lancé : ${result.error.message}`);
  if (result.status !== 0) fail(`${command} a échoué (code ${String(result.status)}).`);
};

// --- 1. Le contrat doit exister -------------------------------------------

if (!existsSync(spec)) {
  const message =
    'apps/api/openapi.json est introuvable.\n\n' +
    "  Le contrat est généré depuis l'API NestJS :\n" +
    '      pnpm --filter @crm/api openapi:generate\n\n' +
    '  Ou, en laissant turbo ordonner les tâches :\n' +
    '      pnpm turbo run generate\n';

  if (process.env.CI)
    fail(`${message}\n  En CI, un contrat absent signifie que la tâche amont n'a rien produit.`);

  console.warn(`\n⚠ ${message}`);
  console.warn("Génération du client Dart ignorée. lib/ est laissé en l'état.\n");
  process.exit(0);
}

// --- 2. Java ---------------------------------------------------------------

const isJdk = (home) => Boolean(home) && existsSync(join(home, 'bin', 'java'));

const resolveJavaHome = () => {
  if (isJdk(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

  const sdkman = join(
    process.env.SDKMAN_DIR ?? join(process.env.HOME ?? '', '.sdkman'),
    'candidates',
    'java',
    'current',
  );
  if (isJdk(sdkman)) return sdkman;

  if (process.platform === 'darwin') {
    const detected = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' });
    const home = detected.status === 0 ? detected.stdout.trim() : null;
    if (isJdk(home)) return home;
  }

  // Dernier recours : remonter depuis le binaire du PATH. `java` est
  // typiquement <home>/bin/java, éventuellement via un lien symbolique.
  const binary = which('java');
  if (binary) {
    const home = dirname(dirname(realpathSync(binary)));
    if (isJdk(home)) return home;
  }

  return null;
};

const javaHome = resolveJavaHome();
if (!javaHome) {
  fail(
    'Aucun JDK trouvé. openapi-generator 7.24.0 tourne sur la JVM et exige un JDK 17+.\n\n' +
      '  macOS (recommandé, aligné sur la CI) :\n' +
      '      sdk install java 21.0.10-tem\n\n' +
      '  Ubuntu :\n' +
      '      sudo apt install -y temurin-21-jdk\n\n' +
      "  Si `java -version` fonctionne dans votre terminal mais que ce message s'affiche,\n" +
      "  c'est que le JDK vient de SDKMAN et que turbo lance un shell non interactif :\n" +
      '      export JAVA_HOME=$(sdk home java current)   # dans ~/.zshenv, pas ~/.zshrc',
  );
}
console.log(`JAVA_HOME = ${javaHome}`);

// --- 3. Dart ---------------------------------------------------------------

// `dart` est fourni par le SDK Flutter (<flutter>/bin/dart). Si seul `flutter`
// est sur le PATH, on prend le `dart` qui vit à côté de lui.
const resolveDart = () => {
  const direct = which('dart');
  if (direct) return direct;
  const flutter = which('flutter');
  if (!flutter) return null;
  const sibling = join(dirname(realpathSync(flutter)), 'dart');
  return existsSync(sibling) ? sibling : null;
};

const dart = resolveDart();
if (!dart) {
  fail(
    'Ni `dart` ni `flutter` sur le PATH — build_runner ne peut pas produire les *.g.dart.\n\n' +
      '  Installer Flutter 3.41.7 (version de la CI) : https://docs.flutter.dev/get-started/install\n' +
      '  puis ajouter <flutter>/bin au PATH.',
  );
}

// --- 4. Génération ---------------------------------------------------------

const childEnv = {
  JAVA_HOME: javaHome,
  PATH: `${join(javaHome, 'bin')}:${process.env.PATH ?? ''}`,
};

// Le générateur tourne DEPUIS LA RACINE — c'est obligatoire, pas cosmétique.
// Le CLI résout `generator-cli.storageDir` contre son répertoire courant, donc
// lancé depuis le paquet le jar de 30 Mo atterrirait dans
// packages/api-client-dart/node_modules/.cache/ au lieu du chemin mis en cache
// par la CI. Voir le commentaire en tête de openapi-config.yaml, dont les
// chemins sont eux aussi relatifs à la racine pour cette raison.
//
// `--openapitools` reste explicite : sans lui, un CLI lancé depuis un autre
// répertoire ne verrait pas la version épinglée et téléchargerait le jar
// « latest » du jour, ce qui rendrait la sortie non reproductible.
// Le binaire est résolu explicitement, et non via `pnpm exec` : lancé depuis
// la racine, `pnpm exec` ne cherche que dans <racine>/node_modules/.bin, où
// openapi-generator-cli n'est pas — c'est une devDependency de
// @crm/api-client-dart. On passe donc par la résolution de module depuis ce
// paquet, ce qui fonctionne quelle que soit la stratégie de liage de pnpm.
const requireFromPackage = createRequire(join(packageDir, 'package.json'));
let generatorCli;
try {
  generatorCli = requireFromPackage.resolve('@openapitools/openapi-generator-cli/main.js');
} catch {
  fail('@openapitools/openapi-generator-cli est introuvable. Lancer `pnpm install` à la racine.');
}

runAtRoot(
  process.execPath,
  [
    generatorCli,
    '--openapitools',
    openapitools,
    'generate',
    '-c',
    'packages/api-client-dart/openapi-config.yaml',
  ],
  { env: childEnv },
);

// --- 4 bis. Élagage des fichiers d'un contrat révolu ------------------------
//
// openapi-generator ÉCRIT mais n'EFFACE JAMAIS. Une route ou un schéma retiré
// du contrat laisse donc son fichier Dart sur le disque, indéfiniment.
//
// Ce n'est pas cosmétique. Le fichier orphelin continue de compiler, reste
// importable, et se met à mentir : `devices_api.dart` proposait encore
// `POST /devices/register` des semaines après la disparition de la route côté
// serveur. Un développeur mobile qui suit l'autocomplétion écrit alors du code
// contre une route qui répond 404, sans qu'aucun outil ne l'avertisse.
//
// Le manifeste `.openapi-generator/FILES`, réécrit à chaque génération, EST la
// liste de ce qui doit exister. Tout le reste sous `lib/src` est un vestige.
// Les fichiers `*.g.dart` de build_runner n'y figurent pas et sont rattachés à
// leur source : ils disparaissent avec elle.
const manifestPath = join(packageDir, '.openapi-generator', 'FILES');
const manifest = new Set(
  readFileSync(manifestPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalize(line)),
);

const pruned = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    const relative = normalize(relative_(packageDir, full));
    const source = relative.endsWith('.g.dart')
      ? `${relative.slice(0, -'.g.dart'.length)}.dart`
      : relative;
    if (!manifest.has(source)) {
      rmSync(full);
      pruned.push(relative);
    }
  }
};
walk(join(packageDir, 'lib', 'src'));

if (pruned.length) {
  console.log(`  ${pruned.length} fichier(s) d'un contrat révolu supprimé(s) :`);
  for (const file of pruned) console.log(`    - ${file}`);
}

// `dart pub get` avant build_runner : sur une machine fraîche le .dart_tool
// n'existe pas et build_runner échoue avec un message peu clair.
run(dart, ['pub', 'get'], { env: childEnv });
run(dart, ['run', 'build_runner', 'build', '--delete-conflicting-outputs'], { env: childEnv });
run(dart, ['format', '.'], { env: childEnv });

// --- 5. Portillon anti-dérive ---------------------------------------------

run('node', [join(packageDir, 'scripts', 'check-generated.mjs')], { env: childEnv });

console.log('\n✔ packages/api-client-dart/lib régénéré.\n');
