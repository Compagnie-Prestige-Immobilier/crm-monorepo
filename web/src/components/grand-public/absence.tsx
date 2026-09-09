import type { ReactNode } from 'react';

/** Ce qui n'a pas été renseigné se lit comme tel, jamais comme une valeur vide. */
export function Absent({ children = 'Non renseigné' }: { children?: ReactNode }) {
  return <span className="text-muted-foreground italic">{children}</span>;
}
