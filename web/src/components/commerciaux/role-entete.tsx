'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { RoleDialog } from '@/components/commerciaux/role-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteRole, type RoleCompte } from '@/lib/data/roles';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { ROLE_LABELS } from '@/lib/types';

export function EnteteRole({
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
