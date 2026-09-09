import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, CheckIcon, LoaderIcon, PencilIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CarteAppels } from '@/components/campagnes/detail-appels';
import { CartePerformance } from '@/components/campagnes/detail-performance';
import { CarteProgrammes, CarteReaffectations } from '@/components/campagnes/detail-programmes';
import { FichesCampagne } from '@/components/campagnes/fiches';
import { LienTelechargement } from '@/components/exports/liens';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchCampagne,
  modifierCampagne,
  urlClasseurCampagne,
  urlProgrammesCampagne,
} from '@/lib/data/lots-export';
import { formatDate, formatNumber } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';
import { lien } from '@/lib/nav';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

/** Le nom se corrige sur place, sans quitter la campagne. */
function NomModifiable({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [saisie, setSaisie] = useState<string | null>(null);

  const renommage = useMutation({
    mutationFn: (nouveau: string) => modifierCampagne(id, { name: nouveau }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(id) });
      setSaisie(null);
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le nom n’a pas pu être changé.'));
    },
  });

  if (saisie === null) {
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
  }

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
        disabled={saisie.trim().length < 3 || renommage.isPending}
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

export function DetailCampagne({
  id,
  projet,
  /** La direction consulte, elle ne règle rien. */
  peutRegler,
}: {
  id: string;
  projet: Projet;
  peutRegler: boolean;
}) {
  const lot = useQuery({
    queryKey: queryKeys.lotsExportDetail(id),
    queryFn: () => fetchCampagne(id),
  });

  if (lot.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (lot.isError) {
    return (
      <QueryErrorState
        error={lot.error}
        onRetry={() => {
          void lot.refetch();
        }}
        fallback="Cette campagne n’a pas pu être chargée."
      />
    );
  }

  const detail = lot.data;
  const repartition = detail.repartition ?? [];
  const equipe = repartition.length;
  const jours = detail.distribution.jours;

  return (
    <div className="flex flex-col gap-6">
      <Link
        {...lien(`/${projet}/campagnes`)}
        className="inline-flex w-fit items-center gap-1.5 text-[0.875rem] text-muted-foreground hover:underline focus-visible:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Toutes les campagnes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          {peutRegler ? (
            <NomModifiable id={id} name={detail.name} />
          ) : (
            <h2 className="font-display text-h2 font-[800]">{detail.name}</h2>
          )}
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">
            {detail.scopeLabel} ·{' '}
            <span className="tabular-nums">{formatNumber(detail.itemCount)}</span> fiche
            {detail.itemCount > 1 ? 's' : ''} réparties entre{' '}
            <span className="tabular-nums">{formatNumber(equipe)}</span> téléconseiller
            {equipe > 1 ? 's' : ''} sur <span className="tabular-nums">{formatNumber(jours)}</span>{' '}
            jour{jours > 1 ? 's' : ''}, le {formatDate(detail.createdAt)}, par{' '}
            {detail.createdByName}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <LienTelechargement
            href={urlProgrammesCampagne(id)}
            label="Tous les programmes, archive ZIP"
            variant="default"
          >
            Tous les programmes (ZIP)
          </LienTelechargement>
          <LienTelechargement href={urlClasseurCampagne(id)} label="Classeur Excel de la campagne">
            Classeur Excel
          </LienTelechargement>
        </div>
      </div>

      <CarteProgrammes
        id={id}
        repartition={repartition}
        jours={jours}
        fichesParJour={detail.distribution.fichesParJour}
      />

      <CarteReaffectations id={id} reaffectations={detail.reaffectations ?? []} />

      <CartePerformance id={id} lignes={detail.performance ?? []} peutRegler={peutRegler} />

      <FichesCampagne lot={detail} projet={projet} peutReaffecter={peutRegler} />

      <CarteAppels lot={detail} />
    </div>
  );
}
