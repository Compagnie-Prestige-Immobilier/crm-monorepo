import { useQuery } from '@tanstack/react-query';

import { dakarLocalToIso } from '@/lib/data/callbacks';
import {
  fetchChampsConversion,
  type ChampLibre,
  type ReglageChamp,
} from '@/lib/data/champs-conversion';
import type { ConversionDraft } from '@/lib/data/console';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

export interface Formulaire {
  readonly champs: readonly ReglageChamp[];
  readonly libres: readonly ChampLibre[];
}

const SANS_REGLAGE: Formulaire = { champs: [], libres: [] };

/**
 * Le formulaire tel que l'administrateur l'a réglé. Tant qu'il n'est pas lu,
 * les listes sont vides et l'écran retombe sur les règles du projet.
 */
export function useChampsConversion(projet: Projet): Formulaire {
  const reglages = useQuery({
    queryKey: queryKeys.champsConversion(projet),
    queryFn: () => fetchChampsConversion(projet === 'chues' ? 'CHUES' : 'GRAND_PUBLIC'),
    staleTime: 300_000,
  });
  if (reglages.data === undefined) return SANS_REGLAGE;
  return { champs: reglages.data.champs ?? [], libres: reglages.data.libres ?? [] };
}

export type ConversionField = Exclude<keyof ConversionDraft, 'projet' | 'champsLibres'>;

export type ConversionErrors = Partial<Record<ConversionField, string>> & {
  readonly libres?: Record<string, string>;
};

/**
 * Les identifiants du catalogue serveur : `phoneE164` s'affiche en lecture
 * seule, et le couple WhatsApp y est nommé autrement que dans le brouillon.
 */
export type ChampReglable =
  | Exclude<ConversionField, 'memeWhatsapp' | 'whatsapp'>
  | 'phoneE164'
  | 'whatsappStatus'
  | 'whatsappE164';

export interface ReglesChamps {
  readonly visible: (champ: ChampReglable, defaut: boolean) => boolean;
  readonly requis: (champ: ChampReglable, defaut: boolean) => boolean;
}

/** Masqué, un champ n'est plus exigé ; sans réglage, la règle du projet tient. */
export function reglesChamps(reglages: readonly ReglageChamp[]): ReglesChamps {
  const parChamp = new Map(reglages.map((regle) => [regle.champ, regle]));
  return {
    visible: (champ, defaut) => parChamp.get(champ)?.visible ?? defaut,
    requis: (champ, defaut) => {
      const regle = parChamp.get(champ);
      if (regle === undefined) return defaut;
      return regle.visible && regle.obligatoire;
    },
  };
}

const DUREE_ETABLISSEMENT_MAX_MOIS = 600;
const DUREE_SYSTEME_MAX_MOIS = 300;
const NOM_MAX = 120;
const EMAIL_MAX = 160;
const RENDEZ_VOUS_TOLERANCE_MS = 5 * 60_000;
const EMAIL_MOTIF = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

function texteErreur(
  valeur: string,
  requis: boolean,
  obligatoire: string,
  tropLong: string,
): string | undefined {
  const texte = valeur.trim();
  if (requis && texte === '') return obligatoire;
  if (texte.length > NOM_MAX) return tropLong;
  return undefined;
}

function emailErreur(valeur: string, requis: boolean): string | undefined {
  const email = valeur.trim();
  if (requis && email === '') return 'L’adresse électronique est obligatoire.';
  if (email !== '' && (email.length > EMAIL_MAX || !EMAIL_MOTIF.test(email))) {
    return 'Cette adresse électronique n’en est pas une.';
  }
  return undefined;
}

