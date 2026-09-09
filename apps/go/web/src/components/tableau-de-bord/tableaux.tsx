import { NombreAnime } from '@/components/tableau-de-bord/nombre-anime';
import type { Equipe, Scalaire, Valeur } from '@/components/tableau-de-bord/sources';
import { formatNumber } from '@/lib/format';

/**
 * Ce qu'une carte montre quand sa série est vide. Sans elle, Chart.js dessine
 * des axes nus, ce qui se lit comme un chargement qui n'aboutit pas.
 */
export function GraphiqueVide({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <p className="text-[0.8125rem] text-muted-foreground">{message}</p>
    </div>
  );
}

export function TableauValeurs({
  items,
  entete,
  caption,
}: {
  items: readonly Valeur[];
  entete: string;
  caption: string;
}) {
  const total = items.reduce((somme, item) => somme + item.value, 0);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- zone défilable au clavier
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-[600]">
              {entete}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-[600]">
              Valeur
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-[600]">
              Part
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id}>
              <th scope="row" className="px-2 py-1.5 text-left font-[400]">
                {item.label}
              </th>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(item.value)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {total === 0 ? '0 %' : `${String(Math.round((item.value / total) * 100))} %`}
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                Aucune donnée sur la période.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Une ligne par personne, des colonnes d'unités différentes. Les cellules
 * arrivent déjà mises en forme : la source seule sait ce qui est un compte et
 * ce qui est un pourcentage.
 */
export function TableauEquipe({ donnee, caption }: { donnee: Equipe; caption: string }) {
  if (donnee.lignes.length === 0) {
    return <GraphiqueVide message="Personne n’a travaillé sur la période." />;
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- zone défilable au clavier
    <div className="h-full overflow-auto" tabIndex={0}>
      <table className="w-full min-w-[42rem] text-[0.875rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 border-b border-border bg-card">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-[600]">
              Nom
            </th>
            {donnee.colonnes.map((colonne) => (
              <th key={colonne} scope="col" className="px-3 py-2 text-right font-[600]">
                {colonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {donnee.lignes.map((ligne) => (
            <tr key={ligne.id}>
              <th scope="row" className="px-3 py-2 text-left font-[400]">
                {ligne.nom}
              </th>
              {ligne.cellules.map((cellule) => (
                <td key={cellule.cle} className="px-3 py-2 text-right tabular-nums">
                  {cellule.texte}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {donnee.pied === undefined ? null : (
          <tfoot className="sticky bottom-0 border-t border-border bg-card font-[600]">
            <tr>
              <th scope="row" className="px-3 py-2 text-left">
                {donnee.pied.nom}
              </th>
              {donnee.pied.cellules.map((cellule) => (
                <td key={cellule.cle} className="px-3 py-2 text-right tabular-nums">
                  {cellule.texte}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Tuile({
  valeur,
  affichage,
  libelle,
  detail,
}: {
  valeur: number;
  affichage?: Scalaire['affichage'];
  libelle: string;
  detail?: string | undefined;
}) {
  const grand = affichage ?? { valeur, format: formatNumber };
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="font-display text-[2.25rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
        {typeof grand === 'string' ? (
          grand
        ) : (
          <NombreAnime valeur={grand.valeur} format={grand.format} />
        )}
      </p>
      {detail === undefined ? null : (
        <p className="mt-2 text-[0.8125rem] text-muted-foreground">{detail}</p>
      )}
      <span className="sr-only">{libelle}</span>
    </div>
  );
}
