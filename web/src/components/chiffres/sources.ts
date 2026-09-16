import type { components } from '@crm/api-client';

import type {
  CatalogueEntree,
  DonneesSource,
  EquipeLigne,
} from '@/components/accueil/tableau-de-bord/sources';
import { activityLines, formatDuration } from '@/lib/data/admin';
import type {
  ChiffresActivite,
  ChiffresBanques,
  ChiffresCampagne,
  ChiffresCampagnes,
  ChiffresCreneaux,
  ChiffresDelais,
  ChiffresEnrolement,
  ChiffresEntonnoir,
  ChiffresMethodes,
  ChiffresRendement,
  ChiffresRepresentants,
  ChiffresTotaux,
  CouvertureCampagne,
} from '@/lib/data/chiffres';
import type { ComptageOuvertures } from '@/lib/data/ouvertures';
import { formatDecimal, formatNumber, formatShortDate } from '@/lib/format';
import { formatXof } from '@/lib/money';
import type { Projet, Role } from '@/lib/types';

type ChiffreSource = components['schemas']['DashboardSource'];

/** Une requête, et les cartes qui en vivent. Rien d'autre n'est lancé. */
export type Jeu =
  | 'activite'
  | 'entonnoir'
  | 'delais'
  | 'rendement'
  | 'methodes'
  | 'banques'
  | 'campagne'
  | 'campagnes'
  | 'creneaux'
  | 'representants'
  | 'ouvertures'
  | 'enrolement';

export interface Jeux {
  activite?: ChiffresActivite;
  entonnoir?: ChiffresEntonnoir;
  delais?: ChiffresDelais;
  rendement?: ChiffresRendement;
  methodes?: ChiffresMethodes;
  banques?: ChiffresBanques;
  campagne?: ChiffresCampagne;
  campagnes?: ChiffresCampagnes;
  creneaux?: ChiffresCreneaux;
  representants?: ChiffresRepresentants;
  ouvertures?: ComptageOuvertures[];
  enrolement?: ChiffresEnrolement;
}

export interface SourceChiffre extends CatalogueEntree {
  jeu: Jeu;
  description: string;
  groupe: string;
  /** `null` tant que le jeu n'est pas arrivé : la carte montre son squelette. */
  extraire: (jeux: Jeux) => DonneesSource | null;
}

/** `formatXof` lit une suite de chiffres, pas un flottant de fin d'interpolation. */
const francs = (montant: number): string => formatXof(String(Math.round(montant)));

const taux = (valeur: number | null): string =>
  valeur === null ? 'Sans objet' : `${formatDecimal(valeur)} %`;

/** Même arrondi que le serveur : un taux d'équipe se relit sur les sommes. */
const part = (valeur: number, total: number): number | null =>
  total === 0 ? null : Math.round((valeur / total) * 1000) / 10;

const scalaire = (libelle: string, valeur: number): DonneesSource => ({
  forme: 'scalaire',
  donnee: { libelle, valeur },
});

/** Un taux en tuile : le pourcentage en grand, numérateur et dénominateur dessous. « Sans objet » sans dénominateur, jamais « 0 % ». */
const scalaireTaux = (
  valeur: number | null,
  libelle: string,
  sansDenominateur: string,
): DonneesSource => ({
  forme: 'scalaire',
  donnee: {
    libelle: valeur === null ? sansDenominateur : libelle,
    valeur: valeur ?? 0,
    affichage: taux(valeur),
  },
});

/** Une durée en tuile : le texte remplace le nombre, « Sans objet » sans mesure. */
const scalaireDuree = (secondes: number | null, libelle: string): DonneesSource => ({
  forme: 'scalaire',
  donnee: { libelle, valeur: secondes ?? 0, affichage: formatDuration(secondes) },
});

const COLONNES_CHUES = [
  'Appels représentants',
  'Joignabilité',
  'Acceptés',
  'À rappeler',
  'Acceptation',
  'Prospects saisis',
  'Méthodes obtenues',
] as const;

const COLONNES_GRAND_PUBLIC = [
  'Appels prospects',
  'Joignabilité',
  'Prospects saisis',
  'Méthodes obtenues',
] as const;

type Cumul = Pick<
  ChiffresTotaux,
  | 'repCalls'
  | 'repFiches'
  | 'repFichesJointes'
  | 'repFichesAcceptees'
  | 'repFichesARappeler'
  | 'repFichesEligibles'
  | 'calls'
  | 'fiches'
  | 'fichesJointes'
  | 'prospectsCreated'
  | 'methodObtained'
