'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { PhoneCallIcon, RotateCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { callbackKeys } from '@/lib/data/console';
import { fetchProspectsAppeles } from '@/lib/data/prospects';
import { SUIVI_PAGE_SIZE, fetchRepresentantsAppeles } from '@/lib/data/representants';
import { fetchUsers } from '@/lib/data/users';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_VARIANTS,
  PHASE2_STATUSES,
  PHASE2_STATUS_LABELS,
  REP_CALL_OUTCOME_LABELS,
  REP_CALL_OUTCOME_VARIANTS,
  type Paginated,
  type Projet,
  type ProspectRow,
  type RepresentantRow,
} from '@/lib/types';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

type Onglet = 'PROSPECTS' | 'REPRESENTANTS';

const ONGLETS: readonly { value: Onglet; label: string }[] = [
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
];

const PROJET_OPTIONS = [
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

const PROSPECT_ISSUE_OPTIONS = [
  { value: 'NRP', label: 'NRP' },
  { value: 'A_RAPPELER', label: 'À rappeler' },
  { value: 'TRANSFERT_ENROLEMENT', label: 'Transfert enrôlement' },
  { value: 'REFUS', label: 'Refus' },
  { value: 'FAUX_NUMERO', label: 'Faux numéro' },
  { value: 'DECES', label: 'Décès' },
  { value: 'AUTRE', label: 'Autre' },
];

const REP_ISSUE_OPTIONS = [
  { value: 'NRP', label: 'NRP' },
  { value: 'A_RAPPELER', label: 'À rappeler' },
  { value: 'ACCORD', label: 'Accord' },
  { value: 'REFUS', label: 'Refus' },
  { value: 'FAUX_NUMERO', label: 'Faux numéro' },
  { value: 'DECES', label: 'Décès' },
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

  const proj = projet ?? null;

  const lastCallById = canFilter ? (filtreId ?? userId) : userId;

  const avecRepresentants = proj !== 'GRAND_PUBLIC';
  const vueRepresentants = avecRepresentants && onglet === 'REPRESENTANTS';

  const prospects = useQuery({
    queryKey: ['mes-contacts', 'prospects', proj, lastCallById],
    queryFn: () => fetchProspectsAppeles(lastCallById, proj),
    enabled: !vueRepresentants,
    placeholderData: (previous) => previous,
  });

  const representants = useQuery({
    queryKey: ['mes-contacts', 'representants', lastCallById],
    queryFn: () => fetchRepresentantsAppeles(lastCallById),
    enabled: vueRepresentants,
    placeholderData: (previous) => previous,
  });

  const teleconseillers = useQuery({
    queryKey: callbackKeys.teleconseillers,
    queryFn: () =>
      fetchUsers({ ...EMPTY_USER_FILTERS, role: 'COMMERCIAL', isActive: true, pageSize: 200 }),
    enabled: canFilter,
    staleTime: 300_000,
  });

  const hasActiveFilters =
    search.trim() !== '' ||
    projetFiltre !== null ||
    issueFiltre !== null ||
    statutFiltre !== null ||
    filtreId !== null;

  const resetFilters = () => {
    setSearch('');
    setProjetFiltre(null);
    setIssueFiltre(null);
    setStatutFiltre(null);
    setFiltreId(null);
  };

  const filteredProspects = (prospects.data?.items ?? []).filter((item) => {
    if (search.trim() !== '') {
      const q = search.trim().toLowerCase();
      const nom = `${item.prenom} ${item.nom}`.toLowerCase();
      const phone = (item.phoneE164 ?? '').toLowerCase();
      if (!nom.includes(q) && !phone.includes(q)) return false;
    }
    const currentProjet = proj ?? (projetFiltre as Projet | null);
    if (currentProjet !== null && item.projet !== currentProjet) return false;
    if (issueFiltre !== null && item.lastCallOutcome !== issueFiltre) return false;
    if (statutFiltre !== null && item.phase2Status !== statutFiltre) return false;
    return true;
  });

  const filteredRepresentants = (representants.data?.items ?? []).filter((item) => {
    if (search.trim() !== '') {
      const q = search.trim().toLowerCase();
      const nom = item.fullName.toLowerCase();
      const phone = (item.phoneE164 ?? '').toLowerCase();
      if (!nom.includes(q) && !phone.includes(q)) return false;
    }
    if (issueFiltre !== null && item.lastCallOutcome !== issueFiltre) return false;
    if (
      statutFiltre !== null &&
      item.relationStatus !== statutFiltre &&
      item.statutQualificationLabel !== statutFiltre
    ) {
      return false;
    }
    return true;
  });

  return (
    <section className="flex flex-col gap-4">
      <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        Mes contacts regroupe les personnes déjà appelées par vous. Le projet est affiché sur chaque
        fiche.
      </p>

      {/* ─── Barre de recherche et de filtres ──────────────────────────── */}
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
              options={(teleconseillers.data?.items ?? []).map((user) => ({
                value: user.id,
                label: user.fullName,
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
            options={vueRepresentants ? REP_ISSUE_OPTIONS : PROSPECT_ISSUE_OPTIONS}
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

      {avecRepresentants ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type de contact">
          {ONGLETS.map((entree) => (
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
      ) : null}

      {vueRepresentants ? (
        <Liste
          liste={representants}
          itemsFiltered={filteredRepresentants}
          hasFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          vide="Un représentant apparaît ici dès que vous consignez un appel sur sa fiche."
          echec="Les représentants appelés n’ont pas pu être lus."
        >
          {(items) => <TableRepresentants items={items} />}
        </Liste>
      ) : (
        <Liste
          liste={prospects}
          itemsFiltered={filteredProspects}
          hasFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          vide="Un prospect apparaît ici dès que vous consignez un appel sur sa fiche."
          echec="Les prospects appelés n’ont pas pu être lus."
        >
          {(items) => <TableProspects items={items} projet={proj} />}
        </Liste>
      )}
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
}: {
  liste: UseQueryResult<Paginated<T>>;
  itemsFiltered: T[];
  hasFilters: boolean;
  onResetFilters: () => void;
  vide: string;
  echec: string;
  children: (items: T[]) => ReactNode;
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
    </div>
  );
}

function EnTete() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Nom</TableHead>
        <TableHead>Téléphone</TableHead>
        <TableHead>Dernier appel</TableHead>
        <TableHead>Issue</TableHead>
        <TableHead>Statut</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function EnTeteProspects() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Projet</TableHead>
        <TableHead>Nom</TableHead>
        <TableHead>Téléphone</TableHead>
        <TableHead>Dernier appel</TableHead>
        <TableHead>Issue</TableHead>
        <TableHead>Statut</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function Quand({ at }: { at: string | null }) {
  if (at === null) return SANS_VALEUR;
  return <time dateTime={at}>{formatDateTime(at)}</time>;
}

function TableRepresentants({ items }: { items: RepresentantRow[] }) {
  return (
    <Table>
      <EnTete />
      <TableBody>
        {items.map((representant) => (
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
              {representant.lastCallOutcome === null ? (
                SANS_VALEUR
              ) : (
                <Badge variant={REP_CALL_OUTCOME_VARIANTS[representant.lastCallOutcome]}>
                  {REP_CALL_OUTCOME_LABELS[representant.lastCallOutcome]}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <RelationBadge
                status={representant.relationStatus}
                label={representant.statutQualificationLabel}
                effect={representant.statutQualificationEffect}
                lastCallOutcome={representant.lastCallOutcome}
              />
            </TableCell>
          </LigneVersFiche>
        ))}
      </TableBody>
    </Table>
  );
}

function TableProspects({ items, projet }: { items: ProspectRow[]; projet: Projet | null }) {
  return (
    <Table>
      <EnTeteProspects />
      <TableBody>
        {items.map((prospect) => (
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
              {prospect.lastCallOutcome === null ? (
                SANS_VALEUR
              ) : (
                <Badge variant={CALL_OUTCOME_VARIANTS[prospect.lastCallOutcome]}>
                  {prospect.lastReasonLabel ?? CALL_OUTCOME_LABELS[prospect.lastCallOutcome]}
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
