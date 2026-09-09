const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export interface TemplateRenderResult {
  readonly text: string;
  readonly missing: readonly string[];
}

export const extractVariables = (template: string): string[] => {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined && !found.includes(name)) found.push(name);
  }
  return found;
};

export const renderTemplate = (
  template: string,
  variables: Readonly<Record<string, string | number | null | undefined>>,
): TemplateRenderResult => {
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
};

export interface RenderedNotification {
  readonly title: string;
  readonly body: string;
  readonly missing: readonly string[];
}

export const renderNotification = (
  titleTemplate: string,
  bodyTemplate: string,
  variables: Readonly<Record<string, string | number | null | undefined>>,
): RenderedNotification => {
  const title = renderTemplate(titleTemplate, variables);
  const body = renderTemplate(bodyTemplate, variables);
  const missing = [...title.missing];
  for (const name of body.missing) if (!missing.includes(name)) missing.push(name);
  return { title: title.text, body: body.text, missing };
};