>;

const CUMUL_VIDE: Cumul = {
  repCalls: 0,
  repFiches: 0,
  repFichesJointes: 0,
  repFichesAcceptees: 0,
  repFichesARappeler: 0,
  repFichesEligibles: 0,
  calls: 0,
  fiches: 0,
  fichesJointes: 0,
  prospectsCreated: 0,
  methodObtained: 0,
};

function cellules(cumul: Cumul, chues: boolean): EquipeLigne['cellules'] {
  const textes = chues
    ? [
        formatNumber(cumul.repCalls),
        taux(part(cumul.repFichesJointes, cumul.repFiches)),
        formatNumber(cumul.repFichesAcceptees),
        formatNumber(cumul.repFichesARappeler),
        taux(part(cumul.repFichesAcceptees, cumul.repFichesEligibles)),
        formatNumber(cumul.prospectsCreated),
        formatNumber(cumul.methodObtained),
      ]
    : [
        formatNumber(cumul.calls),
        taux(part(cumul.fichesJointes, cumul.fiches)),
        formatNumber(cumul.prospectsCreated),
        formatNumber(cumul.methodObtained),
      ];
  const colonnes = chues ? COLONNES_CHUES : COLONNES_GRAND_PUBLIC;
  return textes.map((texte, index) => ({ cle: colonnes[index] ?? String(index), texte }));
}

/**
 * Les lignes se somment par téléconseiller sur la fenêtre demandée, y compris
 * les fiches : une fiche n'est attribuée qu'une fois, à qui a posé son dernier
 * statut. Le pied reprend `totals`, calculé par le serveur.
 */
function tableauEquipe(activite: ChiffresActivite, chues: boolean): DonneesSource {
  const cumul = new Map<string, Cumul>();
  for (const ligne of activite.items) {
    const courant = cumul.get(ligne.teleconseillerId) ?? { ...CUMUL_VIDE };
    for (const cle of Object.keys(CUMUL_VIDE) as (keyof Cumul)[]) courant[cle] += ligne[cle];
    cumul.set(ligne.teleconseillerId, courant);
  }

  return {
    forme: 'equipe',
    donnee: {
      colonnes: [...(chues ? COLONNES_CHUES : COLONNES_GRAND_PUBLIC)],
      lignes: activite.teleconseillers.map((personne) => ({
        id: personne.id,
        nom: personne.fullName,
        cellules: cellules(cumul.get(personne.id) ?? CUMUL_VIDE, chues),
      })),
      pied: { id: 'equipe', nom: 'Équipe', cellules: cellules(activite.totals, chues) },
    },
  };
}

/** EB-13 : le compte se lit par téléconseiller ET par jour, jamais cumulé. */
function matriceOuvertures(lignes: readonly ComptageOuvertures[]): DonneesSource {
  const jours = [...new Set(lignes.map((ligne) => ligne.jour))].sort();
  const noms = new Map(lignes.map((ligne) => [ligne.openedById, ligne.openedByName]));
  const comptes = new Map(
    lignes.map((ligne) => [`${ligne.openedById}|${ligne.jour}`, ligne.ouvertures]),
  );

  return {
    forme: 'matrice',
    donnee: {
      lignes: [...noms.values()],
      colonnes: jours.map((jour) => formatShortDate(jour)),
      cellules: [...noms.entries()].flatMap(([id, nom]) =>
        jours.map((jour) => ({
          ligne: nom,
          colonne: formatShortDate(jour),
          value: comptes.get(`${id}|${jour}`) ?? 0,
        })),
      ),
    },
  };
}

/** Une ligne par téléconseiller, une colonne par créneau, le taux de joignabilité dans la case. */
function matriceCreneaux(creneaux: ChiffresCreneaux): DonneesSource {
  const lignes = creneaux.activites.map((activite) => activityLines(activite));
  const noms = [...new Set(lignes.flat().map((ligne) => ligne.name))].sort();
  const colonnes = creneaux.creneaux.map(
    (creneau) => `${creneau.label} ${creneau.start}–${creneau.end}`,
  );
  return {
    forme: 'matrice',
    donnee: {
      lignes: noms,
      colonnes,
      cellules: noms.flatMap((nom) =>
        colonnes.map((colonne, index) => ({
          ligne: nom,
          colonne,
          value: lignes[index]?.find((ligne) => ligne.name === nom)?.repReachabilityRate ?? 0,
        })),
      ),
    },
  };
}

