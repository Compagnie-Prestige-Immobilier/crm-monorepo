import {
  scalaire,
  scalaireTaux,
  tableauEquipe,
  type SourceChiffre,
} from '@/components/chiffres/formes';
import { SOURCES_APPELS } from '@/components/chiffres/sources-appels';
import { SOURCES_FICHES, SOURCES_RESULTATS } from '@/components/chiffres/sources-resultats';
import { formatNumber } from '@/lib/format';
import type { Projet, Role } from '@/lib/types';

export type { Jeu, Jeux, SourceChiffre } from '@/components/chiffres/formes';

/**
 * Ce que les plateformes d'enrôlement rendent ne sort pas de la cellule
 * pilotage, qui tient le rôle ADMIN. L'API qui alimente ces cartes refuse tout
 * autre rôle : ce filtre évite de proposer une carte qui répondrait 403.
 */
const SOURCES_ENROLEMENT: Record<string, SourceChiffre> = {
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
            donnee: (enrolement.parJour ?? []).map((point) => ({
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
                segments: (enrolement.parEtape ?? []).map((etape) => ({
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
            donnee: (enrolement.parTeleconseiller ?? []).map((ligne) => ({
              id: ligne.id,
              label: ligne.label,
              value: ligne.inscriptions,
            })),
          },
  },
};

/** Un représentant n'existe que dans CHUES : ces taux seraient vides ailleurs. */
const CHUES_SEULEMENT: readonly string[] = [
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
const MONTANTS: readonly string[] = ['encaisse', 'de-l-appel-a-l-encaissement'];

/** Les colonnes suivent le projet : sans représentant, aucun taux CHUES n'a de sujet. */
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

/**
 * Le catalogue de l'écran « Chiffres ». Une entrée par carte, et rien qui ne
 * soit pas une carte : tout ce qui s'affiche se déplace et se retire.
 */
export function catalogueDe(input: {
  projet: Projet;
  voitLesMontants: boolean;
  role: Role;
}): Record<string, SourceChiffre> {
  const chues = input.projet === 'chues';
  const refuse = (cle: string, source: SourceChiffre): boolean =>
    (!chues && CHUES_SEULEMENT.includes(cle)) ||
    (!input.voitLesMontants && MONTANTS.includes(cle)) ||
    (input.role !== 'ADMIN' && source.groupe === 'Enrôlement');

  const tout = {
    ...SOURCES_APPELS,
    ...SOURCES_FICHES,
    ...SOURCES_RESULTATS,
    ...SOURCES_ENROLEMENT,
  };
  const retenues = Object.entries(tout).filter(([cle, source]) => !refuse(cle, source));

  const catalogue = Object.fromEntries(retenues);
  const exploitation = catalogue['taux-d-exploitation'];
  if (exploitation !== undefined) {
    catalogue['taux-d-exploitation'] = {
      ...exploitation,
      lien: (id) => `/${input.projet}/campagnes/${id}`,
    };
  }
  catalogue['par-teleconseiller'] = parTeleconseiller(chues);
  return catalogue;
}
