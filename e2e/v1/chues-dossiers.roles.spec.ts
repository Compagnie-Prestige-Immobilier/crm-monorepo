import { expect, test, type Page } from '@playwright/test';

/**
 * Les écrans bancaires du projet CHUES sont fermés à trois rôles.
 *
 * CHU-DOS-01, CHU-DOSE-02, CHU-DOSX-03, CHU-BQ-04, CHU-DMC-02.
 *
 * Chaque cellule vaut DEUX assertions (§6.5 d'`E2E.md`) : le refus est lisible,
 * et aucune donnée métier n'a été chargée. La seconde distingue « l'écran
 * affiche un refus » de « l'écran a chargé les montants puis posé un refus
 * par-dessus » : c'est le défaut qui compte.
 *
 * La session se pose par `test.use` au niveau du `describe`, jamais par un
 * `browser.newContext()` : sous `trace: retain-on-failure`, un contexte créé à
 * la main écrit ses artefacts dans un dossier que le coureur vient de nettoyer,
 * et la fermeture échoue au hasard sur un `ENOENT` qui n'apprend rien.
 */

async function attendreRefus(
  page: Page,
  route: string,
  quoi: string,
  roleAffiche: string,
  familleApi: string,
): Promise<void> {
  // L'écouteur est posé AVANT le `goto` : une réponse arrivée pendant la
  // navigation ne doit pas échapper au relevé.
  const chargees: string[] = [];
  const releve = (reponse: { url: () => string; status: () => number }): void => {
    const chemin = new URL(reponse.url()).pathname;
    if (chemin.startsWith(familleApi) && reponse.status() < 400) chargees.push(chemin);
  };
  page.on('response', releve);

  try {
    await page.goto(route);

    const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
    await expect(
      refus.getByRole('heading', { name: 'Accès refusé', level: 2 }),
      `${route} devrait être refusé à ${roleAffiche}`,
    ).toBeVisible({ timeout: 30_000 });
    await expect(refus).toContainText(
      `${quoi} est réservé à un autre rôle. Rôle en cours : ${roleAffiche}.`,
    );
    await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
      'href',
      '/espaces',
    );

    expect(
      chargees,
      `${route} a chargé des données métier pour ${roleAffiche} : ${chargees.join(', ')}`,
    ).toHaveLength(0);
  } finally {
    page.off('response', releve);
  }
}

test.describe('session téléconseiller', () => {
  test.use({ storageState: 'v1/.auth/commercial.json' });

  test('CHU-DOS-01 · le suivi des dossiers est refusé au téléconseiller', async ({ page }) => {
    // La garde est `['ADMIN', 'BANQUE_FINANCE']` : élargie, un téléconseiller
    // lirait les montants encaissés.
    await attendreRefus(
      page,
      '/chues/dossiers',
      'Le suivi des dossiers bancaires',
      'Téléconseiller',
      '/api/v1/bank-cases',
    );
  });

  test('CHU-DOSX-03 · l’export des dossiers est refusé au téléconseiller', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/dossiers/export',
      'L’export des dossiers bancaires',
      'Téléconseiller',
      '/api/v1/bank-case-stages',
    );
  });

  test('CHU-BQ-04 · le tableau de bord bancaire est refusé au téléconseiller', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/banque',
      'Le tableau de bord bancaire',
      'Téléconseiller',
      '/api/v1/bank-cases',
    );
  });

  test('CHU-DMC-02 · le suivi des demandes est refusé au téléconseiller', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/demandes-clients',
      'Le suivi des demandes de création',
      'Téléconseiller',
      '/api/v1/client-requests',
    );
  });
});

test.describe('session supervision', () => {
  test.use({ storageState: 'v1/.auth/superviseur.json' });

  test('CHU-DOS-01 · le suivi des dossiers est refusé à la supervision', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/dossiers',
      'Le suivi des dossiers bancaires',
      'Supervision',
      '/api/v1/bank-cases',
    );
  });

  test('CHU-BQ-04 · le tableau de bord bancaire est refusé à la supervision', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/banque',
      'Le tableau de bord bancaire',
      'Supervision',
      '/api/v1/bank-cases',
    );
  });

  test('CHU-DMC-02 · le suivi des demandes est refusé à la supervision', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/demandes-clients',
      'Le suivi des demandes de création',
      'Supervision',
      '/api/v1/client-requests',
    );
  });
});

test.describe('session direction', () => {
  test.use({ storageState: 'v1/.auth/direction.json' });

  test('CHU-DMC-02 · le suivi des demandes est refusé à la direction', async ({ page }) => {
    await attendreRefus(
      page,
      '/chues/demandes-clients',
      'Le suivi des demandes de création',
      'Direction',
      '/api/v1/client-requests',
    );
  });
});

test.describe('session banque', () => {
  test.use({ storageState: 'v1/.auth/banque.json' });

  test('CHU-DOSE-02 · la configuration du flux est refusée à un agent bancaire', async ({
    page,
  }) => {
    // Une banque qui réordonnerait le flux le réordonnerait pour TOUTES les
    // banques : la garde est `['ADMIN']` seule.
    await attendreRefus(
      page,
      '/chues/dossiers/etapes',
      'La configuration du flux bancaire',
      'Banque & Finance',
      '/api/v1/bank-case-stages',
    );
  });
});
