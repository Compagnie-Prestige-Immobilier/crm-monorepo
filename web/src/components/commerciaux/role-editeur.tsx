'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, MoreHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { AIDE_PERMISSIONS } from '@/components/commerciaux/permissions-aide';
import { RoleDialog } from '@/components/commerciaux/role-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InfoPopover } from '@/components/ui/info-popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deleteRole,
  type PermissionCatalogue,
  replacePermissions,
  type RoleCompte,
} from '@/lib/data/roles';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { type Permission, ROLE_LABELS } from '@/lib/types';

/** ADMIN garde toujours de quoi réparer : le serveur refuse de les lui retirer. */
const VERROUILLEES_ADMIN = ['comptes.administrer', 'roles.administrer'];

const memes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((p) => b.includes(p));

function parDefaut(
  role: RoleCompte,
  roles: RoleCompte[],
  catalogue: PermissionCatalogue[],
): string[] {
  if (role.systeme) {
    return catalogue.filter((p) => p.parDefaut.includes(role.roleDeBase)).map((p) => p.permission);
  }
  return roles.find((r) => r.id === role.roleDeBase)?.permissions ?? [];
}

export function EditeurRole({
  role,
  roles,
  catalogue,
  sonRole,
  onSupprime,
}: {
  role: RoleCompte;
  roles: RoleCompte[];
  catalogue: PermissionCatalogue[];
  sonRole: boolean;
  onSupprime: () => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<string[]>(role.permissions);
  const [confirmation, setConfirmation] = useState(false);

  const enregistrer = useMutation({
    mutationFn: () => replacePermissions(role.id, brouillon),
    onSuccess: () => {
      setConfirmation(false);
      toast.success(`Permissions de ${role.libelle} enregistrées.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
    },
    onError: (error) => {
      setConfirmation(false);
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  const domaines = [...new Set(catalogue.map((p) => p.domaine))];
  const modifie = !memes(brouillon, role.permissions);
  const basculer = (permission: string, coche: boolean): void => {
    setBrouillon((courant) =>
      coche ? [...courant, permission] : courant.filter((p) => p !== permission),
    );
  };

  return (
    <section aria-label={`Permissions de ${role.libelle}`} className="flex flex-col gap-4">
      <EnteteRole role={role} roles={roles} onSupprime={onSupprime} />

      {domaines.map((domaine) => (
        <fieldset
          key={domaine}
          className="rounded-lg border border-border bg-card p-4 shadow-elev-sm"
        >
          <legend className="px-1 text-[0.875rem] font-[600]">{domaine}</legend>
          <ul className="flex flex-col">
            {catalogue
              .filter((p) => p.domaine === domaine)
              .map((p) => (
                <LignePermission
                  key={p.permission}
                  permission={p}
                  role={role}
                  coche={brouillon.includes(p.permission)}
                  onChange={basculer}
                />
              ))}
          </ul>
        </fieldset>
      ))}

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background py-3">
        <Button
          variant="ghost"
          onClick={() => {
            setBrouillon(parDefaut(role, roles, catalogue));
          }}
        >
          Rétablir les valeurs par défaut
        </Button>
        <Button
          variant="outline"
          disabled={!modifie}
          onClick={() => {
            setBrouillon(role.permissions);
          }}
        >
          Annuler
        </Button>
        <Button
          disabled={!modifie || enregistrer.isPending}
          onClick={() => {
            if (sonRole) setConfirmation(true);
            else enregistrer.mutate();
          }}
        >
          {enregistrer.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Enregistrer
        </Button>
      </div>

      <ConfirmDialog
        open={confirmation}
        onOpenChange={setConfirmation}
        title="Modifier votre propre rôle ?"
        description="Vos accès changent dès la prochaine action."
        confirmLabel="Enregistrer"
        confirmVariant="default"
        pending={enregistrer.isPending}
        onConfirm={() => {
          enregistrer.mutate();
        }}
      />
    </section>
  );
}

function LignePermission({
  permission,
  role,
  coche,
  onChange,
}: {
  permission: PermissionCatalogue;
  role: RoleCompte;
  coche: boolean;
  onChange: (permission: string, coche: boolean) => void;
}) {
  const verrouillee = role.id === 'ADMIN' && VERROUILLEES_ADMIN.includes(permission.permission);
  const ecart = role.systeme && coche !== permission.parDefaut.includes(role.roleDeBase);

  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-border py-1 last:border-b-0">
      <input
        type="checkbox"
        className="size-4"
        aria-label={`${permission.libelle} pour ${role.libelle}${verrouillee ? ' (verrouillé)' : ''}`}
        checked={coche}
        disabled={verrouillee}
        onChange={(event) => {
          onChange(permission.permission, event.target.checked);
        }}
      />
      <span className="flex flex-1 items-center gap-1.5 text-[0.875rem]">
        {permission.libelle}
        <InfoPopover
          label={permission.libelle}
          description={AIDE_PERMISSIONS[permission.permission as Permission]}
        />
      </span>
      {ecart ? <Badge variant="outline">modifié</Badge> : null}
    </li>
  );
}

function EnteteRole({
  role,
  roles,
  onSupprime,
}: {
  role: RoleCompte;
  roles: RoleCompte[];
  onSupprime: () => void;
}) {
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const supprimer = useMutation({
    mutationFn: () => deleteRole(role.id),
    onSuccess: () => {
      setSuppression(false);
      toast.success(`Rôle ${role.libelle} supprimé.`);
      onSupprime();
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    },
    onError: (error) => {
      setSuppression(false);
      toastApiError(error, 'Suppression impossible. Réessayez.');
    },
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-[1.125rem] font-[600]">
          {role.libelle}
          <Badge variant="secondary">
            {role.systeme ? 'système' : `base : ${ROLE_LABELS[role.roleDeBase]}`}
          </Badge>
        </h2>
        {role.systeme ? null : (
          <p className="text-[0.8125rem] text-muted-foreground">
            Les notifications, la page d’accueil et les files de rappels suivent le rôle de base.
          </p>
        )}
      </div>
      {role.systeme ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${role.libelle}`} />
            }
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              onClick={() => {
                setEdition(true);
              }}
            >
              Renommer ou changer la base
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={role.comptes > 0}
              onClick={() => {
                setSuppression(true);
              }}
            >
              {role.comptes > 0
                ? `Retirez d’abord les ${String(role.comptes)} comptes`
                : 'Supprimer le rôle'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <RoleDialog
        key={String(edition)}
        open={edition}
        onOpenChange={setEdition}
        role={role}
        roles={roles}
        onSaved={() => undefined}
      />
      <ConfirmDialog
        open={suppression}
        onOpenChange={setSuppression}
        title={`Supprimer le rôle ${role.libelle} ?`}
        description="Le rôle et ses permissions disparaissent. Aucun compte ne le porte."
        confirmLabel="Supprimer le rôle"
        pending={supprimer.isPending}
        onConfirm={() => {
          supprimer.mutate();
        }}
      />
    </header>
  );
}
