'use client';

import { CheckIcon } from 'lucide-react';
import { useState, type CSSProperties, type ReactElement } from 'react';

import type { DashboardMarque } from '@/components/accueil/tableau-de-bord/sources';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * `--cpi-t` va de 0 à 1 et pilote toutes les formes : hauteur, largeur, longueur
 * de trait tracée, échelle. `@property` est obligatoire — sans type déclaré, une
 * variable CSS n'est pas interpolée, elle saute d'un coup à sa valeur finale.
 */
const CSS_APERCU = `
@property --cpi-t { syntax: "<number>"; inherits: false; initial-value: 1; }
@keyframes cpi-pousse { from { --cpi-t: 0; } }
.cpi-piece { animation: cpi-pousse 640ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both; }
@media (prefers-reduced-motion: reduce) { .cpi-piece { animation: none; } }
`;

const SOCLE_Y = 34;
const SOCLE_X = 5;

function monte(delai: number): CSSProperties {
  return {
    transformOrigin: `0 ${String(SOCLE_Y)}px`,
    transform: 'scaleY(var(--cpi-t))',
    animationDelay: `${String(delai)}ms`,
  };
}

function allonge(delai: number): CSSProperties {
  return {
    transformOrigin: `${String(SOCLE_X)}px 0`,
    transform: 'scaleX(var(--cpi-t))',
    animationDelay: `${String(delai)}ms`,
  };
}

function eclot(cx: number, cy: number, delai: number): CSSProperties {
  return {
    transformOrigin: `${String(cx)}px ${String(cy)}px`,
    transform: 'scale(var(--cpi-t))',
    animationDelay: `${String(delai)}ms`,
  };
}

function trace(delai: number, part = 1): CSSProperties {
  return {
    strokeDasharray: '1 1',
    strokeDashoffset: `calc(1 - ${String(part)} * var(--cpi-t))`,
    animationDelay: `${String(delai)}ms`,
  };
}

function Socle() {
  return <path d="M4.5 5 V34.5 H36" fill="none" strokeWidth={1} className="stroke-border" />;
}

