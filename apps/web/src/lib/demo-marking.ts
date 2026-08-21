export const DEMO_MODE_HEADER = 'X-Demo-Mode';

export const DEMO_FILENAME_SUFFIX = '-DEMONSTRATION';

export function isDemoExport(headers: Headers): boolean {
  return headers.get(DEMO_MODE_HEADER)?.trim().toLowerCase() === 'true';
}

export function withDemoSuffix(fileName: string, demoEnabled: boolean): string {
  if (!demoEnabled) return fileName;

  const dot = fileName.lastIndexOf('.');
  const stem = dot <= 0 ? fileName : fileName.slice(0, dot);
  const extension = dot <= 0 ? '' : fileName.slice(dot);

  return stem.endsWith(DEMO_FILENAME_SUFFIX)
    ? fileName
    : `${stem}${DEMO_FILENAME_SUFFIX}${extension}`;
}
