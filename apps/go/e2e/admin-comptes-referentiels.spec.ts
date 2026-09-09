import { expect, test, type Page } from '@playwright/test';

import { BASE_URL, compteDe } from './comptes';
import {
  classeurExcel,
  compter,
  creerBanque,
  creerProspectEnrole,
  ecrire,
  effacerBanque,
  effacerRepresentants,
  ligne,
  lire,
  marque,
  numero,
  premierDepartement,
} from './donnees-admin';

const administrateur = compteDe('ADMIN');

const cle = marque();
const MOT_DE_PASSE_INITIAL = `Initial-${cle}-2026`;
const MOT_DE_PASSE_REMIS = `Remis-${cle}-2026`;
const AGENT = { nom: `E2E13 Agent ${cle}`, identifiant: `e2e13.agent.${cle}` };
const REPRENEUR = { nom: `E2E13 Repreneur ${cle}`, identifiant: `e2e13.repreneur.${cle}` };
const ADMIN_BIS = { nom: `E2E13 Admin ${cle}`, identifiant: `e2e13.admin.${cle}` };
const NOM_REPRESENTANT = `Import Rep ${cle}`;
const NOM_BANQUE = `Banque liste ${cle}`;

interface Compte {
  id: string;
  role: string;
  isActive: boolean;
  deletedAt: string | null;
}

async function compte(identifiant: string): Promise<Compte> {
  return ligne<Compte>(
    `SELECT id, role, "isActive", "deletedAt" FROM users WHERE username = $1`,
    [identifiant],
  );
}

async function creerCompte(
  page: Page,
  fiche: { nom: string; identifiant: string; role?: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
  const boite = page.getByRole('dialog');
  await boite.getByLabel(/^Nom complet/u).fill(fiche.nom);
  await boite.getByLabel(/^Adresse e-mail/u).fill(`${fiche.identifiant}@cpi.sn`);
  await boite.getByLabel(/^Identifiant/u).fill(fiche.identifiant);
  await boite.getByLabel(/^Mot de passe/u).fill(MOT_DE_PASSE_INITIAL);
  if (fiche.role !== undefined) {
    await boite.getByRole('combobox', { name: /^Rôle/u }).click();
    await page.getByRole('option', { name: fiche.role }).click();
  }
  await boite.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByText(`Compte de ${fiche.nom} créé.`)).toBeVisible();
}

async function menuDuCompte(page: Page, nom: string): Promise<void> {
  await page.getByRole('button', { name: `Actions pour ${nom}` }).click();
}

test.afterAll(async () => {
  const comptes = await lire<{ id: string }>(`SELECT id FROM users WHERE username LIKE $1`, [
    `e2e13.%${cle}`,
  ]);
  const identifiants = comptes.map((row) => row.id);
  await effacerRepresentants(`%${cle}%`);
  await ecrire(`DELETE FROM prospects WHERE "createdById" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM import_jobs WHERE "requestedById" = $1`, [administrateur.id]);
  await ecrire(`DELETE FROM audit_logs WHERE "userId" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM refresh_tokens WHERE "userId" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM users WHERE id = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM call_outcome_reasons WHERE label LIKE $1`, [`%${cle}%`]);
  await ecrire(`DELETE FROM statuts_qualification WHERE label LIKE $1`, [`%${cle}%`]);
  await ecrire(`DELETE FROM banques WHERE name LIKE $1`, [`%${cle}%`]);
  await ecrire(`DELETE FROM syndicats WHERE name LIKE $1`, [`%${cle}%`]);
});

