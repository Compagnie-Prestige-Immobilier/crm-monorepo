import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Balayage, aucune route ne doit oublier de dire QUI a le droit de l'appeler.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE BALAYAGE EXISTE : LA GARDE LAISSE PASSER PAR DÉFAUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `RolesGuard` commence par `if (!required?.length) return true`. C'est un
 * choix défendable, et il n'est pas remis en cause ici : la très grande
 * majorité des routes est ouverte aux trois rôles, et exiger un décorateur
 * partout produirait une forêt de `@Roles(ADMIN, COMMERCIAL, BANQUE_FINANCE)`
 * que plus personne ne lirait.
 *
 * Mais il a une conséquence qu'aucun test ne surveillait : une route SANS
 * décorateur est atteignable par TOUTE identité authentifiée, et cela ne se
 * voit nulle part. Le fichier a l'air correct, la revue passe, la suite est
 * verte. Le seul moment où l'omission se remarque est celui où quelqu'un se
 * demande, devant la production, quel rôle peut appeler cette route.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI EXISTAIT DÉJÀ, ET POURQUOI ÇA NE SUFFISAIT PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `authorization.test.ts` est un bon test : il réfléchit sur les prototypes de
 * contrôleurs RÉELS et vérifie que sa matrice couvre exactement leurs routes,
 * ce qui empêche la matrice de mentir. Sa faiblesse est ailleurs, et elle est
 * structurelle : la LISTE des contrôleurs qu'il parcourt est un littéral. Il
 * couvre dix contrôleurs sur vingt et un, et le onzième, écrit demain, n'y
 * entrera que si son auteur y pense.
 *
 * C'est exactement la forme de défaut que le cloisonnement de démonstration a
 * déjà rencontrée trois fois, et qu'il a réparée trois fois de la même façon :
 * un balayage qui lit l'ARBORESCENCE plutôt qu'une liste. Un fichier ajouté
 * demain y entre sans que personne ait à y penser.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÈGLE VÉRIFIÉE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Toute route HTTP doit relever d'un de ces trois cas :
 *
 *   1. `@Roles(...)` sur la méthode ;
 *   2. `@Roles(...)` sur sa classe, qui vaut pour toutes ses routes ;
 *   3. une DISPENSE NOMMÉE dans `EXEMPT`, avec son motif écrit.
 *
 * Une route `@Public` n'est pas dispensée d'office, et c'est délibéré : elle
 * est le cas le plus dangereux du lot, puisqu'elle n'est même pas
 * authentifiée. Elle doit donc figurer dans `EXEMPT` comme les autres, avec la
 * raison pour laquelle elle est ouverte.
 *
 * Et comme dans les balayages de démonstration, chaque dispense doit rester
 * NÉCESSAIRE : une dispense qui ne couvre plus rien est retirée d'office, sans
 * quoi elle rouvrirait silencieusement la porte le jour où la route qu'elle
 * nomme perdrait son décorateur.
 */

const SRC = new URL('../..', import.meta.url).pathname;

/**
 * Dispenses, chacune avec son motif. La clé est `chemin.ts#méthode`.
 *
 * Une dispense dit « cette route est ouverte à toute identité authentifiée, ou
 * à personne en particulier, ET C'EST VOULU ». Elle ne dit jamais « on n'a pas
 * eu le temps ».
 */
const EXEMPT = new Map<string, string>([
  // ═══════════════════════════════════════════════════════════════════════════
  // IL N'Y A QUE DES ROUTES `@Public` DANS CETTE LISTE, ET C'EST LA RÈGLE
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Une route authentifiée mais ouverte à tous ne se dispense PAS ici : elle
  // porte `@Roles(...ANY_AUTHENTICATED)`, qui dit la même chose à l'endroit où
  // le lecteur la cherche, et qui reste sous le contrôle du balayage. Onze
  // routes ont été traitées ainsi plutôt qu'inscrites ci-dessous.
  //
  // Ne restent donc que les routes NON AUTHENTIFIÉES, pour lesquelles un
  // `@Roles` serait non seulement inutile mais faux : sans session, il n'y a
  // pas d'identité à comparer, et `RolesGuard` refuserait la route qu'on
  // prétend ouvrir. Elles sont le cas le plus dangereux du dépôt, ce qui est
  // exactement pourquoi elles doivent être nommées une par une, avec le motif
  // qui justifie l'ouverture.

  // Sondes d'infrastructure : l'orchestrateur qui redémarre le conteneur n'a
  // pas de session. Elles ne lisent aucune donnée métier, `ready` se contentant
  // d'un `SELECT 1`.
  ['modules/health/health.controller.ts#live', '@Public, sonde de vivacité, aucune donnée'],
  ['modules/health/health.controller.ts#ready', '@Public, sonde de disponibilité, SELECT 1'],

  // Les trois routes qui DONNENT ou REPRENNENT une session. Exiger un rôle
  // reviendrait à demander une session pour en obtenir une. Le contrôle
  // d'accès y est le corps même de la route, mot de passe ou jeton de
  // rafraîchissement, et il est épinglé par `auth.service.test.ts`.
  ['modules/auth/auth.controller.ts#login', '@Public, établit la session'],
  ['modules/auth/auth.controller.ts#refresh', '@Public, renouvelle sur jeton porteur'],
  ['modules/auth/auth.controller.ts#logout', '@Public, révoque le jeton présenté'],

  // Mise à jour de l'application mobile. Les deux routes sont ouvertes parce
  // qu'un téléphone dont la version est trop ancienne pour ouvrir une session
  // doit pouvoir constater qu'une mise à jour existe et la récupérer : une
  // session exigée ici enfermerait dehors exactement les appareils que ces
  // routes existent pour repêcher. Le DÉPÔT d'une nouvelle version, lui, porte
  // `@Roles(ADMIN)`.
  ['modules/app-updates/app-updates.controller.ts#current', '@Public, version disponible'],
  ['modules/app-updates/app-updates.controller.ts#download', '@Public, récupération de l’APK'],
]);

