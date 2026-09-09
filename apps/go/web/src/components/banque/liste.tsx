import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FolderOpenIcon, PlusIcon } from 'lucide-react';

import { BarreFiltres } from '@/components/banque/barre-filtres';
import type { FiltresDossiers, TriDossiers } from '@/components/banque/filtres';
import {
  ADAPTATEUR_DOSSIERS,
  compterFiltres,
  requeteListe,
  TRIS,
  urlClasseur,
} from '@/components/banque/filtres';
import { CarteDossier, LigneDossier } from '@/components/banque/liste-lignes';
import { EtatVide } from '@/components/banque/pieces';
import { LienTelechargement } from '@/components/exports/liens';
import { QueryErrorState } from '@/components/query-error-state';
import { buttonVariants } from '@/components/ui/button';
import { PiedDeListe, SqueletteTableau } from '@/components/ui/pied-de-liste';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchDossiers, type PageDossiers } from '@/lib/data/bank-cases';
import { useFiltresUrl } from '@/lib/filtres-url';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

function estTri(id: string): id is TriDossiers {
  return (TRIS as readonly string[]).includes(id);
}

function Vide({ projet, filtres }: { projet: Projet; filtres: FiltresDossiers }) {
  if (compterFiltres(filtres) > 0) {
    return (
      <EtatVide
        icone={FolderOpenIcon}
        titre="Aucun dossier ne correspond à ces critères"
        description="Élargissez la période ou retirez un critère."
      />
    );
  }
  return (
    <EtatVide
      icone={FolderOpenIcon}
      titre="Aucun dossier bancaire"
      description="Ouvrez un dossier depuis « Nouveau dossier »."
      action={
        <Link
          to="/$projet/dossiers/nouveau"
          params={{ projet }}
          className={buttonVariants({ variant: 'outline' })}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau dossier
        </Link>
      }
    />
  );
}

export function ListeDossiers({ projet }: { projet: Projet }) {
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_DOSSIERS);
  const requete = requeteListe(filtres, PROJET_API[projet]);

  const dossiers = useQuery({
    queryKey: queryKeys.bankCases(requete),
    queryFn: () => fetchDossiers(requete),
    placeholderData: (precedent) => precedent,
  });

  function basculerTri(colonne: string): void {
    if (!estTri(colonne)) return;
    if (filtres.sortBy === colonne) {
      setFiltres({ sortDir: filtres.sortDir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    setFiltres({ sortBy: colonne, sortDir: 'asc' });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Dossiers ouverts sur des clients dont la méthode d’enrôlement est obtenue.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LienTelechargement
            href={urlClasseur(filtres, PROJET_API[projet])}
            label="Télécharger le classeur des dossiers filtrés"
          >
            Exporter
          </LienTelechargement>
          <Link to="/$projet/dossiers/nouveau" params={{ projet }} className={buttonVariants()}>
            <PlusIcon aria-hidden="true" />
            Nouveau dossier
          </Link>
        </div>
      </div>

      <BarreFiltres filtres={filtres} setFiltres={setFiltres} reinitialiser={reinitialiser} />

      <Resultats
        projet={projet}
        filtres={filtres}
        etat={dossiers}
        onTri={basculerTri}
        onPage={(page) => {
          setFiltres({ page });
        }}
      />
    </div>
  );
}

function Resultats({
  projet,
  filtres,
  etat,
  onTri,
  onPage,
}: {
  projet: Projet;
  filtres: FiltresDossiers;
  etat: UseQueryResult<PageDossiers>;
  onTri: (colonne: string) => void;
  onPage: (page: number) => void;
}) {
  if (etat.isPending) return <SqueletteTableau />;

  if (etat.isError) {
    return (
      <QueryErrorState
        error={etat.error}
        onRetry={() => {
          void etat.refetch();
        }}
        fallback="La liste des dossiers n’a pas pu être chargée."
      />
    );
  }

  const page = etat.data;
  if (page.items.length === 0) return <Vide projet={projet} filtres={filtres} />;

  return (
    <>
      <ul className={cn('flex flex-col gap-3 lg:hidden', etat.isFetching && 'opacity-80')}>
        {page.items.map((dossier) => (
          <li key={dossier.id}>
            <CarteDossier dossier={dossier} projet={projet} />
          </li>
        ))}
      </ul>

      <div
        className={cn(
          'hidden overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm lg:block',
          etat.isFetching && 'opacity-80',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column={{ id: 'reference', label: 'Référence' }}
                sortBy={filtres.sortBy}
                sortDir={filtres.sortDir}
                onToggle={onTri}
              />
              <SortableTableHead
                column={{ id: 'customerName', label: 'Client' }}
                sortBy={filtres.sortBy}
                sortDir={filtres.sortDir}
                onToggle={onTri}
              />
              <TableHead>Banque</TableHead>
              <TableHead>Étape</TableHead>
              <SortableTableHead
                column={{ id: 'amountXof', label: 'Montant' }}
                sortBy={filtres.sortBy}
                sortDir={filtres.sortDir}
                onToggle={onTri}
              />
              <TableHead>Dernier intervenant</TableHead>
              <SortableTableHead
                column={{ id: 'updatedAt', label: 'Mise à jour' }}
                sortBy={filtres.sortBy}
                sortDir={filtres.sortDir}
                onToggle={onTri}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((dossier) => (
              <LigneDossier key={dossier.id} dossier={dossier} projet={projet} />
            ))}
          </TableBody>
        </Table>
      </div>

      <PiedDeListe
        quoi="Dossiers affichés"
        total={page.total}
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        onPage={onPage}
      />
    </>
  );
}
