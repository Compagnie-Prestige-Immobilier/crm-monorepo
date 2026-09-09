import type { ReactElement } from 'react';

import {
  allonge,
  BarreH,
  BarreV,
  Couronne,
  eclot,
  Empilement,
  monte,
  Pastille,
  Secteur,
  Socle,
  Trait,
} from '@/components/tableau-de-bord/apercus-pieces';
import type { Marque } from '@/components/tableau-de-bord/sources';

const COURBE = 'M6 28 L13 20 L20 24 L27 12 L34 8';
const CHALEUR = [
  0.18, 0.45, 0.8, 0.3, 0.5, 0.92, 0.6, 0.22, 0.15, 0.34, 0.72, 0.55, 0.62, 0.25, 0.4, 0.85,
];

function Barres({ hauteurs, tons }: { hauteurs: readonly number[]; tons: readonly string[] }) {
  const pas = hauteurs.length > 5 ? 5.5 : 6.5;
  return (
    <>
      <Socle />
      {hauteurs.map((h, index) => (
        <BarreV
          key={`${String(index)}-${String(h)}`}
          x={6.5 + index * pas}
          h={h}
          delai={index * 60}
          ton={tons[index % tons.length] ?? 'fill-chart-1'}
        />
      ))}
    </>
  );
}

function LigneTableau({ y, delai }: { y: number; delai: number }) {
  return (
    <>
      <rect
        x={5}
        y={y}
        width={15}
        height={4}
        rx={1}
        className="cpi-piece fill-muted-foreground/45"
        style={allonge(delai)}
      />
      <rect
        x={25}
        y={y}
        width={10}
        height={4}
        rx={1}
        className="cpi-piece fill-chart-1/80"
        style={allonge(delai)}
      />
    </>
  );
}

