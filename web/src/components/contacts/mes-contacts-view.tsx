'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { PhoneCallIcon, RotateCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { MesClients } from '@/components/contacts/mes-clients';
import { PipelineContactsBande } from '@/components/contacts/pipeline-contacts';
import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { useTriLocal } from '@/components/ui/tri-local';
import { callbackKeys } from '@/lib/data/console';
import { fetchProspectsAppeles } from '@/lib/data/prospects';
import { SUIVI_PAGE_SIZE, fetchRepresentantsAppeles } from '@/lib/data/representants';
import { fetchUsers } from '@/lib/data/users';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import {
  PHASE2_STATUSES,
  PHASE2_STATUS_LABELS,
  type Paginated,
  type Projet,
  type ProspectRow,
  type RepresentantRow,
} from '@/lib/types';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

type Onglet = 'PROSPECTS' | 'REPRESENTANTS' | 'CLIENTS';

const ONGLETS: readonly { value: Onglet; label: string }[] = [
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
  { value: 'CLIENTS', label: 'Clients' },
];

const PROJET_OPTIONS = [
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

const ISSUE_OPTIONS = [
  { value: 'JOIGNABLE', label: 'Joignable' },
  { value: 'INJOIGNABLE', label: 'Injoignable' },
];

const PROSPECT_STATUT_OPTIONS = PHASE2_STATUSES.map((status) => ({
  value: status,
  label: PHASE2_STATUS_LABELS[status],
}));

const REP_STATUT_OPTIONS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'METHODE_OBTENUE', label: 'Méthode obtenue' },
  { value: 'AMBASSADEUR', label: 'Ambassadeur' },
  { value: 'ARCHIVE', label: 'Archivé' },
];

const SANS_VALEUR = <span className="text-muted-foreground">–</span>;

/** Section « Appels » des fiches CHUES. Grand Public n'en a pas encore. */
const ANCRE_APPELS = '#appels';

const ficheProspect = (projet: Projet | null | undefined, prospect: ProspectRow): string =>
  `/teleconseil/prospects/${prospect.id}${projet === 'GRAND_PUBLIC' ? '' : ANCRE_APPELS}`;

const ficheRepresentant = (id: string): string => `/teleconseil/representants/${id}${ANCRE_APPELS}`;

function LigneVersFiche({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <TableRow
      className="h-11 cursor-pointer"
      onClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('a') !== null) return;
        // Relâcher une sélection de texte ne doit pas quitter la liste.
        if (window.getSelection()?.isCollapsed === false) return;
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}

function matchesSearch(nom: string, phone: string, search: string): boolean {
  if (search.trim() === '') return true;
  const q = search.trim().toLowerCase();
  return nom.toLowerCase().includes(q) || phone.toLowerCase().includes(q);
}

function filterProspectItem(
  item: ProspectRow,
  search: string,
  targetProjet: Projet | null,
  issueFiltre: string | null,
  statutFiltre: string | null,
): boolean {
  if (!matchesSearch(`${item.prenom} ${item.nom}`, item.phoneE164 ?? '', search)) return false;
  if (targetProjet !== null && item.projet !== targetProjet) return false;
  if (issueFiltre === 'JOIGNABLE' && item.lastJoignable !== true) return false;
  if (issueFiltre === 'INJOIGNABLE' && item.lastJoignable !== false) return false;
  return statutFiltre === null || item.phase2Status === statutFiltre;
}

function filterRepresentantItem(
  item: RepresentantRow,
  search: string,
  issueFiltre: string | null,
  statutFiltre: string | null,
): boolean {
  if (!matchesSearch(item.fullName, item.phoneE164 ?? '', search)) return false;
  const joignable =
    item.statutQualificationEffect !== null && item.statutQualificationEffect !== 'UNREACHABLE';
  if (issueFiltre === 'JOIGNABLE' && !joignable) return false;
  if (issueFiltre === 'INJOIGNABLE' && joignable) return false;
  if (statutFiltre === null) return true;
  return item.relationStatus === statutFiltre || item.statutQualificationLabel === statutFiltre;
}

