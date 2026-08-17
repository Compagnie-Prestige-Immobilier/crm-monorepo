'use client';

import { useEffect, useRef } from 'react';

export type ShortcutMap = Readonly<Record<string, () => void>>;

export function isTextEntry(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function chordOf(event: KeyboardEvent): string {
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
      if (chord !== 'Escape' && isTextEntry(event.target)) return;

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
