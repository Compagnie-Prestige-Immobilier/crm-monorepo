import type { Coque } from '@/components/layout/nav-items';

const FRAME = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/**
 * Le trait de rappel de chaque dessin emprunte `--accent-border` et non
 * `--accent` : l'or CPI ne fait que 2,77:1 sur blanc, sous le 3:1 que WCAG
 * 1.4.11 demande à un tracé porteur de sens.
 */
const MARK = 'text-accent-border';

function AccueilIcon() {
  return (
    <svg {...FRAME} className="size-full">
      <path d="M24 10v3" />
      <path d="M14 25a10 10 0 0 1 20 0" />
      <path className={MARK} strokeWidth={3} d="M10 25h28" />
      <path d="M11 31h26v9H11z" />
      <path d="M7 31h34" strokeWidth={3} />
      <path d="M18 36h8" />
    </svg>
  );
}

function ChuesIcon() {
  return (
    <svg {...FRAME} className="size-full">
      <path d="M24 8 7 15l17 7 17-7z" />
      <path d="M14 18.5V27c0 3.3 4.5 5.5 10 5.5s10-2.2 10-5.5v-8.5" />
      <path d="M41 15v9.5" />
      <circle cx="41" cy="27" r="1.8" fill="currentColor" stroke="none" />
      {/* Le filet bleu sous le « UES » du logo. */}
      <path className={MARK} strokeWidth={3} d="M13 39h22" />
    </svg>
  );
}

function GrandPublicIcon() {
  return (
    <svg {...FRAME} className="size-full">
      <circle cx="13" cy="20" r="3.5" />
      <path d="M6 31c0-3.9 3.1-7 7-7" />
      <circle cx="35" cy="20" r="3.5" />
      <path d="M42 31c0-3.9-3.1-7-7-7" />
      <circle cx="24" cy="17" r="5.5" />
      <path d="M13 35c0-6.1 4.9-11 11-11s11 4.9 11 11" />
      <path className={MARK} strokeWidth={3} d="M13 41h22" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg {...FRAME} className="size-full">
      <path d="M24 6 39 11.5v11c0 8.7-6.4 14.7-15 17.5-8.6-2.8-15-8.8-15-17.5v-11z" />
      <path d="M15 19h18" />
      <path d="M15 27h18" />
      <circle className={MARK} cx="20" cy="19" r="2.8" strokeWidth={3} />
      <circle className={MARK} cx="28" cy="27" r="2.8" strokeWidth={3} />
    </svg>
  );
}

export const COQUE_ICONS: Record<Coque, () => React.JSX.Element> = {
  accueil: AccueilIcon,
  chues: ChuesIcon,
  'grand-public': GrandPublicIcon,
  admin: AdminIcon,
};
