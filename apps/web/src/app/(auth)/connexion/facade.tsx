const CELL_W = 90;
const CELL_H = 72;
const GAP = 14;
const COLS = 6;
const ROWS = 8;

const LIT = new Set(['1-2', '4-5']);

export function Facade() {
  const cells: React.ReactElement[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = `${String(col)}-${String(row)}`;
      const lit = LIT.has(key);
      cells.push(
        <rect
          key={key}
          x={col * (CELL_W + GAP)}
          y={row * (CELL_H + GAP)}
          width={CELL_W}
          height={CELL_H}
          rx={5}
          fill={lit ? 'var(--accent)' : 'currentColor'}
          opacity={lit ? 0.32 : 0.06}
        />,
      );
    }
  }

  const width = COLS * (CELL_W + GAP);
  const height = ROWS * (CELL_H + GAP);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="pointer-events-none absolute -bottom-[12%] -right-[16%] w-[68%] text-sidebar-accent-foreground"
    >
      {/* La trame s'éteint vers le haut et vers la gauche, là où se posent le
          logotype et le titre : un motif ne passe jamais devant un nom. */}
      <defs>
        <linearGradient id="facade-fade" x1="0" y1="1" x2="0.75" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="facade-mask">
          <rect width={width} height={height} fill="url(#facade-fade)" />
        </mask>
      </defs>
      {/* `skewX(-14)` : l'inclinaison exacte du logotype. */}
      <g mask="url(#facade-mask)" transform="skewX(-14)">
        {cells}
      </g>
    </svg>
  );
}
