#!/usr/bin/env node
/**
 * Convertit un répertoire de contacts terrain au modèle d'import des
 * représentants, puis le téléverse.
 *
 * Usage :
 *   node scripts/import-repertoire.mjs <source.xlsx> [--api URL] [--out F] [--apply]
 *
 * Sans `--apply` le script s'arrête après la SIMULATION : rien n'est écrit.
 * Avec `--sans-envoi` il convertit seulement, sans se connecter à quoi que ce
 * soit — utile pour relire le classeur produit avant de le présenter au serveur.
 *
 * Le mot de passe est demandé au clavier et n'est ni journalisé, ni écrit sur
 * disque, ni passé en argument — un argument se retrouverait dans l'historique
 * du shell et dans `ps`.
 *
 * TROIS CONVERSIONS SONT DES APPROXIMATIONS ASSUMÉES, et le rapport les compte :
 *
 * 1. Le fichier terrain porte une RÉGION, l'import exige un DÉPARTEMENT. Les
 *    quatorze régions du Sénégal ont chacune un département homonyme, qui est
 *    leur chef-lieu : c'est celui qui est retenu. Un contact de Pikine rangé
 *    sous « Dakar » arrive donc dans le département Dakar. La précision n'est
 *    pas perdue, elle n'a jamais été dans le fichier.
 * 2. Une cellule à plusieurs numéros ne fait qu'UNE fiche, sur le premier. Les
 *    autres partent en notes plutôt qu'à la poubelle.
 * 3. L'issue d'un appel se DEVINE du commentaire libre : « injoignable »,
 *    « sans réponse », « pas intéressé ». Le rapport donne le décompte par
 *    issue avant tout envoi, justement pour qu'il soit relu.
 *
 * LES CHARGÉS DE COMPTE DU RÉPERTOIRE 2026 NE SONT PAS DES COMPTES.
 *
 * La colonne « CC en charge » du répertoire consolidé nomme six personnes
 * — khadim, balde, fall, yama, a sow, sala kelly — qui n'ont pas de compte
 * dans le CRM : c'étaient des intervenants de passage. Aucune ne se rapproche,
 * les 196 fiches concernées reviennent donc au compte qui importe, et le
 * rapport les liste avant l'envoi. C'est le comportement voulu, pas un défaut à
 * corriger : inventer un propriétaire fausserait les statistiques d'activité.
 * Un futur répertoire rempli par des téléconseillers déclarés se rapprochera
 * tout seul, sur l'identifiant, l'e-mail ou le nom complet.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import ExcelJS from 'exceljs';

const DEFAULT_API = 'https://go.cpi-chues.com';

// Cloudflare renvoie 1010 sur les agents non navigateurs.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Colonnes du modèle d'import, DANS L'ORDRE : le serveur les lit par rang. */
const CIBLE = [
  'Nom complet',
  'Téléphone',
  'Département',
  'IEF',
  'Notes',
  'Établissement',
  'Statut relation',
  'WhatsApp',
  'Chargé de compte',
  'Date du dernier appel',
  'Issue du dernier appel',
];

/**
 * L'issue d'appel que trahit un commentaire de terrain.
 *
 * Ordre SIGNIFIANT : « retraité souhaite devenir ambassadeur pas intéressé »
 * doit tomber sur le refus, pas sur l'intérêt. Le premier motif qui accroche
 * gagne, et ce qui n'accroche rien vaut « Joint » — le fichier ne date un
 * appel que lorsqu'il a eu lieu.
 */
const ISSUES = [
  [/faux numero|mauvais numero|numero erron/, 'Faux numéro'],
  [/injoignable|joignable|sonne dans le vide|sans reponse|\bnrp\b|ne repond|occupe/, 'Injoignable'],
  [/pas interess|non interess/, 'Refus'],
  [/a rappell?er|a relancer/, 'Autre'],
];

