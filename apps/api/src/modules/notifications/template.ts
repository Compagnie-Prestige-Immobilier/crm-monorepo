/**
 * Substitution `{{variable}}` des gabarits de notification.
 *
 * Fonction PURE, sans injection ni base : c'est ce qui permet au compositeur
 * web d'en afficher l'aperçu en direct avec exactement la même sémantique que
 * le serveur au moment de l'envoi. Deux implémentations divergentes de la
 * substitution produiraient un aperçu qui ment.
 */

/**
 * Un nom de variable : lettres, chiffres, `_`, `.`. Les espaces autour des
 * accolades sont tolérés (`{{ nom }}`), parce qu'un auteur humain en met.
 */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export interface TemplateRenderResult {
  readonly text: string;
  /** Variables citées par le gabarit et absentes du contexte, sans doublon. */
  readonly missing: readonly string[];
}

/** Liste les variables citées par un gabarit, dans l'ordre, sans doublon. */
export const extractVariables = (template: string): string[] => {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined && !found.includes(name)) found.push(name);
  }
  return found;
};

/**
 * Rend un gabarit.
 *
 * UNE VARIABLE MANQUANTE N'EST PAS REMPLACÉE — le `{{nom}}` reste visible tel
 * quel, et son nom est remonté dans `missing`.
 *
 * Les deux autres options ont été écartées :
 *
 *  - Lever : un rappel nocturne qui échoue en silence parce qu'un commercial
 *    n'a pas de département renseigné est pire que le même rappel imparfait.
 *  - Remplacer par du vide : produit « Bonjour , vous avez 3 tâches », une
 *    phrase trouée que le lecteur attribue à un bug de l'application sans
 *    pouvoir dire lequel.
 *
 * Le marqueur laissé en clair est laid, mais il DIT ce qui manque. Et comme
 * `missing` remonte jusqu'au compositeur, l'admin voit le problème avant
 * d'expédier — c'est là que la faute se corrige.
 */
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

/** Rend titre et corps ensemble, en fusionnant les variables manquantes. */
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
