'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BarreSelection, FiltresComptes } from '@/components/commerciaux/commerciaux-filtres';
import {
  type ActionsCompte,
  CommerciauxTable,
  CommerciauxTableSkeleton,
} from '@/components/commerciaux/commerciaux-table';
import { DeactivateUserDialog } from '@/components/commerciaux/deactivate-user-dialog';
import { DeleteUsersDialog } from '@/components/commerciaux/delete-users-dialog';
import { PasswordDialog } from '@/components/commerciaux/password-dialog';
import { useUserFilters } from '@/components/commerciaux/use-user-filters';
import { UserFormDialog } from '@/components/commerciaux/user-form-dialog';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { deleteUser, fetchUsers, setUserActive } from '@/lib/data/users';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { UserRow } from '@/lib/types';
import { EMPTY_USER_FILTERS, type UserFilters } from '@/lib/user-filters';
import { cn } from '@/lib/utils';

/** Repreneurs possibles : l'API n'accepte qu'un téléconseiller actif. */
const REPRENEURS: UserFilters = {
  ...EMPTY_USER_FILTERS,
  role: 'COMMERCIAL',
  isActive: true,
  pageSize: 200,
};

const avecRepreneur = (handoverToId: string | undefined) =>
  handoverToId === undefined ? {} : { handoverToId };

export function CommerciauxView({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUserFilters();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | undefined>(undefined);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [deactivating, setDeactivating] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow[]>([]);

  const liste = useQuery({
    queryKey: queryKeys.commerciaux(filters),
    queryFn: () => fetchUsers(filters),
    placeholderData: (previous) => previous,
  });
  const repreneurs = useQuery({
    queryKey: queryKeys.commerciaux(REPRENEURS),
    queryFn: () => fetchUsers(REPRENEURS),
    staleTime: 300_000,
    select: (page) => page.items,
  });

  const rafraichir = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
  };

  const toggleActive = useMutation({
    mutationFn: (v: { user: UserRow; isActive: boolean; handoverToId?: string | undefined }) =>
      setUserActive(v.user.id, v.isActive, v.handoverToId),
    onMutate: async ({ user, isActive }) => {
      const cle = queryKeys.commerciaux(filters);
      await queryClient.cancelQueries({ queryKey: cle });
      const previous = queryClient.getQueryData(cle);
      queryClient.setQueryData(cle, (current: { items: UserRow[] } | undefined) =>
        current === undefined
          ? current
          : {
              ...current,
              items: current.items.map((row) => (row.id === user.id ? { ...row, isActive } : row)),
            },
      );
      return { previous };
    },
    onSuccess: (saved) => {
      setDeactivating(null);
      toast.success(
        saved.isActive
          ? `${saved.fullName} réactivé.`
          : `${saved.fullName} désactivé. Ses prospects et représentants sont conservés.`,
      );
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.commerciaux(filters), context.previous);
      }
      toastApiError(error, "Changement d'état impossible. Réessayez.");
    },
    onSettled: rafraichir,
  });

  const remove = useMutation({
    // Séquentiel : chaque suppression transfère le portefeuille au repreneur.
    mutationFn: async (v: { users: UserRow[]; handoverToId?: string | undefined }) => {
      for (const user of v.users) await deleteUser(user.id, v.handoverToId);
      return v.users;
    },
    onSuccess: (supprimes) => {
      setDeleting([]);
      setSelectedIds([]);
      toast.success(
        supprimes.length === 1
          ? `${supprimes[0]?.fullName ?? 'Compte'} supprimé.`
          : `${formatNumber(supprimes.length)} comptes supprimés.`,
      );
    },
    onError: (error) => {
      toastApiError(error, 'Suppression impossible. Réessayez.');
    },
    onSettled: rafraichir,
  });

  const selection = (liste.data?.items ?? []).filter((row) => selectedIds.includes(row.id));
  const actions: ActionsCompte = {
    onEdit: (user) => {
      setEditing(user);
      setFormOpen(true);
    },
    onResetPassword: setPasswordTarget,
    onToggleActive: (user) => {
      if (user.isActive) setDeactivating(user);
      else toggleActive.mutate({ user, isActive: true });
    },
    onDelete: (user) => {
      setDeleting([user]);
    },
    togglePending: toggleActive.isPending,
    removePending: remove.isPending,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Comptes de connexion au panneau. Désactiver ferme l’accès, sans rien supprimer.
        </p>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <UserPlusIcon aria-hidden="true" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Une sélection qui survit à un filtre supprimerait des comptes que l'écran ne montre plus. */}
      <FiltresComptes
        filters={filters}
        onChange={(patch) => {
          setSelectedIds([]);
          setFilters(patch);
        }}
      />
      <BarreSelection
        nombre={selection.length}
        pending={remove.isPending}
        onClear={() => {
          setSelectedIds([]);
        }}
        onDelete={() => {
          setDeleting(selection);
        }}
      />

      {liste.isPending ? <CommerciauxTableSkeleton /> : null}
      {liste.isError ? (
        <QueryErrorState
          error={liste.error}
          onRetry={() => {
            void liste.refetch();
          }}
          fallback="La liste des comptes n’a pas pu être chargée."
        />
      ) : null}
      {liste.isSuccess ? (
        <div
          className={cn(
            'overflow-x-auto rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
            liste.isFetching && 'opacity-80',
          )}
        >
          <CommerciauxTable
            users={liste.data.items}
            currentUserId={currentUserId}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            actions={actions}
          />
        </div>
      ) : null}

      <DeactivateUserDialog
        user={deactivating}
        repreneurs={repreneurs.data ?? []}
        pending={toggleActive.isPending}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        onConfirm={(handoverToId) => {
          if (deactivating === null) return;
          toggleActive.mutate({
            user: deactivating,
            isActive: false,
            ...avecRepreneur(handoverToId),
          });
        }}
      />
      <DeleteUsersDialog
        users={deleting}
        repreneurs={repreneurs.data ?? []}
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleting([]);
        }}
        onConfirm={(handoverToId) => {
          remove.mutate({ users: deleting, ...avecRepreneur(handoverToId) });
        }}
      />
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        currentUserId={currentUserId}
      />
      <PasswordDialog
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPasswordTarget(null);
        }}
        user={passwordTarget}
      />
    </div>
  );
}
