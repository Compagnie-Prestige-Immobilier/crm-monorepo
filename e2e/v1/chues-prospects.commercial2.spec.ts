import { expect, request, test, type APIResponse } from '@playwright/test';

/**
 * `/chues/prospects` vu par le SECOND téléconseiller (`fixture.fatou@cpi.sn`).
 * CHU-PRO-02 : un téléconseiller ne voit que son périmètre.
 *
 * Lecture seule : ce fichier ne crée, ne modifie et ne supprime rien. La fiche
 * `E2E-CHUES-PRO` dont Awa est propriétaire est posée par
 * `chues-prospects.commercial.spec.ts`, qui doit donc être passé avant. Sa
 * présence est EXIGÉE ici : sans elle, « la ligne n'apparaît pas » serait vrai
 * pour la mauvaise raison, et le scénario ne prouverait rien.
 */
test.use({ storageState: 'v1/.auth/commercial2.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

const FICHE_AWA = { nom: 'E2E-CHUES-PRO Awa Un', phone: '+221781004401' } as const;

async function json<T>(response: APIResponse): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

test.beforeAll(async () => {
  const awa = await request.newContext({
    baseURL: WEB_URL,
    storageState: 'v1/.auth/commercial.json',
  });
  try {
    const found = await json<{ items: { phoneE164: string; ownedByCommercialName: string }[] }>(
      await awa.get('/api/v1/prospects', { params: { search: FICHE_AWA.phone, pageSize: '10' } }),
    );
    const fiche = found.items.find((row) => row.phoneE164 === FICHE_AWA.phone);
    expect(
      fiche,
      `Précondition absente : la fiche ${FICHE_AWA.nom} doit exister, posée par chues-prospects.commercial.spec.ts`,
    ).toBeDefined();
  } finally {
    await awa.dispose();
  }
});

test('CHU-PRO-02 un téléconseiller ne voit que son périmètre', async ({ page }) => {
  await page.goto('/chues/prospects');
  await page.getByRole('textbox', { name: 'Recherche', exact: true }).fill(FICHE_AWA.nom);

  // Le décompte D'ABORD : il vient de la même requête que le tableau et se
  // stabilise avec lui, là où un « zéro ligne » serait vrai le temps d'un
  // rendu intermédiaire.
  await expect(
    page.getByRole('status').filter({ hasText: 'Prospects affichés' }),
    `${FICHE_AWA.nom} appartient à Awa : Fatou ne doit rien trouver`,
  ).toHaveText(/^Prospects affichés\s*:\s*Aucun résultat$/u);

  // `scope.ts` doit borner la liste : le portefeuille d'un collègue ne se lit
  // pas depuis le compte d'un autre téléconseiller.
  await expect(
    page.getByRole('table').getByRole('row').filter({ hasText: FICHE_AWA.nom }),
  ).toHaveCount(0);
});
