import { Link } from '@tanstack/react-router';
import { InboxIcon } from 'lucide-react';

import { LIBELLES_TRI, TRIS, type TriProspects } from '@/components/prospects/filtres';
import { MenuActions, type ActionsProspect } from '@/components/prospects/liste-actions';
import { Badge } from '@/components/ui/badge';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SEGMENT_LABELS } from '@/components/campagnes/cibles';
import { LIBELLES_METHODE } from '@/components/chues/conversion-champs';
import { CALL_OUTCOME_LABELS, PHASE2_STATUS_LABELS } from '@/lib/data/console';
import { PROSPECT_STATUT_LABELS, STATUT_VARIANT } from '@/lib/data/grand-public';
import type { Prospect } from '@/lib/data/prospects';

export type { ActionsProspect };
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { lien } from '@/lib/nav';
import type { Projet } from '@/lib/types';

const SANS_VALEUR = '–';

/** `Prospect` porte ces deux colonnes en chaîne libre : le libellé retombe sur le code. */
function libelleMethode(code: string): string {
  return LIBELLES_METHODE[code as keyof typeof LIBELLES_METHODE] ?? code;
}

function libelleIssue(code: string): string {
  return CALL_OUTCOME_LABELS[code as keyof typeof CALL_OUTCOME_LABELS] ?? code;
}

const PHASE2_VARIANTE = {
  PENDING: 'secondary',
  METHOD_OBTAINED: 'success',
  REFUSED: 'destructive',
  WRONG_NUMBER: 'warning',
} as const;

function Vide() {
  return <span className="text-muted-foreground">{SANS_VALEUR}</span>;
}

function LigneProspect({
  prospect,
  projet,
  peutAdministrer,
  actions,
}: {
  prospect: Prospect;
  projet: Projet;
  peutAdministrer: boolean;
  actions: ActionsProspect | null;
}) {
  const dernier = prospect.lastOutcome;
  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate font-[600]">
            <Link
              {...lien(`/${projet}/prospects/${prospect.id}`)}
              className="underline-offset-4 hover:underline"
            >
              {prospect.prenom} {prospect.nom}
            </Link>
          </p>
          <p className="truncate text-[0.75rem] text-muted-foreground tabular-nums">
            {formatPhone(prospect.phoneE164)}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={STATUT_VARIANT[prospect.statut]}>
          {PROSPECT_STATUT_LABELS[prospect.statut]}
        </Badge>
      </TableCell>
      <TableCell>
        {/* Une fiche sans banque ni syndicat n'est dans aucune base : on l'écrit,
            plutôt que de la ranger dans BDD4 qui est une réponse, pas une absence. */}
        {prospect.segment === null ? (
          <span className="text-muted-foreground">Aucun</span>
        ) : (
          <Badge variant="outline" title={SEGMENT_LABELS[prospect.segment]}>
            {prospect.segment}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={PHASE2_VARIANTE[prospect.phase2Status]}>
          {PHASE2_STATUS_LABELS[prospect.phase2Status]}
        </Badge>
      </TableCell>
      <TableCell className="truncate">
        {prospect.enrollmentMethod === null ? <Vide /> : libelleMethode(prospect.enrollmentMethod)}
      </TableCell>
      <TableCell>
        {dernier === null ? (
          <Vide />
        ) : (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate font-[600]">{libelleIssue(dernier)}</p>
            {prospect.lastAttemptAt === null ? null : (
              <time
                dateTime={prospect.lastAttemptAt}
                className="block text-[0.75rem] text-muted-foreground tabular-nums"
              >
                {formatDateTime(prospect.lastAttemptAt)}
              </time>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="truncate">{prospect.representantName ?? SANS_VALEUR}</TableCell>
      <TableCell className="truncate">{prospect.departementName ?? SANS_VALEUR}</TableCell>
      <TableCell className="truncate">{prospect.banqueName ?? SANS_VALEUR}</TableCell>
      <TableCell className="truncate">{prospect.syndicatSigle ?? SANS_VALEUR}</TableCell>
      <TableCell className="truncate">{prospect.ownedByCommercialName}</TableCell>
      <TableCell>
        <time dateTime={prospect.clientCreatedAt} className="whitespace-nowrap tabular-nums">
          {formatDate(prospect.clientCreatedAt)}
        </time>
      </TableCell>
      {actions === null ? null : (
        <TableCell className="text-right">
          <MenuActions prospect={prospect} peutAdministrer={peutAdministrer} actions={actions} />
        </TableCell>
      )}
    </TableRow>
  );
}

const COLONNES: { id: string; label: string }[] = [
  { id: 'nom', label: 'Nom' },
  { id: 'statut', label: 'Statut' },
  { id: 'segment', label: 'Segment' },
  { id: 'phase2Status', label: 'Résultat de l’appel' },
  { id: 'enrollmentMethod', label: 'Méthode' },
  { id: 'lastCallAt', label: 'Dernier appel' },
  { id: 'representantName', label: 'Représentant' },
  { id: 'departementName', label: 'Département' },
  { id: 'banque', label: 'Banque' },
  { id: 'syndicat', label: 'Syndicat' },
  { id: 'ownedByCommercialName', label: 'Téléconseiller' },
  { id: 'clientCreatedAt', label: 'Saisi le' },
];

function estTri(id: string): id is TriProspects {
  return (TRIS as readonly string[]).includes(id);
}

export function TableauProspects({
  items,
  projet,
  peutAdministrer,
  actions,
  sortBy,
  sortDir,
  onTrier,
}: {
  items: readonly Prospect[];
  projet: Projet;
  peutAdministrer: boolean;
  actions: ActionsProspect | null;
  sortBy: TriProspects;
  sortDir: 'asc' | 'desc';
  onTrier: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLONNES.map((colonne) =>
            estTri(colonne.id) ? (
              <SortableTableHead
                key={colonne.id}
                column={{ id: colonne.id, label: LIBELLES_TRI[colonne.id] }}
                sortBy={sortBy}
                sortDir={sortDir}
                onToggle={onTrier}
              />
            ) : (
              <TableHead key={colonne.id}>{colonne.label}</TableHead>
            ),
          )}
          {actions === null ? null : (
            <TableHead className="w-14">
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((prospect) => (
          <LigneProspect
            key={prospect.id}
            prospect={prospect}
            projet={projet}
            peutAdministrer={peutAdministrer}
            actions={actions}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export function ProspectsVides({ porteeCampagne }: { porteeCampagne: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-[600]">Aucun prospect ne correspond à ces filtres.</p>
      <p className="text-[0.8125rem] text-muted-foreground">
        {porteeCampagne
          ? 'Vos campagnes n’en contiennent aucun.'
          : 'Élargissez la période ou retirez un critère.'}
      </p>
    </div>
  );
}
