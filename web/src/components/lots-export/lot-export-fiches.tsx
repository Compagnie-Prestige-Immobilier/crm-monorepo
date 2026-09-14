'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, FileDownIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useFileDownload } from '@/components/exports/download-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  lotFichesRecuesFileName,
  lotFichesRecuesUrl,
  fetchTeleconseillers,
  reaffecterFiches,
  type Teleconseiller,
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

function buildFiltres(page: number, teleconseillerId: string, etat: string) {
  return {
    page,
    pageSize: PAGE_SIZE,
    ...(teleconseillerId === TOUS ? {} : { teleconseillerId }),
    ...(etat === TOUS ? {} : { etat: etat as LotExportFicheEtat }),
  };
}

const ficheHref = (fiche: LotExportFiche, cible: LotExportDetail['cible']): string | null => {
  if (fiche.ficheId === null) return null;
  return cible === 'PROSPECTS'
    ? `/chues/prospects/${fiche.ficheId}`
    : `/chues/representants/${fiche.ficheId}`;
};

function destinatairesPossibles(
  equipe: LotExportDetail['repartition'],
  comptes: readonly Teleconseiller[] = [],
): { value: string; label: string }[] {
  const membres = new Set(equipe.map((ligne) => ligne.teleconseillerId));
  return [
    ...equipe.map((ligne) => ({ value: ligne.teleconseillerId, label: ligne.teleconseillerName })),
    ...comptes
      .filter((compte) => !membres.has(compte.id))
      .map((compte) => ({ value: compte.id, label: compte.fullName })),
  ];
}

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
  const [confirmation, setConfirmation] = useState(false);
  const [recues, setRecues] = useState<LotExportDetail['reaffectations']>([]);
  const telechargement = useFileDownload();

  const filtres = buildFiltres(page, teleconseillerId, etat);
  const fiches = useQuery({
    queryKey: queryKeys.lotsExportFiches(lot.id, filtres),
    queryFn: () => fetchLotExportFiches(lot.id, filtres),
  });

  const telechargerRecues = (trace: LotExportDetail['reaffectations'][number]) =>
    telechargement.download({
      url: lotFichesRecuesUrl(lot.id, trace.toTeleconseillerId, trace.id),
      fileName: lotFichesRecuesFileName(trace.toName),
      failureMessage: 'Les fiches reçues n’ont pas pu être générées.',
    });

  const reaffectation = useMutation({
    mutationFn: () =>
      reaffecterFiches(lot.id, { positions: [...cochees], versTeleconseillerId: vers }),
    onSuccess: (detail) => {
      const connues = new Set(lot.reaffectations.map((trace) => trace.id));
      const nouvelles = detail.reaffectations.filter((trace) => !connues.has(trace.id));
      queryClient.setQueryData(queryKeys.lotsExportDetail(lot.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(lot.id) });
      void queryClient.invalidateQueries({ queryKey: ['lots-export', 'detail', lot.id, 'fiches'] });
      setCochees([]);
      setConfirmation(false);
      setRecues(nouvelles);
      const premiere = nouvelles[0];
      toast.success(
        'Fiches attribuées.',
        premiere
          ? { action: { label: 'Télécharger', onClick: () => void telechargerRecues(premiere) } }
          : {},
      );
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Les fiches n’ont pas pu être attribuées.'));
    },
  });

  const equipe = lot.repartition;
  // Un téléconseiller oublié à la création entre dans la campagne en recevant des fiches.
  const teleconseillers = useQuery({
    queryKey: queryKeys.lotsExportTeleconseillers,
    queryFn: () => fetchTeleconseillers(),
    staleTime: 5 * 60_000,
    enabled: peutReaffecter,
  });
  const destinataires = destinatairesPossibles(equipe, teleconseillers.data);
  const destinataire = destinataires.find((item) => item.value === vers)?.label ?? '';
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
          Une fiche traitée reste à celui qui l’a appelée. Seules les fiches non traitées
          s’attribuent à quelqu’un d’autre.
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

        <BandeauReaffectation
          visible={peutReaffecter}
          destinataires={destinataires}
          nombre={cochees.length}
          vers={vers}
          pending={reaffectation.isPending}
          onVers={setVers}
          onAttribuer={() => {
            setConfirmation(true);
          }}
        />

        <ConfirmDialog
          open={confirmation}
          onOpenChange={setConfirmation}
          title={`Attribuer ${String(cochees.length)} fiche${cochees.length > 1 ? 's' : ''} à ${destinataire} ?`}
          description="Elles rejoignent son programme. Son papier déjà imprimé ne les contient pas : un PDF des fiches reçues sera proposé."
          confirmLabel="Attribuer"
          confirmVariant="default"
          pending={reaffectation.isPending}
          onConfirm={() => {
            reaffectation.mutate();
          }}
        />

        <FenetreFichesRecues
          recues={recues}
          pending={telechargement.pending}
          onFermer={() => {
            setRecues([]);
          }}
          onTelecharger={telechargerRecues}
        />

        <EtatChargement
          isPending={fiches.isPending}
          isSuccess={fiches.isSuccess}
          vide={lignes.length === 0}
        />

        <TableFiches
          peutReaffecter={peutReaffecter}
          cible={lot.cible}
          lignes={lignes}
          cochables={cochables}
          cochees={cochees}
          onCocherTout={(toutes) => {
            setCochees(toutes ? cochables.map((fiche) => fiche.position) : []);
          }}
          onCocherUne={(position, coche) => {
            setCochees((courantes) =>
              coche ? [...courantes, position] : courantes.filter((p) => p !== position),
            );
          }}
        />

        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          onPage={(suivante) => {
            setPage(suivante);
            setCochees([]);
          }}
        />
      </CardContent>
    </Card>
  );
}

