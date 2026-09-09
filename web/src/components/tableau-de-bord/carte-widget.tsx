import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

import { ActionsWidget } from '@/components/tableau-de-bord/actions-widget';
import { ChartCard, type HauteurCarte } from '@/components/tableau-de-bord/chart-card';
import { evaluerMarques } from '@/components/tableau-de-bord/recommandation';
import {
  classeSpan,
  donneesVides,
  mesurerDonnees,
  reglagesHonores,
  type Catalogue,
  type Donnees,
  type EntreeCatalogue,
  type Forme,
  type Marque,
  type Presentation,
  type Taille,
} from '@/components/tableau-de-bord/sources';
import type { Widget } from '@/lib/data/disposition';
import { cn } from '@/lib/utils';

/** Une tuile sans canevas n'a pas besoin de la zone réservée à Chart.js. */
function hauteurDe(
  forme: Forme,
  marque: Marque | undefined,
  taille: Taille,
  vide: boolean,
): HauteurCarte {
  if (vide) return 'compacte';
  if (forme === 'composition' && (marque === 'camembert' || marque === 'anneau')) return 'libre';
  if (taille === 'pleine' || forme === 'equipe') return 'haute';
  if (marque === 'tuile') return 'compacte';
  return 'normale';
}

/** Un widget dont la source a quitté le catalogue reste nommé, jamais anonyme. */
function entreeDe(catalogue: Catalogue, source: string): EntreeCatalogue {
  return catalogue[source] ?? { label: source, forme: 'classement' };
}

export function CarteWidget({
  widget,
  donnees,
  edition,
  catalogue,
  peutMonter,
  peutDescendre,
  onRetirer,
  onMonter,
  onDescendre,
  onMarque,
  onTaille,
  onPresentation,
  children,
}: {
  widget: Widget;
  donnees: Donnees | undefined;
  edition: boolean;
  catalogue: Catalogue;
  peutMonter: boolean;
  peutDescendre: boolean;
  onRetirer: () => void;
  onMonter: () => void;
  onDescendre: () => void;
  onMarque: (marque: Marque) => void;
  onTaille: (taille: Taille | undefined) => void;
  onPresentation: (presentation: Presentation) => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !edition });

  const { label: titre, forme, description } = entreeDe(catalogue, widget.source);
  const evaluees = donnees === undefined ? [] : evaluerMarques(forme, mesurerDonnees(donnees));
  const vide = donnees !== undefined && donneesVides(donnees);
  const taille: Taille = widget.taille ?? 'demi';
  const triPertinent = forme === 'classement';

  // `min-w-0` : sans lui, un tableau large élargit la colonne de grille et
  // toute la page défile horizontalement.
  return (
    <div
      id={`widget-${widget.id}`}
      ref={setNodeRef}
      tabIndex={-1}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        viewTransitionName: `carte-${widget.id}`,
      }}
      className={cn(
        'min-w-0',
        classeSpan(widget.marque, widget.taille),
        isDragging && 'opacity-40',
      )}
    >
      <ChartCard
        titre={titre}
        aide={description}
        hauteur={hauteurDe(forme, widget.marque, taille, vide)}
        actions={
          edition ? (
            <ActionsWidget
              titre={titre}
              widgetId={widget.id}
              marque={widget.marque}
              taille={taille}
              peutMonter={peutMonter}
              peutDescendre={peutDescendre}
              evaluees={evaluees}
              honores={reglagesHonores(widget.marque)}
              triPertinent={triPertinent}
              presentation={widget.presentation ?? {}}
              poignee={{
                attributs: attributes,
                ecouteurs: listeners,
                ancrer: setActivatorNodeRef,
              }}
              onRetirer={onRetirer}
              onMonter={onMonter}
              onDescendre={onDescendre}
              onMarque={onMarque}
              onTaille={onTaille}
              onPresentation={onPresentation}
            />
          ) : undefined
        }
      >
        {isDragging ? null : children}
      </ChartCard>
    </div>
  );
}
