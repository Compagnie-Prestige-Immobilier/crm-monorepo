import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ReferentielFormDialog } from '@/components/admin/referentiel-form-dialog';
import { valeurAffichee, type ListeReferentiel } from '@/components/admin/referentiels-listes';
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
  fetchReferentiel,
  modifierEntreeReferentiel,
  type ReferentielItem,
} from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function sansAccent(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function correspond(item: ReferentielItem, recherche: string): boolean {
  const cible = sansAccent(recherche.trim());
  if (cible === '') return true;
  return [item.code, item.label, item.name, item.shortName, item.sigle].some(
    (champ) => champ !== null && sansAccent(champ).includes(cible),
  );
}

export function TableauListe({ liste, recherche }: { liste: ListeReferentiel; recherche: string }) {
  const queryClient = useQueryClient();
  const [edite, setEdite] = useState<ReferentielItem | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const entrees = useQuery({
    queryKey: [...queryKeys.referentielsRoot, liste.kind, 'administration'],
    queryFn: () => fetchReferentiel(liste.kind, false),
  });

  const activation = useMutation({
    mutationFn: (item: ReferentielItem) =>
      modifierEntreeReferentiel(liste.kind, item.id, { isActive: item.isActive !== true }),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(item.isActive === true ? 'Entrée remise en service.' : 'Entrée retirée.');
    },
    onError: (erreur) => {
      toastApiError(erreur, 'L’état n’a pas pu être changé.');
    },
  });

  if (entrees.isPending) return <Skeleton className="h-64 w-full" />;
  if (entrees.isError) {
    return (
      <QueryErrorState
        error={entrees.error}
        onRetry={() => {
          void entrees.refetch();
        }}
        fallback="Cette liste n’a pas pu être chargée."
      />
    );
  }

  const colonnes = [
    ...liste.champs.map((champ) => ({ nom: champ.nom, libelle: champ.libelle })),
    ...(liste.lues ?? []),
  ];
  const lignes = entrees.data.filter((item) => correspond(item, recherche));

  return (
    <div className="flex flex-col gap-4">
      {liste.lectureSeule === true ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Liste servie par le serveur. Elle se consulte, elle ne se modifie pas ici.
        </p>
      ) : (
        <Button
          type="button"
          className="self-start"
          onClick={() => {
            setEdite(null);
            setOuvert(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          {liste.nouveau}
        </Button>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {colonnes.map((colonne) => (
                <TableHead key={colonne.nom}>{colonne.libelle}</TableHead>
              ))}
              <TableHead>État</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colonnes.length + 2} className="py-12 text-center">
                  <p className="font-[600]">Aucune entrée ne correspond.</p>
                  <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                    {liste.lectureSeule === true
                      ? 'Élargissez la recherche.'
                      : 'Élargissez la recherche, ou ajoutez une entrée.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              lignes.map((item) => (
                <TableRow key={item.id}>
                  {colonnes.map((colonne) => (
                    <TableCell key={colonne.nom}>{valeurAffichee(item, colonne.nom)}</TableCell>
                  ))}
                  <TableCell>
                    {item.isActive === false ? (
                      <Badge variant="destructive">Retirée</Badge>
                    ) : (
                      <Badge variant="secondary">En service</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {liste.lectureSeule === true ? null : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Modifier ${valeurAffichee(item, 'label')}`}
                          onClick={() => {
                            setEdite(item);
                            setOuvert(true);
                          }}
                        >
                          <PencilIcon className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={activation.isPending}
                          aria-label={
                            item.isActive === false ? 'Remettre en service' : 'Retirer du service'
                          }
                          onClick={() => {
                            activation.mutate(item);
                          }}
                        >
                          {item.isActive === false ? (
                            <PowerIcon className="size-4" aria-hidden="true" />
                          ) : (
                            <PowerOffIcon className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {ouvert ? (
        <ReferentielFormDialog
          key={edite?.id ?? 'nouveau'}
          liste={liste}
          item={edite}
          open={ouvert}
          onOpenChange={setOuvert}
        />
      ) : null}
    </div>
  );
}
