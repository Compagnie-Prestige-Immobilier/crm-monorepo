import { z } from '@/lib/zod';

import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import { uuidV7 } from '@/lib/data/console';
import type { Representant } from '@/lib/data/representants';

export type RepAttemptBody = components['schemas']['QualificationRepAttemptBody'];
export type RepCallOutcome = RepAttemptBody['outcome'];
export type RepAttemptResult = components['schemas']['QualificationRepAttemptOutputBody'];

/**
 * Une réponse, et une seule. Chaque champ voyage seul pour qu'un appel coupé
 * après « non » laisse quand même le refus en base.
 */
export type RepAnswer = Omit<RepAttemptBody, 'id' | 'representantId' | 'clientCreatedAt'>;

export function buildRepAttempt(
  representantId: string,
  answer: RepAnswer,
  now: number = Date.now(),
): RepAttemptBody {
  return {
    ...answer,
    id: uuidV7(now),
    representantId,
    clientCreatedAt: new Date(now).toISOString(),
  };
}

/** Rejouer le même `id` rend 200 `duplicate` : une reprise après coupure ne double rien. */
export async function pushRepCallAttempt(body: RepAttemptBody): Promise<RepAttemptResult> {
  return unwrap(await apiClient.POST('/api/v1/rep-campaigns/attempts', { body }));
}

/** Une relation tranchée n'a plus rien à donner au script : elle est en queue de file. */
export function relationTranchee(representant: Representant): boolean {
  return representant.relationStatus === 'AMBASSADEUR' || representant.relationStatus === 'REFUS';
}

const texte = z.string().catch('');
const oui = z.boolean().nullable().catch(null);

/** Le script de qualification d'un représentant, réponse par réponse. */
const brouillonRepSchema = z.object({
  resultat: z.enum(['JOIGNABLE', 'INJOIGNABLE']).nullable().catch(null),
  statutId: z.string().nullable().catch(null),
  etablissementConfirme: oui,
  nouvelEtablissement: texte,
  contacte: oui,
  connaitUES: oui,
  syndicatId: z.string().nullable().catch(null),
  ambassadeur: oui,
  memeWhatsapp: oui,
  whatsapp: texte,
  rappelAt: z.string().nullable().catch(null),
  sugPhone: texte,
  sugName: texte,
  sugNote: texte,
  commentaire: texte,
});

export type BrouillonRep = z.infer<typeof brouillonRepSchema>;

const RIEN_REP: BrouillonRep = {
  resultat: null,
  statutId: null,
  etablissementConfirme: null,
  nouvelEtablissement: '',
  contacte: null,
  connaitUES: null,
  syndicatId: null,
  ambassadeur: null,
  memeWhatsapp: null,
  whatsapp: '',
  rappelAt: null,
  sugPhone: '',
  sugName: '',
  sugNote: '',
  commentaire: '',
};

/** Un brouillon abîmé rend un script vierge : rouvrir la fiche prime. */
export function lireBrouillonRep(draft: unknown): BrouillonRep {
  const lu = brouillonRepSchema.safeParse(draft);
  return lu.success ? lu.data : RIEN_REP;
}
