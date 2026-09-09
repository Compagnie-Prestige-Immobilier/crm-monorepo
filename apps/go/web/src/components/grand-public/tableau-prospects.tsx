import { Link } from '@tanstack/react-router';
import { InboxIcon } from 'lucide-react';

import { Absent } from '@/components/grand-public/absence';
import { TAILLES_PAGE } from '@/components/grand-public/filtres';
import { Badge } from '@/components/ui/badge';
import { PiedDeListe } from '@/components/ui/pied-de-liste';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Prospect } from '@/lib/data/console';
import {
  PROSPECT_STATUT_LABELS,
  PROSPECT_TYPE_LABELS,
  STATUT_VARIANT,
  type PageProspects,
} from '@/lib/data/grand-public';
import { formatDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

const COLONNES = [
  'Nom',
  'Statut',
  'Situation',
  'Profession',
  'Canal',
  'Banque',
  'Segment',
  'Téléconseiller',
  'Saisi le',
];

function Ligne({ prospect }: { prospect: Prospect }) {
  const journey = prospect.journeys?.find((item) => item.projet === 'GRAND_PUBLIC');
  const statut = journey?.statut ?? prospect.statut;
  const profession = prospect.profession;

  return (
    <TableRow>
      <TableCell>
        <Link
          to="/$projet/$id"
          params={{ projet: 'grand-public', id: prospect.id }}
          className="block min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="block truncate font-[600] underline-offset-2 hover:underline">
            {`${prospect.prenom} ${prospect.nom}`.trim()}
          </span>
          <span className="block truncate text-[0.75rem] text-muted-foreground">
            {formatPhone(prospect.phoneE164)}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant={STATUT_VARIANT[statut]}>{PROSPECT_STATUT_LABELS[statut]}</Badge>
      </TableCell>
      <TableCell>
        {prospect.type === null ? <Absent /> : PROSPECT_TYPE_LABELS[prospect.type]}
      </TableCell>
      <TableCell>
        {profession === null || profession === '' ? (
          <Absent>Non renseignée</Absent>
        ) : (
          <span className="truncate">{profession}</span>
        )}
      </TableCell>
      <TableCell>
        {prospect.canalProvenanceLabel === null ? (
          <Absent />
        ) : (
          <span className="truncate">{prospect.canalProvenanceLabel}</span>
        )}
      </TableCell>
      <TableCell>
        {prospect.banqueName === null ? (
          <Absent>Non renseignée</Absent>
        ) : (
          <span className="truncate">{prospect.banqueName}</span>
        )}
      </TableCell>
      {/* Sans banque NI syndicat, la fiche n'entre dans aucun BDD1-4. On l'écrit :
          la ranger dans BDD4 serait une réponse là où il n'y a qu'une absence. */}
      <TableCell>
        {prospect.segment === null ? (
          <Absent>Aucun</Absent>
        ) : (
          <Badge variant="outline">{prospect.segment}</Badge>
        )}
      </TableCell>
      <TableCell>
        <span className="truncate">{prospect.ownedByCommercialName}</span>
      </TableCell>
      <TableCell>
        <time dateTime={prospect.clientCreatedAt} className="whitespace-nowrap">
          {formatDate(prospect.clientCreatedAt)}
        </time>
      </TableCell>
    </TableRow>
  );
}

function detailVide(filtre: boolean, campagnes: boolean): string {
  if (filtre) return 'Élargissez la période ou retirez un critère.';
  if (campagnes) return 'Vos campagnes n’en contiennent aucun.';
  return 'La première fiche se crée depuis « Nouveau prospect ».';
}

export function TableauProspects({
  page,
  pageSize,
  filtre,
  campagnes,
  rafraichit,
  onPage,
  onTaille,
}: {
  page: PageProspects;
  pageSize: number;
  filtre: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campagnes: boolean;
  rafraichit: boolean;
  onPage: (page: number) => void;
  onTaille: (taille: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
          rafraichit && 'opacity-80',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLONNES.map((colonne) => (
                <TableHead key={colonne}>{colonne}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLONNES.length} className="py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="font-[600]">
                      {filtre
                        ? 'Aucun prospect ne correspond à ces filtres.'
                        : 'Aucun prospect Grand Public n’a encore été saisi.'}
                    </p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {detailVide(filtre, campagnes)}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              page.items.map((prospect) => <Ligne key={prospect.id} prospect={prospect} />)
            )}
          </TableBody>
        </Table>
      </div>

      <PiedDeListe
        quoi="Prospects affichés"
        total={page.total}
        page={page.page}
        pageCount={page.pageCount}
        pageSize={pageSize}
        onPage={onPage}
        actions={
          <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
            <span className="hidden sm:inline">Lignes</span>
            <Select
              value={String(pageSize)}
              onValueChange={(valeur) => {
                if (valeur === null) return;
                onTaille(Number(valeur));
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Lignes par page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAILLES_PAGE.map((taille) => (
                  <SelectItem key={taille} value={String(taille)}>
                    {String(taille)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        }
      />
    </div>
  );
}
