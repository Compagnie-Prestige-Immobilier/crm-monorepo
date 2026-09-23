import { unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';

export type ReponseAssistant = components['schemas']['Reponse'];
export type QuestionEnregistree = components['schemas']['QuestionEnregistree'];

const CHEMIN_ENREGISTREES = '/api/v1/assistant/questions-enregistrees';

export const CLE_QUESTIONS = ['assistant', 'questions'] as const;

export const EXEMPLES = [
  'Combien d’appels la semaine dernière ?',
  'Quel canal convertit le mieux depuis trois mois ?',
  'Combien de conversions puis-je attendre des fiches ouvertes ?',
];

export async function poserQuestion(question: string): Promise<ReponseAssistant> {
  return unwrap(await getApiClient().POST('/api/v1/assistant/questions', { body: { question } }));
}

export async function lireQuestions(): Promise<QuestionEnregistree[]> {
  return unwrap(await getApiClient().GET(CHEMIN_ENREGISTREES));
}

export async function enregistrerQuestion(champs: {
  libelle: string;
  question: string;
  partagee: boolean;
}): Promise<QuestionEnregistree[]> {
  return unwrap(await getApiClient().POST(CHEMIN_ENREGISTREES, { body: champs }));
}

export async function supprimerQuestion(id: string): Promise<void> {
  unwrap(await getApiClient().DELETE(`${CHEMIN_ENREGISTREES}/{id}`, { params: { path: { id } } }));
}
