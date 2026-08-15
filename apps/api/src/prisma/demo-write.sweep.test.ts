import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * L'INVARIANT DE RÉCUPÉRABILITÉ, épinglé site par site.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QU'ON CHERCHE À GARANTIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une ligne `isDemo: true` est invisible dès que le mode est éteint. Elle n'est
 * donc récupérable que par la PURGE, qui supprime exactement les identifiants
 * inscrits dans `demo_entities` par l'ensemenceur, plus ce qui en dépend par
 * cascade. Une ligne `isDemo: true` créée ailleurs que par l'ensemenceur, et
 * qui ne pend à aucune ligne ensemencée, est perdue pour toujours : ni lisible,
 * ni exportable, ni supprimable, ni comptée.
 *
 * `DemoReadOnlyGuard` ferme la voie principale : tant que le mode est allumé,
 * aucune écriture interactive n'aboutit, donc aucun `isDemo: demoEnabled` de
 * service métier ne peut valoir `true`. Encore faut-il que cela reste vrai
 * quand un service sera ajouté dans six mois, par quelqu'un qui n'aura lu ni
 * la garde ni ce fichier.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN BALAYAGE DE SOURCE, ET PAS UN TEST DE COMPORTEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un test de comportement vérifie les chemins qu'on a pensé à écrire. Or
 * l'énoncé porte sur l'ABSENCE de chemin : « aucun code hors ensemenceur ne
 * produit de ligne fictive ». On ne démontre pas une absence en appelant des
 * méthodes une par une.
 *
 * Ce balayage-ci relève TOUTES les expressions posées sur `isDemo` dans le
 * code de l'API, et les compare à une classification écrite à la main. Un site
 * ajouté, retiré ou reformulé fait rougir la suite, et oblige son auteur à
 * dire à quelle catégorie il appartient. C'est le seul dispositif qui parle
 * des fichiers qui n'existent pas encore.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES RÉSIDUS SONT NOMMÉS, PAS MASQUÉS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'invariant N'EST PAS entier, et ce fichier le dit plutôt que de l'arrondir.
 * UN chemin peut encore produire une ligne fictive hors ensemenceur ; il porte
 * le verdict `RESIDU`, avec sa portée exacte. Le recenser à l'endroit du
 * contrôle vaut mieux qu'un test vert qui laisserait croire le problème clos.
 *
 * Ils étaient deux. Le second, le balayage des rappels, était le pire des deux
 * parce qu'il était NON RÉCUPÉRABLE : une tâche planifiée échappe à la garde,
 * et une `Notification` ne figure ni dans `demo_entities` ni dans une cascade.
 * Il a été fermé en retirant l'interrupteur de la question plutôt qu'en
 * l'étendant à l'ordonnanceur : les rappels comptent du réel et écrivent
 * `isDemo: false` en toutes lettres, mode allumé comme éteint. Voir le verdict
 * `REEL` et l'en-tête de `reminders.service.ts`.
 */

const SRC = new URL('..', import.meta.url).pathname;

/**
 * Ce que devient une ligne portée par l'expression relevée.
 *
 * `LECTURE` couvre aussi bien un `select`, un `where` qu'une déclaration de
 * type : ces sites-là ne créent aucune ligne, mais ils s'écrivent avec la même
 * syntaxe et le balayage ne peut pas les distinguer. Les classer explicitement
 * vaut mieux que de les filtrer par une heuristique qui se tromperait un jour
 * dans l'autre sens.
 */
