'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import {
  famillesDePermissions,
  LignePermission,
  RecherchePermission,
} from '@/components/commerciaux/permissions-liste';
import { EnteteRole } from '@/components/commerciaux/role-entete';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type PermissionCatalogue, replacePermissions, type RoleCompte } from '@/lib/data/roles';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

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
  const [recherche, setRecherche] = useState('');
  const [ecartsSeuls, setEcartsSeuls] = useState(false);

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

  const defaut = parDefaut(role, roles, catalogue);
  const ecart = (p: string): boolean => brouillon.includes(p) !== defaut.includes(p);
  const familles = famillesDePermissions(catalogue, recherche, (p) => !ecartsSeuls || ecart(p));
  const modifie = !memes(brouillon, role.permissions);
  const basculer = (permission: string, coche: boolean): void => {
    setBrouillon((courant) =>
      coche ? [...courant, permission] : courant.filter((p) => p !== permission),
    );
  };

  return (
    <section aria-label={`Permissions de ${role.libelle}`} className="flex flex-col gap-4">
      <EnteteRole role={role} roles={roles} onSupprime={onSupprime} />

      <div className="flex flex-wrap items-center gap-4">
        <RecherchePermission valeur={recherche} onChange={setRecherche} />
        <label className="flex items-center gap-2 text-[0.875rem]">
          <input
            type="checkbox"
            className="size-4"
            checked={ecartsSeuls}
            onChange={(event) => {
              setEcartsSeuls(event.target.checked);
            }}
          />
          N’afficher que les écarts avec le rôle de base
        </label>
      </div>

      {familles.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-[0.875rem] text-muted-foreground">
          Aucune permission ne correspond. Effacez la recherche ou décochez le filtre des écarts.
        </p>
      ) : null}

      {familles.map((famille) => (
        <fieldset
          key={famille.nom}
          className="rounded-lg border border-border bg-card p-4 shadow-elev-sm"
        >
          <legend className="px-1 text-[0.875rem] font-[600]">{famille.nom}</legend>
          <ul className="grid gap-x-6 lg:grid-cols-2">
            {famille.permissions.map((p) => (
              <LignePermission
                key={p.permission}
                permission={p}
                titulaire={role.libelle}
                coche={brouillon.includes(p.permission)}
                verrouillee={role.id === 'ADMIN' && VERROUILLEES_ADMIN.includes(p.permission)}
                marque={ecart(p.permission) ? 'modifié' : null}
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
            setBrouillon(defaut);
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
