import { unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';

export type Signalement = components['schemas']['SignalementDTO'];

const CHEMIN = '/api/v1/support/tickets';

const ETATS_ACTIFS = new Set(['en_attente', 'en_cours', 'reessai_planifie']);

export function signalementActif(s: Signalement): boolean {
  return ETATS_ACTIFS.has(s.etat);
}

export function libelleEtat(s: Signalement): string {
  switch (s.etat) {
    case 'en_attente':
    case 'en_cours':
      return "En cours d'envoi";
    case 'reessai_planifie':
      return 'Envoi retardé';
    case 'a_verifier':
      return 'Transmission à vérifier';
    case 'echec':
      return 'Échec de transmission';
    default:
      return s.numeroGlpi === null ? 'Transmis' : `Ticket n° ${String(s.numeroGlpi)}`;
  }
}

export async function envoyerSignalement(
  cle: string,
  champs: Record<string, string>,
  images: File[],
  documents: File[],
): Promise<Signalement> {
  const form = new FormData();
  form.append('cle', cle);
  for (const [nom, valeur] of Object.entries(champs)) form.append(nom, valeur);
  for (const fichier of images) form.append('images', fichier);
  for (const fichier of documents) form.append('fichiers', fichier);
  return unwrap(
    await getApiClient().POST(CHEMIN, {
      body: { cle: '', description: '', contexte: '', images: [], urgence: 3, categorie: 1 },
      bodySerializer: () => form,
    }),
  );
}

export async function lireSignalements(): Promise<Signalement[]> {
  return unwrap(await getApiClient().GET(CHEMIN));
}

export async function reprendreSignalement(id: string): Promise<Signalement> {
  return unwrap(
    await getApiClient().POST('/api/v1/support/tickets/{id}/reprendre', {
      params: { path: { id } },
    }),
  );
}

export async function lireCategoriesSupport(): Promise<{ value: string; label: string }[]> {
  const categories = unwrap(await getApiClient().GET('/api/v1/support/categories'));
  return categories.map((c) => ({ value: String(c.id), label: c.nom }));
}
