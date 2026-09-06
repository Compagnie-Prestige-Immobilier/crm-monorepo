import { WhatsappStatus } from '@crm/database';

export interface WhatsappCourant {
  readonly whatsappStatus: WhatsappStatus;
  readonly whatsappE164: string | null;
  readonly phoneE164: string;
}

export interface WhatsappSaisi {
  /** Absent : la question n'a pas ete reposee. */
  readonly statut?: WhatsappStatus;
  /** Deja normalise en E.164. `null` vide la colonne, `undefined` la laisse. */
  readonly numero?: string | null;
}

export interface WhatsappPatchProspect {
  whatsappStatus?: WhatsappStatus;
  whatsappE164?: string | null;
}

/**
 * EB-23, cote prospect. NE LEVE JAMAIS, contrairement au resolveur des
 * representants : les fiches de la diaspora portent un numero WhatsApp saisi
 * bien avant que le statut n'existe, et les versions deja installees continuent
 * de l'envoyer seul. Un refus ici serait definitif pour une saisie hors ligne.
 *
 * Le statut se deduit alors du numero. AUTRE_NUMERO sans numero retombe sur
 * AUCUN : c'est ce que dit la reponse « non » quand aucun second numero ne
 * suit, et le CHECK reste tenu.
 */
export function whatsappDuProspect(
  saisi: WhatsappSaisi,
  courant: WhatsappCourant,
): WhatsappPatchProspect {
  if (saisi.statut === undefined && saisi.numero === undefined) return {};

  const statut = saisi.statut ?? deduireStatut(saisi.numero, courant.phoneE164);
  if (statut !== WhatsappStatus.AUTRE_NUMERO) {
    return { whatsappStatus: statut, whatsappE164: null };
  }

  const numero = saisi.numero ?? courant.whatsappE164;
  if (numero === null) return { whatsappStatus: WhatsappStatus.AUCUN, whatsappE164: null };
  return { whatsappStatus: WhatsappStatus.AUTRE_NUMERO, whatsappE164: numero };
}

function deduireStatut(numero: string | null | undefined, phoneE164: string): WhatsappStatus {
  if (numero === undefined || numero === null) return WhatsappStatus.NON_DEMANDE;
  return numero === phoneE164 ? WhatsappStatus.MEME_NUMERO : WhatsappStatus.AUTRE_NUMERO;
}