type Verdict =
  /** L'ensemenceur. Chaque ligne est inscrite dans `demo_entities`. */
  | 'SEMEUR'
  /**
   * Route mutante, donc refusée tant que le mode est allumé. Vaut toujours
   * `false`.
   *
   * DEUX VERROUS, ET IL EN FALLAIT DEUX. `DemoReadOnlyGuard` ferme la route,
   * mais il ne juge QUE des requêtes HTTP non dispensées : un appel interne, ou
   * une route dispensée ajoutée demain, passerait à côté. Ces sites lisent donc
   * `enabledForWrite()`, qui REFUSE quand l'état du mode est inconnu, au lieu
   * d'`enabled()`, qui rendait `false` sur panne de lecture, c'est-à-dire
   * « cette ligne est réelle » écrit à l'aveugle pendant une démonstration.
   */
  | 'BLOQUE'
  /**
   * Écrit `false` EN TOUTES LETTRES, sans consulter l'interrupteur.
   *
   * Plus fort qu'un `BLOQUE`, qui repose sur une garde enregistrée ailleurs :
   * ici la valeur est dans le littéral. Réservé aux chemins qui produisent du
   * travail RÉEL hors de toute requête HTTP, donc hors de portée de la garde.
   */
  | 'REEL'
  /** Recopie la nature d'une ligne parente déjà écrite. Ne l'invente pas. */
  | 'HERITE'
  /**
   * Écrit une ligne fictive HORS ensemenceur, et l'INSCRIT au registre.
   *
   * C'est la seule façon d'écrire `isDemo: true` ailleurs que dans
   * `demo-seeder.ts` sans créer d'irrécupérable : la ligne figure dans
   * `demo_entities`, donc la purge la reprend, et elle ne retient plus les
   * lignes semées par `onDelete: Restrict`.
   */
  | 'REGISTRE'
  /** Lecture, filtre ou déclaration de type. N'écrit rien. */
  | 'LECTURE'
  /** Peut encore produire une ligne fictive. Portée décrite dans `note`. */
  | 'RESIDU';

interface Site {
  verdict: Verdict;
  note: string;
}

/**
 * LA CLASSIFICATION, fichier par fichier et expression par expression.
 *
 * La clé est `fichier → expression`. L'expression, et pas la ligne : un
 * numéro de ligne bouge au premier commentaire ajouté, et le contrôle
 * deviendrait un bruit qu'on finirait par mettre à jour sans le lire.
 */
