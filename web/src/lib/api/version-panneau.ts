import type { AnyRouter } from '@tanstack/react-router';

const EN_TETE = 'X-Cpi-Panneau';
const TYPES_SANS_SAISIE = new Set(['checkbox', 'radio', 'hidden', 'submit', 'button']);

let versionChargee: string | null = null;
let perime = false;

/** Lue sur chaque réponse de l'API : la première fixe la version, une autre la périme. */
export function noterVersionPanneau(response: Response): void {
  const version = response.headers.get(EN_TETE);
  if (version === null) return;
  if (versionChargee === null) versionChargee = version;
  else if (version !== versionChargee) {
    perime = true;
    rechargerSiLibre();
  }
}

/** Une boîte de dialogue ouverte ou un champ texte rempli : quelqu'un est en train d'écrire. */
function saisieEnCours(): boolean {
  if (document.querySelector('[role="dialog"]') !== null) return true;
  const champs = [
    ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
  ];
  return champs.some((champ) => !TYPES_SANS_SAISIE.has(champ.type) && champ.value.trim() !== '');
}

function rechargerSiLibre(): void {
  if (!perime || document.visibilityState !== 'visible' || saisieEnCours()) return;
  window.location.reload();
}

/**
 * Un panneau périmé se recharge dès qu'il est libre : tout de suite, ou quand
 * l'onglet revient au premier plan, sinon à la prochaine navigation. Jamais
 * au milieu d'une saisie. Un morceau de code disparu après déploiement ne
 * laisse pas ce choix : la page se recharge sur place.
 */
export function installerRechargementPanneau(router: AnyRouter): void {
  router.subscribe('onBeforeNavigate', ({ toLocation }) => {
    if (perime) window.location.assign(toLocation.href);
  });
  document.addEventListener('visibilitychange', rechargerSiLibre);
  window.addEventListener('focus', rechargerSiLibre);
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    window.location.reload();
  });
}