function checkActiveFilters(
  search: string,
  projetFiltre: string | null,
  issueFiltre: string | null,
  statutFiltre: string | null,
  filtreId: string | null,
): boolean {
  if (search.trim() !== '') return true;
  if (projetFiltre !== null) return true;
  if (issueFiltre !== null) return true;
  if (statutFiltre !== null) return true;
  return filtreId !== null;
}

function MesContactsListContent({
  onglet,
  appelePar,
  vueRepresentants,
  representants,
  filteredRepresentants,
  prospects,
  filteredProspects,
  hasActiveFilters,
  resetFilters,
  proj,
  page,
  onPage,
}: {
  onglet: Onglet;
  appelePar: string;
  vueRepresentants: boolean;
  representants: UseQueryResult<Paginated<RepresentantRow>>;
  filteredRepresentants: RepresentantRow[];
  prospects: UseQueryResult<Paginated<ProspectRow>>;
  filteredProspects: ProspectRow[];
  hasActiveFilters: boolean;
  resetFilters: () => void;
  proj: Projet | null;
  page: number;
  onPage: (page: number) => void;
}) {
  if (onglet === 'CLIENTS') {
    return <MesClients appelePar={appelePar} projet={proj} />;
  }
  if (vueRepresentants) {
    return (
      <Liste
        liste={representants}
        itemsFiltered={filteredRepresentants}
        hasFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        vide="Un représentant apparaît ici dès que vous consignez un appel sur sa fiche."
        echec="Les représentants appelés n’ont pas pu être lus."
        page={page}
        onPage={onPage}
      >
        {(items) => <TableRepresentants items={items} />}
      </Liste>
    );
  }
  return (
    <Liste
      liste={prospects}
      itemsFiltered={filteredProspects}
      hasFilters={hasActiveFilters}
      onResetFilters={resetFilters}
      vide="Un prospect apparaît ici dès que vous consignez un appel sur sa fiche."
      echec="Les prospects appelés n’ont pas pu être lus."
      page={page}
      onPage={onPage}
    >
      {(items) => <TableProspects items={items} projet={proj} />}
    </Liste>
  );
}

function MesContactsFilterBar({
  search,
  setSearch,
  proj,
  projetFiltre,
  setProjetFiltre,
  canFilter,
  teleconseillers,
  filtreId,
  setFiltreId,
  vueRepresentants,
  issueFiltre,
  setIssueFiltre,
  statutFiltre,
  setStatutFiltre,
  hasActiveFilters,
  resetFilters,
}: {
  search: string;
  setSearch: (search: string) => void;
  proj: Projet | null;
  projetFiltre: string | null;
  setProjetFiltre: (val: string | null) => void;
  canFilter: boolean;
  teleconseillers: { id: string; fullName: string; isActive: boolean }[];
  filtreId: string | null;
  setFiltreId: (val: string | null) => void;
  vueRepresentants: boolean;
  issueFiltre: string | null;
  setIssueFiltre: (val: string | null) => void;
  statutFiltre: string | null;
  setStatutFiltre: (val: string | null) => void;
  hasActiveFilters: boolean;
  resetFilters: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Nom, prénom, téléphone…"
        className="min-w-[14rem] flex-1"
      />

      {proj === null ? (
        <div className="flex min-w-[10rem] flex-col gap-1.5 sm:max-w-xs">
          <FilterCombobox
            label="Projet"
            placeholder="Tous les projets"
            options={PROJET_OPTIONS}
            value={projetFiltre}
            onChange={setProjetFiltre}
          />
        </div>
      ) : null}

      {canFilter ? (
        <div className="flex min-w-[12rem] flex-col gap-1.5 sm:max-w-xs">
          <FilterCombobox
            label="Appelé par"
            placeholder="Mes appels"
            options={teleconseillers.map((user) => ({
              value: user.id,
              label: user.isActive ? user.fullName : `${user.fullName} (compte fermé)`,
            }))}
            value={filtreId}
            onChange={setFiltreId}
          />
        </div>
      ) : null}

      <div className="flex min-w-[11rem] flex-col gap-1.5 sm:max-w-xs">
        <FilterCombobox
          label="Issue de l’appel"
          placeholder="Toutes les issues"
          options={ISSUE_OPTIONS}
          value={issueFiltre}
          onChange={setIssueFiltre}
        />
      </div>

      <div className="flex min-w-[11rem] flex-col gap-1.5 sm:max-w-xs">
        <FilterCombobox
          label="Statut"
          placeholder="Tous les statuts"
          options={vueRepresentants ? REP_STATUT_OPTIONS : PROSPECT_STATUT_OPTIONS}
          value={statutFiltre}
          onChange={setStatutFiltre}
        />
      </div>

      {hasActiveFilters ? (
        <Button variant="ghost" onClick={resetFilters} className="h-11 gap-1.5">
          <RotateCcwIcon className="size-4" aria-hidden="true" />
          Réinitialiser
        </Button>
      ) : null}
    </div>
  );
}