function BarreV({ x, h, delai, ton }: { x: number; h: number; delai: number; ton: string }) {
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

function BarreH({ y, w, delai }: { y: number; w: number; delai: number }) {
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

function Trait({
  d,
  delai = 0,
  epaisseur = 2.4,
  ton = 'stroke-chart-1',
}: {
  d: string;
  delai?: number;
  epaisseur?: number;
  ton?: string;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('cpi-piece', ton)}
      style={trace(delai)}
    />
  );
}

function Pastille({
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

/** Un arc de couronne : `pathLength` normalise le tour à 1, les parts sont donc des fractions. */
function Arc({
  debut,
  part,
  rayon,
  largeur,
  ton,
  delai,
}: {
  debut: number;
  part: number;
  rayon: number;
  largeur: number;
  ton: string;
  delai: number;
}) {
  return (
    <circle
      cx={20}
      cy={20}
      r={rayon}
      fill="none"
      strokeWidth={largeur}
      pathLength={1}
      className={cn('cpi-piece', ton)}
      style={{
        strokeDasharray: `calc(${String(part)} * var(--cpi-t)) 1`,
        strokeDashoffset: -debut,
        animationDelay: `${String(delai)}ms`,
      }}
    />
  );
}

function Secteur({
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

const PARTS = [
  { debut: 0, part: 0.43 },
  { debut: 0.45, part: 0.28 },
  { debut: 0.75, part: 0.23 },
];
const TONS_PART = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3'];

function Couronne({ rayon, largeur }: { rayon: number; largeur: number }) {
  return (
    <g transform="rotate(-90 20 20)">
      {PARTS.map((segment, index) => (
        <Arc
          key={segment.debut}
          debut={segment.debut}
          part={segment.part}
          rayon={rayon}
          largeur={largeur}
          ton={TONS_PART[index] ?? 'stroke-chart-1'}
          delai={index * 140}
        />
      ))}
    </g>
  );
}

const EMPILEMENTS = [
  { x: 6.5, segments: [10, 8, 8] },
  { x: 16.5, segments: [8, 6, 4] },
  { x: 26.5, segments: [9, 7, 6] },
];
const TONS_SEGMENT = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3'];

function Empilement({ x, segments, delai }: { x: number; segments: number[]; delai: number }) {
  return (
    <g className="cpi-piece" style={monte(delai)}>
      {segments.map((hauteur, index) => {
        const dessous = segments.slice(0, index).reduce((somme, part) => somme + part, 0);
        return (
          <rect
            key={index}
            x={x}
            y={SOCLE_Y - dessous - hauteur}
            width={7}
            height={hauteur}
            className={TONS_SEGMENT[index] ?? 'fill-chart-1'}
          />
        );
      })}
    </g>
  );
}

const CHALEUR = [
  0.18, 0.45, 0.8, 0.3, 0.5, 0.92, 0.6, 0.22, 0.15, 0.34, 0.72, 0.55, 0.62, 0.25, 0.4, 0.85,
];

const APERCUS: Record<DashboardMarque, ReactElement> = {
  'barres-verticales': (
    <>
      <Socle />
      <BarreV x={6.5} h={10} delai={0} ton="fill-chart-1" />
      <BarreV x={13} h={17} delai={70} ton="fill-chart-1" />
      <BarreV x={19.5} h={13} delai={140} ton="fill-chart-1" />
      <BarreV x={26} h={23} delai={210} ton="fill-chart-1" />
      <BarreV x={32.5} h={19} delai={280} ton="fill-chart-1" />
    </>
  ),
  'barres-horizontales': (
    <>
      <Socle />
      <BarreH y={8.5} w={28} delai={0} />
      <BarreH y={15} w={21} delai={70} />
      <BarreH y={21.5} w={15} delai={140} />
      <BarreH y={28} w={10} delai={210} />
    </>
  ),
  'barres-groupees': (
    <>
      <Socle />
      <BarreV x={6} h={19} delai={0} ton="fill-chart-1" />
      <BarreV x={11} h={13} delai={60} ton="fill-chart-2" />
      <BarreV x={17} h={13} delai={120} ton="fill-chart-1" />
      <BarreV x={22} h={22} delai={180} ton="fill-chart-2" />
      <BarreV x={28} h={23} delai={240} ton="fill-chart-1" />
      <BarreV x={33} h={11} delai={300} ton="fill-chart-2" />
    </>
  ),
  'barres-empilees': (
    <>
      <Socle />
      {EMPILEMENTS.map((pile, index) => (
        <Empilement key={pile.x} x={pile.x} segments={pile.segments} delai={index * 110} />
      ))}
    </>
  ),
  'barres-100': (
    <>
      <Socle />
      <Empilement x={6.5} segments={[12, 8, 6]} delai={0} />
      <Empilement x={16.5} segments={[6, 14, 6]} delai={110} />
      <Empilement x={26.5} segments={[16, 4, 6]} delai={220} />
    </>
  ),
  courbe: (
    <>
      <Socle />
      <Trait d="M6 28 L13 20 L20 24 L27 12 L34 8" />
    </>
  ),
  aire: (
    <>
      <Socle />
      <path
        d="M6 28 L13 20 L20 24 L27 12 L34 8 L34 34 L6 34 Z"
        className="cpi-piece fill-chart-1/25"
        style={monte(0)}
      />
      <Trait d="M6 28 L13 20 L20 24 L27 12 L34 8" delai={80} epaisseur={2} />
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
      <Secteur index={0} rayon={16} ton="stroke-chart-1" delai={0} />
      <Secteur index={1} rayon={11} ton="stroke-chart-2" delai={60} />
      <Secteur index={2} rayon={18} ton="stroke-chart-3" delai={120} />
      <Secteur index={3} rayon={9} ton="stroke-chart-1" delai={180} />
      <Secteur index={4} rayon={14} ton="stroke-chart-2" delai={240} />
      <Secteur index={5} rayon={7} ton="stroke-chart-3" delai={300} />
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
      <Pastille cx={9} cy={26} r={1.9} delai={0} />
      <Pastille cx={13} cy={20} r={1.9} delai={40} />
      <Pastille cx={17} cy={25} r={1.9} delai={80} />
      <Pastille cx={20} cy={15} r={1.9} delai={120} />
      <Pastille cx={24} cy={19} r={1.9} delai={160} />
      <Pastille cx={27} cy={11} r={1.9} delai={200} />
      <Pastille cx={31} cy={17} r={1.9} delai={240} />
      <Pastille cx={34} cy={9} r={1.9} delai={280} />
    </>
  ),
  bulles: (
    <>
      <Socle />
      <Pastille cx={10} cy={27} r={3.2} delai={0} opacite={0.55} />
      <Pastille cx={18} cy={20} r={5} delai={80} opacite={0.55} />
      <Pastille cx={25} cy={26} r={2.4} delai={160} opacite={0.55} />
      <Pastille cx={30} cy={14} r={4.2} delai={240} opacite={0.55} />
      <Pastille cx={35} cy={23} r={2.6} delai={320} opacite={0.55} />
    </>
  ),
  mixte: (
    <>
      <Socle />
      <BarreV x={6.5} h={11} delai={0} ton="fill-chart-2" />
      <BarreV x={13} h={16} delai={60} ton="fill-chart-2" />
      <BarreV x={19.5} h={13} delai={120} ton="fill-chart-2" />
      <BarreV x={26} h={20} delai={180} ton="fill-chart-2" />
      <BarreV x={32.5} h={17} delai={240} ton="fill-chart-2" />
      <Trait d="M9 25 L15.5 18 L22 21 L28.5 12 L35 9" delai={200} epaisseur={2} />
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
      <path
        d="M7 31 A13 13 0 0 1 33 31"
        pathLength={1}
        fill="none"
        strokeWidth={5}
        strokeLinecap="round"
        className="cpi-piece stroke-chart-1"
        style={trace(0, 0.72)}
      />
    </>
  ),
  'carte-de-chaleur': (
    <>
      {CHALEUR.map((intensite, index) => {
        const x = 5 + (index % 4) * 8;
        const y = 5 + Math.floor(index / 4) * 8;
        return (
          <rect
            key={index}
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
      <rect
        x={5}
        y={15}
        width={15}
        height={4}
        rx={1}
        className="cpi-piece fill-muted-foreground/45"
        style={allonge(0)}
      />
      <rect
        x={25}
        y={15}
        width={10}
        height={4}
        rx={1}
        className="cpi-piece fill-chart-1/80"
        style={allonge(0)}
      />
      <rect
        x={5}
        y={22}
        width={15}
        height={4}
        rx={1}
        className="cpi-piece fill-muted-foreground/45"
        style={allonge(90)}
      />
      <rect
        x={25}
        y={22}
        width={10}
        height={4}
        rx={1}
        className="cpi-piece fill-chart-1/80"
        style={allonge(90)}
      />
      <rect
        x={5}
        y={29}
        width={15}
        height={4}
        rx={1}
        className="cpi-piece fill-muted-foreground/45"
        style={allonge(180)}
      />
      <rect
        x={25}
        y={29}
        width={10}
        height={4}
        rx={1}
        className="cpi-piece fill-chart-1/80"
        style={allonge(180)}
      />
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

export const MARQUE_TEXTES: Record<DashboardMarque, { nom: string; usage: string }> = {
  'barres-verticales': { nom: 'Barres debout', usage: 'Comparer les quantités d’un coup d’œil' },
  'barres-horizontales': {
    nom: 'Barres couchées',
    usage: 'Comparer qui fait le plus, noms longs lisibles',
  },
  'barres-groupees': { nom: 'Barres côte à côte', usage: 'Comparer deux groupes ligne par ligne' },
  'barres-empilees': { nom: 'Barres empilées', usage: 'Le total, et ce qu’il y a dedans' },
  'barres-100': {
    nom: 'Barres en pourcentage',
    usage: 'Comparer les parts, quel que soit le total',
  },
  courbe: { nom: 'Courbe', usage: 'Voir si ça monte ou descend dans le temps' },
  aire: { nom: 'Courbe remplie', usage: 'L’évolution, avec le volume sous la courbe' },
  escalier: { nom: 'Marches', usage: 'L’évolution par paliers, sans lissage' },
  anneau: { nom: 'Anneau', usage: 'Voir la part de chacun dans le total' },
  camembert: { nom: 'Camembert', usage: 'La part de chacun, en parts de gâteau' },
  'aire-polaire': { nom: 'Rosace', usage: 'Voir les heures ou les jours en cercle' },
  radar: { nom: 'Toile', usage: 'Voir les points forts et les points faibles' },
  nuage: { nom: 'Nuage de points', usage: 'Un point par élément, pour voir les écarts' },
  bulles: { nom: 'Bulles', usage: 'Plus la bulle est grosse, plus le chiffre est haut' },
  mixte: { nom: 'Barres et courbe', usage: 'Les quantités et la tendance ensemble' },
  jauge: { nom: 'Jauge', usage: 'Où on en est par rapport à un objectif' },
  'carte-de-chaleur': { nom: 'Carte de chaleur', usage: 'Repérer les cases les plus chargées' },
  tableau: { nom: 'Tableau', usage: 'Toutes les lignes, avec le chiffre exact' },
  tuile: { nom: 'Chiffre', usage: 'Un seul chiffre, en grand' },
  'tuile-courbe': { nom: 'Chiffre et courbe', usage: 'Le chiffre, avec sa petite courbe' },
};

export function marqueTexte(marque: DashboardMarque): { nom: string; usage: string } {
  return MARQUE_TEXTES[marque];
}

/** Une phrase complète pour un bouton : « Anneau : voir la part de chacun ». */
export function marquePhrase(marque: DashboardMarque): string {
  const texte = MARQUE_TEXTES[marque];
  return `${texte.nom} : ${texte.usage.charAt(0).toLowerCase()}${texte.usage.slice(1)}`;
}

const MARQUE_PAR_KIND: Record<'trend' | 'rank' | 'share' | 'category', DashboardMarque> = {
  trend: 'courbe',
  rank: 'barres-horizontales',
  share: 'anneau',
  category: 'tableau',
};

export function marquePourKind(kind: 'trend' | 'rank' | 'share' | 'category'): DashboardMarque {
  return MARQUE_PAR_KIND[kind];
}

export function ChartPreview({
  marque,
  className,
}: {
  marque: DashboardMarque;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="chart-preview"
      data-marque={marque}
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card',
        className,
      )}
    >
      <style href="cpi-apercu-graphique" precedence="default">
        {CSS_APERCU}
      </style>
      <svg viewBox="0 0 40 40" className="size-10" focusable="false">
        {APERCUS[marque]}
      </svg>
    </span>
  );
}

export function ChartDemo({ marque }: { marque: DashboardMarque }) {
  const texte = marqueTexte(marque);

  return (
    <div className="flex items-center gap-3 rounded-md bg-secondary/60 p-3">
      <span
        role="img"
        aria-label={`Exemple visuel : ${texte.nom}`}
        className="flex min-w-0 flex-1 items-center justify-center"
      >
        <ChartPreview marque={marque} className="size-36 border-border bg-card [&>svg]:size-32" />
      </span>
      <div className="w-36 shrink-0">
        <p className="text-[0.75rem] font-[700] uppercase tracking-[0.08em] text-muted-foreground">
          Exemple visuel
        </p>
        <p className="mt-1 font-display text-[1rem] font-[700]">{texte.nom}</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{texte.usage}</p>
      </div>
    </div>
  );
}

export function ChoixGraphique({
  marque,
  titre,
  phrase,
  conseille = false,
  raison = null,
  selectionne,
  onSelect,
}: {
  marque: DashboardMarque;
  titre: string;
  phrase: string;
  conseille?: boolean;
  raison?: string | null;
  selectionne?: boolean;
  onSelect: () => void;
}) {
  const [rejeu, setRejeu] = useState(0);
  const rejouer = () => {
    setRejeu((tour) => tour + 1);
  };

  return (
    <button
      type="button"
      aria-pressed={selectionne}
      onClick={onSelect}
      onPointerEnter={rejouer}
      onFocus={rejouer}
      className={cn(
        // `shrink-0` : dans une colonne qui défile, un flex enfant se comprime
        // sous sa hauteur de contenu et les lignes se chevauchent.
        'flex min-h-11 w-full shrink-0 items-start gap-3 rounded-md border p-2 text-left',
        'hover:bg-secondary focus-visible:bg-secondary',
        selectionne === true ? 'border-primary bg-secondary' : 'border-transparent',
      )}
    >
      <ChartPreview key={rejeu} marque={marque} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <span className="flex items-center gap-1.5 text-[0.9375rem] font-[600]">
          <span className="min-w-0 truncate">{titre}</span>
          {selectionne === true ? (
            <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : null}
        </span>
        <span className="text-[0.8125rem] text-muted-foreground">{phrase}</span>
        {conseille ? (
          <Badge variant="warning" className="mt-0.5">
            Conseillé ici
          </Badge>
        ) : null}
        {raison === null || raison === undefined ? null : (
          <span className="text-[0.75rem] text-muted-foreground">{raison}</span>
        )}
      </span>
    </button>
  );
}
