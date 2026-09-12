'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  CheckIcon,
  FileArchiveIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  UserMinusIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useFileDownload } from '@/components/exports/download-button';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LotExportFiches } from '@/components/lots-export/lot-export-fiches';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  campagnesPath,
  fetchLotExport,
  lotExportFileName,
  lotExportUrl,
  lotFichesRecuesFileName,
  lotFichesRecuesUrl,
  lotProgrammeFileName,
  lotProgrammeUrl,
  retirerTeleconseiller,
  updateLotExport,
  type LotExportDetail,
} from '@/lib/data/lots-export';
import { apiErrorText } from '@/lib/mutation-feedback';
import { formatDate, formatDateTime, formatNumber, formatPhone, formatRate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  REP_CALL_OUTCOME_LABELS,
} from '@/lib/types';

/**
 * L'API rend l'issue brute d'un appel de prospect OU de représentant, dans un
 * même champ de texte : les deux tables de libellés se recouvrent sans se
 * contredire.
 */
const ISSUE_LABELS: Record<string, string> = {
  ...REP_CALL_OUTCOME_LABELS,
  ...CALL_OUTCOME_LABELS,
};

/**
 * `comment` et `rendezVousAt` sont déclarés sans type dans le DTO de l'API : le
 * contrat engendré les rend en objet vide, alors que le serveur envoie du texte.
 */
const texte = (valeur: unknown): string | null =>
  typeof valeur === 'string' && valeur !== '' ? valeur : null;

function rendezVous(valeur: unknown): string {
  const iso = texte(valeur);
  return iso === null ? '' : ` · rendez-vous le ${formatDateTime(iso)}`;
}

function LotSummary({
  id,
  peutRegler,
  name,
  scopeLabel,
  itemCount,
  equipeCount,
  jours,
  createdAt,
  createdByName,
  pausedAt,
}: {
  id: string;
  peutRegler: boolean;
  name: string;
  scopeLabel: string;
  itemCount: number;
  equipeCount: number;
  jours: number;
  createdAt: string;
  createdByName: string;
  pausedAt: string | null;
}) {
  return (
    <div className="max-w-2xl">
      {/* `h2` : la barre du panel porte déjà l'unique `h1` de la page. */}
      {peutRegler ? (
        <NomModifiable id={id} name={name} />
      ) : (
        <h2 className="font-display text-h2 font-[800]">{name}</h2>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pausedAt === null ? null : (
          <Badge variant="warning">En pause depuis le {formatDate(pausedAt)}</Badge>
        )}
        {peutRegler ? <BoutonPause id={id} enPause={pausedAt !== null} /> : null}
      </div>
      <p className="mt-1 text-[0.9375rem] text-muted-foreground">
        {scopeLabel} · <span className="tabular-nums">{formatNumber(itemCount)}</span> fiche
        {itemCount > 1 ? 's' : ''} réparties entre{' '}
        <span className="tabular-nums">{formatNumber(equipeCount)}</span> téléconseiller
        {equipeCount > 1 ? 's' : ''} sur <span className="tabular-nums">{formatNumber(jours)}</span>{' '}
        jour
        {jours > 1 ? 's' : ''}, le {formatDate(createdAt)}, par {createdByName}.
      </p>
    </div>
  );
}

function LotDownloads({
  id,
  name,
  telechargement,
}: {
  id: string;
  name: string;
  telechargement: ReturnType<typeof useFileDownload>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        disabled={telechargement.pending}
        onClick={() => {
          void telechargement.download({
            url: lotExportUrl(id, 'zip'),
            fileName: lotExportFileName(name, 'zip'),
            failureMessage: 'L’archive n’a pas pu être générée.',
          });
        }}
      >
        {telechargement.pending ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileArchiveIcon aria-hidden="true" />
        )}
        Tous les programmes (ZIP)
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={telechargement.pending}
        onClick={() => {
          void telechargement.download({
            url: lotExportUrl(id, 'xlsx'),
            fileName: lotExportFileName(name, 'xlsx'),
            failureMessage: 'Le classeur n’a pas pu être généré.',
          });
        }}
      >
        <FileSpreadsheetIcon aria-hidden="true" />
        Classeur Excel
      </Button>
    </div>
  );
}

