'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, DownloadIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePaginationLocale } from '@/components/ui/table-pagination';
import { suivreRendezVous } from '@/lib/data/prospects';
import {
  CLE_RENDEZ_VOUS,
  lienExportRendezVous,
  lireRendezVous,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const SUIVIS: Record<string, { libelle: string; variante: 'success' | 'destructive' | 'warning' }> =
  {
    HONORE: { libelle: 'Venu', variante: 'success' },
    NON_HONORE: { libelle: 'Pas venu', variante: 'destructive' },
    REPORTE: { libelle: 'Reporté', variante: 'warning' },
  };

function Suivi({ fiche, peutNoter }: { fiche: RendezVousObtenu; peutNoter: boolean }) {
  const client = useQueryClient();
  const noter = useMutation({
    mutationFn: (issue: 'HONORE' | 'NON_HONORE') => suivreRendezVous(fiche.id, { issue }),
    onSuccess: (_, issue) => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      toast.success(issue === 'HONORE' ? 'Venue confirmée.' : 'Absence notée.');
    },
    onError: (error) => toastApiError(error, 'Le suivi n’a pas été enregistré.'),
  });

  const connu = SUIVIS[fiche.issue];
  return (
    <div className="flex items-center gap-2">
      {connu === undefined ? null : <Badge variant={connu.variante}>{connu.libelle}</Badge>}
      {peutNoter ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={noter.isPending}
            aria-label={`Confirmer la venue de ${fiche.prenom} ${fiche.nom}`}
            onClick={() => {
              noter.mutate('HONORE');
            }}
            className="gap-1.5"
          >
            <CheckIcon className="size-3.5" aria-hidden="true" />
            Venu
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={noter.isPending}
            aria-label={`Noter l’absence de ${fiche.prenom} ${fiche.nom}`}
            onClick={() => {
              noter.mutate('NON_HONORE');
            }}
            className="gap-1.5"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
            Pas venu
          </Button>
        </>
      ) : null}
    </div>
  );
}

/**
 * Le comptoir confirme depuis la liste : ouvrir chaque fiche pour un seul clic
 * ferait perdre la file d'attente.
 */
const VENUES: readonly { value: string; label: string }[] = [
  { value: 'tous', label: 'Toutes les venues' },
  { value: 'SANS', label: 'À confirmer' },
  { value: 'HONORE', label: 'Venus' },
  { value: 'NON_HONORE', label: 'Pas venus' },
  { value: 'REPORTE', label: 'Reportés' },
];

export function RendezVousComptoir({
  type,
  peutNoter,
  peutExporter,
}: {
  type: string | null;
  peutNoter: boolean;
  peutExporter: boolean;
}) {
  const [search, setSearch] = useState('');
  const [issue, setIssue] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const filtres = { type, search, issue, du, au, page, pageSize };
  const liste = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, filtres],
    queryFn: () => lireRendezVous(filtres),
  });

  if (liste.isError) {
    return <QueryErrorState error={liste.error} onRetry={() => void liste.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <Input
          type="search"
          value={search}
          placeholder="Nom ou numéro"
          aria-label="Rechercher un rendez-vous"
          className="max-w-xs"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rdv-du">Du</Label>
          <Input
            id="rdv-du"
            type="date"
            value={du}
            onChange={(e) => {
              setDu(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rdv-au">Au</Label>
          <Input
            id="rdv-au"
            type="date"
            value={au}
            onChange={(e) => {
              setAu(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          items={VENUES}
          value={issue === '' ? 'tous' : issue}
          onValueChange={(valeur) => {
            setIssue(valeur === 'tous' || valeur === null ? '' : valeur);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Venue" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VENUES.map((venue) => (
              <SelectItem key={venue.value} value={venue.value}>
                {venue.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          {liste.data === undefined ? null : (
            <p className="text-sm text-muted-foreground">{liste.data.total} rendez-vous</p>
          )}
          {peutExporter ? (
            <a
              href={lienExportRendezVous(filtres)}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              Exporter
            </a>
          ) : null}
        </div>
      </div>

      {liste.isPending ? <Skeleton className="h-64 w-full rounded-lg" /> : null}

      {liste.data !== undefined && liste.data.items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun rendez-vous ici. Changez d’onglet, videz la recherche, ou revenez quand les
          téléconseillers en auront pris.
        </p>
      ) : null}

      {liste.data !== undefined && liste.data.items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rendez-vous le</TableHead>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pris le</TableHead>
                  <TableHead>Par</TableHead>
                  <TableHead>Venue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.data.items.map((fiche) => (
                  <TableRow key={fiche.id}>
                    <TableCell className="whitespace-nowrap">
                      {fiche.quand === null ? '' : formatDateTime(fiche.quand)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {fiche.prenom} {fiche.nom}
                      </p>
                      {fiche.phoneE164 === null ? null : (
                        <a
                          href={`tel:${fiche.phoneE164}`}
                          className="font-mono text-xs text-primary"
                        >
                          {fiche.phoneE164}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      {fiche.type}
                      {fiche.site === '' ? null : (
                        <p className="text-[0.8125rem] text-muted-foreground">
                          {fiche.site} · {fiche.pointRencontre}
                          {fiche.pointRencontreCommentaire === ''
                            ? null
                            : `, ${fiche.pointRencontreCommentaire}`}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {fiche.prisLe === null ? '' : formatDateTime(fiche.prisLe)}
                    </TableCell>
                    <TableCell>{fiche.prisPar}</TableCell>
                    <TableCell>
                      <Suivi fiche={fiche} peutNoter={peutNoter} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePaginationLocale
            page={liste.data.page}
            pageCount={liste.data.pageCount}
            pageSize={liste.data.pageSize}
            setPage={setPage}
            setPageSize={(taille) => {
              setPageSize(taille);
              setPage(1);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
