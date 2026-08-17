const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export interface TemplateRenderResult {
  readonly text: string;
  readonly missing: readonly string[];
}

export function extractVariables(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined && !found.includes(name)) found.push(name);
  }
  return found;
}

export function renderTemplate(
  template: string,
  variables: Readonly<Record<string, string | number | null | undefined>>,
): TemplateRenderResult {
  const missing: string[] = [];

  const text = template.replace(PLACEHOLDER, (placeholder, rawName: string) => {
    const value = variables[rawName];
    if (value === undefined || value === null || value === '') {
      if (!missing.includes(rawName)) missing.push(rawName);
      return placeholder;
    }
    return String(value);
  });

  return { text, missing };
}

export interface RenderedNotification {
  readonly title: string;
  readonly body: string;
  readonly missing: readonly string[];
}

export function renderNotification(
  titleTemplate: string,
  bodyTemplate: string,
  variables: Readonly<Record<string, string | number | null | undefined>>,
): RenderedNotification {
  const title = renderTemplate(titleTemplate, variables);
  const body = renderTemplate(bodyTemplate, variables);
  const missing = [...title.missing];
  for (const name of body.missing) if (!missing.includes(name)) missing.push(name);
  return { title: title.text, body: body.text, missing };
}

export function mergedVariables(titleTemplate: string, bodyTemplate: string): string[] {
  const names = extractVariables(titleTemplate);
  for (const name of extractVariables(bodyTemplate)) {
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function previewClamp(text: string, limit: number): { text: string; truncated: boolean } {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return { text: flat, truncated: false };
  return { text: `${flat.slice(0, limit).trimEnd()}…`, truncated: true };
}
