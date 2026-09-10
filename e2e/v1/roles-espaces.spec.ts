import { expect, test, type Page } from '@playwright/test';

/**
 * ROL-01 à ROL-06 : le hub `/espaces`, un scénario par rôle.
 *
 * Les destinations sont calculées par `coqueHomePath(role, coque)` : elles se
 * vérifient PAR UN CLIC sur la tuile, jamais en tapant l'URL, puisque c'est le
 * lien de la tuile qui porte le calcul. Un rôle qu'on envoie sur un écran que
 * l'API lui refuse perd sa première seconde d'utilisation sur un refus, et
 * `nav-items.test.ts` ne peut pas le voir : il ne connaît pas la garde serveur.
 *
 * Les six états de session sont posés par le projet `setup` (`auth.setup.ts`) ;
 * aucun de ces parcours ne dépense une connexion.
 */

const TITRE_ACCES_REFUSE = 'Accès refusé';

/** Les trois titres d'écran cassé. Aucun ne doit paraître à l'arrivée. */
const TITRES_D_ECHEC = [
  TITRE_ACCES_REFUSE,
  'Serveur injoignable',
  'Chargement impossible',
] as const;

const DESCRIPTIONS: Record<string, string> = {
  Accueil: 'Registre des visites du comptoir',
  'Projet CHUES': 'Enrôlement des enseignants syndiqués',
  'Projet Grand Public': 'Vente hors syndicat, en préparation',
  Admin: 'Comptes, listes de référence, imports et paramètres',
};

interface Destination {
  /** Le libellé de la tuile, préfixe de son nom accessible. */
  tuile: string;
  url: RegExp;
  /** Le repère PROPRE à l'écran d'arrivée : le titre de niveau 1 vient de la
      barre supérieure et vaudrait aussi pour une page qui n'a rien rendu. */
  repere: (page: Page) => Promise<void>;
}

const REGISTRE: Destination = {
  tuile: 'Accueil',
  url: /\/accueil$/,
  repere: async (page) => {
    await expect(page.getByRole('button', { name: 'Ajouter une visite' })).toBeVisible();
  },
};

const CHIFFRES_CHUES: Destination = {
  tuile: 'Projet CHUES',
  url: /\/chues\/statistiques$/,
  repere: async (page) => {
    await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
    await expect(page).toHaveTitle('Tableau de bord · CPI GO');
  },
};

const CHIFFRES_GRAND_PUBLIC: Destination = {
  tuile: 'Projet Grand Public',
  url: /\/grand-public\/statistiques$/,
  repere: async (page) => {
    await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
    await expect(page).toHaveTitle('Tableau de bord Grand Public · CPI GO');
  },
};

const COMPTES: Destination = {
  tuile: 'Admin',
  url: /\/admin\/commerciaux$/,
  repere: async (page) => {
    await expect(page.getByRole('button', { name: 'Nouvel utilisateur' })).toBeVisible();
    await expect(page).toHaveTitle('Téléconseillers · CPI GO');
  },
};

const TROIS_ETAPES: Destination = {
  tuile: 'Projet CHUES',
  url: /\/chues$/,
  repere: async (page) => {
    await expect(page.getByText('Trois étapes, dans l’ordre.')).toBeVisible();
  },
};

const FILE_GRAND_PUBLIC: Destination = {
  tuile: 'Projet Grand Public',
  url: /\/grand-public\/console$/,
  repere: async (page) => {
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Rechercher une fiche', level: 1 }),
    ).toBeVisible();
  },
};

const BANQUE: Destination = {
  tuile: 'Projet CHUES',
  url: /\/chues\/banque$/,
  repere: async (page) => {
    await expect(page.getByRole('group', { name: 'Vues rapides' })).toBeVisible();
    await expect(page).toHaveTitle('Tableau de bord bancaire · CPI GO');
  },
};

/** Le hub lui-même : quatre tuiles, toujours, chacune avec sa description. */
async function ouvrirLeHub(page: Page): Promise<void> {
  await page.goto('/espaces');
  await expect(page).toHaveURL(/\/espaces$/);
  await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();

  const main = page.getByRole('main');
  await expect(main.getByRole('listitem')).toHaveCount(4);

  for (const [tuile, description] of Object.entries(DESCRIPTIONS)) {
    await expect(main.getByRole('listitem').filter({ hasText: tuile }), tuile).toContainText(
      description,
    );
  }
}

