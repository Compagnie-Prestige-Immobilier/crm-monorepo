/**
 * Substitution `{{variable}}` : PORT EXACT de
 * `apps/api/src/modules/notifications/template.ts`.
 *
 * Dupliqué délibérément, et la duplication est le point : l'aperçu du
 * compositeur doit se mettre à jour à CHAQUE frappe, ce qu'un aller-retour
 * réseau ne peut pas faire sans saccade ni condition de course entre réponses.
 *
 * La contrainte qui en découle : les deux implémentations doivent avoir la même
 * sémantique, en particulier sur la variable manquante : marqueur laissé
 * visible, nom remonté dans `missing`. `template.test.ts` fixe cette sémantique
 * des deux côtés avec les mêmes cas.
 */

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export interface TemplateRenderResult {
  readonly text: string;
  readonly missing: readonly string[];
}

/** Liste les variables citées par un gabarit, dans l'ordre, sans doublon. */
export function extractVariables(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Rend un gabarit. Une variable manquante laisse son marqueur EN PLACE et son
 * nom est signalé : voir l'en-tête du fichier serveur pour le raisonnement.
 */
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

/** Rend titre et corps ensemble, en fusionnant les variables manquantes. */
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

/**
 * Union ordonnée des variables du titre puis du corps.
 * Miroir de `mergedVariables` côté API.
 */
export function mergedVariables(titleTemplate: string, bodyTemplate: string): string[] {
  const names = extractVariables(titleTemplate);
  for (const name of extractVariables(bodyTemplate)) {
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Troncature d'aperçu.
 *
 * Android replie une notification sur UNE ligne de titre et deux de corps tant
 * qu'elle n'est pas dépliée. L'aperçu doit donc montrer le texte tel qu'il sera
 * REELLEMENT lu : un aperçu qui affiche cinq lignes confortables laisse
 * l'auteur croire que sa phrase passe en entier, alors qu'elle sera coupée au
 * milieu sur le téléphone.
 */
export function previewClamp(text: string, limit: number): { text: string; truncated: boolean } {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return { text: flat, truncated: false };
  return { text: `${flat.slice(0, limit).trimEnd()}…`, truncated: true };
}
