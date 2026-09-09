import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * `--cpi-t` va de 0 à 1 et pilote toutes les formes. `@property` est
 * obligatoire : sans type déclaré, une variable CSS n'est pas interpolée, elle
 * saute d'un coup à sa valeur finale.
 */
export const CSS_APERCU = `
@property --cpi-t { syntax: "<number>"; inherits: false; initial-value: 1; }
@keyframes cpi-pousse { from { --cpi-t: 0; } }
.cpi-piece { animation: cpi-pousse 640ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both; }
@media (prefers-reduced-motion: reduce) { .cpi-piece { animation: none; } }
`;

const SOCLE_Y = 34;
const SOCLE_X = 5;

export function monte(delai: number): CSSProperties {
  return {
    transformOrigin: `0 ${String(SOCLE_Y)}px`,
    transform: 'scaleY(var(--cpi-t))',
    animationDelay: `${String(delai)}ms`,
  };
}

export function allonge(delai: number): CSSProperties {
  return {
    transformOrigin: `${String(SOCLE_X)}px 0`,
    transform: 'scaleX(var(--cpi-t))',
    animationDelay: `${String(delai)}ms`,
  };
}

export function eclot(cx: number, cy: number, delai: number): CSSProperties {
  return {
    transformOrigin: `${String(cx)}px ${String(cy)}px`,
    transform: 'scale(var(--cpi-t))',
    animationDelay: `${String(delai)}ms`,
  };
}

function tracee(delai: number, part: number): CSSProperties {
  return {
    strokeDasharray: '1 1',
    strokeDashoffset: `calc(1 - ${String(part)} * var(--cpi-t))`,
    animationDelay: `${String(delai)}ms`,
  };
}

export function Socle() {
  return <path d="M4.5 5 V34.5 H36" fill="none" strokeWidth={1} className="stroke-border" />;
}

export function BarreV({ x, h, delai, ton }: { x: number; h: number; delai: number; ton: string }) {
  return (
    <rect
      x={x}
      y={SOCLE_Y - h}
      width={5}
      height={h}
      rx={1}
      className={cn('cpi-piece', ton)}
      style={monte(delai)}
    />
  );
}

export function BarreH({ y, w, delai }: { y: number; w: number; delai: number }) {
  return (
    <rect
      x={SOCLE_X}
      y={y}
      width={w}
      height={5}
      rx={1}
      className="cpi-piece fill-chart-1"
      style={allonge(delai)}
    />
  );
}

export function Trait({
  d,
  delai = 0,
  epaisseur = 2.4,
  part = 1,
}: {
  d: string;
  delai?: number;
  epaisseur?: number;
  part?: number;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="cpi-piece stroke-chart-1"
      style={tracee(delai, part)}
    />
  );
}

export function Pastille({
  cx,
  cy,
  r,
  delai,
  opacite = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  delai: number;
  opacite?: number;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fillOpacity={opacite}
      className="cpi-piece fill-chart-1"
      style={eclot(cx, cy, delai)}
    />
  );
}

const PARTS = [
  { debut: 0, part: 0.43 },
  { debut: 0.45, part: 0.28 },
  { debut: 0.75, part: 0.23 },
];
const TONS_TRAIT = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3'];
const TONS_FOND = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3'];

/** Une couronne : `pathLength` normalise le tour à 1, les parts sont des fractions. */
export function Couronne({ rayon, largeur }: { rayon: number; largeur: number }) {
  return (
    <g transform="rotate(-90 20 20)">
      {PARTS.map((segment, index) => (
        <circle
          key={segment.debut}
          cx={20}
          cy={20}
          r={rayon}
          fill="none"
          strokeWidth={largeur}
          pathLength={1}
          className={cn('cpi-piece', TONS_TRAIT[index] ?? 'stroke-chart-1')}
          style={{
            strokeDasharray: `calc(${String(segment.part)} * var(--cpi-t)) 1`,
            strokeDashoffset: -segment.debut,
            animationDelay: `${String(index * 140)}ms`,
          }}
        />
      ))}
    </g>
  );
}

export function Secteur({
  index,
  rayon,
  ton,
  delai,
}: {
  index: number;
  rayon: number;
  ton: string;
  delai: number;
}) {
  return (
    <circle
      cx={20}
      cy={20}
      r={rayon / 2}
      fill="none"
      strokeWidth={rayon}
      pathLength={1}
      strokeDasharray="0.15 1"
      strokeDashoffset={-(index / 6)}
      className={cn('cpi-piece', ton)}
      style={eclot(20, 20, delai)}
    />
  );
}

export function Empilement({
  x,
  segments,
  delai,
}: {
  x: number;
  segments: readonly number[];
  delai: number;
}) {
  return (
    <g className="cpi-piece" style={monte(delai)}>
      {segments.map((hauteur, index) => {
        const dessous = segments.slice(0, index).reduce((somme, part) => somme + part, 0);
        return (
          <rect
            key={`${String(x)}-${String(index)}`}
            x={x}
            y={SOCLE_Y - dessous - hauteur}
            width={7}
            height={hauteur}
            className={TONS_FOND[index] ?? 'fill-chart-1'}
          />
        );
      })}
    </g>
  );
}
