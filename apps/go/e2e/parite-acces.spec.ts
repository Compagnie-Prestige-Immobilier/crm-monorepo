import { expect, test, type Browser, type Page } from '@playwright/test';

import { avecBase, compteDe, MOT_DE_PASSE, ROLES, type Compte, type RoleCompte } from './comptes';

/** `ROLE_LABELS` de `web/src/lib/types.ts` : ce que le refus nomme a l'ecran. */
const LIBELLE: Record<RoleCompte, string> = {
  ADMIN: 'Administrateur',
  COMMERCIAL: 'Téléconseiller',
  BANQUE_FINANCE: 'Banque & Finance',
  SUPERVISEUR: 'Supervision',
  DIRECTION: 'Direction',
  ACCUEIL: 'Accueil',
  CHARGE_CLIENTELE: 'Chargé de clientèle',
};

/** `web/src/lib/roles.ts`, reecrit ici : c'est le contrat que la garde doit tenir. */
const ADMIN_SEUL: readonly RoleCompte[] = ['ADMIN'];
const PILOTAGE: readonly RoleCompte[] = ['ADMIN', 'SUPERVISEUR', 'DIRECTION'];
const BANQUE: readonly RoleCompte[] = ['ADMIN', 'BANQUE_FINANCE'];
const TELECONSEIL: readonly RoleCompte[] = ['COMMERCIAL', 'CHARGE_CLIENTELE'];
const APPELANTS: readonly RoleCompte[] = ['ADMIN', ...TELECONSEIL, 'SUPERVISEUR', 'DIRECTION'];
const SAISIE_GRAND_PUBLIC: readonly RoleCompte[] = ['ADMIN', ...TELECONSEIL];
const ACCUEIL_LECTURE: readonly RoleCompte[] = ['ADMIN', 'DIRECTION', 'ACCUEIL'];
const ACCUEIL_ADMINISTRATION: readonly RoleCompte[] = ['ADMIN', 'DIRECTION'];

/** Un ecran par famille de garde : le balayage entier n'apprendrait rien de plus. */
const ECRANS: readonly { route: string; ouverte: readonly RoleCompte[] }[] = [
  { route: '/accueil', ouverte: ACCUEIL_LECTURE },
  { route: '/accueil/listes', ouverte: ACCUEIL_ADMINISTRATION },
  { route: '/admin/commerciaux', ouverte: ADMIN_SEUL },
  { route: '/admin/referentiels', ouverte: PILOTAGE },
  { route: '/chues/statistiques', ouverte: PILOTAGE },
  { route: '/chues/prospects', ouverte: APPELANTS },
  { route: '/chues/dossiers', ouverte: BANQUE },
  { route: '/chues/representants/import', ouverte: ADMIN_SEUL },
  { route: '/grand-public/console', ouverte: SAISIE_GRAND_PUBLIC },
];

/** La coque appelle ces trois-la sur tout ecran, refus compris : ni donnee, ni fuite. */
const HORS_METIER = ['/api/v1/auth/', '/api/v1/live', '/api/v1/presence/beat'];

const CLOCHE = /^Notifications(, \d+ non lues?)?$/;

