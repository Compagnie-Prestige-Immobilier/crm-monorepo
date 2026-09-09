import { SITUATION_VIDE, anciennete, type Situation } from '@/components/grand-public/situation';
import {
  INDICATIF_SENEGAL,
  separer,
  versE164,
  type Indicatif,
} from '@/components/grand-public/telephone';
import type { PaymentMode, Prospect, ProspectType } from '@/lib/data/console';
import type { ProspectBody } from '@/lib/data/grand-public';

export interface EtatFiche {
  prenom: string;
  nom: string;
  phone: string;
  indicatif: string;
  indicatifWhatsapp: string;
  professionId: string | null;
  incomeBandId: string | null;
  paymentMode: PaymentMode | null;
  type: ProspectType | null;
  situation: Situation;
  dureeMois: number | null;
  canalId: string | null;
}

export const FICHE_VIDE: EtatFiche = {
  prenom: '',
  nom: '',
  phone: '',
  indicatif: INDICATIF_SENEGAL,
  indicatifWhatsapp: INDICATIF_SENEGAL,
  professionId: null,
  incomeBandId: null,
  paymentMode: null,
  type: null,
  situation: SITUATION_VIDE,
  dureeMois: null,
  canalId: null,
};

const texte = (valeur: string): string | null => (valeur.trim() === '' ? null : valeur.trim());

export function ficheDepuis(prospect: Prospect, indicatifs: readonly Indicatif[]): EtatFiche {
  const principal = separer(prospect.phoneE164, indicatifs);
  const whatsapp = separer(prospect.whatsappE164, indicatifs);
  const relais = separer(prospect.relaisPhoneE164, indicatifs);

  return {
    prenom: prospect.prenom,
    nom: prospect.nom,
    phone: principal.national,
    indicatif: principal.indicatif,
    indicatifWhatsapp: prospect.whatsappE164 === null ? principal.indicatif : whatsapp.indicatif,
    professionId: prospect.professionId,
    incomeBandId: prospect.incomeBandId,
    paymentMode: prospect.paymentMode,
    type: prospect.type,
    situation: {
      employeurId: prospect.employeurId,
      // `employeur` porte le libellé du référentiel dès qu'un identifiant est
      // posé : la saisie libre ne reprend que ce qui n'en vient pas.
      employeur: prospect.employeurId === null ? (prospect.employeur ?? '') : '',
      typeContrat: prospect.typeContrat,
      ancienneteMois: prospect.ancienneteMois === null ? '' : String(prospect.ancienneteMois),
      lieuActivite: prospect.lieuActivite ?? '',
      modeEpargne: prospect.modeEpargne,
      paysResidenceId: prospect.paysResidenceId,
      villeResidence: prospect.villeResidence ?? '',
      whatsapp: whatsapp.national,
      relaisNom: prospect.relaisNom ?? '',
      relaisPhone: relais.national,
      banqueId: prospect.banqueId,
      syndicatId: prospect.syndicatId,
    },
    dureeMois: prospect.dureeSystemeMois,
    canalId: prospect.canalProvenanceId,
  };
}

/** Tout ce que ce formulaire écrit, `null` pour ce qu'il a laissé vide. */
export function corpsDe(etat: EtatFiche, phoneE164: string): ProspectBody {
  const { situation } = etat;
  return {
    nom: etat.nom.trim(),
    prenom: etat.prenom.trim(),
    phone: phoneE164,
    ...(etat.type === null ? {} : { type: etat.type }),
    ...(etat.paymentMode === null ? {} : { paymentMode: etat.paymentMode }),
    ...(etat.paymentMode === 'ECHELONNE' && etat.dureeMois !== null
      ? { dureeSystemeMois: etat.dureeMois }
      : {}),
    professionId: etat.professionId,
    incomeBandId: etat.incomeBandId,
    canalProvenanceId: etat.canalId,
    banqueId: situation.banqueId,
    syndicatId: situation.syndicatId,
    employeurId: situation.employeurId,
    employeur: situation.employeurId === null ? texte(situation.employeur) : null,
    typeContrat: situation.typeContrat,
    ancienneteMois: anciennete(situation.ancienneteMois),
    lieuActivite: texte(situation.lieuActivite),
    modeEpargne: situation.modeEpargne,
    paysResidenceId: situation.paysResidenceId,
    villeResidence: texte(situation.villeResidence),
    whatsappE164: versE164(situation.whatsapp, etat.indicatifWhatsapp),
    relaisNom: texte(situation.relaisNom),
    // Le relais est AU SÉNÉGAL : son numéro ne suit pas le pays de résidence.
    relaisPhoneE164: versE164(situation.relaisPhone, INDICATIF_SENEGAL),
  };
}

/** À la création, ce qui n'a pas été renseigné ne part pas : le serveur pose ses défauts. */
export function corpsSansVides(corps: ProspectBody): ProspectBody {
  const garde: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(corps)) {
    if (valeur !== null) garde[cle] = valeur;
  }
  return garde as ProspectBody;
}

/** L'API ne sait pas vider ces trois colonnes : un champ repassé à vide n'y touche pas. */
const NON_EFFACABLES = new Set(['type', 'paymentMode', 'dureeSystemeMois']);

/** `null` VIDE la colonne, l'absence la laisse : seuls les champs changés partent. */
export function patchEntre(avant: ProspectBody, apres: ProspectBody): ProspectBody {
  const reference = avant as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(apres)) {
    if (valeur === (reference[cle] ?? null)) continue;
    if (valeur === null && NON_EFFACABLES.has(cle)) continue;
    patch[cle] = valeur;
  }
  return patch as ProspectBody;
}
