import { unwrap } from '@crm/api-client/query';
import { formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';

export type TableauKairo = components['schemas']['TableauKairoOutputBody'];
export type EtatKairo = components['schemas']['EtatKairo'];
export type TicketKairo = components['schemas']['TicketKairo'];

export const CLE_KAIRO = ['admin', 'kairo'] as const;

export const STATUTS_KAIRO: Record<
  string,
  { libelle: string; variante: 'info' | 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  running: { libelle: 'En cours', variante: 'info' },
  'running:analyse': { libelle: 'Analyse en cours', variante: 'info' },
  'running:test': { libelle: 'Validation tests', variante: 'info' },
  'running:publication': { libelle: 'Création PR', variante: 'info' },
  retry: { libelle: 'Nouvel essai prévu', variante: 'warning' },
  pr: { libelle: 'PR proposée', variante: 'success' },
  escalade: { libelle: 'Escaladé', variante: 'warning' },
  echec: { libelle: 'Échec', variante: 'destructive' },
  abandon: { libelle: 'Clos avant traitement', variante: 'secondary' },
  arrete: { libelle: 'Arrêté', variante: 'secondary' },
  triage: { libelle: 'Triage (hors code)', variante: 'secondary' },
  doublon: { libelle: 'Doublon (PR liée)', variante: 'secondary' },
};

export const FILTRES_TICKETS = {
  tous: { libelle: 'Tous', statuts: null },
  aReprendre: { libelle: 'Bloqués', statuts: ['echec', 'escalade', 'arrete', 'triage'] },
  enCours: {
    libelle: 'En cours',
    statuts: ['running', 'running:analyse', 'running:test', 'running:publication', 'retry'],
  },
  pr: { libelle: 'PR proposées', statuts: ['pr'] },
} as const;
export type FiltreTickets = keyof typeof FILTRES_TICKETS;

export function formatDuree(secondes: number): string {
  if (secondes < 60) return `${String(secondes)} s`;
  const min = Math.floor(secondes / 60);
  const sec = secondes % 60;
  return sec > 0 ? `${String(min)} min ${String(sec)} s` : `${String(min)} min`;
}

export function ticketsFiltres(tickets: TicketKairo[], filtre: FiltreTickets): TicketKairo[] {
  const statuts: readonly string[] | null = FILTRES_TICKETS[filtre].statuts;
  return statuts === null ? tickets : tickets.filter((t) => statuts.includes(t.statut));
}

/** Kairo écrit ses dates en UTC, au format SQLite `AAAA-MM-JJ HH:MM:SS`. */
export function isoKairo(sqlite: string): string {
  return `${sqlite.replace(' ', 'T')}Z`;
}

export function ilYA(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { locale: fr, addSuffix: true });
}

export async function lireTableauKairo(): Promise<TableauKairo> {
  return unwrap(await getApiClient().GET('/api/v1/admin/kairo'));
}

export async function basculerPauseKairo(pause: boolean): Promise<void> {
  const chemin = pause ? '/api/v1/admin/kairo/pause' : '/api/v1/admin/kairo/reprise';
  unwrap(await getApiClient().POST(chemin));
}

export async function relancerTicketKairo(id: number): Promise<void> {
  unwrap(
    await getApiClient().POST('/api/v1/admin/kairo/tickets/{id}/relance', {
      params: { path: { id } },
    }),
  );
}