const sommeOuvertures = (
  lignes: readonly ComptageOuvertures[],
  cle: 'ouvertures' | 'qualifiees' | 'liberees',
): number => lignes.reduce((total, ligne) => total + ligne[cle], 0);

/** DMT d'équipe pondérée par les fiches qualifiées de chaque ligne, jamais une moyenne de moyennes. */
function dureeMoyenneSurLaFiche(lignes: readonly ComptageOuvertures[]): number | null {
  const mesurees = lignes.filter((ligne) => ligne.dureeMoyenneSecondes !== null);
  const poids = sommeOuvertures(mesurees, 'qualifiees');
  if (poids === 0) return null;
  const total = mesurees.reduce(
    (cumul, ligne) => cumul + (ligne.dureeMoyenneSecondes ?? 0) * ligne.qualifiees,
    0,
  );
  return Math.round(total / poids);
}

const partsStock = (parts: ChiffresRepresentants['parDepartement']): DonneesSource => ({
  forme: 'classement',
  donnee: parts
    .filter((p) => p.count > 0)
    .map((p) => ({ id: p.id, label: p.label, value: p.count })),
});

/** Les colonnes suivent le projet : sans représentant, aucun des taux CHUES n'a de sujet. */
const parTeleconseiller = (chues: boolean): SourceChiffre => ({
  label: 'Par téléconseiller',
  forme: 'equipe',
  jeu: 'activite',
  description: chues
    ? 'Une ligne par téléconseiller : appels aux représentants, joignabilité, acceptés, à rappeler, acceptation, prospects saisis, méthodes obtenues. Équipe en pied.'
    : 'Une ligne par téléconseiller, équipe en pied.',
  groupe: 'Équipe',
  extraire: ({ activite }) => (activite === undefined ? null : tableauEquipe(activite, chues)),
});

/** La même phrase que le détail d'une campagne : appelées sur confiées, appels consignés. */
function couvertureDeLaCampagne(campagne: CouvertureCampagne): string {
  const pluriel = (nombre: number): string => (nombre > 1 ? 's' : '');
  return (
    `${formatNumber(campagne.fichesAppelees)} fiche${pluriel(campagne.fichesAppelees)} ` +
    `appelée${pluriel(campagne.fichesAppelees)} sur ${formatNumber(campagne.itemCount)}, ` +
    `${formatNumber(campagne.callsSince)} appel${pluriel(campagne.callsSince)} ` +
    `consigné${pluriel(campagne.callsSince)}.`
  );
}

/** Le rendement de la fenêtre, puis la couverture de la campagne depuis sa création. */
function detailDeLaCampagne(campagne: ChiffresCampagnes['items'][number]): string {
  const rendement =
    `${formatNumber(campagne.traitees)} traitées sur ${formatNumber(campagne.prevues)} · ` +
    `${taux(part(campagne.traitees, campagne.prevues))}`;
  if (campagne.couverture === undefined) return rendement;
  return `${rendement} · ${couvertureDeLaCampagne(campagne.couverture)}`;
}

/**
 * Le catalogue de l'écran « Chiffres ». Une entrée par carte, et rien qui ne
 * soit pas une carte : tout ce qui s'affiche se déplace et se retire.
 */
