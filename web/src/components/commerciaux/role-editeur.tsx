'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { AIDE_PERMISSIONS } from '@/components/commerciaux/permissions-aide';
import { EnteteRole } from '@/components/commerciaux/role-entete';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InfoPopover } from '@/components/ui/info-popover';
import { Input } from '@/components/ui/input';
import { type PermissionCatalogue, replacePermissions, type RoleCompte } from '@/lib/data/roles';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Permission } from '@/lib/types';

/** ADMIN garde toujours de quoi réparer : le serveur refuse de les lui retirer. */
const VERROUILLEES_ADMIN = ['comptes.administrer', 'roles.administrer'];

/** Les domaines du serveur, rangés en familles pour l'écran seulement. */
const FAMILLES: [string, string[]][] = [
  [
    'Téléconseil et fiches',
    ['Fiches', 'Qualification', 'Portefeuille', 'Campagnes', 'Rendez-vous'],
  ],
  ['Chiffres et exports', ['Chiffres', 'Exports', 'Assistant']],
  ['Banque & Finance, ventes et enrôlement', ['Banque & Finance', 'Ventes', 'Enrôlement']],
  ['Accueil', ['Accueil']],
  ['Comptes et accès', ['Panneau', 'Comptes', 'Données', 'Support']],
  [
    'Administration',
    [
      'Imports',
      'Référentiels',
      'Formulaires',
      'Courriels',
      'Notifications',
      'Paramètres',
      'Exploitation',
      'Bases',
    ],
  ],
];
const AUTRES = 'Autres';

const familleDe = (domaine: string): string =>
  FAMILLES.find(([, domaines]) => domaines.includes(domaine))?.[0] ?? AUTRES;

const memes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((p) => b.includes(p));

const sansAccents = (texte: string): string =>
  texte.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();

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

function correspond(permission: PermissionCatalogue, recherche: string): boolean {
  if (recherche === '') return true;
  const aide = AIDE_PERMISSIONS[permission.permission as Permission] ?? '';
  return sansAccents(`${permission.libelle} ${permission.domaine} ${aide}`).includes(recherche);
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
  const cle = sansAccents(recherche.trim());
  const visibles = catalogue.filter(
    (p) => correspond(p, cle) && (!ecartsSeuls || ecart(p.permission)),
  );
  const familles = [...FAMILLES.map(([nom]) => nom), AUTRES]
    .map((nom) => ({ nom, permissions: visibles.filter((p) => familleDe(p.domaine) === nom) }))
    .filter((famille) => famille.permissions.length > 0);
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
        <div className="relative w-full max-w-sm">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Chercher une permission"
            placeholder="Chercher une permission"
            className="pl-9"
            value={recherche}
            onChange={(event) => {
              setRecherche(event.target.value);
            }}
          />
        </div>
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
                role={role}
                coche={brouillon.includes(p.permission)}
                ecart={ecart(p.permission)}
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

function LignePermission({
  permission,
  role,
  coche,
  ecart,
  onChange,
}: {
  permission: PermissionCatalogue;
  role: RoleCompte;
  coche: boolean;
  ecart: boolean;
  onChange: (permission: string, coche: boolean) => void;
}) {
  const verrouillee = role.id === 'ADMIN' && VERROUILLEES_ADMIN.includes(permission.permission);

  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-border py-1">
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
