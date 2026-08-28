'use client';

import { PlusIcon } from 'lucide-react';

import { ChoixGraphique, marquePhrase } from '@/components/dashboard/chart-visual';
import { evaluerMarques } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  SOURCES,
  mesurerDonnees,
  type Catalogue,
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

export function TiroirWidgets({
  placees,
  donnees,
  catalogue = SOURCES,
  onAdd,
}: {
  placees: ReadonlySet<string>;
  donnees: Map<string, DonneesSource>;
  catalogue?: Catalogue;
  onAdd: (source: DashboardSource) => void;
}) {
  const disponibles = Object.keys(catalogue).filter((source) => !placees.has(source));

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <PlusIcon aria-hidden="true" />
            Ajouter un graphique
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajouter un graphique</SheetTitle>
          <SheetDescription>
            Choisissez ce que vous voulez suivre. L’image montre la forme conseillée.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
          {disponibles.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
              Toutes les sources sont déjà placées.
            </p>
          ) : (
            disponibles.map((source) => {
              const entree = catalogue[source];
              if (entree === undefined) return null;
              const donneesSource = donnees.get(source);
              // Sans données chargées, la mesure vaut zéro : le classement des
              // marques reste celui de la FORME, jamais un repli muet.
              const tete = evaluerMarques(
                entree.forme,
                donneesSource === undefined
                  ? { nombreCategories: 0, nombrePoints: 0, partZero: 0 }
                  : mesurerDonnees(donneesSource),
              )[0];
              const marque = tete?.marque ?? 'tableau';
              return (
                <ChoixGraphique
                  key={source}
                  marque={marque}
                  titre={entree.label}
                  phrase={marquePhrase(marque)}
                  conseille={tete?.recommandee === true}
                  raison={tete?.recommandee === true ? tete.raison : null}
                  onSelect={() => {
                    onAdd(source as DashboardSource);
                  }}
                />
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
