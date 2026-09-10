import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { hasNewArrival, inboxSignature, type Inbox, type InboxItem } from '@/lib/data/inbox';

const CLE_SON = 'notifications.son';
const TITRE_ORIGINAL = typeof document === 'undefined' ? 'CPI GO' : document.title;

export function sonActif(): boolean {
  try {
    return localStorage.getItem(CLE_SON) !== 'off';
  } catch {
    return true;
  }
}

export function memoriserSon(actif: boolean): void {
  try {
    localStorage.setItem(CLE_SON, actif ? 'on' : 'off');
  } catch {
    // Sans stockage, le réglage vaut pour la page courante.
  }
}

/** Deux notes brèves, synthétisées : aucun fichier audio, et le navigateur ne joue qu'après un geste. */
export function jouerSon(): void {
  try {
    const contexte = new AudioContext();
    const notes: [number, number][] = [
      [880, 0],
      [1174, 0.14],
    ];
    for (const [frequence, depart] of notes) {
      const oscillateur = contexte.createOscillator();
      const volume = contexte.createGain();
      oscillateur.type = 'sine';
      oscillateur.frequency.value = frequence;
      volume.gain.setValueAtTime(0.0001, contexte.currentTime + depart);
      volume.gain.exponentialRampToValueAtTime(0.18, contexte.currentTime + depart + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, contexte.currentTime + depart + 0.3);
      oscillateur.connect(volume).connect(contexte.destination);
      oscillateur.start(contexte.currentTime + depart);
      oscillateur.stop(contexte.currentTime + depart + 0.32);
    }
    setTimeout(() => void contexte.close(), 800);
  } catch {
    // Autoplay refusé ou API absente : le visuel suffit.
  }
}

/** Le titre de l'onglet porte le compteur : un autre onglet le voit, pas le point rouge. */
export function refleterNonLus(nonLus: number): void {
  if (typeof document === 'undefined') return;
  document.title = nonLus > 0 ? `(${String(nonLus)}) ${TITRE_ORIGINAL}` : TITRE_ORIGINAL;
  pastilleFavicon(nonLus > 0);
}

let faviconOriginal: string | null = null;

function pastilleFavicon(active: boolean): void {
  const lien = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (lien === null) return;
  faviconOriginal ??= lien.href;
  if (!active) {
    lien.href = faviconOriginal;
    return;
  }
  const image = new Image();
  image.onload = () => {
    const toile = document.createElement('canvas');
    toile.width = 64;
    toile.height = 64;
    const pinceau = toile.getContext('2d');
    if (pinceau === null) return;
    pinceau.drawImage(image, 0, 0, 64, 64);
    pinceau.fillStyle = '#d6212c';
    pinceau.beginPath();
    pinceau.arc(50, 14, 13, 0, Math.PI * 2);
    pinceau.fill();
    lien.href = toile.toDataURL('image/png');
  };
  image.src = faviconOriginal;
}

/** Oscillation brève à l'arrivée, halo dix secondes, son selon le réglage, titre d'onglet à jour. */
export function useSignalArrivee(
  data: Inbox | undefined,
  ouvrir: (item: InboxItem) => void,
): { swinging: boolean; halo: boolean; son: boolean; basculerSon: () => void } {
  const [swinging, setSwinging] = useState(false);
  const [halo, setHalo] = useState(false);
  const [son, setSon] = useState(sonActif);
  const previous = useRef<{ topId: string | null; unreadCount: number } | null>(null);

  useEffect(() => {
    const next = inboxSignature(data);
    const arrived = hasNewArrival(previous.current, next);
    previous.current = next;
    refleterNonLus(data?.unreadCount ?? 0);
    if (!arrived) return;

    setSwinging(true);
    setHalo(true);
    signalerArrivee(data?.items[0], ouvrir);
    const timer = setTimeout(() => {
      setSwinging(false);
    }, 700);
    const finHalo = setTimeout(() => {
      setHalo(false);
    }, 10_000);
    return () => {
      clearTimeout(timer);
      clearTimeout(finHalo);
    };
  }, [data, ouvrir]);

  return {
    swinging,
    halo,
    son,
    basculerSon: () => {
      setSon(!son);
      memoriserSon(!son);
    },
  };
}

/** Un dossier complet mérite plus qu'un point : toast persistant, son, bouton d'action. */
export function signalerArrivee(
  item: InboxItem | undefined,
  ouvrir: (item: InboxItem) => void,
): void {
  if (item === undefined || item.isRead) return;
  if (sonActif()) jouerSon();
  if (item.category !== 'DOSSIER') return;
  toast(item.title, {
    description: item.body,
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    className: 'border-l-4 border-l-primary',
    action: { label: 'Ouvrir le dossier', onClick: () => ouvrir(item) },
    cancel: { label: 'Plus tard', onClick: () => undefined },
  });
}
