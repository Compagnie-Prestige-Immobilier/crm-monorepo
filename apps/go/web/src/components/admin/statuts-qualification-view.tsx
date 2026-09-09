import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatutFormDialog } from '@/components/admin/statut-form-dialog';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
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
import {
  activerStatut,
  estAbouti,
  fetchStatutsAdministration,
  LIBELLES_EFFET_STATUT,
  LIBELLES_PRIORITE,
  LIBELLES_RELATION,
  type StatutQualification,
} from '@/lib/data/statuts-qualification';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function saisieExigee(statut: StatutQualification): string {
  const exigences = [
    statut.requiresComment ? 'commentaire' : null,
    statut.requiresCallback ? 'date de rappel' : null,
  ].filter((valeur) => valeur !== null);
  return exigences.length === 0 ? '–' : exigences.join(', ');
}

export function StatutsQualificationView() {
  const queryClient = useQueryClient();
  const [edite, setEdite] = useState<StatutQualification | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const statuts = useQuery({
    queryKey: queryKeys.statutsQualificationAdmin,
    queryFn: fetchStatutsAdministration,
  });

  const activation = useMutation({
    mutationFn: (statut: StatutQualification) => activerStatut(statut.id, !statut.isActive),
    onSuccess: (statut) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(statut.isActive ? `${statut.label} réactivé.` : `${statut.label} retiré.`);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le statut n’a pas pu être modifié.');
    },
  });

  if (statuts.isError) {
    return (
      <QueryErrorState
        error={statuts.error}
        onRetry={() => {
          void statuts.refetch();
        }}
        fallback="Les statuts n’ont pas pu être chargés."
      />
    );
  }

  const lignes = statuts.data ?? [];
  const ouvrir = (statut: StatutQualification | null): void => {
    setEdite(statut);
    setOuvert(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-[0.9375rem] text-muted-foreground">
          Ce que le téléconseiller choisit après avoir dit si l’appel a abouti. L’effet décide de la
          branche où le statut se propose et de l’issue enregistrée.
        </p>
        <Button
          type="button"
          onClick={() => {
            ouvrir(null);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau statut
        </Button>
      </div>

      {statuts.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Branche
            titre="Appel abouti"
            statuts={lignes.filter((statut) => estAbouti(statut.effect))}
            enCours={activation.isPending}
            onModifier={ouvrir}
            onBasculer={(statut) => {
              activation.mutate(statut);
            }}
          />
          <Branche
            titre="Appel non abouti"
            statuts={lignes.filter((statut) => !estAbouti(statut.effect))}
            enCours={activation.isPending}
            onModifier={ouvrir}
            onBasculer={(statut) => {
              activation.mutate(statut);
            }}
          />
        </>
      )}

      {ouvert ? (
        <StatutFormDialog
          key={edite?.id ?? 'nouveau'}
          statut={edite}
          open={ouvert}
          onOpenChange={setOuvert}
        />
      ) : null}
    </div>
  );
}

function Branche({
  titre,
  statuts,
  enCours,
  onModifier,
  onBasculer,
}: {
  titre: string;
  statuts: readonly StatutQualification[];
  enCours: boolean;
  onModifier: (statut: StatutQualification) => void;
  onBasculer: (statut: StatutQualification) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[0.75rem] font-[700] tracking-wide text-muted-foreground uppercase">
        {titre}
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Libellé</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Effet</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Décision</TableHead>
              <TableHead>Saisie exigée</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuts.map((statut) => (
              <TableRow key={statut.id}>
                <TableCell className="font-[600]">
                  {statut.label}
                  {statut.isActive ? null : (
                    <Badge variant="destructive" className="ml-2">
                      Retiré
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-[0.8125rem]">{statut.code}</TableCell>
                <TableCell>{LIBELLES_EFFET_STATUT[statut.effect]}</TableCell>
                <TableCell>{LIBELLES_PRIORITE[statut.priorite]}</TableCell>
                <TableCell>{LIBELLES_RELATION[statut.relationStatus ?? 'INCONNU']}</TableCell>
                <TableCell className="text-[0.8125rem] text-muted-foreground">
                  {saisieExigee(statut)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Modifier ${statut.label}`}
                    onClick={() => {
                      onModifier(statut);
                    }}
                  >
                    <PencilIcon className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={enCours || statut.isSystem}
                    aria-label={
                      statut.isActive ? `Retirer ${statut.label}` : `Réactiver ${statut.label}`
                    }
                    onClick={() => {
                      onBasculer(statut);
                    }}
                  >
                    {statut.isActive ? (
                      <PowerOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <PowerIcon className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
