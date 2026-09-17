'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeftRightIcon,
  CombineIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import {
  callOutcomeLabel,
  enrollmentMethodLabel,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  statutForProjet,
  type BadgeVariant,
  type Phase2Status,
  type Projet,
  type ProspectRow,
  type ProspectStatut,
} from '@/lib/types';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

const PHASE2_VARIANT: Record<Phase2Status, BadgeVariant> = {
  PENDING: 'secondary',
  METHOD_OBTAINED: 'success',
  REFUSED: 'destructive',
  WRONG_NUMBER: 'warning',
};

export interface ProspectRowActions {
  /** Projet de l'écran : la colonne « Statut » lit le parcours correspondant. */
  projet: Projet | null;
  canAdminister: boolean;
  /** Le SUPERVISEUR garde ce seul geste malgré la lecture seule du reste. */
  canReassign: boolean;
  /** Le SUPERVISEUR lit les fiches d'autrui : la colonne d'actions disparaît. */
  readOnly: boolean;
  onEdit: (prospect: ProspectRow) => void;
  onMerge: (prospect: ProspectRow) => void;
  onReassign: (prospect: ProspectRow) => void;
  onDelete: (prospect: ProspectRow) => void;
}

function Empty() {
  return <span className="text-muted-foreground/60 italic">–</span>;
}

export function prospectColumns(actions: ProspectRowActions): ColumnDef<ProspectRow>[] {
  const columns: ColumnDef<ProspectRow>[] = [
    {
      id: 'nom',
      accessorKey: 'nom',
      header: 'Nom',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-[600]">
            <Link
              href={`/teleconseil/prospects/${row.original.id}`}
              className="underline-offset-4 hover:underline"
            >
              {row.original.prenom} {row.original.nom}
            </Link>
          </p>
          <p className="truncate font-mono text-[0.8125rem] font-semibold tabular-nums text-foreground/80">
            {formatPhone(row.original.phoneE164)}
          </p>
        </div>
      ),
    },
    ...(actions.projet === null
      ? [
          {
            id: 'projet',
            accessorKey: 'projet',
            header: 'Projet',
            cell: ({ row }) => <ProjetBadge projet={row.original.projet} />,
          } satisfies ColumnDef<ProspectRow>,
        ]
      : []),
    {
      id: 'statut',
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => {
        const statut = statutForProjet(row.original, actions.projet);
        return <Badge variant={STATUT_VARIANT[statut]}>{PROSPECT_STATUT_LABELS[statut]}</Badge>;
      },
    },
    {
      id: 'segment',
      accessorKey: 'segment',
      header: 'Segment',
      // Une fiche sans banque ni syndicat n'est dans aucun BDD. On l'ecrit,
      // plutot que de la ranger dans BDD4 qui est une reponse, pas une absence.
      cell: ({ row }) => {
        const segment = row.original.segment;
        return segment === null ? (
          <span className="text-muted-foreground">Aucun</span>
        ) : (
          <Badge variant="outline" title={SEGMENT_LABELS[segment]}>
            {segment}
          </Badge>
        );
      },
    },
    {
      id: 'phase2Status',
      accessorKey: 'phase2Status',
      header: 'Résultat de l’appel',
      cell: ({ row }) => (
        <Badge variant={PHASE2_VARIANT[row.original.phase2Status]}>
          {PHASE2_STATUS_LABELS[row.original.phase2Status]}
        </Badge>
      ),
    },
    {
      id: 'enrollmentMethod',
      accessorKey: 'enrollmentMethod',
      header: 'Méthode',
      cell: ({ row }) => {
        const method = row.original.enrollmentMethod;
        if (method === null) return <Empty />;
        return <span className="truncate">{enrollmentMethodLabel(method)}</span>;
      },
    },
    {
      id: 'lastOutcome',
      accessorKey: 'lastOutcome',
      header: 'Dernier appel',
      cell: ({ row }) => {
        const { lastOutcome, lastReasonLabel, lastComment, lastAttemptAt } = row.original;
        if (lastOutcome === null) return <Empty />;
        return (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate font-[600]">
              {lastReasonLabel ?? callOutcomeLabel(lastOutcome)}
            </p>
            {lastComment !== null && lastComment !== '' ? (
              <p className="truncate text-[0.75rem] text-muted-foreground" title={lastComment}>
                {lastComment}
              </p>
            ) : null}
            {lastAttemptAt !== null ? (
              <time
                dateTime={lastAttemptAt}
                className="block text-[0.75rem] text-muted-foreground tabular-nums"
              >
                {formatDateTime(lastAttemptAt)}
              </time>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'enrollmentCapturedBy',
      accessorKey: 'enrollmentCapturedByName',
      header: 'Obtenu par',
      cell: ({ row }) => {
        const { enrollmentCapturedByName, enrollmentCapturedAt } = row.original;
        if (enrollmentCapturedByName === null) return <Empty />;
        return (
          <div className="min-w-0">
            <p className="truncate">{enrollmentCapturedByName}</p>
            {enrollmentCapturedAt !== null ? (
              <time
                dateTime={enrollmentCapturedAt}
                className="block text-[0.75rem] text-muted-foreground tabular-nums"
              >
                {formatDate(enrollmentCapturedAt)}
              </time>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'representantName',
      accessorKey: 'representantName',
      header: 'Représentant',
      cell: ({ row }) => <span className="truncate">{row.original.representantName}</span>,
    },
    {
      id: 'departementName',
      accessorKey: 'departementName',
      header: 'Département',
      cell: ({ row }) => <span className="truncate">{row.original.departementName}</span>,
    },
    {
      id: 'banque',
      accessorKey: 'banqueName',
      header: 'Banque',
      cell: ({ row }) => <span className="truncate">{row.original.banqueName}</span>,
    },
    {
      id: 'syndicat',
      accessorKey: 'syndicatSigle',
      header: 'Syndicat',
      cell: ({ row }) => <span className="truncate">{row.original.syndicatSigle}</span>,
    },
    {
      id: 'ownedByCommercialName',
      accessorKey: 'ownedByCommercialName',
      header: 'Téléconseiller',
      cell: ({ row }) => <span className="truncate">{row.original.ownedByCommercialName}</span>,
    },
    {
      id: 'clientCreatedAt',
      accessorKey: 'clientCreatedAt',
      header: 'Saisi le',
      cell: ({ row }) => (
        <time dateTime={row.original.clientCreatedAt} className="whitespace-nowrap tabular-nums">
          {formatDate(row.original.clientCreatedAt)}
        </time>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions pour ${row.original.prenom} ${row.original.nom}`}
              />
            }
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {actions.readOnly ? null : (
              <DropdownMenuItem
                onClick={() => {
                  actions.onEdit(row.original);
                }}
              >
                <PencilIcon aria-hidden="true" />
                Modifier
              </DropdownMenuItem>
            )}
            {actions.canAdminister || actions.canReassign ? (
              <DropdownMenuItem
                onClick={() => {
                  actions.onReassign(row.original);
                }}
              >
                <ArrowLeftRightIcon aria-hidden="true" />
                Réaffecter
              </DropdownMenuItem>
            ) : null}
            {actions.canAdminister ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    actions.onMerge(row.original);
                  }}
                >
                  <CombineIcon aria-hidden="true" />
                  Fusionner un doublon…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    actions.onDelete(row.original);
                  }}
                >
                  <Trash2Icon aria-hidden="true" />
                  Supprimer
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return actions.readOnly && !actions.canReassign
    ? columns.filter((column) => column.id !== 'actions')
    : columns;
}
