import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { avecBase, compteDe, type RoleCompte } from './comptes';

const NOM_REPRESENTANT = 'E2E a11y Representant';
const NOM_PROSPECT_CHUES = 'E2E a11y ProspectChues';
const NOM_PROSPECT_GP = 'E2E a11y ProspectGP';
const NOM_CLIENT = 'E2E a11y Client';
const NOM_VISITEUR = 'E2E a11y Visiteur';
const REFERENCE_DOSSIER = 'DOS-E2E-A11Y';
const REFERENCE_VISITE = 'VIS-E2E-A11Y';

const TELEPHONES = ['+221781140040', '+221781140041', '+221781140042', '+221781140043'];

async function purger(): Promise<void> {
  await avecBase(async (client) => {
    await client.query(
      `DELETE FROM bank_case_transitions
        WHERE "caseId" IN (SELECT id FROM bank_cases WHERE reference = $1)`,
      [REFERENCE_DOSSIER],
    );
    await client.query('DELETE FROM bank_cases WHERE reference = $1', [REFERENCE_DOSSIER]);
    await client.query(
      `DELETE FROM prospect_journeys
        WHERE "prospectId" IN (SELECT id FROM prospects WHERE "phoneE164" = ANY($1))`,
      [TELEPHONES],
    );
    await client.query('DELETE FROM prospects WHERE "phoneE164" = ANY($1)', [TELEPHONES]);
    await client.query('DELETE FROM representants WHERE "phoneE164" = ANY($1)', [TELEPHONES]);
    await client.query('DELETE FROM visites WHERE reference = $1', [REFERENCE_VISITE]);
  });
}

async function semer(): Promise<void> {
  const admin = compteDe('ADMIN').id;
  const accueil = compteDe('ACCUEIL').id;
  const teleconseiller = compteDe('COMMERCIAL').id;

  await avecBase(async (client) => {
    await client.query(
      `INSERT INTO representants
         (id, "fullName", "phoneE164", "departementId", "createdById", "clientCreatedAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2,
         (SELECT id FROM departements ORDER BY code LIMIT 1), $3, now(), now())`,
      [NOM_REPRESENTANT, TELEPHONES[0], admin],
    );

    // Sans ligne dans `prospect_journeys`, ni la liste ni la console ne voient la fiche ;
    // et un teleconseiller ne lit que les fiches dont il est l'auteur.
    const prospect = async (
      nom: string,
      telephone: string,
      projet: string,
      enrole: boolean,
      auteur: string,
    ) => {
      await client.query(
        `WITH cree AS (
           INSERT INTO prospects (id, nom, prenom, "phoneE164", "createdById", "clientCreatedAt",
             "updatedAt", projet, "phase2Status", "enrollmentMethod", "banqueId")
           VALUES (gen_random_uuid()::text, $1, 'Awa', $2, $3, now(), now(), $4::"Projet",
             $5::"Phase2Status", CASE WHEN $6 THEN 'PLATFORM'::"EnrollmentMethod" END,
             CASE WHEN $6 THEN (SELECT id FROM banques ORDER BY name LIMIT 1) END)
           RETURNING id
         )
         INSERT INTO prospect_journeys (id, "prospectId", projet, "phase2Status",
           "enrollmentMethod", "updatedAt")
         SELECT gen_random_uuid()::text, id, $4::"Projet", $5::"Phase2Status",
           CASE WHEN $6 THEN 'PLATFORM'::"EnrollmentMethod" END, now() FROM cree`,
        [nom, telephone, auteur, projet, enrole ? 'METHOD_OBTAINED' : 'PENDING', enrole],
      );
    };

    await prospect(NOM_PROSPECT_CHUES, TELEPHONES[1] ?? '', 'CHUES', false, teleconseiller);
    await prospect(NOM_PROSPECT_GP, TELEPHONES[2] ?? '', 'GRAND_PUBLIC', false, admin);
    await prospect(NOM_CLIENT, TELEPHONES[3] ?? '', 'CHUES', true, admin);

    await client.query(
      `INSERT INTO bank_cases (id, reference, "referenceKey", "prospectId", "customerName",
         "customerPhoneE164", "processingBankId", "currentStageId", "createdById", "updatedAt")
       SELECT gen_random_uuid()::text, $1, $1, p.id, $2, p."phoneE164",
         (SELECT id FROM banques ORDER BY name LIMIT 1),
         (SELECT id FROM bank_case_stages WHERE "isInitial" ORDER BY position LIMIT 1),
         $3, now()
       FROM prospects p WHERE p."phoneE164" = $4`,
      [REFERENCE_DOSSIER, `Awa ${NOM_CLIENT}`, admin, TELEPHONES[3]],
    );

    await client.query(
      `INSERT INTO visites (id, reference, "visitedAt", "visitorName", "entrepriseId", "objetId",
         "createdById", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, now(), $2,
         (SELECT id FROM visite_entreprises ORDER BY "sortOrder" LIMIT 1),
         (SELECT id FROM visite_objets ORDER BY "sortOrder" LIMIT 1), $3, now())`,
      [REFERENCE_VISITE, NOM_VISITEUR, accueil],
    );
  });
}

