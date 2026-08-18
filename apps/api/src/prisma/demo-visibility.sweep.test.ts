import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('..', import.meta.url).pathname;

const SCHEMA_PATH = new URL('../../../../packages/database/prisma/schema.prisma', import.meta.url)
  .pathname;

const DEMO_MODELS = [
  'user',
  'prospect',
  'representant',
  'bankCase',
  'callCampaign',
  'callTask',
  'callAttempt',
  'bankCaseTransition',
  'repCallCampaign',
  'repCallTask',
  'repCallAttempt',
  'clientCreationRequest',
  'notification',
  'notificationTemplate',
  'notificationDelivery',
  'deviceToken',
  'segmentChange',
  'scheduledCallback',
  'representantRelationChange',
  'importJob',
] as const;

const EXEMPT = new Map<string, string>([
  ['modules/prospects/last-attempt.ts', 'projection d’une ligne déjà filtrée par l’appelant'],

  ['modules/admin/purge-steps.ts', 'compte l’intégralité des lignes avant effacement'],
  ['modules/admin/purge.service.ts', 'orchestre l’effacement, même portée que ses étapes'],

  ['modules/bank-cases/bank-case-stages.service.ts', 'garde-fou d’intégrité, compte tout'],

  ['modules/phase2/phase2-sync.service.ts', 'chemin d’écriture, résolution par identifiant'],

  ['modules/auth/auth.service.ts', 'résolution du compte à la connexion'],
]);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.ts') && !entry.name.includes('.test.') ? [full] : [];
    }),
  );
  return files.flat();
}

const READ_METHODS = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];

const DEMO_TABLES = [
  'users',
  'prospects',
  'representants',
  'bank_cases',
  'bank_case_transitions',
  'call_campaigns',
  'call_tasks',
  'call_attempts',
  'rep_call_campaigns',
  'rep_call_tasks',
  'rep_call_attempts',
  'client_creation_requests',
  'notifications',
  'notification_templates',
  'notification_deliveries',
  'device_tokens',
  'segment_changes',
  'scheduled_callbacks',
  'representant_relation_changes',
  'import_jobs',
] as const;

const GLOBAL_READ_MARKER = 'LECTURE GLOBALE';

const MARKER_LOOKBACK_LINES = 30;

const VISIBILITY_TOKENS = [
  'demoScope',
  'demoScopeSql',
  'demoScopeOn',
  'isDemo',
  'demoWhere',
  'buildProspectWhere',
  'prospectConditions',
  'bankCaseConditions',
  'eligibleForCampaignWhere',
];

function argumentsOf(source: string, openParen: number): string {
  let depth = 0;
  for (let index = openParen; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParen, index + 1);
    }
  }
  return source.slice(openParen);
}

function withoutComments(source: string): string {
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (match, prefix: string) => prefix + blank(match.slice(prefix.length)),
    );
}

function lookbackAt(source: string, offset: number): string {
  const before = source.slice(0, offset).split('\n');
  return before.slice(Math.max(0, before.length - MARKER_LOOKBACK_LINES)).join('\n');
}

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

function unscopedCallSites(source: string): number[] {
  const offenders: number[] = [];
  const code = withoutComments(source);
  const fileMentions = VISIBILITY_TOKENS.some((token) => code.includes(token));

  for (const model of DEMO_MODELS) {
    for (const method of READ_METHODS) {
      const needle = `.${model}.${method}(`;
      let from = 0;
      for (;;) {
        const found = code.indexOf(needle, from);
        if (found === -1) break;
        from = found + needle.length;

        const args = argumentsOf(code, found + needle.length - 1);

        const literalWhere = whereBody(args);
        const clause = literalWhere ?? args;
        if (VISIBILITY_TOKENS.some((token) => clause.includes(token))) continue;

        if (passesWhereByReference(args)) {
          if (fileMentions) continue;
          offenders.push(lineAt(source, found));
          continue;
        }

        if (resolvesByIdentifier(args)) continue;

        if (lookbackAt(source, found).includes(GLOBAL_READ_MARKER)) continue;

        offenders.push(lineAt(source, found));
      }
    }
  }

  return offenders;
}

function resolvesByIdentifier(args: string): boolean {
  const body = whereBody(args);
  if (body === null) return false;

  for (const entry of topLevelEntries(body)) {
    const separator = entry.indexOf(':');
    const key = (separator === -1 ? entry : entry.slice(0, separator)).trim();
    if (key !== 'id') continue;
    if (separator === -1) return true; // `where: { id }`

    const value = entry.slice(separator + 1).trim();
    if (value.startsWith('{')) {
      if (/^\{\s*in\b/.test(value)) return true;
      continue;
    }
    return true;
  }
  return false;
}

function whereBody(args: string): string | null {
  const match = /where\s*:\s*\{/.exec(args);
  if (match === null) return null;

  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < args.length; index += 1) {
    if (args[index] === '{') depth += 1;
    else if (args[index] === '}') {
      depth -= 1;
      if (depth === 0) return args.slice(open + 1, index);
    }
  }
  return null;
}

function topLevelEntries(body: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '{' || char === '[' || char === '(') depth += 1;
    else if (char === '}' || char === ']' || char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      entries.push(body.slice(start, index));
      start = index + 1;
    }
  }
  entries.push(body.slice(start));
  return entries.map((entry) => entry.trim()).filter((entry) => entry !== '');
}

