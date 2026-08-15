import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Balayage, aucun service de lecture ne doit oublier la visibilité de démo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN TEST DE BALAYAGE ET PAS UN TEST PAR SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un test par service vérifie les services qui EXISTENT. Le défaut redouté est
 * l'inverse : le service écrit dans six mois, par quelqu'un qui n'aura pas lu
 * `demo-visibility.ts`, et dont la requête ressortira des fiches fictives dans
 * un export transmis au siège. Aucun test existant ne se met au rouge pour un
 * fichier qui n'existait pas quand il a été écrit.
 *
 * Ce test-ci parcourt l'arborescence. Un fichier ajouté demain y entre sans que
 * personne ait à y penser, et c'est tout son intérêt.
 *
 * La règle vérifiée : tout service qui lit un modèle porteur d'`isDemo` doit
 * mentionner la visibilité, d'une des trois manières admises, `demoScope`,
 * `demoScopeSql`, ou `isDemo` posé à la main dans un `where`.
 */

const SRC = new URL('..', import.meta.url).pathname;

/**
 * Le schéma Prisma, seule source de vérité sur les modèles porteurs d'`isDemo`.
 *
 * Chemin relatif au fichier de test et non au répertoire de travail : la suite
 * s'exécute depuis `apps/api`, mais un lancement depuis la racine du dépôt ne
 * doit pas transformer ce contrôle en faux vert. Même convention que
 * `purge-plan.test.ts`.
 */
const SCHEMA_PATH = new URL('../../../../packages/database/prisma/schema.prisma', import.meta.url)
  .pathname;

/**
 * Modèles porteurs d'une colonne `isDemo` dans le schéma Prisma.
 *
 * LA LISTE N'EST PAS TENUE À LA MAIN SANS FILET : le test « la liste des
 * modèles suit le schéma » plus bas la compare à `schema.prisma`. Un modèle qui
 * gagne la colonne sans entrer ici fait rougir la suite, ce qui est le seul
 * moyen d'éviter la dérive qu'a connue cette liste, restée à douze entrées
 * pendant que le schéma en portait quinze : les trois modèles de notification
 * n'étaient donc balayés par RIEN.
 */
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
] as const;

/**
 * Fichiers dispensés, chacun pour une raison NOMMÉE.
 *
 * La liste est volontairement courte et commentée ligne à ligne : une dispense
 * sans motif est une régression qui a trouvé où se cacher.
 *
 * Elle a fondu de treize entrées à cinq. Les huit retirées ne dispensaient
 * RIEN : le module démonstration, les doubles d'essai et le magasin de lots
 * n'ont aucune lecture que le balayage dénoncerait, et le test
 * « chaque dispense reste NÉCESSAIRE » les tenait pour ce qu'elles étaient,
 * des portes ouvertes sur des fichiers qui n'en demandaient pas.
 */
