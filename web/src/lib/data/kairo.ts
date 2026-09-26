import { unwrap } from '@crm/api-client/query';
import { formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';
import { estModeDev } from '@/lib/data/kairo-simulation';

export type TableauKairo = components['schemas']['TableauKairoOutputBody'];
export type EtatKairo = components['schemas']['EtatKairo'];
export type TicketKairo = components['schemas']['TicketKairo'];

export type AssistantKairos = components['schemas']['AssistantKairos'];

export const CLE_KAIRO = ['admin', 'kairo'] as const;
export const CLE_ASSISTANT_KAIROS = ['kairos'] as const;

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
  clos: { libelle: 'Déjà résolu (fermé)', variante: 'success' },
};

export const FILTRES_TICKETS = {
  tous: { libelle: 'Tous', statuts: null },
  aReprendre: { libelle: 'À arbitrer', statuts: ['echec', 'escalade', 'arrete', 'triage'] },
  enCours: {
    libelle: 'En cours',
    statuts: ['running', 'running:analyse', 'running:test', 'running:publication', 'retry'],
  },
  pr: { libelle: 'PR proposées', statuts: ['pr', 'clos'] },
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

/** Somme sur TOUS les tickets connus, pas seulement la page affichée. */
export function compteGroupe(comptes: Record<string, number>, filtre: FiltreTickets): number {
  const statuts = FILTRES_TICKETS[filtre].statuts;
  if (statuts === null) return Object.values(comptes).reduce((acc, n) => acc + n, 0);
  return statuts.reduce((acc, statut) => acc + (comptes[statut] ?? 0), 0);
}

/** Kairo écrit ses dates en UTC, au format SQLite `AAAA-MM-JJ HH:MM:SS`. */
export function isoKairo(sqlite: string): string {
  return `${sqlite.replace(' ', 'T')}Z`;
}

export function ilYA(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { locale: fr, addSuffix: true });
}

export async function lireTableauKairo(page = 1, pageSize = 25): Promise<TableauKairo> {
  return unwrap(
    await getApiClient().GET('/api/v1/admin/kairo', { params: { query: { page, pageSize } } }),
  );
}

export async function basculerPauseKairo(pause: boolean): Promise<void> {
  const chemin = pause ? '/api/v1/admin/kairo/pause' : '/api/v1/admin/kairo/reprise';
  try {
    unwrap(await getApiClient().POST(chemin));
  } catch (err) {
    if (estModeDev()) return;
    throw err;
  }
}

export async function basculerReparationBaseKairo(active: boolean): Promise<void> {
  const chemin = active
    ? '/api/v1/admin/kairo/reglages/reparation-base/activer'
    : '/api/v1/admin/kairo/reglages/reparation-base/desactiver';
  try {
    unwrap(await getApiClient().POST(chemin));
  } catch (err) {
    if (estModeDev()) return;
    throw err;
  }
}

export async function relancerTicketKairo(
  options:
    | number
    | {
        id: number;
        consigne?: string | undefined;
        action?: 'relancer' | 'prendre_en_main' | undefined;
      },
): Promise<void> {
  const id = typeof options === 'number' ? options : options.id;
  const consigne = typeof options === 'object' ? options.consigne : undefined;
  const action = typeof options === 'object' ? options.action : undefined;

  const corps: { consigne?: string; action?: string } = {};
  if (consigne) corps.consigne = consigne;
  if (action) corps.action = action;

  try {
    unwrap(
      await getApiClient().POST('/api/v1/admin/kairo/tickets/{id}/relance', {
        params: { path: { id } },
        body: Object.keys(corps).length > 0 ? corps : undefined,
      }),
    );
  } catch (err) {
    if (estModeDev()) return;
    throw err;
  }
}

export async function prendreEnMainTicketKairo(id: number): Promise<void> {
  return relancerTicketKairo({ id, action: 'prendre_en_main' });
}

export async function lireAssistantKairos(): Promise<AssistantKairos> {
  return unwrap(await getApiClient().GET('/api/v1/kairos'));
}

export async function afficherAssistantKairos(affiche: boolean): Promise<AssistantKairos> {
  return unwrap(await getApiClient().PUT('/api/v1/kairos', { body: { affiche } }));
}
