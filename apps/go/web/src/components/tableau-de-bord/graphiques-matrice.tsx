import type { Matrice } from '@/components/tableau-de-bord/sources';

/** Une matrice ne se lit qu'en croisement : la couleur porte les deux axes. */
export function CarteDeChaleur({ matrice, caption }: { matrice: Matrice; caption: string }) {
  const max = Math.max(1, ...matrice.cellules.map((cellule) => cellule.value));
  const parCellule = new Map(
    matrice.cellules.map((cellule) => [`${cellule.ligne} ${cellule.colonne}`, cellule.value]),
  );

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- zone défilable au clavier
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full border-collapse text-[0.75rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Ligne</span>
            </th>
            {matrice.colonnes.map((colonne) => (
              <th
                key={colonne}
                scope="col"
                className="px-1.5 py-1 text-center font-[600] whitespace-nowrap"
              >
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrice.lignes.map((ligne) => (
            <tr key={ligne}>
              <th scope="row" className="px-1.5 py-1 text-left font-[600] whitespace-nowrap">
                {ligne}
              </th>
              {matrice.colonnes.map((colonne) => {
                const valeur = parCellule.get(`${ligne} ${colonne}`) ?? 0;
                const opacite = valeur === 0 ? 0 : 0.15 + (valeur / max) * 0.75;
                return (
                  <td
                    key={colonne}
                    className="px-1.5 py-1 text-center tabular-nums"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--chart-1) ${String(opacite * 100)}%, transparent)`,
                    }}
                  >
                    {valeur === 0 ? '' : valeur}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
