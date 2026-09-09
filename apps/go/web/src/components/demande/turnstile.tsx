import { useEffect } from 'react';

import { Refus } from '@/components/demande/relecture-demande';
import { CAPTCHA_INDISPONIBLE, TURNSTILE_SCRIPT } from '@/lib/data/formulaire-public';

/** Le script du widget se charge une fois, et jamais si aucune clé n'est posée. */
export function useTurnstile(cleSite: string): void {
  useEffect(() => {
    if (cleSite === '' || document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`) !== null) {
      return;
    }
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    document.head.append(script);
  }, [cleSite]);
}

/**
 * Monté dès l'étape 1 et JAMAIS démonté : le jeton que le widget dépose
 * disparaîtrait au changement d'étape, et l'envoi serait refusé.
 *
 * Sans clé de site, le serveur n'a pas de quoi vérifier : le visiteur le lit
 * avant de remplir, plutôt que de l'apprendre par un refus après l'envoi.
 */
export function Antirobot({ cleSite }: { cleSite: string }) {
  if (cleSite === '') return <Refus texte={CAPTCHA_INDISPONIBLE} />;
  return <div className="cf-turnstile" data-sitekey={cleSite} data-language="fr" />;
}