function identiteErreurs(
  draft: ConversionDraft,
  complet: boolean,
  regles: ReglesChamps,
): ConversionErrors {
  const erreurs: ConversionErrors = {};
  const nom = texteErreur(
    draft.nom,
    regles.requis('nom', true),
    'Le nom est obligatoire.',
    'Nom trop long (120 caractères maximum).',
  );
  if (nom !== undefined) erreurs.nom = nom;
  const prenom = texteErreur(
    draft.prenom,
    regles.requis('prenom', complet),
    'Le prénom est obligatoire.',
    'Prénom trop long (120 caractères maximum).',
  );
  if (prenom !== undefined) erreurs.prenom = prenom;
  const profession = texteErreur(
    draft.profession,
    regles.requis('profession', complet),
    'La profession est obligatoire.',
    'Profession trop longue (120 caractères maximum).',
  );
  if (profession !== undefined) erreurs.profession = profession;
  const email = emailErreur(draft.email, regles.requis('email', false));
  if (email !== undefined) erreurs.email = email;
  return erreurs;
}

/** Le dernier membre dit si le champ est obligatoire sur CHUES sans réglage. */
const CHAMPS_DOSSIER: readonly [
  Extract<ConversionField, ChampReglable>,
  (draft: ConversionDraft) => boolean,
  string,
  boolean,
][] = [
  ['fonctionnaire', (draft) => draft.fonctionnaire === null, 'Dites s’il est fonctionnaire.', true],
  ['syndicatId', (draft) => draft.syndicatId === '', 'Choisissez le syndicat.', true],
  ['banqueId', (draft) => draft.banqueId === '', 'Choisissez la banque.', true],
  [
    'engagementEnCours',
    (draft) => draft.engagementEnCours === null,
    'Dites s’il a un engagement en cours à la banque.',
    true,
  ],
  ['incomeBandId', (draft) => draft.incomeBandId === '', 'Choisissez la tranche de revenu.', true],
  ['type', (draft) => draft.type === null, 'Choisissez la situation.', false],
  ['paymentMode', (draft) => draft.paymentMode === null, 'Choisissez le mode de paiement.', false],
];

function dureeErreur(
  valeur: string,
  requis: boolean,
  min: number,
  max: number,
  obligatoire: string,
  invalide: string,
): string | undefined {
  const duree = valeur.trim();
  if (requis && duree === '') return obligatoire;
  if (duree === '') return undefined;
  if (!/^\d+$/u.test(duree) || Number(duree) < min || Number(duree) > max) return invalide;
  return undefined;
}

const chiffres = (valeur: string): number => valeur.replace(/\D/gu, '').length;

function dossierErreurs(
  draft: ConversionDraft,
  complet: boolean,
  regles: ReglesChamps,
): ConversionErrors {
  const erreurs: ConversionErrors = {};
  for (const [champ, manquant, message, surChues] of CHAMPS_DOSSIER) {
    if (regles.requis(champ, surChues && complet) && manquant(draft)) erreurs[champ] = message;
  }
  const etablissement = dureeErreur(
    draft.dureeEtablissementMois,
    regles.requis('dureeEtablissementMois', complet),
    0,
    DUREE_ETABLISSEMENT_MAX_MOIS,
    'La durée dans la fonction est obligatoire.',
    `La durée s’exprime en mois entiers, de 0 à ${String(DUREE_ETABLISSEMENT_MAX_MOIS)}.`,
  );
  if (etablissement !== undefined) erreurs.dureeEtablissementMois = etablissement;
  const systeme = dureeErreur(
    draft.dureeSystemeMois,
    regles.requis('dureeSystemeMois', false),
    1,
    DUREE_SYSTEME_MAX_MOIS,
    'Choisissez la durée du système de paiement.',
    `La durée du système s’exprime en mois entiers, de 1 à ${String(DUREE_SYSTEME_MAX_MOIS)}.`,
  );
  if (systeme !== undefined) erreurs.dureeSystemeMois = systeme;
  if (
    draft.memeWhatsapp === false &&
    draft.whatsapp.trim() !== '' &&
    chiffres(draft.whatsapp) < 9
  ) {
    erreurs.whatsapp = 'Le numéro WhatsApp est incomplet.';
  }
  return erreurs;
}

