import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type ParametresChues = components['schemas']['ProspectParametresChues'];
export type MajParametresChues = components['schemas']['ProspectMajParametresInputBody'];
export type ChangementParametre = components['schemas']['ProspectParametreChangement'];

export const LIBELLES_PARAMETRE: Record<string, string> = {
  plateformeChuesUrl: 'Lien de la plateforme CPI CHUES',
  plateformeGrandPublicUrl: 'Lien de la plateforme Grand Public',
  emailChues: 'Adresse e-mail CHUES',
  whatsappChuesE164: 'Numéro WhatsApp CHUES',
  messageWhatsapp: 'Message WhatsApp',
  accuseReceptionObjet: 'Accusé de réception, objet',
  accuseReceptionCorps: 'Accusé de réception, corps',
  destinatairesEnrolement: 'Cellule enrôlement',
  destinatairesBpe: 'Cellule BPE',
  destinatairesSupervision: 'Superviseurs',
  destinatairesDirection: 'Direction',
  verrouFiches: 'Verrou des fiches',
};

/** Les quatre clés dont la valeur est une liste d'adresses, une par ligne. */
export const LISTES_DESTINATAIRES = [
  'destinatairesEnrolement',
  'destinatairesBpe',
  'destinatairesSupervision',
  'destinatairesDirection',
] as const;

export type CleDestinataires = (typeof LISTES_DESTINATAIRES)[number];

export const enLignes = (adresses: readonly string[] | null): string => (adresses ?? []).join('\n');

export const enListe = (saisie: string): string[] =>
  saisie
    .split(/[\n,;]/u)
    .map((part) => part.trim())
    .filter((part) => part !== '');

export async function fetchParametresChues(): Promise<ParametresChues> {
  return unwrap(await apiClient.GET('/api/v1/parametres-chues'));
}

export async function majParametresChues(body: MajParametresChues): Promise<ParametresChues> {
  return unwrap(await apiClient.PATCH('/api/v1/parametres-chues', { body }));
}

export async function fetchJournalParametres(): Promise<ChangementParametre[]> {
  const page = unwrap(await apiClient.GET('/api/v1/parametres-chues/journal'));
  return page.items ?? [];
}
