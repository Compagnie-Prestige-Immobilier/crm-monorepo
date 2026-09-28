'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { ClosingDialog } from '@/components/accueil/closing-dialog';
import { ActionsRendezVous } from '@/components/accueil/rendez-vous-actions';
import { VisiteForm } from '@/components/accueil/visite-form';
import {
  BarreRendezVous,
  ETAPES,
  EtapesRendezVous,
} from '@/components/accueil/rendez-vous-filtres';
import { QueryErrorState } from '@/components/query-error-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ListeCartes } from '@/components/ui/liste-cartes';
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
import {
  CLE_RENDEZ_VOUS,
  type FiltresRendezVous,
  type ListeRendezVous,
  lireRendezVous,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { VISITE_REFERENTIELS_QUERY_KEY, fetchVisiteReferentiels } from '@/lib/data/visites';
import { formatDateTime, formatPhone } from '@/lib/format';

const quandDe = (fiche: RendezVousObtenu): string =>
  fiche.quand === null ? '' : formatDateTime(fiche.quand);

function Cellules({ fiche }: { fiche: RendezVousObtenu }) {
  const precision =
    fiche.pointRencontreCommentaire === '' ? '' : `, ${fiche.pointRencontreCommentaire}`;
  return (
    <>
      <TableCell className="whitespace-nowrap">{quandDe(fiche)}</TableCell>
      <TableCell>
        <p className="font-medium">
          {fiche.prenom} {fiche.nom}
        </p>
        {fiche.phoneE164 === null ? null : (
          <a href={`tel:${fiche.phoneE164}`} className="font-mono text-xs text-primary">
            {formatPhone(fiche.phoneE164)}
          </a>
        )}
      </TableCell>
      <TableCell>
        {fiche.type}
        {fiche.site === '' ? null : (
          <p className="text-[0.8125rem] text-muted-foreground">
            {fiche.site} · {fiche.pointRencontre}
            {precision}
          </p>
        )}
      </TableCell>
      <TableCell>{fiche.prisPar}</TableCell>
    </>
  );
}

function VisiteDuRendezVous({
  rendezVous,
  onClose,
}: {
  rendezVous: RendezVousObtenu | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const referentiels = useQuery({
    queryKey: VISITE_REFERENTIELS_QUERY_KEY,
    queryFn: () => fetchVisiteReferentiels(),
    staleTime: 5 * 60_000,
    enabled: rendezVous !== null,
  });
  if (rendezVous === null) return null;
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Enregistrer une visite</DialogTitle>
        </DialogHeader>
        <VisiteForm
          referentiels={referentiels.data}
          preremplie={{
            visitorName: `${rendezVous.prenom} ${rendezVous.nom}`.trim(),
            phone: rendezVous.phoneE164 === null ? '' : formatPhone(rendezVous.phoneE164),
            comment: `Rendez-vous ${rendezVous.type} pris par ${rendezVous.prisPar}`,
          }}
          onSaved={() => {
            onClose();
            void client.invalidateQueries({ queryKey: ['visites'] });
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

function messageVide(filtres: FiltresRendezVous): string {
  if (filtres.search !== '' || filtres.du !== '' || filtres.au !== '') {
    return 'Aucun rendez-vous pour cette recherche. Videz la recherche ou les dates.';
  }
  return ETAPES.find((choix) => choix.value === filtres.etape)?.vide ?? '';
}

function Resultats({
  liste,
  actions,
  setPage,
  setPageSize,
}: {
  liste: ListeRendezVous;
  actions: (fiche: RendezVousObtenu) => ReactNode;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}) {
  if (liste.items.length === 0) return null;
  return (
    <>
      <ListeCartes
        items={liste.items}
        libelle="Rendez-vous"
        cle={(fiche) => fiche.id}
        titre={(fiche) => `${fiche.prenom} ${fiche.nom}`}
        sousTitre={(fiche) => `${quandDe(fiche)} · ${fiche.type}`}
        numero={(fiche) => fiche.phoneE164}
        action={actions}
      />
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <Table aria-label="Rendez-vous">
          <TableHeader>
            <TableRow>
              <TableHead>Rendez-vous le</TableHead>
              <TableHead>Prospect</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Pris par</TableHead>
              <TableHead>Suite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liste.items.map((fiche) => (
              <TableRow key={fiche.id}>
                <Cellules fiche={fiche} />
                <TableCell>{actions(fiche)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePaginationLocale
        page={liste.page}
        pageCount={liste.pageCount}
        pageSize={liste.pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
      />
    </>
  );
}

export function RendezVousComptoir({
  peutNoter,
  peutCloser,
  peutExporter,
  peutEnregistrerVisite,
}: {
  peutNoter: boolean;
  peutCloser: boolean;
  peutExporter: boolean;
  peutEnregistrerVisite: boolean;
}) {
  const [filtres, setFiltres] = useState<FiltresRendezVous>({
    etape: 'A_CONFIRMER',
    type: '',
    search: '',
    du: '',
    au: '',
    page: 1,
    pageSize: 25,
  });
  const changer = (patch: Partial<FiltresRendezVous>) => {
    setFiltres((avant) => ({ ...avant, page: 1, ...patch }));
  };
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const [visiteDe, setVisiteDe] = useState<RendezVousObtenu | null>(null);
  const liste = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, filtres],
    queryFn: () => lireRendezVous(filtres),
  });
  const onEnregistrerVisite = peutEnregistrerVisite ? setVisiteDe : null;
  const actions = (fiche: RendezVousObtenu) => (
    <ActionsRendezVous
      fiche={fiche}
      peutNoter={peutNoter}
      peutCloser={peutCloser}
      onCloser={setClosingDe}
      onEnregistrerVisite={onEnregistrerVisite}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <EtapesRendezVous etape={filtres.etape} parEtape={liste.data?.parEtape} changer={changer} />
      <BarreRendezVous filtres={filtres} changer={changer} peutExporter={peutExporter} />

      {liste.isError ? (
        <QueryErrorState error={liste.error} onRetry={() => void liste.refetch()} />
      ) : null}
      {liste.isPending ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {liste.data?.items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {messageVide(filtres)}
        </p>
      ) : null}

      {liste.data === undefined ? null : (
        <Resultats
          liste={liste.data}
          actions={actions}
          setPage={(page) => {
            setFiltres((avant) => ({ ...avant, page }));
          }}
          setPageSize={(pageSize) => {
            changer({ pageSize });
          }}
        />
      )}

      <ClosingDialog
        rendezVous={closingDe}
        onClose={() => {
          setClosingDe(null);
        }}
      />
      <VisiteDuRendezVous
        rendezVous={visiteDe}
        onClose={() => {
          setVisiteDe(null);
        }}
      />
    </div>
  );
}
