'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import {
  famillesDePermissions,
  LignePermission,
  RecherchePermission,
} from '@/components/commerciaux/permissions-liste';
import { QueryErrorInline } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchPermissionsCompte,
  fetchRoles,
  type PermissionCatalogue,
  type PermissionsCompte,
  replacePermissionsCompte,
} from '@/lib/data/roles';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { UserRow } from '@/lib/types';

export function PermissionsCompteDialog({
  user,
  onOpenChange,
}: {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {user === null ? null : (
          <ChargementPermissions
            key={user.id}
            user={user}
            onClose={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChargementPermissions({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const roles = useQuery({ queryKey: queryKeys.roles, queryFn: () => fetchRoles() });
  const compte = useQuery({
    queryKey: ['permissions-compte', user.id],
    queryFn: () => fetchPermissionsCompte(user.id),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Permissions de {user.fullName}</DialogTitle>
        <DialogDescription>
          Celles du rôle {user.roleLibelle} sont cochées d’office. Cochez ce que ce compte reçoit en
          plus.
        </DialogDescription>
      </DialogHeader>
      {roles.isError || compte.isError ? (
        <QueryErrorInline
          error={roles.error ?? compte.error}
          fallback="Les permissions n’ont pas pu être chargées."
        />
      ) : null}
      {roles.isSuccess && compte.isSuccess ? (
        <EditeurPermissionsCompte
          user={user}
          catalogue={roles.data.catalogue}
          permissions={compte.data}
          onClose={onClose}
        />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </>
  );
}

function EditeurPermissionsCompte({
  user,
  catalogue,
  permissions,
  onClose,
}: {
  user: UserRow;
  catalogue: PermissionCatalogue[];
  permissions: PermissionsCompte;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<string[]>(permissions.supplementaires);
  const [recherche, setRecherche] = useState('');

  const enregistrer = useMutation({
    mutationFn: () => replacePermissionsCompte(user.id, brouillon),
    onSuccess: () => {
      toast.success(`Permissions de ${user.fullName} enregistrées.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      void queryClient.invalidateQueries({ queryKey: ['permissions-compte'] });
      void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      onClose();
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  const familles = famillesDePermissions(catalogue, recherche);
  const basculer = (permission: string, coche: boolean): void => {
    setBrouillon((courant) =>
      coche ? [...courant, permission] : courant.filter((p) => p !== permission),
    );
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <RecherchePermission valeur={recherche} onChange={setRecherche} />
        {familles.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucune permission ne correspond. Effacez la recherche.
          </p>
        ) : null}
        {familles.map((famille) => (
          <fieldset key={famille.nom} className="rounded-lg border border-border p-4">
            <legend className="px-1 text-[0.875rem] font-[600]">{famille.nom}</legend>
            <ul className="grid gap-x-6 lg:grid-cols-2">
              {famille.permissions.map((p) => {
                const duRole = permissions.role.includes(p.permission);
                return (
                  <LignePermission
                    key={p.permission}
                    permission={p}
                    titulaire={user.fullName}
                    coche={duRole || brouillon.includes(p.permission)}
                    verrouillee={duRole}
                    marque={duRole ? 'rôle' : null}
                    onChange={basculer}
                  />
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button
          disabled={enregistrer.isPending}
          onClick={() => {
            enregistrer.mutate();
          }}
        >
          {enregistrer.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  );
}
