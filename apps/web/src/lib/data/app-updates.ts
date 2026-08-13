import {
  apiFetch,
  apiUpload,
  asBoolean,
  asNullableString,
  asNumber,
  asRecord,
  asString,
} from '@/lib/api/raw';

export type AndroidUpdate = {
  available: boolean;
  forceUpdate: boolean;
  versionName: string;
  versionCode: number;
  fileName: string;
  fileSize: number;
  sha256: string;
  downloadUrl: string;
  publishedAt: string;
  notes: string | null;
};

function parseAndroidUpdate(value: unknown): AndroidUpdate {
  const root = asRecord(value, 'release Android');
  return {
    available: asBoolean(root.available, 'available'),
    forceUpdate: asBoolean(root.forceUpdate, 'forceUpdate'),
    versionName: asString(root.versionName, 'versionName'),
    versionCode: asNumber(root.versionCode, 'versionCode'),
    fileName: asString(root.fileName, 'fileName'),
    fileSize: asNumber(root.fileSize, 'fileSize'),
    sha256: asString(root.sha256, 'sha256'),
    downloadUrl: asString(root.downloadUrl, 'downloadUrl'),
    publishedAt: asString(root.publishedAt, 'publishedAt'),
    notes: asNullableString(root.notes, 'notes'),
  };
}

export function fetchAndroidUpdate(): Promise<AndroidUpdate> {
  return apiFetch('/app-updates/android/current?versionCode=0', parseAndroidUpdate);
}

export function uploadAndroidUpdate(input: {
  file: File;
  versionName: string;
  versionCode: string;
  forceUpdate: boolean;
  notes: string;
}): Promise<AndroidUpdate> {
  const form = new FormData();
  form.append('versionName', input.versionName.trim());
  form.append('versionCode', input.versionCode.trim());
  form.append('forceUpdate', String(input.forceUpdate));
  if (input.notes.trim() !== '') form.append('notes', input.notes.trim());
  form.append('file', input.file, input.file.name);
  return apiUpload('/app-updates/android', form, parseAndroidUpdate);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_024 * 1_024) return `${String(Math.ceil(bytes / 1_024))} Ko`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} Mo`;
}
