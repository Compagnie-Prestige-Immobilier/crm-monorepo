import { ApiError, unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';
import { isDemoExport, withDemoSuffix } from '@/lib/demo-marking';
import { apiErrorText } from '@/lib/mutation-feedback';

export type ReponseAssistant = components['schemas']['Reponse'];
export type ParametresAssistant = components['schemas']['Parametres'];
export type QuestionEnregistree = components['schemas']['QuestionEnregistree'];
export type ResumeFiche = components['schemas']['ResumeOutputBody'];

const CHEMIN_ENREGISTREES = '/api/v1/assistant/questions-enregistrees';

export const CLE_QUESTIONS = ['assistant', 'questions'] as const;
export const CLE_SUGGESTIONS = ['assistant', 'suggestions'] as const;

export async function poserQuestion(
  question: string,
  precedent: ParametresAssistant | undefined,
  signal: AbortSignal,
): Promise<ReponseAssistant> {
  return unwrap(
    await getApiClient().POST('/api/v1/assistant/questions', {
      body: precedent === undefined ? { question } : { question, precedent },
      signal,
    }),
  );
}

// Le 503 de l'assistant dit quoi faire ; `apiErrorText` le remplacerait par « Erreur serveur ».
export function texteErreurAssistant(error: unknown): string {
  if (error instanceof ApiError && error.status === 503 && !error.message.startsWith('Request')) {
    return error.message;
  }
  return apiErrorText(error, 'L’assistant n’a pas répondu. Réessayez.');
}

export async function lireSuggestions(): Promise<string[]> {
  const { suggestions } = unwrap(await getApiClient().GET('/api/v1/assistant/suggestions'));
  return suggestions.map((suggestion) => suggestion.question);
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

export async function epinglerQuestion(id: string, epinglee: boolean): Promise<void> {
  unwrap(
    await getApiClient().PATCH(`${CHEMIN_ENREGISTREES}/{id}`, {
      params: { path: { id } },
      body: { epinglee },
    }),
  );
}

export async function supprimerQuestion(id: string): Promise<void> {
  unwrap(await getApiClient().DELETE(`${CHEMIN_ENREGISTREES}/{id}`, { params: { path: { id } } }));
}

export async function exporterReponse(parametres: ParametresAssistant): Promise<void> {
  const { outil, du = '', au = '', projet, axe } = parametres;
  const query = {
    outil,
    du,
    au,
    ...(projet === undefined ? {} : { projet }),
    ...(axe === undefined ? {} : { axe }),
  };
  const resultat = await getApiClient().GET('/api/v1/assistant/export', {
    params: { query },
    parseAs: 'blob',
  });
  const classeur = unwrap(resultat);
  const url = URL.createObjectURL(classeur);
  const ancre = document.createElement('a');
  ancre.href = url;
  ancre.download = withDemoSuffix(
    `assistant-${outil}-${du}-${au}.xlsx`,
    isDemoExport(resultat.response.headers),
  );
  ancre.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function resumerFiche(id: string): Promise<ResumeFiche> {
  return unwrap(
    await getApiClient().POST('/api/v1/prospects/{id}/resume', { params: { path: { id } } }),
  );
}