function computeLastCallId(canFilter: boolean, filtreId: string | null, userId: string): string {
  if (!canFilter) return userId;
  return filtreId ?? userId;
}

function MesContactsTabsToggle({
  avecRepresentants,
  onglet,
  setOnglet,
}: {
  avecRepresentants: boolean;
  onglet: Onglet;
  setOnglet: (val: Onglet) => void;
}) {
  const entrees = ONGLETS.filter((entree) => avecRepresentants || entree.value !== 'REPRESENTANTS');
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Type de contact">
      {entrees.map((entree) => (
        <Button
          key={entree.value}
          type="button"
          variant={entree.value === onglet ? 'default' : 'outline'}
          aria-pressed={entree.value === onglet}
          onClick={() => {
            setOnglet(entree.value);
          }}
        >
          {entree.label}
        </Button>
      ))}
    </div>
  );
}

export function MesContactsView({
  projet,
  userId,
  canFilter,
}: {
  projet?: Projet | null | undefined;
  userId: string;
  canFilter: boolean;
}) {
  const [onglet, setOnglet] = useState<Onglet>('PROSPECTS');
  const [search, setSearch] = useState('');
  const [projetFiltre, setProjetFiltre] = useState<string | null>(null);
  const [issueFiltre, setIssueFiltre] = useState<string | null>(null);
  const [statutFiltre, setStatutFiltre] = useState<string | null>(null);
  const [filtreId, setFiltreId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const proj = projet ?? null;
  const lastCallById = computeLastCallId(canFilter, filtreId, userId);

  const avecRepresentants = proj !== 'GRAND_PUBLIC';
  const vueRepresentants = avecRepresentants && onglet === 'REPRESENTANTS';

  const prospects = useQuery({
    queryKey: ['mes-contacts', 'prospects', proj, lastCallById, page],
    queryFn: () => fetchProspectsAppeles(lastCallById, proj, page),
    enabled: !vueRepresentants,
    placeholderData: (previous) => previous,
  });

  const representants = useQuery({
    queryKey: ['mes-contacts', 'representants', lastCallById, page],
    queryFn: () => fetchRepresentantsAppeles(lastCallById, page),
    enabled: vueRepresentants,
    placeholderData: (previous) => previous,
  });

  const teleconseillers = useQuery({
    queryKey: callbackKeys.teleconseillers,
    // Comptes fermés et rôles changés compris : leurs appels restent lisibles.
    queryFn: () => fetchUsers({ ...EMPTY_USER_FILTERS, pageSize: 200 }),
    enabled: canFilter,
    staleTime: 300_000,
  });

  const hasActiveFilters = checkActiveFilters(
    search,
    projetFiltre,
    issueFiltre,
    statutFiltre,
    filtreId,
  );

  const resetFilters = () => {
    setSearch('');
    setProjetFiltre(null);
    setIssueFiltre(null);
    setStatutFiltre(null);
    setFiltreId(null);
  };

  const targetProjet = proj ?? (projetFiltre as Projet | null);
  const filteredProspects = (prospects.data?.items ?? []).filter((item) =>
    filterProspectItem(item, search, targetProjet, issueFiltre, statutFiltre),
  );

  const filteredRepresentants = (representants.data?.items ?? []).filter((item) =>
    filterRepresentantItem(item, search, issueFiltre, statutFiltre),
  );

  return (
    <section className="flex flex-col gap-4">
      <MesContactsFilterBar
        search={search}
        setSearch={setSearch}
        proj={proj}
        projetFiltre={projetFiltre}
        setProjetFiltre={setProjetFiltre}
        canFilter={canFilter}
        teleconseillers={teleconseillers.data?.items ?? []}
        filtreId={filtreId}
        setFiltreId={setFiltreId}
        vueRepresentants={vueRepresentants}
        issueFiltre={issueFiltre}
        setIssueFiltre={setIssueFiltre}
        statutFiltre={statutFiltre}
        setStatutFiltre={setStatutFiltre}
        hasActiveFilters={hasActiveFilters}
        resetFilters={resetFilters}
      />

      <MesContactsTabsToggle
        avecRepresentants={avecRepresentants}
        onglet={onglet}
        setOnglet={setOnglet}
      />

      <PipelineContactsBande
        appelePar={lastCallById}
        projet={targetProjet}
        masquee={onglet !== 'PROSPECTS'}
      />

      <MesContactsListContent
        onglet={onglet}
        appelePar={lastCallById}
        vueRepresentants={vueRepresentants}
        representants={representants}
        filteredRepresentants={filteredRepresentants}
        prospects={prospects}
        filteredProspects={filteredProspects}
        hasActiveFilters={hasActiveFilters}
        resetFilters={resetFilters}
        proj={proj}
        page={page}
        onPage={setPage}
      />
    </section>
  );
}

function suiviTextLabel<T>(hasFilters: boolean, itemsFiltered: T[], data: Paginated<T>): string {
  if (hasFilters) {
    return `${formatNumber(itemsFiltered.length)} affiché${itemsFiltered.length > 1 ? 's' : ''} sur ${formatNumber(data.items.length)}`;
  }
  if (data.total > data.items.length) {
    return `${formatNumber(data.total)} au total, les ${formatNumber(SUIVI_PAGE_SIZE)} plus récents sont affichés.`;
  }
  return `${formatNumber(data.items.length)} contact${data.items.length > 1 ? 's' : ''}`;
}

function Liste<T>({
  liste,
  itemsFiltered,
  hasFilters,
  onResetFilters,
  vide,
  echec,
  children,
  page,
  onPage,
}: {
  liste: UseQueryResult<Paginated<T>>;
  itemsFiltered: T[];
  hasFilters: boolean;
  onResetFilters: () => void;
  vide: string;
  echec: string;
  children: (items: T[]) => ReactNode;
  page: number;
  onPage: (page: number) => void;
}) {
  const data = liste.data;
  const hasData = data !== undefined;

  if (shouldShowError({ isError: liste.isError, hasData })) {
    return (
      <QueryErrorState
        error={liste.error}
        fallback={echec}
        onRetry={() => {
          void liste.refetch();
        }}
      />
    );
  }

  if (!hasData || shouldShowSkeleton({ isPending: liste.isPending, hasData })) {
    return <Skeleton className="h-64" />;
  }

  if (data.items.length === 0) {
    return <EmptyState icon={PhoneCallIcon} title="Aucun appel enregistré" description={vide} />;
  }

  if (itemsFiltered.length === 0 && hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun contact ne correspond aux critères de filtre sélectionnés.
        </p>
        <Button variant="outline" size="sm" onClick={onResetFilters}>
          <RotateCcwIcon className="mr-2 size-4" aria-hidden="true" />
          Réinitialiser les filtres
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.8125rem] text-muted-foreground">
        {suiviTextLabel(hasFilters, itemsFiltered, data)}
      </p>
      {children(itemsFiltered)}
      {data.pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Précédente
          </Button>
          <span>Page {data.page} sur {data.pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pageCount} onClick={() => onPage(page + 1)}>
            Suivante
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const COLONNES_REPRESENTANTS_CONTACTS = {
  nom: (representant: RepresentantRow) => representant.fullName,
  telephone: (representant: RepresentantRow) => representant.phoneE164,
  appel: (representant: RepresentantRow) => representant.lastCallAt,
  issue: (representant: RepresentantRow) => representant.statutQualificationLabel,
  statut: (representant: RepresentantRow) => representant.statutQualificationLabel,
};

const ENTETES_REPRESENTANTS_CONTACTS = [
  { id: 'nom', label: 'Nom' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'appel', label: 'Dernier appel' },
  { id: 'issue', label: 'Issue' },
  { id: 'statut', label: 'Statut' },
] as const;

const COLONNES_PROSPECTS_CONTACTS = {
  projet: (prospect: ProspectRow) => prospect.projet,
  nom: (prospect: ProspectRow) => `${prospect.prenom} ${prospect.nom}`,
  telephone: (prospect: ProspectRow) => prospect.phoneE164,
  appel: (prospect: ProspectRow) => prospect.lastCallAt,
  issue: (prospect: ProspectRow) => prospect.lastReasonLabel,
  statut: (prospect: ProspectRow) => prospect.phase2Status,
};

const ENTETES_PROSPECTS_CONTACTS = [
  { id: 'projet', label: 'Projet' },
  { id: 'nom', label: 'Nom' },
  { id: 'telephone', label: 'Téléphone' },
  { id: 'appel', label: 'Dernier appel' },
  { id: 'issue', label: 'Issue' },
  { id: 'statut', label: 'Statut' },
] as const;

function Quand({ at }: { at: string | null }) {
  if (at === null) return SANS_VALEUR;
  return <time dateTime={at}>{formatDateTime(at)}</time>;
}

function TableRepresentants({ items }: { items: RepresentantRow[] }) {
  const tri = useTriLocal(items, COLONNES_REPRESENTANTS_CONTACTS);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {ENTETES_REPRESENTANTS_CONTACTS.map((colonne) => (
            <SortableTableHead
              key={colonne.id}
              column={colonne}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tri.lignes.map((representant) => (
          <LigneVersFiche key={representant.id} href={ficheRepresentant(representant.id)}>
            <TableCell>
              <Link
                href={ficheRepresentant(representant.id)}
                className="font-[600] underline underline-offset-4"
              >
                {representant.fullName}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{formatPhone(representant.phoneE164)}</TableCell>
            <TableCell>
              <Quand at={representant.lastCallAt} />
            </TableCell>
            <TableCell>
              {representant.statutQualificationLabel === null ? (
                SANS_VALEUR
              ) : (
                <Badge
                  variant={
                    representant.statutQualificationEffect === 'UNREACHABLE' ? 'warning' : 'info'
                  }
                >
                  {representant.statutQualificationLabel}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <RelationBadge
                status={representant.relationStatus}
                label={representant.statutQualificationLabel}
                effect={representant.statutQualificationEffect}
              />
            </TableCell>
          </LigneVersFiche>
        ))}
      </TableBody>
    </Table>
  );
}

function TableProspects({ items, projet }: { items: ProspectRow[]; projet: Projet | null }) {
  const tri = useTriLocal(items, COLONNES_PROSPECTS_CONTACTS);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {ENTETES_PROSPECTS_CONTACTS.map((colonne) => (
            <SortableTableHead
              key={colonne.id}
              column={colonne}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tri.lignes.map((prospect) => (
          <LigneVersFiche key={prospect.id} href={ficheProspect(projet, prospect)}>
            <TableCell>
              <ProjetBadge projet={prospect.projet} />
            </TableCell>
            <TableCell>
              <Link
                href={ficheProspect(projet, prospect)}
                className="font-[600] underline underline-offset-4"
              >
                {prospect.prenom} {prospect.nom}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{formatPhone(prospect.phoneE164)}</TableCell>
            <TableCell>
              <Quand at={prospect.lastCallAt} />
            </TableCell>
            <TableCell>
              {prospect.lastReasonLabel === null ? (
                SANS_VALEUR
              ) : (
                <Badge variant={prospect.lastJoignable === false ? 'warning' : 'info'}>
                  {prospect.lastReasonLabel}
                </Badge>
              )}
            </TableCell>
            <TableCell>{PHASE2_STATUS_LABELS[prospect.phase2Status]}</TableCell>
          </LigneVersFiche>
        ))}
      </TableBody>
    </Table>
  );
}
