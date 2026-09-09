import { PlusIcon, RotateCcwIcon, SearchIcon } from 'lucide-react';

import { ChampDate, ChampListe, ChampRecherche, type Choix } from '@/components/accueil/champs';
import { Button } from '@/components/ui/button';
import {
  COLONNES_VISITE,
  compterFiltresVisite,
  type EntreeReferentielVisite,
  type FiltresVisite,
  type ReferentielsVisite,
} from '@/lib/data/visites';

function choix(entrees: readonly EntreeReferentielVisite[] | null | undefined): Choix[] {
  return (entrees ?? []).map((entree) => ({ value: entree.id, label: entree.label }));
}

export function RegistreFiltres({
  filtres,
  referentiels,
  jourSeul,
  ouvert,
  onOuvrir,
  onAjouter,
  onChange,
  onReinitialiser,
}: {
  filtres: FiltresVisite;
  referentiels: ReferentielsVisite | undefined;
  jourSeul: boolean;
  ouvert: boolean;
  onOuvrir: () => void;
  onAjouter: () => void;
  onChange: (patch: Partial<FiltresVisite>) => void;
  onReinitialiser: () => void;
}) {
  const poses = compterFiltresVisite(filtres);

  return (
    <section
      aria-label="Rechercher dans le registre"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-elev-sm print:hidden"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onAjouter}>
          <PlusIcon aria-hidden="true" />
          Ajouter une visite
        </Button>

        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Période</legend>
          <Button
            type="button"
            size="sm"
            variant={jourSeul ? 'secondary' : 'outline'}
            aria-pressed={jourSeul}
            onClick={() => {
              onChange({ toutePeriode: false, dateFrom: null, dateTo: null });
            }}
          >
            Aujourd’hui
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filtres.toutePeriode ? 'secondary' : 'outline'}
            aria-pressed={filtres.toutePeriode}
            onClick={() => {
              onChange({ toutePeriode: true, dateFrom: null, dateTo: null });
            }}
          >
            Tout le registre
          </Button>
        </fieldset>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="sm:ml-auto"
          aria-expanded={ouvert}
          aria-controls="filtres-registre"
          onClick={onOuvrir}
        >
          <SearchIcon aria-hidden="true" />
          Rechercher et filtrer
        </Button>
      </div>

      {ouvert ? (
        <div id="filtres-registre" className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-end gap-3">
            <ChampRecherche
              valeur={filtres.search}
              placeholder="Nom ou n° de registre…"
              onChange={(search) => {
                onChange({ search });
              }}
            />
            <ChampDate
              label="Du"
              value={filtres.dateFrom}
              max={filtres.dateTo}
              onChange={(dateFrom) => {
                onChange({ dateFrom });
              }}
            />
            <ChampDate
              label="Au"
              value={filtres.dateTo}
              min={filtres.dateFrom}
              onChange={(dateTo) => {
                onChange({ dateTo });
              }}
            />
          </div>

          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-4">
            <ChampListe
              label={COLONNES_VISITE.entreprise}
              placeholder="Toutes"
              options={choix(referentiels?.entreprises)}
              value={filtres.entrepriseId}
              onChange={(entrepriseId) => {
                onChange({ entrepriseId });
              }}
            />
            <ChampListe
              label={COLONNES_VISITE.direction}
              placeholder="Toutes"
              options={choix(referentiels?.directions)}
              value={filtres.directionId}
              onChange={(directionId) => {
                onChange({ directionId });
              }}
            />
            <ChampListe
              label={COLONNES_VISITE.destinataire}
              placeholder="Tous"
              options={choix(referentiels?.destinataires)}
              value={filtres.destinataireId}
              onChange={(destinataireId) => {
                onChange({ destinataireId });
              }}
            />
            <ChampListe
              label={COLONNES_VISITE.objet}
              placeholder="Tous"
              options={choix(referentiels?.objets)}
              value={filtres.objetId}
              onChange={(objetId) => {
                onChange({ objetId });
              }}
            />
          </div>

          {poses > 0 ? (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={onReinitialiser}>
                <RotateCcwIcon aria-hidden="true" />
                Retirer les filtres
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
