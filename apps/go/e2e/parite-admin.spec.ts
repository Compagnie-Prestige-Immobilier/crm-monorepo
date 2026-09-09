import { expect, test, type Page } from '@playwright/test';

import { compteDe } from './comptes';
import {
  classeurExcel,
  compter,
  ecrire,
  feuillesDuClasseur,
  ligne,
  lire,
  marque,
} from './donnees-admin';

const administrateur = compteDe('ADMIN');

const cle = marque();
const PREFIXE = `E2E admin ${cle}`;
const MOT_DE_PASSE = `Parite-${cle}`;
const CODE_MOTIF = `E2EADM_${cle.toUpperCase()}`;
const LIBELLE_MOTIF = `Issue parité ${cle}`;
const NOM_BANQUE = `Banque parité ${cle}`;
const COURT_BANQUE = `PAR${cle.slice(0, 5).toUpperCase()}`;
const TITRE_ENVOI = `${PREFIXE} envoi`;
const TITRE_PROGRAMME = `${PREFIXE} programme`;
const CHAMP_CONVERSION = `Question ${cle}`;
const MOTIF_SYSTEME = { code: 'UNREACHABLE', libelle: 'Injoignable' };

interface Fiche {
  id: string;
  nom: string;
  identifiant: string;
  email: string;
  role: string;
  actif: boolean;
}

function fiche(suffixe: string, role: string, actif = true): Fiche {
  return {
    id: `e2e-adm-${cle}-${suffixe}`,
    nom: `${PREFIXE} ${suffixe}`,
    identifiant: `e2e.adm.${cle}.${suffixe}`,
    email: `e2e.adm.${cle}.${suffixe}@cpi.sn`,
    role,
    actif,
  };
}

const AGENT = fiche('agent', 'COMMERCIAL');
const BANQUIER = fiche('banque', 'BANQUE_FINANCE');
const RETIRE = fiche('retire', 'COMMERCIAL', false);
const TEMOIN = fiche('temoin', 'DIRECTION');
const FICHES = [AGENT, BANQUIER, RETIRE, TEMOIN];

const CLES_REGLAGES = ['enrolement.CHUES', `conversion.champs.CHUES`];

test.beforeAll(async () => {
  for (const [rang, compte] of FICHES.entries()) {
    // Condensat inutilisable : aucun de ces comptes ne se connecte, ils sont lus.
    await ecrire(
      `INSERT INTO users (id, email, username, "passwordHash", "fullName", role, "isActive",
         "phoneE164", "updatedAt")
       VALUES ($1, $2, $3, 'sans-connexion', $4, $5::"Role", $6, $7, now())`,
      [
        compte.id,
        compte.email,
        compte.identifiant,
        compte.nom,
        compte.role,
        compte.actif,
        `+2217811300${rang}`,
      ],
    );
  }
  await ecrire(
    `INSERT INTO banques (id, name, "shortName", "updatedAt") VALUES ($1, $2, $3, now())`,
    [`banque-${cle}`, NOM_BANQUE, COURT_BANQUE],
  );
  await ecrire(
    `INSERT INTO call_outcome_reasons (id, code, label, effect, "updatedAt")
     VALUES ($1, $2, $3, 'KEEP_OPEN', now())`,
    [`motif-${cle}`, CODE_MOTIF, LIBELLE_MOTIF],
  );
});

test.afterAll(async () => {
  const identifiants = FICHES.map((compte) => compte.id);
  await ecrire(
    `DELETE FROM notification_deliveries WHERE "notificationId" IN
       (SELECT id FROM notifications WHERE title LIKE $1)`,
    [`${PREFIXE}%`],
  );
  await ecrire(`DELETE FROM notifications WHERE title LIKE $1`, [`${PREFIXE}%`]);
  await ecrire(`DELETE FROM import_jobs WHERE "fileName" LIKE 'parite-admin-%'`);
  await ecrire(`DELETE FROM audit_logs WHERE "userId" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM users WHERE id = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM banques WHERE name LIKE $1`, [`%${cle}%`]);
  await ecrire(`DELETE FROM call_outcome_reasons WHERE code LIKE $1`, [
    `E2EADM%${cle.toUpperCase()}`,
  ]);
  await ecrire(`DELETE FROM app_setting_changes WHERE key = ANY($1)`, [CLES_REGLAGES]);
  await ecrire(`DELETE FROM app_settings WHERE key = ANY($1)`, [CLES_REGLAGES]);
});

