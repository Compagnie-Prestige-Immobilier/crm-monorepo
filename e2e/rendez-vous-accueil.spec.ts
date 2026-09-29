import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire } from './donnees-admin';
import { apiDe, creerProspect, purger, suffixe } from './donnees-listes';

/** Ce qu'un ADMIN coche dans « Utilisateurs et rôles » pour ouvrir l'écran au comptoir. */
const OUVERTURE = ['rendez_vous.voir', 'rendez_vous.suivre', 'rendez_vous.exporter'];

async function permissionsDuRoleAccueil(): Promise<string[]> {
  const api = await apiDe('ADMIN', '198.51.100.91');
  const corps = await (await api.get('/api/v1/roles')).json();
  const role = corps.roles.find((item: { id: string }) => item.id === 'ACCUEIL');
  await api.dispose();
  return role.permissions;
}

async function poserPermissions(permissions: string[]): Promise<void> {
  const api = await apiDe('ADMIN', '198.51.100.91');
  const reponse = await api.put('/api/v1/roles/ACCUEIL/permissions', { data: { permissions } });
  expect(reponse.status(), 'permissions du rôle Accueil').toBe(200);
  await api.dispose();
}

/** Un téléconseiller pose un RV CPI pour demain, comme dans la console. */
async function poserRendezVous(nom: string, ip: string): Promise<string> {
  const api = await apiDe('COMMERCIAL', ip);
  const id = await creerProspect(api, {
    nom,
    prenom: 'Awa',
    phone: `+22177${String(4_100_000 + Math.floor(Math.random() * 800_000))}`,
    projet: 'GRAND_PUBLIC',
  });
  const appel = await api.post('/api/v1/phase2/call-attempts', {
    data: {
      id: randomUUID(),
      prospectId: id,
      reasonCode: 'RV_CPI',
      callbackAt: new Date(Date.now() + 86_400_000).toISOString(),
      clientCreatedAt: new Date().toISOString(),
    },
  });
  expect(appel.status(), 'rendez-vous consigné').toBe(200);
  await api.dispose();
  return id;
}