const SOURCES_CHIFFRES = {
  'taux-de-contact': {
    label: 'Taux de contact',
    forme: 'scalaire',
    jeu: 'campagnes',
    description:
      'Fiches appelées ÷ fiches prévues par les campagnes de la période. Peut dépasser 100 %.',
    groupe: 'Campagnes',
    extraire: ({ campagnes }) =>
      campagnes === undefined
        ? null
        : scalaireTaux(
            campagnes.totals.contactRate,
            `${formatNumber(campagnes.totals.appelees)} appelées sur ${formatNumber(campagnes.totals.prevues)} fiches prévues`,
            'Aucune campagne sur la période',
          ),
  },
  'taux-de-joignabilite-representants': {
    label: 'Taux de joignabilité des représentants',
    forme: 'scalaire',
    jeu: 'activite',
    description:
      'Fiches jointes ÷ fiches appelées, sur le dernier statut de la période. Refus et faux numéro comptent comme joints.',
    groupe: 'Appels aux représentants',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.repReachabilityRate,
            `${formatNumber(activite.totals.repFichesJointes)} joints sur ${formatNumber(activite.totals.repFiches)} fiches`,
            'Aucun représentant appelé sur la période',
          ),
  },
  'taux-d-acceptation': {
    label: 'Taux d’acceptation',
    forme: 'scalaire',
    jeu: 'activite',
    description:
      'Fiches Accepté ÷ fiches jointes, hors Faux numéro, Décédé, Retraité, Hors cible et Affecté ailleurs.',
    groupe: 'Appels aux représentants',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.repAcceptanceRate,
            `${formatNumber(activite.totals.repFichesAcceptees)} acceptent sur ${formatNumber(activite.totals.repFichesEligibles)} joints`,
            'Aucun représentant joint sur la période',
          ),
  },
  'taux-de-rappel': {
    label: 'Taux de rappel',
    forme: 'scalaire',
    jeu: 'activite',
    description:
      'Fiches À rappeler ÷ fiches appelées. Dessous, les rappels à venir, tenus et en retard.',
    groupe: 'Appels aux représentants',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.repCallbackFicheRate,
            `${formatNumber(activite.totals.repFichesARappeler)} à rappeler sur ${formatNumber(activite.totals.repFiches)} fiches · ${formatNumber(activite.totals.repCallbacksUpcoming)} à venir, ${formatNumber(activite.totals.repCallbacksHonored)} tenus, ${formatNumber(activite.totals.repCallbacksLate)} en retard`,
            'Aucun représentant appelé sur la période',
          ),
  },
  'repartition-statuts-qualification': {
    label: 'Répartition des statuts de qualification',
    forme: 'classement',
    jeu: 'activite',
    description: 'Une part par statut de qualification, sur le dernier appel de la période.',
    groupe: 'Appels aux représentants',
    extraire: ({ activite }) => {
      if (activite === undefined || activite.repQualificationStatuses === null) return null;
      return {
        forme: 'classement',
        donnee:
          activite.repQualificationStatuses.total === 0
            ? []
            : activite.repQualificationStatuses.items.map((item) => ({
                id: item.id,
                label: item.label,
                value: item.count,
              })),
      };
    },
  },
  'joints-non-joints': {
    label: 'Joints et non joints',
    forme: 'classement',
    jeu: 'activite',
    description: 'Fiches jointes et fiches non jointes, sur le dernier statut de la période.',
    groupe: 'Appels aux représentants',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : {
            forme: 'classement',
            donnee:
              activite.totals.repFiches === 0
                ? []
                : [
                    { id: 'joints', label: 'Joints', value: activite.totals.repFichesJointes },
                    {
                      id: 'non-joints',
                      label: 'Non joints',
                      value: activite.totals.repFichesNonJointes,
                    },
                  ],
          },
  },
  'statuts-par-famille': {
    label: 'Statuts par famille',
    forme: 'composition',
    jeu: 'activite',
    description: 'Les statuts de chaque famille, joint et non joint, empilés.',
    groupe: 'Appels aux représentants',
    extraire: ({ activite }) => {
      if (activite === undefined || activite.repQualificationStatuses === null) return null;
      const items = activite.repQualificationStatuses.items;
      const segments = (famille: 'JOINT' | 'NON_JOINT') =>
        items
          .filter((item) => item.famille === famille && item.count > 0)
          .map((item) => ({ id: item.id, label: item.label, value: item.count }));
      return {
        forme: 'composition',
        donnee: [
          { ligne: 'Joint', segments: segments('JOINT') },
          { ligne: 'Non joint', segments: segments('NON_JOINT') },
        ],
      };
    },
  },
  'joignabilite-par-creneau': {
    label: 'Joignabilité par créneau',
    forme: 'matrice',
    jeu: 'creneaux',
    description: 'Fiches jointes ÷ fiches appelées, par téléconseiller et par créneau.',
    groupe: 'Appels aux représentants',
    extraire: ({ creneaux }) => (creneaux === undefined ? null : matriceCreneaux(creneaux)),
  },
  'taux-d-exploitation': {
    label: 'Taux d’exploitation',
    forme: 'composition',
    jeu: 'campagnes',
    description:
      'Un camembert par campagne : fiches traitées ÷ fiches de la campagne, et sa couverture depuis la création. Le camembert ouvre sa campagne.',
    groupe: 'Campagnes',
    lien: (id) => `/teleconseil/campagnes/${id}`,
    extraire: ({ campagnes }) =>
      campagnes === undefined
        ? null
        : {
            forme: 'composition',
            donnee: campagnes.items.map((campagne) => ({
              id: campagne.id,
              ligne: campagne.name,
              detail: detailDeLaCampagne(campagne),
              segments: [
                { id: 'traitees', label: 'Traitées', value: campagne.traitees },
                {
                  id: 'restantes',
                  label: 'Restantes',
                  value: Math.max(0, campagne.prevues - campagne.traitees),
                },
              ],
            })),
          },
  },
  'representants-par-departement': {
    label: 'Représentants par département',
    forme: 'classement',
    jeu: 'representants',
    description: 'Stock des représentants par département, hors période.',
    groupe: 'Représentants',
    extraire: ({ representants }) =>
      representants === undefined ? null : partsStock(representants.parDepartement),
  },
  'representants-par-ief': {
    label: 'Représentants par IEF',
    forme: 'classement',
    jeu: 'representants',
    description: 'Stock des représentants par IEF, hors période.',
    groupe: 'Représentants',
    extraire: ({ representants }) =>
      representants === undefined ? null : partsStock(representants.parIef),
  },
  'representants-jamais-appeles': {
    label: 'Représentants jamais appelés',
    forme: 'scalaire',
    jeu: 'representants',
    description: 'Représentants sans aucun appel, hors période.',
    groupe: 'Représentants',
    extraire: ({ representants }) =>
      representants === undefined
        ? null
        : scalaire(
            `sur ${formatNumber(representants.total)} représentants`,
            representants.jamaisAppeles,
          ),
  },
  'representants-injoignables': {
    label: 'Représentants injoignables',
    forme: 'scalaire',
    jeu: 'representants',
    description:
      'Représentants au dernier statut non joint, hors Injoignable définitif. Hors période.',
    groupe: 'Représentants',
    extraire: ({ representants }) =>
      representants === undefined
        ? null
        : scalaire(
            `sur ${formatNumber(representants.total)} représentants`,
            representants.injoignables,
          ),
  },
  'taux-de-qualification': {
    label: 'Taux de qualification',
    forme: 'scalaire',
    jeu: 'ouvertures',
    description:
      'Ouvertures closes par un appel consigné ÷ ouvertures. Une fiche rouverte compte à chaque ouverture ; l’écart avec 100 % : les sorties forcées.',
    groupe: 'Fiches',
    extraire: ({ ouvertures }) => {
      if (ouvertures === undefined) return null;
      const ouvertes = sommeOuvertures(ouvertures, 'ouvertures');
      const qualifiees = sommeOuvertures(ouvertures, 'qualifiees');
      return scalaireTaux(
        part(qualifiees, ouvertes),
        `${formatNumber(qualifiees)} qualifiées sur ${formatNumber(ouvertes)} ouvertures`,
        'Aucune ouverture sur la période',
      );
    },
  },
  'duree-moyenne-sur-la-fiche': {
    label: 'Durée moyenne sur la fiche',
    forme: 'scalaire',
    jeu: 'ouvertures',
    description: 'Temps de la première saisie à la qualification ÷ fiches qualifiées.',
    groupe: 'Fiches',
    extraire: ({ ouvertures }) =>
      ouvertures === undefined
        ? null
        : scalaireDuree(
            dureeMoyenneSurLaFiche(ouvertures),
            `sur ${formatNumber(sommeOuvertures(ouvertures, 'qualifiees'))} fiches qualifiées`,
          ),
  },
  'duree-moyenne-de-communication': {
    label: 'Durée moyenne de communication',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'Durées d’appel lues au journal du téléphone ÷ appels retrouvés.',
    groupe: 'Appels',
    extraire: ({ activite }) => {
      if (activite === undefined) return null;
      const t = activite.totals;
      const appels = t.confirmedCalls + t.repConfirmedCalls;
      const secondes =
        appels === 0
          ? null
          : Math.round(
              ((t.avgCallSeconds ?? 0) * t.confirmedCalls +
                (t.repAvgCallSeconds ?? 0) * t.repConfirmedCalls) /
                appels,
            );
      return scalaireDuree(secondes, `sur ${formatNumber(appels)} appels retrouvés au journal`);
    },
  },
  'appels-par-jour': {
    label: 'Appels par jour',
    forme: 'serie-temporelle',
    jeu: 'activite',
    description: 'Appels passés par jour, représentants et prospects confondus.',
    groupe: 'Appels',
    extraire: ({ activite }) => {
      if (activite === undefined) return null;
      const parJour = new Map<string, number>();
      for (const ligne of activite.items) {
        parJour.set(ligne.bucket, (parJour.get(ligne.bucket) ?? 0) + ligne.calls + ligne.repCalls);
      }
      return {
        forme: 'serie-temporelle',
        donnee: [...parJour.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([jour, value]) => ({ id: jour, label: formatShortDate(jour), value })),
      };
    },
  },
  'taux-de-joignabilite': {
    label: 'Taux de joignabilité des prospects',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'Prospects joints ÷ prospects appelés, sur le dernier appel de la période.',
    groupe: 'Appels aux prospects',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.ficheReachRate,
            `${formatNumber(activite.totals.fichesJointes)} joints sur ${formatNumber(activite.totals.fiches)} prospects appelés`,
            'Aucun appel à un prospect sur la période',
          ),
  },
  'prospects-notes': {
    label: 'Prospects saisis',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'Fiches prospect saisies sur la période.',
    groupe: 'Saisie',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire('fiches saisies sur la période', activite.totals.prospectsCreated),
  },
  adhesions: {
    label: 'Méthodes obtenues',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'Appels aux prospects terminés par une méthode d’adhésion obtenue.',
    groupe: 'Appels aux prospects',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire(
            `sur ${formatNumber(activite.totals.calls)} appels aux prospects`,
            activite.totals.methodObtained,
          ),
  },
  'par-teleconseiller': parTeleconseiller(false),
  'fiches-ouvertes': {
    label: 'Fiches ouvertes',
    forme: 'matrice',
    jeu: 'ouvertures',
    description: 'Ouvertures confirmées, par téléconseiller et par jour. Une réouverture compte.',
    groupe: 'Équipe',
    extraire: ({ ouvertures }) => (ouvertures === undefined ? null : matriceOuvertures(ouvertures)),
  },
  'couverture-derniere-campagne': {
    label: 'Couverture de la campagne',
    forme: 'composition',
    jeu: 'campagne',
    description:
      'Fiches appelées et fiches restantes par téléconseiller, sur la campagne choisie ou sur la dernière lancée, quelle que soit la période.',
    groupe: 'Campagnes',
    extraire: ({ campagne }) =>
      campagne == null
        ? null
        : {
            forme: 'composition',
            resume: couvertureDeLaCampagne(campagne),
            donnee: campagne.performance.map((ligne) => ({
              ligne: ligne.teleconseillerName,
              segments: [
                { id: 'traitees', label: 'Traitées', value: ligne.treated },
                {
                  id: 'restantes',
                  label: 'Restantes',
                  value: Math.max(0, ligne.assigned - ligne.treated),
                },
              ],
            })),
          },
  },
  'hors-attribution-derniere-campagne': {
    label: 'Appels hors attribution',
    forme: 'classement',
    jeu: 'campagne',
    description:
      'Appels sur la fiche d’un collègue, sur la campagne choisie ou sur la dernière lancée, quelle que soit la période.',
    groupe: 'Campagnes',
    extraire: ({ campagne }) =>
      campagne == null
        ? null
        : {
            forme: 'classement',
            donnee: campagne.performance.map((ligne) => ({
              id: ligne.teleconseillerId,
              label: ligne.teleconseillerName,
              value: ligne.outsideAssignmentCalls,
            })),
          },
  },
  encaisse: {
    label: 'Encaissé',
    forme: 'scalaire',
    jeu: 'entonnoir',
    description: 'Montant encaissé sur les dossiers terminés.',
    groupe: 'Résultats',
    extraire: ({ entonnoir }) =>
      entonnoir === undefined
        ? null
        : {
            forme: 'scalaire',
            donnee: {
              libelle: `sur ${formatNumber(entonnoir.finance.dossiersEncaisses)} dossiers`,
              valeur: Number(entonnoir.finance.montantEncaisse),
              affichage: { valeur: Number(entonnoir.finance.montantEncaisse), format: francs },
            },
          },
  },
  'de-l-appel-a-l-encaissement': {
    label: 'De l’appel à l’encaissement',
    forme: 'classement',
    jeu: 'entonnoir',
    description: 'Dossiers à chaque étape, du premier appel au paiement.',
    groupe: 'Résultats',
    extraire: ({ entonnoir }) =>
      entonnoir === undefined
        ? null
        : {
            forme: 'classement',
            donnee:
              (entonnoir.etapes[0]?.count ?? 0) === 0
                ? []
                : entonnoir.etapes.map((etape) => ({
                    id: etape.label,
                    label: etape.label,
                    value: etape.count,
                  })),
          },
  },
  'methodes-d-adhesion': {
    label: 'Méthodes d’adhésion',
    forme: 'composition',
    jeu: 'methodes',
    description: 'Prospects par méthode d’adhésion choisie.',
    groupe: 'Résultats',
    extraire: ({ methodes }) =>
      methodes === undefined
        ? null
        : {
            forme: 'composition',
            donnee: [
              {
                ligne: 'Méthodes',
                segments: methodes.items.map((item) => ({
                  id: item.method,
                  label: item.label,
                  value: item.prospects,
                })),
              },
            ],
          },
  },
  'par-banque': {
    label: 'Par banque',
    forme: 'composition',
    jeu: 'banques',
    description: 'Comparer la répartition des dossiers entre les banques.',
    groupe: 'Analyses',
    extraire: ({ banques }) =>
      banques === undefined
        ? null
        : {
            forme: 'composition',
            donnee: [
              {
                ligne: 'Banques',
                segments: banques.items.map((item) => ({
                  id: item.id ?? item.label,
                  label: item.label,
                  value: item.prospects,
                })),
              },
            ],
          },
  },
  'delais-medians': {
    label: 'Délais médians',
    forme: 'classement',
    jeu: 'delais',
    description: 'Repérer l’étape qui prend le plus de temps.',
    groupe: 'Analyses',
    extraire: ({ delais }) =>
      delais === undefined
        ? null
        : {
            forme: 'classement',
            donnee: delais.legs.flatMap((leg) =>
              leg.medianDays === null
                ? []
                : [{ id: leg.leg, label: leg.label, value: leg.medianDays }],
            ),
          },
  },
  'rendement-par-departement': {
    label: 'Rendement par département',
    forme: 'classement',
    jeu: 'rendement',
    description: 'Prospects convertis ÷ prospects, par département.',
    groupe: 'Analyses',
    extraire: ({ rendement }) =>
      rendement === undefined
        ? null
        : {
            forme: 'classement',
            donnee: rendement.items.flatMap((row) =>
              row.conversionRate === null
                ? []
                : [{ id: row.id, label: row.label, value: row.conversionRate }],
            ),
          },
  },

  // ─── Enrôlement, lu sur les plateformes ─────────────────────────────────
  'enrolement-inscriptions': {
    label: 'Inscriptions sur la plateforme',
    forme: 'scalaire',
    jeu: 'enrolement',
    description: 'Le nombre de personnes inscrites sur la plateforme d’enrôlement du projet.',
    groupe: 'Enrôlement',
    extraire: ({ enrolement }) =>
      enrolement === undefined
        ? null
        : scalaire('inscriptions lues sur la plateforme', enrolement.inscriptions),
  },
  'enrolement-taux-rapprochement': {
    label: 'Inscriptions reconnues',
    forme: 'scalaire',
    jeu: 'enrolement',
    description:
      'La part des inscriptions qu’on retrouve sur une fiche prospect, par le téléphone puis par l’e-mail. Le reste vient de personnes qui ne sont pas passées par nos appels.',
    groupe: 'Enrôlement',
    extraire: ({ enrolement }) =>
      enrolement === undefined
        ? null
        : scalaireTaux(
            enrolement.tauxRapprochement,
            `${formatNumber(enrolement.rapprochees)} inscriptions reconnues sur ${formatNumber(enrolement.inscriptions)}`,
            'Aucune inscription sur la période',
          ),
  },
  'enrolement-taux-conversion': {
    label: 'Convertis puis inscrits',
    forme: 'scalaire',
    jeu: 'enrolement',
    description:
      'La part des prospects convertis, méthode d’enrôlement obtenue, qui vont jusqu’à s’inscrire sur la plateforme. C’est la mesure de la marche entre l’appel et l’enrôlement.',
    groupe: 'Enrôlement',
    extraire: ({ enrolement }) =>
      enrolement === undefined
        ? null
        : scalaireTaux(
            enrolement.tauxConversion,
            `${formatNumber(enrolement.rapprochees)} prospects convertis retrouvés inscrits`,
            'Aucun prospect converti sur la période',
          ),
  },
  'enrolement-par-jour': {
    label: 'Inscriptions par jour',
    forme: 'serie-temporelle',
    jeu: 'enrolement',
    description: 'Voir si le rythme des inscriptions suit celui des appels.',
    groupe: 'Enrôlement',
    extraire: ({ enrolement }) =>
      enrolement === undefined
        ? null
        : {
            forme: 'serie-temporelle',
            donnee: enrolement.parJour.map((point) => ({
              id: point.jour,
              label: point.jour,
              value: point.inscriptions,
            })),
          },
  },
  'enrolement-par-etape': {
    label: 'Dossiers par étape',
    forme: 'composition',
    jeu: 'enrolement',
    description: 'Repérer l’étape où les dossiers s’accumulent sur la plateforme.',
    groupe: 'Enrôlement',
    extraire: ({ enrolement }) =>
      enrolement === undefined
        ? null
        : {
            forme: 'composition',
            donnee: [
              {
                ligne: 'Étapes',
                segments: enrolement.parEtape.map((etape) => ({
                  id: etape.id,
                  label: etape.label,
                  value: etape.inscriptions,
                })),
              },
            ],
          },
  },
  'enrolement-par-teleconseiller': {
    label: 'Inscriptions par téléconseiller',
    forme: 'classement',
    jeu: 'enrolement',
    description:
      'À qui revient chaque inscription reconnue : le téléconseiller qui a obtenu la méthode d’enrôlement, à défaut celui qui a saisi la fiche.',
    groupe: 'Enrôlement',
    extraire: ({ enrolement }) =>
      enrolement === undefined
        ? null
        : {
            forme: 'classement',
            donnee: enrolement.parTeleconseiller.map((ligne) => ({
              id: ligne.id,
              label: ligne.label,
              value: ligne.inscriptions,
            })),
          },
  },
} satisfies Partial<Record<ChiffreSource, SourceChiffre>>;