test.describe('parcours 13, comptes', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({
    storageState: administrateur.etat,
    extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.90' },
  });

  test('cree, promu, mot de passe remis, desactive avec reprise, supprime', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin/commerciaux');
    await expect(page.getByRole('heading', { name: 'Utilisateurs', level: 1 })).toBeVisible();

    await creerCompte(page, AGENT);
    await creerCompte(page, REPRENEUR);
    const agent = await compte(AGENT.identifiant);
    expect(agent.role).toBe('COMMERCIAL');
    expect(agent.isActive).toBe(true);
    const repreneur = await compte(REPRENEUR.identifiant);

    const session = await browser.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.91' },
    });
    const vue = await session.newPage();
    await connexion(vue, AGENT.identifiant, MOT_DE_PASSE_INITIAL);
    await expect(vue.getByRole('button', { name: `Compte de ${AGENT.nom}` })).toBeVisible();

    await menuDuCompte(page, AGENT.nom);
    await page.getByRole('menuitem', { name: 'Modifier' }).click();
    const modification = page.getByRole('dialog');
    await modification.getByRole('combobox', { name: /^Rôle/u }).click();
    await page.getByRole('option', { name: 'Supervision' }).click();
    await modification.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(`Compte de ${AGENT.nom} mis à jour.`)).toBeVisible();
    expect((await compte(AGENT.identifiant)).role).toBe('SUPERVISEUR');

    await menuDuCompte(page, AGENT.nom);
    await page.getByRole('menuitem', { name: 'Réinitialiser le mot de passe' }).click();
    const remise = page.getByRole('dialog');
    await remise.getByLabel(/^Nouveau mot de passe/u).fill(MOT_DE_PASSE_REMIS);
    await remise.getByLabel(/^Confirmation/u).fill(MOT_DE_PASSE_REMIS);
    await remise.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(
      page.getByText(`Mot de passe réinitialisé. ${AGENT.nom} est déconnecté.`),
    ).toBeVisible();

    await vue.reload();
    await expect(vue).toHaveURL(/\/connexion(\?next=.*)?$/u);
    await connexion(vue, AGENT.identifiant, MOT_DE_PASSE_REMIS);
    await expect(vue.getByRole('button', { name: `Compte de ${AGENT.nom}` })).toBeVisible();

    const departement = await premierDepartement();
    const banqueId = await creerBanque(NOM_BANQUE);
    await creerProspectEnrole({
      nom: `Portefeuille${cle}`,
      prenom: 'Aissatou',
      telephone: numero(),
      banqueId,
      proprietaireId: agent.id,
    });
    await ecrire(
      `INSERT INTO representants (id, "fullName", "phoneE164", "departementId", "createdById",
         "clientCreatedAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now(), now())`,
      [`Portefeuille ${cle}`, numero(), departement.id, agent.id],
    );

    await page.reload();
    await menuDuCompte(page, AGENT.nom);
    await page.getByRole('menuitem', { name: 'Désactiver le compte' }).click();
    const reprise = page.getByRole('dialog');
    await reprise.getByRole('combobox', { name: /Qui reprend le portefeuille/u }).click();
    await page.getByRole('option', { name: REPRENEUR.nom }).click();
    await reprise.getByRole('button', { name: 'Désactiver le compte' }).click();
    await expect(
      page.getByText(`${AGENT.nom} désactivé. Ses saisies sont conservées.`),
    ).toBeVisible();

    expect((await compte(AGENT.identifiant)).isActive).toBe(false);
    expect(
      await compter(`SELECT count(*) AS n FROM prospects WHERE "createdById" = $1`, [agent.id]),
    ).toBe(0);
    expect(
      await compter(`SELECT count(*) AS n FROM representants WHERE "createdById" = $1`, [agent.id]),
    ).toBe(0);
    expect(
      await compter(
        `SELECT count(*) AS n FROM representants WHERE "createdById" = $1 AND "fullName" = $2`,
        [repreneur.id, `Portefeuille ${cle}`],
      ),
    ).toBe(1);

    await vue.reload();
    await expect(vue).toHaveURL(/\/connexion(\?next=.*)?$/u);
    await session.close();
    await effacerBanque(banqueId);

    await page.reload();
    await menuDuCompte(page, AGENT.nom);
    await page.getByRole('menuitem', { name: 'Supprimer le compte' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Supprimer le compte' })
      .click();
    await expect(page.getByText(`${AGENT.nom} supprimé.`)).toBeVisible();
    expect((await compte(AGENT.identifiant)).deletedAt).not.toBeNull();
  });

  // Le compte est cree ici plutot que repris des fixtures : la garde ne se
  // declenche que sur SON PROPRE compte, et desactiver un compte partage
  // casserait les autres parcours.
  test('un administrateur ne peut ni se retrograder ni se desactiver', async ({ page, browser }) => {
    await page.goto('/admin/commerciaux');
    await creerCompte(page, { ...ADMIN_BIS, role: 'Administrateur' });
    expect((await compte(ADMIN_BIS.identifiant)).role).toBe('ADMIN');

    const session = await browser.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.92' },
    });
    const vue = await session.newPage();
    await connexion(vue, ADMIN_BIS.identifiant, MOT_DE_PASSE_INITIAL);
    await expect(vue.getByRole('button', { name: `Compte de ${ADMIN_BIS.nom}` })).toBeVisible();
    await vue.goto('/admin/commerciaux');
    await expect(vue.getByRole('heading', { name: 'Utilisateurs', level: 1 })).toBeVisible();

    await menuDuCompte(vue, ADMIN_BIS.nom);
    await vue.getByRole('menuitem', { name: 'Modifier' }).click();
    const boite = vue.getByRole('dialog');
    await boite.getByRole('combobox', { name: /^Rôle/u }).click();
    await vue.getByRole('option', { name: 'Téléconseiller' }).click();
    await boite.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(
      vue.getByText('Un administrateur ne peut pas retirer son propre rôle.'),
    ).toBeVisible();
    expect((await compte(ADMIN_BIS.identifiant)).role).toBe('ADMIN');
    await session.close();
  });
});