/** Les listes rendent un tableau ET une pile de cartes, une seule des deux étant affichée. */
const affiche = (page: Page, texte: string): Locator =>
  page.getByText(texte).filter({ visible: true }).first();

/** Une violation se rapporte par sa règle, son impact et le sélecteur fautif. */
async function auditer(page: Page, ou: string): Promise<void> {
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  });
  const resultat = await new AxeBuilder({ page }).analyze();
  const violations = resultat.violations.map(
    (regle) =>
      `${regle.id} (${regle.impact ?? 'sans impact'}) : ${regle.nodes
        .map((noeud) => noeud.target.join(' '))
        .join(' | ')}`,
  );
  expect(violations, ou).toEqual([]);
}

test.beforeAll(async () => {
  await purger();
  await semer();
});

test.afterAll(async () => {
  await purger();
});

const ECRANS: readonly { role: RoleCompte; chemin: string; repere: string }[] = [
  { role: 'ADMIN', chemin: '/espaces', repere: 'Choisissez un espace de travail.' },
  { role: 'ADMIN', chemin: '/chues/prospects', repere: NOM_PROSPECT_CHUES },
  { role: 'ADMIN', chemin: '/chues/representants', repere: NOM_REPRESENTANT },
  { role: 'ADMIN', chemin: '/grand-public', repere: NOM_PROSPECT_GP },
  {
    role: 'ADMIN',
    chemin: '/admin/commerciaux',
    repere: 'Comptes de connexion au panneau. Désactiver ferme l’accès sans rien supprimer.',
  },
  {
    role: 'ADMIN',
    chemin: '/admin/parametres',
    repere: 'Ces actions portent sur les données de tous les utilisateurs.',
  },
  { role: 'COMMERCIAL', chemin: '/chues/console', repere: NOM_PROSPECT_CHUES },
  { role: 'BANQUE_FINANCE', chemin: '/chues/dossiers', repere: REFERENCE_DOSSIER },
  { role: 'ACCUEIL', chemin: '/accueil', repere: NOM_VISITEUR },
];

const ROLES_AUDITES = [...new Set(ECRANS.map((ecran) => ecran.role))];

for (const role of ROLES_AUDITES) {
  test.describe(`parité accessibilité, écrans principaux en session ${role}`, () => {
    test.use({ storageState: compteDe(role).etat });

    for (const ecran of ECRANS.filter((candidat) => candidat.role === role)) {
      test(`aucune violation axe sur ${ecran.chemin}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto(ecran.chemin);
        await expect(affiche(page, ecran.repere)).toBeVisible();
        await auditer(page, `${ecran.chemin} (session ${role})`);
      });
    }
  });
}

test.describe('parité accessibilité, tuiles fermées du hub', () => {
  test.use({ storageState: compteDe('ACCUEIL').etat });

  // Le gris des tuiles fermées ne passe pas : `opacity-60` sur `text-muted-foreground`
  // rend 6 textes sous 4.5:1 dans `components/espaces/espaces-grid.tsx`.
  test.fixme('aucune violation axe sur /espaces vu par un compte ACCUEIL', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/espaces');
    await expect(page.getByText('Non accessible à votre rôle')).toHaveCount(3);
    await auditer(page, '/espaces (session ACCUEIL)');
  });
});

test.describe('parité accessibilité, écran de connexion', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('aucune violation axe sur /connexion', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/connexion');
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();
    await auditer(page, '/connexion (anonyme)');
  });
});

test.describe('parité accessibilité, refus opposé à un téléconseiller', () => {
  test.use({ storageState: compteDe('COMMERCIAL').etat });

  test('aucune violation axe sur « Accès refusé »', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/parametres');
    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(page.getByText('Rôle en cours :')).toBeVisible();
    await auditer(page, '/admin/parametres (refus, session COMMERCIAL)');
  });
});

const ECRANS_SOMBRES: readonly { chemin: string; repere: string }[] = [
  { chemin: '/chues/prospects', repere: NOM_PROSPECT_CHUES },
  { chemin: '/grand-public', repere: NOM_PROSPECT_GP },
  {
    chemin: '/admin/parametres',
    repere: 'Ces actions portent sur les données de tous les utilisateurs.',
  },
];

test.describe('parité accessibilité, thème sombre', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  for (const { chemin, repere } of ECRANS_SOMBRES) {
    test(`aucune violation axe sur ${chemin} en thème sombre`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(chemin);
      await expect(affiche(page, repere)).toBeVisible();

      await page.getByRole('button', { name: 'Changer de thème' }).click();
      await page.getByRole('menuitem', { name: 'Sombre' }).click();
      await expect(page.locator('html.dark')).toHaveCount(1);

      await auditer(page, `${chemin} (thème sombre)`);
    });
  }
});

test.describe('parité accessibilité, largeur téléphone', () => {
  test.use({
    storageState: compteDe('ADMIN').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  for (const { chemin, repere } of ECRANS_SOMBRES.slice(1)) {
    test(`aucune violation axe sur ${chemin} à 390 px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(chemin);
      await expect(affiche(page, repere)).toBeVisible();
      await auditer(page, `${chemin} (390 px)`);
    });
  }
});