function passesWhereByReference(args: string): boolean {
  if (/\bwhere\s*[,}]/.test(args)) return true;
  if (/\bwhere\s*:\s*[A-Za-z_$][\w$.]*(\s*[(,}]|\s*\))/.test(args)) return true;
  return /\.\.\.[A-Za-z_$][\w$.]*\s*[,}]/.test(args);
}

function unscopedSqlReads(source: string): number[] {
  const pattern = new RegExp(`(?:FROM|JOIN)\\s+"(${DEMO_TABLES.join('|')})"`, 'g');
  const code = withoutComments(source);
  if (VISIBILITY_TOKENS.some((token) => code.includes(token))) return [];

  const offenders: number[] = [];
  for (const match of code.matchAll(pattern)) {
    const offset = match.index;
    if (lookbackAt(source, offset).includes(GLOBAL_READ_MARKER)) continue;
    offenders.push(lineAt(source, offset));
  }

  return offenders;
}

describe('visibilité de démonstration, balayage', () => {
  it('aucune lecture n’omet le filtre, SITE D’APPEL PAR SITE D’APPEL', async () => {
    const files = await walk(SRC);
    const coupables: string[] = [];

    for (const file of files) {
      const relative = file.slice(SRC.length).replace(/^\/+/, '');
      if (EXEMPT.has(relative)) continue;

      const source = await readFile(file, 'utf8');
      const lines = [...unscopedCallSites(source), ...unscopedSqlReads(source)].sort(
        (left, right) => left - right,
      );
      for (const line of lines) coupables.push(`${relative}:${String(line)}`);
    }

    expect(
      coupables,
      `Ces LECTURES portent sur un modèle ou une table porteuse d’isDemo sans ` +
        `cloisonner. Composez demoScope(await this.demo.enabled()) dans le where, ` +
        `ou demoScopeOn(alias, demoEnabled) en SQL brut. Si la lecture doit ` +
        `délibérément tout voir, écrivez « ${GLOBAL_READ_MARKER} » dans un ` +
        `commentaire juste au-dessus, avec son motif ; en dernier recours ` +
        `seulement, ajoutez le fichier entier à EXEMPT.\n  ${coupables.join('\n  ')}`,
    ).toEqual([]);
  });

  it('chaque dispense vise un fichier existant et reste NÉCESSAIRE', async () => {
    const inutiles: string[] = [];
    const absentes: string[] = [];

    for (const [file, motif] of EXEMPT) {
      expect(motif.trim(), `dispense sans motif : ${file}`).not.toBe('');

      let source: string;
      try {
        source = await readFile(join(SRC, file), 'utf8');
      } catch {
        absentes.push(file);
        continue;
      }

      const infractions = [...unscopedCallSites(source), ...unscopedSqlReads(source)];
      if (infractions.length === 0) inutiles.push(file);
    }

    expect(absentes, 'Ces dispenses visent un fichier qui n’existe plus.').toEqual([]);
    expect(
      inutiles,
      'Ces fichiers passent désormais le balayage sans dispense : retirez-les ' +
        'de EXEMPT, sans quoi ils cesseraient d’être contrôlés le jour où ils ' +
        'recommenceraient à lire sans cloisonner.',
    ).toEqual([]);
  });

  it('reconnaît une lecture non cloisonnée', () => {
    const fautif = `await this.prisma.prospect.findMany({ where: { deletedAt: null } });`;
    expect(unscopedCallSites(fautif)).toHaveLength(1);

    const alibi = `// isDemo est géré ailleurs\n${fautif}`;
    expect(unscopedCallSites(alibi)).toHaveLength(1);
  });

  it('accepte une lecture cloisonnée, et une lecture globale motivée', () => {
    const propre = `await this.prisma.prospect.findMany({ where: { ...demoScope(demoEnabled) } });`;
    expect(unscopedCallSites(propre)).toEqual([]);

    const global = `// LECTURE GLOBALE : contrôle d’unicité adossé à un index global.\nawait this.prisma.prospect.findFirst({ where: { phoneE164 } });`;
    expect(unscopedCallSites(global)).toEqual([]);
  });

  it('ne prend pas une clé étrangère pour une clé primaire', () => {
    const parFk = `await this.prisma.bankCase.count({ where: { currentStageId: id, deletedAt: null } });`;
    expect(unscopedCallSites(parFk)).toHaveLength(1);

    const parPk = `await this.prisma.bankCase.findFirst({ where: { id, deletedAt: null } });`;
    expect(unscopedCallSites(parPk)).toEqual([]);
  });

  it('accepte une relecture par lot de clés primaires, refuse une exclusion', () => {
    const parLot = `await this.prisma.prospect.findMany({ where: { id: { in: ids }, deletedAt: null } });`;
    expect(unscopedCallSites(parLot)).toEqual([]);

    const parExclusion = `await this.prisma.prospect.findFirst({ where: { phoneE164, id: { not: exceptId } } });`;
    expect(unscopedCallSites(parExclusion)).toHaveLength(1);
  });

  it('voit une table de démonstration derrière un JOIN, pas seulement un FROM', () => {
    const fautif = `SELECT 1 FROM "prospects" p JOIN "bank_cases" bc ON bc."prospectId" = p."id"`;
    expect(unscopedSqlReads(fautif).length).toBeGreaterThan(0);
  });

  it('ne laisse pas un commentaire blanchir une lecture SQL', () => {
    const fautif = `const q = sql\`SELECT 1 FROM "prospects" p\`;`;
    expect(unscopedSqlReads(fautif)).toHaveLength(1);

    const alibi = `// la visibilité isDemo est posée en amont\n${fautif}`;
    expect(unscopedSqlReads(alibi)).toHaveLength(1);

    const bloc = `/**\n * Cloisonné par isDemo ailleurs.\n */\n${fautif}`;
    expect(unscopedSqlReads(bloc)).toHaveLength(1);

    const propre = `const q = sql\`SELECT 1 FROM "prospects" p WHERE \${demoScopeSql(demoEnabled)}\`;`;
    expect(unscopedSqlReads(propre)).toEqual([]);
  });

  it('le contrôle SQL reste au niveau du FICHIER, et c’est une limite connue', () => {
    const melange = [
      'const a = sql`SELECT 1 FROM "prospects" p WHERE ${demoScopeSql(demoEnabled)}`;',
      'const b = sql`SELECT 1 FROM "bank_cases" bc`;',
    ].join('\n');

    expect(unscopedSqlReads(melange)).toEqual([]);
  });

  it('ne prend pas une projection d’isDemo pour un filtre', () => {
    const projection = `await this.prisma.prospect.findMany({ where: { deletedAt: null }, select: { isDemo: true } });`;
    expect(unscopedCallSites(projection)).toHaveLength(1);

    const orderBy = `await this.prisma.prospect.findMany({ where: { deletedAt: null }, orderBy: { isDemo: 'asc' } });`;
    expect(unscopedCallSites(orderBy)).toHaveLength(1);

    const filtre = `await this.prisma.prospect.findMany({ where: { deletedAt: null, isDemo: false }, select: { isDemo: true } });`;
    expect(unscopedCallSites(filtre)).toEqual([]);
  });

  it('ne prend pas une pagination par curseur pour une ligne unique', () => {
    const curseur = `await this.prisma.prospect.findMany({ where: { id: { gt: cursor } }, take: 100 });`;
    expect(unscopedCallSites(curseur)).toHaveLength(1);

    const borne = `await this.prisma.prospect.findMany({ where: { id: { lte: fin } } });`;
    expect(unscopedCallSites(borne)).toHaveLength(1);

    const exclusion = `await this.prisma.prospect.findMany({ where: { id: { notIn: dejaVus } } });`;
    expect(unscopedCallSites(exclusion)).toHaveLength(1);

    expect(
      unscopedCallSites(
        `await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });`,
      ),
    ).toEqual([]);
    expect(
      unscopedCallSites(`await this.prisma.prospect.findMany({ where: { id: { in: ids } } });`),
    ).toEqual([]);
  });

  it('la liste des modèles et des tables suit le SCHÉMA', async () => {
    const schema = await readFile(SCHEMA_PATH, 'utf8');
    const carriers = demoCarriersOf(schema);

    expect(
      carriers.length,
      'aucun modèle porteur lu : le chemin du schéma a bougé',
    ).toBeGreaterThan(10);

    expect(
      carriers.map((carrier) => carrier.delegate).sort(),
      'Ces modèles portent `isDemo` dans le schéma sans figurer dans ' +
        'DEMO_MODELS, ou l’inverse. Un modèle absent de la liste n’est balayé ' +
        'par RIEN : ses lectures peuvent oublier le cloisonnement sans que ' +
        'cette suite ne bronche.',
    ).toEqual([...DEMO_MODELS].sort());

    expect(
      carriers.map((carrier) => carrier.table).sort(),
      'Même écart, côté SQL brut : une table absente de DEMO_TABLES dispense ' +
        'en silence tout agrégat écrit sur elle.',
    ).toEqual([...DEMO_TABLES].sort());
  });
});

interface DemoCarrier {
  readonly delegate: string;
  readonly table: string;
}

function demoCarriersOf(schema: string): DemoCarrier[] {
  const carriers: DemoCarrier[] = [];

  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const name = match[1] ?? '';
    const body = match[2] ?? '';
    if (!/^\s*isDemo\s+Boolean\b/m.test(body)) continue;

    const mapped = /@@map\("([a-z_]+)"\)/.exec(body);
    carriers.push({
      delegate: name.charAt(0).toLowerCase() + name.slice(1),
      table: mapped?.[1] ?? name,
    });
  }

  return carriers;
}
