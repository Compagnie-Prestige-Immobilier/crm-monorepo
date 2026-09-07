import { expect, test, type Page } from '@playwright/test';

/**
 * ROL-07 à ROL-16 : ce que la barre latérale montre, par rôle et par coque.
 *
 * Source de vérité : `apps/web/src/components/layout/nav-items.ts`. Ce que
 * `nav-items.test.ts` ne peut pas voir, c'est que le rôle lu sur la session
 * SERVEUR atteint bien la barre, et que l'ordre rendu est celui de la liste.
 *
 * Une entrée absente n'est pas une protection : la garde serveur reste la
 * règle (ROL-17 à ROL-22). Ce que ces parcours éprouvent, c'est la liste que
 * l'œil doit trier chaque matin — et qu'aucune entrée d'un autre rôle n'y
 * fuit.
 */

const NAV = 'Navigation principale';

interface Cas {
  id: string;
  intitule: string;
  session: string;
  route: string;
  /** Dans l'ordre exact de la barre, replis fermés. */
  principales: readonly string[];
  /** Rangées sous « Plus » : absentes avant le clic, visibles après. */
  repliees: readonly string[];
  absentes: readonly string[];
  /** L'entrée qui porte `aria-current="page"` sur cette route. */
  courant?: string;
}

/** Ce que « tout le reste » veut dire pour un agent bancaire. */
const HORS_BANQUE = [
  'Mon travail',
  'Tableau de bord',
  'Les trois étapes',
  'Qualifier un représentant',
  'Ajouter un prospect',
  'Convertir un prospect',
  'Rappels promis',
  'Rappels',
  'Mon équipe',
  'Équipes',
  'Contacts recommandés',
  'Représentants',
  'Prospects',
  'Lots d’export',
  'Créations de client à valider',
  'Étapes des dossiers',
  'Utilisateurs',
  'Listes de référence',
  'Paramètres',
] as const;

const CAS: readonly Cas[] = [
  {
    id: 'ROL-07',
    intitule: 'barre CHUES d’un téléconseiller',
    session: 'e2e/.auth/commercial.json',
    route: '/chues',
    principales: [
      'Mon travail',
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
      'Rappels promis',
    ],
    repliees: ['Contacts recommandés', 'Représentants', 'Prospects'],
    absentes: [
      'Tableau de bord',
      'Mon équipe',
      'Lots d’export',
      'Dossiers bancaires',
      'Utilisateurs',
      'Listes de référence',
      'Paramètres',
    ],
    courant: 'Mon travail',
  },
  {
    id: 'ROL-08 · supervision',
    intitule: 'barre CHUES de l’encadrement',
    session: 'e2e/.auth/superviseur.json',
    route: '/chues/statistiques',
    // L'équipe et les campagnes sont des onglets du tableau de bord, plus des entrées.
    principales: [
      'Tableau de bord',
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
      'Rappels promis',
    ],
    repliees: ['Contacts recommandés', 'Représentants', 'Prospects'],
    absentes: [
      'Mon travail',
      'Dossiers bancaires',
      'Utilisateurs',
      'Listes de référence',
      'Paramètres',
      'Créations de client à valider',
    ],
    courant: 'Tableau de bord',
  },
  {
    id: 'ROL-08 · direction',
    intitule: 'barre CHUES de l’encadrement',
    session: 'e2e/.auth/direction.json',
    route: '/chues/statistiques',
    principales: [
      'Tableau de bord',
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
      'Rappels promis',
    ],
    repliees: ['Contacts recommandés', 'Représentants', 'Prospects'],
    absentes: [
      'Mon travail',
      'Dossiers bancaires',
      'Utilisateurs',
      'Listes de référence',
      'Paramètres',
      'Créations de client à valider',
    ],
    courant: 'Tableau de bord',
  },
  {
    id: 'ROL-09',
    intitule: 'barre CHUES d’un administrateur',
    session: 'e2e/.auth/admin.json',
    route: '/chues/statistiques',
    // Réponse à la question Q-13 du §8, relevée en navigateur : `navSections`
    // concatène deux blocs d'entrées ADMIN écrits à des endroits différents de
    // `nav-items.ts`, et c'est cet ordre-là qui est rendu.
    principales: ['Tableau de bord', 'Prospects', 'Représentants', 'Dossiers bancaires'],
    repliees: [
      'Les trois étapes',
      'Rappels',
      'Contacts recommandés',
      'Créations de client à valider',
      'Exporter les dossiers',
      'Étapes des dossiers',
    ],
    // La vue bancaire est un ONGLET du tableau de bord, plus une entrée de barre.
    absentes: ['Mon travail', 'Mes demandes de création', 'Vue d’ensemble bancaire'],
    courant: 'Tableau de bord',
  },
  {
    id: 'ROL-10',
    intitule: 'barre CHUES d’un agent bancaire',
    session: 'e2e/.auth/banque.json',
    route: '/chues/banque',
    principales: [
      'Vue d’ensemble',
      'Dossiers bancaires',
      'Ouvrir un dossier',
      'Mes demandes de création',
    ],
    repliees: ['Exporter les dossiers'],
    absentes: HORS_BANQUE,
    courant: 'Vue d’ensemble',
  },
  {
    id: 'ROL-11',
    intitule: 'barre Grand Public d’un téléconseiller',
    session: 'e2e/.auth/commercial.json',
    route: '/grand-public/console',
    principales: ['Grand Public', 'Appeler les prospects', 'Rappels promis'],
    repliees: ['Mes contacts', 'Noter un prospect'],
    absentes: ['Tableau de bord', 'Mon travail', 'Prospects'],
    courant: 'Appeler les prospects',
  },
  {
    id: 'ROL-12 · supervision',
    intitule: 'barre Grand Public de l’encadrement',
    session: 'e2e/.auth/superviseur.json',
    route: '/grand-public/statistiques',
    principales: ['Tableau de bord', 'Prospects'],
    repliees: ['Rappels'],
    absentes: ['Noter un prospect', 'Appeler les prospects', 'Mon travail'],
    courant: 'Tableau de bord',
  },
  {
    id: 'ROL-12 · direction',
    intitule: 'barre Grand Public de l’encadrement',
    session: 'e2e/.auth/direction.json',
    route: '/grand-public/statistiques',
    principales: ['Tableau de bord', 'Prospects'],
    repliees: ['Rappels'],
    absentes: ['Noter un prospect', 'Appeler les prospects', 'Mon travail'],
    courant: 'Tableau de bord',
  },
  {
    id: 'ROL-13',
    intitule: 'barre Grand Public d’un administrateur',
    session: 'e2e/.auth/admin.json',
    route: '/grand-public/statistiques',
    principales: ['Tableau de bord', 'Prospects', 'Dossiers bancaires'],
    repliees: ['Rappels', 'Appeler les prospects', 'Noter un prospect'],
    absentes: ['Mon travail', 'Vue d’ensemble bancaire'],
    courant: 'Tableau de bord',
  },
  {
    id: 'ROL-14',
    intitule: 'barre Admin',
    session: 'e2e/.auth/admin.json',
    route: '/admin/commerciaux',
    principales: [
      'Utilisateurs',
      'Listes de référence',
      'Importer un fichier Excel',
      'Envoyer une notification',
      'Plateformes d’enrôlement',
      'Paramètres',
    ],
    repliees: [],
    absentes: ['Mon travail', 'Prospects', 'Tableau de bord'],
    courant: 'Utilisateurs',
  },
  {
    id: 'ROL-15 · administrateur',
    intitule: 'barre Accueil',
    session: 'e2e/.auth/admin.json',
    route: '/accueil',
    principales: [],
    repliees: [],
    // `hidden: true` : les trois onglets du registre ne sont PAS dans la
    // barre, même pour un administrateur. Deux chemins pour le même clic.
    absentes: ['Tableau de bord', 'Listes', 'Import du registre', 'Mon travail'],
  },
  {
    id: 'ROL-15 · direction',
    intitule: 'barre Accueil',
    session: 'e2e/.auth/direction.json',
    route: '/accueil',
    principales: [],
    repliees: [],
    absentes: ['Tableau de bord', 'Listes', 'Import du registre', 'Mon travail'],
  },
  {
    id: 'ROL-16',
    intitule: 'la barre d’un agent d’accueil ne montre qu’une entrée',
    session: 'e2e/.auth/accueil.json',
    route: '/accueil',
    principales: [],
    repliees: [],
    absentes: [
      'Tableau de bord',
      'Listes',
      'Import du registre',
      'Prospects',
      'Utilisateurs',
      'Paramètres',
      'Mon travail',
    ],
  },
];