async function chercherCompte(page: Page, terme: string): Promise<void> {
  await page.getByLabel('Recherche').fill(terme);
  await page.waitForURL((url) =>
    url.search.includes(new URLSearchParams({ recherche: terme }).toString()),
  );
}

async function choisir(page: Page, combo: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: combo }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

function rangee(page: Page, texte: string) {
  return page.getByRole('table').getByRole('row').filter({ hasText: texte });
}

test.describe('parité admin, comptes', () => {
  test.use({ storageState: administrateur.etat });

  test('la liste se filtre par rôle et par état, et l’URL porte les critères', async ({ page }) => {
    await page.goto('/admin/commerciaux');
    await expect(page.getByRole('heading', { name: 'Utilisateurs', level: 1 })).toBeVisible();

    // La v1 ouvrait la liste FILTRÉE sur les téléconseillers : un compte Banque
    // & Finance disparaissait au moment même où le toast annonçait sa création.
    await chercherCompte(page, PREFIXE);
    await expect(rangee(page, PREFIXE)).toHaveCount(4);
    await expect(rangee(page, BANQUIER.nom)).toHaveCount(1);

    await choisir(page, 'Rôle', 'Banque & Finance');
    await expect(page).toHaveURL(/role=BANQUE_FINANCE/u);
    await expect(rangee(page, PREFIXE)).toHaveCount(1);
    await expect(rangee(page, BANQUIER.nom)).toContainText(BANQUIER.email);

    await choisir(page, 'Rôle', 'Tous les rôles');
    await choisir(page, 'État du compte', 'Désactivés');
    await expect(page).toHaveURL(/etat=desactives/u);
    await expect(rangee(page, PREFIXE)).toHaveCount(1);
    await expect(rangee(page, RETIRE.nom)).toContainText('Désactivé');

    await page.reload();
    await expect(page.getByLabel('Recherche')).toHaveValue(PREFIXE);
    await expect(rangee(page, RETIRE.nom)).toHaveCount(1);

    await chercherCompte(page, `${PREFIXE} introuvable`);
    await expect(page.getByText('Aucun compte ne correspond à ces critères.')).toBeVisible();
  });

  test('une page vide se rattrape par les filtres, sans repasser par l’URL', async ({ page }) => {
    const critere = new URLSearchParams({ recherche: PREFIXE, page: '2' }).toString();
    await page.goto(`/admin/commerciaux?${critere}`);

    await expect(page.getByText('Aucun compte ne correspond à ces critères.')).toBeVisible();

    await choisir(page, 'État du compte', 'Actifs');
    await expect(page).not.toHaveURL(/page=2/u);
    await expect(rangee(page, PREFIXE)).toHaveCount(3);
  });

  test('un compte refusé ne s’écrit pas : e-mail pris, mot de passe hors bornes', async ({
    page,
  }) => {
    await page.goto('/admin/commerciaux');
    const nouveau = `${PREFIXE} refuse`;

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    const boite = page.getByRole('dialog');
    await boite.getByLabel(/^Nom complet/u).fill(nouveau);
    await boite.getByLabel(/^Adresse e-mail/u).fill(AGENT.email);
    await boite.getByLabel(/^Identifiant/u).fill(`e2e.adm.${cle}.refuse`);
    await boite.getByLabel(/^Mot de passe/u).fill(MOT_DE_PASSE);
    await boite.getByRole('button', { name: 'Créer le compte' }).click();

    await expect(page.getByText('Cette adresse e-mail est déjà utilisée.').first()).toBeVisible();
    await expect(boite).toBeVisible();

    await boite.getByLabel(/^Adresse e-mail/u).fill(`e2e.adm.${cle}.refuse@cpi.sn`);
    await boite.getByLabel(/^Mot de passe/u).fill('court');
    await boite.getByRole('button', { name: 'Créer le compte' }).click();
    await expect(
      boite.getByText('Le mot de passe doit faire entre 8 et 24 caractères.'),
    ).toBeVisible();

    expect(
      await compter(`SELECT count(*) AS n FROM users WHERE "fullName" = $1`, [nouveau]),
      'un formulaire refusé ne doit rien laisser en base',
    ).toBe(0);
  });
});

