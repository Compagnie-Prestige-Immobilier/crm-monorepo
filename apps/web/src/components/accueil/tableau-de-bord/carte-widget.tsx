'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { evaluerMarques } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  SOURCES,
  mesurerDonnees,
  reglagesHonores,
  spanClass,
  type DashboardMarque,
  type DashboardTaille,
  type DispositionPresentation,
  type DonneesSource,
} from '@/components/accueil/tableau-de-bord/sources';
import { ChartCard } from '@/components/dashboard/chart-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DashboardWidget } from '@/lib/data/visites-dashboard';

export function CarteWidget({
  widget,
  donnees,
  editing,
  peutMonter,
  peutDescendre,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChangeMarque,
  onChangeTaille,
  onChangePresentation,
  children,
}: {
  widget: DashboardWidget;
  donnees: DonneesSource | undefined;
  editing: boolean;
  peutMonter: boolean;
  peutDescendre: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeMarque: (marque: DashboardMarque) => void;
  onChangeTaille: (taille: DashboardTaille) => void;
  onChangePresentation: (presentation: DispositionPresentation) => void;
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
  } = useSortable({ id: widget.id, disabled: !editing });

  const titre = SOURCES[widget.source].label;
  const forme = SOURCES[widget.source].forme;
  const evaluees = donnees === undefined ? [] : evaluerMarques(forme, mesurerDonnees(donnees));
  const taille: DashboardTaille = widget.taille ?? 'demi';
  const honors = reglagesHonores(widget.marque);
  const presentation = widget.presentation ?? {};
  const triPertinent = forme === 'classement';
  const reglagesVisibles = honors.palette || honors.valeurs || honors.legende || triPertinent;

  return (
    <div
      id={`widget-${widget.id}`}
      ref={setNodeRef}
      tabIndex={-1}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(spanClass(widget.marque, widget.taille), isDragging && 'opacity-40')}
    >
      <ChartCard
        title={titre}
        hauteur={taille === 'pleine' ? 'haute' : 'normale'}
        actions={
          editing ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                ref={setActivatorNodeRef}
                type="button"
                aria-label={`Réordonner ${titre} par glisser-déposer`}
                className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                {...attributes}
                {...listeners}
              >
                <GripVerticalIcon className="size-4" aria-hidden="true" />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Monter ${titre}`}
                disabled={!peutMonter}
                onClick={onMoveUp}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Descendre ${titre}`}
                disabled={!peutDescendre}
                onClick={onMoveDown}
              >
                <ArrowDownIcon aria-hidden="true" />
              </Button>

              {evaluees.length > 1 ? (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Changer la présentation de ${titre}`}
                      />
                    }
                  >
                    <PaletteIcon aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent className="flex w-72 flex-col gap-1 p-2" align="end">
                    {evaluees.map((evaluee) => (
                      <button
                        key={evaluee.marque}
                        type="button"
                        onClick={() => {
                          onChangeMarque(evaluee.marque);
                        }}
                        className={cn(
                          'flex flex-col gap-0.5 rounded-md p-2 text-left hover:bg-secondary',
                          evaluee.marque === widget.marque && 'bg-secondary',
                          evaluee.recommandee && 'ring-1 ring-inset ring-accent-border',
                        )}
                      >
                        <span className="text-[0.875rem] font-[600]">
                          {marqueLabel(evaluee.marque)}
                        </span>
                        {evaluee.raison === null ? null : (
                          <span className="text-[0.75rem] text-muted-foreground">
                            {evaluee.raison}
                          </span>
                        )}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : null}

              {reglagesVisibles ? (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Réglages de ${titre}`}
                      />
                    }
                  >
                    <SlidersHorizontalIcon aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent className="flex w-72 flex-col gap-3 p-3" align="end">
                    {honors.palette ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`palette-${widget.id}`}>Palette</Label>
                        <Select
                          value={presentation.palette ?? 'serie'}
                          onValueChange={(value) => {
                            if (value === null) return;
                            onChangePresentation({
                              ...presentation,
                              palette: value,
                            });
                          }}
                        >
                          <SelectTrigger id={`palette-${widget.id}`} size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="serie">Série CPI</SelectItem>
                            <SelectItem value="neutre">Monochrome bordeaux</SelectItem>
                            <SelectItem value="categorielle">Accent or</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {honors.valeurs ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={presentation.valeurs === true}
                        onClick={() => {
                          onChangePresentation({
                            ...presentation,
                            valeurs: presentation.valeurs !== true,
                          });
                        }}
                      >
                        {presentation.valeurs === true
                          ? 'Valeurs affichées'
                          : 'Afficher les valeurs'}
                      </Button>
                    ) : null}

                    {honors.legende ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-pressed={presentation.legende === true}
                        onClick={() => {
                          onChangePresentation({
                            ...presentation,
                            legende: presentation.legende !== true,
                          });
                        }}
                      >
                        {presentation.legende === true ? 'Légende affichée' : 'Afficher la légende'}
                      </Button>
                    ) : null}

                    {triPertinent ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`tri-${widget.id}`}>Tri du classement</Label>
                        <Select
                          value={presentation.tri ?? 'valeur-desc'}
                          onValueChange={(value) => {
                            if (value === null) return;
                            onChangePresentation({
                              ...presentation,
                              tri: value,
                            });
                          }}
                        >
                          <SelectTrigger id={`tri-${widget.id}`} size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="valeur-desc">Valeur décroissante</SelectItem>
                            <SelectItem value="valeur-asc">Valeur croissante</SelectItem>
                            <SelectItem value="alphabetique">Alphabétique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {triPertinent ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`autres-${widget.id}`}>Regrouper au-delà de</Label>
                        <Input
                          id={`autres-${widget.id}`}
                          type="number"
                          min={3}
                          max={15}
                          value={presentation.autresApres ?? 5}
                          onChange={(event) => {
                            const valeur = Number(event.target.value);
                            if (Number.isNaN(valeur)) return;
                            const borne = Math.min(15, Math.max(3, valeur));
                            onChangePresentation({ ...presentation, autresApres: borne });
                          }}
                        />
                      </div>
                    ) : null}
                  </PopoverContent>
                </Popover>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${taille === 'pleine' ? 'Réduire' : 'Agrandir'} ${titre}`}
                onClick={() => {
                  onChangeTaille(taille === 'pleine' ? 'demi' : 'pleine');
                }}
              >
                <span className="text-[0.6875rem] font-[700]">
                  {taille === 'pleine' ? '½' : '⬜'}
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer ${titre}`}
                onClick={onRemove}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {isDragging ? null : children}
      </ChartCard>
    </div>
  );
}

const MARQUE_LABELS: Record<DashboardMarque, string> = {
  'barres-verticales': 'Barres verticales',
  'barres-horizontales': 'Barres horizontales',
  'barres-empilees': 'Barres empilées',
  'barres-100': 'Barres à 100 %',
  'barres-groupees': 'Barres groupées',
  courbe: 'Courbe',
  aire: 'Aire',
  escalier: 'Escalier',
  anneau: 'Anneau',
  camembert: 'Camembert',
  'aire-polaire': 'Aire polaire',
  radar: 'Radar',
  nuage: 'Nuage de points',
  bulles: 'Bulles',
  mixte: 'Mixte',
  jauge: 'Jauge',
  'carte-de-chaleur': 'Carte de chaleur',
  tableau: 'Tableau',
  tuile: 'Tuile',
  'tuile-courbe': 'Tuile avec courbe',
};

function marqueLabel(marque: DashboardMarque): string {
  return MARQUE_LABELS[marque];
}
