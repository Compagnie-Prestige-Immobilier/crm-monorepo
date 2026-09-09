import type { ReactNode } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Colonne<T> {
  readonly cle: string;
  readonly entete: string;
  readonly cellule: (item: T) => ReactNode;
  /** Le titre de la carte sous 768 px : l'entête n'y est alors pas répété. */
  readonly titre?: boolean;
}

/**
 * Un tableau au bureau, une pile de cartes au pouce : sous 768 px, cinq
 * colonnes obligent à défiler horizontalement et la ligne devient illisible.
 */
export function ListeResponsive<T>({
  items,
  colonnes,
  cle,
  actions,
  libelle,
}: {
  items: readonly T[];
  colonnes: readonly Colonne<T>[];
  cle: (item: T) => string;
  actions?: ((item: T) => ReactNode) | undefined;
  libelle: string;
}) {
  return (
    <>
      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {colonnes.map((colonne) => (
                <TableHead key={colonne.cle}>{colonne.entete}</TableHead>
              ))}
              {actions === undefined ? null : (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={cle(item)}>
                {colonnes.map((colonne) => (
                  <TableCell key={colonne.cle}>{colonne.cellule(item)}</TableCell>
                ))}
                {actions === undefined ? null : (
                  <TableCell>
                    <div className="flex justify-end gap-2">{actions(item)}</div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label={libelle} className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li
            key={cle(item)}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
          >
            {colonnes.map((colonne) =>
              colonne.titre === true ? (
                <div key={colonne.cle} className="font-[600]">
                  {colonne.cellule(item)}
                </div>
              ) : (
                <div
                  key={colonne.cle}
                  className="flex flex-wrap justify-between gap-2 text-[0.875rem]"
                >
                  <span className="text-muted-foreground">{colonne.entete}</span>
                  <span className="text-right">{colonne.cellule(item)}</span>
                </div>
              ),
            )}
            {actions === undefined ? null : (
              <div className="flex flex-wrap gap-2">{actions(item)}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