/** Grisée : montrée, décrite, et SANS lien. Un projet hors de portée existe. */
async function verifierTuilesGrisees(page: Page, tuiles: readonly string[]): Promise<void> {
  const main = page.getByRole('main');
  for (const tuile of tuiles) {
    const carte = main.getByRole('listitem').filter({ hasText: tuile });
    await expect(carte, tuile).toContainText('Réservé à d’autres profils');
    await expect(carte.getByRole('link'), tuile).toHaveCount(0);
  }
}

/**
 * Ouvre une tuile, éprouve l'écran d'arrivée, puis revient au hub.
 *
 * Le retour se fait par une navigation neuve et non par l'historique : la
 * tuile suivante doit être calculée par le serveur, pas relue dans un cache
 * de retour arrière.
 */
async function ouvrirLaTuile(page: Page, destination: Destination): Promise<void> {
  await page
    .getByRole('main')
    .getByRole('link', { name: new RegExp(`^${destination.tuile}`) })
    .click();
  await expect(page, destination.tuile).toHaveURL(destination.url);

  await destination.repere(page);
  for (const titre of TITRES_D_ECHEC) {
    await expect(
      page.getByRole('heading', { name: titre, exact: true }),
      `${destination.tuile} : l’écran d’arrivée montre « ${titre} »`,
    ).toHaveCount(0);
  }

  await ouvrirLeHub(page);
}

test.describe('ROL-01 · administrateur', () => {
  test.use({ storageState: 'v1/.auth/admin.json' });

  test('ROL-01 · un administrateur voit quatre tuiles ouvertes et chacune mène où il faut', async ({
    page,
  }) => {
    await ouvrirLeHub(page);
    await expect(page.getByRole('main').getByText('Réservé à d’autres profils')).toHaveCount(0);

    for (const destination of [REGISTRE, CHIFFRES_CHUES, CHIFFRES_GRAND_PUBLIC, COMPTES]) {
      await ouvrirLaTuile(page, destination);
    }
  });
});

test.describe('ROL-02 · direction', () => {
  test.use({ storageState: 'v1/.auth/direction.json' });

  test('ROL-02 · la Direction ouvre Accueil, CHUES et Grand Public, jamais l’Admin', async ({
    page,
  }) => {
    await ouvrirLeHub(page);
    await verifierTuilesGrisees(page, ['Admin']);

    for (const destination of [REGISTRE, CHIFFRES_CHUES, CHIFFRES_GRAND_PUBLIC]) {
      await ouvrirLaTuile(page, destination);
    }
  });
});

test.describe('ROL-03 · supervision', () => {
  test.use({ storageState: 'v1/.auth/superviseur.json' });

  test('ROL-03 · la supervision n’ouvre que CHUES et Grand Public', async ({ page }) => {
    await ouvrirLeHub(page);
    await verifierTuilesGrisees(page, ['Accueil', 'Admin']);

    // La tuile Grand Public mène au TABLEAU DE BORD, pas à la liste : un
    // superviseur qui atterrit sur `/grand-public` ouvre l'annuaire là où on
    // lui a promis des chiffres.
    for (const destination of [CHIFFRES_CHUES, CHIFFRES_GRAND_PUBLIC]) {
      await ouvrirLaTuile(page, destination);
    }
  });
});

test.describe('ROL-04 · téléconseiller', () => {
  test.use({ storageState: 'v1/.auth/commercial.json' });

  test('ROL-04 · un téléconseiller atterrit sur ses trois étapes et sur la file Grand Public', async ({
    page,
  }) => {
    await ouvrirLeHub(page);
    await verifierTuilesGrisees(page, ['Accueil', 'Admin']);

    for (const destination of [TROIS_ETAPES, FILE_GRAND_PUBLIC]) {
      await ouvrirLaTuile(page, destination);
    }
  });
});

test.describe('ROL-05 · accueil', () => {
  test.use({ storageState: 'v1/.auth/accueil.json' });

  test('ROL-05 · un agent d’accueil ne voit qu’une tuile ouverte', async ({ page }) => {
    await ouvrirLeHub(page);
    await verifierTuilesGrisees(page, ['Projet CHUES', 'Projet Grand Public', 'Admin']);

    await ouvrirLaTuile(page, REGISTRE);
  });
});

test.describe('ROL-06 · banque et finance', () => {
  test.use({ storageState: 'v1/.auth/banque.json' });

  test('ROL-06 · un agent Banque & Finance atterrit sur le tableau de bord bancaire', async ({
    page,
  }) => {
    await ouvrirLeHub(page);
    await verifierTuilesGrisees(page, ['Accueil', 'Projet Grand Public', 'Admin']);

    // Le tableau de bord BANCAIRE : celui des prospects lui vaudrait un 403.
    await ouvrirLaTuile(page, BANQUE);
  });
});
