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
import { EtiquettesStatut } from '@/components/prospects/etiquettes-statut';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { SUITES } from '@/components/prospects/suivi-rendez-vous';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { compte, formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { PROSPECT_TYPE_LABELS } from '@/lib/data/grand-public';
import {
  etatRendezVousFiche,
  PAYMENT_MODE_LABELS,
  PROSPECT_STATUT_LABELS,
  statutForProjet,
  type Projet,
  type ProspectRow,
  type ProspectStatut,
} from '@/lib/types';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  VENDU: 'success',
  PERDU: 'destructive',
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

function LigneIssue({
  prospect,
}: {
  prospect: Pick<
    ProspectRow,
    | 'phase2Status'
    | 'rendezVousIssue'
    | 'rendezVousConfirmation'
    | 'rendezVousReporteAt'
    | 'suiteRencontre'
  >;
}) {
  if (prospect.phase2Status !== 'APPOINTMENT' && prospect.rendezVousIssue === null) return null;
  const libelle = etatRendezVousFiche(prospect);
  const { rendezVousReporteAt, suiteRencontre } = prospect;
  return (
    <p className="truncate font-[600]" title={libelle}>
      {libelle}
      {rendezVousReporteAt === null ? '' : ` au ${formatDate(rendezVousReporteAt)}`}
      {suiteRencontre === null ? '' : ` · ${SUITES[suiteRencontre]}`}
    </p>
  );
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
      id: 'phase2Status',
      accessorKey: 'phase2Status',
      header: 'Statut de qualification',
      cell: ({ row }) => <EtiquettesStatut prospect={row.original} />,
    },
    {
      id: 'lastReasonLabel',
      accessorKey: 'lastReasonLabel',
      header: 'Dernier appel',
      cell: ({ row }) => {
        const { lastReasonLabel, statutQualification, lastCallByName, lastComment, lastAttemptAt } =
          row.original;
        if (lastReasonLabel === null) return <Empty />;
        return (
          <div className="min-w-0 max-w-[16rem]">
            {lastReasonLabel === statutQualification ? null : (
              <p className="truncate font-[600]">{lastReasonLabel}</p>
            )}
            {lastCallByName !== null ? <p className="truncate">{lastCallByName}</p> : null}
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
      id: 'campagne',
      accessorKey: 'campagne',
      header: 'Campagne',
      cell: ({ row }) =>
        row.original.campagne === null ? (
          <Empty />
        ) : (
          <span className="block max-w-44 truncate" title={row.original.campagne}>
            {row.original.campagne}
          </span>
        ),
    },
    {
      id: 'commentaire',
      accessorKey: 'lastComment',
      header: 'Commentaire',
      cell: ({ row }) => {
        const { lastComment, remarqueImport } = row.original;
        if ((lastComment === null || lastComment === '') && remarqueImport === null)
          return <Empty />;
        return (
          <div className="min-w-0 max-w-56">
            {lastComment !== null && lastComment !== '' ? (
              <p className="truncate" title={lastComment}>
                {lastComment}
              </p>
            ) : null}
            {remarqueImport !== null ? (
              <p className="truncate text-[0.75rem] text-muted-foreground" title={remarqueImport}>
                Classeur : {remarqueImport}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'dateRendezVous',
      accessorKey: 'dateRendezVous',
      header: 'Date de rendez-vous',
      cell: ({ row }) =>
        row.original.dateRendezVous === null ? (
          <Empty />
        ) : (
          <time
            dateTime={row.original.dateRendezVous}
            className="whitespace-nowrap tabular-nums"
            title={formatDateTime(row.original.dateRendezVous)}
          >
            {formatDateTime(row.original.dateRendezVous)}
          </time>
        ),
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Secteur',
      cell: ({ row }) =>
        row.original.type === null ? (
          <Empty />
        ) : (
          <span>{PROSPECT_TYPE_LABELS[row.original.type]}</span>
        ),
    },
    {
      id: 'profession',
      accessorKey: 'profession',
      header: 'Profession',
      cell: ({ row }) =>
        row.original.profession === null ? (
          <Empty />
        ) : (
          <span className="block max-w-40 truncate" title={row.original.profession}>
            {row.original.profession}
          </span>
        ),
    },
    {
      id: 'canal',
      accessorKey: 'canalProvenanceLabel',
      header: 'Canal',
      cell: ({ row }) =>
        row.original.canalProvenanceLabel === null ? (
          <Empty />
        ) : (
          <span className="block max-w-40 truncate" title={row.original.canalProvenanceLabel}>
            {row.original.canalProvenanceLabel}
          </span>
        ),
    },
    {
      id: 'employeur',
      accessorKey: 'employeur',
      header: 'Employeur',
      cell: ({ row }) => {
        const { employeur, ancienneteMois, lieuActivite, etablissement } = row.original;
        if (
          employeur === null &&
          ancienneteMois === null &&
          lieuActivite === null &&
          etablissement === null
        )
          return <Empty />;
        const details = [
          ancienneteMois === null ? null : `${String(ancienneteMois)} mois`,
          lieuActivite,
          etablissement,
        ].filter((detail) => detail !== null && detail !== '');
        return (
          <div className="min-w-0 max-w-48">
            {employeur !== null ? (
              <p className="truncate font-[600]" title={employeur}>
                {employeur}
              </p>
            ) : null}
            {details.length === 0 ? null : (
              <p
                className="truncate text-[0.75rem] text-muted-foreground"
                title={details.join(' · ')}
              >
                {details.join(' · ')}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'paiement',
      accessorKey: 'paymentMode',
      header: 'Paiement',
      cell: ({ row }) => {
        const { paymentMode, dureeSystemeMois } = row.original;
        if (paymentMode === null && dureeSystemeMois === null) return <Empty />;
        return (
          <div className="min-w-0">
            {paymentMode === null ? null : <p>{PAYMENT_MODE_LABELS[paymentMode]}</p>}
            {dureeSystemeMois === null ? null : (
              <p className="text-[0.75rem] text-muted-foreground tabular-nums">
                {String(dureeSystemeMois)} mois
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'contacts',
      header: 'Contacts',
      cell: ({ row }) => {
        const { whatsappNumber, relaisNom, relaisPhoneE164, email } = row.original;
        const relais = [relaisNom, relaisPhoneE164].filter((part) => part !== null && part !== '');
        if (whatsappNumber === null && relais.length === 0 && email === null) return <Empty />;
        return (
          <div className="min-w-0 max-w-52">
            {whatsappNumber === null ? null : (
              <p className="truncate font-mono text-[0.8125rem] tabular-nums">
                WA {formatPhone(whatsappNumber)}
              </p>
            )}
            {relais.length === 0 ? null : (
              <p
                className="truncate text-[0.75rem] text-muted-foreground"
                title={relais.join(' · ')}
              >
                Relais : {relais.join(' · ')}
              </p>
            )}
            {email === null ? null : (
              <p className="truncate text-[0.75rem] text-muted-foreground" title={email}>
                {email}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'suivi',
      accessorKey: 'rendezVousIssue',
      header: 'Suivi',
      cell: ({ row }) => {
        const { rendezVousIssue, aRevoirAt, revueAt, revueByName, callAttemptCount } = row.original;
        if (
          rendezVousIssue === null &&
          aRevoirAt === null &&
          revueAt === null &&
          callAttemptCount === 0
        )
          return <Empty />;
        return (
          <div className="min-w-0 max-w-52">
            <LigneIssue prospect={row.original} />
            {aRevoirAt === null ? null : (
              <p className="text-[0.75rem] text-muted-foreground tabular-nums">
                À revoir {formatDate(aRevoirAt)}
              </p>
            )}
            {revueAt === null ? null : (
              <p className="truncate text-[0.75rem] text-muted-foreground">
                Revue{revueByName === null ? '' : ` par ${revueByName}`} {formatDate(revueAt)}
              </p>
            )}
            <p className="text-[0.75rem] text-muted-foreground tabular-nums">
              {compte(callAttemptCount, 'appel')}
            </p>
          </div>
        );
      },
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
