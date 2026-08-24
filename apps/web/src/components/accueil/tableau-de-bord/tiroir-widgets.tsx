'use client';

import { PlusIcon } from 'lucide-react';

import {
  evaluerMarques,
  marqueRecommandee,
} from '@/components/accueil/tableau-de-bord/recommandation';
import {
  SOURCES,
  mesurerDonnees,
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
  onAdd,
}: {
  placees: ReadonlySet<DashboardSource>;
  donnees: Map<DashboardSource, DonneesSource>;
  onAdd: (source: DashboardSource) => void;
}) {
  const disponibles = (Object.keys(SOURCES) as DashboardSource[]).filter(
    (source) => !placees.has(source),
  );

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
            Chaque source propose la marque la mieux adaptée aux données actuelles.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
          {disponibles.length === 0 ? (
            <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
              Toutes les sources sont déjà placées.
            </p>
          ) : (
            disponibles.map((source) => {
              const donneesSource = donnees.get(source);
              const mesure = donneesSource === undefined ? null : mesurerDonnees(donneesSource);
              const recommandee =
                mesure === null ? null : marqueRecommandee(SOURCES[source].forme, mesure);
              const raison =
                mesure === null
                  ? null
                  : evaluerMarques(SOURCES[source].forme, mesure).find((e) => e.recommandee)
                      ?.raison;
              return (
                <button
                  key={source}
                  type="button"
                  className="flex flex-col gap-0.5 rounded-md p-3 text-left hover:bg-secondary"
                  onClick={() => {
                    onAdd(source);
                  }}
                >
                  <span className="text-[0.9375rem] font-[600]">{SOURCES[source].label}</span>
                  {recommandee === null ? null : (
                    <span className="text-[0.8125rem] text-muted-foreground">
                      Recommandé : {recommandee}
                      {raison === null || raison === undefined ? '' : ` — ${raison}`}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
