import type { RecapAppelProps } from '@/components/chues/rep-recap';
import type { RepAnswer, RepCallOutcome } from '@/lib/data/rep-campaigns';
import type { Representant } from '@/lib/data/representants';
import {
  exigeMotif,
  libelleStatut,
  statutDuSouhait,
  statutsDeLaBranche,
  type EffetStatut,
  type StatutQualification,
} from '@/lib/data/statuts-qualification';

/** L'appel a abouti, ou non. Ce qu'il a donné se dit ensuite, au statut. */
export type Resultat = 'JOIGNABLE' | 'INJOIGNABLE';

export const RESULTATS: readonly { valeur: Resultat; label: string }[] = [
  { valeur: 'JOIGNABLE', label: 'Joignable' },
  { valeur: 'INJOIGNABLE', label: 'Injoignable' },
];

const OUTCOME_PAR_EFFET: Record<EffetStatut, RepCallOutcome> = {
  REACHED: 'REACHED',
  REFUSED: 'REFUSED',
  SCHEDULE_CALLBACK: 'CALLBACK',
  UNREACHABLE: 'UNREACHABLE',
  WRONG_NUMBER: 'WRONG_NUMBER',
};

/** Le serveur dérive la même issue et refuse celle qui le contredit. */
const outcomeDuStatut = (effect: EffetStatut): RepCallOutcome => OUTCOME_PAR_EFFET[effect];

/** Ces effets closent l'appel : le script reste posé, plus rien n'y est exigé. */
const EFFETS_SANS_SCRIPT: readonly EffetStatut[] = ['REFUSED', 'SCHEDULE_CALLBACK', 'WRONG_NUMBER'];

const scriptExige = (effect: EffetStatut): boolean => !EFFETS_SANS_SCRIPT.includes(effect);

/** Le statut demande une date : rappel promis, ou réessai d'un numéro sans réponse. */
function dateDemandee(
  statut: Pick<StatutQualification, 'requiresCallback' | 'retryAfterMinutes'>,
): boolean {
  return statut.requiresCallback || statut.retryAfterMinutes !== null;
}

/** Le réessai du statut choisi, préréglé, sauf s'il exige un rappel promis. */
export function rappelInitialDuStatut(
  statut: Pick<StatutQualification, 'requiresCallback' | 'retryAfterMinutes'> | null,
  now: number,
): string | null {
  const reessai = statut?.retryAfterMinutes ?? null;
  if (reessai === null || statut?.requiresCallback === true) return null;
  return new Date(now + reessai * 60_000).toISOString();
}

const chiffresDe = (valeur: string): number => valeur.replace(/\D/gu, '').length;

export function recapOuiNon(valeur: boolean | null): string | null {
  if (valeur === null) return null;
  return valeur ? 'Oui' : 'Non';
}

export function recapEtablissement(confirme: boolean | null, nouvel: string): string | null {
  if (confirme === null) return null;
  if (confirme) return 'Confirmé';
  return nouvel.trim() === '' ? 'À corriger' : nouvel.trim();
}

export interface QualificationDerivee {
  statuts: readonly StatutQualification[];
  statutPose: StatutQualification | null;
  statutChoisi: StatutQualification | null;
  statut: StatutQualification | null;
  proposeQuelquUn: boolean;
  suggestionCommencee: boolean;
  exigeRappel: boolean;
  motifObligatoire: boolean;
  statutLabel: string | null;
}

/**
 * Accepté et Refusé restent dans la liste : le téléconseiller qui ne voit pas
 * que la question les a posés les y cherche. Les choisir répond à la question.
 */
export function deriverQualification(
  referentiel: readonly StatutQualification[],
  etat: {
    joignable: boolean;
    ambassadeur: boolean | null;
    statutId: string | null;
    sugPhone: string;
    sugName: string;
    sugNote: string;
  },
): QualificationDerivee {
  const statuts = statutsDeLaBranche(referentiel, etat.joignable);
  const statutPose = etat.joignable ? statutDuSouhait(statuts, etat.ambassadeur) : null;
  const statutChoisi = statuts.find((ligne) => ligne.id === etat.statutId) ?? null;
  const statut = statutChoisi ?? statutPose;
  return {
    statuts,
    statutPose,
    statutChoisi,
    statut,
    proposeQuelquUn: etat.joignable && etat.ambassadeur === false,
    suggestionCommencee:
      etat.sugPhone.trim() !== '' || etat.sugName.trim() !== '' || etat.sugNote.trim() !== '',
    exigeRappel: statut !== null && dateDemandee(statut),
    motifObligatoire: statut !== null && exigeMotif(statut),
    statutLabel: statut === null ? null : libelleStatut(statut),
  };
}

/** La personne que le représentant propose à sa place, telle qu'elle se lit. */
function personneProposee(etat: EtatScript): string | null {
  if (!etat.proposeQuelquUn || !etat.suggestionCommencee) return null;
  return [etat.sugPhone.trim(), etat.sugName.trim()].filter(Boolean).join(' · ');
}

/** Ce que la deuxième étape relit avant d'envoyer, et rien de plus. */
export function recapDe(
  representant: Representant,
  etat: EtatScript,
  statutLabel: string | null,
  now: number,
): RecapAppelProps {
  return {
    representant,
    resultat: etat.resultat,
    statutLabel,
    joignable: etat.joignable,
    etablissementConfirme: etat.etablissementConfirme,
    nouvelEtablissement: etat.nouvelEtablissement,
    contacte: etat.contacte,
    connaitUES: etat.connaitUES,
    syndicatName: etat.syndicatName,
    ambassadeur: etat.ambassadeur,
    rappelAt: etat.rappelAt,
    now,
    personneProposee: personneProposee(etat),
    commentaire: etat.commentaire.trim(),
  };
}

