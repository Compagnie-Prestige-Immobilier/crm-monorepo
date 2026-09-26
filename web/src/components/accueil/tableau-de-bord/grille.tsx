'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { CarteWidget } from '@/components/accueil/tableau-de-bord/carte-widget';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  appliquerPresentation,
  donneesVides,
  type CatalogueEntree,
  type DashboardMarque,
  type DashboardTaille,
  type DonneesSource,
} from '@/components/accueil/tableau-de-bord/sources';
import {
  AireChart,
  AirePolaireChart,
  AnneauChart,
  Barres100Chart,
  BarresEmpileesChart,
  BarresGroupeesChart,
  BarresHorizontalesChart,
  BarresVerticalesChart,
  BullesChart,
  CamembertChart,
  paletteFill,
  CarteDeChaleurTable,
  CourbeChart,
  EscalierChart,
  JaugeChart,
  MixteChart,
  NuageChart,
  RadarChart,
  TableauEquipe,
  TableauWidget,
  TuileCourbeWidget,
  TuileWidget,
} from '@/components/dashboard/visites-charts';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { useChartTheme } from '@/lib/chart-theme';
import type { DashboardWidget } from '@/lib/data/disposition';

type Presentation = DashboardWidget['presentation'];
type DonneeDe<F extends DonneesSource['forme']> = Extract<DonneesSource, { forme: F }>['donnee'];

function marqueScalaire(
  donnee: DonneeDe<'scalaire'>,
  marque: DashboardMarque | undefined,
  titre: string,
): ReactNode {
  const { valeur, libelle, serie, affichage } = donnee;
  if (marque === 'jauge')
    return <JaugeChart valeur={valeur} max={valeur * 1.2 || 1} libelle={titre} />;
  if (marque === 'tuile-courbe' && serie !== undefined) {
    return <TuileCourbeWidget valeur={valeur} libelle={titre} serie={serie} />;
  }
  return (
    <TuileWidget
      valeur={valeur}
      affichage={affichage}
      libelle={titre}
      detail={libelle === titre ? undefined : libelle}
    />
  );
}

function marqueMatrice(
  donnee: DonneeDe<'matrice'>,
  marque: DashboardMarque | undefined,
  titre: string,
  presentation: Presentation,
  messageVide: string,
): ReactNode {
  if (donnee.cellules.every((cellule) => cellule.value === 0)) {
    return <EmptyChart message={messageVide} />;
  }
  if (marque === 'nuage') return <NuageChart matrice={donnee} presentation={presentation} />;
  if (marque === 'bulles') return <BullesChart matrice={donnee} presentation={presentation} />;
  return <CarteDeChaleurTable matrice={donnee} caption={titre} />;
}

function marqueComposition(
  lignes: DonneeDe<'composition'>,
  marque: DashboardMarque | undefined,
  titre: string,
  presentation: Presentation,
  messageVide: string,
  ouvrir?: (id: string) => void,
): ReactNode {
  const items = lignes[0]?.segments ?? [];
  if (lignes.every((ligne) => ligne.segments.every((item) => item.value === 0)))
    return <EmptyChart message={messageVide} />;
  if (marque === 'barres-empilees')
    return <BarresEmpileesChart lignes={lignes} presentation={presentation} />;
  if (marque === 'anneau' || marque === 'camembert')
    return (
      <PetitsMultiples
        lignes={lignes}
        marque={marque}
        presentation={presentation}
        ouvrir={ouvrir}
      />
    );
  if (marque === 'tableau') return <TableauWidget items={items} entete={titre} caption={titre} />;
  return <Barres100Chart lignes={lignes} presentation={presentation} />;
}

