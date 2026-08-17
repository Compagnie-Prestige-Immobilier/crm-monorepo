import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../..', import.meta.url).pathname;

const EXEMPT = new Map<string, string>([
  ['modules/health/health.controller.ts#live', '@Public, sonde de vivacité, aucune donnée'],
  ['modules/health/health.controller.ts#ready', '@Public, sonde de disponibilité, SELECT 1'],

  ['modules/auth/auth.controller.ts#login', '@Public, établit la session'],
  ['modules/auth/auth.controller.ts#refresh', '@Public, renouvelle sur jeton porteur'],
  ['modules/auth/auth.controller.ts#logout', '@Public, révoque le jeton présenté'],

  ['modules/app-updates/app-updates.controller.ts#current', '@Public, version disponible'],
  ['modules/app-updates/app-updates.controller.ts#download', '@Public, récupération de l’APK'],
]);

async function walkControllers(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walkControllers(full);
      return entry.name.endsWith('.controller.ts') && !entry.name.includes('.test.') ? [full] : [];
    }),
  );
  return files.flat();
}

const HTTP_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete|All)\s*\(/;
const ROLES_DECORATOR = /^\s*@Roles\s*\(/;
const CLASS_LINE = /^export (?:abstract )?class \w+/;

const METHOD_LINE =
  /^ {2}(?:(?:private|protected|public|readonly|static|async)\s+)*(\w+)\s*(?:<[^>]*>)?\(/;

export interface RouteSite {
  readonly method: string;
  readonly line: number;
  readonly hasRoles: boolean;
}

export function routeSites(source: string): RouteSite[] {
  const lines = source.split('\n');

  const classLine = lines.findIndex((line) => CLASS_LINE.test(line));
  const classRoles =
    classLine > 0 && lines.slice(0, classLine).some((line) => ROLES_DECORATOR.test(line));

  const sites: RouteSite[] = [];
  let block: string[] = [];

  for (let index = classLine + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const method = METHOD_LINE.exec(line);

    if (method === null) {
      block.push(line);
      continue;
    }

    const name = method[1] ?? '';
    if (name !== 'constructor' && block.some((candidate) => HTTP_DECORATOR.test(candidate))) {
      sites.push({
        method: name,
        line: index + 1,
        hasRoles: classRoles || block.some((candidate) => ROLES_DECORATOR.test(candidate)),
      });
    }
    block = [];
  }

  return sites;
}

const MINIMUM_ROUTES = 60;
const MINIMUM_CONTROLLERS = 18;

describe('autorisation, balayage', () => {
  it('AUCUNE ROUTE N’EST OUVERTE SANS L’AVOIR DÉCIDÉ', async () => {
    const files = await walkControllers(SRC);
    const nues: string[] = [];
    let routes = 0;

    for (const file of files) {
      const relative = file.slice(SRC.length).replace(/^\/+/, '');
      const source = await readFile(file, 'utf8');

      for (const site of routeSites(source)) {
        routes += 1;
        if (site.hasRoles) continue;
        if (EXEMPT.has(`${relative}#${site.method}`)) continue;
        nues.push(`${relative}:${String(site.line)} ${site.method}()`);
      }
    }

    expect(files.length).toBeGreaterThanOrEqual(MINIMUM_CONTROLLERS);
    expect(routes).toBeGreaterThanOrEqual(MINIMUM_ROUTES);

    expect(
      nues,
      'Ces routes ne déclarent AUCUN rôle, et `RolesGuard` laisse passer en ' +
        'l’absence de décorateur : elles sont donc atteignables par toute ' +
        'identité authentifiée. Posez `@Roles(...)` sur la méthode ou sur sa ' +
        'classe, ou, si l’ouverture est voulue, inscrivez la route dans EXEMPT ' +
        'avec son motif.\n  ' +
        nues.join('\n  '),
    ).toEqual([]);
  });

  it('chaque dispense vise une route existante et reste NÉCESSAIRE', async () => {
    const files = await walkControllers(SRC);
    const connues = new Map<string, boolean>();

    for (const file of files) {
      const relative = file.slice(SRC.length).replace(/^\/+/, '');
      const source = await readFile(file, 'utf8');
      for (const site of routeSites(source)) {
        connues.set(`${relative}#${site.method}`, site.hasRoles);
      }
    }

    const absentes: string[] = [];
    const inutiles: string[] = [];

    for (const [key, motif] of EXEMPT) {
      expect(motif.trim(), `dispense sans motif : ${key}`).not.toBe('');
      const gardee = connues.get(key);
      if (gardee === undefined) absentes.push(key);
      else if (gardee) inutiles.push(key);
    }

    expect(absentes, 'Ces dispenses visent une route qui n’existe plus.').toEqual([]);
    expect(
      inutiles,
      'Ces routes portent désormais un `@Roles` : retirez-les de EXEMPT, sans ' +
        'quoi elles cesseraient d’être contrôlées le jour où le décorateur ' +
        'disparaîtrait.',
    ).toEqual([]);
  });

  const CONTROLEUR_TEMOIN = [
    "@ApiTags('temoin')",
    'export class TemoinController {',
    '  constructor(private readonly service: TemoinService) {}',
    '',
    "  @Get('garde')",
    '  @Roles(Role.ADMIN)',
    '  gardee(): Promise<void> {',
    '    return this.service.lire();',
    '  }',
    '',
    "  @Get('nue')",
    '  @ApiOperation({',
    "    operationId: 'nue',",
    '  })',
    '  nue(): Promise<void> {',
    '    return this.service.lire();',
    '  }',
    '',
    '  private aide(): void {}',
    '}',
  ].join('\n');

  it('voit une route qui a PERDU son décorateur', () => {
    const sites = routeSites(CONTROLEUR_TEMOIN);

    expect(sites.map((site) => site.method)).toEqual(['gardee', 'nue']);
    expect(sites.find((site) => site.method === 'gardee')?.hasRoles).toBe(true);
    expect(sites.find((site) => site.method === 'nue')?.hasRoles).toBe(false);

    const degarni = CONTROLEUR_TEMOIN.replace('  @Roles(Role.ADMIN)\n', '');
    expect(routeSites(degarni).every((site) => !site.hasRoles)).toBe(true);
  });

  it('compte un `@Roles` de CLASSE pour toutes ses routes', () => {
    const parClasse =
      ['@Roles(Role.ADMIN)', 'export class TemoinController {'].join('\n') +
      "\n\n  @Get('nue')\n  nue(): Promise<void> {\n    return this.service.lire();\n  }\n}";

    expect(routeSites(parClasse)).toEqual([{ method: 'nue', line: 5, hasRoles: true }]);
  });

  it('ne prend pas un import de `Roles` pour une garde', () => {
    const importe = [
      "import { Roles } from '../../common/decorators/roles.decorator.js';",
      '',
      'export class TemoinController {',
      "  @Get('nue')",
      '  nue(): Promise<void> {',
      '    return this.service.lire();',
      '  }',
      '}',
    ].join('\n');

    expect(routeSites(importe)[0]?.hasRoles).toBe(false);
  });
});