export const APERCUS: Record<Marque, ReactElement> = {
  'barres-verticales': <Barres hauteurs={[10, 17, 13, 23, 19]} tons={['fill-chart-1']} />,
  'barres-groupees': (
    <Barres hauteurs={[19, 13, 13, 22, 23, 11]} tons={['fill-chart-1', 'fill-chart-2']} />
  ),
  mixte: (
    <>
      <Barres hauteurs={[11, 16, 13, 20, 17]} tons={['fill-chart-2']} />
      <Trait d="M9 25 L15.5 18 L22 21 L28.5 12 L35 9" delai={200} epaisseur={2} />
    </>
  ),
  'barres-horizontales': (
    <>
      <Socle />
      {[
        [8.5, 28],
        [15, 21],
        [21.5, 15],
        [28, 10],
      ].map(([y, w], index) => (
        <BarreH key={y} y={y ?? 0} w={w ?? 0} delai={index * 70} />
      ))}
    </>
  ),
  'barres-empilees': (
    <>
      <Socle />
      {[
        { x: 6.5, segments: [10, 8, 8] },
        { x: 16.5, segments: [8, 6, 4] },
        { x: 26.5, segments: [9, 7, 6] },
      ].map((pile, index) => (
        <Empilement key={pile.x} x={pile.x} segments={pile.segments} delai={index * 110} />
      ))}
    </>
  ),
  'barres-100': (
    <>
      <Socle />
      {[
        { x: 6.5, segments: [12, 8, 6] },
        { x: 16.5, segments: [6, 14, 6] },
        { x: 26.5, segments: [16, 4, 6] },
      ].map((pile, index) => (
        <Empilement key={pile.x} x={pile.x} segments={pile.segments} delai={index * 110} />
      ))}
    </>
  ),
  courbe: (
    <>
      <Socle />
      <Trait d={COURBE} />
    </>
  ),
  aire: (
    <>
      <Socle />
      <path d={`${COURBE} L34 34 L6 34 Z`} className="cpi-piece fill-chart-1/25" style={monte(0)} />
      <Trait d={COURBE} delai={80} epaisseur={2} />
    </>
  ),
  escalier: (
    <>
      <Socle />
      <Trait d="M6 29 H13 V21 H20 V25 H27 V13 H34 V9" />
    </>
  ),
  anneau: <Couronne rayon={12.5} largeur={6} />,
  camembert: <Couronne rayon={10} largeur={20} />,
  'aire-polaire': (
    <g transform="rotate(-90 20 20)">
      {[16, 11, 18, 9, 14, 7].map((rayon, index) => (
        <Secteur
          key={rayon}
          index={index}
          rayon={rayon}
          ton={
            ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3'][index % 3] ?? 'stroke-chart-1'
          }
          delai={index * 60}
        />
      ))}
    </g>
  ),
  radar: (
    <>
      <polygon
        points="20,5 33,12.5 33,27.5 20,35 7,27.5 7,12.5"
        fill="none"
        strokeWidth={0.9}
        className="stroke-border"
      />
      <path
        d="M20 5 V35 M7 12.5 L33 27.5 M33 12.5 L7 27.5"
        fill="none"
        strokeWidth={0.7}
        className="stroke-border"
      />
      <polygon
        points="20,6 25.2,17 30.4,26 20,24 8.7,26.5 13.1,16"
        strokeWidth={1.6}
        strokeLinejoin="round"
        className="cpi-piece fill-chart-1/25 stroke-chart-1"
        style={eclot(20, 20, 60)}
      />
    </>
  ),
  nuage: (
    <>
      <Socle />
      {[
        [9, 26],
        [13, 20],
        [17, 25],
        [20, 15],
        [24, 19],
        [27, 11],
        [31, 17],
        [34, 9],
      ].map(([cx, cy], index) => (
        <Pastille key={cx} cx={cx ?? 0} cy={cy ?? 0} r={1.9} delai={index * 40} />
      ))}
    </>
  ),
  bulles: (
    <>
      <Socle />
      {[
        [10, 27, 3.2],
        [18, 20, 5],
        [25, 26, 2.4],
        [30, 14, 4.2],
        [35, 23, 2.6],
      ].map(([cx, cy, r], index) => (
        <Pastille key={cx} cx={cx ?? 0} cy={cy ?? 0} r={r ?? 2} delai={index * 80} opacite={0.55} />
      ))}
    </>
  ),
  jauge: (
    <>
      <path
        d="M7 31 A13 13 0 0 1 33 31"
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        className="stroke-border"
      />
      <Trait d="M7 31 A13 13 0 0 1 33 31" epaisseur={5} part={0.72} />
    </>
  ),
  'carte-de-chaleur': (
    <>
      {CHALEUR.map((intensite, index) => {
        const x = 5 + (index % 4) * 8;
        const y = 5 + Math.floor(index / 4) * 8;
        return (
          <rect
            key={`${String(x)}-${String(y)}`}
            x={x}
            y={y}
            width={6.5}
            height={6.5}
            rx={1}
            fillOpacity={intensite}
            className="cpi-piece fill-chart-1"
            style={eclot(x + 3.25, y + 3.25, index * 30)}
          />
        );
      })}
    </>
  ),
  tableau: (
    <>
      <rect x={4} y={6} width={32} height={6} rx={1.5} className="fill-muted-foreground/25" />
      {[15, 22, 29].map((y, index) => (
        <LigneTableau key={y} y={y} delai={index * 90} />
      ))}
    </>
  ),
  tuile: (
    <>
      <rect
        x={12}
        y={9}
        width={16}
        height={3}
        rx={1.5}
        className="cpi-piece fill-muted-foreground/40"
        style={allonge(0)}
      />
      <text
        x={20}
        y={30}
        textAnchor="middle"
        fontSize={17}
        fontWeight={800}
        className="cpi-piece fill-chart-1"
        style={{ opacity: 'var(--cpi-t)', animationDelay: '120ms' }}
      >
        128
      </text>
    </>
  ),
  'tuile-courbe': (
    <>
      <text
        x={20}
        y={20}
        textAnchor="middle"
        fontSize={14}
        fontWeight={800}
        className="cpi-piece fill-chart-1"
        style={{ opacity: 'var(--cpi-t)' }}
      >
        128
      </text>
      <Trait d="M6 32 L13 28 L20 30 L27 25 L34 22" delai={160} epaisseur={1.8} />
    </>
  ),
};
