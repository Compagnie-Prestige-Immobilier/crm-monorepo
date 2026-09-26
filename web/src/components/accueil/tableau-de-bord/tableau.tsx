'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SparklesIcon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { toast } from 'sonner';

import type {
  Catalogue,
  CatalogueEntree,
  DashboardTaille,
  DonneesSource,
} from '@/components/accueil/tableau-de-bord/sources';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchCalculs,
  fetchDisposition,
  saveDisposition,
  type Calcul,
  type CalculRendu,
  type DashboardEcran,
  type DashboardWidget,
  type Disposition,
} from '@/lib/data/disposition';
import { apiErrorText, toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { avecTransition } from '@/lib/transition-de-vue';

const Constructeur = lazy(() => import('@/components/accueil/tableau-de-bord/constructeur'));

export interface Plage {
  du: string;
  au: string;
}

export type NouveauWidget = Omit<DashboardWidget, 'id'>;

const cleCalcul = (calcul: Calcul): string => JSON.stringify(calcul);

async function calculsParCle(calculs: Calcul[], plage: Plage): Promise<Map<string, CalculRendu>> {
  const rendus = await fetchCalculs(calculs, plage);
  return new Map(
    calculs.map((calcul, index) => [cleCalcul(calcul), rendus[index] ?? { titre: '' }]),
  );
}

// Toute action sur une carte s'enregistre aussitôt ; la liste affichée est celle du cache.
export function useTableauDeBord(ecran: DashboardEcran, plage: Plage) {
  const queryClient = useQueryClient();
  const cle = queryKeys.disposition(ecran);
  const dispositionQuery = useQuery({ queryKey: cle, queryFn: () => fetchDisposition(ecran) });
  const widgets = dispositionQuery.data?.widgets ?? [];

  const calculs = widgets.flatMap((widget) => (widget.calcul === undefined ? [] : [widget.calcul]));
  const cles = [...new Set(calculs.map(cleCalcul))].sort();
  const calculsQuery = useQuery({
    queryKey: queryKeys.calculsTableau(cles, plage.du, plage.au),
    queryFn: () => calculsParCle(calculs, plage),
    enabled: cles.length > 0,
    placeholderData: keepPreviousData,
  });

  const enregistrer = useMutation({
    mutationKey: cle,
    mutationFn: (suivants: DashboardWidget[]) =>
      saveDisposition(ecran, suivants, dispositionQuery.data?.preset),
    onMutate: async (suivants) => {
      await queryClient.cancelQueries({ queryKey: cle });
      const avant = queryClient.getQueryData<Disposition>(cle);
      if (avant !== undefined) {
        avecTransition(() => {
          queryClient.setQueryData<Disposition>(cle, { ...avant, widgets: suivants });
        });
      }
      return { avant };
    },
    onError: (error, _suivants, contexte) => {
      if (contexte?.avant !== undefined) queryClient.setQueryData(cle, contexte.avant);
      toastApiError(error, 'Le tableau de bord n’a pas été enregistré.');
    },
    onSuccess: (disposition) => {
      if (queryClient.isMutating({ mutationKey: cle }) <= 1)
        queryClient.setQueryData(cle, disposition);
    },
  });

  const deplacer = (deId: string, versId: string): void => {
    const de = widgets.findIndex((widget) => widget.id === deId);
    const vers = widgets.findIndex((widget) => widget.id === versId);
    if (de === -1 || vers === -1) return;
    const suivants = [...widgets];
    const [deplace] = suivants.splice(de, 1);
    if (deplace === undefined) return;
    suivants.splice(vers, 0, deplace);
    enregistrer.mutate(suivants);
  };

  const redimensionner = (id: string, taille: DashboardTaille | undefined): void => {
    enregistrer.mutate(
      widgets.map((widget) => {
        if (widget.id !== id) return widget;
        const { taille: _ancienne, ...reste } = widget;
        return taille === undefined ? reste : { ...reste, taille };
      }),
    );
  };

  const retirer = (id: string, titre: string): void => {
    const avant = widgets;
    enregistrer.mutate(widgets.filter((widget) => widget.id !== id));
    toast(`« ${titre} » retiré du tableau de bord.`, {
      action: { label: 'Annuler', onClick: () => enregistrer.mutate(avant) },
    });
  };

  const ajouter = (widget: NouveauWidget): Promise<Disposition> =>
    enregistrer.mutateAsync([...widgets, { ...widget, id: `nouveau-${String(widgets.length)}` }]);

  return { dispositionQuery, widgets, calculsQuery, deplacer, redimensionner, retirer, ajouter };
}

type Tableau = ReturnType<typeof useTableauDeBord>;

interface Cartes {
  widgets: DashboardWidget[];
  entrees: Map<string, CatalogueEntree>;
  donnees: Map<string, DonneesSource>;
  erreurs: Map<string, string>;
}

function poserSource(
  cartes: Cartes,
  widget: DashboardWidget,
  source: CatalogueEntree,
  donnee: DonneesSource | undefined,
): void {
  cartes.widgets.push(widget);
  cartes.entrees.set(widget.id, { ...source, label: widget.titre ?? source.label });
  if (donnee !== undefined) cartes.donnees.set(widget.id, donnee);
}

function poserCalcul(
  cartes: Cartes,
  widget: DashboardWidget,
  rendu: CalculRendu | undefined,
  erreurCommune: string | undefined,
): void {
  cartes.widgets.push(widget);
  if (rendu === undefined) {
    cartes.entrees.set(widget.id, { label: widget.titre ?? 'Indicateur', forme: 'scalaire' });
    if (erreurCommune !== undefined) cartes.erreurs.set(widget.id, erreurCommune);
    return;
  }
  const { donnees, erreur, explication } = rendu;
  cartes.entrees.set(widget.id, {
    label: widget.titre ?? rendu.titre,
    forme: donnees?.forme ?? 'scalaire',
    ...(explication === undefined ? {} : { description: explication }),
  });
  if (donnees !== undefined) cartes.donnees.set(widget.id, donnees);
  if (erreur !== undefined) cartes.erreurs.set(widget.id, erreur);
}

/** Ce que la grille affiche de chaque carte : son intitulé, ses données, ou son erreur. */
export function cartesDu(
  tableau: Tableau,
  catalogue: Catalogue,
  donneesParSource: Map<string, DonneesSource>,
): Cartes {
  const cartes: Cartes = {
    widgets: [],
    entrees: new Map(),
    donnees: new Map(),
    erreurs: new Map(),
  };
  const erreurCommune = tableau.calculsQuery.isError
    ? apiErrorText(tableau.calculsQuery.error, 'Le calcul n’a pas pu être fait.')
    : undefined;
  for (const widget of tableau.widgets) {
    const source = catalogue[widget.source];
    if (widget.calcul !== undefined) {
      poserCalcul(
        cartes,
        widget,
        tableau.calculsQuery.data?.get(cleCalcul(widget.calcul)),
        erreurCommune,
      );
    } else if (source !== undefined) {
      poserSource(cartes, widget, source, donneesParSource.get(widget.source));
    }
  }
  return cartes;
}

export function BoutonAjouterIndicateur({
  ecran,
  catalogue,
  plage,
  cleDonnees,
  chargerSource,
  onAjouter,
}: {
  ecran: DashboardEcran;
  catalogue: Catalogue;
  plage: Plage;
  cleDonnees: readonly unknown[];
  chargerSource: (source: string) => Promise<DonneesSource | null>;
  onAjouter: (widget: NouveauWidget) => Promise<unknown>;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <Button type="button" onClick={() => setOuvert(true)}>
        <SparklesIcon aria-hidden="true" />
        Ajouter un indicateur
      </Button>
      <DialogContent className="top-[8dvh] translate-y-0 gap-0 p-0 shadow-elev-xl outline-none sm:max-w-2xl sm:rounded-2xl">
        <DialogTitle className="sr-only">Ajouter un indicateur</DialogTitle>
        <DialogDescription className="sr-only">
          Décrivez le chiffre voulu, confirmez, choisissez sa forme.
        </DialogDescription>
        <Suspense fallback={<Skeleton className="m-5 h-24" />}>
          {ouvert ? (
            <Constructeur
              ecran={ecran}
              catalogue={catalogue}
              plage={plage}
              cleDonnees={cleDonnees}
              chargerSource={chargerSource}
              onAjouter={onAjouter}
            />
          ) : null}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
