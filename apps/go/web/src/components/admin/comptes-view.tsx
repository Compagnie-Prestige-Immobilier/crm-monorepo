import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { CompteFormDialog } from '@/components/admin/compte-form-dialog';
import { CompteMotDePasseDialog } from '@/components/admin/compte-mot-de-passe-dialog';
import { CompteRepriseDialog } from '@/components/admin/compte-reprise-dialog';
import { ADAPTATEUR_COMPTES, ComptesFiltres } from '@/components/admin/comptes-filtres';
import { PaginationComptes, TableComptes } from '@/components/admin/comptes-tableau';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  activerCompte,
  fetchComptes,
  FILTRES_REPRENEURS,
  supprimerCompte,
  type Compte,
} from '@/lib/data/users';
import { useFiltresUrl } from '@/lib/filtres-url';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

type Geste = 'desactiver' | 'supprimer';

export function ComptesView() {
  const queryClient = useQueryClient();
  const { filtres, setFiltres } = useFiltresUrl(ADAPTATEUR_COMPTES);
  const { data: moi } = useQuery(meQueryOptions);

  const [forme, setForme] = useState<{ compte: Compte | null } | null>(null);
  const [motDePasse, setMotDePasse] = useState<Compte | null>(null);
  const [reprise, setReprise] = useState<{ compte: Compte; geste: Geste } | null>(null);

  const comptes = useQuery({
    queryKey: queryKeys.commerciaux({ ...filtres }),
    queryFn: () => fetchComptes(filtres),
    placeholderData: (precedent) => precedent,
  });

  const repreneurs = useQuery({
    queryKey: queryKeys.commerciaux({ ...FILTRES_REPRENEURS }),
    queryFn: () => fetchComptes(FILTRES_REPRENEURS),
    staleTime: 300_000,
  });

  const rafraichir = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
  };

  const reactiver = useMutation({
    mutationFn: (compte: Compte) => activerCompte(compte.id, true),
    onSuccess: (compte) => {
      rafraichir();
      toast.success(`${compte.fullName} réactivé.`);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le compte n’a pas pu être réactivé.');
    },
  });

  const appliquerReprise = useMutation({
    mutationFn: async (entree: { compte: Compte; geste: Geste; repreneurId?: string }) => {
      if (entree.geste === 'supprimer') {
        await supprimerCompte(entree.compte.id, entree.repreneurId);
        return;
      }
      await activerCompte(entree.compte.id, false, entree.repreneurId);
    },
    onSuccess: (_resultat, entree) => {
      setReprise(null);
      rafraichir();
      toast.success(
        entree.geste === 'supprimer'
          ? `${entree.compte.fullName} supprimé.`
          : `${entree.compte.fullName} désactivé. Ses saisies sont conservées.`,
      );
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le geste n’a pas pu être appliqué.');
    },
  });

  if (comptes.isError) {
    return (
      <QueryErrorState
        error={comptes.error}
        onRetry={() => {
          void comptes.refetch();
        }}
        fallback="La liste des comptes n’a pas pu être chargée."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Comptes de connexion au panneau. Désactiver ferme l’accès sans rien supprimer.
        </p>
        <Button
          type="button"
          onClick={() => {
            setForme({ compte: null });
          }}
        >
          <UserPlusIcon aria-hidden="true" />
          Nouvel utilisateur
        </Button>
      </div>

      <ComptesFiltres filtres={filtres} onChange={setFiltres} />

      {comptes.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <TableComptes
          items={comptes.data.items}
          fraichit={comptes.isFetching}
          moiId={moi?.id}
          enCours={reactiver.isPending || appliquerReprise.isPending}
          onModifier={(compte) => {
            setForme({ compte });
          }}
          onMotDePasse={setMotDePasse}
          onBasculer={(compte) => {
            if (compte.isActive) setReprise({ compte, geste: 'desactiver' });
            else reactiver.mutate(compte);
          }}
          onSupprimer={(compte) => {
            setReprise({ compte, geste: 'supprimer' });
          }}
        />
      )}

      <PaginationComptes
        meta={comptes.data?.meta}
        page={filtres.page}
        onPage={(page) => {
          setFiltres({ page });
        }}
      />

      <DialoguesComptes
        forme={forme}
        motDePasse={motDePasse}
        reprise={reprise}
        repreneurs={repreneurs.data?.items ?? []}
        reprisePending={appliquerReprise.isPending}
        onFermerForme={() => {
          setForme(null);
        }}
        onFermerMotDePasse={() => {
          setMotDePasse(null);
        }}
        onFermerReprise={() => {
          setReprise(null);
        }}
        onConfirmerReprise={(repreneurId) => {
          if (reprise === null) return;
          appliquerReprise.mutate({
            ...reprise,
            ...(repreneurId === undefined ? {} : { repreneurId }),
          });
        }}
      />
    </div>
  );
}

function DialoguesComptes({
  forme,
  motDePasse,
  reprise,
  repreneurs,
  reprisePending,
  onFermerForme,
  onFermerMotDePasse,
  onFermerReprise,
  onConfirmerReprise,
}: {
  forme: { compte: Compte | null } | null;
  motDePasse: Compte | null;
  reprise: { compte: Compte; geste: Geste } | null;
  repreneurs: readonly Compte[];
  reprisePending: boolean;
  onFermerForme: () => void;
  onFermerMotDePasse: () => void;
  onFermerReprise: () => void;
  onConfirmerReprise: (repreneurId?: string) => void;
}) {
  return (
    <>
      {forme === null ? null : (
        <CompteFormDialog
          key={forme.compte?.id ?? 'nouveau'}
          compte={forme.compte}
          open
          onOpenChange={(ouvert) => {
            if (!ouvert) onFermerForme();
          }}
        />
      )}

      {motDePasse === null ? null : (
        <CompteMotDePasseDialog
          key={motDePasse.id}
          compte={motDePasse}
          open
          onOpenChange={(ouvert) => {
            if (!ouvert) onFermerMotDePasse();
          }}
        />
      )}

      {reprise === null ? null : (
        <CompteRepriseDialog
          key={`${reprise.compte.id}-${reprise.geste}`}
          compte={reprise.compte}
          geste={reprise.geste}
          repreneurs={repreneurs.filter((row) => row.id !== reprise.compte.id)}
          pending={reprisePending}
          onOpenChange={(ouvert) => {
            if (!ouvert) onFermerReprise();
          }}
          onConfirm={onConfirmerReprise}
        />
      )}
    </>
  );
}
