'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import {
  fetchLotExportFiches,
  reaffecterFiches,
  type LotExportDetail,
  type LotExportFiche,
  type LotExportFicheEtat,
} from '@/lib/data/lots-export';
import { formatPhone } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const TOUS = 'TOUS';
const PAGE_SIZE = 50;

const ETAT_LABELS: Record<LotExportFicheEtat, string> = {
  NON_TRAITEE: 'Non traitée',
  TRAITEE: 'Traitée',
  A_RAPPELER: 'À rappeler',
};

/** Une fiche traitée ne se déplace pas : le travail resterait au compteur d'un autre. */
const deplacable = (fiche: LotExportFiche): boolean => fiche.etat === 'NON_TRAITEE';

const ficheHref = (fiche: LotExportFiche, cible: LotExportDetail['cible']): string | null => {
  if (fiche.ficheId === null) return null;
  return cible === 'PROSPECTS'
    ? `/chues/prospects/${fiche.ficheId}`
    : `/chues/representants/${fiche.ficheId}`;
};

export function LotExportFiches({
  lot,
  peutReaffecter,
}: {
  lot: LotExportDetail;
  peutReaffecter: boolean;
}) {
  const queryClient = useQueryClient();
  const [teleconseillerId, setTeleconseillerId] = useState<string>(TOUS);
  const [etat, setEtat] = useState<string>(TOUS);
  const [page, setPage] = useState(1);
  const [cochees, setCochees] = useState<readonly number[]>([]);
  const [vers, setVers] = useState<string>(TOUS);

  const filtres = {
    page,
    pageSize: PAGE_SIZE,
    ...(teleconseillerId === TOUS ? {} : { teleconseillerId }),
    ...(etat === TOUS ? {} : { etat: etat as LotExportFicheEtat }),
  };
  const fiches = useQuery({
    queryKey: queryKeys.lotsExportFiches(lot.id, filtres),
    queryFn: () => fetchLotExportFiches(lot.id, filtres),
  });

  const reaffectation = useMutation({
    mutationFn: () =>
      reaffecterFiches(lot.id, { positions: [...cochees], versTeleconseillerId: vers }),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.lotsExportDetail(lot.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(lot.id) });
      setCochees([]);
      toast.success('Fiches confiées.');
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Les fiches n’ont pas pu être confiées.'));
    },
  });

  const equipe = lot.repartition;
  const lignes = fiches.data?.items ?? [];
  const total = fiches.data?.total ?? 0;
  const pageCount = fiches.data?.pageCount ?? 1;
  const cochables = lignes.filter(deplacable);

  const changerLeFiltre = (appliquer: () => void) => {
    appliquer();
    setPage(1);
    setCochees([]);
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Fiches de la campagne
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Une fiche traitée reste à celui qui l’a appelée. Seules les fiches non traitées se
          confient à quelqu’un d’autre.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <ChoixListe
            label="Tous"
            legende="Téléconseiller"
            largeur="w-56"
            valeur={teleconseillerId}
            options={equipe.map((ligne) => ({
              value: ligne.teleconseillerId,
              label: ligne.teleconseillerName,
            }))}
            onChange={(value) => {
              changerLeFiltre(() => {
                setTeleconseillerId(value);
              });
            }}
          />
          <ChoixListe
            label="Tous les états"
            legende="État"
            largeur="w-48"
            valeur={etat}
            options={Object.entries(ETAT_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(value) => {
              changerLeFiltre(() => {
                setEtat(value);
              });
            }}
          />
        </div>

        {peutReaffecter && cochees.length > 0 ? (
          <BandeauReaffectation
            equipe={equipe}
            nombre={cochees.length}
            vers={vers}
            pending={reaffectation.isPending}
            onVers={setVers}
            onConfier={() => {
              reaffectation.mutate();
            }}
          />
        ) : null}

        {fiches.isPending ? <Skeleton className="h-64 rounded-lg" /> : null}

        {fiches.isSuccess && lignes.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucune fiche ne correspond à ces filtres.
          </p>
        ) : null}

        {lignes.length === 0 ? null : (
          <Table aria-label="Fiches de la campagne">
            <TableHeader>
              <TableRow>
                {peutReaffecter ? (
                  <TableHead scope="col" className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label="Cocher toutes les fiches non traitées de la page"
                      checked={cochables.length > 0 && cochees.length === cochables.length}
                      disabled={cochables.length === 0}
                      onChange={(event) => {
                        setCochees(
                          event.target.checked ? cochables.map((fiche) => fiche.position) : [],
                        );
                      }}
                    />
                  </TableHead>
                ) : null}
                <TableHead scope="col">Fiche</TableHead>
                <TableHead scope="col">Téléphone</TableHead>
                <TableHead scope="col">Téléconseiller</TableHead>
                <TableHead scope="col">Jour</TableHead>
                <TableHead scope="col">État</TableHead>
                <TableHead scope="col">Statut posé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((fiche) => (
                <LigneFiche
                  key={fiche.position}
                  fiche={fiche}
                  cible={lot.cible}
                  cochable={peutReaffecter}
                  cochee={cochees.includes(fiche.position)}
                  onCocher={(coche) => {
                    setCochees((courantes) =>
                      coche
                        ? [...courantes, fiche.position]
                        : courantes.filter((position) => position !== fiche.position),
                    );
                  }}
                />
              ))}
            </TableBody>
          </Table>
        )}

        {pageCount > 1 ? (
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            onPage={(suivante) => {
              setPage(suivante);
              setCochees([]);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChoixListe({
  legende,
  label,
  largeur,
  valeur,
  options,
  onChange,
}: {
  legende: string;
  label: string;
  largeur: string;
  valeur: string;
  options: readonly { value: string; label: string }[];
  onChange: (valeur: string) => void;
}) {
  const items = [{ value: TOUS, label }, ...options];
  return (
    <label className="flex flex-col gap-1.5 text-[0.8125rem] font-[600]">
      {legende}
      <Select
        items={items}
        value={valeur}
        onValueChange={(value) => {
          if (value !== null) onChange(value);
        }}
      >
        <SelectTrigger className={largeur}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function LigneFiche({
  fiche,
  cible,
  cochable,
  cochee,
  onCocher,
}: {
  fiche: LotExportFiche;
  cible: LotExportDetail['cible'];
  cochable: boolean;
  cochee: boolean;
  onCocher: (coche: boolean) => void;
}) {
  const href = ficheHref(fiche, cible);
  return (
    <TableRow>
      {cochable ? (
        <TableCell>
          <input
            type="checkbox"
            className="size-4 accent-primary"
            aria-label={`Confier la fiche de ${fiche.fullName}`}
            disabled={!deplacable(fiche)}
            checked={cochee}
            onChange={(event) => {
              onCocher(event.target.checked);
            }}
          />
        </TableCell>
      ) : null}
      <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
        {href === null ? (
          fiche.fullName
        ) : (
          <Link href={href} className="hover:underline focus-visible:underline">
            {fiche.fullName}
          </Link>
        )}
      </th>
      <TableCell className="tabular-nums">{formatPhone(fiche.phoneE164)}</TableCell>
      <TableCell>{fiche.teleconseillerName}</TableCell>
      <TableCell className="tabular-nums">{fiche.jour}</TableCell>
      <TableCell>
        <Badge variant={fiche.etat === 'NON_TRAITEE' ? 'outline' : 'secondary'}>
          {ETAT_LABELS[fiche.etat]}
        </Badge>
      </TableCell>
      <TableCell>{fiche.statutLabel ?? '—'}</TableCell>
    </TableRow>
  );
}

function BandeauReaffectation({
  equipe,
  nombre,
  vers,
  pending,
  onVers,
  onConfier,
}: {
  equipe: LotExportDetail['repartition'];
  nombre: number;
  vers: string;
  pending: boolean;
  onVers: (id: string) => void;
  onConfier: () => void;
}) {
  const items = equipe.map((ligne) => ({
    value: ligne.teleconseillerId,
    label: ligne.teleconseillerName,
  }));
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
      <p className="text-[0.875rem]">
        <span className="tabular-nums">{nombre}</span> fiche{nombre > 1 ? 's' : ''} à confier à
      </p>
      <Select
        items={items}
        value={vers === TOUS ? null : vers}
        onValueChange={(value) => {
          if (value !== null) onVers(value);
        }}
      >
        <SelectTrigger className="w-56" aria-label="Confier les fiches à">
          <SelectValue placeholder="Choisir un téléconseiller" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" disabled={vers === TOUS || pending} onClick={onConfier}>
        {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        Confier
      </Button>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
        Page {page} sur {pageCount}, {total} fiches
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Page précédente"
        disabled={page === 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Page suivante"
        disabled={page >= pageCount}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