/** Un représentant n'existe que dans CHUES : ces taux seraient vides ailleurs. */
const SOURCES_CHUES_SEULEMENT: readonly string[] = [
  'taux-de-contact',
  'taux-de-joignabilite-representants',
  'taux-d-acceptation',
  'taux-de-rappel',
  'repartition-statuts-qualification',
  'joints-non-joints',
  'statuts-par-famille',
  'joignabilite-par-creneau',
  'taux-d-exploitation',
  'representants-par-departement',
  'representants-par-ief',
  'representants-jamais-appeles',
  'representants-injoignables',
];

/** Les montants ne s'ouvrent qu'à la direction, comme la disposition d'usine du serveur. */
const SOURCES_MONTANTS: readonly string[] = ['encaisse', 'de-l-appel-a-l-encaissement'];

/**
 * Ce que les plateformes d'enrôlement rendent ne sort pas de la cellule
 * pilotage, qui tient le rôle ADMIN. L'API qui alimente ces cartes refuse tout
 * autre rôle : ce filtre évite de proposer une carte qui répondrait 403.
 */
const SOURCES_ENROLEMENT: readonly string[] = [
  'enrolement-inscriptions',
  'enrolement-taux-rapprochement',
  'enrolement-taux-conversion',
  'enrolement-par-jour',
  'enrolement-par-etape',
  'enrolement-par-teleconseiller',
];

export function catalogueDe(input: {
  chues: boolean;
  voitLesMontants: boolean;
  role: Role;
  projet: Projet | null;
}): Record<string, SourceChiffre> {
  const entrees = Object.entries(SOURCES_CHIFFRES).filter(([cle]) => {
    if (!input.chues && SOURCES_CHUES_SEULEMENT.includes(cle)) return false;
    if (!input.voitLesMontants && SOURCES_MONTANTS.includes(cle)) return false;
    if (input.role !== 'ADMIN' && SOURCES_ENROLEMENT.includes(cle)) return false;
    if (input.projet === null && SOURCES_ENROLEMENT.includes(cle)) return false;
    return true;
  });
  const catalogue = Object.fromEntries(entrees);
  catalogue['par-teleconseiller'] = parTeleconseiller(input.chues);
  return catalogue;
}