test.describe('rendez-vous au comptoir', () => {
  test.use({ storageState: compteDe('ACCUEIL').etat });

  let permissionsAvant: string[] = [];
  let convoque = '';
  const nom = `Convoque ${suffixe()}`;

  test.beforeAll(async () => {
    permissionsAvant = await permissionsDuRoleAccueil();
    convoque = await poserRendezVous(nom, '198.51.100.92');
  });

  test.afterAll(async () => {
    await ecrire('DELETE FROM "visites" WHERE "visitorName" = $1', [`Awa ${nom}`]);
    await poserPermissions(permissionsAvant);
    await purger({ prospects: [convoque] });
  });

  test('le comptoir confirme, note la venue et enregistre la visite, sans closer', async ({
    page,
  }) => {
    await page.goto('/accueil');
    const onglet = page.getByRole('link', { name: 'Rendez-vous', exact: true }).first();
    await expect(onglet).toBeVisible();

    await onglet.click();
    await expect(page.getByRole('tab', { name: 'À traiter' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const tableau = page.getByRole('table', { name: 'Rendez-vous' });
    await expect(tableau.getByRole('columnheader', { name: 'Statut' })).toBeVisible();
    await expect(tableau.getByRole('row', { name: /^Demain \(/u })).toBeVisible();
    const ligne = tableau.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toHaveCount(1);
    await expect(ligne.getByText('À confirmer', { exact: true })).toBeVisible();
    await expect(ligne.getByRole('link', { name: /^\+221 77 / })).toBeVisible();
    await expect(ligne.getByRole('button', { name: `Awa ${nom}`, exact: true })).toHaveCount(0);

    // Le type filtre la file : un RV CPI ne s'affiche pas sous RV site.
    await page.getByRole('combobox', { name: 'Type de rendez-vous' }).click();
    await page.getByRole('option', { name: 'RV site', exact: true }).click();
    await expect(ligne).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Type de rendez-vous' }).click();
    await page.getByRole('option', { name: 'Tous les types', exact: true }).click();
    await expect(ligne).toHaveCount(1);

    // Chaque geste reste sur la même ligne : la suivante apparaît sans changer d'écran.
    await ligne.getByRole('button', { name: `Confirmer : Awa ${nom}` }).click();
    await page
      .getByRole('dialog', { name: `Confirmation du rendez-vous de Awa ${nom}` })
      .getByRole('button', { name: 'Enregistrer' })
      .click();
    await expect(ligne.getByText('Confirmé', { exact: true })).toBeVisible();
    await ligne.getByRole('button', { name: `Présent : Awa ${nom}` }).click();
    await expect(ligne.getByText('Présent, closing à compléter')).toBeVisible();
    await expect(ligne.getByRole('button', { name: 'Compléter le closing' })).toHaveCount(0);

    // Venu, il passe au registre sans ressaisir son nom ni son numéro.
    await ligne.getByRole('button', { name: 'Enregistrer la visite' }).click();
    const fenetre = page.getByRole('dialog', { name: 'Enregistrer une visite' });
    await expect(fenetre.getByLabel('PRENOM ET NOMS')).toHaveValue(`Awa ${nom}`);
    await expect(fenetre.getByLabel('TELEPHONES')).toHaveValue(/^\+221 77 /);
    const [choix = { entreprise: '', objet: '' }] = await lire<{
      entreprise: string;
      objet: string;
    }>(
      `SELECT (SELECT "label" FROM "visite_entreprises" WHERE "isActive" ORDER BY "sortOrder" LIMIT 1) AS entreprise,
              (SELECT "label" FROM "visite_objets" WHERE "isActive" ORDER BY "sortOrder" LIMIT 1) AS objet`,
    );
    await fenetre.getByRole('combobox', { name: /ENTREPRISE/u }).click();
    await page.getByRole('option', { name: choix.entreprise, exact: true }).click();
    await fenetre.getByRole('combobox', { name: /OBJET VISITE/u }).click();
    await page.getByRole('option', { name: choix.objet, exact: true }).click();
    await fenetre.getByRole('button', { name: 'Enregistrer la visite' }).click();
    await expect(fenetre).toHaveCount(0);
    const visites = await lire<{ phoneE164: string }>(
      'SELECT "phoneE164" FROM "visites" WHERE "visitorName" = $1',
      [`Awa ${nom}`],
    );
    expect(visites, 'visite enregistrée au registre').toHaveLength(1);

    // Le classeur emporte les filtres posés.
    const lien = page.getByRole('link', { name: 'Exporter' });
    await expect(lien).toHaveAttribute('href', /export\/rendez-vous\.xlsx/u);

    // La recherche porte sur le nom comme sur le numéro.
    const recherche = page.getByLabel('Rechercher un rendez-vous');
    await recherche.fill(nom);
    await expect(ligne).toHaveCount(1);
    await recherche.fill('Personne qui n’existe pas');
    await expect(page.getByText('Aucun rendez-vous pour cette recherche')).toBeVisible();
    await recherche.fill('');

    await poserPermissions(permissionsAvant.filter((p) => !OUVERTURE.includes(p)));
    await page.reload();
    await expect(onglet).toHaveCount(0);
  });
});

test.describe('closing par le chargé de clientèle', () => {
  test.use({ storageState: compteDe('CHARGE_CLIENTELE').etat });

  let convoque = '';
  const nom = `Closing ${suffixe()}`;

  test.beforeAll(async () => {
    convoque = await poserRendezVous(nom, '198.51.100.93');
  });

  test.afterAll(async () => {
    await purger({ prospects: [convoque] });
  });

  test('dans l’Accueil, il arrive sur l’agenda ; un report revient à confirmer, la venue ouvre le closing', async ({
    page,
  }) => {
    await page.goto('/espaces');
    await page
      .getByRole('link', { name: /Accueil/u })
      .first()
      .click();
    await expect(page).toHaveURL(/\/accueil\/agenda$/u);
    await expect(page.getByRole('tab', { name: 'Semaine' })).toBeVisible();
    const onglets = page.getByRole('navigation', { name: 'Visites' }).getByRole('link');
    await expect(onglets.first()).toHaveText('Agenda');
    await expect(page.getByRole('link', { name: 'Intéressés et hésitants' })).toBeVisible();

    await page.getByRole('link', { name: 'Rendez-vous', exact: true }).first().click();
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await ligne.getByRole('button', { name: `Awa ${nom}`, exact: true }).click();
    const fiche = page.getByRole('dialog', { name: 'Fiche du prospect' });
    await expect(fiche.getByRole('heading', { name: `Awa ${nom}` })).toBeVisible();
    await expect(page).toHaveURL(/\/accueil\/rendez-vous/u);
    await page.keyboard.press('Escape');
    await expect(fiche).toHaveCount(0);

    // Reporté sans date : il attend dans « À recontacter » avec le commentaire.
    await ligne.getByRole('button', { name: `Confirmer : Awa ${nom}` }).click();
    const confirmation = page.getByRole('dialog', {
      name: `Confirmation du rendez-vous de Awa ${nom}`,
    });
    await confirmation.getByRole('radio', { name: 'Reporté' }).check();
    await confirmation.getByLabel('Commentaire (facultatif)').fill('En voyage, rappellera');
    await confirmation.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(ligne.getByText('À recontacter', { exact: true })).toBeVisible();
    await expect(ligne.getByText(/En voyage, rappellera/u)).toBeVisible();

    await ligne.getByRole('button', { name: `Reporter : Awa ${nom}` }).click();
    const report = page.getByRole('dialog', { name: /^Reporter le rendez-vous/u });
    const apres = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await report.getByLabel('Nouvelle date (facultatif)').fill(apres);
    await report.getByLabel('Heure (facultatif)').fill('10:00');
    await report.getByRole('button', { name: 'Reporter' }).click();
    await expect(ligne.getByText('Reporté, à confirmer')).toBeVisible();

    // Présent : le closing s'ouvre de lui-même, en trois étapes, rien d'obligatoire.
    await ligne.getByRole('button', { name: `Confirmer : Awa ${nom}` }).click();
    await confirmation.getByRole('button', { name: 'Enregistrer' }).click();
    await ligne.getByRole('button', { name: `Présent : Awa ${nom}` }).click();
    const closing = page.getByRole('dialog', { name: `Closing de Awa ${nom}` });
    await closing.getByRole('combobox', { name: 'Superficie du lot' }).click();
    await page.getByRole('option', { name: 'Autre, à préciser' }).click();
    await closing.getByLabel('Superficie du lot, précision').fill('400 m²');
    await closing.getByRole('button', { name: 'Suivant' }).click();
    await closing.getByRole('button', { name: 'Suivant' }).click();
    await closing.getByRole('combobox', { name: 'Qualification', exact: true }).click();
    await page.getByRole('option', { name: 'Partenariat' }).click();
    await closing.getByLabel('Commentaire sur le partenariat').fill('Mutuelle des enseignants');
    await expect(closing.getByRole('group', { name: 'Qualification du RV externe' })).toHaveCount(
      0,
    );
    await closing.getByRole('combobox', { name: 'Prochaine action' }).click();
    await page.getByRole('option', { name: 'Signature / encaissement acompte' }).click();
    await closing.getByRole('button', { name: 'Enregistrer et fermer' }).click();
    await expect(closing).toHaveCount(0);
    await expect(ligne).toHaveCount(0);

    await page.getByRole('tab', { name: 'Historique' }).click();
    await expect(ligne.getByText('Closing enregistré')).toBeVisible();
    const [enregistre] = await lire<{
      superficie: string;
      qualification: string;
      qualificationCommentaire: string;
    }>(
      'SELECT "superficie", "qualification", "qualificationCommentaire" FROM "rendez_vous_closings" WHERE "prospectId" = $1',
      [convoque],
    );
    expect(enregistre).toEqual({
      superficie: '400 m²',
      qualification: 'Partenariat',
      qualificationCommentaire: 'Mutuelle des enseignants',
    });
  });
});

test.describe('rendez-vous site pris en console', () => {
  test.use({ storageState: compteDe('COMMERCIAL').etat });

  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const heure = (quand: string): string => new Date(quand).toISOString().slice(11, 16);
  let complet = '';
  let libre = '';
  let reglagesAvant: unknown = null;
  const prospects: string[] = [];
  const nom = `Visiteur ${suffixe()}`;

  test.beforeAll(async () => {
    const admin = await apiDe('ADMIN', '198.51.100.94');
    reglagesAvant = await (await admin.get('/api/v1/rv-site/reglages')).json();
    const pose = await admin.put('/api/v1/rv-site/reglages', {
      data: {
        jours: [1, 2, 3, 4, 5, 6, 7],
        heureDebut: 9,
        heureFin: 20,
        horizonJours: 60,
        maxVisites: 2,
      },
    });
    expect(pose.status(), 'réglages RV site').toBe(200);
    await admin.dispose();

    const [choix = { site: '', point: '' }] = await lire<{ site: string; point: string }>(
      `SELECT (SELECT "id" FROM "ventes_sites" WHERE "actif" ORDER BY "ordre" LIMIT 1) AS site,
              (SELECT "id" FROM "points_rencontre" WHERE "isActive" ORDER BY "position" LIMIT 1) AS point`,
    );
    const api = await apiDe('COMMERCIAL', '198.51.100.95');
    // Deux heures encore vides : une base de travail peut déjà porter des visites demain.
    const { creneaux } = (await (
      await api.get(`/api/v1/phase2/rv-site/creneaux?du=${demain}&au=${demain}`)
    ).json()) as { creneaux: { quand: string; restantes: number | null }[] };
    [complet = '', libre = ''] = creneaux.filter((c) => c.restantes === 2).map((c) => c.quand);
    expect(libre, 'deux heures libres demain').not.toBe('');
    for (const rang of [1, 2, 3]) {
      const id = await creerProspect(api, {
        nom: `${nom} ${String(rang)}`,
        prenom: 'Awa',
        phone: `+22177${String(4_900_000 + Math.floor(Math.random() * 90_000))}`,
        projet: 'GRAND_PUBLIC',
      });
      prospects.push(id);
      if (rang === 3) continue;
      const appel = await api.post('/api/v1/phase2/call-attempts', {
        data: {
          id: randomUUID(),
          prospectId: id,
          reasonCode: 'RV_SITE',
          callbackAt: complet,
          siteId: choix.site,
          pointRencontreId: choix.point,
          clientCreatedAt: new Date().toISOString(),
        },
      });
      expect(appel.status(), await appel.text()).toBe(200);
    }
    await api.dispose();
  });

  test.afterAll(async () => {
    const admin = await apiDe('ADMIN', '198.51.100.94');
    await admin.put('/api/v1/rv-site/reglages', { data: reglagesAvant });
    await admin.dispose();
    await purger({ prospects });
  });

  test('chaque créneau dit ses places restantes, un créneau complet ne se choisit pas', async ({
    page,
  }) => {
    await page.goto('/teleconseil/console');
    await page.getByLabel('Quel prospect avez-vous appelé ?').fill(`${nom} 3`);
    await page.getByRole('button', { name: new RegExp(`${nom} 3`, 'u') }).click();
    await page
      .getByRole('group', { name: 'Avez-vous eu la personne au téléphone ?' })
      .getByRole('button', { name: /Oui, elle a répondu/u })
      .click();
    await page.getByRole('button', { name: /^Continuer/u }).click();
    await page
      .getByRole('group', { name: 'Qu’a dit la personne ?' })
      .getByRole('button', { name: /Rendez-vous/u })
      .click();
    await page.getByRole('button', { name: /RV site/u }).click();

    if (demain.slice(0, 7) !== new Date().toISOString().slice(0, 7)) {
      await page.getByRole('button', { name: 'Mois suivant' }).click();
    }
    const jour = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${demain}T00:00:00.000Z`));
    await page.getByRole('button', { name: jour, exact: true }).click();

    await expect(page.getByRole('button', { name: `${heure(complet)} Complet` })).toBeDisabled();
    const creneauLibre = page.getByRole('button', { name: `${heure(libre)} 2 places` });
    await expect(creneauLibre).toBeEnabled();
    await creneauLibre.click();
    await expect(creneauLibre).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('rendez-vous à recontacter', () => {
  test.use({ storageState: compteDe('CHARGE_CLIENTELE').etat });

  let convoque = '';
  const nom = `Recontact ${suffixe()}`;

  test.beforeAll(async () => {
    convoque = await poserRendezVous(nom, '198.51.100.97');
  });

  test.afterAll(async () => {
    await purger({ prospects: [convoque] });
  });

  test('sans engagement la veille, il attend en tête avec ce qu’a dit la personne, puis se reporte', async ({
    page,
  }) => {
    await page.goto('/accueil/rendez-vous');
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await ligne.getByRole('button', { name: `Autres actions : Awa ${nom}` }).click();
    await page.getByRole('menuitem', { name: 'À recontacter' }).click();
    const fenetre = page.getByRole('dialog', { name: `À recontacter : Awa ${nom}` });
    const valider = fenetre.getByRole('button', { name: 'Mettre à recontacter' });
    await expect(valider).toBeDisabled();
    await fenetre
      .getByLabel('Ce que la personne a dit')
      .fill('Deuil, rappellera la semaine prochaine');
    await valider.click();

    const groupe = page.getByRole('row', { name: /^À recontacter \(/u });
    await expect(groupe).toBeVisible();
    await expect(ligne.getByText('À recontacter', { exact: true })).toBeVisible();
    await expect(ligne.getByText(/Deuil, rappellera la semaine prochaine/u)).toBeVisible();
    await expect(ligne.getByText('Date à fixer')).toBeVisible();

    await ligne.getByRole('button', { name: `Reporter : Awa ${nom}` }).click();
    const report = page.getByRole('dialog', { name: /^Reporter le rendez-vous/u });
    const apres = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await report.getByLabel('Nouvelle date (facultatif)').fill(apres);
    await report.getByLabel('Heure (facultatif)').fill('10:00');
    await report.getByRole('button', { name: 'Reporter' }).click();
    await expect(ligne.getByText('Reporté, à confirmer')).toBeVisible();
    await expect(ligne.getByText(/Deuil/u)).toHaveCount(0);
  });
});
