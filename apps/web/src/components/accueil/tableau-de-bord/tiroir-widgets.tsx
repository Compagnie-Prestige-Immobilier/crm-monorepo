'use client';

import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ChartDemo, ChartPreview, marqueTexte } from '@/components/dashboard/chart-visual';
import { evaluerMarques } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  SOURCES,
  mesurerDonnees,
  type Catalogue,
  type DashboardMarque,
  type DashboardSource,
  type DonneesSource,
} from '@/components/accueil/tableau-de-bord/sources';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Apercu = { source: DashboardSource; marque: DashboardMarque; rejeu: number };

function marqueInitiale(evaluees: ReturnType<typeof evaluerMarques>): DashboardMarque {
  const tete = evaluees[0];
  return tete?.marque ?? 'tableau';
}

function ApercuWidget({
  apercu,
  source,
  setApercu,
  onAdd,
}: {
  apercu: Apercu;
  source: string;
  setApercu: (apercu: Apercu | null) => void;
  onAdd: (source: DashboardSource, marque?: DashboardMarque) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
      <ChartDemo
        key={`${source}-${apercu.marque}-${String(apercu.rejeu)}`}
        marque={apercu.marque}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onAdd(source as DashboardSource, apercu.marque);
            setApercu(null);
          }}
        >
          Ajouter cette forme
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setApercu(null)}>
          Fermer l’exemple
        </Button>
      </div>
    </div>
  );
}

function CarteSourceDisponible({
  source,
  catalogue,
  donnees,
  apercu,
  setApercu,
  onAdd,
}: {
  source: string;
  catalogue: Catalogue;
  donnees: Map<string, DonneesSource>;
  apercu: Apercu | null;
  setApercu: (apercu: Apercu | null) => void;
  onAdd: (source: DashboardSource, marque?: DashboardMarque) => void;
}) {
  const entree = catalogue[source];
  if (entree === undefined) return null;
  const donneesSource = donnees.get(source);
  // Sans données chargées, la mesure vaut zéro : le classement des
  // marques reste celui de la FORME, jamais un repli muet.
  const evaluees = evaluerMarques(
    entree.forme,
    donneesSource === undefined
      ? { nombreCategories: 0, nombrePoints: 0, partZero: 0 }
      : mesurerDonnees(donneesSource),
  );
  const marque = marqueInitiale(evaluees);

  return (
    <article
      key={source}
      className="flex shrink-0 flex-col gap-3 rounded-lg border border-border/70 bg-card p-3"
    >
      <div className="flex items-start gap-3">
        <ChartPreview marque={marque} />
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-[700] uppercase tracking-[0.08em] text-muted-foreground">
            {entree.groupe ?? 'Indicateur'}
          </p>
          <h3 className="font-display text-[1rem] font-[700] text-foreground">{entree.label}</h3>
          <p className="mt-1 text-[0.875rem] font-[600] text-foreground">
            {entree.question ?? `Que se passe-t-il avec ${entree.label.toLowerCase()} ?`}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {entree.description ?? 'Ce chiffre vous aide à comprendre la situation.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setApercu({
              source: source as DashboardSource,
              marque,
              rejeu: (apercu?.rejeu ?? 0) + 1,
            });
          }}
        >
          Voir cet exemple
        </Button>
        {evaluees.length > 1 ? (
          <details className="text-[0.8125rem]">
            <summary className="cursor-pointer rounded-md px-2 py-1.5 font-[600] text-primary hover:bg-secondary">
              Voir les autres façons
            </summary>
            <div className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3">
              {evaluees.slice(1).map((evaluee) => (
                <button
                  key={evaluee.marque}
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary"
                  onClick={() => {
                    setApercu({
                      source: source as DashboardSource,
                      marque: evaluee.marque,
                      rejeu: (apercu?.rejeu ?? 0) + 1,
                    });
                  }}
                >
                  <ChartPreview marque={evaluee.marque} className="size-10 [&>svg]:size-8" />
                  <span>
                    <span className="block font-[600]">
                      Voir {marqueTexte(evaluee.marque).nom.toLowerCase()}
                    </span>
                    <span className="block text-muted-foreground">
                      {marqueTexte(evaluee.marque).usage}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </div>
      {apercu?.source === source ? (
        <ApercuWidget apercu={apercu} source={source} setApercu={setApercu} onAdd={onAdd} />
      ) : null}
    </article>
  );
}

export function TiroirWidgets({
  placees,
  donnees,
  catalogue = SOURCES,
  onAdd,
}: {
  placees: ReadonlySet<string>;
  donnees: Map<string, DonneesSource>;
  catalogue?: Catalogue;
  onAdd: (source: DashboardSource, marque?: DashboardMarque) => void;
}) {
  const [recherche, setRecherche] = useState('');
  const [apercu, setApercu] = useState<{
    source: DashboardSource;
    marque: DashboardMarque;
    rejeu: number;
  } | null>(null);
  const disponibles = useMemo(
    () =>
      Object.keys(catalogue).filter((source) => {
        if (placees.has(source)) return false;
        if (recherche.trim() === '') return true;
        const entree = catalogue[source];
        const texte = `${source} ${entree?.label ?? ''} ${entree?.question ?? ''} ${entree?.description ?? ''}`;
        return texte.toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr'));
      }),
    [catalogue, placees, recherche],
  );

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" data-visite="tiroir">
            <PlusIcon aria-hidden="true" />
            Ajouter un graphique
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajouter un graphique</SheetTitle>
          <SheetDescription>
            Choisissez une question simple. Nous vous proposons l’affichage le plus facile à lire.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          <Input
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Chercher une question ou un indicateur"
            aria-label="Chercher une question ou un indicateur"
          />
          {disponibles.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
              {recherche === ''
                ? 'Toutes les questions sont déjà affichées.'
                : 'Aucun indicateur ne correspond à votre recherche.'}
            </p>
          ) : (
            disponibles.map((source) => (
              <CarteSourceDisponible
                key={source}
                source={source}
                catalogue={catalogue}
                donnees={donnees}
                apercu={apercu}
                setApercu={setApercu}
                onAdd={onAdd}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