const SITES: Record<string, Site> = {
  // ── L'ensemenceur ────────────────────────────────────────────────────────
  'modules/demo/demo-seeder.ts → true': {
    verdict: 'SEMEUR',
    note: 'chaque ligne créée ici est inscrite dans demo_entities par DemoRegistry, dans la MÊME transaction',
  },

  // ── Routes mutantes, fermées tant que le mode est allumé ─────────────────
  'modules/users/users.service.ts → await this.demo.enabledForWrite()': {
    verdict: 'BLOQUE',
    note: 'POST /v1/users, refusé en 409 pendant une démonstration',
  },
  'modules/representants/representants.service.ts → await this.demo.enabledForWrite()': {
    verdict: 'BLOQUE',
    note: 'POST /v1/representants, refusé en 409 pendant une démonstration',
  },
  'modules/notifications/templates.service.ts → await this.demo.enabledForWrite()': {
    verdict: 'BLOQUE',
    note: 'POST /v1/notification-templates, refusé en 409 ; seul /render est dispensé et n’écrit rien',
  },
  'modules/notifications/notifications.service.ts → isDemo (abrégé)': {
    verdict: 'BLOQUE',
    note:
      'POST /v1/notifications, refusé en 409 pendant une démonstration. Deux sites en forme ABRÉGÉE, ' +
      'la notification et ses livraisons, qui portent la même valeur : une livraison visible accrochée ' +
      'à une notification masquée afficherait une ligne vide dans la boîte de réception',
  },
  'modules/phase2/campaigns.service.ts → demoEnabled': {
    verdict: 'BLOQUE',
    note: 'POST /v1/phase2/campaigns, refusé en 409 pendant une démonstration',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → demoEnabled': {
    verdict: 'BLOQUE',
    note: 'POST /v1/rep-campaigns, refusé en 409 ; la valeur vient d’enabledForWrite, elle ne peut donc pas être devinée sur panne de lecture',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → demoPopulation': {
    verdict: 'LECTURE',
    note:
      'filtre de POPULATION d’eligibleWhere, pas une création. Le paramètre s’appelait demoEnabled comme la ' +
      'variable d’écriture deux cents lignes plus haut, ce qui rendait les deux usages indiscernables pour un ' +
      'lecteur comme pour le contrôle « aucune valeur écrite ne se décide sur enabled() »',
  },
  'modules/client-requests/client-requests.service.ts → demoEnabled': {
    verdict: 'BLOQUE',
    note: 'POST /v1/client-requests, refusé en 409 pendant une démonstration',
  },
  'modules/prospects/prospects.service.ts → (await this.demo.enabledForWrite()) || representant.isDemo':
    {
      verdict: 'BLOQUE',
      note: 'POST /v1/prospects, refusé en 409 ; le terme de gauche ne peut donc jamais valoir true, et celui de droite hérite du représentant',
    },

  // ── Héritage d'une ligne parente ─────────────────────────────────────────
  'modules/phase2/phase2-sync.service.ts → prospect.isDemo': {
    verdict: 'RESIDU',
    note:
      'SEUL chemin d’écriture atteignable pendant une démonstration, via le push de synchronisation, qui est dispensé. ' +
      'L’annuaire de phase 2 n’est PAS cloisonné par commercial (choix assumé, un commercial doit pouvoir compléter n’importe quel numéro) : ' +
      'mode allumé, un commercial réel peut donc télécharger un prospect fictif et déposer une tentative dessus, qui naîtra isDemo: true ' +
      'sans figurer dans demo_entities. Elle reste RÉCUPÉRABLE, CallAttempt.prospect est en onDelete: Cascade et la purge supprime le prospect fictif. ' +
      'C’est ce qui distingue ce résidu du suivant.',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → representant.isDemo': {
    verdict: 'HERITE',
    note: 'POST /v1/rep-campaigns/attempts, refusé en 409 ; et mode éteint, demoScope écarte les fiches fictives, la fiche lue est donc réelle',
  },
  'modules/bank-cases/bank-cases.service.ts → prospect.isDemo': {
    verdict: 'HERITE',
    note: 'POST /v1/bank-cases, refusé en 409 ; le dossier suit le prospect qu’il instruit',
  },
  'modules/bank-cases/bank-cases.service.ts → existing.isDemo': {
    verdict: 'HERITE',
    note: 'transition d’étape, refusée en 409 ; la transition suit son dossier',
  },
  'modules/client-requests/client-requests.service.ts → request.isDemo': {
    verdict: 'HERITE',
    note: 'approbation d’une demande, refusée en 409 ; le prospect créé suit la demande',
  },

  // ── Écriture réelle assumée, hors de portée de la garde ──────────────────
  'modules/notifications/reminders.service.ts → false': {
    verdict: 'REEL',
    note:
      'TÂCHE PLANIFIÉE, donc HORS de la garde, qui ne juge que des requêtes HTTP. Le balayage des rappels ne consulte plus l’interrupteur : ' +
      'il compte sous demoScope(false) et écrit isDemo: false sur la notification comme sur ses livraisons, mode allumé comme éteint. ' +
      'Deux raisons, et la seconde est la vraie : une relance porte du TRAVAIL DÛ À UNE VRAIE PERSONNE, l’écrire fictive la ferait disparaître ' +
      'de sa boîte à l’extinction sans que la purge sache la reprendre (ni Notification ni NotificationDelivery ne figurent dans ' +
      'DEMO_ENTITY_TYPES) ; et la clé d’idempotence (reminderKey, period) ne porte pas isDemo, si bien qu’une relance fictive occuperait la ' +
      'place du vrai rappel du jour. Écrire toujours false rend ce site incapable de produire une ligne fictive.',
  },

  // ── Lectures, filtres, déclarations de type ──────────────────────────────
  'common/guards/fresh-session.guard.ts → true': {
    verdict: 'LECTURE',
    note:
      'clause `select` de la relecture d’autorité sur les routes à rôle : la garde LIT isDemo pour ' +
      'refuser une session de démonstration survivant à l’extinction du mode, et n’écrit rien. ' +
      'C’est le pendant, pour les jetons DÉJÀ émis, du refus d’émission d’AuthService',
  },
  'prisma/demo-visibility.ts → false': {
    verdict: 'LECTURE',
    note: 'le fragment `where` lui-même, celui que tout le reste compose',
  },

  // ── SQL brut : quatre sites, tous des CONDITIONS de lecture ──────────────
  'prisma/demo-visibility.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'demoScopeSql, le fragment `"isDemo" = FALSE` que les agrégats en SQL brut composent dans leur WHERE',
  },
  'modules/analytics/analytics.sql.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'conditions de cloisonnement des agrégats de prospection ; aucune de ces requêtes n’écrit',
  },
  'modules/analytics/pilotage.sql.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'conditions de cloisonnement des agrégats de pilotage',
  },
  'modules/bank-cases/bank-cases.sql.ts → isDemo (SQL brut)': {
    verdict: 'LECTURE',
    note: 'conditions de cloisonnement des agrégats de dossiers bancaires',
  },
  'modules/prospects/prospects.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection : `select: { isDemo: true }` RAPPORTE la colonne, il ne l’écrit pas',
  },
  'modules/prospects/prospects.service.ts → boolean': {
    verdict: 'LECTURE',
    note: 'déclaration de type du retour',
  },
  'modules/phase2/phase2-sync.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection dans PROSPECT_STATE_SELECT',
  },
  'modules/phase2/phase2-sync.service.ts → boolean;': {
    verdict: 'LECTURE',
    note: 'déclaration de type de ProspectState',
  },
  'modules/rep-campaigns/rep-campaigns.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection sur la fiche appelée, lue pour l’écriture de la tentative',
  },
  'modules/bank-cases/bank-cases.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projection sur le prospect instruit',
  },
  // ── Remontée hors ligne : dispensée de la garde, donc classée à part ─────
  'modules/sync/sync.service.ts → authorIsDemo': {
    verdict: 'REGISTRE',
    note:
      'création d’un représentant par la synchronisation, DISPENSÉE de la garde. La fiche suit la nature de son ' +
      'AUTEUR : l’animateur d’une démonstration saisit sur le téléphone avec un compte de démonstration, et la ' +
      'colonne prenait auparavant son défaut false, ce qui faisait entrer la fiche fictive dans l’annuaire réel. ' +
      'Inscrite au registre par recordDemoEntity, dans la transaction du groupe',
  },
  'modules/sync/sync.service.ts → authorIsDemo || parent.isDemo': {
    verdict: 'REGISTRE',
    note:
      'création d’un prospect par la synchronisation. MÊME COMPOSITION que prospects.service.ts, auteur ET ' +
      'représentant de rattachement : l’annuaire de phase 2 n’est pas cloisonné par commercial, aucune des deux ' +
      'sources ne suffit seule. Inscrite au registre',
  },
  'modules/sync/sync.service.ts → representant.isDemo': {
    verdict: 'LECTURE',
    note: 'valeur RENDUE par assertRepresentantUsable à son appelant, qui décide ; aucune écriture ici',
  },
  'modules/sync/sync.service.ts → true': {
    verdict: 'LECTURE',
    note: 'projections : select isDemo sur l’auteur et sur le représentant de rattachement',
  },
  'modules/sync/sync.service.ts → boolean': {
    verdict: 'LECTURE',
    note: 'déclarations de type d’isDemoAuthor et du retour d’assertRepresentantUsable',
  },
  'modules/auth/auth.service.ts → boolean': {
    verdict: 'LECTURE',
    note:
      'déclaration de type du paramètre d’assertDemoSessionAllowed : la connexion LIT le drapeau ' +
      'pour refuser une session de démonstration hors démonstration, elle n’écrit rien',
  },
};

