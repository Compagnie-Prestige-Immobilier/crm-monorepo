import type { RelationRepresentant } from '@/components/representants/filtres';
import type {
  CreerRepresentant,
  ModifierRepresentant,
  Representant,
  StatutWhatsapp,
} from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';

export interface AmorceRepresentant {
  fullName: string;
  phone: string;
  notes: string;
}

export interface SaisieFiche {
  fullName: string;
  phone: string;
  departementId: string;
  iefId: string | null;
  notes: string;
  relationStatus: RelationRepresentant;
  relationReason: string;
  basculeVersRefus: boolean;
  whatsappStatus: StatutWhatsapp;
  whatsappNumber: string;
  profession: string;
  prenom: string;
  etablissement: string;
  syndicat: string;
  connaitUES: boolean | null;
  contacte: boolean | null;
}

const texte = (valeur: string | null | undefined): string => valeur ?? '';

const AMORCE_VIDE: AmorceRepresentant = { fullName: '', phone: '', notes: '' };

type SaisieOuverte = Omit<SaisieFiche, 'departementId'> & { departementId: string | null };

const COMMUN = { relationReason: '', basculeVersRefus: false } as const;

function ficheVierge(amorce: AmorceRepresentant | null): SaisieOuverte {
  const depart = amorce ?? AMORCE_VIDE;
  return {
    ...COMMUN,
    fullName: depart.fullName,
    phone: depart.phone,
    notes: depart.notes,
    departementId: null,
    iefId: null,
    relationStatus: 'INCONNU',
    whatsappStatus: 'NON_DEMANDE',
    whatsappNumber: '',
    profession: '',
    prenom: '',
    etablissement: '',
    syndicat: '',
    connaitUES: null,
    contacte: null,
  };
}

function ficheExistante(
  representant: Representant,
  amorce: AmorceRepresentant | null,
): SaisieOuverte {
  return {
    ...COMMUN,
    fullName: representant.fullName,
    phone: formatPhone(representant.phoneE164),
    notes: texte(representant.notes) || texte(amorce?.notes),
    departementId: representant.departementId,
    iefId: representant.iefId,
    relationStatus: representant.relationStatus,
    whatsappStatus: representant.whatsappStatus,
    whatsappNumber: texte(representant.whatsappE164),
    profession: texte(representant.profession),
    prenom: texte(representant.prenom),
    etablissement: texte(representant.etablissement),
    syndicat: texte(representant.syndicat),
    connaitUES: representant.connaitUES,
    contacte: representant.contacte,
  };
}

export function valeursDeDepart(
  representant: Representant | null,
  amorce: AmorceRepresentant | null,
): SaisieOuverte {
  return representant === null ? ficheVierge(amorce) : ficheExistante(representant, amorce);
}

export function corpsDeCreation(saisie: SaisieFiche): CreerRepresentant {
  const notes = saisie.notes.trim();
  return {
    fullName: saisie.fullName.trim(),
    phone: saisie.phone.trim(),
    departementId: saisie.departementId,
    ...(saisie.iefId === null ? {} : { iefId: saisie.iefId }),
    ...(notes === '' ? {} : { notes }),
  };
}

function poserTexte(
  patch: ModifierRepresentant,
  cle: 'prenom' | 'etablissement' | 'syndicat' | 'profession',
  valeur: string,
  avant: string,
): void {
  if (valeur !== avant) patch[cle] = valeur;
}

/**
 * Le contrat n'admet que `boolean` : « Indéterminé » ne peut pas remettre la
 * valeur à null, il laisse donc la fiche telle quelle.
 */
function poserTri(
  patch: ModifierRepresentant,
  cle: 'connaitUES' | 'contacte',
  valeur: boolean | null,
  avant: boolean | null,
): void {
  if (valeur !== null && valeur !== avant) patch[cle] = valeur;
}

// Un statut inchangé n'est PAS renvoyé : le serveur le refuserait sans rien
// écrire, et l'écran laisserait croire à une bascule historisée.
function poserRelation(
  patch: ModifierRepresentant,
  representant: Representant,
  saisie: SaisieFiche,
): void {
  if (saisie.relationStatus !== representant.relationStatus) {
    patch.relationStatus = saisie.relationStatus;
  }
  const motif = saisie.relationReason.trim();
  if (saisie.basculeVersRefus && motif !== '') patch.relationReason = motif;
}

function poserWhatsapp(
  patch: ModifierRepresentant,
  representant: Representant,
  saisie: SaisieFiche,
): void {
  if (saisie.whatsappStatus !== representant.whatsappStatus) {
    patch.whatsappStatus = saisie.whatsappStatus;
  }
  // Sur MEME_NUMERO le numéro se relit sur `phoneE164` : le dupliquer
  // fabriquerait deux vérités à maintenir.
  if (saisie.whatsappStatus === 'AUTRE_NUMERO' && saisie.whatsappNumber.trim() !== '') {
    patch.whatsappE164 = saisie.whatsappNumber.trim();
  }
}

/** Ne repart que ce qui a CHANGÉ. `rev` est obligatoire : sans lui, 409 `REV_CONFLICT`. */
export function corpsDeModification(
  representant: Representant,
  saisie: SaisieFiche,
): ModifierRepresentant {
  const patch: ModifierRepresentant = {
    rev: representant.rev,
    fullName: saisie.fullName.trim(),
    phone: saisie.phone.trim(),
    departementId: saisie.departementId,
    notes: saisie.notes.trim(),
    ...(saisie.iefId === null ? {} : { iefId: saisie.iefId }),
  };
  poserRelation(patch, representant, saisie);
  poserWhatsapp(patch, representant, saisie);
  poserTexte(patch, 'profession', saisie.profession.trim(), representant.profession ?? '');
  poserTexte(patch, 'prenom', saisie.prenom.trim(), representant.prenom ?? '');
  poserTexte(patch, 'etablissement', saisie.etablissement.trim(), representant.etablissement ?? '');
  poserTexte(patch, 'syndicat', saisie.syndicat.trim(), representant.syndicat ?? '');
  poserTri(patch, 'connaitUES', saisie.connaitUES, representant.connaitUES);
  poserTri(patch, 'contacte', saisie.contacte, representant.contacte);
  return patch;
}

/** Ce que le navigateur peut trancher seul, avant l'aller-retour. */
export function ficheEnvoyable(etat: {
  fullName: string;
  phone: string;
  departementId: string | null;
  sansConflit: boolean;
  enCours: boolean;
}): boolean {
  const nom = etat.fullName.trim().length;
  const chiffres = etat.phone.trim().replace(/\D/gu, '').length;
  return (
    nom >= 2 &&
    nom <= 160 &&
    chiffres >= 9 &&
    etat.departementId !== null &&
    etat.sansConflit &&
    !etat.enCours
  );
}
