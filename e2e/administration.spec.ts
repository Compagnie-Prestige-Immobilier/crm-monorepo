import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire, marque } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const cle = marque();
const NOM = `Recrue ${cle}`;
const VISITEUR = `VISITEUR ${cle.toUpperCase()}`;
const EMAIL = `recrue.${cle}@cpi.sn`;

interface CompteLu {
  isActive: boolean;
}

interface VisiteLue {
  archivee: boolean;
}

// Les formulaires de création sont déjà couverts par les tests d'intégration :
// ce parcours juge les ACTIONS des écrans d'administration, sur une donnée
// posée d'avance pour ne pas dépendre de leurs champs obligatoires.
test.beforeAll(async () => {
  await ecrire(
    `INSERT INTO "users" ("id","email","username","passwordHash","fullName","role","updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'x', $3, 'COMMERCIAL', now())`,
    [EMAIL, `recrue.${cle}`, NOM],
  );
  await ecrire(
    `INSERT INTO "visites" ("id","reference","visitedAt","timeKnown","visitorName",
                            "entrepriseId","objetId","createdById","updatedAt")
     SELECT gen_random_uuid()::text, $1, now(), true, $2,
            (SELECT "id" FROM "visite_entreprises" ORDER BY "sortOrder" LIMIT 1),
            (SELECT "id" FROM "visite_objets" ORDER BY "sortOrder" LIMIT 1),
            (SELECT "id" FROM "users" WHERE "email" = $3), now()`,
    [`V-2026-${cle.slice(0, 6)}`, VISITEUR, EMAIL],
  );
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM "visites" WHERE "visitorName" = $1`, [VISITEUR]);
  await ecrire(`DELETE FROM "users" WHERE "email" = $1`, [EMAIL]);
});

test.describe('parcours administration', () => {
  test.use({ storageState: administrateur.etat });

  test('un compte se ferme sans disparaître', async ({ page }) => {
    await page.goto('/admin/commerciaux');
    // La liste est paginée : un compte neuf ne tombe pas forcément en première
    // page, et c'est par la recherche qu'un administrateur le retrouve.
    await page.getByPlaceholder('Nom, e-mail, identifiant…').fill(NOM);
    const ligne = page.getByRole('row').filter({ hasText: NOM });
    await expect(ligne).toBeVisible();

    // Un compte se ferme, il ne s'efface pas : des fiches le citent comme auteur.
    await ligne.getByRole('button', { name: `Actions pour ${NOM}` }).click();
    await page.getByRole('menuitem', { name: 'Désactiver le compte' }).click();
    await page.getByRole('button', { name: 'Désactiver le compte' }).click();

    await expect(page.getByRole('row').filter({ hasText: NOM })).toBeVisible();
    const comptes = await lire<CompteLu>(`SELECT "isActive" FROM "users" WHERE "email" = $1`, [
      EMAIL,
    ]);
    expect(comptes[0]?.isActive).toBe(false);
  });

  test('une visite du registre s’archive et sort du jour', async ({ page }) => {
    await page.goto('/accueil');
    const ligne = page.getByRole('row').filter({ hasText: VISITEUR });
    await expect(ligne).toBeVisible();

    await ligne.getByRole('button', { name: `Archiver la visite de ${VISITEUR}` }).click();
    await page.getByRole('button', { name: 'Archiver', exact: true }).click();
    await expect(page.getByText('Visite archivée. Elle sort du registre.')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: VISITEUR })).toBeHidden();

    // Archivée, pas détruite : seule la direction peut la faire disparaître.
    const visites = await lire<VisiteLue>(
      `SELECT "deletedAt" IS NOT NULL AS archivee FROM "visites" WHERE "visitorName" = $1`,
      [VISITEUR],
    );
    expect(visites[0]?.archivee).toBe(true);
  });
});
