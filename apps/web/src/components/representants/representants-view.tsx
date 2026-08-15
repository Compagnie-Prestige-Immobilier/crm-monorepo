'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  UploadIcon,
  UsersRoundIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useFileDownload } from '@/components/exports/download-button';
import { QueryErrorState } from '@/components/query-error-state';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { RepresentantsFiltersBar } from '@/components/representants/representants-filters-bar';
import { useRepresentantFilters } from '@/components/representants/use-representant-filters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchRepresentants } from '@/lib/data/representants';
import {
  buildRepresentantsExportUrl,
  representantsExportFileName,
} from '@/lib/data/representants-import';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { countActiveRepresentantFilters } from '@/lib/representant-filters';
import type { RepresentantRow } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Représentants : les personnes rencontrées sur le terrain qui remettent les
 * listes de prospects.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'écran n'est plus en lecture seule, et la nuance compte.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une fiche naît normalement sur le mobile, en tournée, face à la personne : le
 * numéro de téléphone sert de clé de déduplication, et il se vérifie de vive
 * voix. Cela reste le parcours principal. Mais il n'existait AUCUNE issue pour
 * l'exception : corriger une faute depuis le siège, saisir une fiche remontée
 * par téléphone, ou reprendre les milliers de lignes d'un partenaire. Le
 * dialogue de saisie et l'import de masse couvrent ces cas-là, avec le même
 * contrôle d'unicité qu'au mobile.
 *
 * La colonne « Prospects » reste l'information centrale : c'est elle qui dit si
 * une fiche compte.
 *
 * Les critères vivent dans l'URL (`useRepresentantFilters`), comme sur les
 * prospects et les dossiers : « les représentants de Ziguinchor sans aucun
 * prospect » est un lien, pas un état perdu au rechargement. L'export part
 * exactement de ces critères.
 */
export function RepresentantsView() {
  const { filters, setFilters } = useRepresentantFilters();
  const exporter = useFileDownload();
  const [editing, setEditing] = useState<{ representant: RepresentantRow | null } | null>(null);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.representants(filters),
    queryFn: () => fetchRepresentants(filters),
    placeholderData: (previous) => previous,
  });

  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageCount = data?.pageCount ?? 1;
  const first = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const last = Math.min(page * filters.pageSize, total);
  const activeFilterCount = countActiveRepresentantFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Personnes qui remettent les listes de prospects. Les fiches naissent en tournée, sur
          l’application mobile ; la saisie et l’import ci-contre couvrent les exceptions.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              setEditing({ representant: null });
            }}
          >
            <PlusIcon aria-hidden="true" />
            Nouveau représentant
          </Button>

          <Button asChild variant="outline">
            <Link href="/representants/import">
              <UploadIcon aria-hidden="true" />
              Import Excel
            </Link>
          </Button>

          {/* L'export part des filtres de l'URL, pas de la page affichée :
              celui qui envoie le fichier doit pouvoir jurer qu'il contient ce
              qu'il avait sous les yeux. */}
          <Button
            type="button"
            variant="outline"
            disabled={exporter.pending || total === 0}
            onClick={() => {
              void exporter.download({
                url: buildRepresentantsExportUrl(filters),
                fileName: representantsExportFileName(),
                failureMessage: 'L’export n’a pas pu être généré.',
              });
            }}
          >
            {exporter.pending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheetIcon aria-hidden="true" />
            )}
            Exporter
          </Button>
        </div>
      </div>

      <RepresentantsFiltersBar />

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Liste des représentants non chargée."
        />
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
            isFetching && 'opacity-80',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Représentant</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>IEF</TableHead>
                <TableHead>Saisi par</TableHead>
                <TableHead className="text-right">Prospects</TableHead>
                <TableHead>Première saisie</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="py-16">
                    {/*
                      Deux vides, deux messages : et la distinction n'est pas
                      cosmétique.

                      Ce bloc disait toujours « Aucun représentant ne correspond
                      à ces critères. Élargissez la recherche ou retirez un
                      filtre. », y compris sans le moindre critère posé. Une
                      installation neuve, ou un compte qui ouvre l'écran pour la
                      première fois, se voyait donc renvoyé retirer des filtres
                      qu'il n'avait jamais mis : il cherchait, ne trouvait rien à
                      retirer, et concluait à une panne. Les campagnes, les
                      dossiers et les demandes clients branchent déjà sur leur
                      compteur de filtres actifs.
                    */}
                    <div className="flex flex-col items-center gap-2 text-center">
                      <UsersRoundIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                      <p className="font-[600]">
                        {activeFilterCount === 0
                          ? 'Aucun représentant enregistré.'
                          : 'Aucun représentant ne correspond à ces critères.'}
                      </p>
                      <p className="text-[0.8125rem] text-muted-foreground">
                        {activeFilterCount === 0
                          ? 'Les fiches sont saisies en tournée depuis le mobile, ou créées ici, une par une ou par import d’un classeur.'
                          : 'Élargissez la recherche ou retirez un filtre.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((representant) => (
                  <TableRow key={representant.id}>
                    <TableCell className="font-[600]">{representant.fullName}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatPhone(representant.phoneE164)}
                    </TableCell>
                    <TableCell>{representant.departementName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {/* Un tiret cadratin, et non « : aucune » : les fiches
                          saisies avant l'arrivée du référentiel n'en portent
                          pas, et ce n'est pas une anomalie à commenter. */}
                      {representant.iefName ?? '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {representant.createdByName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(representant.prospectCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(representant.clientCreatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        // Le nom est DANS l'intitulé : « Modifier » répété sur
                        // vingt-cinq lignes ne distingue rien pour qui parcourt
                        // la page au lecteur d'écran.
                        aria-label={`Modifier la fiche de ${representant.fullName}`}
                        onClick={() => {
                          setEditing({ representant });
                        }}
                      >
                        <PencilIcon className="size-4" aria-hidden="true" />
                        <span aria-hidden="true">Modifier</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/*
        Le pied de tableau n'existe QUE sur la branche chargée.

        Auparavant il vivait hors du ternaire d'état : pendant la première
        requête `total` vaut 0, et la région live annonçait donc « Aucun
        résultat » par-dessus le squelette : puis de nouveau par-dessus la carte
        d'erreur, qu'elle contredisait. La pagination affichait « 1 / 1 » dans
        les deux cas.
      */}
      {isPending || isError ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/*
          L'intitulé est DONNÉ EN TEXTE (`sr-only`), pas en `aria-label` :
          `aria-label` est interdit sur un `<p>` (rôle `paragraph`, liste « name
          prohibited » d'ARIA 1.2), et là où un lecteur d'écran l'honore quand
          même, le nom REMPLACE le contenu annoncé : l'utilisateur entendrait
          l'intitulé au lieu du décompte. Le préfixe suffit à distinguer cette
          région de celle du Toaster. `role="status"` implique déjà
          `aria-live="polite"`.
        */}
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            <span className="sr-only">Représentants affichés&nbsp;: </span>
            {total === 0
              ? 'Aucun résultat'
              : `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Page précédente"
              disabled={page <= 1}
              onClick={() => {
                setFilters({ page: page - 1 });
              }}
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Button>
            <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Page suivante"
              disabled={page >= pageCount}
              onClick={() => {
                setFilters({ page: page + 1 });
              }}
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      <RepresentantFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        representant={editing?.representant ?? null}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <div className="flex h-11 items-center gap-4 border-b border-border px-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <Skeleton key={cell} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
