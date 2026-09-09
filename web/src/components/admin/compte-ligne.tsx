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
import { TableCell, TableRow } from '@/components/ui/table';
import type { Compte } from '@/lib/data/users';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

function DerniereConnexion({ iso }: { iso: string | null }) {
  if (iso === null) return <span className="text-muted-foreground">Jamais connecté</span>;
  return <time dateTime={iso}>{formatDateTime(iso)}</time>;
}

function telephoneLisible(e164: string | null): string {
  return e164 === null || e164 === '' ? '–' : formatPhone(e164);
}

export function LigneCompte({
  compte,
  estMoi,
  enCours,
  onModifier,
  onMotDePasse,
  onBasculer,
  onSupprimer,
}: {
  compte: Compte;
  estMoi: boolean;
  enCours: boolean;
  onModifier: () => void;
  onMotDePasse: () => void;
  onBasculer: () => void;
  onSupprimer: () => void;
}) {
  return (
    <TableRow
      className={cn(
        !compte.isActive &&
          'bg-destructive-surface/50 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-destructive',
      )}
    >
      <TableCell>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn('truncate font-[600]', !compte.isActive && 'text-muted-foreground')}
            >
              {compte.fullName}
            </span>
            <Badge variant="secondary">{ROLE_LABELS[compte.role]}</Badge>
            {compte.isActive ? null : <Badge variant="destructive">Désactivé</Badge>}
          </div>
          <span className="truncate text-[0.75rem] text-muted-foreground">
            {telephoneLisible(compte.phoneE164)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{compte.email}</span>
          <span className="truncate text-[0.75rem] text-muted-foreground">@{compte.username}</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(compte.prospectCount)}
      </TableCell>
      <TableCell className="text-[0.8125rem] whitespace-nowrap">
        <DerniereConnexion iso={compte.lastLoginAt} />
      </TableCell>
      <TableCell className="text-right">
        <ActionsCompte
          compte={compte}
          verrouille={estMoi || enCours}
          onModifier={onModifier}
          onMotDePasse={onMotDePasse}
          onBasculer={onBasculer}
          onSupprimer={onSupprimer}
        />
      </TableCell>
    </TableRow>
  );
}

function ActionsCompte({
  compte,
  verrouille,
  onModifier,
  onMotDePasse,
  onBasculer,
  onSupprimer,
}: {
  compte: Compte;
  verrouille: boolean;
  onModifier: () => void;
  onMotDePasse: () => void;
  onBasculer: () => void;
  onSupprimer: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${compte.fullName}`} />
        }
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onModifier}>
          <PencilIcon aria-hidden="true" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMotDePasse}>
          <KeyRoundIcon aria-hidden="true" />
          Réinitialiser le mot de passe
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={verrouille}
          variant={compte.isActive ? 'destructive' : 'default'}
          onClick={onBasculer}
        >
          {compte.isActive ? <PowerOffIcon aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
          {compte.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={verrouille} variant="destructive" onClick={onSupprimer}>
          <Trash2Icon aria-hidden="true" />
          Supprimer le compte
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