async function verifierLaBarre(page: Page, cas: Cas): Promise<void> {
  await page.goto(cas.route);
  const nav = page.getByRole('navigation', { name: NAV });

  // Le registre n'a pas de barre : une seule entrée, portée par le titre de l'écran.
  if (cas.principales.length === 0) {
    await expect(nav, `${cas.id} : aucune barre attendue`).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Registre des visites', level: 1 }),
    ).toBeVisible();
    return;
  }

  for (const libelle of cas.principales) {
    await expect(
      nav.getByRole('link', { name: libelle, exact: true }),
      `${cas.id} : « ${libelle} » manque dans la barre`,
    ).toBeVisible();
  }

  // L'ORDRE, et rien de plus : replis fermés, la barre ne contient QUE ses
  // entrées principales, dans la suite écrite par `nav-items.ts`.
  await expect(nav.getByRole('link'), `${cas.id} : ordre de la barre`).toHaveText([
    ...cas.principales,
  ]);

  if (cas.courant !== undefined) {
    await expect(
      nav.getByRole('link', { name: cas.courant, exact: true }),
      `${cas.id} : « ${cas.courant} » devrait porter aria-current`,
    ).toHaveAttribute('aria-current', 'page');
  }

  for (const libelle of cas.absentes) {
    await expect(
      nav.getByRole('link', { name: libelle, exact: true }),
      `${cas.id} : « ${libelle} » ne devrait pas être dans cette barre`,
    ).toHaveCount(0);
  }

  const plus = nav.getByText('Plus', { exact: true });

  if (cas.repliees.length === 0) {
    await expect(plus, `${cas.id} : aucune section « Plus » attendue`).toHaveCount(0);
    return;
  }

  for (const libelle of cas.repliees) {
    await expect(
      nav.getByRole('link', { name: libelle, exact: true }),
      `${cas.id} : « ${libelle} » devrait être repliée`,
    ).toHaveCount(0);
  }

  await plus.click();

  for (const libelle of cas.repliees) {
    await expect(
      nav.getByRole('link', { name: libelle, exact: true }),
      `${cas.id} : « ${libelle} » manque sous « Plus »`,
    ).toBeVisible();
  }
}

for (const cas of CAS) {
  test.describe(cas.id, () => {
    test.use({ storageState: cas.session });

    test(`${cas.id} · ${cas.intitule}`, async ({ page }) => {
      await verifierLaBarre(page, cas);
    });
  });
}