/** Nom accessible, focus piégé, fermeture par Échap, focus rendu au déclencheur. */
async function modaleTenue(page: Page, declencheur: Locator, nom: string): Promise<void> {
  await declencheur.click();
  const boite = page.getByRole('dialog', { name: nom });
  await expect(boite).toBeVisible();

  const focus = async (): Promise<string> =>
    boite.evaluate((element) => {
      const actif = document.activeElement;
      if (actif === null) return 'aucun élément actif';
      const dedans = element.contains(actif) ? 'dans' : 'hors';
      return `${dedans} : ${actif.tagName.toLowerCase()}[${actif.getAttribute('aria-label') ?? actif.textContent?.slice(0, 40) ?? ''}]`;
    });

  expect(await focus(), `${nom} : le focus n’entre pas dans la boîte`).toContain('dans');
  // Une boîte courte fait le tour en moins de six sauts : la sentinelle de Base UI
  // rend le focus au cycle suivant, d'où l'attente sur l'état final plutôt qu'immédiate.
  for (let saut = 0; saut < 6; saut += 1) await page.keyboard.press('Tab');
  await expect
    .poll(focus, { message: `${nom} : la tabulation sort de la boîte` })
    .toContain('dans');

  await auditer(page, `modale « ${nom} »`);

  await page.keyboard.press('Escape');
  await expect(boite).toBeHidden();
  await expect(declencheur, `${nom} : le focus n’est pas rendu au déclencheur`).toBeFocused();
}

test.describe('parité accessibilité, boîtes de dialogue de l’espace Admin', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('« Nouvel utilisateur » nomme sa boîte, la referme et rend le focus', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/commerciaux');
    await expect(
      page.getByText('Comptes de connexion au panneau.', { exact: false }),
    ).toBeVisible();

    await modaleTenue(
      page,
      page.getByRole('button', { name: 'Nouvel utilisateur' }),
      'Nouvel utilisateur',
    );
  });

  test('« Nouvelle notification » nomme sa boîte, la referme et rend le focus', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/notifications');
    await expect(page.getByRole('tab', { name: 'Boîte de réception' })).toBeVisible();

    await modaleTenue(
      page,
      page.getByRole('button', { name: 'Nouvelle notification' }),
      'Nouvelle notification',
    );
  });
});

test.describe('parité accessibilité, tiroir de navigation en 390 px', () => {
  test.use({
    storageState: compteDe('SUPERVISEUR').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('le tiroir nomme sa boîte, la referme et rend le focus', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/chues/statistiques');
    await modaleTenue(
      page,
      page.getByRole('button', { name: 'Ouvrir la navigation' }),
      'Navigation principale',
    );
  });
});

test.describe('parité accessibilité, navigation au clavier', () => {
  test.use({ storageState: compteDe('SUPERVISEUR').etat });

  test('le menu du compte s’ouvre, se parcourt et rend le focus', async ({ page }) => {
    await page.goto('/chues/statistiques');
    const declencheur = page.getByRole('button', {
      name: `Compte de ${compteDe('SUPERVISEUR').nom}`,
    });

    await declencheur.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    await page.keyboard.press('ArrowDown');
    expect(
      await menu.evaluate((element) => element.contains(document.activeElement)),
      'la flèche bas ne pose le focus sur aucune entrée du menu',
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(declencheur, 'le menu du compte ne rend pas le focus').toBeFocused();
  });

  test('la barre latérale se replie au clavier et annonce son état', async ({ page }) => {
    await page.goto('/chues/statistiques');
    const barre = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(barre).toBeVisible();

    const bascule = page.getByRole('button', { name: 'Réduire la navigation' });
    await expect(bascule).toHaveAttribute('aria-expanded', 'true');
    await expect(bascule).toHaveAttribute('aria-controls', 'navigation-laterale');
    await expect(page.locator('#navigation-laterale')).toHaveCount(1);

    await bascule.press('Enter');
    const deployer = page.getByRole('button', { name: 'Déployer la navigation' });
    await expect(deployer).toHaveAttribute('aria-expanded', 'false');
    await expect(deployer, 'le repli déplace le focus hors du bouton').toBeFocused();

    await deployer.press('Enter');
    await expect(page.getByRole('button', { name: 'Réduire la navigation' })).toBeVisible();
  });

  test('un écran du panneau porte ses repères et un seul titre de niveau 1', async ({ page }) => {
    await page.goto('/chues/prospects');
    await expect(affiche(page, NOM_PROSPECT_CHUES)).toBeVisible();

    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});

test.describe('parité accessibilité, titre du document', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  // `index.html` fige `<title>CPI GO</title>` et aucune route ne le réécrit ; la v1
  // servait « Prospects · CPI GO ». Écart WCAG 2.4.2, à reprendre côté produit.
  test.fixme('le titre du document nomme l’écran ouvert', async ({ page }) => {
    await page.goto('/chues/prospects');
    await expect(affiche(page, NOM_PROSPECT_CHUES)).toBeVisible();
    await expect(page).toHaveTitle(/Prospects/);
  });
});
