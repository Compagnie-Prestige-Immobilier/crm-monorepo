'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import {
  SOURCES,
  appliquerPresentation,
  donneesVides,
  type Catalogue,
  type DashboardMarque,
  type DashboardTaille,
  type DispositionPresentation,
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
import type { DashboardWidget } from '@/lib/data/visites-dashboard';

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
): ReactNode {
  const items = lignes[0]?.segments ?? [];
  if (items.every((item) => item.value === 0)) return <EmptyChart message={messageVide} />;
  if (marque === 'barres-empilees')
    return <BarresEmpileesChart lignes={lignes} presentation={presentation} />;
  if ((marque === 'anneau' || marque === 'camembert') && lignes.length > 1)
    return <PetitsMultiples lignes={lignes} marque={marque} presentation={presentation} />;
  if (marque === 'anneau') return <AnneauChart items={items} presentation={presentation} />;
  if (marque === 'camembert') return <CamembertChart items={items} presentation={presentation} />;
  if (marque === 'tableau') return <TableauWidget items={items} entete={titre} caption={titre} />;
  return <Barres100Chart lignes={lignes} presentation={presentation} />;
}

/** EB-34 : un diagramme circulaire PAR campagne, côte à côte, la ligne défile au-delà. */
function PetitsMultiples({
  lignes,
  marque,
  presentation,
}: {
  lignes: DonneeDe<'composition'>;
  marque: 'anneau' | 'camembert';
  presentation: Presentation;
}) {
  const Diagramme = marque === 'anneau' ? AnneauChart : CamembertChart;
  return (
    <div className="grid h-full auto-rows-[11rem] grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3 overflow-y-auto">
      {lignes.map((ligne) => (
        <figure key={ligne.ligne} className="flex min-h-0 flex-col gap-1">
          <div className="min-h-0 flex-1">
            <Diagramme items={ligne.segments} presentation={presentation} />
          </div>
          <figcaption className="truncate text-center text-[0.8125rem] font-[600]">
            {ligne.ligne}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

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
  switch (marque) {
    case 'barres-horizontales':
      return <BarresHorizontalesChart items={items} presentation={presentation} />;
    case 'barres-groupees':
      return <BarresGroupeesChart items={items} presentation={presentation} />;
    case 'courbe':
      return <CourbeChart items={items} presentation={presentation} />;
    case 'aire':
      return <AireChart items={items} presentation={presentation} />;
    case 'escalier':
      return <EscalierChart items={items} presentation={presentation} />;
    case 'anneau':
      return <AnneauChart items={items} presentation={presentation} onSelect={onSelect} />;
    case 'camembert':
      return <CamembertChart items={items} presentation={presentation} onSelect={onSelect} />;
    case 'aire-polaire':
      return <AirePolaireChart items={items} presentation={presentation} />;
    case 'radar':
      return <RadarChart items={items} presentation={presentation} />;
    case 'mixte':
      return <MixteChart items={items} presentation={presentation} />;
    case 'tableau':
      return <TableauWidget items={items} entete={titre} caption={titre} />;
    case 'barres-verticales':
    default:
      return <BarresVerticalesChart items={items} presentation={presentation} />;
  }
}

export function renderMark(
  source: string,
  marque: DashboardMarque | undefined,
  donnees: DonneesSource,
  presentation: Presentation,
  catalogue: Catalogue = SOURCES,
  messageVide = 'Aucune visite sur la période.',
  ouvrir?: (id: string) => void,
): ReactNode {
  const titre = catalogue[source]?.label ?? source;

  if (donnees.forme === 'equipe') return <TableauEquipe donnee={donnees.donnee} caption={titre} />;
  if (donnees.forme === 'scalaire') return marqueScalaire(donnees.donnee, marque, titre);
  if (donneesVides(donnees)) return <EmptyChart message={messageVide} />;
  if (donnees.forme === 'matrice')
    return marqueMatrice(donnees.donnee, marque, titre, presentation, messageVide);
  if (donnees.forme === 'composition')
    return marqueComposition(donnees.donnee, marque, titre, presentation, messageVide);

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

export function WidgetGrid({
  widgets,
  donnees,
  editing,
  catalogue = SOURCES,
  messageVide = 'Aucune visite sur la période.',
  onReorder,
  onRemove,
  onMove,
  onChangeMarque,
  onChangeTaille,
  onChangePresentation,
}: {
  widgets: readonly DashboardWidget[];
  donnees: Map<string, DonneesSource>;
  editing: boolean;
  catalogue?: Catalogue;
  messageVide?: string;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onChangeMarque: (id: string, marque: DashboardMarque) => void;
  onChangeTaille: (id: string, taille: DashboardTaille | undefined) => void;
  onChangePresentation: (id: string, presentation: DispositionPresentation) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titreDe = (id: string): string => {
    const widget = widgets.find((w) => w.id === id);
    if (widget === undefined) return '';
    return catalogue[widget.source]?.label ?? widget.source;
  };

  const [activeId, setActiveId] = useState<string | null>(null);
  const router = useRouter();

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveId(null);
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  const cards = widgets.map((widget, index) => {
    const source = donnees.get(widget.id);
    const lien = catalogue[widget.source]?.lien;
    return (
      <CarteWidget
        key={widget.id}
        widget={widget}
        donnees={source}
        editing={editing}
        catalogue={catalogue}
        peutMonter={index > 0}
        peutDescendre={index < widgets.length - 1}
        onRemove={() => {
          onRemove(widget.id);
        }}
        onMoveUp={() => {
          onMove(widget.id, -1);
        }}
        onMoveDown={() => {
          onMove(widget.id, 1);
        }}
        onChangeMarque={(marque) => {
          onChangeMarque(widget.id, marque);
        }}
        onChangeTaille={(taille) => {
          onChangeTaille(widget.id, taille);
        }}
        onChangePresentation={(presentation) => {
          onChangePresentation(widget.id, presentation);
        }}
      >
        {source === undefined
          ? null
          : renderMark(
              widget.source,
              widget.marque,
              source,
              widget.presentation,
              catalogue,
              messageVide,
              lien === undefined
                ? undefined
                : (id) => {
                    router.push(lien(id));
                  },
            )}
      </CarteWidget>
    );
  });

  if (!editing) {
    return <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements: announcements(titreDe), screenReaderInstructions }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
      }}
    >
      <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
      </SortableContext>
      {/* Aperçu sans canevas : déplacer une carte contenant un graphique vivant
          déclenche la boucle de redimensionnement de Chart.js. */}
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
