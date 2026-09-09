import { LigneCompte } from '@/components/admin/compte-ligne';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Compte } from '@/lib/data/users';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export function TableComptes({
  items,
  fraichit,
  moiId,
  enCours,
  onModifier,
  onMotDePasse,
  onBasculer,
  onSupprimer,
}: {
  items: readonly Compte[];
  fraichit: boolean;
  moiId: string | undefined;
  enCours: boolean;
  onModifier: (compte: Compte) => void;
  onMotDePasse: (compte: Compte) => void;
  onBasculer: (compte: Compte) => void;
  onSupprimer: (compte: Compte) => void;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
        fraichit && 'opacity-80',
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Utilisateur</TableHead>
            <TableHead>Identifiants</TableHead>
            <TableHead className="text-right">Prospects</TableHead>
            <TableHead>Dernière connexion</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-16 text-center">
                <p className="font-[600]">Aucun compte ne correspond à ces critères.</p>
                <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                  Élargissez la recherche, ou créez un compte.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            items.map((compte) => (
              <LigneCompte
                key={compte.id}
                compte={compte}
                estMoi={compte.id === moiId}
                enCours={enCours}
                onModifier={() => {
                  onModifier(compte);
                }}
                onMotDePasse={() => {
                  onMotDePasse(compte);
                }}
                onBasculer={() => {
                  onBasculer(compte);
                }}
                onSupprimer={() => {
                  onSupprimer(compte);
                }}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function PaginationComptes({
  meta,
  page,
  onPage,
}: {
  meta: { total: number; page: number; pageCount: number } | undefined;
  page: number;
  onPage: (page: number) => void;
}) {
  if (meta === undefined || meta.pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
        {formatNumber(meta.total)} comptes · page {formatNumber(meta.page)} sur{' '}
        {formatNumber(meta.pageCount)}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          Précédent
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={page >= meta.pageCount}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
