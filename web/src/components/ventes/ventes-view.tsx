'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { DownloadIcon, FileSpreadsheetIcon, PlusIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { memo, useCallback, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { useFileDownload } from '@/components/exports/download-button';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DepotClasseur } from '@/components/ventes/depot-classeur';
import { VenteDetailDialog } from '@/components/ventes/vente-detail-dialog';
import { VenteParcours } from '@/components/ventes/vente-parcours';
import { TeleconseillerDetailDialog } from '@/components/ventes/teleconseiller-detail-dialog';
import { PageReglages } from '@/components/ventes/ventes-reglages';
import {
  Chiffres,
  SyntheseSites,
  TableEcheances,
  TableParTeleconseiller,
  TableVentes,
} from '@/components/ventes/ventes-tableaux';
import {
  CLASSEUR_VENTES_URL,
  archiveVente,
  fetchVentes,
  fetchVentesConfiguration,
  formatFcfa,
  type CanalVente,
  type SiteVente,
  type Vente,
  type VentesData,
} from '@/lib/data/ventes';
import { formatDate, formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** Les adresses de la barre : une page chacune, ou une fenêtre ouverte d'emblée. */
export const VUES_VENTES = [
  'ventes',
  'echeances',
  'sites',
  'teleconseillers',
  'nouvelle',
  'reglages',
] as const;
export type VueVentes = (typeof VUES_VENTES)[number];

function SansVente() {
  return (
    <EmptyState
      icon={FileSpreadsheetIcon}
      title="Aucune vente pour l'instant"
      description="Cette page se remplit dès la première vente enregistrée."
      action={
        <Button size="lg" render={<Link href="/ventes/nouvelle" />}>
          <PlusIcon aria-hidden="true" /> Nouvelle vente
        </Button>
      }
    />
  );
}

function SansCredit({ onAjouter }: { onAjouter: () => void }) {
  return (
    <EmptyState
      icon={FileSpreadsheetIcon}
      title="Aucune vente à crédit"
      description="Enregistrez une vente à crédit pour suivre ici ses versements et son reste à payer."
      action={
        <Button size="lg" onClick={onAjouter}>
          <PlusIcon aria-hidden="true" /> Nouvelle vente
        </Button>
      }
    />
  );
}

function venteAvecId(ventes: readonly Vente[], id: number | null): Vente | null {
  if (id === null) return null;
  return ventes.find((vente) => vente.id === id) ?? null;
}

export function VentesView({ vue = 'ventes' }: { vue?: VueVentes }) {
  const query = useQuery({ queryKey: queryKeys.ventes, queryFn: () => fetchVentes() });
  const configuration = useQuery({
    queryKey: queryKeys.ventesConfiguration,
    queryFn: () => fetchVentesConfiguration(),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (query.isError)
    return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <VentesLoaded
      key={vue}
      vue={vue}
      data={query.data}
      sites={configuration.data?.sites ?? []}
      canaux={configuration.data?.canaux ?? []}
    />
  );
}

function VentesLoaded({
  vue,
  data,
  sites,
  canaux,
}: {
  vue: VueVentes;
  data: VentesData;
  sites: readonly SiteVente[];
  canaux: readonly CanalVente[];
}) {
  const navigate = useNavigate();
  const [saisieOuverte, setSaisieOuverte] = useState(vue === 'nouvelle');
  const [venteEditee, setVenteEditee] = useState<Vente | null>(null);
  const [venteDetailId, setVenteDetailId] = useState<number | null>(null);
  const [venteAArchiver, setVenteAArchiver] = useState<Vente | null>(null);
  const [teleconseillerOuvert, setTeleconseillerOuvert] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Le parcours ouvert depuis la barre ramène sur le tableau en se fermant,
  // sinon l'adresse et la surbrillance de la barre resteraient sur lui.
  const fermerSaisie = useCallback(
    (open: boolean) => {
      setSaisieOuverte(open);
      if (open) return;
      setVenteEditee(null);
      if (vue === 'nouvelle') void navigate({ to: '/ventes' });
    },
    [navigate, vue],
  );
  const archivage = useMutation({
    mutationFn: (vente: Vente) => archiveVente(vente.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ventes });
      setVenteAArchiver(null);
      toast.success('Vente archivée.');
    },
    onError: (error) => toastApiError(error, 'La vente n’a pas pu être archivée.'),
  });

  const { ventes, parTeleconseiller } = data;
  const venteDetail = venteAvecId(ventes, venteDetailId);
  const ajouter = useCallback(() => {
    setVenteEditee(null);
    setSaisieOuverte(true);
  }, []);
  const modifier = useCallback((vente: Vente) => {
    setVenteEditee(vente);
    setSaisieOuverte(true);
  }, []);
  const voirDetail = useCallback((vente: Vente) => setVenteDetailId(vente.id), []);
  const archiver = useCallback((vente: Vente) => setVenteAArchiver(vente), []);
  return (
    <>
      {vue === 'echeances' ? (
        <PageSimple vide={ventes.length === 0}>
          {ventes.some((vente) => vente.modePaiement === 'CREDIT') ? (
            <TableEcheances ventes={ventes} onDetail={voirDetail} />
          ) : (
            <SansCredit onAjouter={ajouter} />
          )}
        </PageSimple>
      ) : null}
      {vue === 'teleconseillers' ? (
        <PageSimple vide={parTeleconseiller.length === 0}>
          <TableParTeleconseiller lignes={parTeleconseiller} onOuvrir={setTeleconseillerOuvert} />
        </PageSimple>
      ) : null}
      {vue === 'sites' ? <PageSites ventes={ventes} sites={sites} /> : null}
      {vue === 'reglages' ? <PageReglages sites={sites} canaux={canaux} /> : null}
      {PAGES_TABLEAU.has(vue) ? (
        <PageVentes
          data={data}
          onAjouter={ajouter}
          onEdit={modifier}
          onDetail={voirDetail}
          onArchive={archiver}
        />
      ) : null}

      <TeleconseillerDetailDialog
        nom={teleconseillerOuvert}
        ventes={ventes}
        onFermer={() => setTeleconseillerOuvert(null)}
      />
      <VenteParcours open={saisieOuverte} onOpenChange={fermerSaisie} vente={venteEditee} />
      <VenteDetailDialog
        vente={venteDetail}
        open={venteDetail !== null}
        onOpenChange={(open) => {
          if (!open) setVenteDetailId(null);
        }}
      />
      <ConfirmDialog
        open={venteAArchiver !== null}
        onOpenChange={(open) => {
          if (!open) setVenteAArchiver(null);
        }}
        title="Archiver cette vente ?"
        description="Elle ne sera plus visible dans les ventes actives."
        confirmLabel="Archiver"
        pending={archivage.isPending}
        onConfirm={() => {
          if (venteAArchiver !== null) archivage.mutate(venteAArchiver);
        }}
      >
        {venteAArchiver === null ? null : (
          <p className="rounded-md bg-muted p-3 text-sm">
            {venteAArchiver.client} · {venteAArchiver.site} · {formatFcfa(venteAArchiver.prixTotal)}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

/** Le tableau reste derrière le parcours ouvert depuis la barre. */
const PAGES_TABLEAU: ReadonlySet<VueVentes> = new Set(['ventes', 'nouvelle']);

function PageSites({ ventes, sites }: { ventes: readonly Vente[]; sites: readonly SiteVente[] }) {
  return (
    <div className="flex flex-col gap-6">
      {ventes.length > 0 ? <Chiffres ventes={ventes} /> : null}
      <SyntheseSites ventes={ventes} configuration={sites} />
    </div>
  );
}

function PageSimple({ vide, children }: { vide: boolean; children: ReactNode }) {
  return vide ? <SansVente /> : <>{children}</>;
}

const chercher = (ventes: readonly Vente[], texte: string): Vente[] => {
  const cherche = texte.trim().toLowerCase();
  if (cherche === '') return [...ventes];
  return ventes.filter((v) => `${v.client} ${v.telephone}`.toLowerCase().includes(cherche));
};

const PageVentes = memo(function PageVentes({
  data,
  onAjouter,
  onEdit,
  onDetail,
  onArchive,
}: {
  data: VentesData;
  onAjouter: () => void;
  onEdit: (vente: Vente) => void;
  onDetail: (vente: Vente) => void;
  onArchive: (vente: Vente) => void;
}) {
  const [recherche, setRecherche] = useState('');
  const telechargement = useFileDownload();
  const { classeur, ventes } = data;
  if (ventes.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheetIcon}
        title="Aucune vente enregistrée"
        description="Enregistrez la première vente en quelques questions, ou importez le classeur Excel existant."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={onAjouter}>
              <PlusIcon aria-hidden="true" /> Nouvelle vente
            </Button>
            <DepotClasseur remplace={classeur !== null} />
          </div>
        }
      />
    );
  }
  const visibles = chercher(ventes, recherche);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Chercher un client"
            className="pl-9"
            placeholder="Chercher un client par nom ou téléphone"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <Button size="lg" onClick={onAjouter}>
          <PlusIcon aria-hidden="true" /> Nouvelle vente
        </Button>
      </div>
      {data.tronque ? (
        <p className="rounded-md bg-warning-surface p-3 text-warning">
          Seules les ventes les plus récentes sont affichées : les plus anciennes manquent à la
          recherche et aux totaux.
        </p>
      ) : null}
      {visibles.length === 0 ? (
        <p className="p-6 text-center text-muted-foreground">
          Aucun client ne correspond à cette recherche.
        </p>
      ) : (
        <TableVentes ventes={visibles} onDetail={onDetail} onEdit={onEdit} onArchive={onArchive} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[0.875rem] text-muted-foreground">
        <span>
          {classeur === null
            ? `${ventes.length} ventes saisies dans le panneau.`
            : `Classeur ${classeur.nomFichier}, importé le ${formatDateTime(classeur.importeLe)} par ${classeur.importePar}${classeur.depuis === null ? '' : `, ventes depuis le ${formatDate(classeur.depuis)}`}.`}
        </span>
        <div className="flex flex-wrap gap-2">
          {classeur === null ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={telechargement.pending}
              onClick={() =>
                void telechargement.download({
                  url: CLASSEUR_VENTES_URL,
                  fileName: classeur.nomFichier,
                  failureMessage: 'Le classeur n’a pas pu être téléchargé.',
                })
              }
            >
              <DownloadIcon aria-hidden="true" /> Télécharger le classeur
            </Button>
          )}
          <DepotClasseur remplace={classeur !== null} />
        </div>
      </div>
    </div>
  );
});