async function seConnecter(page: Page, compte: Compte): Promise<void> {
  await page.getByLabel('E-mail ou identifiant').fill(compte.email);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Les appels metier aboutis, releves depuis AVANT la navigation. */
function surveillerMetier(page: Page): string[] {
  const chemins: string[] = [];
  page.on('response', (reponse) => {
    const { pathname } = new URL(reponse.url());
    if (!pathname.startsWith('/api/v1/') || reponse.status() >= 400) return;
    if (!HORS_METIER.some((hors) => pathname.startsWith(hors))) chemins.push(pathname);
  });
  return chemins;
}

async function attendreRefus(page: Page, role: RoleCompte, route: string): Promise<void> {
  const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
  await expect(
    refus.getByRole('heading', { name: 'Accès refusé', level: 2 }),
    `${route} devrait être refusé à ${role}`,
  ).toBeVisible();
  await expect(refus, `${route} : le refus devrait nommer le rôle en cours`).toContainText(
    `Rôle en cours : ${LIBELLE[role]}.`,
  );
  await expect(
    refus.getByRole('link', { name: 'Retour à l’accueil', exact: true }),
    `${route} : le refus devrait offrir une sortie vers le hub`,
  ).toHaveAttribute('href', '/espaces');
}

async function pageDe(browser: Browser, role: RoleCompte): Promise<Page> {
  const contexte = await browser.newContext({ storageState: compteDe(role).etat });
  return contexte.newPage();
}

async function sessionsVivantes(compteId: string): Promise<number> {
  let vivantes = 0;
  await avecBase(async (client) => {
    const { rows } = await client.query<{ n: string }>(
      'SELECT count(*) AS n FROM refresh_tokens WHERE "userId" = $1 AND "revokedAt" IS NULL',
      [compteId],
    );
    vivantes = Number(rows[0]?.n ?? 0);
  });
  return vivantes;
}

test.describe('parité accès, la connexion, la session et ses destinations', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.40' } });

  const compte = compteDe('SUPERVISEUR');

  test('un champ vide ou un mot de passe court n’atteint jamais le serveur', async ({ page }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      if (new URL(requete.url()).pathname === '/api/v1/auth/login') envois.push(requete.method());
    });

    await page.goto('/connexion');
    await page.getByLabel('Mot de passe').fill('court');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.locator('#identifier-error')).toHaveText(
      'E-mail ou identifiant obligatoire.',
    );
    await expect(page.locator('#password-error')).toHaveText(
      'Le mot de passe compte au moins 8 caractères.',
    );
    await expect(page.getByLabel('E-mail ou identifiant')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/connexion$/);
    expect(envois, 'le budget de dix connexions par minute ne doit pas être brûlé').toEqual([]);
  });

  test('la destination demandée est tenue, la déconnexion la reverrouille', async ({
    page,
    context,
  }) => {
    const avant = await sessionsVivantes(compte.id);

    await page.goto('/connexion?next=%2Fchues%2Frappels');
    await seConnecter(page, compte);

    await expect(page).toHaveURL(/\/chues\/rappels$/);
    await expect(page.getByRole('heading', { name: 'Rappels promis', level: 1 })).toBeVisible();
    expect(
      await sessionsVivantes(compte.id),
      'la connexion doit écrire une session vivante en base',
    ).toBe(avant + 1);

    const cookies = (await context.cookies()).filter(
      (cookie) => cookie.name === '__Host-cpi_session',
    );
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.httpOnly, 'une XSS suffirait à voler la session').toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('cpi_session');

    await page.getByRole('button', { name: `Compte de ${compte.nom}` }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    const reste = (await context.cookies()).find((cookie) => cookie.name === '__Host-cpi_session');
    expect(reste?.value ?? '', 'la déconnexion doit vider le cookie de session').toBe('');
    expect(
      await sessionsVivantes(compte.id),
      'la déconnexion doit révoquer la session en base, pas seulement le cookie',
    ).toBe(avant);

    await page.goto('/chues/rappels');
    await expect(page).toHaveURL(/\/connexion\?next=%2Fchues%2Frappels$/);
    await expect(page.getByRole('heading', { name: 'Rappels promis' })).toHaveCount(0);
  });

  test('une destination hostile, « //ailleurs » ou « /\\ailleurs », reste sur l’origine', async ({
    page,
  }) => {
    const visitees: string[] = [];
    page.on('framenavigated', (cadre) => {
      if (cadre === page.mainFrame()) visitees.push(cadre.url());
    });

    await page.goto('/connexion?next=%2F%2Fevil.example.com');
    await seConnecter(page, compteDe('ACCUEIL'));
    await expect(page.getByRole('heading', { name: 'Vos espaces', level: 1 })).toBeVisible();

    await page.goto('/espaces?retour=%2F%5Cevil.example.com');
    await expect(page.getByRole('heading', { name: 'Vos espaces', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Revenir' }).click();
    await expect(page.getByRole('heading', { name: 'Page introuvable', level: 2 })).toBeVisible();

    const hors = visitees.filter(
      (url) => url !== 'about:blank' && !url.startsWith('http://localhost:4004/'),
    );
    expect(hors, 'le panneau ne doit jamais servir de tremplin de redirection').toEqual([]);
  });
});

test.describe('parité accès, les écarts de la v2 sur la session', () => {
  test.fixme('rouvrir /connexion avec une session ouverte : le formulaire est rendu au lieu du hub, `routes/connexion.tsx` n’a aucun `beforeLoad` (v1 ACC-CNX-10)', () => {});
  test.fixme('atterrir sur /connexion après expiration : rien n’annonce pourquoi, la v1 posait `?session=expiree` et disait « Session expirée. Reconnectez-vous. » (v1 ACC-CNX-07)', () => {});
  test.fixme('ouvrir /espaces?retour=/espaces : le hub propose « Revenir » vers lui-même, `cheminInterne` accepte toute adresse interne (v1 ACC-HUB-02)', () => {});
});

test('hors session, chaque adresse du panneau renvoie sur la connexion sans rien laisser voir', async ({
  page,
}) => {
  for (const route of ['/accueil', '/chues/prospects', '/admin/commerciaux', '/notifications']) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/connexion\\?next=${encodeURIComponent(route)}$`));
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
      `${route} a monté la coque avant de renvoyer`,
    ).toHaveCount(0);
  }
});

test.describe('parité redirections, les anciennes adresses et les inconnues', () => {
  test.use({ storageState: compteDe('ADMIN').etat });

  test('une ancienne adresse arrive filtrée, deux niveaux plus bas comprise', async ({ page }) => {
    await page.goto('/prospects?statut=NOUVEAU&page=2');
    await expect(page).toHaveURL(/\/chues\/prospects\?/);
    const arrivee = new URL(page.url());
    expect(arrivee.searchParams.get('statut'), 'l’URL EST l’état du tableau').toBe('NOUVEAU');
    expect(arrivee.searchParams.get('page')).toBe('2');
    await expect(page.getByRole('heading', { name: 'Prospects', level: 1 })).toBeVisible();

    await page.goto('/referentiels/issues-appel');
    await expect(page).toHaveURL(/\/admin\/referentiels\/issues-appel$/);
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
  });

  test('les deux anciens tableaux de bord renvoient en permanence sur les chiffres', async ({
    page,
  }) => {
    for (const projet of ['chues', 'grand-public']) {
      await page.goto(`/${projet}/tableau-de-bord`);
      await expect(page).toHaveURL(new RegExp(`/${projet}/statistiques$`));
      await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
    }
  });

  test('une adresse qui n’a jamais existé reste introuvable au lieu d’être absorbée', async ({
    page,
  }) => {
    for (const inconnue of ['/comptabilite', '/accueils', '/admin/inexistant/profond']) {
      await page.goto(inconnue);
      await expect(
        page.getByRole('heading', { name: 'Page introuvable', level: 2 }),
        `${inconnue} a été absorbée par un segment dynamique`,
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Retour à l’accueil', exact: true }),
      ).toHaveAttribute('href', '/espaces');
    }
  });
});

test.describe('parité rôles, le refus est lisible et rien ne se charge', () => {
  for (const role of ROLES) {
    const refusees = ECRANS.filter((ecran) => !ecran.ouverte.includes(role));
    if (refusees.length === 0) continue;

    test(`aucune adresse interdite ne s’ouvre à ${role}`, async ({ browser }) => {
      test.slow();
      const page = await pageDe(browser, role);
      const metier = surveillerMetier(page);

      for (const { route } of refusees) {
        metier.length = 0;
        await page.goto(route);
        await attendreRefus(page, role, route);
        expect(metier, `${route} a chargé des données métier malgré le refus à ${role}`).toEqual(
          [],
        );
      }

      await page.context().close();
    });
  }

  test('aucun écran ne se referme sur l’administrateur', async ({ browser }) => {
    test.slow();
    const page = await pageDe(browser, 'ADMIN');

    for (const { route } of ECRANS) {
      await page.goto(route);
      const titre = page.getByRole('banner').getByRole('heading', { level: 1 });
      await expect(titre, `${route} : la barre supérieure n’a pas été rendue`).toBeVisible();
      await expect(titre, `${route} ne correspond à aucune entrée de navigation`).not.toHaveText(
        'CPI GO',
      );
      await expect(
        page.getByRole('heading', { name: 'Accès refusé', level: 2 }),
        `${route} ne devrait pas être refusé à un administrateur`,
      ).toHaveCount(0);
    }

    await page.context().close();
  });

  test('un agent Banque & Finance est renvoyé de /chues vers son tableau de bord', async ({
    browser,
  }) => {
    const page = await pageDe(browser, 'BANQUE_FINANCE');
    await page.goto('/chues');

    await expect(page).toHaveURL(/\/chues\/banque$/);
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
    await page.context().close();
  });

  test.fixme('ouvrir /admin/notifications avec un rôle à boîte : la v2 rend « Accès refusé » sur place là où la v1 renvoyait vers /notifications, et des notifications en base portent ce chemin (v1 ROL-23)', () => {});
});

test.describe('parité notifications, la cloche et la boîte', () => {
  test('un rôle à boîte n’y trouve ni envois ni composition', async ({ browser }) => {
    const page = await pageDe(browser, 'SUPERVISEUR');
    await page.goto('/notifications');

    await expect(page.getByRole('group', { name: 'Filtrer la boîte de réception' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Envois' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nouvelle notification' })).toHaveCount(0);
    await page.context().close();
  });

  test('un teleconseiller n’a ni boîte ni cloche, et rien n’est lu pour lui', async ({
    browser,
  }) => {
    const page = await pageDe(browser, 'COMMERCIAL');
    const metier = surveillerMetier(page);

    await page.goto('/notifications');
    await attendreRefus(page, 'COMMERCIAL', '/notifications');
    expect(
      metier.filter((chemin) => chemin.startsWith('/api/v1/notifications')),
      'aucune notification ne doit être lue pour un rôle qui n’a pas de boîte',
    ).toEqual([]);

    await page.goto('/chues');
    await expect(
      page.getByRole('banner').getByRole('button', { name: CLOCHE }),
      'un teleconseiller sans boîte ne doit pas porter de cloche',
    ).toHaveCount(0);
    await page.context().close();
  });

  for (const [role, boite] of [
    ['ADMIN', '/admin/notifications?onglet=reception'],
    ['DIRECTION', '/notifications'],
    ['SUPERVISEUR', '/notifications'],
    ['BANQUE_FINANCE', '/notifications'],
    ['ACCUEIL', '/notifications'],
  ] as const) {
    test(`la cloche de ${role} mène à sa boîte`, async ({ browser }) => {
      const page = await pageDe(browser, role);
      await page.goto(role === 'ADMIN' ? '/admin/notifications' : '/notifications');

      const cloche = page.getByRole('banner').getByRole('button', { name: CLOCHE });
      await expect(cloche, `${role} devrait porter exactement une cloche`).toHaveCount(1);

      await cloche.click();
      await expect(
        page.getByRole('link', { name: 'Tout voir' }),
        `la cloche de ${role} devrait mener à ${boite}`,
      ).toHaveAttribute('href', boite);
      await page.context().close();
    });
  }
});

test.describe('parité mobile, le panneau à 390 px', () => {
  test.use({
    storageState: compteDe('ADMIN').etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('le hub et un écran de gestion tiennent dans l’écran, tiroir compris', async ({ page }) => {
    for (const route of ['/espaces', '/admin/commerciaux']) {
      await page.goto(route);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(debord, `${route} déborde de ${String(debord)} px`).toBeLessThanOrEqual(1);
    }

    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
      'la barre latérale ne doit pas tenir l’écran d’un téléphone',
    ).toBeHidden();

    const titre = page.getByRole('banner').getByRole('heading', { level: 1 });
    await expect(titre).toHaveText('Utilisateurs');
    const cadreTitre = await titre.boundingBox();
    const cadreCompte = await page.getByRole('button', { name: /^Compte de / }).boundingBox();
    if (cadreTitre === null || cadreCompte === null) throw new Error('barre supérieure non rendue');
    expect(
      cadreTitre.x + cadreTitre.width,
      'le titre de la barre supérieure passe sous les actions',
    ).toBeLessThanOrEqual(cadreCompte.x + 1);

    await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();
    const tiroir = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(tiroir).toBeVisible();
    await tiroir.getByRole('link', { name: 'Paramètres', exact: true }).click();
    await expect(tiroir).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/parametres$/);
  });
});