/**
 * Doubles d'essai, écartés du balayage.
 *
 * Ils imitent Prisma en mémoire et ne touchent aucune base : classer leurs
 * `isDemo` reviendrait à documenter la fidélité d'un mock, pas la sûreté d'une
 * écriture. Le préfixe est un motif de nom, pas une liste : un double ajouté
 * demain sort du balayage sans qu'on ait à y penser.
 */
const isTestDouble = (relative: string): boolean =>
  relative.split('/').some((segment) => segment.startsWith('fake-'));

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
    }),
  );
  return files.flat();
}

/**
 * Le CODE seul : commentaires ET littéraux de chaîne retirés.
 *
 * Les commentaires d'abord, pour la raison qui vaut dans
 * `demo-visibility.sweep.test.ts` : une phrase citant `isDemo: demoEnabled`
 * pour expliquer un défaut corrigé entrerait sinon dans le relevé, et le
 * contrôle dépendrait de la prose autant que du code.
 *
 * Les chaînes ENSUITE, et ce n'est pas une précaution théorique : la
 * description OpenAPI de `DemoStatusDto` explique en toutes lettres que les
 * lignes remontées par la synchronisation sont écrites `isDemo: false`. Cette
 * phrase est destinée à un opérateur, elle n'écrit rien, et la compter comme
 * un site d'écriture obligerait à classer de la documentation.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const codeOnly = (source: string): string =>
  withoutComments(source)
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

/**
 * Tous les sites posant `isDemo` dans le code de l'API, dédoublonnés.
 *
 * DEUX FORMES, ET LA SECONDE A DÉJÀ ÉCHAPPÉ AU BALAYAGE.
 *
 * La forme longue `isDemo: <expression>` est celle qu'on écrit presque
 * toujours. Mais JavaScript admet la forme abrégée, `{ isDemo }`, quand la
 * variable porte déjà le nom du champ, et deux sites de `notifications.service`
 * l'utilisaient : ils n'apparaissaient donc dans AUCUN verdict, alors que le
 * fichier affirme en tête classer chaque site. Un balayage qui se croit
 * exhaustif et ne l'est pas est pire qu'un balayage absent, parce qu'on cesse
 * de chercher à la main.
 *
 * La forme abrégée est rendue `isDemo (abrégé)` : la valeur est le nom de la
 * variable, donc l'expression n'apprendrait rien, et c'est le classement écrit
 * à la main qui porte le sens.
 */
