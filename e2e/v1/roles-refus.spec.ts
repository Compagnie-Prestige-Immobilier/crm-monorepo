import { expect, test, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * ROL-17 à ROL-22 : balayage des URL, un scénario par rôle.
 *
 * Le masquage d'une entrée de menu ne protège rien : une URL se tape, et un
 * onglet resté ouvert rejoue la route. La table ci-dessous est le relevé
 * exhaustif des `guardRoles([...])` de chaque `page.tsx` — et du `layout.tsx`
 * de l'espace Accueil, qui garde `/accueil` et ses trois onglets d'un bloc.
 *
 * Chaque cellule interdite se prouve DANS LES DEUX SENS (E2E.md §6.5) :
 *
 * 1. le refus est LISIBLE — titre « Accès refusé » de niveau 2, l'alerte nomme
 *    le rôle en cours, et le lien de sortie pointe le hub ;
 * 2. AUCUNE donnée métier n'a été chargée, prouvé par le réseau.
 *
 * Le second point distingue « l'écran affiche un refus » de « l'écran a chargé
 * les données puis affiché un refus par-dessus ». Les identifiants passés aux
 * routes de détail sont RÉELS, précisément pour cela : une garde retirée
 * ferait aboutir la requête, et la liste des familles chargées ne serait plus
 * vide.
 *
 * Réserve connue : la plupart des écrans préchargent leurs données CÔTÉ
 * SERVEUR (`getServerApiClient`, `prefetchQuery`), hors de portée du réseau du
 * navigateur. La preuve réseau ne mord donc que sur les écrans qui
 * interrogent l'API depuis le navigateur — dossiers bancaires, chiffres,
 * référentiels d'écran. Elle est écrite partout : c'est le seul endroit où le
 * jour où un écran passera au chargement client, la régression sera vue.
 */

type Role = 'ADMIN' | 'DIRECTION' | 'SUPERVISEUR' | 'COMMERCIAL' | 'ACCUEIL' | 'BANQUE_FINANCE';

const TOUS: readonly Role[] = [
  'ADMIN',
  'DIRECTION',
  'SUPERVISEUR',
  'COMMERCIAL',
  'ACCUEIL',
  'BANQUE_FINANCE',
];

/** `ROLE_LABELS` de `apps/web/src/lib/types.ts`, tel que le refus l'écrit. */
const LIBELLE_DU_ROLE: Record<Role, string> = {
  ADMIN: 'Administrateur',
  DIRECTION: 'Direction',
  SUPERVISEUR: 'Supervision',
  COMMERCIAL: 'Téléconseiller',
  ACCUEIL: 'Accueil',
  BANQUE_FINANCE: 'Banque & Finance',
};

const SESSIONS: Record<Role, string> = {
  ADMIN: 'v1/.auth/admin.json',
  DIRECTION: 'v1/.auth/direction.json',
  SUPERVISEUR: 'v1/.auth/superviseur.json',
  COMMERCIAL: 'v1/.auth/commercial.json',
  ACCUEIL: 'v1/.auth/accueil.json',
  BANQUE_FINANCE: 'v1/.auth/banque.json',
};

interface Ecran {
  /** `{dossier}`, `{representant}` et `{prospect}` sont remplacés à l'exécution. */
  route: string;
  /** Le titre du document, posé par `export const metadata` de la page. */
  titre: string;
  /** Les familles d'appels API que CET écran émet quand il est autorisé. */
  familles: readonly string[];
  autorises: readonly Role[];
  /** Rôles RENVOYÉS ailleurs : ni écran, ni refus. Voir `roles-renvois.spec.ts`. */
  renvoyes?: readonly Role[];
  /** Hors balayage des refus : la route renvoie tout le monde (ROL-26). */
  sansRefus?: boolean;
}

const VISITES = ['/api/v1/visites'];
const PROSPECTS = ['/api/v1/prospects'];
const REPRESENTANTS = ['/api/v1/representants'];
const DOSSIERS = ['/api/v1/bank-cases', '/api/v1/bank-case-stages'];
const RAPPELS = ['/api/v1/phase2/callbacks'];
const CHIFFRES = ['/api/v1/analytics', '/api/v1/supervision', '/api/v1/tableaux-de-bord'];

const ECRANS: readonly Ecran[] = [
  // ─── Espace Accueil ─────────────────────────────────────────────────────
  {
    route: '/accueil',
    titre: 'Registre des visites · Accueil · CPI GO',
    familles: VISITES,
    autorises: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
    // Le refus de `/accueil` appartient à ROL-28 (`roles-trous.spec.ts`).
    sansRefus: true,
  },
  {
    route: '/accueil/tableau-de-bord',
    titre: 'Tableau de bord des visites · CPI GO',
    familles: VISITES,
    autorises: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
  },
  {
    route: '/accueil/listes',
    titre: 'Listes du registre des visites · CPI GO',
    familles: VISITES,
    autorises: ['ADMIN', 'DIRECTION'],
  },
  {
    route: '/accueil/import',
    titre: 'Import du registre des visites · CPI GO',
    familles: VISITES,
    autorises: ['ADMIN', 'DIRECTION'],
  },

  // ─── Espace Admin ───────────────────────────────────────────────────────
  {
    route: '/admin',
    titre: 'Téléconseillers · CPI GO',
    familles: ['/api/v1/users'],
    autorises: ['ADMIN'],
    renvoyes: ['DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'ACCUEIL', 'BANQUE_FINANCE'],
  },
  {
    route: '/admin/commerciaux',
    titre: 'Téléconseillers · CPI GO',
    familles: ['/api/v1/users'],
    autorises: ['ADMIN'],
  },
  {
    route: '/admin/imports',
    titre: 'Importer un fichier Excel · Admin · CPI GO',
    familles: ['/api/v1/imports'],
    autorises: ['ADMIN'],
  },
  {
    route: '/admin/notifications',
    titre: 'Notifications · CPI GO',
    familles: ['/api/v1/notifications', '/api/v1/notification-templates'],
    autorises: ['ADMIN'],
    // Les rôles à boîte de réception sont renvoyés vers `/notifications` ; le
    // téléconseiller, qui n'en a pas, reçoit un refus.
    renvoyes: ['DIRECTION', 'SUPERVISEUR', 'ACCUEIL', 'BANQUE_FINANCE'],
  },
  {
    route: '/admin/enrolement',
    titre: 'Plateformes d’enrôlement · Admin · CPI GO',
    familles: ['/api/v1/enrolement'],
    autorises: ['ADMIN'],
  },
  {
    route: '/admin/parametres',
    titre: 'Paramètres · Admin · CPI GO',
    familles: ['/api/v1/admin/'],
    autorises: ['ADMIN'],
  },
  {
    route: '/admin/referentiels',
    titre: 'Référentiels · CPI GO',
    familles: ['/api/v1/referentiels'],
    autorises: ['ADMIN'],
  },
  {
    route: '/admin/referentiels/issues-appel',
    titre: 'Issues d’appel · CPI GO',
    familles: ['/api/v1/call-outcome-reasons'],
    autorises: ['ADMIN'],
  },

  // ─── Espace Projet CHUES ────────────────────────────────────────────────
  {
    route: '/chues',
    titre: 'Projet CHUES · CPI GO',
    familles: [...REPRESENTANTS, ...PROSPECTS, ...RAPPELS],
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
    renvoyes: ['BANQUE_FINANCE'],
  },
  {
    route: '/chues/appels-representants',
    titre: 'Qualifier un représentant · Projet CHUES · CPI GO',
    familles: [...REPRESENTANTS, '/api/v1/rep-campaigns'],
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/banque',
    titre: 'Tableau de bord bancaire · CPI GO',
    familles: DOSSIERS,
    autorises: ['ADMIN', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/campagnes',
    titre: 'Lots d’export · CPI GO',
    familles: ['/api/v1/lots-export'],
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
    renvoyes: ['COMMERCIAL', 'ACCUEIL', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/campagnes/{lot}',
    titre: 'Lot d’export · CPI GO',
    familles: ['/api/v1/lots-export'],
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
    renvoyes: ['COMMERCIAL', 'ACCUEIL', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/console',
    titre: 'Convertir un prospect · Projet CHUES · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/demandes-clients',
    titre: 'Demandes clients · CPI GO',
    familles: ['/api/v1/client-requests'],
    autorises: ['ADMIN', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/dossiers',
    titre: 'Dossiers bancaires · Projet CHUES · CPI GO',
    familles: DOSSIERS,
    autorises: ['ADMIN', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/dossiers/{dossier}',
    titre: 'Dossier bancaire · CPI GO',
    familles: DOSSIERS,
    autorises: ['ADMIN', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/dossiers/etapes',
    titre: 'Étapes bancaires · CPI GO',
    familles: ['/api/v1/bank-case-stages'],
    autorises: ['ADMIN'],
  },
  {
    route: '/chues/dossiers/export',
    titre: 'Export des dossiers · CPI GO',
    familles: DOSSIERS,
    autorises: ['ADMIN', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/dossiers/nouveau',
    titre: 'Nouveau dossier · CPI GO',
    familles: DOSSIERS,
    autorises: ['ADMIN', 'BANQUE_FINANCE'],
  },
  {
    route: '/chues/prospects',
    titre: 'Prospects · Projet CHUES · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/prospects/nouveau',
    titre: 'Ajouter un prospect · Projet CHUES · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/rappels',
    titre: 'Rappels · Projet CHUES · CPI GO',
    familles: RAPPELS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/representants',
    titre: 'Représentants · Projet CHUES · CPI GO',
    familles: REPRESENTANTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/representants/{representant}',
    titre: 'Représentant · CPI GO',
    familles: REPRESENTANTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/representants/import',
    titre: 'Import de représentants · CPI GO',
    familles: REPRESENTANTS,
    autorises: ['ADMIN'],
  },
  {
    route: '/chues/statistiques',
    titre: 'Tableau de bord · Projet CHUES · CPI GO',
    familles: CHIFFRES,
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/suggestions',
    titre: 'Numéros suggérés · CPI GO',
    familles: ['/api/v1/suggestions'],
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/supervision',
    titre: 'Supervision · CPI GO',
    familles: ['/api/v1/supervision', '/api/v1/admin/supervision'],
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/chues/tableau-de-bord',
    titre: 'Tableau de bord · Projet CHUES · CPI GO',
    familles: CHIFFRES,
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
    // `permanentRedirect` vers `/chues/statistiques` : le refus, s'il y en a
    // un, est celui de l'écran d'arrivée. Voir ROL-26.
    sansRefus: true,
  },

  // ─── Espace Projet Grand Public ─────────────────────────────────────────
  {
    route: '/grand-public',
    titre: 'Prospects · Projet Grand Public · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL'],
  },
  {
    route: '/grand-public/{prospect}',
    titre: 'Fiche Grand Public · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL'],
  },
  {
    route: '/grand-public/campagnes/{lot}',
    titre: 'Campagne d’appels Grand Public · CPI GO',
    familles: ['/api/v1/lots-export'],
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/grand-public/console',
    titre: 'Appeler les prospects · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR'],
  },
  {
    route: '/grand-public/nouveau',
    titre: 'Nouveau prospect Grand Public · CPI GO',
    familles: PROSPECTS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR'],
  },
  {
    route: '/grand-public/rappels',
    titre: 'Rappels · Projet Grand Public · CPI GO',
    familles: RAPPELS,
    autorises: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/grand-public/statistiques',
    titre: 'Tableau de bord · Projet Grand Public · CPI GO',
    familles: CHIFFRES,
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    route: '/grand-public/tableau-de-bord',
    titre: 'Tableau de bord · Projet Grand Public · CPI GO',
    familles: CHIFFRES,
    autorises: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
    sansRefus: true,
  },

  // ─── Hors coque ─────────────────────────────────────────────────────────
  {
    route: '/notifications',
    titre: 'Notifications · CPI GO',
    // `/notifications/mine` EST la boîte de réception : c'est bien la donnée
    // métier de cet écran, et la cloche de la barre supérieure ne la demande
    // pas pour un téléconseiller, seul rôle à qui l'écran est refusé.
    familles: ['/api/v1/notifications'],
    autorises: ['DIRECTION', 'SUPERVISEUR', 'BANQUE_FINANCE', 'ACCUEIL'],
    renvoyes: ['ADMIN'],
  },
];

/**
 * Les identifiants réels des trois routes de détail.
 *
 * Lus par l'API et non fabriqués : ces parcours ne créent aucune donnée. Un
 * identifiant réel rend la preuve réseau UTILE — si la garde tombait, la
 * requête aboutirait.
 */
const ids = { dossier: '', representant: '', prospect: '', lot: '' };

/**
 * Aucun lot d'export n'est ouvrable : `GET /api/v1/lots-export` répond 500 sur
 * cette base (§8, Q-15). L'identifiant ci-dessous n'existe pas — sans
 * conséquence ici, la garde de `campagnes/[id]` tranchant AVANT toute lecture.
 */
const LOT_INEXISTANT = '00000000-0000-4000-8000-000000000000';

function exigeUn<T>(valeur: T | undefined, quoi: string): T {
  if (valeur === undefined) throw new Error(`${quoi} — la base est-elle amorcée ?`);
  return valeur;
}

/**
 * Lit un premier identifiant, et NOMME l'échec.
 *
 * Sans ce message, une session expirée se manifeste dix lignes plus loin par
 * un `items` indéfini, et le parcours accuse la base d'être vide.
 */
async function premierId(
  api: Awaited<ReturnType<typeof adminApi>>,
  chemin: string,
  params: Record<string, string>,
  quoi: string,
): Promise<string> {
  const reponse = await api.get(chemin, { params });
  expect(
    reponse.ok(),
    `${chemin} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
  ).toBe(true);
  const corps = (await reponse.json()) as { items?: { id: string }[] };
  return exigeUn(corps.items?.[0], quoi).id;
}

test.beforeAll(async () => {
  const api = await adminApi();
  try {
    ids.dossier = await premierId(
      api,
      '/api/v1/bank-cases',
      { pageSize: '1' },
      'Aucun dossier bancaire en base',
    );
    ids.representant = await premierId(
      api,
      '/api/v1/representants',
      { pageSize: '1' },
      'Aucun représentant en base',
    );
    ids.prospect = await premierId(
      api,
      '/api/v1/prospects',
      { projet: 'GRAND_PUBLIC', pageSize: '1' },
      'Aucun prospect Grand Public en base',
    );
    ids.lot = LOT_INEXISTANT;
  } finally {
    await api.dispose();
  }
});

function adresse(ecran: Ecran): string {
  return ecran.route
    .replace('{dossier}', ids.dossier)
    .replace('{representant}', ids.representant)
    .replace('{prospect}', ids.prospect)
    .replace('{lot}', ids.lot);
}

function refuseesA(role: Role): Ecran[] {
  return ECRANS.filter(
    (ecran) =>
      ecran.sansRefus !== true &&
      !ecran.autorises.includes(role) &&
      ecran.renvoyes?.includes(role) !== true,
  );
}

/** Les chemins `/api/v1/…` aboutis, collectés depuis AVANT la navigation. */
function surveillerLApi(page: Page): { chemins: string[] } {
  const releve = { chemins: [] as string[] };
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (chemin.startsWith('/api/v1/') && response.status() < 400) releve.chemins.push(chemin);
  });
  return releve;
}

async function eprouverLeRefus(page: Page, role: Role, ecrans: readonly Ecran[]): Promise<void> {
  const releve = surveillerLApi(page);

  for (const ecran of ecrans) {
    const url = adresse(ecran);
    releve.chemins.length = 0;
    await page.goto(url);

    await expect(
      page.getByRole('heading', { name: 'Accès refusé', level: 2 }),
      `${url} devrait être refusé à ${role}`,
    ).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Accès refusé' }),
      `${url} : le refus devrait nommer le rôle en cours`,
    ).toContainText(LIBELLE_DU_ROLE[role]);
    await expect(
      page.getByRole('link', { name: 'Tous les espaces', exact: true }),
      `${url} : le refus devrait offrir une sortie vers le hub`,
    ).toHaveAttribute('href', '/espaces');

    const charges = releve.chemins.filter((chemin) =>
      ecran.familles.some((famille) => chemin.startsWith(famille)),
    );
    expect(charges, `${url} a chargé des données métier malgré le refus à ${role}`).toEqual([]);
  }
}

/**
 * Le balayage est coupé en tranches d'une dizaine de routes.
 *
 * Deux raisons, toutes deux mesurées : le quota de trois cents requêtes par
 * minute (E2E.md §4.4.2), et le délai de soixante secondes par test, que
 * vingt-six routes dépassent largement quand le serveur de développement
 * compile chaque écran à sa première visite — une navigation a été relevée à
 * six secondes pendant que quinze suites tournaient ensemble. Le nom du test
 * porte sa tranche ; le message d'assertion, lui, nomme toujours la route
 * fautive.
 */
const TRANCHE = 6;

function trancher(ecrans: readonly Ecran[]): Ecran[][] {
  const tranches: Ecran[][] = [];
  for (let debut = 0; debut < ecrans.length; debut += TRANCHE) {
    tranches.push(ecrans.slice(debut, debut + TRANCHE));
  }
  return tranches;
}

for (const [identifiant, role] of [
  ['ROL-17', 'DIRECTION'],
  ['ROL-18', 'SUPERVISEUR'],
  ['ROL-19', 'COMMERCIAL'],
  ['ROL-20', 'ACCUEIL'],
  ['ROL-21', 'BANQUE_FINANCE'],
] as const) {
  test.describe(identifiant, () => {
    test.use({ storageState: SESSIONS[role] });

    const tranches = trancher(refuseesA(role));
    tranches.forEach((tranche, index) => {
      const rang = `${String(index + 1)}/${String(tranches.length)}`;
      test(`${identifiant} · aucune route interdite ne s’ouvre à ${role} (${rang})`, async ({
        page,
      }) => {
        await eprouverLeRefus(page, role, tranche);
      });
    });
  });
}

/**
 * ROL-22 : l'inverse du balayage. Une garde qui se referme sur
 * l'administrateur rend un écran inatteignable POUR TOUT LE MONDE, et personne
 * ne s'en aperçoit avant l'appel du client.
 */
test.describe('ROL-22', () => {
  test.use({ storageState: SESSIONS.ADMIN });

  async function eprouverLAcces(page: Page, ecrans: readonly Ecran[]): Promise<void> {
    for (const ecran of ecrans) {
      const url = adresse(ecran);
      await page.goto(url);
      await expect(page, `${url} : titre du document`).toHaveTitle(ecran.titre);
      await expect(
        page.getByRole('heading', { name: 'Accès refusé', level: 2 }),
        `${url} ne devrait pas être refusé à un administrateur`,
      ).toHaveCount(0);
    }
  }

  const tranches = trancher(ECRANS);
  tranches.forEach((tranche, index) => {
    const rang = `${String(index + 1)}/${String(tranches.length)}`;
    test(`ROL-22 · aucune route n’est refusée à un administrateur (${rang})`, async ({ page }) => {
      await eprouverLAcces(page, tranche);
    });
  });
});
