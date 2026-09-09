import { ChampDate, ChampListe, ChampRecherche, type Choix } from '@/components/accueil/champs';
import { LienTelechargement } from '@/components/exports/liens';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  COLONNES_VISITE,
  type EntreeReferentielVisite,
  type ReferentielsVisite,
} from '@/lib/data/visites';

export interface FiltresExport {
  from: string | null;
  to: string | null;
  entrepriseId: string | null;
  directionId: string | null;
  destinataireId: string | null;
  search: string;
}

export const EXPORT_VIDE: FiltresExport = {
  from: null,
  to: null,
  entrepriseId: null,
  directionId: null,
  destinataireId: null,
  search: '',
};

function urlExport(filtres: FiltresExport): string {
  const params = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (typeof valeur === 'string' && valeur.trim() !== '') params.set(cle, valeur.trim());
  }
  const query = params.toString();
  return query === '' ? '/api/v1/export/visites.xlsx' : `/api/v1/export/visites.xlsx?${query}`;
}

function choix(entrees: readonly EntreeReferentielVisite[] | null | undefined): Choix[] {
  return (entrees ?? []).map((entree) => ({ value: entree.id, label: entree.label }));
}

export function ImportExport({
  filtres,
  referentiels,
  onChange,
}: {
  filtres: FiltresExport;
  referentiels: ReferentielsVisite | undefined;
  onChange: (patch: Partial<FiltresExport>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[1.0625rem]">1. Exporter le registre</CardTitle>
        <CardDescription>
          Travaillez dans le classeur téléchargé, puis redéposez-le : le serveur détecte les
          différences ligne par ligne avant d’écrire quoi que ce soit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChampDate
            label="Du"
            value={filtres.from}
            max={filtres.to}
            onChange={(from) => {
              onChange({ from });
            }}
          />
          <ChampDate
            label="Au"
            value={filtres.to}
            min={filtres.from}
            onChange={(to) => {
              onChange({ to });
            }}
          />
          <ChampRecherche
            valeur={filtres.search}
            placeholder="Nom ou n° de registre…"
            onChange={(search) => {
              onChange({ search });
            }}
          />
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
        </div>

        <div>
          <LienTelechargement href={urlExport(filtres)} label="Exporter le registre filtré">
            Exporter le registre filtré
          </LienTelechargement>
        </div>
      </CardContent>
    </Card>
  );
}
