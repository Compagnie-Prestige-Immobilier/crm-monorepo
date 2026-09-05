/**
 * Ce que le navigateur laisse encore faire quand l'onglet disparaît. Une
 * coupure de courant ou un processus tué ne déclenche pas `beforeunload` :
 * `visibilitychange` est la dernière prise, et les tests l'éprouvent par là.
 */
export function masquerLOnglet(): void {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
}
