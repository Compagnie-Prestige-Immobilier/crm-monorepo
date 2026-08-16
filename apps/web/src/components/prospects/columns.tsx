'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeftRightIcon,
  CombineIcon,
  MoreHorizontalIcon,
  PencilIcon,
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
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type BadgeVariant,
  type Phase2Status,
  type ProspectRow,
  type ProspectStatut,
} from '@/lib/types';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

/**
 * `PENDING` en neutre et non en « attention » : un prospect pas encore appelé
 * n'est pas un problème, c'est l'état normal du début de campagne. Le peindre
 * en or ferait clignoter la moitié du tableau le premier jour.
 */
const PHASE2_VARIANT: Record<Phase2Status, BadgeVariant> = {
  PENDING: 'secondary',
  METHOD_OBTAINED: 'success',
  REFUSED: 'destructive',
  WRONG_NUMBER: 'warning',
};

export interface ProspectRowActions {
  /** `false` pour un COMMERCIAL : l'API refuse fusion et réaffectation. */
  canAdminister: boolean;
  onEdit: (prospect: ProspectRow) => void;
  onMerge: (prospect: ProspectRow) => void;
  onReassign: (prospect: ProspectRow) => void;
  onDelete: (prospect: ProspectRow) => void;
}

/** Cellule vide explicite. Une case blanche se lit comme une donnée perdue. */
function Empty() {
  return <span className="text-muted-foreground">–</span>;
}

/**
 * Colonnes du tableau des prospects.
 *
 * `id` reprend le nom du champ trié CÔTÉ SERVEUR (`ProspectSortField` du
 * contrat) : le clic sur l'en-tête envoie donc `sortBy` sans table de
 * correspondance. Les colonnes dérivées d'une jointure : représentant,
 * département, téléconseiller : ne sont pas triables : l'API ne le propose pas, et
 * une flèche qui ne trie rien est pire que pas de flèche.
 *
 * Les colonnes de phase 2 répondent à une question qu'on posait jusqu'ici en
 * ouvrant l'export : QUI a obtenu ce résultat, QUAND, et avec quel commentaire.
 * Elles sont groupées à droite du statut de phase 1 pour que la lecture aille
 * du plus ancien au plus récent, comme le parcours réel du prospect.
 */
export function prospectColumns(actions: ProspectRowActions): ColumnDef<ProspectRow>[] {
  return [
    {
      id: 'nom',
      accessorKey: 'nom',
      header: 'Nom',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-[600]">
            {row.original.prenom} {row.original.nom}
          </p>
          <p className="truncate text-[0.75rem] text-muted-foreground">
            {formatPhone(row.original.phoneE164)}
          </p>
        </div>
      ),
    },
    {
      id: 'statut',
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge variant={STATUT_VARIANT[row.original.statut]}>
          {PROSPECT_STATUT_LABELS[row.original.statut]}
        </Badge>
      ),
    },
    {
      id: 'segment',
      accessorKey: 'segment',
      header: 'Segment',
      cell: ({ row }) => (
        // Le sigle en cellule, le libellé complet en info-bulle : « BDD1 -
        // CHUES / CBAO » dans chaque ligne pousserait les colonnes suivantes
        // hors de l'écran.
        <Badge variant="outline" title={SEGMENT_LABELS[row.original.segment]}>
          {row.original.segment}
        </Badge>
      ),
    },
    {
      id: 'phase2Status',
      accessorKey: 'phase2Status',
      header: 'Phase 2',
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
        return <span className="truncate">{ENROLLMENT_METHOD_LABELS[method]}</span>;
      },
    },
    {
      id: 'lastOutcome',
      accessorKey: 'lastOutcome',
      header: 'Dernier appel',
      cell: ({ row }) => {
        const { lastOutcome, lastComment, lastAttemptAt } = row.original;
        if (lastOutcome === null) return <Empty />;
        return (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate font-[600]">{CALL_OUTCOME_LABELS[lastOutcome]}</p>
            {lastComment !== null && lastComment !== '' ? (
              // `title` porte le commentaire entier : un motif de refus tient
              // rarement en une ligne, et le tronquer sans recours ferait
              // rouvrir la fiche pour rien.
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
        // `clientCreatedAt` = saisie terrain, pas arrivée en base. Un téléconseiller
        // resté hors ligne trois jours voit ici la date de sa tournée.
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
                /* `size="icon"` (44 px) et non `icon-sm` (36 px) : docs/design.md
                   §6 fixe la cible tactile minimale à 44 px, et le panel est aussi
                   consulté sur tablette. Un menu de ligne à 36 px se manque une
                   fois sur trois au doigt : et l'action manquée juste à côté est
                   « Supprimer ». */
                size="icon"
                aria-label={`Actions pour ${row.original.prenom} ${row.original.nom}`}
              />
            }
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => {
                actions.onEdit(row.original);
              }}
            >
              <PencilIcon aria-hidden="true" />
              Modifier
            </DropdownMenuItem>
            {actions.canAdminister ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    actions.onReassign(row.original);
                  }}
                >
                  <ArrowLeftRightIcon aria-hidden="true" />
                  Réaffecter
                </DropdownMenuItem>
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
}
