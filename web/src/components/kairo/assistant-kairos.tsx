import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, type DetailedHTMLProps, type HTMLAttributes } from 'react';

import { CLE_ASSISTANT_KAIROS, lireAssistantKairos } from '@/lib/data/kairo';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'kairos-assistant': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        url: string;
        'identity-url': string;
      };
    }
  }
}

function chargerScript(src: string): void {
  if (customElements.get('kairos-assistant') || document.querySelector(`script[src="${src}"]`)) {
    return;
  }
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  document.head.append(script);
}

export function AssistantKairos() {
  const router = useRouter();
  const element = useRef<HTMLElement>(null);
  const { data } = useQuery({
    queryKey: CLE_ASSISTANT_KAIROS,
    queryFn: lireAssistantKairos,
    staleTime: 5 * 60_000,
  });
  const url = data?.actif ? data.url : '';

  useEffect(() => {
    if (url) chargerScript(`${url}/kairos.js`);
  }, [url]);

  useEffect(() => {
    const cible = element.current;
    if (!cible) return;
    const naviguer = (event: Event): void => {
      event.preventDefault();
      const destination = new URL(
        (event as CustomEvent<{ url: string }>).detail.url,
        location.href,
      );
      if (destination.origin !== location.origin) return;
      void router.navigate({ href: destination.pathname + destination.search + destination.hash });
    };
    cible.addEventListener('kairos-naviguer', naviguer);
    return () => cible.removeEventListener('kairos-naviguer', naviguer);
  }, [router, url]);

  if (!url) return null;
  return (
    <kairos-assistant
      ref={element}
      url={`${url}/v1/conversation`}
      identity-url="/api/v1/kairos/identite"
      title="Kairos"
    />
  );
}
