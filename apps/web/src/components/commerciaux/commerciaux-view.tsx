'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
  SearchIcon,
  UserPlusIcon,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { PasswordDialog } from '@/components/commerciaux/password-dialog';
import { UserFormDialog } from '@/components/commerciaux/user-form-dialog';
import { Badge } from '@/components/ui/badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DEFAULT_USER_FILTERS,
  fetchUsers,
  setUserActive,
  type UserFilters,
} from '@/lib/data/users';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { UserRow } from '@/lib/types';
import { cn } from '@/lib/utils';

type ActiveFilterValue = 'tous' | 'actifs' | 'desactives';

const ACTIVE_FILTER: Record<ActiveFilterValue, boolean | null> = {
  tous: null,
  actifs: true,
  desactives: false,
};

/**
 * Comptes commerciaux.
 *
 * Un compte désactivé n'est pas rendu par une case à cocher dans une colonne :
 * la LIGNE ENTIÈRE change d'aspect (fond atténué, liseré, nom en gris, badge
 * explicite). Une désactivation coupe l'accès de quelqu'un au terrain — cela
 * doit se voir en balayant la liste, pas en lisant la septième colonne.
 */
export function CommerciauxView({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const searchId = useId();

  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_USER_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | undefined>(undefined);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);

  // La recherche est appliquée après une pause de frappe : une requête par
  // caractère saturerait l'API pour rien.
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchDraft, page: 1 }));
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchDraft, filters.search]);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.commerciaux(filters),
    queryFn: () => fetchUsers(filters),
    placeholderData: (previous) => previous,
  });

  const toggleActive = useMutation({
    mutationFn: ({ user, isActive }: { user: UserRow; isActive: boolean }) =>
      setUserActive(user.id, isActive),
    // État optimiste : la ligne change d'aspect immédiatement. La bascule est
    // sûre à anticiper — un seul booléen, et l'échec la remet en place.
    onMutate: async ({ user, isActive }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.commerciaux(filters) });
      const previous = queryClient.getQueryData(queryKeys.commerciaux(filters));
      queryClient.setQueryData(
        queryKeys.commerciaux(filters),
        (current: { items: UserRow[] } | undefined) =>
          current === undefined
            ? current
            : {
                ...current,
                items: current.items.map((row) =>
                  row.id === user.id ? { ...row, isActive } : row,
                ),
              },
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.commerciaux(filters), context.previous);
      }
      toastApiError(error, "Changement d'état impossible. Réessayez.");
    },
    onSuccess: (saved) => {
      toast.success(
        saved.isActive
          ? `${saved.fullName} réactivé.`
          : `${saved.fullName} désactivé. Ses prospects et représentants sont conservés.`,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
    },
  });

  const activeValue: ActiveFilterValue =
    filters.isActive === null ? 'tous' : filters.isActive ? 'actifs' : 'desactives';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Comptes de connexion à l’application mobile. Désactiver ferme l’accès, sans rien
          supprimer.
        </p>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <UserPlusIcon aria-hidden="true" />
          Nouveau commercial
        </Button>
      </div>

      <section
        aria-label="Filtres"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
      >
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <Label htmlFor={searchId}>Recherche</Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={searchDraft}
              onChange={(event) => {
                setSearchDraft(event.target.value);
              }}
              placeholder="Nom, e-mail, identifiant…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex w-48 flex-col gap-1.5">
          <Label htmlFor="etat-compte">État du compte</Label>
          <Select
            value={activeValue}
            onValueChange={(value) => {
              setFilters((current) => ({
                ...current,
                isActive: ACTIVE_FILTER[value as ActiveFilterValue],
                page: 1,
              }));
            }}
          >
            <SelectTrigger id="etat-compte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="actifs">Actifs</SelectItem>
              <SelectItem value="desactives">Désactivés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        /* Un 403 arrive ici pour un compte non-ADMIN : l'écran doit le dire,
           et surtout ne pas proposer « Réessayer » sur un refus de droits. */
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Liste des comptes non chargée."
        />
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
            isFetching && 'opacity-80',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Téléconseiller</TableHead>
                <TableHead>Identifiants</TableHead>
                <TableHead>Département</TableHead>
                <TableHead className="text-right">Prospects</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-16 text-center">
                    <p className="font-[600]">Aucun compte ne correspond à ces critères.</p>
                    <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                      Élargissez la recherche ou créez un compte.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((user) => (
                  <TableRow
                    key={user.id}
                    data-inactive={!user.isActive}
                    className={cn(
                      // Un compte fermé se reconnaît d'un coup d'œil : liseré
                      // rouge, fond atténué, contenu en retrait.
                      !user.isActive &&
                        'bg-destructive-surface/50 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-destructive',
                    )}
                  >
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'truncate font-[600]',
                              !user.isActive && 'text-muted-foreground',
                            )}
                          >
                            {user.fullName}
                          </span>
                          {user.isActive ? null : <Badge variant="destructive">Désactivé</Badge>}
                        </div>
                        <span className="truncate text-[0.75rem] text-muted-foreground">
                          {user.phoneE164 === null ? '–' : formatPhone(user.phoneE164)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{user.email}</span>
                        <span className="truncate text-[0.75rem] text-muted-foreground">
                          @{user.username}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{user.departementName ?? '–'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(user.prospectCount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[0.8125rem]">
                      {user.lastLoginAt === null ? (
                        <span className="text-muted-foreground">Jamais connecté</span>
                      ) : (
                        <time dateTime={user.lastLoginAt}>{formatDateTime(user.lastLoginAt)}</time>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions pour ${user.fullName}`}
                          >
                            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(user);
                              setFormOpen(true);
                            }}
                          >
                            <PencilIcon aria-hidden="true" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setPasswordTarget(user);
                            }}
                          >
                            <KeyRoundIcon aria-hidden="true" />
                            Réinitialiser le mot de passe
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            // Se désactiver soi-même fermerait la session en
                            // cours et laisserait CPI sans administrateur.
                            disabled={user.id === currentUserId || toggleActive.isPending}
                            variant={user.isActive ? 'destructive' : 'default'}
                            onSelect={() => {
                              toggleActive.mutate({ user, isActive: !user.isActive });
                            }}
                          >
                            {user.isActive ? (
                              <PowerOffIcon aria-hidden="true" />
                            ) : (
                              <PowerIcon aria-hidden="true" />
                            )}
                            {user.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
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

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <div className="flex h-11 items-center gap-4 border-b border-border px-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3, 4].map((cell) => (
            <Skeleton key={cell} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
