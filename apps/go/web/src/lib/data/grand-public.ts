import { z } from '@/lib/zod';

import { ApiError, apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { PaymentMode, Prospect, ProspectQuery, ProspectType } from '@/lib/data/console';

type Schemas = components['schemas'];

export type ProspectBody = Schemas['ProspectBody'];
export type ProspectStatut = Prospect['statut'];
export type Consentement = Schemas['ProspectConsentementInputBody']['consent'];
export type ConversionBody = Schemas['ProspectConversionInputBody'];
export type ModeEpargne = NonNullable<Prospect['modeEpargne']>;
export type TypeContrat = NonNullable<Prospect['typeContrat']>;

export const PROSPECT_TYPES = [
  'FONCTIONNAIRE',
  'SECTEUR_PRIVE',
  'INFORMEL',
  'DIASPORA',
] as const satisfies readonly ProspectType[];

export const PROSPECT_TYPE_LABELS: Record<ProspectType, string> = {
  FONCTIONNAIRE: 'Fonctionnaire',
  SECTEUR_PRIVE: 'Secteur privé',
  INFORMEL: 'Informel',
  DIASPORA: 'Diaspora',
};

export const PROSPECT_STATUTS = ['NOUVEAU', 'CONTACTE', 'CONVERTI', 'PERDU'] as const;

export const PROSPECT_STATUT_LABELS: Record<ProspectStatut, string> = {
  NOUVEAU: 'Nouveau',
  CONTACTE: 'Contacté',
  CONVERTI: 'Converti',
  PERDU: 'Perdu',
};

export const STATUT_VARIANT: Record<
  ProspectStatut,
  'secondary' | 'info' | 'success' | 'destructive'
> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  COMPTANT: 'Comptant',
  ECHELONNE: 'Échelonné',
};

export const MODE_EPARGNE_LABELS: Record<ModeEpargne, string> = {
  TONTINE: 'Tontine',
  MOBILE_MONEY: 'Mobile money',
  BANQUE: 'Banque',
  AUCUN: 'Aucun',
};

export const TYPE_CONTRAT_LABELS: Record<TypeContrat, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  AUTRE: 'Autre',
};

/** Les durées que le métier pratique. Un choix fermé plutôt qu'une frappe libre. */
export const DUREES_MOIS = [
  6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120, 144, 180, 240, 300,
] as const;

export function formatDureeMois(mois: number): string {
  if (mois % 12 !== 0) return `${String(mois)} mois`;
  const ans = mois / 12;
  return `${String(ans)} an${ans > 1 ? 's' : ''} (${String(mois)} mois)`;
}

export function formatAnciennete(mois: number): string {
  if (mois < 12) return `${String(mois)} mois`;
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const debut = `${String(ans)} an${ans > 1 ? 's' : ''}`;
  return reste === 0 ? debut : `${debut} et ${String(reste)} mois`;
}

export interface PageProspects {
  readonly items: Prospect[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

export async function fetchPageProspects(query: ProspectQuery): Promise<PageProspects> {
  const page = unwrap(await apiClient.GET('/api/v1/prospects', { params: { query } }));
  return {
    items: page.items ?? [],
    total: page.meta.total,
    page: page.meta.page,
    pageCount: page.meta.pageCount,
  };
}

/** `projet` est posé ICI : oublié, la création tomberait dans le projet CHUES. */
export async function creerProspect(body: ProspectBody): Promise<Prospect> {
  return unwrap(
    await apiClient.POST('/api/v1/prospects', { body: { ...body, projet: 'GRAND_PUBLIC' } }),
  );
}

export async function modifierProspect(id: string, body: ProspectBody): Promise<Prospect> {
  return unwrap(
    await apiClient.PATCH('/api/v1/prospects/{id}', { params: { path: { id } }, body }),
  );
}

export async function majConsentement(id: string, consent: Consentement): Promise<Prospect> {
  return unwrap(
    await apiClient.PATCH('/api/v1/prospects/{id}/parcours/grand-public/consentement', {
      params: { path: { id } },
      body: { consent },
    }),
  );
}

export async function confirmerConversion(id: string, body: ConversionBody): Promise<Prospect> {
  return unwrap(
    await apiClient.POST('/api/v1/prospects/{id}/parcours/grand-public/conversion', {
      params: { path: { id } },
      body,
    }),
  );
}

const conflitSchema = z.object({
  id: z.string().optional(),
  nom: z.string().optional(),
  prenom: z.string().optional(),
  ownedByCommercialName: z.string(),
  createdAt: z.string().optional(),
});

export type ConflitTelephone = z.infer<typeof conflitSchema>;

/**
 * La fiche que le 409 nomme. Elle voyage dans `errors[0].value`, hors du
 * schéma OpenAPI : elle se relit donc à l'exécution, jamais par un cast.
 */
export function conflitTelephone(error: unknown): ConflitTelephone | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const payload = error.payload;
  if (typeof payload !== 'object' || payload === null) return null;
  const { code, errors } = payload as { code?: unknown; errors?: unknown };
  if (code !== 'PROSPECT_PHONE_CONFLICT' || !Array.isArray(errors)) return null;
  const value = (errors[0] as { value?: unknown } | undefined)?.value;
  const lu = conflitSchema.safeParse(value);
  return lu.success ? lu.data : null;
}