export interface EtatScript {
  resultat: Resultat | null;
  statut: StatutQualification | null;
  statutChoisi: StatutQualification | null;
  joignable: boolean;
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  syndicatName: string;
  ambassadeur: boolean | null;
  memeWhatsapp: boolean | null;
  whatsapp: string;
  rappelAt: string | null;
  commentaire: string;
  proposeQuelquUn: boolean;
  suggestionCommencee: boolean;
  sugPhone: string;
  sugName: string;
  sugNote: string;
}

/** Les questions exigées par le seul statut qui n'a pas clos l'appel. */
function manqueScript(etat: EtatScript): string | null {
  if (etat.statut !== null && !scriptExige(etat.statut.effect)) return null;
  if (etat.etablissementConfirme === null) return 'Dites si l’établissement est confirmé';
  if (etat.etablissementConfirme === false && etat.nouvelEtablissement.trim() === '') {
    return 'Écrivez le nouvel établissement';
  }
  if (etat.contacte === null) return 'Dites s’il a déjà été contacté';
  if (etat.connaitUES === null) return 'Dites s’il connaît l’UES';
  return null;
}

/** Le script joignable, dans l'ordre : chaque réponse manquante bloque la suivante. */
function manqueJoignable(etat: EtatScript): string | null {
  const script = manqueScript(etat);
  if (script !== null) return script;
  if (etat.statutChoisi === null && etat.ambassadeur === null) {
    return 'Dites s’il souhaite être représentant CHUES';
  }
  if (etat.ambassadeur !== true) return null;
  if (etat.memeWhatsapp === null) return 'Dites s’il a WhatsApp sur ce numéro';
  if (etat.memeWhatsapp === false && chiffresDe(etat.whatsapp) < 9) {
    return 'Écrivez le numéro WhatsApp';
  }
  return null;
}

// Le serveur jette une suggestion sans numéro : plutôt que d'effacer en
// silence ce qui vient d'être dicté, l'enregistrement attend le numéro.
function manqueSuggestion(etat: EtatScript): string | null {
  if (!etat.proposeQuelquUn || !etat.suggestionCommencee) return null;
  if (chiffresDe(etat.sugPhone) < 9) return 'Écrivez le numéro de la personne proposée';
  return null;
}

/** Ce qui empêche encore d'enregistrer, en une phrase, ou rien. */
export function manqueDe(etat: EtatScript): string | null {
  if (etat.resultat === null) return 'Choisissez d’abord le résultat';
  if (etat.joignable) {
    const joignable = manqueJoignable(etat);
    if (joignable !== null) return joignable;
  }
  if (etat.statut === null) return 'Choisissez un statut de qualification';
  if (exigeMotif(etat.statut) && etat.commentaire.trim() === '') return 'Écrivez le motif';
  if (dateDemandee(etat.statut) && etat.rappelAt === null) return 'Choisissez quand rappeler';
  return manqueSuggestion(etat);
}

/** Confirmation de l'établissement, et sa nouvelle valeur seulement si infirmée. */
function champsEtablissement(etat: EtatScript): Partial<RepAnswer> {
  if (etat.etablissementConfirme === null) return {};
  const nom = etat.nouvelEtablissement.trim();
  return {
    etablissementConfirme: etat.etablissementConfirme,
    ...(etat.etablissementConfirme === false && nom !== '' ? { etablissement: nom } : {}),
  };
}

function champsJoignable(etat: EtatScript): Partial<RepAnswer> {
  if (!etat.joignable) return {};
  return {
    ...champsEtablissement(etat),
    ...(etat.contacte === null ? {} : { contacte: etat.contacte }),
    ...(etat.connaitUES === null ? {} : { connaitUES: etat.connaitUES }),
    ...(etat.syndicatName === '' ? {} : { syndicat: etat.syndicatName }),
  };
}

function champsRelation(etat: EtatScript): Partial<RepAnswer> {
  if (!etat.joignable || etat.ambassadeur === null) return {};
  return { relationStatus: etat.ambassadeur ? 'AMBASSADEUR' : 'REFUS' };
}

function champsWhatsapp(etat: EtatScript): Partial<RepAnswer> {
  if (!etat.joignable || etat.ambassadeur !== true) return {};
  const meme = etat.memeWhatsapp === true;
  return {
    whatsappStatus: meme ? 'MEME_NUMERO' : 'AUTRE_NUMERO',
    ...(meme ? {} : { whatsappE164: etat.whatsapp.trim() }),
  };
}

function champsSuggestion(etat: EtatScript): Partial<RepAnswer> {
  if (!etat.proposeQuelquUn || !etat.suggestionCommencee) return {};
  return {
    suggestedPhone: etat.sugPhone.trim(),
    ...(etat.sugName.trim() === '' ? {} : { suggestedName: etat.sugName.trim() }),
    ...(etat.sugNote.trim() === '' ? {} : { suggestedNote: etat.sugNote.trim() }),
  };
}

/** Chaque champ voyage seul : ce que la question n'a pas posé ne part pas. */
export function reponseDe(etat: EtatScript, statut: StatutQualification): RepAnswer {
  return {
    outcome: outcomeDuStatut(statut.effect),
    statutQualificationId: statut.id,
    ...champsRelation(etat),
    ...champsJoignable(etat),
    ...champsWhatsapp(etat),
    ...(dateDemandee(statut) && etat.rappelAt !== null ? { callbackAt: etat.rappelAt } : {}),
    ...champsSuggestion(etat),
    ...(etat.commentaire.trim() === '' ? {} : { comment: etat.commentaire.trim() }),
  };
}