/**
 * La désignation d'un chargé de compte, débarrassée de sa civilité.
 *
 * Le même téléconseiller est écrit « mr balde », « Mr,Balde », « mr. balde » et
 * « M,Balde » selon la région. Une cellule qui en nomme deux (« A Sow /
 * M.FALL ») retient le premier : la fiche n'a qu'un propriétaire.
 */
const cleCharge = (brut) =>
  // La coupure se fait AVANT la normalisation : celle-ci efface la barre
  // oblique, et « A Sow / M.FALL » deviendrait un seul nom « a sow m fall ».
  normalise(brut.split('/')[0])
    .replace(/^(mr|mme|dr|m) /, '')
    .trim();

const OUI_NON = (valeur, siOui, siNon) => {
  const cle = normalise(valeur);
  if (cle === 'oui') return siOui;
  if (cle === 'non') return siNon;
  return '';
};

/** Colonnes reconnues dans le fichier source, par intitulé. */
const SOURCE = {
  nom: ['nom prenom', 'nom prenoms', 'nom et prenom', 'nom complet', 'prenom et nom'],
  telephone: ['numeros de telephone', 'numero de telephone', 'telephone', 'tel', 'contact'],
  region: ['region', 'departement'],
  etablissement: ['nom de l etablissement', 'etablissement', 'ecole', 'structure'],
  commentaires: ['commentaires', 'commentaire', 'observations'],
  whatsapp: ['compte whatsapp', 'whatsapp'],
  charge: ['cc en charge', 'charge', 'teleconseiller'],
  representant: ['representant cpi chues', 'representant cpi'],
  datecontact: ['date de contact', 'date du dernier appel', 'date d appel'],
};