test.describe('parité admin, listes de référence', () => {
  test.use({ storageState: administrateur.etat });

  test('la recherche ignore les accents, la liste change et les listes servies se lisent seules', async ({
    page,
  }) => {
    await page.goto('/admin/referentiels');
    await expect(
      page.getByRole('heading', { name: 'Listes de référence', level: 1 }),
    ).toBeVisible();

    await page.getByLabel('Recherche').fill(`parite ${cle}`);
    await expect(rangee(page, NOM_BANQUE)).toHaveCount(1);

    await choisir(page, 'Liste', 'Syndicats');
    await expect(page).toHaveURL(/onglet=syndicats/u);
    await expect(page).not.toHaveURL(/recherche=/u);
    await expect(page.getByLabel('Recherche')).toHaveValue('');

    await choisir(page, 'Liste', 'Pays');
    await expect(
      page.getByText('Liste servie par le serveur. Elle se consulte, elle ne se modifie pas ici.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Nouve/u })).toHaveCount(0);
  });

  test('une banque se retire du service puis y revient', async ({ page }) => {
    await page.goto('/admin/referentiels');
    await page.getByLabel('Recherche').fill(COURT_BANQUE);

    const banque = rangee(page, NOM_BANQUE);
    await banque.getByRole('button', { name: 'Retirer du service' }).click();
    await expect(page.getByText('Entrée retirée.')).toBeVisible();
    await expect(banque).toContainText('Retirée');
    expect(
      await compter(`SELECT count(*) AS n FROM banques WHERE name = $1 AND NOT "isActive"`, [
        NOM_BANQUE,
      ]),
    ).toBe(1);

    await banque.getByRole('button', { name: 'Remettre en service' }).click();
    await expect(page.getByText('Entrée remise en service.')).toBeVisible();
    await expect(banque).toContainText('En service');
    expect(
      await compter(`SELECT count(*) AS n FROM banques WHERE name = $1 AND "isActive"`, [
        NOM_BANQUE,
      ]),
    ).toBe(1);
  });

  test('un nom court déjà porté est refusé et rien ne se crée', async ({ page }) => {
    await page.goto('/admin/referentiels');

    await page.getByRole('button', { name: 'Nouvelle banque' }).click();
    const boite = page.getByRole('dialog');
    await boite.getByLabel(/^Nom$/u).fill(`${NOM_BANQUE} bis`);
    await boite.getByLabel(/^Nom court/u).fill(COURT_BANQUE);
    await boite.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Cette valeur existe déjà dans cette liste.')).toBeVisible();
    await expect(boite).toBeVisible();
    expect(
      await compter(`SELECT count(*) AS n FROM banques WHERE "shortName" = $1`, [COURT_BANQUE]),
    ).toBe(1);
  });
});

test.describe('parité admin, issues d’appel', () => {
  test.use({ storageState: administrateur.etat });

  test('un motif système ne se retire pas, un code ou un libellé repris est refusé', async ({
    page,
  }) => {
    await page.goto('/admin/referentiels/issues-appel');
    await expect(rangee(page, MOTIF_SYSTEME.code)).toContainText('Système');
    await expect(
      page.getByRole('button', { name: `Retirer ${MOTIF_SYSTEME.libelle}` }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Nouveau motif' }).click();
    const boite = page.getByRole('dialog');
    await boite.getByLabel(/^Code/u).fill(CODE_MOTIF);
    await boite.getByLabel(/^Libellé/u).fill(`${LIBELLE_MOTIF} bis`);
    await boite.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      page.getByText(
        `Le code « ${CODE_MOTIF} » est déjà utilisé par le motif « ${LIBELLE_MOTIF} ».`,
      ),
    ).toBeVisible();

    await boite.getByLabel(/^Code/u).fill(`${CODE_MOTIF}_BIS`);
    await boite.getByLabel(/^Libellé/u).fill(LIBELLE_MOTIF);
    await boite.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      page.getByText(
        `Le libellé « ${LIBELLE_MOTIF} » est déjà porté par le motif « ${CODE_MOTIF} ».`,
      ),
    ).toBeVisible();

    expect(
      await compter(`SELECT count(*) AS n FROM call_outcome_reasons WHERE code LIKE $1`, [
        `E2EADM%${cle.toUpperCase()}%`,
      ]),
    ).toBe(1);
  });

  test.fixme('corriger le libellé d’un motif système : le serveur refuse, en parlant de sa règle', async ({
    page,
  }) => {
    await page.goto('/admin/referentiels/issues-appel');
    await page.getByRole('button', { name: `Modifier ${MOTIF_SYSTEME.libelle}` }).click();
    const boite = page.getByRole('dialog');
    await boite.getByLabel(/^Libellé/u).fill(`${MOTIF_SYSTEME.libelle} au téléphone`);
    await boite.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Motif enregistré.')).toBeVisible();
  });
});

test.describe('parité admin, imports', () => {
  test.use({ storageState: administrateur.etat });

  test('les quatre entités, leur consigne, le modèle, et le refus d’un fichier non xlsx', async ({
    page,
  }) => {
    const depots: string[] = [];
    page.on('request', (requete) => {
      if (requete.method() === 'POST' && requete.url().includes('/api/v1/imports')) {
        depots.push(requete.url());
      }
    });

    await page.goto('/admin/imports');
    await expect(
      page.getByRole('heading', { name: 'Importer un fichier Excel', level: 1 }),
    ).toBeVisible();

    await page.getByRole('combobox', { name: 'Entité à importer' }).click();
    for (const entite of [
      'Prospects CHUES',
      'Prospects Grand Public',
      'Représentants',
      'Visites',
    ]) {
      await expect(page.getByRole('option', { name: entite, exact: true })).toBeVisible();
    }
    await page.getByRole('option', { name: 'Visites', exact: true }).click();
    await expect(
      page.getByText('Seuls les onglets « BDD VISITES » sont lus, avec l’en-tête en ligne 3.'),
    ).toBeVisible();

    await choisir(page, 'Entité à importer', 'Prospects Grand Public');
    await expect(
      page.getByText('Seuls le nom et le téléphone sont exigés.', { exact: false }),
    ).toBeVisible();

    const telechargement = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Télécharger le modèle' }).click();
    const modele = await telechargement;
    const chemin = await modele.path();
    expect(await feuillesDuClasseur(chemin)).toContain('Prospects Grand Public');

    await page.getByLabel(/Glissez le classeur ici/u).setInputFiles({
      name: 'parite-admin-mauvais.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Nom;Téléphone\n'),
    });
    await expect(page.getByText('Seul un classeur Excel (.xlsx) est accepté.')).toBeVisible();
    expect(depots, 'un fichier refusé ne part pas vers le serveur').toEqual([]);
  });

  test('un classeur simulé montre ses refus, n’écrit rien, et se rouvre depuis l’historique', async ({
    page,
  }) => {
    const nomFichier = `parite-admin-gp-${cle}.xlsx`;
    const chemin = await classeurExcel(
      nomFichier,
      ['Prénom', 'Nom', 'Téléphone'],
      [
        ['Awa', `Diallo${cle}`, '+221781131000'],
        ['Moussa', `Sow${cle}`, ''],
      ],
    );

    await page.goto('/admin/imports');
    await choisir(page, 'Entité à importer', 'Prospects Grand Public');
    await page.getByLabel(/Glissez le classeur ici/u).setInputFiles(chemin);

    await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Lignes refusées' })).toBeVisible();
    await expect(
      page.getByRole('cell', {
        name: 'Le téléphone est obligatoire : c’est lui qui repère les doublons.',
      }),
    ).toBeVisible();
    expect(
      await compter(`SELECT count(*) AS n FROM prospects WHERE nom LIKE $1`, [`%${cle}`]),
      'une simulation n’écrit aucune fiche',
    ).toBe(0);

    const travail = await ligne<{ mode: string; errorRows: number; createdRows: number }>(
      `SELECT mode::text, "errorRows", "createdRows" FROM import_jobs WHERE "fileName" = $1`,
      [nomFichier],
    );
    expect(travail.mode).toBe('DRY_RUN');
    expect(travail.errorRows).toBe(1);
    expect(travail.createdRows).toBe(1);

    await page.getByRole('button', { name: 'Déposer un autre fichier' }).click();
    await page.getByText('Imports précédents').click();
    await rangee(page, nomFichier).getByRole('button', { name: 'Ouvrir' }).click();
    await expect(page.getByText('Simulation terminée')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer 1 lignes' })).toBeVisible();
  });
});

test.describe('parité admin, notifications', () => {
  test.use({ storageState: administrateur.etat });

  test('le composeur nomme ce qui manque, ne part qu’après confirmation, et la base porte l’envoi', async ({
    page,
  }) => {
    const envois: string[] = [];
    page.on('request', (requete) => {
      const { pathname } = new URL(requete.url());
      if (requete.method() === 'POST' && pathname === '/api/v1/notifications')
        envois.push(pathname);
    });

    await page.goto('/admin/notifications');
    await page.getByRole('button', { name: 'Nouvelle notification' }).click();
    const boite = page.getByRole('dialog');
    const continuer = boite.getByRole('button', { name: 'Continuer' });

    await expect(continuer).toBeDisabled();
    await expect(continuer).toHaveAttribute('title', 'Le titre est obligatoire.');
    await boite.getByLabel('Titre').fill(TITRE_ENVOI);
    await expect(continuer).toHaveAttribute('title', 'Le message est obligatoire.');
    await boite.getByLabel('Message').fill('Vérification automatique, aucune action attendue.');

    await choisir(page, 'Public', 'Comptes choisis');
    await expect(continuer).toHaveAttribute('title', 'Choisissez au moins un compte.');
    await boite.getByRole('combobox').last().fill(TEMOIN.nom);
    await page.getByRole('option', { name: new RegExp(TEMOIN.nom, 'u') }).click();
    await expect(boite.getByText('1 compte choisi.')).toBeVisible();

    await continuer.click();
    await expect(boite.getByText('Cet envoi s’adresse à 1 personne.')).toBeVisible();
    expect(envois, 'aucun envoi ne part du premier temps').toEqual([]);

    await boite.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('Notification envoyée.')).toBeVisible();

    const envoi = await ligne<{
      id: string;
      audience: string;
      ids: string[];
      transport: string | null;
    }>(
      `SELECT id, audience::text, "audienceUserIds" AS ids, "transportStatus" AS transport
       FROM notifications WHERE title = $1`,
      [TITRE_ENVOI],
    );
    expect(envoi.audience).toBe('USERS');
    expect(envoi.ids).toEqual([TEMOIN.id]);
    const livraisons = await lire<{ userId: string }>(
      `SELECT "userId" FROM notification_deliveries WHERE "notificationId" = $1`,
      [envoi.id],
    );
    expect(livraisons.map((row) => row.userId)).toEqual([TEMOIN.id]);

    const ligneEnvoi = rangee(page, TITRE_ENVOI);
    await expect(ligneEnvoi).toContainText('1 compte choisi');
    await ligneEnvoi.getByRole('button', { name: new RegExp(TITRE_ENVOI, 'u') }).click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByRole('heading', { name: TITRE_ENVOI })).toBeVisible();
    await expect(detail.getByRole('row').filter({ hasText: TEMOIN.nom })).toHaveCount(1);
  });

  test('une date passée est refusée, l’envoi programmé s’annule et la base le dit', async ({
    page,
  }) => {
    await page.goto('/admin/notifications');
    await page.getByRole('button', { name: 'Nouvelle notification' }).click();
    const boite = page.getByRole('dialog');

    await boite.getByLabel('Titre').fill(TITRE_PROGRAMME);
    await boite.getByLabel('Message').fill('Programmation de vérification.');
    await choisir(page, 'Public', 'Comptes choisis');
    await boite.getByRole('combobox').last().fill(TEMOIN.nom);
    await page.getByRole('option', { name: new RegExp(TEMOIN.nom, 'u') }).click();

    await boite.getByRole('checkbox', { name: 'Programmer l’envoi' }).check();
    // Le champ de date n'a pas de nom accessible : son type est le seul repère.
    const quand = boite.locator('input[type="datetime-local"]');
    await quand.fill('2020-01-01T09:00');
    await expect(boite.getByText('Choisissez une date et une heure à venir.')).toBeVisible();
    await expect(boite.getByRole('button', { name: 'Continuer' })).toBeDisabled();

    await quand.fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
    await boite.getByRole('button', { name: 'Continuer' }).click();
    await boite.getByRole('button', { name: 'Programmer' }).click();
    await expect(page.getByText('Notification programmée.')).toBeVisible();

    const programme = rangee(page, TITRE_PROGRAMME);
    await expect(programme).toContainText('Programmée');
    expect(
      await compter(
        `SELECT count(*) AS n FROM notifications WHERE title = $1 AND status = 'SCHEDULED'`,
        [TITRE_PROGRAMME],
      ),
    ).toBe(1);

    await programme.getByRole('button', { name: 'Annuler' }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation.getByRole('heading')).toContainText(TITRE_PROGRAMME);
    await confirmation.getByRole('button', { name: 'Annuler l’envoi' }).click();

    await expect(page.getByText('Envoi annulé.')).toBeVisible();
    await expect(programme).toContainText('Annulée');
    const annule = await ligne<{ status: string; cancelledAt: Date | null }>(
      `SELECT status::text, "cancelledAt" FROM notifications WHERE title = $1`,
      [TITRE_PROGRAMME],
    );
    expect(annule.status).toBe('CANCELLED');
    expect(annule.cancelledAt).not.toBeNull();
  });

  test.fixme('les gabarits de notification n’ont pas d’écran en v2', async ({ page }) => {
    await page.goto('/admin/notifications');
    await expect(page.getByRole('tab', { name: 'Gabarits' })).toBeVisible();
  });

  test.fixme('les onglets et les filtres des notifications ne vivent pas dans l’URL', async ({
    page,
  }) => {
    await page.goto('/admin/notifications');
    await page.getByRole('tab', { name: 'Boîte de réception' }).click();
    await expect(page).toHaveURL(/onglet=reception/u);
  });
});