function FenetreFichesRecues({
  recues,
  pending,
  onFermer,
  onTelecharger,
}: {
  recues: LotExportDetail['reaffectations'];
  pending: boolean;
  onFermer: () => void;
  onTelecharger: (trace: LotExportDetail['reaffectations'][number]) => Promise<void>;
}) {
  const attribuees = recues.reduce((somme, trace) => somme + trace.fiches, 0);
  const pluriel = attribuees > 1 ? 's' : '';
  return (
    <Dialog
      open={recues.length > 0}
      onOpenChange={(ouvert) => {
        if (!ouvert) onFermer();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {attribuees} fiche{pluriel} attribuée{pluriel} à {recues[0]?.toName}
          </DialogTitle>
          <DialogDescription>
            Son programme papier ne les contient pas. Le PDF ne reprend que ces fiches, à imprimer
            en complément.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFermer}>
            Fermer
          </Button>
          {recues.map((trace) => (
            <Button
              key={trace.id}
              type="button"
              disabled={pending}
              onClick={() => void onTelecharger(trace)}
            >
              {pending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDownIcon aria-hidden="true" />
              )}
              {recues.length > 1
                ? `Fiches de ${trace.fromName ?? 'personne'} (PDF)`
                : 'Télécharger ses fiches reçues (PDF)'}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EtatChargement({
  isPending,
  isSuccess,
  vide,
}: {
  isPending: boolean;
  isSuccess: boolean;
  vide: boolean;
}) {
  if (isPending) return <Skeleton className="h-64 rounded-lg" />;
  if (isSuccess && vide) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucune fiche ne correspond à ces filtres.
      </p>
    );
  }
  return null;
}

function TableFiches({
  peutReaffecter,
  cible,
  lignes,
  cochables,
  cochees,
  onCocherTout,
  onCocherUne,
}: {
  peutReaffecter: boolean;
  cible: LotExportDetail['cible'];
  lignes: readonly LotExportFiche[];
  cochables: readonly LotExportFiche[];
  cochees: readonly number[];
  onCocherTout: (toutes: boolean) => void;
  onCocherUne: (position: number, coche: boolean) => void;
}) {
  if (lignes.length === 0) return null;

  return (
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
                  onCocherTout(event.target.checked);
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
            cible={cible}
            cochable={peutReaffecter}
            cochee={cochees.includes(fiche.position)}
            onCocher={(coche) => {
              onCocherUne(fiche.position, coche);
            }}
          />
        ))}
      </TableBody>
    </Table>
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
            aria-label={`Attribuer la fiche de ${fiche.fullName}`}
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
  visible,
  destinataires: items,
  nombre,
  vers,
  pending,
  onVers,
  onAttribuer,
}: {
  visible: boolean;
  destinataires: readonly { value: string; label: string }[];
  nombre: number;
  vers: string;
  pending: boolean;
  onVers: (id: string) => void;
  onAttribuer: () => void;
}) {
  if (!visible || nombre === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
      <p className="text-[0.875rem]">
        <span className="tabular-nums">{nombre}</span> fiche{nombre > 1 ? 's' : ''} à attribuer à
      </p>
      <Select
        items={items}
        value={vers === TOUS ? null : vers}
        onValueChange={(value) => {
          if (value !== null) onVers(value);
        }}
      >
        <SelectTrigger className="w-56" aria-label="Attribuer les fiches à">
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
      <Button type="button" disabled={vers === TOUS || pending} onClick={onAttribuer}>
        {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        Attribuer
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
  if (pageCount <= 1) return null;

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
