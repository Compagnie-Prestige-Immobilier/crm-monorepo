import { useEffect } from 'react';

interface Props {
  src: string;
  strategy?: string | undefined;
  async?: boolean | undefined;
  defer?: boolean | undefined;
  onLoad?: (() => void) | undefined;
  onError?: (() => void) | undefined;
}

/** Charge un script externe une seule fois, comme `next/script` le faisait. */
export default function Script({ src, onLoad, onError }: Props): null {
  useEffect(() => {
    const existant = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existant !== null) {
      onLoad?.();
      return undefined;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (onLoad) script.addEventListener('load', onLoad);
    if (onError) script.addEventListener('error', onError);
    document.head.append(script);
    return undefined;
  }, [src, onLoad, onError]);
  return null;
}
