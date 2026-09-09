import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  PencilIcon,
  PrinterIcon,
} from 'lucide-react';

import { COLONNES_REGISTRE } from '@/components/accueil/impression-feuille';
import { VisiteForm } from '@/components/accueil/visite-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  COLONNES_VISITE,
  type ColonneImpression,
  type FiltresVisite,
  type ReferentielsVisite,
  type TriVisite,
  type Visite,
} from '@/lib/data/visites';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Le libellé du classeur porte aussi le champ de tri : les deux voisinent. */
const TRI_DE: Partial<Record<ColonneImpression, TriVisite>> = {
  [COLONNES_VISITE.date]: 'visitedAt',
  [COLONNES_VISITE.visitorName]: 'visitorName',
  [COLONNES_VISITE.entreprise]: 'entreprise',
  [COLONNES_VISITE.direction]: 'direction',
  [COLONNES_VISITE.destinataire]: 'destinataire',
  [COLONNES_VISITE.objet]: 'objet',
};

export function EnTeteRegistre({
  total,
  jourSeul,
  imprimable,
  onImprimer,
}: {
  total: number;
  jourSeul: boolean;
  imprimable: boolean;
  onImprimer: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
        {formatNumber(total)} visite{total > 1 ? 's' : ''}{' '}
        {jourSeul ? 'aujourd’hui' : 'au registre'}
      </h2>
      <Button
        type="button"
        variant="outline"
        className="print:hidden"
        disabled={!imprimable}
        onClick={onImprimer}
      >
        <PrinterIcon aria-hidden="true" />
        Imprimer
      </Button>
    </div>
  );
}

export interface PageRegistreAffichee {
  page: number;
  pageCount: number;
  total: number;
  premiere: number;
  derniere: number;
}

export function PaginationRegistre({
  page,
  onPage,
}: {
  page: PageRegistreAffichee;
  onPage: (page: number) => void;
}) {
  if (page.pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-[0.9375rem]" role="status">
        <span className="sr-only">Visites affichées : </span>
        {formatNumber(page.premiere)}–{formatNumber(page.derniere)} sur {formatNumber(page.total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page.page <= 1}
          onClick={() => {
            onPage(page.page - 1);
          }}
        >
          <ChevronLeftIcon aria-hidden="true" />
          Page précédente
        </Button>
        <span className="min-w-20 text-center text-[0.9375rem] tabular-nums">
          {page.page} / {page.pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={page.page >= page.pageCount}
          onClick={() => {
            onPage(page.page + 1);
          }}
        >
          Page suivante
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** Sur le papier, dire ce que la feuille contient : la pagination y est masquée. */
export function AvisPagesImprimees({ page }: { page: PageRegistreAffichee }) {
  if (page.pageCount <= 1) return null;
  return (
    <p className="hidden text-[0.75rem] print:block">
      Page {page.page} sur {page.pageCount}, visites {formatNumber(page.premiere)} à{' '}
      {formatNumber(page.derniere)} sur {formatNumber(page.total)}. Les autres pages s’impriment
      séparément.
    </p>
  );
}

export function RegistreVide({
  jourSeul,
  onToutLeRegistre,
}: {
  jourSeul: boolean;
  onToutLeRegistre: () => void;
}) {
  return (
    <Card className="animate-rise items-center gap-3 px-6 py-16 text-center">
      <ClipboardListIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <h3 className="font-display text-[1.125rem] font-[700]">
        {jourSeul ? 'Aucune visite enregistrée aujourd’hui' : 'Aucune visite pour cette recherche'}
      </h3>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">
        {jourSeul
          ? 'Enregistrez la première, ou consultez les visites précédentes.'
          : 'Élargissez la période, ou retirez un filtre.'}
      </p>
      {jourSeul ? (
        <Button type="button" variant="outline" onClick={onToutLeRegistre}>
          Voir tout le registre
        </Button>
      ) : null}
    </Card>
  );
}

export function RegistreTableau({
  visites,
  colonnesImprimees,
  corrigeeId,
  referentiels,
  filtres,
  rafraichissement,
  onTrier,
  onCorriger,
  onAnnuler,
  onCorrigee,
}: {
  visites: readonly Visite[];
  colonnesImprimees: ReadonlySet<ColonneImpression>;
  corrigeeId: string | null;
  referentiels: ReferentielsVisite | undefined;
  filtres: FiltresVisite;
  rafraichissement: boolean;
  onTrier: (colonne: string) => void;
  onCorriger: (id: string) => void;
  onAnnuler: () => void;
  onCorrigee: () => void;
}) {
  const classeImpression = (colonne: ColonneImpression): string | undefined =>
    colonnesImprimees.has(colonne) ? undefined : 'print:hidden';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-elev-sm transition-opacity print:text-[10px]',
        '[&_[data-slot=table-container]]:max-h-[calc(100dvh-19rem)]',
        '[&_[data-slot=table-container]]:overflow-auto',
        // Sur le papier, la zone défilante clipperait les lignes hors écran :
        // l'impression de la page affichée n'en montrerait qu'une partie.
        'print:[&_[data-slot=table-container]]:max-h-none',
        'print:[&_[data-slot=table-container]]:overflow-visible',
        rafraichissement && 'opacity-80',
      )}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            {COLONNES_REGISTRE.map(({ colonne }) => {
              const tri = TRI_DE[colonne];
              if (tri === undefined) {
                return (
                  <TableHead key={colonne} className={classeImpression(colonne)}>
                    {colonne}
                  </TableHead>
                );
              }
              return (
                <SortableTableHead
                  key={colonne}
                  column={{ id: tri, label: colonne }}
                  sortBy={filtres.sortBy}
                  sortDir={filtres.sortDir}
                  onToggle={onTrier}
                  className={classeImpression(colonne)}
                />
              );
            })}
            <TableHead className="print:hidden">CORRIGER</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visites.map((visite) =>
            visite.id === corrigeeId ? (
              <TableRow key={visite.id}>
                <TableCell colSpan={COLONNES_REGISTRE.length + 1} className="bg-secondary/40 p-4">
                  <VisiteForm
                    referentiels={referentiels}
                    visite={visite}
                    onSaved={onCorrigee}
                    onCancel={onAnnuler}
                  />
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={visite.id}>
                {COLONNES_REGISTRE.map((entree) => (
                  <TableCell
                    key={entree.colonne}
                    className={cn(entree.className, classeImpression(entree.colonne))}
                  >
                    {entree.rendu(visite)}
                  </TableCell>
                ))}
                <TableCell className="print:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Modifier la visite de ${visite.visitorName}`}
                    onClick={() => {
                      onCorriger(visite.id);
                    }}
                  >
                    <PencilIcon aria-hidden="true" />
                    Modifier
                  </Button>
                </TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