/** Fichiers de contrôleur, lus dans l'ARBORESCENCE et jamais dans une liste. */
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

/**
 * Signature de méthode d'une classe, au premier niveau d'indentation.
 *
 * Deux espaces exactement : c'est le seul niveau où vit une méthode de classe
 * dans ce dépôt (Prettier, deux espaces), et cela écarte d'office les clés
 * d'objets littéraux passées aux décorateurs, qui sont plus profondes. Le
 * constructeur est exclu, il ne porte jamais de route.
 */
const METHOD_LINE = /^ {2}(?:(?:private|protected|public|readonly|static|async)\s+)*(\w+)\s*(?:<[^>]*>)?\(/;

export interface RouteSite {
  /** Nom de la méthode qui porte la route. */
  readonly method: string;
  /** Ligne de la signature, pour que le message d'échec soit cliquable. */
  readonly line: number;
  /** La route, ou sa classe, déclare-t-elle un rôle ? */
  readonly hasRoles: boolean;
}

/**
 * Relève les routes d'un fichier de contrôleur, et dit si chacune est gardée.
 *
 * ═══ POURQUOI LIRE LE TEXTE PLUTÔT QUE LES MÉTADONNÉES ═══
 *
 * `authorization.test.ts` réfléchit sur les prototypes, et c'est très bien :
 * il valide une matrice de rôles ATTENDUS, ce qui exige d'importer les
 * classes. Ce balayage-ci pose une question plus pauvre et plus large, « y
 * a-t-il un décorateur ou une dispense », sur les vingt et un contrôleurs.
 *
 * Le lire dans le TEXTE lui donne trois propriétés que la réflexion n'aurait
 * pas : il n'importe rien, donc aucun module ne peut le faire échouer en
 * s'initialisant mal ; il tourne sur un fichier qui n'est pas encore branché
 * dans un module ; et surtout il peut être exercé sur une source SYNTHÉTIQUE,
 * ce qui rend son propre témoin possible. Un balayage qu'on ne peut pas faire
 * rougir volontairement ne prouve rien.
 *
 * Le décompte des blocs suit une règle simple : tout ce qui précède une
 * signature de méthode, depuis la signature précédente, est le bloc de
 * décorateurs de cette méthode.
 */
export function routeSites(source: string): RouteSite[] {
  const lines = source.split('\n');

  // `@Roles` posé sur la CLASSE vaut pour toutes ses routes : c'est la forme
  // que suivent `analytics.controller.ts` et `admin.controller.ts`.
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

/**
 * Plancher de crédibilité du balayage.
 *
 * Un analyseur qui ne trouve plus aucune route passerait au vert sur un dépôt
 * entièrement ouvert : c'est le mode de panne le plus probable d'un test qui
 * lit du texte, et le seul qui ne se voit pas. Le plancher est délibérément
 * très en dessous du décompte réel, pour qu'un contrôleur supprimé ne fasse
 * pas rougir la suite, et très au-dessus de zéro.
 */
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

    // Voir MINIMUM_ROUTES : un analyseur devenu aveugle doit rougir, pas
    // féliciter.
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

  /**
   * Une dispense doit PORTER SUR QUELQUE CHOSE, et rester méritée.
   *
   * C'est le contrôle qui empêche la liste de pourrir, et il est repris tel
   * quel des balayages de démonstration : une dispense qui vise une route
   * disparue, ou une route qui porte désormais un `@Roles`, est une porte
   * laissée ouverte pour plus tard.
   */
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * TÉMOIN : LE BALAYAGE SAIT ROUGIR
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Sans lui, ce fichier serait un test de plus qui passe. On lui donne donc
   * une source SYNTHÉTIQUE portant exactement le défaut redouté, une route
   * authentifiée à qui personne n'a dit qui pouvait l'appeler, et on vérifie
   * qu'il la voit.
   */
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

    // Deux routes, et le constructeur comme la méthode privée sont ignorés.
    expect(sites.map((site) => site.method)).toEqual(['gardee', 'nue']);
    expect(sites.find((site) => site.method === 'gardee')?.hasRoles).toBe(true);
    expect(sites.find((site) => site.method === 'nue')?.hasRoles).toBe(false);

    // Et la même source, décorateur retiré, fait tomber la première aussi.
    const degarni = CONTROLEUR_TEMOIN.replace('  @Roles(Role.ADMIN)\n', '');
    expect(routeSites(degarni).every((site) => !site.hasRoles)).toBe(true);
  });

  it('compte un `@Roles` de CLASSE pour toutes ses routes', () => {
    const parClasse = ['@Roles(Role.ADMIN)', 'export class TemoinController {'].join('\n') +
      "\n\n  @Get('nue')\n  nue(): Promise<void> {\n    return this.service.lire();\n  }\n}";

    expect(routeSites(parClasse)).toEqual([{ method: 'nue', line: 5, hasRoles: true }]);
  });

  /**
   * Le `@Roles` d'un AUTRE contrôleur importé ne doit rien blanchir : le
   * décorateur de classe se lit au-dessus de la classe, pas n'importe où dans
   * le fichier. Un import de `Roles` en tête de fichier est présent partout, et
   * le prendre pour une garde annulerait le balayage entier.
   */
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
