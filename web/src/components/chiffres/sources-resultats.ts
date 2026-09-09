import {
  dureeMoyenneSurLaFiche,
  francs,
  matriceOuvertures,
  part,
  scalaire,
  scalaireDuree,
  scalaireTaux,
  sommeOuvertures,
  type SourceChiffre,
} from '@/components/chiffres/formes';
import { formatNumber } from '@/lib/format';

export const SOURCES_FICHES: Record<string, SourceChiffre> = {
  'taux-de-qualification': {
    label: 'Taux de qualification',
    forme: 'scalaire',
    jeu: 'ouvertures',
    description: 'Fiches qualifiées ÷ fiches ouvertes. L’écart avec 100 % : les sorties forcées.',
    groupe: 'Fiches',
    extraire: ({ ouvertures }) => {
      if (ouvertures === undefined) return null;
      const ouvertes = sommeOuvertures(ouvertures, 'ouvertures');
      const qualifiees = sommeOuvertures(ouvertures, 'qualifiees');
      return scalaireTaux(
        part(qualifiees, ouvertes),
        `${formatNumber(qualifiees)} qualifiées sur ${formatNumber(ouvertes)} fiches ouvertes`,
        'Aucune fiche ouverte sur la période',
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
  'fiches-ouvertes': {
    label: 'Fiches ouvertes',
    forme: 'matrice',
    jeu: 'ouvertures',
    description: 'Ouvertures confirmées, par téléconseiller et par jour. Une réouverture compte.',
    groupe: 'Équipe',
    extraire: ({ ouvertures }) => (ouvertures === undefined ? null : matriceOuvertures(ouvertures)),
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
  'couverture-derniere-campagne': {
    label: 'Couverture de la dernière campagne',
    forme: 'composition',
    jeu: 'campagne',
    description:
      'Fiches appelées et fiches restantes par téléconseiller, sur la dernière campagne quelle que soit la période.',
    groupe: 'Campagnes',
    extraire: ({ campagne }) =>
      campagne === undefined || campagne === null
        ? null
        : {
            forme: 'composition',
            donnee: (campagne.performance ?? []).map((ligne) => ({
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
      'Appels sur la fiche d’un collègue, sur la dernière campagne quelle que soit la période.',
    groupe: 'Campagnes',
    extraire: ({ campagne }) =>
      campagne === undefined || campagne === null
        ? null
        : {
            forme: 'classement',
            donnee: (campagne.performance ?? []).map((ligne) => ({
              id: ligne.teleconseillerId,
              label: ligne.teleconseillerName,
              value: ligne.outsideAssignmentCalls,
            })),
          },
  },
};

export const SOURCES_RESULTATS: Record<string, SourceChiffre> = {
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
    extraire: ({ entonnoir }) => {
      if (entonnoir === undefined) return null;
      const etapes = entonnoir.etapes ?? [];
      return {
        forme: 'classement',
        donnee:
          (etapes[0]?.count ?? 0) === 0
            ? []
            : etapes.map((etape) => ({ id: etape.label, label: etape.label, value: etape.count })),
      };
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
                segments: (methodes.items ?? []).map((item) => ({
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
                segments: (banques.items ?? []).map((item) => ({
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
            donnee: (delais.legs ?? []).flatMap((troncon) =>
              troncon.medianDays === null
                ? []
                : [{ id: troncon.leg, label: troncon.label, value: troncon.medianDays }],
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
            donnee: (rendement.items ?? []).flatMap((ligne) =>
              ligne.conversionRate === null
                ? []
                : [{ id: ligne.id, label: ligne.label, value: ligne.conversionRate }],
            ),
          },
  },
};