test.describe('parité admin, paramètres et connecteurs', () => {
  test.use({ storageState: administrateur.etat });

  test('la racine mène aux comptes, et la suppression des données s’annonce irréversible', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/commerciaux$/u);

    await page.goto('/admin/parametres');
    await expect(
      page.getByText('Ces actions portent sur les données de tous les utilisateurs.'),
    ).toBeVisible();
    await expect(page.getByText('Suppression des données')).toBeVisible();
    await expect(
      page.getByText('Sélection par domaine. La suppression est définitive.'),
    ).toBeVisible();
    await expect(page.getByText('Irréversible', { exact: true })).toBeVisible();
  });

  test('les plateformes d’enrôlement disent leur configuration et gardent leur fréquence', async ({
    page,
  }) => {
    await page.goto('/admin/enrolement');
    await expect(page.getByRole('tab', { name: 'CHUES' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Grand Public' })).toBeVisible();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'ne sont pas renseignés dans l’environnement du serveur' })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirer maintenant' }).first()).toBeDisabled();

    const frequence = page.getByLabel('Tirer toutes les').first();
    await expect(frequence).toHaveValue('15');
    await frequence.fill('30');
    await frequence.blur();
    await expect(page.getByText('Réglages enregistrés.')).toBeVisible();

    const reglage = await ligne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'enrolement.CHUES'`,
    );
    expect((JSON.parse(reglage.value) as { frequenceMinutes: number }).frequenceMinutes).toBe(30);
  });

  test('un champ ajouté au formulaire de conversion se relit en base, puis se retire', async ({
    page,
  }) => {
    await page.goto('/admin/champs-conversion');
    await expect(page.getByRole('heading', { name: 'Champs ajoutés' })).toBeVisible();

    await page.getByRole('button', { name: 'Ajouter un champ' }).click();
    await page.getByLabel('Libellé').fill(CHAMP_CONVERSION);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Formulaire enregistré.')).toBeVisible();

    const libres = async (): Promise<string[]> => {
      const reglage = await ligne<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = 'conversion.champs.CHUES'`,
      );
      const stocke = JSON.parse(reglage.value) as { libres?: { libelle: string }[] };
      return (stocke.libres ?? []).map((champ) => champ.libelle);
    };
    expect(await libres()).toContain(CHAMP_CONVERSION);

    await page.getByRole('button', { name: `Retirer ${CHAMP_CONVERSION}` }).click();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Formulaire enregistré.')).toBeVisible();
    expect(await libres()).not.toContain(CHAMP_CONVERSION);
  });
});
