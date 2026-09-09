import {
  matriceCreneaux,
  part,
  partsStock,
  scalaire,
  scalaireTaux,
  tauxTexte,
  type SourceChiffre,
} from '@/components/chiffres/formes';
import { formatNumber, formatShortDate } from '@/lib/format';

export const SOURCES_APPELS: Record<string, SourceChiffre> = {
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
      if (activite === undefined) return null;
      const statuts = activite.repQualificationStatuses;
      return {
        forme: 'classement',
        donnee:
          statuts.total === 0
            ? []
            : (statuts.items ?? []).map((item) => ({
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
      if (activite === undefined) return null;
      const items = activite.repQualificationStatuses.items ?? [];
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
  'representants-par-departement': {
    label: 'Représentants par département',
    forme: 'classement',
    jeu: 'representants',
    description: 'Stock des représentants par département, hors période.',
    groupe: 'Représentants',
    extraire: ({ representants }) =>
      representants === undefined ? null : partsStock(representants.parDepartement ?? []),
  },
  'representants-par-ief': {
    label: 'Représentants par IEF',
    forme: 'classement',
    jeu: 'representants',
    description: 'Stock des représentants par IEF, hors période.',
    groupe: 'Représentants',
    extraire: ({ representants }) =>
      representants === undefined ? null : partsStock(representants.parIef ?? []),
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
  'appels-par-jour': {
    label: 'Appels par jour',
    forme: 'serie-temporelle',
    jeu: 'activite',
    description: 'Appels passés par jour, représentants et prospects confondus.',
    groupe: 'Appels',
    extraire: ({ activite }) => {
      if (activite === undefined) return null;
      const parJour = new Map<string, number>();
      for (const ligne of activite.items ?? []) {
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
  'taux-d-exploitation': {
    label: 'Taux d’exploitation',
    forme: 'composition',
    jeu: 'campagnes',
    description:
      'Un camembert par campagne : fiches traitées ÷ fiches de la campagne. Le camembert ouvre sa campagne.',
    groupe: 'Campagnes',
    extraire: ({ campagnes }) =>
      campagnes === undefined
        ? null
        : {
            forme: 'composition',
            donnee: (campagnes.items ?? []).map((campagne) => ({
              id: campagne.id,
              ligne: campagne.name,
              detail: `${formatNumber(campagne.traitees)} traitées sur ${formatNumber(campagne.prevues)} · ${tauxTexte(part(campagne.traitees, campagne.prevues))}`,
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
};
