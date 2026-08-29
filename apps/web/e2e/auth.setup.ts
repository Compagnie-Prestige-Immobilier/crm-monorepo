import { expect, request, test as setup } from '@playwright/test';

/**
 * Une session par rôle, posée une seule fois et rangée sur disque.
 *
 * L'API limite les connexions à 10 par minute et par IP. Un état encore
 * valide est réutilisé tel quel : plusieurs suites lancées à la suite ou en
 * parallèle ne dépensent aucune connexion.
 */

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const ADMIN_IDENTIFIER = process.env.E2E_ADMIN_IDENTIFIER ?? 'admin@cpi.sn';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMoiEnProd2026';
const FIXTURE_PASSWORD = process.env.SEED_FIXTURE_PASSWORD ?? 'ChangeMoi123456';

export const STORAGE_STATE = 'e2e/.auth/admin.json';

export const SESSIONS = {
  admin: { identifier: ADMIN_IDENTIFIER, password: ADMIN_PASSWORD, path: STORAGE_STATE },
  accueil: { identifier: 'fixture.accueil@cpi.sn', password: FIXTURE_PASSWORD, path: 'e2e/.auth/accueil.json' },
  superviseur: { identifier: 'fixture.superviseur@cpi.sn', password: FIXTURE_PASSWORD, path: 'e2e/.auth/superviseur.json' },
  direction: { identifier: 'fixture.direction@cpi.sn', password: FIXTURE_PASSWORD, path: 'e2e/.auth/direction.json' },
  commercial: { identifier: 'fixture.awa@cpi.sn', password: FIXTURE_PASSWORD, path: 'e2e/.auth/commercial.json' },
  commercial2: { identifier: 'fixture.fatou@cpi.sn', password: FIXTURE_PASSWORD, path: 'e2e/.auth/commercial2.json' },
  banque: { identifier: 'fixture.banque@cpi.sn', password: FIXTURE_PASSWORD, path: 'e2e/.auth/banque.json' },
} as const;

export type SessionRole = keyof typeof SESSIONS;

async function sessionStillValid(path: string): Promise<boolean> {
  const api = await request.newContext({ baseURL: WEB_URL, storageState: path }).catch(() => null);
  if (api === null) return false;
  try {
    const response = await api.get('/api/v1/auth/me');
    return response.ok();
  } catch {
    return false;
  } finally {
    await api.dispose();
  }
}

for (const [role, session] of Object.entries(SESSIONS)) {
  setup(`authentifier ${role}`, async ({ page }) => {
    if (await sessionStillValid(session.path)) return;

    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(session.identifier);
    await page.getByLabel('Mot de passe').fill(session.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await page.waitForURL('**/espaces');
    await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();

    await page.context().storageState({ path: session.path });
  });
}
