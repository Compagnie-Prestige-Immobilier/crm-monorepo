import type { Projet } from '@crm/database';

/**
 * Un prospect candidat au rapprochement. `emails` vient des tentatives d'appel :
 * `Prospect` n'a pas de colonne e-mail, la conversion l'enregistre sur
 * `call_attempts`.
 */
export interface CandidatProspect {
  readonly id: string;
  readonly projet: Projet;
  readonly phoneE164: string;
  readonly whatsappE164: string | null;
  readonly emails: readonly string[];
  readonly clientCreatedAt: Date;
}

export interface IndexProspects {
  readonly parTelephone: ReadonlyMap<string, readonly CandidatProspect[]>;
  readonly parEmail: ReadonlyMap<string, readonly CandidatProspect[]>;
}

const cleEmail = (valeur: string): string => valeur.trim().toLowerCase();

/** Le plus ancien d'abord, puis l'identifiant : deux tirages rendent le même lien. */
const ordre = (a: CandidatProspect, b: CandidatProspect): number =>
  a.clientCreatedAt.getTime() - b.clientCreatedAt.getTime() || a.id.localeCompare(b.id);

function ajouter(
  index: Map<string, CandidatProspect[]>,
  cle: string,
  candidat: CandidatProspect,
): void {
  const seau = index.get(cle);
  if (seau === undefined) index.set(cle, [candidat]);
  else if (!seau.some((deja) => deja.id === candidat.id)) seau.push(candidat);
}

export function indexerProspects(candidats: readonly CandidatProspect[]): IndexProspects {
  const parTelephone = new Map<string, CandidatProspect[]>();
  const parEmail = new Map<string, CandidatProspect[]>();

  for (const candidat of candidats) {
    ajouter(parTelephone, candidat.phoneE164, candidat);
    if (candidat.whatsappE164 !== null) ajouter(parTelephone, candidat.whatsappE164, candidat);
    for (const email of candidat.emails) ajouter(parEmail, cleEmail(email), candidat);
  }

  for (const seau of parTelephone.values()) seau.sort(ordre);
  for (const seau of parEmail.values()) seau.sort(ordre);

  return { parTelephone, parEmail };
}

/**
 * Le prospect du MÊME projet reconnu au téléphone, sinon à l'e-mail.
 *
 * Le projet est vérifié ici en plus de l'être dans la requête : une inscription
 * CHUES ne se rapproche d'aucune fiche Grand Public, et l'inverse, quelle que
 * soit la façon dont les candidats ont été rassemblés.
 */
export function choisirProspect(
  projet: Projet,
  phoneE164: string | null,
  email: string | null,
  index: IndexProspects,
): string | null {
  const duProjet = (candidats: readonly CandidatProspect[] | undefined): string | null =>
    candidats?.find((candidat) => candidat.projet === projet)?.id ?? null;

  if (phoneE164 !== null && phoneE164.trim() !== '') {
    const parTelephone = duProjet(index.parTelephone.get(phoneE164));
    if (parTelephone !== null) return parTelephone;
  }

  if (email !== null && email.trim() !== '') {
    return duProjet(index.parEmail.get(cleEmail(email)));
  }

  return null;
}
