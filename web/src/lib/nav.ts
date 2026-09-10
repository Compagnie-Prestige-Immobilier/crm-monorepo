export {
  coqueHomePath,
  coqueOf,
  coquesForRole,
  homePathForRole,
  HUB_PATH,
  navTitle,
} from '@/components/layout/nav-items';

/** Une adresse interne seulement : `//evil.com` commence par « / » et reste une URL absolue. */
export function cheminInterne(valeur: unknown): string | undefined {
  if (typeof valeur !== 'string') return undefined;
  if (!valeur.startsWith('/') || valeur.startsWith('//') || valeur.includes('\\')) return undefined;
  return valeur;
}
