import type { CampagneCreation } from '@/lib/data/lots-export';
import type { Compte } from '@/lib/data/users';
import type { Projet } from '@/lib/types';

/** Valeur de liste déroulante qui veut dire « ne pas filtrer ». */
export const TOUS = 'TOUS';

/** Chaque cible appartient à UNE coque : le dialogue ne propose que celles du projet ouvert. */
export const CIBLES = [
  {
    cle: 'chues',
    projet: 'chues',
    titre: 'Tous les prospects CHUES',
    aide: 'Toutes les fiches du projet CHUES, les quatre segments confondus.',
  },
  {
    cle: 'chues-segment',
    projet: 'chues',
    titre: 'Prospects CHUES d’un segment',
    aide: 'Un seul segment, de BDD1 à BDD4.',
  },
  {
    cle: 'grand-public',
    projet: 'grand-public',
    titre: 'Prospects Grand Public',
    aide: 'Les fiches hors CHUES, tous types ou un seul.',
  },
  {
    cle: 'representants',
    projet: 'chues',
    titre: 'Représentants (CHUES)',
    aide: 'Les personnes qui remettent les listes, et non leurs prospects.',
  },
  {
    cle: 'representants-injoignables',
    projet: 'chues',
    titre: 'Représentants injoignables',
    aide: 'Ceux dont le dernier appel n’a abouti à aucun échange, sauf les injoignables définitifs.',
  },
  {
    cle: 'contacts-recommandes',
    projet: 'chues',
    titre: 'Contacts recommandés',
    aide: 'Les numéros donnés par un représentant qui décline. Une fiche est créée pour chacun au lancement.',
  },
] as const satisfies readonly { cle: string; projet: Projet; titre: string; aide: string }[];

export type CleCible = (typeof CIBLES)[number]['cle'];

/** Trois cibles tirent des représentants : les mêmes filtres de lieu leur servent. */
export type CleRepresentants =
  'representants' | 'representants-injoignables' | 'contacts-recommandes';

const CIBLE_API: Record<CleRepresentants, CampagneCreation['cible']> = {
  representants: 'REPRESENTANTS',
  'representants-injoignables': 'REPRESENTANTS_INJOIGNABLES',
  'contacts-recommandes': 'CONTACTS_RECOMMANDES',
};

const TETE: Record<CleRepresentants, string> = {
  representants: 'Représentants',
  'representants-injoignables': 'Représentants injoignables',
  'contacts-recommandes': 'Contacts recommandés',
};

export const surRepresentants = (cle: CleCible): cle is CleRepresentants => cle in CIBLE_API;

export const SEGMENTS = ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const;

export const SEGMENT_LABELS: Record<(typeof SEGMENTS)[number], string> = {
  BDD1: 'BDD1 : CHUES / CBAO',
  BDD2: 'BDD2 : CHUES / autre banque',
  BDD3: 'BDD3 : autre syndicat / CBAO',
  BDD4: 'BDD4 : autre syndicat / autre banque',
};

export const TYPES = ['FONCTIONNAIRE', 'SECTEUR_PRIVE', 'INFORMEL', 'DIASPORA'] as const;

export const TYPE_LABELS: Record<(typeof TYPES)[number], string> = {
  FONCTIONNAIRE: 'Fonctionnaire',
  SECTEUR_PRIVE: 'Secteur privé',
  INFORMEL: 'Informel',
  DIASPORA: 'Diaspora',
};

export interface Choix {
  cle: CleCible;
  segment: (typeof SEGMENTS)[number];
  type: (typeof TYPES)[number] | typeof TOUS;
  departementId: string;
  iefId: string;
  nonQualifies: boolean;
}

export const choixInitial = (cle: CleCible): Choix => ({
  cle,
  segment: 'BDD1',
  type: TOUS,
  departementId: TOUS,
  iefId: TOUS,
  nonQualifies: true,
});

/** Le contrat exige ce drapeau : une fiche supprimée ne s'exporte pas. */
const VIVANTS = { includeDeleted: false } as const;

export interface Critere {
  corps: Omit<CampagneCreation, 'name' | 'distribution'>;
  /** Les critères dits en français ; c'est aussi le nom proposé pour la campagne. */
  etiquette: string;
}

function critereRepresentants(
  cle: CleRepresentants,
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  const lieu = [
    nomDepartement === null ? null : `département de ${nomDepartement}`,
    nomIef === null ? null : `IEF ${nomIef}`,
  ].filter((part) => part !== null);
  const exclureQualifies = cle === 'representants' && choix.nonQualifies;

  return {
    corps: {
      cible: CIBLE_API[cle],
      representants: {
        ...(choix.departementId === TOUS ? {} : { departementId: choix.departementId }),
        ...(choix.iefId === TOUS ? {} : { iefId: choix.iefId }),
        ...(exclureQualifies ? { relationStatus: 'INCONNU' as const } : {}),
      },
    },
    etiquette: [exclureQualifies ? 'Représentants non qualifiés' : TETE[cle], ...lieu].join(', '),
  };
}

export function critereDuChoix(
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  if (surRepresentants(choix.cle)) {
    return critereRepresentants(choix.cle, choix, nomDepartement, nomIef);
  }

  if (choix.cle === 'grand-public') {
    return {
      corps: {
        cible: 'PROSPECTS',
        prospects: {
          ...VIVANTS,
          projet: 'GRAND_PUBLIC',
          ...(choix.type === TOUS ? {} : { type: choix.type }),
        },
      },
      etiquette:
        choix.type === TOUS
          ? 'Prospects Grand Public'
          : `Prospects Grand Public, ${TYPE_LABELS[choix.type]}`,
    };
  }

  if (choix.cle === 'chues-segment') {
    return {
      corps: {
        cible: 'PROSPECTS',
        prospects: { ...VIVANTS, projet: 'CHUES', segment: choix.segment },
      },
      etiquette: `Prospects CHUES, segment ${choix.segment}`,
    };
  }

  return {
    corps: { cible: 'PROSPECTS', prospects: { ...VIVANTS, projet: 'CHUES' } },
    etiquette: 'Prospects CHUES',
  };
}

/**
 * Ce que le serveur retiendra à défaut d'objectif saisi : supervision et
 * direction appellent en plus de leur travail, pas à la place.
 */
export function capaciteDeDefaut(role: Compte['role'], fichesParJour: number): number {
  return role === 'COMMERCIAL' ? fichesParJour : Math.max(1, Math.ceil(fichesParJour / 5));
}
