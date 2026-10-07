'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  etatDe,
  lieuDe,
  NomFiche,
  quandDe,
  Telephone,
} from '@/components/accueil/rendez-vous-tableau';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  type FiltresSynthese,
  type ListeRendezVous,
  lireRendezVousDeLaSynthese,
} from '@/lib/data/rendez-vous';
import { formatNumber } from '@/lib/format';

function Lignes({ liste }: { liste: ListeRendezVous }) {
  if (liste.items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucun rendez-vous. Élargissez la période ou le type.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table aria-label="Rendez-vous comptés">
        <TableHeader>
          <TableRow>
            <TableHead>Rendez-vous le</TableHead>
            <TableHead>Prospect</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {liste.items.map((fiche) => {
            const etat = etatDe(fiche);
            return (
              <TableRow key={fiche.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{quandDe(fiche)}</TableCell>
                <TableCell className="font-[600]">
                  <NomFiche fiche={fiche} />
                </TableCell>
                <TableCell>
                  <Telephone fiche={fiche} />
                </TableCell>
                <TableCell>{lieuDe(fiche)}</TableCell>
                <TableCell>
                  <Badge variant={etat.ton}>{etat.texte}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Pages({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => {
          setPage(page - 1);
        }}
      >
        Précédents
      </Button>
      <span className="tabular-nums">
        Page {page} sur {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => {
          setPage(page + 1);
        }}
      >
        Suivants
      </Button>
    </div>
  );
}

function Contenu({ filtres }: { filtres: FiltresSynthese }) {
  const [page, setPage] = useState(1);
  const requete = useQuery({
    queryKey: ['accueil', 'rendez-vous', 'synthese', 'detail', filtres, page],
    queryFn: () => lireRendezVousDeLaSynthese(filtres, page),
    placeholderData: keepPreviousData,
  });
  if (requete.isError) {
    return (
      <QueryErrorState
        error={requete.error}
        onRetry={() => {
          void requete.refetch();
        }}
      />
    );
  }
  if (requete.data === undefined) return <Skeleton className="h-64 w-full rounded-lg" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.8125rem] text-muted-foreground">
        {formatNumber(requete.data.total)} rendez-vous
      </p>
      <Lignes liste={requete.data} />
      <Pages page={page} pageCount={requete.data.pageCount} setPage={setPage} />
    </div>
  );
}

export function DetailSynthese({
  titre,
  filtres,
  onClose,
}: {
  titre: string;
  filtres: FiltresSynthese | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={filtres !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>
        {filtres === null ? null : <Contenu key={titre} filtres={filtres} />}
      </DialogContent>
    </Dialog>
  );
}
