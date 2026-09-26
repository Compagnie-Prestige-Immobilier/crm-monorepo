import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire, marque } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const cle = marque();
const NOM = `KANTE${cle.toUpperCase()}`;
const PRENOM = 'Astou';
const DISTANT = `insc-${cle}`;

interface Compte {
  n: number;
}

// Le tirage interroge la plateforme CHUES, qui n'existe pas sur un poste de
// test : l'inscription est déposée dans le miroir comme le tirage le ferait,
// puis l'écran est jugé sur ce qu'il en fait.
test.beforeAll(async () => {
  await ecrire(
    `INSERT INTO inscriptions_plateforme
       (id, projet, "identifiantDistant", nom, prenom, "phoneE164", email, "statutDistant",
        "etapeDistante", "inscriteLe", "chargeUtile", "dernierTirageAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'CHUES', $1, $2, $3, '+221771234599', $4, 'COMPLETE',
             4, now(), '{}'::jsonb, now(), now())`,
    [DISTANT, NOM, PRENOM, `${DISTANT}@example.sn`],
  );
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM inscriptions_plateforme WHERE "identifiantDistant" = $1`, [DISTANT]);
});

test.describe('parcours enrôlement', () => {
  test.use({ storageState: administrateur.etat });

  test('une inscription lue se détaille, puis se retire de l’écran', async ({ page }) => {
    await page.goto('/admin/enrolement');
    // L'écran ouvre sur la synthèse : le miroir vit dans l'onglet du projet.
    await expect(
      page.getByText(/Adresse et jeton se règlent sur le serveur : prévenez l’équipe technique/u),
    ).toHaveCount(2);
    await page.getByRole('tab', { name: 'CHUES' }).click();
    await expect(page.getByRole('button', { name: 'Relire la plateforme' })).toBeDisabled();

    const ligne = page.getByRole('row').filter({ hasText: NOM });
    await expect(ligne).toBeVisible();
    // Une inscription non rapprochée le dit : c'est ce qui déclenche le travail
    // de l'équipe d'enrôlement.
    await expect(ligne).toContainText('Non rapproché');

    // `exact` : le bouton de retrait porte le même nom dans son libellé.
    await ligne.getByRole('button', { name: `${PRENOM} ${NOM}`, exact: true }).click();
    await expect(page.getByText(`${DISTANT}@example.sn`).first()).toBeVisible();
    await page.keyboard.press('Escape');

    await ligne.getByRole('button', { name: `Retirer ${PRENOM} ${NOM} de cet écran` }).click();
    await expect(page.getByText(/La plateforme n’est pas touchée/u)).toBeVisible();
    await page.getByRole('button', { name: 'Retirer', exact: true }).click();

    await expect(page.getByRole('row').filter({ hasText: NOM })).toBeHidden();
    // La ligne peut disparaître de l'écran avant que l'écriture ne soit arrivée :
    // c'est la base qui tranche, et elle se relit jusqu'à ce qu'elle réponde.
    await expect
      .poll(async () => {
        const restantes = await lire<Compte>(
          `SELECT count(*)::int AS n FROM inscriptions_plateforme WHERE "identifiantDistant" = $1`,
          [DISTANT],
        );
        return restantes[0]?.n;
      })
      .toBe(0);
  });
});