const EXEMPT = new Map<string, string>([
  ['modules/prospects/last-attempt.ts', 'projection d’une ligne déjà filtrée par l’appelant'],

  // La purge administrative doit compter TOUT ce qu'elle s'apprête à effacer.
  // Filtrée, elle annoncerait « 120 prospects » puis en supprimerait 240, le
  // seul écran où un chiffre partiel serait plus dangereux qu'aucun chiffre.
  ['modules/admin/purge-steps.ts', 'compte l’intégralité des lignes avant effacement'],
  ['modules/admin/purge.service.ts', 'orchestre l’effacement, même portée que ses étapes'],

  // Garde-fou avant de désactiver une étape bancaire : il compte les dossiers
  // qui y stationnent. Un dossier de démonstration masqué reste un dossier
  // ACCROCHÉ à l'étape ; l'ignorer désactiverait une étape encore occupée et
  // laisserait la ligne orpheline le jour où le mode se rallume.
  ['modules/bank-cases/bank-case-stages.service.ts', 'garde-fou d’intégrité, compte tout'],

  // Chemin d'ÉCRITURE de la synchronisation mobile : il résout une fiche par
  // son identifiant, déjà cloisonné en amont. Y poser le filtre ferait
  // répondre « introuvable » à un appareil qui détient bien la ligne, et la
  // file de synchronisation se bloquerait sur une erreur inexplicable.
  ['modules/phase2/phase2-sync.service.ts', 'chemin d’écriture, résolution par identifiant'],

  // L'authentification doit trouver le compte pour vérifier le mot de passe,
  // mode de démonstration éteint ou non. Le refus se joue sur `isActive`, qui
  // est la vraie porte ; masquer le compte ici rendrait une erreur de
  // connexion indiscernable d'un compte inexistant.
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

/**
 * Tables porteuses d'`isDemo`, telles qu'elles apparaissent en SQL brut.
 *
 * `users`, `call_attempts` et `bank_case_transitions` y figurent désormais :
 * elles portent la colonne comme les autres, et leur absence de cette liste
 * dispensait en silence tout agrégat écrit sur elles. Les trois tables de
 * notification les ont rejointes pour la même raison.
 *
 * Elle est tenue à jour par le même test de dérive que `DEMO_MODELS`, à partir
 * des `@@map` du schéma.
 */
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
] as const;

/**
 * Marqueur d'une lecture délibérément NON cloisonnée.
 *
 * Certaines lectures doivent voir toute la base, et pour une raison précise :
 * un contrôle d'unicité adossé à un index global, une résolution par clé
 * primaire. Plutôt que de dispenser le FICHIER entier, on dispense le SITE
 * D'APPEL, et le motif est écrit juste au-dessus. Une dispense de fichier
 * couvre aussi les lectures qu'on n'a pas encore écrites ; une dispense de
 * site d'appel ne couvre qu'elle-même.
 */
const GLOBAL_READ_MARKER = 'LECTURE GLOBALE';

/** Nombre de lignes remontées à la recherche du marqueur ou d'un commentaire. */
const MARKER_LOOKBACK_LINES = 30;

const VISIBILITY_TOKENS = [
  'demoScope',
  'demoScopeSql',
  'demoScopeOn',
  'isDemo',
  'demoWhere',
  // Constructeurs de clause déjà couverts par ce test.
  'buildProspectWhere',
  'prospectConditions',
  'bankCaseConditions',
  'eligibleForCampaignWhere',
];

/**
 * Texte des arguments d'un appel, parenthèses équilibrées.
 *
 * Nécessaire parce que le `where` d'une requête Prisma contient lui-même des
 * appels et des objets imbriqués : une recherche jusqu'à la première
 * parenthèse fermante s'arrêterait au milieu de la clause.
 */
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

/**
 * La source PRIVÉE DE SES COMMENTAIRES, à la lettre près.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE PASSAGE EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le contrôle de FICHIER, celui qui reste pour le SQL brut et pour les clauses
 * passées par variable, se contentait de trouver la chaîne `isDemo` quelque
 * part. Une phrase de commentaire suffisait donc à blanchir toutes les
 * lectures du fichier : « la visibilité est gérée en amont » et le balayage se
 * taisait. C'est la faille qui avait été fermée site par site pour les appels
 * Prisma littéraux, et restée grande ouverte partout ailleurs.
 *
 * Les commentaires sont remplacés par des ESPACES et non supprimés : les
 * décalages, donc les numéros de ligne signalés, restent ceux du fichier réel,
 * et le marqueur `LECTURE GLOBALE` continue d'être cherché dans la source
 * d'origine, où il vit précisément dans un commentaire.
 *
 * Le garde `[^:]` devant `//` évite de prendre l'`//` d'une URL pour le début
 * d'un commentaire, ce qui effacerait la fin de la ligne qui la contient.
 */
function withoutComments(source: string): string {
  const blank = (text: string): string => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (match, prefix: string) => prefix + blank(match.slice(prefix.length)),
    );
}

/** Les `Nn` lignes qui précèdent un décalage, pour y chercher le marqueur. */
function lookbackAt(source: string, offset: number): string {
  const before = source.slice(0, offset).split('\n');
  return before.slice(Math.max(0, before.length - MARKER_LOOKBACK_LINES)).join('\n');
}

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

