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

function TeleconseilIcon() {
  return (
    <svg {...FRAME} className="size-full">
      <path d="M24 8 7 15l17 7 17-7z" />
      <path d="M14 18.5V27c0 3.3 4.5 5.5 10 5.5s10-2.2 10-5.5v-8.5" />
      <path d="M41 15v9.5" />
      <circle cx="41" cy="27" r="1.8" fill="currentColor" stroke="none" />
      <path className={MARK} strokeWidth={3} d="M13 39h22" />
    </svg>
  );
}

function FinanceIcon() {
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
  teleconseil: TeleconseilIcon,
  finance: FinanceIcon,
  admin: AdminIcon,
};

export function CoqueArt({ coque }: { coque: Coque }) {
  const paths: Record<Coque, React.JSX.Element> = {
    accueil: (
      <>
        <path d="M18 73h126M30 57h96M47 41h61" />
        <circle cx="118" cy="28" r="14" />
        <path d="m109 29 7 7 13-17" />
      </>
    ),
    teleconseil: (
      <>
        <path d="m26 35 55-22 55 22-55 22zM46 49v28c18 13 52 13 70 0V49" />
        <path d="M137 35v41M128 83h18" />
      </>
    ),
    finance: (
      <>
        <circle cx="48" cy="35" r="16" />
        <circle cx="108" cy="35" r="16" />
        <circle cx="78" cy="26" r="18" />
        <path d="M22 82c3-23 20-35 42-29M134 82c-3-23-20-35-42-29M45 88c2-28 15-43 33-43s31 15 33 43" />
      </>
    ),
    admin: (
      <>
        <path d="m78 10 50 18v31c0 25-18 40-50 49-32-9-50-24-50-49V28z" />
        <path d="M48 46h60M48 69h60M61 34v24M95 57v24" />
        <circle cx="61" cy="46" r="7" />
        <circle cx="95" cy="69" r="7" />
      </>
    ),
  };

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 w-[52%] overflow-hidden [clip-path:polygon(34%_0,100%_0,100%_100%,0_100%)]"
    >
      <span className="absolute inset-0 bg-gradient-to-br from-accent/5 via-accent/10 to-primary/15" />
      <svg
        viewBox="0 0 156 118"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute -right-3 top-1/2 h-[78%] -translate-y-1/2 text-primary/25"
      >
        {paths[coque]}
      </svg>
      <span className="absolute -right-8 -bottom-12 size-32 rounded-full border-[18px] border-accent/10" />
    </span>
  );
}