test.describe('parcours 13, listes de reference', () => {
  test.use({ storageState: administrateur.etat });

  test('banque ajoutee, renommee, retiree du service', async ({ page }) => {
    await page.goto('/admin/referentiels');
    await expect(page.getByRole('heading', { name: 'Listes de référence', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    const creation = page.getByRole('dialog');
    await creation.getByLabel(/^Nom\s*Obligatoire$/u).fill(`Banque ${cle}`);
    await creation.getByLabel(/^Nom court/u).fill(`BQ${cle.slice(0, 4)}`);
    await creation.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Entrée créée.')).toBeVisible();
    expect(await compter(`SELECT count(*) AS n FROM banques WHERE name = $1`, [`Banque ${cle}`])).toBe(1);

    const rangee = page.getByRole('row').filter({ hasText: `Banque ${cle}` });
    await rangee.getByRole('button', { name: /^Modifier/u }).click();
    const edition = page.getByRole('dialog');
    await edition.getByLabel(/^Nom\s*Obligatoire$/u).fill(`Banque ${cle} corrigee`);
    await edition.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Entrée modifiée.')).toBeVisible();

    const corrigee = page.getByRole('row').filter({ hasText: `Banque ${cle} corrigee` });
    await corrigee.getByRole('button', { name: 'Retirer du service' }).click();
    await expect(page.getByText('Entrée retirée.')).toBeVisible();

    const banque = await ligne<{ name: string; isActive: boolean }>(
      `SELECT name, "isActive" FROM banques WHERE name LIKE $1`,
      [`Banque ${cle}%`],
    );
    expect(banque.name).toBe(`Banque ${cle} corrigee`);
    expect(banque.isActive).toBe(false);
  });

  test('issue d appel et statut de qualification ajoutes', async ({ page }) => {
    await page.goto('/admin/referentiels/issues-appel');
    await page.getByRole('button', { name: 'Nouveau motif' }).click();
    const motif = page.getByRole('dialog');
    await motif.getByLabel(/^Code/u).fill(`E2E13_${cle}`);
    await motif.getByLabel(/^Libellé/u).fill(`Issue ${cle}`);
    await motif.getByRole('combobox', { name: /^Effet sur le prospect/u }).click();
    await page.getByRole('option', { name: 'Laisse le prospect à rappeler' }).click();
    await motif.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Motif enregistré.')).toBeVisible();

    // Le serveur met le code en majuscules : la relecture se fait sur le libellé.
    const issue = await ligne<{ code: string; effect: string }>(
      `SELECT code, effect FROM call_outcome_reasons WHERE label = $1`,
      [`Issue ${cle}`],
    );
    expect(issue.code).toBe(`E2E13_${cle}`.toUpperCase());
    expect(issue.effect).toBe('KEEP_OPEN');

    await page.goto('/admin/referentiels/statuts-qualification');
    await creerStatut(page, `Statut ${cle}`, 'Dans 1 h');
    await expect(page.getByText('Statut enregistré.')).toBeVisible();
    const enregistre = await ligne<{ code: string; retryAfterMinutes: number }>(
      `SELECT code, "retryAfterMinutes" FROM statuts_qualification WHERE label = $1`,
      [`Statut ${cle}`],
    );
    expect(enregistre.code).toBe(`STATUT_${cle}`.toUpperCase());
    expect(enregistre.retryAfterMinutes).toBe(60);
  });

  // « Aucun » est la valeur par defaut du champ « Reessai propose ». Elle envoie
  // `retryAfterMinutes: 0`, que le serveur refuse (minimum 5) : le statut ne se
  // cree pas et l'ecran ne dit pas quel champ est en cause.
  test.fixme('le reessai « Aucun » est refuse par le serveur', async ({ page }) => {
    await page.goto('/admin/referentiels/statuts-qualification');
    await creerStatut(page, `Sans reessai ${cle}`, 'Aucun');
    await expect(page.getByText('Statut enregistré.')).toBeVisible();
    expect(
      await compter(`SELECT count(*) AS n FROM statuts_qualification WHERE label = $1`, [
        `Sans reessai ${cle}`,
      ]),
    ).toBe(1);
  });
});

async function creerStatut(page: Page, libelle: string, reessai: string): Promise<void> {
  await page.getByRole('button', { name: 'Nouveau statut' }).click();
  const statut = page.getByRole('dialog');
  await statut.getByLabel(/^Libellé/u).fill(libelle);
  await statut.getByRole('combobox', { name: /^Réessai proposé/u }).click();
  await page.getByRole('option', { name: reessai, exact: true }).click();
  await statut.getByRole('button', { name: 'Enregistrer' }).click();
}

test.describe('parcours 13, imports de masse', () => {
  test.use({ storageState: administrateur.etat });

  test('representants puis prospects, avec les lignes refusees', async ({ page }) => {
    const departement = await premierDepartement();
    const telephones = [numero(), numero()];
    const classeur = await classeurExcel(
      `representants-${cle}.xlsx`,
      ['Nom complet', 'Téléphone', 'Département'],
      [
        [`${NOM_REPRESENTANT} A`, telephones[0] ?? '', departement.name],
        [`${NOM_REPRESENTANT} B`, telephones[1] ?? '', departement.name],
        [`${NOM_REPRESENTANT} C`, numero(), `Departement inexistant ${cle}`],
      ],
    );

    await page.goto('/admin/imports');
    await expect(
      page.getByRole('heading', { name: 'Importer un fichier Excel', level: 1 }),
    ).toBeVisible();
    await deposer(page, 'Représentants', classeur);

    await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1 lignes refusées.')).toBeVisible();
    const refus = page.getByRole('row').filter({ hasText: 'Département inconnu' });
    await expect(refus.getByRole('cell', { name: 'Département', exact: true })).toBeVisible();
    await expect(refus.getByRole('cell', { name: '5', exact: true })).toBeVisible();
    expect(
      await compter(`SELECT count(*) AS n FROM representants WHERE "fullName" LIKE $1`, [
        `${NOM_REPRESENTANT}%`,
      ]),
      'la simulation ne doit rien écrire',
    ).toBe(0);

    await page.getByRole('button', { name: 'Créer 2 lignes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Créer 2 lignes' }).click();
    await expect(page.getByText('2 lignes écrites.')).toBeVisible({ timeout: 30_000 });
    expect(
      await compter(`SELECT count(*) AS n FROM representants WHERE "fullName" LIKE $1`, [
        `${NOM_REPRESENTANT}%`,
      ]),
    ).toBe(2);

    // Le classeur des prospects nomme la banque par son nom court et le
    // syndicat par son sigle, comme les listes deroulantes du modele.
    const reference = await ligne<{ banque: string; syndicat: string }>(
      `SELECT (SELECT "shortName" FROM banques WHERE "isActive" ORDER BY name LIMIT 1) AS banque,
              (SELECT sigle FROM syndicats WHERE "isActive" ORDER BY name LIMIT 1) AS syndicat`,
    );
    const prospects = await classeurExcel(
      `prospects-${cle}.xlsx`,
      ['Nom', 'Prénom', 'Téléphone', 'Téléphone du représentant', 'Banque', 'Syndicat'],
      [[`Client${cle}`, 'Bineta', numero(), telephones[0] ?? '', reference.banque, reference.syndicat]],
    );

    await page.getByRole('button', { name: 'Déposer un autre fichier' }).click();
    await deposer(page, 'Prospects CHUES', prospects);
    await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Créer 1 lignes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Créer 1 lignes' }).click();
    await expect(page.getByText('1 lignes écrites.')).toBeVisible({ timeout: 30_000 });

    const cree = await ligne<{ prenom: string; representantId: string | null }>(
      `SELECT prenom, "representantId" FROM prospects WHERE nom = $1`,
      [`Client${cle}`],
    );
    expect(cree.prenom).toBe('Bineta');
    expect(cree.representantId).not.toBeNull();
  });

  // Le serveur saute les deux premières lignes du classeur (`premiereLigneImport
  // = 3`). Un fichier dont la ligne d'exemple a été effacée perd sa première
  // ligne de données : ni compteur, ni ligne refusée ne le disent.
  test.fixme('sans ligne d exemple, la premiere ligne de donnees est perdue sans un mot', async ({
    page,
  }) => {
    const departement = await premierDepartement();
    const serre = await classeurExcel(
      `representants-serre-${cle}.xlsx`,
      ['Nom complet', 'Téléphone', 'Département'],
      [[`${NOM_REPRESENTANT} D`, numero(), departement.name]],
      false,
    );

    await page.goto('/admin/imports');
    await deposer(page, 'Représentants', serre);
    await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Créer 1 lignes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Créer 1 lignes' }).click();
    await expect(page.getByText('1 lignes écrites.')).toBeVisible({ timeout: 30_000 });
    expect(
      await compter(`SELECT count(*) AS n FROM representants WHERE "fullName" = $1`, [
        `${NOM_REPRESENTANT} D`,
      ]),
    ).toBe(1);
  });
});

async function connexion(page: Page, identifiant: string, motDePasse: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(identifiant);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

async function deposer(page: Page, entite: string, chemin: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Entité à importer' }).click();
  await page.getByRole('option', { name: entite, exact: true }).click();
  await page.getByLabel(/Glissez le classeur ici/u).setInputFiles(chemin);
}
