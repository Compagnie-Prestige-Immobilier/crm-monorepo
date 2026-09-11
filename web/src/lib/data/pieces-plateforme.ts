import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type PieceDeposee = components['schemas']['PieceDeposee'];

/** Statuts rendus par la plateforme Grand Public ; CHUES n'en porte aucun. */
export const PIECE_STATUT_LABELS: Record<string, string> = {
  'en-attente': 'En attente',
  accepte: 'Acceptée',
  refuse: 'Refusée',
};

export function lienDeLaPiece(inscriptionId: string, code: string): string {
  return `/api/v1/bank-inscriptions/${inscriptionId}/piece?code=${encodeURIComponent(code)}`;
}

export function lienDeLArchive(inscriptionId: string): string {
  return `/api/v1/bank-inscriptions/${inscriptionId}/pieces.zip`;
}

export async function fetchPiecesDeposees(
  inscriptionId: string,
  client: ApiClient = getApiClient(),
): Promise<PieceDeposee[]> {
  const reponse = unwrap(
    await client.GET('/api/v1/bank-inscriptions/{id}/pieces', {
      params: { path: { id: inscriptionId } },
    }),
  );
  return reponse.pieces;
}
