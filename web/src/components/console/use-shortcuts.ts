'use client';

import { useEffect, useRef } from 'react';

export type ShortcutMap = Readonly<Record<string, () => void>>;

function isTextEntry(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const ACTIVABLE =
  'button, a[href], [role="button"], [role="combobox"], [role="option"], [role="tab"], [role="menuitem"]';

function isActivable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ACTIVABLE) !== null;
}

function chordOf(event: KeyboardEvent): string {
  const key = event.key === ' ' ? 'Space' : event.key;
  if (event.ctrlKey || event.metaKey) return `mod+${key.toLowerCase()}`;
  return key.length === 1 ? key.toLowerCase() : key;
}

/**
 * Un seul écouteur pour tout l'écran. Il se tait dès qu'un champ texte a le
 * focus, sinon taper « 4 » dans un commentaire consignerait un appel.
 */
export function useShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  const latest = useRef<ShortcutMap>(shortcuts);

  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey) return;

      const chord = chordOf(event);
      if (isTextEntry(event.target)) {
        // Échap quitte le champ sans rien effacer : une saisie ne se perd pas d'une touche.
        if (chord === 'Escape' && event.target instanceof HTMLElement) event.target.blur();
        return;
      }
      // Entrée sur un bouton ou une option l'active ; elle ne valide pas l'écran à sa place.
      if (chord === 'Enter' && isActivable(event.target)) return;

      const handler = latest.current[chord];
      if (handler === undefined) return;

      event.preventDefault();
      handler();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
