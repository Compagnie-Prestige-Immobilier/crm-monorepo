import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

/**
 * Releases Android : lecture de la dernière version, et publication d'un APK.
 *
 * La forme vient du contrat engendré. Elle était redéclarée ici avec son
 * validateur, sur la promesse que la route n'y figurait pas encore : elle y
 * figure (`/api/v1/app-updates/android*`). Deux déclarations d'un même contrat
 * finissent toujours par diverger, et c'est celle qui n'est pas engendrée qui a
 * tort, sans que rien ne le signale.
 */
export type AndroidUpdate = components['schemas']['AppUpdateDto'];

/**
 * `versionCode: 0` : on demande « la dernière, quelle qu'elle soit ».
 *
 * L'appelant ici est le PANEL, qui administre les releases ; il n'a pas de
 * version installée à comparer. Le mobile, lui, envoie la sienne pour que l'API
 * réponde `available: false` quand il est déjà à jour.
 */
export async function fetchAndroidUpdate(
  client: ApiClient = getApiClient(),
): Promise<AndroidUpdate> {
  return unwrap(
    await client.GET('/api/v1/app-updates/android/current', {
      params: { query: { versionCode: 0 } },
    }),
  );
}

/**
 * Publication d'un APK : le second appel MULTIPART du panel.
 *
 * `bodySerializer` rend le `FormData` tel quel. Sans lui, `openapi-fetch`
 * sérialiserait en JSON et l'APK partirait en `{}`. Le laisser intact permet
 * aussi au navigateur de poser l'en-tête `content-type` avec sa frontière, qu'on
 * ne peut pas fabriquer correctement à la main.
 *
 * `versionCode` est envoyé en CHAÎNE dans le corps multipart, comme tout champ
 * de formulaire : c'est l'API qui le convertit. Le contrat le déclare `number`
 * parce qu'il décrit la valeur, pas son encodage sur le fil.
 */
export async function uploadAndroidUpdate(
  input: {
    file: File;
    versionName: string;
    versionCode: string;
    forceUpdate: boolean;
    notes: string;
  },
  client: ApiClient = getApiClient(),
): Promise<AndroidUpdate> {
  const form = new FormData();
  form.append('versionName', input.versionName.trim());
  form.append('versionCode', input.versionCode.trim());
  form.append('forceUpdate', String(input.forceUpdate));
  if (input.notes.trim() !== '') form.append('notes', input.notes.trim());
  form.append('file', input.file, input.file.name);

  return unwrap(
    await client.POST('/api/v1/app-updates/android', {
      body: {
        file: '',
        versionName: input.versionName.trim(),
        versionCode: Number(input.versionCode.trim()),
        forceUpdate: input.forceUpdate,
      },
      bodySerializer: () => form,
    }),
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_024 * 1_024) return `${String(Math.ceil(bytes / 1_024))} Ko`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} Mo`;
}
