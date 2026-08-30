import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type AndroidRelease = components['schemas']['AndroidReleaseDto'];

export interface AndroidReleaseList {
  items: AndroidRelease[];
  minVersionCode: number | null;
}

/** Route dédiée du panel : elle relaie le fichier en flux, sans le bufferiser. */
export const ANDROID_UPLOAD_PATH = '/api/app-updates/android';

export class UploadAbortedError extends Error {
  constructor() {
    super('Envoi annulé.');
    this.name = 'UploadAbortedError';
  }
}

export async function fetchAndroidReleases(
  client: ApiClient = getApiClient(),
): Promise<AndroidReleaseList> {
  return unwrap(await client.GET('/api/v1/app-updates/android/releases'));
}

export async function markAndroidReleaseMandatory(
  versionCode: number,
  client: ApiClient = getApiClient(),
): Promise<AndroidRelease> {
  return unwrap(
    await client.POST('/api/v1/app-updates/android/{versionCode}/mandatory', {
      params: { path: { versionCode } },
    }),
  );
}

export async function withdrawAndroidRelease(
  versionCode: number,
  client: ApiClient = getApiClient(),
): Promise<AndroidRelease> {
  return unwrap(
    await client.POST('/api/v1/app-updates/android/{versionCode}/withdraw', {
      params: { path: { versionCode } },
    }),
  );
}

export interface AndroidUploadInput {
  file: File;
  notes: string;
  signal?: AbortSignal | undefined;
  onProgress?: ((loaded: number, total: number) => void) | undefined;
}

function parseJson(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function readRelease(xhr: XMLHttpRequest): AndroidRelease {
  if (xhr.status === 0) throw new Error('Le serveur CPI est injoignable.');

  const body = parseJson(xhr.responseText);
  const response = new Response(null, { status: xhr.status });
  const ok = xhr.status >= 200 && xhr.status < 300;

  return unwrap<AndroidRelease, unknown>(
    ok ? { data: body as AndroidRelease, response } : { error: body ?? {}, response },
  );
}

/**
 * `fetch` n'expose aucune progression d'envoi : `XMLHttpRequest.upload` est la
 * seule API du navigateur qui la donne, et un APK de 85 Mo sans barre laisse
 * l'administrateur devant un écran muet pendant plusieurs minutes.
 */
export function uploadAndroidRelease({
  file,
  notes,
  signal,
  onProgress,
}: AndroidUploadInput): Promise<AndroidRelease> {
  const form = new FormData();
  const trimmed = notes.trim();
  if (trimmed !== '') form.append('notes', trimmed);
  form.append('file', file, file.name);

  return new Promise<AndroidRelease>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', ANDROID_UPLOAD_PATH);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.addEventListener('progress', (event) => {
      onProgress?.(event.loaded, event.lengthComputable ? event.total : file.size);
    });
    xhr.addEventListener('load', () => {
      try {
        resolve(readRelease(xhr));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    xhr.addEventListener('error', () => {
      reject(new Error('Le serveur CPI est injoignable.'));
    });
    xhr.addEventListener('timeout', () => {
      reject(new Error('Le serveur CPI est injoignable.'));
    });
    xhr.addEventListener('abort', () => {
      reject(new UploadAbortedError());
    });

    signal?.addEventListener(
      'abort',
      () => {
        xhr.abort();
      },
      { once: true },
    );

    xhr.send(form);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_024 * 1_024) return `${String(Math.ceil(bytes / 1_024))} Ko`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} Mo`;
}

/** Une empreinte de 64 caractères ne se lit pas : ses deux bouts suffisent à la comparer. */
export function shortHash(hex: string): string {
  return hex.length <= 20 ? hex : `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}
