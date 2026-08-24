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
import { useState, type ReactNode } from 'react';

import { CarteWidget } from '@/components/accueil/tableau-de-bord/carte-widget';
import { Card } from '@/components/ui/card';
import {
  SOURCES,
  appliquerPresentation,
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
  TableauWidget,
  TuileCourbeWidget,
  TuileWidget,
} from '@/components/dashboard/visites-charts';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import type { DashboardWidget } from '@/lib/data/visites-dashboard';

export function renderMark(
  source: DashboardWidget['source'],
  marque: DashboardMarque | undefined,
  donnees: DonneesSource,
  presentation: DashboardWidget['presentation'],
): ReactNode {
  const titre = SOURCES[source].label;

  if (donnees.forme === 'scalaire') {
    const { valeur, libelle, serie } = donnees.donnee;
    if (marque === 'jauge')
      return <JaugeChart valeur={valeur} max={valeur * 1.2 || 1} libelle={titre} />;
    if (marque === 'tuile-courbe' && serie !== undefined) {
      return <TuileCourbeWidget valeur={valeur} libelle={titre} serie={serie} />;
    }
    return (
      <TuileWidget
        valeur={valeur}
        libelle={titre}
        detail={marque === 'tuile' ? undefined : libelle}
      />
    );
  }

  if (donnees.forme === 'matrice') {
    const { donnee } = donnees;
    if (donnee.cellules.every((cellule) => cellule.value === 0)) {
      return <EmptyChart message="Aucune visite sur la période." />;
    }
    if (marque === 'nuage') return <NuageChart matrice={donnee} presentation={presentation} />;
    if (marque === 'bulles') return <BullesChart matrice={donnee} presentation={presentation} />;
    return <CarteDeChaleurTable matrice={donnee} caption={titre} />;
  }

  if (donnees.forme === 'composition') {
    const lignes = donnees.donnee;
    const items = lignes[0]?.segments ?? [];
    if (items.every((item) => item.value === 0))
      return <EmptyChart message="Aucune visite sur la période." />;
    if (marque === 'barres-empilees')
      return <BarresEmpileesChart lignes={lignes} presentation={presentation} />;
    if (marque === 'anneau') return <AnneauChart items={items} presentation={presentation} />;
    if (marque === 'camembert') return <CamembertChart items={items} presentation={presentation} />;
    if (marque === 'tableau') return <TableauWidget items={items} entete={titre} caption={titre} />;
    return <Barres100Chart lignes={lignes} presentation={presentation} />;
  }

  // Le tri et le regroupement en « Autres » n'ont de sens que pour un
  // classement : réordonner une série chronologique ou un cycle la rendrait
  // illisible, l'ordre porte l'information.
  const items =
    donnees.forme === 'classement'
      ? appliquerPresentation(donnees.donnee, presentation)
      : donnees.donnee;
  if (items.length === 0 || items.every((item) => item.value === 0)) {
    return <EmptyChart message="Aucune visite sur la période." />;
  }

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
      return <AnneauChart items={items} presentation={presentation} />;
    case 'camembert':
      return <CamembertChart items={items} presentation={presentation} />;
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
  onReorder: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onChangeMarque: (id: string, marque: DashboardMarque) => void;
  onChangeTaille: (id: string, taille: DashboardTaille) => void;
  onChangePresentation: (id: string, presentation: DispositionPresentation) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titreDe = (id: string): string => {
    const widget = widgets.find((w) => w.id === id);
    return widget === undefined ? '' : SOURCES[widget.source].label;
  };

  const [activeId, setActiveId] = useState<string | null>(null);

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
    return (
      <CarteWidget
        key={widget.id}
        widget={widget}
        donnees={source}
        editing={editing}
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
          : renderMark(widget.source, widget.marque, source, widget.presentation)}
      </CarteWidget>
    );
  });

  if (!editing) {
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>;
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
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