/** EB-34 : un diagramme circulaire PAR ligne (une campagne), une seule légende, la carte grandit avec eux. */
function PetitsMultiples({
  lignes,
  marque,
  presentation,
  ouvrir,
}: {
  lignes: DonneeDe<'composition'>;
  marque: 'anneau' | 'camembert';
  presentation: Presentation;
  ouvrir?: ((id: string) => void) | undefined;
}) {
  const theme = useChartTheme();
  const Diagramme = marque === 'anneau' ? AnneauChart : CamembertChart;
  const sansLegende = { ...presentation, legende: false };
  return (
    <div className="flex flex-col gap-3 pb-3">
      <ul
        className="flex flex-wrap gap-3 text-[0.8125rem] text-muted-foreground"
        aria-label="Légende"
      >
        {(lignes[0]?.segments ?? []).map((segment, index) => (
          <li key={segment.id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: paletteFill(theme, presentation?.palette, index) }}
            />
            {segment.label}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {lignes.map((ligne) => {
          const id = ligne.id;
          return (
            // Rangée libre et diagramme à hauteur fixe : 13 rem imposés plus
            // 10 rem minimum faisaient déborder le camembert sur sa légende.
            <figure key={id ?? ligne.ligne} className="flex flex-col gap-1">
              <div className="h-40">
                <Diagramme
                  items={ligne.segments}
                  presentation={sansLegende}
                  onSelect={
                    ouvrir === undefined || id === undefined
                      ? undefined
                      : () => {
                          ouvrir(id);
                        }
                  }
                />
              </div>
              <figcaption className="text-center">
                <span className="line-clamp-2 text-[0.8125rem] font-[600]">{ligne.ligne}</span>
                {ligne.detail === undefined ? null : (
                  <span className="block line-clamp-2 text-[0.75rem] text-muted-foreground">
                    {ligne.detail}
                  </span>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

type SerieContext = {
  items: DonneeDe<'classement'>;
  presentation: Presentation;
  titre: string;
  onSelect: ((index: number) => void) | undefined;
};

const RENDUS_SERIE: Partial<Record<DashboardMarque, (ctx: SerieContext) => ReactNode>> = {
  'barres-horizontales': ({ items, presentation }) => (
    <BarresHorizontalesChart items={items} presentation={presentation} />
  ),
  'barres-groupees': ({ items, presentation }) => (
    <BarresGroupeesChart items={items} presentation={presentation} />
  ),
  courbe: ({ items, presentation }) => <CourbeChart items={items} presentation={presentation} />,
  aire: ({ items, presentation }) => <AireChart items={items} presentation={presentation} />,
  escalier: ({ items, presentation }) => (
    <EscalierChart items={items} presentation={presentation} />
  ),
  anneau: ({ items, presentation, onSelect }) => (
    <AnneauChart items={items} presentation={presentation} onSelect={onSelect} />
  ),
  camembert: ({ items, presentation, onSelect }) => (
    <CamembertChart items={items} presentation={presentation} onSelect={onSelect} />
  ),
  'aire-polaire': ({ items, presentation }) => (
    <AirePolaireChart items={items} presentation={presentation} />
  ),
  radar: ({ items, presentation }) => <RadarChart items={items} presentation={presentation} />,
  mixte: ({ items, presentation }) => <MixteChart items={items} presentation={presentation} />,
  tableau: ({ items, titre }) => <TableauWidget items={items} entete={titre} caption={titre} />,
};

function marqueSerie(
  items: DonneeDe<'classement'>,
  marque: DashboardMarque | undefined,
  titre: string,
  presentation: Presentation,
  ouvrir?: (id: string) => void,
): ReactNode {
  const onSelect =
    ouvrir === undefined
      ? undefined
      : (index: number): void => {
          const item = items[index];
          if (item !== undefined) ouvrir(item.id);
        };
  const rendu = marque === undefined ? undefined : RENDUS_SERIE[marque];
  if (rendu === undefined)
    return <BarresVerticalesChart items={items} presentation={presentation} />;
  return rendu({ items, presentation, titre, onSelect });
}

export function renderMark(
  titre: string,
  marque: DashboardMarque | undefined,
  donnees: DonneesSource,
  presentation: Presentation,
  messageVide = 'Aucune visite sur la période.',
  ouvrir?: (id: string) => void,
): ReactNode {
  if (donnees.forme === 'equipe') return <TableauEquipe donnee={donnees.donnee} caption={titre} />;
  if (donnees.forme === 'scalaire') return marqueScalaire(donnees.donnee, marque, titre);
  if (donneesVides(donnees)) return <EmptyChart message={messageVide} />;
  if (donnees.forme === 'matrice')
    return marqueMatrice(donnees.donnee, marque, titre, presentation, messageVide);
  if (donnees.forme === 'composition') {
    const chart = marqueComposition(
      donnees.donnee,
      marque,
      titre,
      presentation,
      messageVide,
      ouvrir,
    );
    if (donnees.resume === undefined) return chart;
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <p className="text-[0.9375rem] tabular-nums">{donnees.resume}</p>
        <div className="min-h-0 flex-1">{chart}</div>
      </div>
    );
  }

  // Le tri et le regroupement en « Autres » n'ont de sens que pour un
  // classement : réordonner une série chronologique ou un cycle la rendrait
  // illisible, l'ordre porte l'information.
  const items =
    donnees.forme === 'classement'
      ? appliquerPresentation(donnees.donnee, presentation)
      : donnees.donnee;
  return marqueSerie(items, marque, titre, presentation, ouvrir);
}

/** dnd-kit ne traduit rien par défaut : ces textes seraient sinon lus en anglais. */
const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Pour déplacer ce graphique, appuyez sur la barre d’espace ou sur Entrée. ' +
    'Utilisez les flèches pour le repositionner, la barre d’espace pour le déposer, ' +
    'ou Échap pour annuler.',
};

function announcements(titreDe: (id: string) => string): Announcements {
  return {
    onDragStart: ({ active }) => `${titreDe(String(active.id))} saisi.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? `${titreDe(String(active.id))} n’est plus au-dessus d’un emplacement.`
        : `${titreDe(String(active.id))} déplacé au-dessus de ${titreDe(String(over.id))}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `${titreDe(String(active.id))} déposé, position inchangée.`
        : `${titreDe(String(active.id))} déposé à la place de ${titreDe(String(over.id))}.`,
    onDragCancel: ({ active }) => `Déplacement de ${titreDe(String(active.id))} annulé.`,
  };
}

function ContenuCarte({
  entree,
  widget,
  donnees,
  erreur,
  messageVide,
}: {
  entree: CatalogueEntree;
  widget: DashboardWidget;
  donnees: DonneesSource | undefined;
  erreur: string | undefined;
  messageVide: string;
}) {
  const router = useRouter();
  const lien = entree.lien;
  if (erreur !== undefined)
    return <p className="py-4 text-[0.875rem] text-destructive">{erreur}</p>;
  if (donnees === undefined) return <Skeleton className="h-full min-h-16 w-full rounded-md" />;
  return renderMark(
    entree.label,
    widget.marque,
    donnees,
    widget.presentation,
    messageVide,
    lien === undefined
      ? undefined
      : (id) => {
          router.push(lien(id));
        },
  );
}

export function WidgetGrid({
  widgets,
  entrees,
  donnees,
  erreurs,
  editable,
  messageVide = 'Aucune visite sur la période.',
  onReorder,
  onRemove,
  onChangeTaille,
}: {
  widgets: readonly DashboardWidget[];
  entrees: Map<string, CatalogueEntree>;
  donnees: Map<string, DonneesSource>;
  erreurs: Map<string, string>;
  editable: boolean;
  messageVide?: string;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onChangeTaille: (id: string, taille: DashboardTaille | undefined) => void;
}) {
  // Souris et tactile séparés : un PointerSensor unique capte le `pointerdown`
  // du doigt avant tout `touchstart` et le glissement partirait au premier pixel
  // de défilement de la tablette.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titreDe = (id: string): string => entrees.get(id)?.label ?? '';
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  const cards = widgets.map((widget) => {
    const entree = entrees.get(widget.id) ?? {
      label: widget.titre ?? widget.source,
      forme: 'scalaire',
    };
    const donnee = donnees.get(widget.id);
    return (
      <CarteWidget
        key={widget.id}
        widget={widget}
        entree={entree}
        donnees={donnee}
        editable={editable}
        onRemove={() => {
          onRemove(widget.id);
        }}
        onChangeTaille={(taille) => {
          onChangeTaille(widget.id, taille);
        }}
      >
        <ContenuCarte
          entree={entree}
          widget={widget}
          donnees={donnee}
          erreur={erreurs.get(widget.id)}
          messageVide={messageVide}
        />
      </CarteWidget>
    );
  });

  const grille = (
    <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
  );
  if (!editable) return grille;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements: announcements(titreDe), screenReaderInstructions }}
      onDragStart={(event: DragStartEvent) => {
        setActiveId(String(event.active.id));
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
      }}
    >
      <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
        {grille}
      </SortableContext>
      <DragOverlay>
        {activeId === null ? null : (
          <Card className="animate-rise p-4 shadow-elev-xl">
            <p className="font-display text-[0.9375rem] font-[700]">{titreDe(activeId)}</p>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