/**
 * Sites d'appel Prisma qui lisent un modèle porteur d'`isDemo` SANS cloisonner.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI PAR SITE D'APPEL ET PLUS PAR FICHIER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La version précédente déclarait un fichier conforme dès que la chaîne
 * `isDemo` y apparaissait N'IMPORTE OÙ, un commentaire suffisait. Un service
 * pouvait donc cloisonner sa première requête, en écrire cinq autres sans
 * filtre, et rester vert : c'est exactement ce qui est arrivé à
 * `rep-campaigns.service.ts`, conforme au test avec cinq lectures non
 * cloisonnées. Le balayage validait la PRÉSENCE D'UNE INTENTION, pas son
 * application.
 */
function unscopedCallSites(source: string): number[] {
  const offenders: number[] = [];
  // Les commentaires ne comptent pour rien, ni ici ni dans le repli de
  // fichier : voir `withoutComments`.
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

        // 1. LA CLAUSE porte le filtre, et non l'appel quelque part.
        //
        //    On juge le corps du `where`, pas le texte entier des arguments.
        //    La version précédente acceptait
        //    `findMany({ where: { deletedAt: null }, select: { isDemo: true } })` :
        //    le jeton apparaissait bien dans l'appel, mais dans la PROJECTION,
        //    où il ne filtre rien. Une lecture qui se contente de RAPPORTER la
        //    colonne passait ainsi pour une lecture qui la CONTRAINT.
        //
        //    Sans `where` littéral, il n'y a pas de corps à juger et on
        //    retombe sur les gardes suivants.
        const literalWhere = whereBody(args);
        const clause = literalWhere ?? args;
        if (VISIBILITY_TOKENS.some((token) => clause.includes(token))) continue;

        // 2. La clause est PASSÉE PAR VARIABLE (`{ where }`, `where: filtre`).
        //    Le contenu n'est pas lisible ici ; on retombe alors sur le
        //    contrôle de fichier, qui reste faible mais reste vrai : un service
        //    qui compose une clause partagée la compose une seule fois.
        if (passesWhereByReference(args)) {
          if (fileMentions) continue;
          offenders.push(lineAt(source, found));
          continue;
        }

        // 3. RÉSOLUTION PAR IDENTIFIANT : `where: { id, ... }`.
        //    Ce n'est pas une liste, c'est la relecture d'UNE ligne dont
        //    l'appelant tient déjà la clé primaire. Rien n'y fuit : on ne
        //    découvre pas une fiche de démonstration, on en relit une qu'on
        //    désigne. C'est la raison déjà retenue pour dispenser
        //    `phase2-sync.service.ts`, appliquée site par site au lieu de
        //    couvrir un fichier entier.
        if (resolvesByIdentifier(args)) continue;

        // 4. Lecture globale assumée, motif écrit juste au-dessus.
        if (lookbackAt(source, found).includes(GLOBAL_READ_MARKER)) continue;

        // 5. Clause écrite EN TOUTES LETTRES et sans filtre. C'est le cas que
        //    l'ancien balayage laissait passer, et c'est celui qui produit des
        //    lignes fictives à l'écran.
        offenders.push(lineAt(source, found));
      }
    }
  }

  return offenders;
}

