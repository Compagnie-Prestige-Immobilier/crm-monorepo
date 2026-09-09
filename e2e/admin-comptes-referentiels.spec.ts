import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import {
  appliquerImport,
  classeurExcel,
  compteParIdentifiant,
  compter,
  connexion,
  creerCompteParEcran,
  creerStatutQualification,
  deposerClasseur,
  doterPortefeuille,
  effacerBanque,
  effacerTraces,
  ligne,
  marque,
  numero,
  ouvrirMenuCompte,
  poserRole,
  premierDepartement,
  sessionDe,
} from './donnees-admin';

const administrateur = compteDe('ADMIN');

const cle = marque();
const passe = `Initial-${cle}-2026`;
const REMIS = `Remis-${cle}-2026`;
const AGENT = { nom: `E2E13 Agent ${cle}`, identifiant: `e2e13.agent.${cle}`, motDePasse: passe };
const REPRENEUR = { nom: `E2E13 Repr ${cle}`, identifiant: `e2e13.rep.${cle}`, motDePasse: passe };
const ADMIN_BIS = {
  nom: `E2E13 Admin ${cle}`,
  identifiant: `e2e13.admin.${cle}`,
  motDePasse: passe,
  role: 'Administrateur',
};
const NOM_REPRESENTANT = `Import Rep ${cle}`;

test.afterAll(async () => {
  await effacerTraces(cle, administrateur.id);
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

    await creerCompteParEcran(page, AGENT);
    await creerCompteParEcran(page, REPRENEUR);
    // La liste est paginée et d'autres parcours créent des comptes : la filtrer sur ce parcours.
    await page.goto('/admin/commerciaux?recherche=E2E13');
    const agent = await compteParIdentifiant(AGENT.identifiant);
    expect(agent.role).toBe('COMMERCIAL');
    expect(agent.isActive).toBe(true);
    const repreneur = await compteParIdentifiant(REPRENEUR.identifiant);

    const { contexte, vue } = await sessionDe(browser, '198.51.100.91', AGENT);
    await poserRole(page, AGENT.nom, 'Supervision');
    await expect(page.getByText(`Compte de ${AGENT.nom} mis à jour.`)).toBeVisible();
    expect((await compteParIdentifiant(AGENT.identifiant)).role).toBe('SUPERVISEUR');

    await ouvrirMenuCompte(page, AGENT.nom, 'Réinitialiser le mot de passe');
    const remise = page.getByRole('dialog');
    await remise.getByLabel(/^Nouveau mot de passe/u).fill(REMIS);
    await remise.getByLabel(/^Confirmation/u).fill(REMIS);
    await remise.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(
      page.getByText(`Mot de passe réinitialisé. ${AGENT.nom} est déconnecté.`),
    ).toBeVisible();

    await vue.reload();
    await expect(vue).toHaveURL(/\/connexion(\?next=.*)?$/u);
    await connexion(vue, AGENT.identifiant, REMIS);
    await expect(vue.getByRole('button', { name: `Compte de ${AGENT.nom}` })).toBeVisible();

    const portefeuille = await doterPortefeuille(cle, agent.id);

    await page.reload();
    await ouvrirMenuCompte(page, AGENT.nom, 'Désactiver le compte');
    const reprise = page.getByRole('dialog');
    await reprise.getByRole('combobox', { name: /Qui reprend le portefeuille/u }).click();
    await page.getByRole('option', { name: REPRENEUR.nom }).click();
    await reprise.getByRole('button', { name: 'Désactiver le compte' }).click();
    await expect(
      page.getByText(`${AGENT.nom} désactivé. Ses saisies sont conservées.`),
    ).toBeVisible();

    expect((await compteParIdentifiant(AGENT.identifiant)).isActive).toBe(false);
    const restes = `SELECT count(*) AS n FROM %t WHERE "createdById" = $1`;
    expect(await compter(restes.replace('%t', 'prospects'), [agent.id])).toBe(0);
    expect(await compter(restes.replace('%t', 'representants'), [agent.id])).toBe(0);
    expect(
      await compter(`${restes.replace('%t', 'representants')} AND "fullName" = $2`, [
        repreneur.id,
        portefeuille.representant,
      ]),
      'le représentant doit suivre le repreneur désigné',
    ).toBe(1);

    await vue.reload();
    await expect(vue).toHaveURL(/\/connexion(\?next=.*)?$/u);
    await contexte.close();
    await effacerBanque(portefeuille.banqueId);

    await page.reload();
    await ouvrirMenuCompte(page, AGENT.nom, 'Supprimer le compte');
    await page.getByRole('dialog').getByRole('button', { name: 'Supprimer le compte' }).click();
    await expect(page.getByText(`${AGENT.nom} supprimé.`)).toBeVisible();
    expect((await compteParIdentifiant(AGENT.identifiant)).deletedAt).not.toBeNull();
  });

  // Un compte neuf plutot qu'une fixture : la garde ne se declenche que sur SON
  // PROPRE compte, et retrograder un compte partage casserait les autres parcours.
  test('un administrateur ne peut pas retirer son propre role', async ({ page, browser }) => {
    await page.goto('/admin/commerciaux?recherche=E2E13');
    await creerCompteParEcran(page, ADMIN_BIS);
    expect((await compteParIdentifiant(ADMIN_BIS.identifiant)).role).toBe('ADMIN');

    const { contexte, vue } = await sessionDe(browser, '198.51.100.92', ADMIN_BIS);
    await vue.goto('/admin/commerciaux?recherche=E2E13');
    await poserRole(vue, ADMIN_BIS.nom, 'Téléconseiller');
    await expect(
      vue.getByText('Un administrateur ne peut pas retirer son propre rôle.'),
    ).toBeVisible();
    expect((await compteParIdentifiant(ADMIN_BIS.identifiant)).role).toBe('ADMIN');
    await contexte.close();
  });
});