function ProgrammesCard({
  repartition,
  colonnes,
  distribution,
  id,
  telechargement,
}: {
  repartition: LotExportDetail['repartition'];
  colonnes: number[];
  distribution: LotExportDetail['distribution'];
  id: string;
  telechargement: ReturnType<typeof useFileDownload>;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Programmes d’appel
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Chacun reçoit son objectif quotidien, réglable plus bas. À défaut,{' '}
          {formatNumber(distribution.fichesParJour)} fiches par jour, dont 20 % pour la supervision
          et la direction. « Reçues » : les fiches arrivées après impression, à imprimer en
          complément.
        </p>
      </CardHeader>
      <CardContent>
        {repartition.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucun téléconseiller n’a reçu de fiche.
          </p>
        ) : (
          <Table aria-label="Programmes d’appel">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Téléconseiller</TableHead>
                {colonnes.map((jour) => (
                  <TableHead key={jour} scope="col" className="text-right">
                    Jour {jour}
                  </TableHead>
                ))}
                <TableHead scope="col" className="text-right">
                  Reçues
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repartition.map((ligne) => (
                <TableRow key={ligne.teleconseillerId}>
                  <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
                    {ligne.teleconseillerName}
                  </th>
                  {colonnes.map((jour) => {
                    const fiches = ligne.jours.find((entree) => entree.jour === jour)?.fiches ?? 0;
                    return (
                      <TableCell key={jour}>
                        <span className="flex items-center justify-end gap-2">
                          <span className="tabular-nums">{formatNumber(fiches)}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Programme de ${ligne.teleconseillerName}, jour ${String(jour)}`}
                            disabled={fiches === 0 || telechargement.pending}
                            onClick={() => {
                              void telechargement.download({
                                url: lotProgrammeUrl(id, ligne.teleconseillerId, jour),
                                fileName: lotProgrammeFileName(ligne.teleconseillerName, jour),
                                failureMessage: `Le programme du jour ${String(jour)} n’a pas pu être généré.`,
                              });
                            }}
                          >
                            <FileDownIcon aria-hidden="true" />
                          </Button>
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <span className="flex items-center justify-end gap-2">
                      <span className="tabular-nums">
                        {ligne.recues > 0 ? `+${formatNumber(ligne.recues)}` : '0'}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Fiches reçues par ${ligne.teleconseillerName}`}
                        disabled={ligne.recues === 0 || telechargement.pending}
                        onClick={() => {
                          void telechargement.download({
                            url: lotFichesRecuesUrl(id, ligne.teleconseillerId),
                            fileName: lotFichesRecuesFileName(ligne.teleconseillerName),
                            failureMessage: 'Les fiches reçues n’ont pas pu être générées.',
                          });
                        }}
                      >
                        <FileDownIcon aria-hidden="true" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ReaffectationsCard({
  id,
  reaffectations,
  telechargement,
}: {
  id: string;
  reaffectations: LotExportDetail['reaffectations'];
  telechargement: ReturnType<typeof useFileDownload>;
}) {
  if (reaffectations.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Réaffectations
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Le PDF d’un mouvement ne reprend que les fiches que le destinataire tient encore.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {reaffectations.map((trace) => (
            <li
              key={trace.id}
              className="flex items-center justify-between gap-3 py-2.5 text-[0.875rem]"
            >
              <span>
                <span className="tabular-nums font-[600]">{formatNumber(trace.fiches)}</span> fiche
                {trace.fiches > 1 ? 's' : ''} de {trace.fromName ?? 'personne'} vers {trace.toName}
                <span className="block text-[0.8125rem] text-muted-foreground">
                  {formatDateTime(trace.createdAt)}, par {trace.performedByName}
                </span>
              </span>
              {trace.fichesEnMain > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={telechargement.pending}
                  onClick={() => {
                    void telechargement.download({
                      url: lotFichesRecuesUrl(id, trace.toTeleconseillerId, trace.id),
                      fileName: lotFichesRecuesFileName(trace.toName),
                      failureMessage: 'Les fiches reçues n’ont pas pu être générées.',
                    });
                  }}
                >
                  <FileDownIcon aria-hidden="true" />
                  PDF
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AppelsCard({
  fichesAppelees,
  itemCount,
  callsSince,
  parTeleconseiller,
  recentAttempts,
}: {
  fichesAppelees: number;
  itemCount: number;
  callsSince: number;
  parTeleconseiller: readonly (readonly [string, number])[];
  recentAttempts: LotExportDetail['recentAttempts'];
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Appels passés sur ces fiches depuis la création
        </h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-[0.9375rem]">
          <span className="tabular-nums">{formatNumber(fichesAppelees)}</span> fiche
          {fichesAppelees > 1 ? 's' : ''} appelée{fichesAppelees > 1 ? 's' : ''} sur{' '}
          <span className="tabular-nums">{formatNumber(itemCount)}</span>,{' '}
          <span className="tabular-nums">{formatNumber(callsSince)}</span> appel
          {callsSince > 1 ? 's' : ''} consigné{callsSince > 1 ? 's' : ''}.
        </p>

        <ParTeleconseillerBlock parTeleconseiller={parTeleconseiller} />
        <RecentAttemptsList recentAttempts={recentAttempts} />
      </CardContent>
    </Card>
  );
}

function ParTeleconseillerBlock({
  parTeleconseiller,
}: {
  parTeleconseiller: readonly (readonly [string, number])[];
}) {
  if (parTeleconseiller.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-[0.8125rem] font-[600] text-muted-foreground">Par téléconseiller</h4>
      <ul className="flex flex-wrap gap-2">
        {parTeleconseiller.map(([nom, nombre]) => (
          <li key={nom}>
            <Badge variant="outline">
              {nom} : {formatNumber(nombre)}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentAttemptsList({
  recentAttempts,
}: {
  recentAttempts: LotExportDetail['recentAttempts'];
}) {
  if (recentAttempts.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucun appel consigné depuis la création.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {recentAttempts.map((tentative) => (
        <li key={tentative.id} className="flex flex-col gap-1 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {ISSUE_LABELS[tentative.outcome] ?? tentative.outcome}
            </Badge>
            <span className="font-[600]">{tentative.shortCode}</span>
            <span className="text-[0.8125rem] text-muted-foreground tabular-nums">
              {formatPhone(tentative.phoneE164)}
            </span>
            {tentative.method === null ? null : (
              <span className="text-[0.8125rem] text-muted-foreground">
                {ENROLLMENT_METHOD_LABELS[tentative.method]}
              </span>
            )}
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">
            {formatDateTime(tentative.createdAt)}, par {tentative.performedByName}
            {rendezVous(tentative.rendezVousAt)}
          </p>
          {texte(tentative.comment) === null ? null : (
            <p className="text-[0.875rem]">{texte(tentative.comment)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function LotExportDetailView({
  id,
  peutRegler,
}: {
  id: string;
  /** EB-15 et EB-16 : la direction consulte, elle ne règle rien. */
  peutRegler: boolean;
}) {
  const telechargement = useFileDownload();
  const lot = useQuery({
    queryKey: queryKeys.lotsExportDetail(id),
    queryFn: () => fetchLotExport(id),
  });

  if (lot.isPending)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );

  if (lot.isError)
    return (
      <QueryErrorState
        error={lot.error}
        onRetry={() => {
          void lot.refetch();
        }}
        fallback="Cette campagne n’a pas pu être chargée."
      />
    );

  const {
    name,
    projet,
    scopeLabel,
    itemCount,
    createdAt,
    createdByName,
    callsSince,
    fichesAppelees,
    distribution,
    repartition,
  } = lot.data;
  const parTeleconseiller = Object.entries(lot.data.callsByTeleconseiller).sort(
    (a, b) => b[1] - a[1],
  );
  const colonnes = Array.from({ length: distribution.jours }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={campagnesPath(projet)}
        className="inline-flex w-fit items-center gap-1.5 text-[0.875rem] text-muted-foreground hover:underline focus-visible:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Toutes les campagnes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <LotSummary
          id={id}
          peutRegler={peutRegler}
          name={name}
          scopeLabel={scopeLabel}
          itemCount={itemCount}
          equipeCount={repartition.length}
          jours={distribution.jours}
          createdAt={createdAt}
          createdByName={createdByName}
          pausedAt={lot.data.pausedAt}
        />
        <LotDownloads id={id} name={name} telechargement={telechargement} />
      </div>

      <ProgrammesCard
        repartition={repartition}
        colonnes={colonnes}
        distribution={distribution}
        id={id}
        telechargement={telechargement}
      />

      <ReaffectationsCard
        id={id}
        reaffectations={lot.data.reaffectations}
        telechargement={telechargement}
      />

      <CartePerformance id={id} lot={lot.data} peutRegler={peutRegler} />

      <LotExportFiches lot={lot.data} peutReaffecter={peutRegler} />

      <AppelsCard
        fichesAppelees={fichesAppelees}
        itemCount={itemCount}
        callsSince={callsSince}
        parTeleconseiller={parTeleconseiller}
        recentAttempts={lot.data.recentAttempts}
      />
    </div>
  );
}

/** En pause, les fiches sortent des consoles des téléconseillers jusqu'à la reprise. */
function BoutonPause({ id, enPause }: { id: string; enPause: boolean }) {
  const queryClient = useQueryClient();
  const bascule = useMutation({
    mutationFn: () => updateLotExport(id, { enPause: !enPause }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      toast.success(enPause ? 'Campagne reprise.' : 'Campagne mise en pause.');
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'La campagne n’a pas changé d’état.'));
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={bascule.isPending}
      onClick={() => {
        bascule.mutate();
      }}
    >
      {enPause ? (
        <PlayIcon className="size-4" aria-hidden="true" />
      ) : (
        <PauseIcon className="size-4" aria-hidden="true" />
      )}
      {enPause ? 'Reprendre' : 'Mettre en pause'}
    </Button>
  );
}

/** EB-14 : le nom se corrige sur place, sans quitter la campagne. */
function NomModifiable({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [saisie, setSaisie] = useState<string | null>(null);

  const renommage = useMutation({
    mutationFn: (nouveau: string) => updateLotExport(id, { name: nouveau }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(id) });
      setSaisie(null);
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le nom n’a pas pu être changé.'));
    },
  });

  if (saisie === null)
    return (
      <div className="flex items-center gap-2">
        <h2 className="font-display text-h2 font-[800]">{name}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Renommer la campagne"
          onClick={() => {
            setSaisie(name);
          }}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );

  const valide = saisie.trim().length >= 3;
  return (
    <div className="flex items-center gap-2">
      <Input
        maxLength={120}
        aria-label="Nom de la campagne"
        value={saisie}
        onChange={(event) => {
          setSaisie(event.target.value);
        }}
      />
      <Button
        type="button"
        size="icon"
        aria-label="Enregistrer le nom"
        disabled={!valide || renommage.isPending}
        onClick={() => {
          renommage.mutate(saisie.trim());
        }}
      >
        {renommage.isPending ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckIcon className="size-4" aria-hidden="true" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Abandonner le renommage"
        onClick={() => {
          setSaisie(null);
        }}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * EB-17 : l'objectif quotidien d'un téléconseiller.
 *
 * L'API remplace la table entière des objectifs : le PATCH renvoie donc TOUS
 * ceux de la campagne, sans quoi régler l'un effacerait les autres.
 */
function ChampObjectif({
  id,
  lot,
  ligne,
}: {
  id: string;
  lot: LotExportDetail;
  ligne: LotExportDetail['performance'][number];
}) {
  const queryClient = useQueryClient();
  const [saisie, setSaisie] = useState(String(ligne.objectif));

  const reglage = useMutation({
    mutationFn: (valeur: number) =>
      updateLotExport(id, {
        objectifs: lot.performance.map((autre) => ({
          teleconseillerId: autre.teleconseillerId,
          fichesParJour:
            autre.teleconseillerId === ligne.teleconseillerId ? valeur : autre.objectif,
        })),
      }),
    onSuccess: (_summary, valeur) => {
      setSaisie(String(valeur));
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(id) });
      toast.success('Objectif enregistré.');
    },
    onError: (erreur) => {
      setSaisie(String(ligne.objectif));
      toast.error(apiErrorText(erreur, 'L’objectif n’a pas pu être enregistré.'));
    },
  });

  return (
    <Input
      type="number"
      min={1}
      max={500}
      step={1}
      className="ml-auto h-9 w-20 text-right tabular-nums"
      aria-label={`Objectif quotidien de ${ligne.teleconseillerName}`}
      value={saisie}
      disabled={reglage.isPending}
      onChange={(event) => {
        setSaisie(event.target.value);
      }}
      onBlur={() => {
        const valeur = Number.parseInt(saisie, 10);
        if (!Number.isFinite(valeur) || valeur < 1 || valeur === ligne.objectif) {
          setSaisie(String(ligne.objectif));
          return;
        }
        reglage.mutate(Math.min(500, valeur));
      }}
    />
  );
}

/** EB-16 : le retiré rend ses fiches non traitées au reste de l'équipe. */
function BoutonRetrait({
  id,
  ligne,
  seul,
}: {
  id: string;
  ligne: LotExportDetail['performance'][number];
  seul: boolean;
}) {
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);

  const retrait = useMutation({
    mutationFn: () => retirerTeleconseiller(id, ligne.teleconseillerId),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.lotsExportDetail(id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(id) });
      setOuvert(false);
      toast.success(`${ligne.teleconseillerName} a été retiré de la campagne.`);
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le retrait a échoué.'));
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={seul}
        aria-label={`Retirer ${ligne.teleconseillerName} de la campagne`}
        onClick={() => {
          setOuvert(true);
        }}
      >
        <UserMinusIcon className="size-4" aria-hidden="true" />
      </Button>
      <ConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={`Retirer ${ligne.teleconseillerName} ?`}
        description="Ses fiches non traitées repartent au reste de l’équipe. Les fiches qu’il a déjà appelées lui restent."
        confirmLabel="Retirer"
        pending={retrait.isPending}
        onConfirm={() => {
          retrait.mutate();
        }}
      />
    </>
  );
}

function CartePerformance({
  id,
  lot,
  peutRegler,
}: {
  id: string;
  lot: LotExportDetail;
  peutRegler: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Performance de la campagne
        </h3>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Une fiche est traitée quand la personne assignée y consigne au moins un appel. Un appel
          hors attribution vise une fiche confiée à un collègue dans cette campagne.
        </p>
      </CardHeader>
      <CardContent>
        <Table aria-label="Performance de la campagne">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Téléconseiller</TableHead>
              <TableHead scope="col" className="text-right">
                Objectif par jour
              </TableHead>
              <TableHead scope="col" className="text-right">
                Traitées
              </TableHead>
              <TableHead scope="col" className="text-right">
                Couverture
              </TableHead>
              <TableHead scope="col" className="text-right">
                Appels attribués
              </TableHead>
              <TableHead scope="col" className="text-right">
                Hors attribution
              </TableHead>
              {peutRegler ? (
                <TableHead scope="col" className="text-right">
                  <span className="sr-only">Retirer de la campagne</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lot.performance.map((ligne) => (
              <TableRow key={ligne.teleconseillerId}>
                <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
                  {ligne.teleconseillerName}
                </th>
                <TableCell className="text-right tabular-nums">
                  {peutRegler ? (
                    <ChampObjectif id={id} lot={lot} ligne={ligne} />
                  ) : (
                    formatNumber(ligne.objectif)
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ligne.treated)} sur {formatNumber(ligne.assigned)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRate(ligne.completionRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ligne.assignedCalls)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {ligne.outsideAssignmentCalls === 0 ? (
                    '0'
                  ) : (
                    <Badge variant="outline" className="border-warning/40 text-warning">
                      {formatNumber(ligne.outsideAssignmentCalls)}
                    </Badge>
                  )}
                </TableCell>
                {peutRegler ? (
                  <TableCell className="text-right">
                    <BoutonRetrait id={id} ligne={ligne} seul={lot.performance.length < 2} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
