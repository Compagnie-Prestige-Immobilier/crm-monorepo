'use client';

import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { meQueryOptions } from '@/api/auth';
import { EditeurRole } from '@/components/commerciaux/role-editeur';
import { RoleDialog } from '@/components/commerciaux/role-dialog';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRoles, type RoleCompte } from '@/lib/data/roles';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function RolesView() {
  const roles = useQuery({ queryKey: queryKeys.roles, queryFn: () => fetchRoles() });
  const { data: moi } = useQuery(meQueryOptions);
  const [choisi, setChoisi] = useState<string>('ADMIN');
  const [creation, setCreation] = useState(false);

  if (roles.isPending) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (roles.isError) {
    return (
      <QueryErrorState
        error={roles.error}
        onRetry={() => {
          void roles.refetch();
        }}
        fallback="La liste des rôles n’a pas pu être chargée."
      />
    );
  }

  const liste = roles.data.roles;
  const role = liste.find((r) => r.id === choisi) ?? liste[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Rôles" className="flex flex-col gap-4">
        <GroupeRoles
          titre="Rôles système"
          roles={liste.filter((r) => r.systeme)}
          choisi={role?.id}
          onChoisir={setChoisi}
        />
        <GroupeRoles
          titre="Rôles personnalisés"
          roles={liste.filter((r) => !r.systeme)}
          choisi={role?.id}
          onChoisir={setChoisi}
          vide="Aucun. Créez-en un avec Nouveau rôle."
        />
        <Button
          variant="outline"
          onClick={() => {
            setCreation(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau rôle
        </Button>
      </nav>

      {role === undefined ? null : (
        <EditeurRole
          key={`${role.id}:${role.permissions.join(',')}`}
          role={role}
          roles={liste}
          catalogue={roles.data.catalogue}
          sonRole={moi?.roleId === role.id}
          onSupprime={() => {
            setChoisi('ADMIN');
          }}
        />
      )}

      <RoleDialog
        key={String(creation)}
        open={creation}
        onOpenChange={setCreation}
        role={null}
        roles={liste}
        onSaved={(cree) => {
          setChoisi(cree.id);
        }}
      />
    </div>
  );
}

function GroupeRoles({
  titre,
  roles,
  choisi,
  onChoisir,
  vide,
}: {
  titre: string;
  roles: RoleCompte[];
  choisi: string | undefined;
  onChoisir: (id: string) => void;
  vide?: string;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="eyebrow px-2 text-muted-foreground">{titre}</h3>
      {roles.length === 0 && vide !== undefined ? (
        <p className="px-2 text-[0.8125rem] text-muted-foreground">{vide}</p>
      ) : null}
      {roles.map((role) => (
        <button
          key={role.id}
          type="button"
          aria-current={role.id === choisi ? 'true' : undefined}
          onClick={() => {
            onChoisir(role.id);
          }}
          className={cn(
            'flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-left text-[0.875rem] hover:bg-secondary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            role.id === choisi && 'bg-secondary font-[600]',
          )}
        >
          <span className="truncate">{role.libelle}</span>
          <span className="shrink-0 text-[0.75rem] text-muted-foreground tabular-nums">
            {role.comptesActifs}
          </span>
        </button>
      ))}
    </section>
  );
}
