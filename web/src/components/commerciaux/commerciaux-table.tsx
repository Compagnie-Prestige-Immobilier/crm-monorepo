'use client';

import {
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
  Trash2Icon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { ROLE_LABELS, type UserRow } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface ActionsCompte {
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
  onToggleActive: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  togglePending: boolean;
  removePending: boolean;
}

export function CommerciauxTable({
  users,
  currentUserId,
  selectedIds,
  onSelectedIdsChange,
  actions,
}: {
  users: UserRow[];
  currentUserId: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  actions: ActionsCompte;
}) {
  const selectables = users.filter((user) => user.id !== currentUserId);
  const toutCoche =
    selectables.length > 0 && selectables.every((user) => selectedIds.includes(user.id));

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10">
            <input
              type="checkbox"
              className="size-4 align-middle"
              aria-label="Sélectionner tous les comptes affichés"
              disabled={selectables.length === 0}
              checked={toutCoche}
              onChange={(event) => {
                onSelectedIdsChange(event.target.checked ? selectables.map((user) => user.id) : []);
              }}
            />
          </TableHead>
          <TableHead>Utilisateur</TableHead>
          <TableHead className="hidden md:table-cell">Identifiants</TableHead>
          <TableHead className="hidden md:table-cell text-right">Prospects</TableHead>
          <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-16 text-center">
              <p className="font-[600]">Aucun compte ne correspond à ces critères.</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Élargissez la recherche ou créez un compte.
              </p>
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => (
            <LigneCompte
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              selected={selectedIds.includes(user.id)}
              onSelectedChange={(checked) => {
                onSelectedIdsChange(
                  checked ? [...selectedIds, user.id] : selectedIds.filter((id) => id !== user.id),
                );
              }}
              actions={actions}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}

function LigneCompte({
  user,
  isSelf,
  selected,
  onSelectedChange,
  actions,
}: {
  user: UserRow;
  isSelf: boolean;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  actions: ActionsCompte;
}) {
  const personnalise = user.roleId !== user.role;

  return (
    <TableRow
      data-inactive={!user.isActive}
      className={cn(
        !user.isActive &&
          'bg-destructive-surface/50 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-destructive',
      )}
    >
      <TableCell>
        <input
          type="checkbox"
          className="size-4 align-middle"
          aria-label={`Sélectionner ${user.fullName}`}
          disabled={isSelf}
          checked={selected}
          onChange={(event) => {
            onSelectedChange(event.target.checked);
          }}
        />
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('truncate font-[600]', !user.isActive && 'text-muted-foreground')}>
              {user.fullName}
            </span>
            <Badge variant="secondary">{user.roleLibelle}</Badge>
            {user.isActive ? null : <Badge variant="destructive">Désactivé</Badge>}
          </div>
          <span className="truncate text-[0.8125rem] md:hidden">{user.email}</span>
          <span className="truncate text-[0.75rem] text-muted-foreground">
            {user.phoneE164 === null ? '–' : formatPhone(user.phoneE164)}
            {personnalise ? ` · base : ${ROLE_LABELS[user.role]}` : null}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{user.email}</span>
          <span className="truncate text-[0.75rem] text-muted-foreground">@{user.username}</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-right tabular-nums">
        {formatNumber(user.prospectCount)}
      </TableCell>
      <TableCell className="hidden md:table-cell whitespace-nowrap text-[0.8125rem]">
        {user.lastLoginAt === null ? (
          <span className="text-muted-foreground">Jamais connecté</span>
        ) : (
          <time dateTime={user.lastLoginAt}>{formatDateTime(user.lastLoginAt)}</time>
        )}
      </TableCell>
      <TableCell className="text-right">
        <MenuCompte user={user} isSelf={isSelf} actions={actions} />
      </TableCell>
    </TableRow>
  );
}

function MenuCompte({
  user,
  isSelf,
  actions,
}: {
  user: UserRow;
  isSelf: boolean;
  actions: ActionsCompte;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${user.fullName}`} />
        }
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => actions.onEdit(user)}>
          <PencilIcon aria-hidden="true" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onResetPassword(user)}>
          <KeyRoundIcon aria-hidden="true" />
          Réinitialiser le mot de passe
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSelf || actions.togglePending}
          variant={user.isActive ? 'destructive' : 'default'}
          onClick={() => actions.onToggleActive(user)}
        >
          {user.isActive ? <PowerOffIcon aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
          {user.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isSelf || actions.removePending}
          variant="destructive"
          onClick={() => actions.onDelete(user)}
        >
          <Trash2Icon aria-hidden="true" />
          Supprimer le compte
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CommerciauxTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      {[0, 1, 2, 3, 4, 5].map((ligne) => (
        <div key={ligne} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3, 4].map((cellule) => (
            <Skeleton key={cellule} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