const normalise = (valeur) =>
  String(valeur ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function texte(valeur) {
  if (valeur === null || valeur === undefined) return '';
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  if (typeof valeur === 'object') {
    if (typeof valeur.text === 'string') return valeur.text.trim();
    if ('result' in valeur) return texte(valeur.result);
    if (Array.isArray(valeur.richText)) {
      return valeur.richText
        .map((part) => part.text)
        .join('')
        .trim();
    }
  }
  return String(valeur).trim();
}

/**
 * Les numéros exploitables d'une cellule, dans l'ordre. Tableau vide si aucun.
 *
 * Le serveur normalise lui-même en E.164 ; ce découpage n'est là que pour ne
 * pas lui envoyer une cellule de trois numéros, dont il recollerait les
 * chiffres en un seul nombre absurde — sa liste de séparateurs contient « / ».
 */
function numerosDe(cellule) {
  return cellule
    .split(/[/;,\n]| ou /i)
    .map((part) => part.replace(/[^0-9+]/g, ''))
    .filter((part) => part.replace(/\D/g, '').length >= 9);
}

function lireArguments(argv) {
  const options = { api: DEFAULT_API, apply: false, sansEnvoi: false, source: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--sans-envoi') options.sansEnvoi = true;
    else if (arg === '--api') options.api = argv[(i += 1)];
    else if (arg === '--out') options.out = argv[(i += 1)];
    else if (!arg.startsWith('-')) options.source ??= arg;
  }
  if (!options.source) {
    console.error(
      'Usage : node scripts/import-repertoire.mjs <source.xlsx> [--api URL] [--out F] [--apply]',
    );
    process.exit(2);
  }
  options.api = options.api.replace(/\/+$/, '');
  options.out ??= options.source.replace(/\.xlsx$/i, '') + '.import.xlsx';
  return options;
}

const CTRL_C = 3;
const RETOUR_ARRIERE = new Set([8, 127]);

function demander(invite, masque) {
  return new Promise((resolve) => {
    process.stdout.write(invite);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let saisie = '';
    const onData = (morceau) => {
      for (const caractere of morceau) {
        const code = caractere.charCodeAt(0);
        if (caractere === '\r' || caractere === '\n') {
          stdin.removeListener('data', onData);
          stdin.setRawMode?.(false);
          stdin.pause();
          process.stdout.write('\n');
          resolve(saisie);
          return;
        }
        if (code === CTRL_C) {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (RETOUR_ARRIERE.has(code)) {
          if (saisie.length > 0) {
            saisie = saisie.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        saisie += caractere;
        process.stdout.write(masque ? '*' : caractere);
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Lit le fichier terrain et rend les lignes converties, plus les rejets.
 *
 * `comptes` rapproche les chargés de compte du répertoire des vrais comptes.
 * Un nom qu'il ne reconnaît pas est LAISSÉ VIDE et compté : le serveur rejette
 * une ligne dont le chargé de compte est introuvable, et perdre la fiche
 * entière pour une orthographe serait le pire des échanges.
 */
async function convertir(source, comptes) {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.read(createReadStream(source));

  const feuille =
    classeur.worksheets.find((f) => normalise(f.name) === 'contacts') ?? classeur.worksheets[0];
  if (!feuille) throw new Error('Le classeur ne contient aucune feuille.');

  const entetes = new Map();
  const premiere = feuille.getRow(1);
  for (let colonne = 1; colonne <= premiere.cellCount; colonne += 1) {
    const cle = normalise(texte(premiere.getCell(colonne).value));
    if (cle !== '' && !entetes.has(cle)) entetes.set(cle, colonne);
  }

  const rang = {};
  for (const [champ, libelles] of Object.entries(SOURCE)) {
    rang[champ] = libelles.map((libelle) => entetes.get(normalise(libelle))).find(Boolean) ?? null;
  }
  for (const requis of ['nom', 'telephone', 'region']) {
    if (rang[requis] === null) {
      throw new Error(
        `Colonne « ${SOURCE[requis][0]} » introuvable en ligne 1 de la feuille « ${feuille.name} ».`,
      );
    }
  }

  const lignes = [];
  const rejets = [];
  const stats = {
    regionsAmbigues: 0,
    numerosMultiples: 0,
    chargesInconnus: new Map(),
    appels: new Map(),
    relations: new Map(),
  };
  const compter = (table, cle) => table.set(cle, (table.get(cle) ?? 0) + 1);

  feuille.eachRow((ligne, numero) => {
    if (numero === 1) return;
    const cellule = (champ) => (rang[champ] ? texte(ligne.getCell(rang[champ]).value) : '');

    const nom = cellule('nom');
    const numeros = numerosDe(cellule('telephone'));
    if (nom.length < 2 || numeros.length === 0) {
      if (nom !== '' || cellule('telephone') !== '') {
        rejets.push({
          ligne: numero,
          nom,
          telephone: cellule('telephone'),
          motif: nom.length < 2 ? 'nom absent' : 'aucun numéro exploitable',
        });
      }
      return;
    }

    // Les régions composées (« Dakar / Thiès ») viennent de la fusion de deux
    // répertoires régionaux : la première est celle du répertoire d'origine.
    const regions = cellule('region')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
    if (regions.length > 1) stats.regionsAmbigues += 1;
    if (numeros.length > 1) stats.numerosMultiples += 1;

    const commentaire = cellule('commentaires');
    const notes = [
      commentaire,
      numeros.length > 1 ? `Autres numéros : ${numeros.slice(1).join(', ')}` : '',
      regions.length > 1 ? `Régions du répertoire : ${regions.join(' / ')}` : '',
    ]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 2000);

    const brutCharge = cellule('charge');
    let charge = '';
    if (brutCharge !== '') {
      const designation = cleCharge(brutCharge);
      const compte = comptes.get(normalise(designation));
      if (compte) charge = compte;
      else compter(stats.chargesInconnus, designation);
    }

    // Une issue ne s'écrit QU'AVEC sa date : sans elle le serveur refuse la
    // ligne, et le fichier ne date un appel que pour 141 contacts.
    const dateAppel = cellule('datecontact');
    const dit = normalise(commentaire);
    const issue =
      dateAppel === '' ? '' : (ISSUES.find(([motif]) => motif.test(dit))?.[1] ?? 'Joint');
    if (issue !== '') compter(stats.appels, issue);

    const relation = OUI_NON(cellule('representant'), 'Ambassadeur', 'Refus');
    if (relation !== '') compter(stats.relations, relation);

    lignes.push([
      nom.slice(0, 160),
      numeros[0],
      regions[0] ?? '',
      '',
      notes,
      cellule('etablissement').slice(0, 200),
      relation,
      OUI_NON(cellule('whatsapp'), 'Même numéro', 'Aucun'),
      charge,
      dateAppel,
      issue,
    ]);
  });

  return { lignes, rejets, stats, feuille: feuille.name };
}

async function ecrireClasseur(destination, lignes) {
  const classeur = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: destination });
  const feuille = classeur.addWorksheet('Représentants');
  feuille.columns = CIBLE.map((header) => ({ header, width: 28 }));
  // Ligne 2 SACRIFIÉE : le serveur commence à lire en ligne 3, où le modèle
  // officiel place sa ligne d'exemple grisée. Écrire une fiche ici la perdrait.
  feuille.addRow(CIBLE.map(() => '— ligne ignorée par le serveur —')).commit();
  for (const ligne of lignes) feuille.addRow(ligne).commit();
  feuille.commit();
  await classeur.commit();
}

async function ecrireRejets(destination, rejets) {
  const ligneCsv = (champs) =>
    champs.map((valeur) => String(valeur).replaceAll(';', ',')).join(';');
  const contenu = [
    ligneCsv(['ligne', 'nom', 'telephone', 'motif']),
    ...rejets.map((r) => ligneCsv([r.ligne, r.nom, r.telephone, r.motif])),
  ].join('\n');
  await pipeline(Readable.from([contenu + '\n']), createWriteStream(destination));
}

async function appelerApi(url, init = {}) {
  const reponse = await fetch(url, {
    ...init,
    headers: { 'user-agent': USER_AGENT, ...(init.headers ?? {}) },
  });
  const brut = await reponse.text();
  let corps;
  try {
    corps = JSON.parse(brut);
  } catch {
    corps = { message: brut.slice(0, 400) };
  }
  if (!reponse.ok) {
    throw new Error(`${url} → ${reponse.status} ${corps.message ?? JSON.stringify(corps)}`);
  }
  return corps;
}

function afficherRapport(rapport) {
  console.log(
    `  lues ${rapport.totalRows} · retenues ${rapport.valid} · rejetées ${rapport.rejected} ` +
      `· doublons ${rapport.duplicates} · créées ${rapport.created}`,
  );
  const parCode = new Map();
  for (const erreur of rapport.errors ?? []) {
    parCode.set(erreur.code, (parCode.get(erreur.code) ?? 0) + 1);
  }
  for (const [code, nombre] of parCode) {
    const exemple = rapport.errors.find((e) => e.code === code);
    console.log(`  ${code} ×${nombre} (ex. ligne ${exemple.line} : ${exemple.message})`);
  }
  for (const apercu of (rapport.preview ?? []).slice(0, 3)) {
    console.log(
      `  ligne ${apercu.line} : ${apercu.fullName} · ${apercu.phoneE164} · ` +
        `${apercu.departementName} · « ${apercu.etablissement ?? '—'} » · ` +
        `${apercu.relationStatus} · ${apercu.whatsappStatus} · ` +
        `appel ${apercu.calledAt?.slice(0, 10) ?? '—'}`,
    );
  }
}

/**
 * Les comptes actifs, indexés sur toutes leurs désignations.
 *
 * Le classeur terrain écrit « khadim », « mr balde » ou « M.FALL » : le
 * rapprochement doit donc tenter l'identifiant, l'e-mail ET le nom complet,
 * exactement comme le fait le serveur.
 */
async function chargerComptes(api, jeton) {
  const comptes = new Map();
  const auth = { authorization: `Bearer ${jeton}` };
  for (let page = 1; ; page += 1) {
    const lot = await appelerApi(`${api}/api/v1/users?page=${page}&pageSize=200`, { headers: auth });
    for (const compte of lot.items) {
      for (const designation of [compte.username, compte.email, compte.fullName]) {
        if (designation) comptes.set(normalise(designation), compte.username);
      }
    }
    if (lot.items.length < 200) return comptes;
  }
}

async function envoyer(api, jeton, fichier, nom, dryRun) {
  const formulaire = new FormData();
  formulaire.append('file', new Blob([await readFile(fichier)]), nom);
  return appelerApi(`${api}/api/v1/representants/import?dryRun=${dryRun ? 'true' : 'false'}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}` },
    body: formulaire,
  });
}

const options = lireArguments(process.argv.slice(2));

// La connexion vient AVANT la conversion : les chargés de compte du répertoire
// se rapprochent des vrais comptes, et un mot de passe refusé doit l'être avant
// dix secondes de lecture de classeur, pas après.
let session = null;
let comptes = new Map();
if (options.sansEnvoi) {
  console.log('Hors ligne : les chargés de compte ne seront pas rapprochés.');
} else {
  console.log(`Connexion à ${options.api}`);
  const identifiant = await demander('  identifiant admin : ', false);
  const motDePasse = await demander('  mot de passe : ', true);
  session = await appelerApi(`${options.api}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: identifiant, password: motDePasse }),
  });
  if (session.user.role !== 'ADMIN') {
    console.error(`Le compte « ${session.user.username} » est ${session.user.role}, pas ADMIN.`);
    process.exit(1);
  }
  console.log(`  connecté : ${session.user.fullName} (${session.user.role})`);

  comptes = await chargerComptes(options.api, session.accessToken);
  console.log(`  ${new Set(comptes.values()).size} comptes actifs`);
}

console.log(`\nLecture de ${options.source}`);
const { lignes, rejets, stats, feuille } = await convertir(options.source, comptes);
console.log(
  `  feuille « ${feuille} » · ${lignes.length} fiches converties · ${rejets.length} rejets`,
);
console.log(`  ${stats.regionsAmbigues} régions composées → première région retenue`);
console.log(`  ${stats.numerosMultiples} cellules multi-numéros → 1er numéro, les autres en notes`);
const liste = (table) =>
  [...table.entries()].map(([cle, nombre]) => `${cle} ×${nombre}`).join(', ') || 'aucun';
console.log(`  relations : ${liste(stats.relations)}`);
console.log(`  appels datés : ${liste(stats.appels)}`);
if (stats.chargesInconnus.size > 0) {
  console.log(`  chargés de compte NON RECONNUS, laissés vides : ${liste(stats.chargesInconnus)}`);
}
console.log('  RAPPEL : la région sert de département. Chef-lieu pour tout le monde.');

if (lignes.length === 0) {
  console.error('Aucune fiche exploitable. Rien à envoyer.');
  process.exit(1);
}

await ecrireClasseur(options.out, lignes);
console.log(`Écrit ${options.out}`);
if (rejets.length > 0) {
  const chemin = options.out.replace(/\.xlsx$/i, '.rejets.csv');
  await ecrireRejets(chemin, rejets);
  console.log(`Écrit ${chemin}`);
}

if (options.sansEnvoi) {
  console.log('\nRien n’a été envoyé (--sans-envoi).');
  process.exit(0);
}

const nomEnvoye = path.basename(options.out);
console.log('\nSimulation (rien n’est écrit)');
afficherRapport(await envoyer(options.api, session.accessToken, options.out, nomEnvoye, true));

if (!options.apply) {
  console.log('\nRelancez avec --apply pour écrire.');
  process.exit(0);
}

const confirmation = await demander('\nÉcrire en base ? tapez OUI : ', false);
if (confirmation.trim() !== 'OUI') {
  console.log('Abandonné. Rien n’a été écrit.');
  process.exit(0);
}

console.log('\nÉcriture');
afficherRapport(await envoyer(options.api, session.accessToken, options.out, nomEnvoye, false));
