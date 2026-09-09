import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Liste } from '@/components/chues/console-ui';
import { CHOIX_RELATION, LIBELLES_RELATION } from '@/components/representants/filtres';
import type { RelationRepresentant } from '@/components/representants/filtres';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { relationTranchee } from '@/lib/data/rep-campaigns';
import type { Representant } from '@/lib/data/representants';

const TOUS = 'tous';

const RELATIONS: readonly { value: string; label: string }[] = [
  { value: TOUS, label: 'Tous' },
  ...CHOIX_RELATION.map((relation) => ({
    value: relation,
    label: LIBELLES_RELATION[relation],
  })),
];

export function CriteresAnnuaire({
  search,
  relation,
  onSearch,
  onRelation,
}: {
  search: string;
  relation: RelationRepresentant | null;
  onSearch: (valeur: string) => void;
  onRelation: (valeur: RelationRepresentant | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <label htmlFor="rep-annuaire" className="text-[0.875rem] font-[600]">
          Qui avez-vous appelé ?
        </label>
        <Input
          id="rep-annuaire"
          type="search"
          autoComplete="off"
          placeholder="Chercher un représentant : nom ou numéro"
          className="h-12 text-[1rem]"
          value={search}
          onChange={(evenement) => {
            onSearch(evenement.target.value);
          }}
        />
      </div>
      <div className="flex min-w-[12rem] flex-col gap-1.5">
        <label htmlFor="rep-relation" className="text-[0.875rem] font-[600]">
          Qualification
        </label>
        <Liste
          id="rep-relation"
          items={RELATIONS}
          value={relation ?? TOUS}
          placeholder="Tous"
          onChange={(valeur) => {
            onRelation(valeur === TOUS ? null : (valeur as RelationRepresentant));
          }}
        />
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        <ChevronLeftIcon aria-hidden="true" />
        Page précédente
      </Button>
      <span className="min-w-20 text-center text-[0.9375rem] tabular-nums">
        {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        Page suivante
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Ce qu'une relation DÉJÀ TRANCHÉE ajoute à la confirmation d'ouverture. */
function Tranchee({ cible }: { cible: Representant }) {
  if (!relationTranchee(cible)) return null;
  return (
    <p className="text-[0.9375rem]">
      {cible.relationStatus === 'AMBASSADEUR'
        ? 'Cette personne a déjà accepté d’être représentant CPI CHUES.'
        : 'Cette personne a déjà refusé.'}
    </p>
  );
}

export function DialogueOuverture({
  cible,
  verrouActif,
  pending,
  onFermer,
  onConfirmer,
}: {
  cible: Representant | null;
  verrouActif: boolean;
  pending: boolean;
  onFermer: () => void;
  onConfirmer: (cible: Representant) => void;
}) {
  return (
    <ConfirmDialog
      open={cible !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onFermer();
      }}
      title={`Ouvrir la fiche de ${cible?.fullName ?? ''} ?`}
      description={verrouActif ? 'Vous ne pourrez pas la quitter sans la qualifier.' : null}
      confirmLabel="Ouvrir"
      confirmVariant="default"
      pending={pending}
      onConfirm={() => {
        if (cible !== null) onConfirmer(cible);
      }}
    >
      {cible === null ? null : <Tranchee cible={cible} />}
    </ConfirmDialog>
  );
}