function methodeErreurs(
  draft: ConversionDraft,
  now: number,
  regles: ReglesChamps,
): ConversionErrors {
  const erreurs: ConversionErrors = {};
  if (draft.method === null) erreurs.method = 'Choisissez la méthode d’enrôlement.';

  const rendezVous = draft.rendezVousAt.trim();
  if (!regles.visible('rendezVousAt', true)) return erreurs;
  if (draft.method === 'APPOINTMENT') {
    const iso = dakarLocalToIso(rendezVous);
    if (rendezVous === '') {
      erreurs.rendezVousAt = 'Le RDV CPI exige la date et l’heure du rendez-vous.';
    } else if (iso === null) {
      erreurs.rendezVousAt = 'La date du rendez-vous est illisible.';
    } else if (Date.parse(iso) < now - RENDEZ_VOUS_TOLERANCE_MS) {
      erreurs.rendezVousAt = 'Le rendez-vous ne peut pas précéder l’appel.';
    }
  } else if (rendezVous !== '') {
    erreurs.rendezVousAt = 'Une date de rendez-vous n’est admise que sur « RDV CPI ».';
  }
  return erreurs;
}

function libresManquants(
  draft: ConversionDraft,
  libres: readonly ChampLibre[],
): Record<string, string> {
  const manquants: Record<string, string> = {};
  for (const champ of libres) {
    if (!champ.obligatoire) continue;
    if ((draft.champsLibres[champ.id] ?? '').trim() === '') {
      manquants[champ.id] = `« ${champ.libelle} » est obligatoire.`;
    }
  }
  return manquants;
}

/** Miroir des règles du serveur : ce qui manque se dit sous le champ fautif. */
export function validateConversion(
  draft: ConversionDraft,
  now: number,
  reglages: readonly ReglageChamp[],
  libres: readonly ChampLibre[],
): ConversionErrors {
  const complet = draft.projet === 'CHUES';
  const regles = reglesChamps(reglages);
  const manquants = libresManquants(draft, libres);
  return {
    ...identiteErreurs(draft, complet, regles),
    ...dossierErreurs(draft, complet, regles),
    ...methodeErreurs(draft, now, regles),
    ...(Object.keys(manquants).length === 0 ? {} : { libres: manquants }),
  };
}

/** Le refus du serveur revient SOUS le champ fautif, sinon tout le formulaire se relit. */
const REFUS_PAR_CODE: Readonly<
  Record<string, { readonly field: ConversionField; readonly message: string }>
> = {
  PHASE2_RENDEZ_VOUS_REQUIRED: {
    field: 'rendezVousAt',
    message: 'Le RDV CPI exige la date et l’heure du rendez-vous.',
  },
  PHASE2_RENDEZ_VOUS_NOT_ALLOWED: {
    field: 'rendezVousAt',
    message: 'Une date de rendez-vous n’est admise que sur « RDV CPI ».',
  },
  PHASE2_RENDEZ_VOUS_PAST: {
    field: 'rendezVousAt',
    message: 'Le rendez-vous ne peut pas précéder l’appel.',
  },
  PHASE2_METHOD_RETIREE: {
    field: 'method',
    message: 'Cette méthode n’existe plus. Choisissez « RDV CPI ».',
  },
  PHASE2_REVENU_REQUIRED: { field: 'incomeBandId', message: 'Choisissez la tranche de revenu.' },
  PHASE2_DUREE_FONCTION_REQUIRED: {
    field: 'dureeEtablissementMois',
    message: 'La durée dans la fonction est obligatoire.',
  },
  PHASE2_EMAIL_INVALID: {
    field: 'email',
    message: 'Cette adresse électronique n’en est pas une.',
  },
};

export function conversionErrorFor(
  code: string,
): { readonly field: ConversionField; readonly message: string } | null {
  return REFUS_PAR_CODE[code] ?? null;
}