/**
 * `true` si la clause désigne UNE ligne par sa clé primaire.
 *
 * `where: { id }`, `where: { id, deletedAt: null }`, `where: { id: prospectId }`.
 * Une clé étrangère (`campaignId`, `prospectId`) ne compte PAS : elle désigne
 * un ensemble, donc une liste, donc une fuite possible.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA CLÉ, PAS LA VALEUR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La version précédente cherchait `\bid\s*[:,}]` n'importe où dans la clause.
 * `where: { currentStageId: id, deletedAt: null }` la satisfaisait donc, parce
 * que la VALEUR s'appelle `id` : une lecture d'ENSEMBLE passait pour une
 * résolution par clé primaire, et le balayage la laissait filer. C'est le cas
 * le plus dangereux, celui d'une liste, précisément celui que ce garde était
 * censé exclure. On découpe désormais les propriétés de premier niveau et on
 * exige que l'une d'elles ait `id` pour NOM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN OPÉRATEUR N'EST PAS UNE CLÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La version précédente n'écartait que `id: { not: x }`. Tous les AUTRES
 * opérateurs passaient, et le plus courant du dépôt est le pire :
 * `where: { id: { gt: cursor } }` est une PAGE PAR CURSEUR, c'est-à-dire une
 * liste, et elle était lue comme la résolution d'une ligne unique. L'idiome
 * existe en quatre endroits, tous imbriqués sous un autre niveau aujourd'hui,
 * mais rien n'empêchait le prochain de l'écrire au premier niveau et de
 * dispenser sa lecture sans le savoir.
 *
 * La règle est donc inversée : on n'énumère plus ce qui est REFUSÉ, on énumère
 * ce qui est ADMIS. Deux formes seulement désignent des lignes que l'appelant
 * tient déjà :
 *
 *  - `id` ou `id: valeur` : une ligne, par sa clé ;
 *  - `id: { in: [...] }` : un lot de clés primaires, relu et non découvert.
 *
 * Tout le reste, `not`, `notIn`, `gt`, `gte`, `lt`, `lte`, `contains`, et
 * l'opérateur inventé l'an prochain, rend un ENSEMBLE et doit être cloisonné.
 */