/**
 * Les EXPRESSIONS posant `isDemo` dans UNE source, sans le nom du fichier.
 *
 * Isolée de la marche sur le disque pour une raison précise : les formes
 * relevées se testent alors sur des extraits écrits à la main, et les LIMITES
 * du relevé deviennent elles aussi des assertions au lieu d'un commentaire
 * qu'on croit sur parole. Voir le test « ce que le relevé voit, et ce qu'il ne
 * voit pas ».
 */
function sitesIn(source: string): string[] {
  const found: string[] = [];

  // DEUX LECTURES DE LA MÊME SOURCE, et il en faut deux.
  //
  // `code` a perdu ses chaînes : c'est ce qu'il faut pour la forme longue,
  // dont une citation en prose fausserait le relevé. Mais deux des formes
  // ci-dessous VIVENT dans une chaîne, la clé calculée `['isDemo']` et
  // l'identifiant SQL `"isDemo"` : les chercher dans `code` revenait à les
  // chercher là où on venait de les effacer, et c'est exactement pourquoi
  // elles échappaient au balayage.
  const text = withoutComments(source);
  const code = codeOnly(source);

  for (const match of code.matchAll(/\bisDemo:\s*([^,\n}]+)/g)) {
    found.push((match[1] ?? '').trim());
  }

  // Clé CALCULÉE littérale : `{ ['isDemo']: true }`. JavaScript l'accepte,
  // elle écrit la même colonne que la forme longue, et aucun verdict ne la
  // couvrait.
  if (/\[\s*['"`]isDemo['"`]\s*\]\s*:/.test(text)) found.push('isDemo (clé calculée)');

  // SQL BRUT. PostgreSQL cite les identifiants en guillemets doubles, ce que
  // TypeScript n'écrit presque jamais autrement : `"isDemo"` dans une source
  // désigne donc la colonne, et un `UPDATE ... SET "isDemo" = TRUE` serait
  // sinon parfaitement invisible. Le relevé ne distingue PAS la lecture de
  // l'écriture, c'est la classification à la main qui tranche.
  if (/"isDemo"/.test(text)) found.push('isDemo (SQL brut)');

  // Forme abrégée : `isDemo` suivi d'une virgule ou d'une accolade fermante.
  //
  // Le refus du point qui précède est ESSENTIEL, et ma première version l'a
  // oublié : sans lui, `isDemo: prospect.isDemo,` déclenche DEUX fois, la
  // seconde sur la queue de l'accès à la propriété. Six fichiers remontaient
  // alors comme portant une forme abrégée qu'ils n'écrivent pas. Un balayage
  // qui crie au loup se fait désarmer aussi sûrement qu'un balayage aveugle.
  if (/(?<![.\w])isDemo\s*(?=[,}])/.test(code)) found.push('isDemo (abrégé)');

  return found;
}

async function sweep(): Promise<string[]> {
  const files = (await walk(SRC)).sort();
  const sites = new Set<string>();

  for (const file of files) {
    const relative = file.slice(SRC.length).replace(/^\/+/, '');
    if (isTestDouble(relative)) continue;

    for (const site of sitesIn(await readFile(file, 'utf8'))) {
      sites.add(`${relative} → ${site}`);
    }
  }

  return [...sites].sort();
}

describe('écritures d’isDemo, balayage', () => {
  it('tout site posant isDemo est CLASSÉ', async () => {
    const sites = await sweep();
    const inconnus = sites.filter((site) => !(site in SITES));

    expect(
      inconnus,
      'Ces sites posent `isDemo` sans être classés. Un `isDemo` qui peut valoir ' +
        '`true` hors ensemenceur crée une ligne que la purge ne sait pas reprendre : ' +
        'elle devient invisible, inexportable et indestructible. Classez chaque site ' +
        'dans SITES, avec la raison pour laquelle il ne peut pas produire ça.',
    ).toEqual([]);
  });

  it('et aucune classification ne survit au site qu’elle décrivait', async () => {
    const sites = new Set(await sweep());
    const orphelines = Object.keys(SITES).filter((site) => !sites.has(site));

    // Une entrée qui ne correspond plus à rien est une dispense en attente de
    // reprendre du service : elle blanchirait le jour où quelqu'un réécrirait
    // par hasard la même expression, sans que personne relise sa justification.
    expect(orphelines).toEqual([]);
  });

  /**
   * LA RÉPONSE HONNÊTE À « L'INVARIANT TIENT-IL ? ».
   *
   * Il tient POUR L'ESSENTIEL : hors ensemenceur, plus aucun service métier ne
   * peut écrire une ligne fictive, parce que sa route est refusée avant de
   * l'atteindre. UN chemin reste, et ce test le nomme plutôt que de laisser une
   * suite verte affirmer le contraire.
   *
   * Ils étaient deux. Le rappel programmé a quitté cette liste : il n'écrit plus
   * `isDemo: demoEnabled` mais `isDemo: false` en toutes lettres, et ce test a
   * rougi ce jour-là, ce qui est exactement son office.
   *
   * Le jour où le dernier sera fermé, ce test rougira encore, et ce sera le bon
   * moment pour le retirer d'ici.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * « EXACTEMENT » NE VAUT QUE POUR CE QUE LE RELEVÉ VOIT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Ce test dit « le résidu connu est exactement celui-là ». Lu vite, cela
   * s'entend « il n'y en a pas d'autre » ; ce serait faux. Il ne parle QUE des
   * sites qui NOMMENT la colonne. Une écriture qui ne la nomme pas n'a jamais
   * de verdict, et ne peut donc pas être un résidu ici, quelle que soit la
   * ligne qu'elle produit.
   *
   * Ce n'est pas une précaution théorique : `sync.service.ts` créait des
   * représentants et des prospects sans jamais écrire `isDemo`, sur le seul
   * chemin DISPENSÉ de la garde de lecture seule. Ce test était vert pendant
   * tout ce temps. Voir « et ce qu'il NE VOIT PAS ».
   */
  it('le résidu connu est EXACTEMENT celui-là', () => {
    const residus = Object.entries(SITES)
      .filter(([, site]) => site.verdict === 'RESIDU')
      .map(([site]) => site)
      .sort();

    expect(residus).toEqual([
      // Récupérable : la tentative pend au prospect ensemencé par une cascade,
      // et la purge supprime ce prospect.
      'modules/phase2/phase2-sync.service.ts → prospect.isDemo',
    ]);
  });

  /**
   * CE QUE CE BALAYAGE NE VOIT PAS, ÉPINGLÉ PLUTÔT QUE TU.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * POURQUOI CE TEST EXISTE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Un balayage réputé exhaustif qui ne l'est pas est PIRE qu'un balayage
   * absent : on cesse de vérifier à la main. Ce fichier affirme en tête classer
   * « chaque site », et cette affirmation a déjà été fausse trois fois. Elle
   * l'est encore, pour ce qui suit, et mieux vaut le nommer ici.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * 1. LA CLÉ CALCULÉE DYNAMIQUE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `data: { [champ]: true }` où `champ` vaut `'isDemo'` à l'exécution. Aucun
   * relevé de jetons ne peut le savoir : il faudrait évaluer le programme. La
   * forme LITTÉRALE, `{ ['isDemo']: true }`, est désormais relevée, ce qui
   * couvre le cas qu'on écrit par accident ; la forme dynamique reste ouverte,
   * et il faudrait un contrôle de typage pour la fermer.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * 2. L'ÉCRITURE QUI NE NOMME JAMAIS LA COLONNE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * C'est la limite la plus grave, parce qu'elle est SILENCIEUSE et qu'elle a
   * déjà coûté. Une création qui OMET `isDemo` laisse la colonne prendre son
   * défaut de schéma, `false`. Ce n'est pas une absence de décision, c'est la
   * décision « cette ligne est réelle », prise sans que rien ne l'écrive.
   *
   * `sync.service.ts` a vécu ainsi : ses `upsert` de représentant et de
   * prospect ne mentionnaient pas la colonne, et le chemin de synchronisation
   * étant DISPENSÉ de la garde de lecture seule, un compte de démonstration y
   * créait des lignes RÉELLES. Ce fichier n'a rien vu, et ne pouvait rien voir :
   * il n'y avait aucun jeton à relever. Le défaut a été trouvé à la relecture.
   *
   * D'où la règle que ce test ne peut pas vérifier, et qu'il faut donc lire :
   * TOUTE création d'une table porteuse d'`isDemo` doit poser la colonne
   * EXPLICITEMENT, même pour y écrire `false`. Le silence n'est pas neutre.
   */
  /**
   * AUCUNE VALEUR ÉCRITE NE SE DÉCIDE SUR `enabled()`.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * LE DÉFAUT, ET POURQUOI IL SE REFERMERAIT TOUT SEUL SANS CE TEST
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `enabled()` rend `false` quand la lecture du réglage ÉCHOUE. Pour une
   * visibilité, c'est le bon repli : dans le doute on masque. Composé dans un
   * `isDemo:`, le même `false` veut dire « cette ligne est RÉELLE », et une
   * panne de lecture d'une seconde pendant une démonstration écrivait la fiche
   * saisie devant l'auditoire en ligne réelle, que la purge ne sait pas
   * reprendre.
   *
   * Les deux usages s'écrivent EXACTEMENT PAREIL. C'est pourquoi un contrôle
   * humain ne tient pas : huit sites étaient concernés, et l'un d'eux avait déjà
   * été déclaré « visibilité » à tort lors d'une relecture précédente. Seul un
   * balayage peut affirmer qu'il n'en reste aucun, et le dire encore dans six
   * mois.
   *
   * Ce test remplace huit tests de comportement identiques, et il couvre en
   * plus les sites qui n'existent pas encore.
   */
  it('AUCUNE valeur écrite dans isDemo ne se décide sur `enabled()`', async () => {
    const coupables: string[] = [];
    const files = (await walk(SRC)).sort();

    for (const file of files) {
      const relative = file.slice(SRC.length).replace(/^\/+/, '');
      if (isTestDouble(relative)) continue;

      const code = codeOnly(await readFile(file, 'utf8'));
      for (const match of code.matchAll(/\bisDemo:\s*([^,\n}]+)/g)) {
        const expression = (match[1] ?? '').trim();

        // Forme DIRECTE : `isDemo: await this.demo.enabled()`.
        if (expression.includes('this.demo.enabled()')) {
          coupables.push(`${relative} → ${expression}`);
          continue;
        }

        // Forme INDIRECTE, la plus fréquente : une variable locale porte le
        // booléen, et sert à la fois au `where` de visibilité et au `isDemo`.
        // C'est celle qui échappe à la lecture rapide.
        if (!/^[A-Za-z_$][\w$]*$/.test(expression)) continue;

        // LA DÉCLARATION LA PLUS PROCHE EN AMONT, et non « une déclaration
        // quelconque du fichier ». Le même nom, `demoEnabled`, sert dans
        // plusieurs méthodes du même service, les unes écrivant et les autres
        // ne faisant que cloisonner une lecture. Chercher dans tout le fichier
        // accusait ces dernières, et un contrôle qui crie au loup se fait
        // désarmer aussi sûrement qu'un contrôle aveugle.
        const before = code.slice(0, match.index);
        const declarations = [
          ...before.matchAll(
            new RegExp(
              String.raw`(?:const|let)\s+${expression}\s*=\s*await\s+this\.demo\.(enabled|enabledForWrite)\(\)`,
              'g',
            ),
          ),
        ];
        if (declarations.at(-1)?.[1] === 'enabled') {
          coupables.push(`${relative} → ${expression} (indirect)`);
        }
      }
    }

    expect(
      coupables,
      'Ces sites ÉCRIVENT une valeur décidée par `enabled()`, qui rend `false` quand la ' +
        'lecture du réglage échoue : la ligne serait enregistrée comme RÉELLE alors que ' +
        'personne ne sait si elle l’est. Utilisez `enabledForWrite()`, qui refuse dans le ' +
        'doute. `enabled()` reste le bon appel pour une décision de VISIBILITÉ.',
    ).toEqual([]);
  });

  it('ce que le relevé VOIT', () => {
    // Les quatre formes couvertes. Chacune écrit la même colonne, et les trois
    // dernières ont réellement échappé au balayage à un moment ou à un autre.
    expect(sitesIn('data: { isDemo: true }')).toEqual(['true']);
    expect(sitesIn('data: { isDemo }')).toEqual(['isDemo (abrégé)']);
    expect(sitesIn("data: { ['isDemo']: true }")).toEqual(['isDemo (clé calculée)']);
    expect(sitesIn('await tx.$executeRaw`UPDATE p SET "isDemo" = TRUE`')).toEqual([
      'isDemo (SQL brut)',
    ]);
  });

  it('et ce qu’il NE VOIT PAS, ce qui est la moitié qui compte', () => {
    // LIMITE 1 : LA CLÉ CALCULÉE DYNAMIQUE. Il faudrait évaluer le programme
    // pour savoir que `champ` vaut 'isDemo'. La forme LITTÉRALE est couverte
    // ci-dessus, ce qui ferme le cas qu'on écrit par accident ; celui-ci reste
    // ouvert et demanderait un contrôle de typage.
    expect(sitesIn('const champ = "isDemo"; data = { [champ]: true };')).not.toContain(
      'isDemo (clé calculée)',
    );

    // LIMITE 2, LA PLUS GRAVE, parce qu'elle est SILENCIEUSE et qu'elle a déjà
    // coûté. Une création qui OMET la colonne la laisse prendre son défaut de
    // schéma, `false`. Ce n'est pas une absence de décision, c'est la décision
    // « cette ligne est réelle », prise sans que rien ne l'écrive.
    //
    // `sync.service.ts` a vécu ainsi : ses upserts de représentant et de
    // prospect ne nommaient pas la colonne, et le chemin de synchronisation
    // étant DISPENSÉ de la garde de lecture seule, un compte de démonstration
    // y créait des lignes RÉELLES, que la purge ne pouvait plus reprendre. Ce
    // fichier n'a rien vu et ne POUVAIT rien voir : aucun jeton à relever. Le
    // défaut a été trouvé à la relecture.
    //
    // D'où la règle que ce balayage ne saura jamais vérifier, et qu'il faut
    // donc lire : TOUTE création dans une table porteuse d'`isDemo` doit poser
    // la colonne EXPLICITEMENT, même pour y écrire `false`.
    expect(sitesIn('tx.prospect.create({ data: { nom, phoneE164 } })')).toEqual([]);

    // LIMITE 3 : le SQL brut est relevé, mais son SENS ne l'est pas. Un WHERE
    // et un SET produisent le même jeton, et seule la classification à la main
    // les sépare.
    expect(sitesIn('WHERE "isDemo" = FALSE')).toEqual(sitesIn('SET "isDemo" = TRUE'));
  });

  /**
   * LE COROLLAIRE QUI REND TOUT LE RESTE VRAI.
   *
   * Un site classé `BLOQUE` ne tient sa promesse que si la garde est bien
   * globale. Si le fournisseur disparaissait d'`app.module.ts`, les onze
   * `BLOQUE` ci-dessus deviendraient onze fuites d'un coup, et ce fichier
   * continuerait de dire le contraire.
   */
  it('le verdict BLOQUE repose sur une garde réellement enregistrée', async () => {
    const source = await readFile(new URL('../app.module.ts', import.meta.url).pathname, 'utf8');
    expect(source).toContain('{ provide: APP_GUARD, useClass: DemoReadOnlyGuard }');
  });
});