test.describe('parcours 13, listes de reference', () => {
  test.use({ storageState: administrateur.etat });

  test('banque ajoutee, renommee, retiree du service', async ({ page }) => {
    await page.goto('/admin/referentiels');
    await expect(
      page.getByRole('heading', { name: 'Listes de référence', level: 1 }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    const creation = page.getByRole('dialog');
    await creation.getByLabel(/^Nom\s*Obligatoire$/u).fill(`Banque ${cle}`);
    await creation.getByLabel(/^Nom court/u).fill(`BQ${cle.slice(0, 4)}`);
    await creation.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Entrée créée.')).toBeVisible();
    const ajoutees = `SELECT count(*) AS n FROM banques WHERE name = $1`;
    expect(await compter(ajoutees, [`Banque ${cle}`])).toBe(1);

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
    await creerStatutQualification(page, `Statut ${cle}`, 'Dans 1 h');
    await expect(page.getByText('Statut enregistré.')).toBeVisible();
    const enregistre = await ligne<{ code: string; retryAfterMinutes: number }>(
      `SELECT code, "retryAfterMinutes" FROM statuts_qualification WHERE label = $1`,
      [`Statut ${cle}`],
    );
    expect(enregistre.code).toBe(`STATUT_${cle}`.toUpperCase());
    expect(enregistre.retryAfterMinutes).toBe(60);
  });

  // « Aucun » est la valeur par defaut du champ « Reessai propose » : le serveur
  // la garde sans echeance plutot que de refuser la creation.
  test('le reessai « Aucun » se conserve sans echeance', async ({ page }) => {
    await page.goto('/admin/referentiels/statuts-qualification');
    await creerStatutQualification(page, `Sans reessai ${cle}`, 'Aucun');
    await expect(page.getByText('Statut enregistré.')).toBeVisible();
    const sans = await ligne<{ retryAfterMinutes: number | null }>(
      `SELECT "retryAfterMinutes" FROM statuts_qualification WHERE label = $1`,
      [`Sans reessai ${cle}`],
    );
    expect(sans.retryAfterMinutes).toBeNull();
  });
});

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
    const semes = `SELECT count(*) AS n FROM representants WHERE "fullName" LIKE $1`;

    await page.goto('/admin/imports');
    await expect(
      page.getByRole('heading', { name: 'Importer un fichier Excel', level: 1 }),
    ).toBeVisible();
    await deposerClasseur(page, 'Représentants', classeur);

    await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1 lignes refusées.')).toBeVisible();
    const refus = page.getByRole('row').filter({ hasText: 'Département inconnu' });
    await expect(refus.getByRole('cell', { name: 'Département', exact: true })).toBeVisible();
    await expect(refus.getByRole('cell', { name: '5', exact: true })).toBeVisible();
    expect(await compter(semes, [`${NOM_REPRESENTANT}%`]), 'la simulation n’écrit rien').toBe(0);

    await appliquerImport(page, 'Créer 2 lignes', '2 lignes écrites.');
    expect(await compter(semes, [`${NOM_REPRESENTANT}%`])).toBe(2);

    // Le classeur des prospects nomme la banque par son nom court et le
    // syndicat par son sigle, comme les listes deroulantes du modele.
    const reference = await ligne<{ banque: string; syndicat: string }>(
      `SELECT (SELECT "shortName" FROM banques WHERE "isActive" ORDER BY name LIMIT 1) AS banque,
              (SELECT sigle FROM syndicats WHERE "isActive" ORDER BY name LIMIT 1) AS syndicat`,
    );
    const prospects = await classeurExcel(
      `prospects-${cle}.xlsx`,
      ['Nom', 'Prénom', 'Téléphone', 'Téléphone du représentant', 'Banque', 'Syndicat'],
      [
        [
          `Client${cle}`,
          'Bineta',
          numero(),
          telephones[0] ?? '',
          reference.banque,
          reference.syndicat,
        ],
      ],
    );

    await page.getByRole('button', { name: 'Déposer un autre fichier' }).click();
    await deposerClasseur(page, 'Prospects CHUES', prospects);
    await appliquerImport(page, 'Créer 1 lignes', '1 lignes écrites.');

    const cree = await ligne<{ prenom: string; representantId: string | null }>(
      `SELECT prenom, "representantId" FROM prospects WHERE nom = $1`,
      [`Client${cle}`],
    );
    expect(cree.prenom).toBe('Bineta');
    expect(cree.representantId, 'le prospect doit rejoindre son représentant').not.toBeNull();
  });

  // Le serveur saute les deux premieres lignes du classeur. Un fichier dont la
  // ligne d'exemple du modele a ete effacee perd sa premiere ligne de donnees :
  // ni compteur, ni ligne refusee ne le disent.
  test.fixme('sans ligne d exemple, la premiere ligne de donnees est perdue', async ({ page }) => {
    const serre = await classeurExcel(
      `representants-serre-${cle}.xlsx`,
      ['Nom complet', 'Téléphone', 'Département'],
      [[`${NOM_REPRESENTANT} D`, numero(), (await premierDepartement()).name]],
      false,
    );
    await page.goto('/admin/imports');
    await deposerClasseur(page, 'Représentants', serre);
    await appliquerImport(page, 'Créer 1 lignes', '1 lignes écrites.');
  });
});