function resolvesByIdentifier(args: string): boolean {
  const body = whereBody(args);
  if (body === null) return false;

  for (const entry of topLevelEntries(body)) {
    const separator = entry.indexOf(':');
    const key = (separator === -1 ? entry : entry.slice(0, separator)).trim();
    if (key !== 'id') continue;
    if (separator === -1) return true; // `where: { id }`

    const value = entry.slice(separator + 1).trim();
    // Un objet en valeur est un OPÉRATEUR : seul `in` désigne des lignes que
    // l'appelant tient déjà.
    if (value.startsWith('{')) {
      if (/^\{\s*in\b/.test(value)) return true;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Corps du littéral `where: { ... }`, accolades équilibrées.
 *
 * Une expression régulière `[^{}]*` s'arrêterait à la première accolade
 * imbriquée, or `where: { id: { in: ids } }` en contient une : la clause la
 * plus courante du dépôt serait alors illisible, donc jamais reconnue.
 */
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

/** Propriétés de premier niveau d'un corps d'objet, virgules imbriquées mises à part. */
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

/**
 * `true` si la clause `where` vient d'une variable plutôt que d'un littéral.
 *
 * `{ where }`, `{ where: filtre }`, `{ where: this.scope(...) }` : le contenu
 * est décidé ailleurs, et exiger le mot `demoScope` à l'intérieur de l'appel
 * condamnerait la composition, qui est justement la bonne pratique.
 */
function passesWhereByReference(args: string): boolean {
  // `{ where }` : raccourci de propriété.
  if (/\bwhere\s*[,}]/.test(args)) return true;
  // `where: filtre` : la clause entière vient d'ailleurs.
  if (/\bwhere\s*:\s*[A-Za-z_$][\w$.]*(\s*[(,}]|\s*\))/.test(args)) return true;
  // `where: { ...scope, ... }` : composition d'un fragment nommé, l'idiome
  // même que ce test veut encourager. Un `...demoScope(...)` littéral aurait
  // déjà été reconnu par les jetons ; ici le fragment porte un autre nom.
  return /\.\.\.[A-Za-z_$][\w$.]*\s*[,}]/.test(args);
}

/**
 * Lignes de SQL brut qui lisent une table porteuse d'`isDemo` sans cloisonner.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `JOIN` AUTANT QUE `FROM`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La version précédente ne regardait que `FROM`. Un agrégat dont la table de
 * tête est `prospects` et qui JOINT `bank_cases` échappait donc entièrement au
 * contrôle sur le dossier, alors que `bank_cases` porte sa propre colonne
 * `isDemo` : c'est exactement la faille par laquelle un dossier fictif entrait
 * dans l'entonnoir analytique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE CONTRÔLE-CI RESTE AU NIVEAU DU FICHIER, ET CE QU'IL A PERDU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Il reste au niveau du FICHIER, à la différence des appels Prisma. Un fragment
 * SQL se compose par interpolation, `INNER JOIN "call_tasks" ct ON ... AND
 * ${taskScope}`, et la condition arrive par une VARIABLE dont le nom est
 * choisi par l'auteur : `taskScope`, `attemptScope`, `campaignScope`, `scope`.
 * Exiger un jeton connu à côté de chaque `JOIN` condamnerait trente sites
 * légitimes, et la liste des noms admis grossirait jusqu'à ne plus rien
 * refuser. La limite est réelle et elle est assumée.
 *
 * CE QUI A ÉTÉ FERMÉ : le contrôle lit désormais la source PRIVÉE DE SES
 * COMMENTAIRES. Auparavant, la seule présence du mot `isDemo` dans une phrase
 * de commentaire dispensait TOUTES les lectures SQL du fichier, y compris
 * celles écrites six mois plus tard par quelqu'un qui n'avait pas lu la phrase.
 * C'est exactement le trou qui avait été bouché du côté Prisma. Il reste qu'un
 * fichier qui cloisonne UNE requête dispense les autres : voir le test
 * « le contrôle SQL reste au niveau du FICHIER », qui épingle cette limite
 * pour que le prochain lecteur ne s'y trompe pas.
 */
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

  /**
   * Une dispense doit PORTER SUR QUELQUE CHOSE.
   *
   * La version précédente se contentait de `motif.length > 10`, ce qu'aucune
   * phrase française n'a jamais échoué à satisfaire : le test passait sur
   * n'importe quelle dispense, y compris une dispense pointant un fichier
   * effacé six mois plus tôt. Ce qui se vérifie ici est autrement plus
   * contraignant :
   *
   *  1. le fichier dispensé EXISTE ;
   *  2. la dispense est NÉCESSAIRE : retirée, le balayage la dénoncerait.
   *
   * Le point 2 est celui qui compte. Une dispense inutile est une porte laissée
   * ouverte : le fichier qu'elle couvre peut se mettre à lire sans cloisonner
   * sans que rien ne bouge. En exigeant qu'elle soit encore méritée, on force
   * sa suppression dès que le fichier redevient conforme.
   */
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

  /**
   * Le balayage doit pouvoir ÉCHOUER. Un test de conformité qui ne sait pas
   * reconnaître une infraction ne prouve rien, et c'était le défaut de la
   * version précédente : la présence du mot `isDemo` dans un commentaire
   * suffisait à blanchir un fichier.
   */
  it('reconnaît une lecture non cloisonnée', () => {
    const fautif = `await this.prisma.prospect.findMany({ where: { deletedAt: null } });`;
    expect(unscopedCallSites(fautif)).toHaveLength(1);

    // Un commentaire mentionnant isDemo ailleurs dans le fichier ne blanchit
    // plus rien : c'est le site d'appel qui est jugé.
    const alibi = `// isDemo est géré ailleurs\n${fautif}`;
    expect(unscopedCallSites(alibi)).toHaveLength(1);
  });

  it('accepte une lecture cloisonnée, et une lecture globale motivée', () => {
    const propre = `await this.prisma.prospect.findMany({ where: { ...demoScope(demoEnabled) } });`;
    expect(unscopedCallSites(propre)).toEqual([]);

    const global = `// LECTURE GLOBALE : contrôle d’unicité adossé à un index global.\nawait this.prisma.prospect.findFirst({ where: { phoneE164 } });`;
    expect(unscopedCallSites(global)).toEqual([]);
  });

  /**
   * Le garde « résolution par identifiant » jugeait la VALEUR, pas la CLÉ.
   *
   * `where: { currentStageId: id }` contient la suite `id,` : l'ancien motif
   * `\bid\s*[:,}]` la reconnaissait comme une clé primaire et dispensait la
   * lecture. Or c'est une lecture d'ENSEMBLE, le cas même que ce garde devait
   * refuser. Le balayage relâchait ainsi silencieusement toute requête dont la
   * variable d'entrée s'appelait `id`, ce qui est la convention du dépôt.
   */
  it('ne prend pas une clé étrangère pour une clé primaire', () => {
    const parFk = `await this.prisma.bankCase.count({ where: { currentStageId: id, deletedAt: null } });`;
    expect(unscopedCallSites(parFk)).toHaveLength(1);

    const parPk = `await this.prisma.bankCase.findFirst({ where: { id, deletedAt: null } });`;
    expect(unscopedCallSites(parPk)).toEqual([]);
  });

  it('accepte une relecture par lot de clés primaires, refuse une exclusion', () => {
    // L'appelant TIENT déjà les clés : il relit, il ne découvre pas.
    const parLot = `await this.prisma.prospect.findMany({ where: { id: { in: ids }, deletedAt: null } });`;
    expect(unscopedCallSites(parLot)).toEqual([]);

    // `id: { not: x }` rend TOUT LE RESTE : c'est une liste déguisée.
    const parExclusion = `await this.prisma.prospect.findFirst({ where: { phoneE164, id: { not: exceptId } } });`;
    expect(unscopedCallSites(parExclusion)).toHaveLength(1);
  });

  it('voit une table de démonstration derrière un JOIN, pas seulement un FROM', () => {
    const fautif = `SELECT 1 FROM "prospects" p JOIN "bank_cases" bc ON bc."prospectId" = p."id"`;
    expect(unscopedSqlReads(fautif).length).toBeGreaterThan(0);
  });

  /**
   * UN COMMENTAIRE NE CLOISONNE RIEN, en SQL non plus.
   *
   * C'était le dernier endroit où la simple présence de la chaîne `isDemo`
   * suffisait, et il couvrait le fichier ENTIER : une phrase écrite en tête
   * d'un service d'agrégats blanchissait toutes ses requêtes brutes, présentes
   * et à venir. Le même défaut avait été corrigé côté Prisma et laissé ici.
   */
  it('ne laisse pas un commentaire blanchir une lecture SQL', () => {
    const fautif = `const q = sql\`SELECT 1 FROM "prospects" p\`;`;
    expect(unscopedSqlReads(fautif)).toHaveLength(1);

    const alibi = `// la visibilité isDemo est posée en amont\n${fautif}`;
    expect(unscopedSqlReads(alibi)).toHaveLength(1);

    const bloc = `/**\n * Cloisonné par isDemo ailleurs.\n */\n${fautif}`;
    expect(unscopedSqlReads(bloc)).toHaveLength(1);

    // Le cloisonnement RÉEL, lui, est toujours reconnu.
    const propre = `const q = sql\`SELECT 1 FROM "prospects" p WHERE \${demoScopeSql(demoEnabled)}\`;`;
    expect(unscopedSqlReads(propre)).toEqual([]);
  });

  /**
   * LA LIMITE DU CONTRÔLE SQL, ÉPINGLÉE PLUTÔT QUE TUE.
   *
   * Contrairement aux appels Prisma, le contrôle SQL reste au niveau du
   * FICHIER : un fragment se compose par interpolation, sous un nom de variable
   * libre (`taskScope`, `attemptScope`), et exiger un jeton connu à côté de
   * chaque `JOIN` condamnerait une trentaine de requêtes légitimes.
   *
   * Conséquence assumée, et vérifiée ici pour qu'elle soit VISIBLE : dans un
   * fichier qui cloisonne au moins une requête, une seconde requête non
   * cloisonnée passe. Ce test échouera le jour où quelqu'un saura faire mieux,
   * et ce sera le bon moment pour effacer ce commentaire.
   *
   * CETTE LIMITE A DÉJÀ COÛTÉ. La sous-requête de campagne d'`analytics.sql.ts`
   * lisait `call_tasks` sans le moindre prédicat de visibilité, dans un fichier
   * qui cloisonnait `p` quelques lignes plus haut : le balayage la blanchissait
   * intégralement. Une tâche de démonstration accrochée à un prospect réel
   * faisait donc entrer ce prospect dans le total d'une campagne, mode éteint.
   * Trouvée à la relecture, jamais par ce test. La limite n'est pas théorique.
   */
  it('le contrôle SQL reste au niveau du FICHIER, et c’est une limite connue', () => {
    const melange = [
      'const a = sql`SELECT 1 FROM "prospects" p WHERE ${demoScopeSql(demoEnabled)}`;',
      'const b = sql`SELECT 1 FROM "bank_cases" bc`;',
    ].join('\n');

    // `bc` n'est cloisonné par rien, et le balayage ne le dit pas.
    expect(unscopedSqlReads(melange)).toEqual([]);
  });

  /**
   * UN `isDemo` EN PROJECTION NE FILTRE RIEN.
   *
   * `select: { isDemo: true }` RAPPORTE la colonne, il ne la contraint pas. La
   * version précédente cherchait le jeton dans le texte entier des arguments :
   * une lecture qui affiche la nature de chaque ligne passait donc pour une
   * lecture qui écarte les fictives, ce qui est exactement l'inverse.
   */
  it('ne prend pas une projection d’isDemo pour un filtre', () => {
    const projection = `await this.prisma.prospect.findMany({ where: { deletedAt: null }, select: { isDemo: true } });`;
    expect(unscopedCallSites(projection)).toHaveLength(1);

    const orderBy = `await this.prisma.prospect.findMany({ where: { deletedAt: null }, orderBy: { isDemo: 'asc' } });`;
    expect(unscopedCallSites(orderBy)).toHaveLength(1);

    // Le même jeton DANS la clause reste évidemment accepté.
    const filtre = `await this.prisma.prospect.findMany({ where: { deletedAt: null, isDemo: false }, select: { isDemo: true } });`;
    expect(unscopedCallSites(filtre)).toEqual([]);
  });

  /**
   * UNE PAGE PAR CURSEUR N'EST PAS UNE RÉSOLUTION PAR IDENTIFIANT.
   *
   * `where: { id: { gt: cursor } }` rend TOUT ce qui suit le curseur : c'est la
   * liste elle-même. L'ancien garde n'écartait que `not` et laissait donc
   * passer la pagination par clé, qui est l'idiome de synchronisation du dépôt.
   */
  it('ne prend pas une pagination par curseur pour une ligne unique', () => {
    const curseur = `await this.prisma.prospect.findMany({ where: { id: { gt: cursor } }, take: 100 });`;
    expect(unscopedCallSites(curseur)).toHaveLength(1);

    const borne = `await this.prisma.prospect.findMany({ where: { id: { lte: fin } } });`;
    expect(unscopedCallSites(borne)).toHaveLength(1);

    const exclusion = `await this.prisma.prospect.findMany({ where: { id: { notIn: dejaVus } } });`;
    expect(unscopedCallSites(exclusion)).toHaveLength(1);

    // Les deux formes ADMISES restent admises.
    expect(
      unscopedCallSites(
        `await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });`,
      ),
    ).toEqual([]);
    expect(
      unscopedCallSites(`await this.prisma.prospect.findMany({ where: { id: { in: ids } } });`),
    ).toEqual([]);
  });

  /**
   * LA LISTE DES MODÈLES SUIT LE SCHÉMA, ET NON L'INVERSE.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * LE DÉFAUT QUE CE TEST AURAIT ÉVITÉ
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `DEMO_MODELS` est resté à DOUZE entrées pendant que le schéma en portait
   * QUINZE. `Notification`, `NotificationTemplate` et `NotificationDelivery`
   * portaient la colonne et n'étaient balayés par rien : leurs services
   * créaient sans la renseigner et lisaient sans cloisonner, en toute
   * conformité avec un test qui ne les regardait pas.
   *
   * Aucun test comparant les deux listes du fichier à elles-mêmes n'aurait pu
   * échouer là-dessus : elles sont écrites au même endroit, par la même
   * personne, dans le même geste. La référence doit être `schema.prisma`, comme
   * pour le plan de purge.
   */
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

/** Un modèle porteur d'`isDemo` : son délégué Prisma et sa table. */
interface DemoCarrier {
  readonly delegate: string;
  readonly table: string;
}

/**
 * Les modèles du schéma qui portent une colonne `isDemo`.
 *
 * Le nom du DÉLÉGUÉ Prisma est le nom du modèle à l'initiale minuscule, la
 * convention du client généré ; le nom de la TABLE vient du `@@map`, faute de
 * quoi Prisma retient le nom du modèle tel quel.
 */
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
