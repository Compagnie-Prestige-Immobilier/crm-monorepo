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
  donneesVides,
  mesurerDonnees,
  reglagesHonores,
  spanClass,
  type Catalogue,
  type CatalogueEntree,
  type DashboardMarque,
  type DashboardTaille,
  type DispositionPresentation,
  type DonneesSource,
  type Forme,
  type ReglagesHonores,
} from '@/components/accueil/tableau-de-bord/sources';
import { ChartCard } from '@/components/dashboard/chart-card';
import { ChoixGraphique, marqueTexte } from '@/components/dashboard/chart-visual';
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

/** Un widget dont la source a quitté le catalogue reste nommé, jamais anonyme. */
/** Une tuile sans canvas n'a pas besoin de la zone réservée à Chart.js. */
function hauteurDe(
  forme: Forme,
  marque: DashboardMarque | undefined,
  taille: DashboardTaille,
  vide: boolean,
): 'compacte' | 'normale' | 'haute' {
  if (vide) return 'compacte';
  if (taille === 'pleine' || forme === 'equipe') return 'haute';
  if (marque === 'tuile') return 'compacte';
  return 'normale';
}

function entreeDe(catalogue: Catalogue, source: string): CatalogueEntree {
  return catalogue[source] ?? { label: source, forme: 'classement' };
}

function ReglagesPopover({
  titre,
  widgetId,
  honors,
  triPertinent,
  presentation,
  onChangePresentation,
}: {
  titre: string;
  widgetId: string;
  honors: ReglagesHonores;
  triPertinent: boolean;
  presentation: DispositionPresentation;
  onChangePresentation: (presentation: DispositionPresentation) => void;
}) {
  return (
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
            <Label htmlFor={`palette-${widgetId}`}>Palette</Label>
            <Select
              value={presentation.palette ?? 'serie'}
              onValueChange={(value) => {
                if (value === null) return;
                onChangePresentation({ ...presentation, palette: value });
              }}
            >
              <SelectTrigger id={`palette-${widgetId}`} size="sm">
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
              onChangePresentation({ ...presentation, valeurs: presentation.valeurs !== true });
            }}
          >
            {presentation.valeurs === true ? 'Valeurs affichées' : 'Afficher les valeurs'}
          </Button>
        ) : null}

        {honors.legende ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={presentation.legende === true}
            onClick={() => {
              onChangePresentation({ ...presentation, legende: presentation.legende !== true });
            }}
          >
            {presentation.legende === true ? 'Légende affichée' : 'Afficher la légende'}
          </Button>
        ) : null}

        {triPertinent ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`tri-${widgetId}`}>Tri du classement</Label>
            <Select
              value={presentation.tri ?? 'valeur-desc'}
              onValueChange={(value) => {
                if (value === null) return;
                onChangePresentation({ ...presentation, tri: value });
              }}
            >
              <SelectTrigger id={`tri-${widgetId}`} size="sm">
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
            <Label htmlFor={`autres-${widgetId}`}>Regrouper au-delà de</Label>
            <Input
              id={`autres-${widgetId}`}
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
  );
}

export function CarteWidget({
  widget,
  donnees,
  editing,
  catalogue = SOURCES,
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
  catalogue?: Catalogue;
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

  const { label: titre, forme, description } = entreeDe(catalogue, widget.source);
  const evaluees = donnees === undefined ? [] : evaluerMarques(forme, mesurerDonnees(donnees));
  const vide = donnees === undefined ? false : donneesVides(donnees);
  const taille: DashboardTaille = widget.taille ?? 'demi';
  const honors = reglagesHonores(widget.marque);
  const presentation = widget.presentation ?? {};
  const triPertinent = forme === 'classement';
  const reglagesVisibles = honors.palette || honors.valeurs || honors.legende || triPertinent;

  // `min-w-0` : sans lui, un tableau large élargit la colonne de grille et toute la page défile.
  return (
    <div
      id={`widget-${widget.id}`}
      ref={setNodeRef}
      tabIndex={-1}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('min-w-0', spanClass(widget.marque, widget.taille), isDragging && 'opacity-40')}
    >
      <ChartCard
        title={titre}
        info={description}
        hauteur={hauteurDe(forme, widget.marque, taille, vide)}
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
                  <PopoverContent
                    className="flex max-h-[70vh] w-80 flex-col gap-1 overflow-y-auto p-2"
                    align="end"
                  >
                    {evaluees.map((evaluee) => (
                      <ChoixGraphique
                        key={evaluee.marque}
                        marque={evaluee.marque}
                        titre={marqueTexte(evaluee.marque).nom}
                        phrase={marqueTexte(evaluee.marque).usage}
                        conseille={evaluee.recommandee}
                        raison={evaluee.raison}
                        selectionne={evaluee.marque === widget.marque}
                        onSelect={() => {
                          onChangeMarque(evaluee.marque);
                        }}
                      />
                    ))}
                  </PopoverContent>
                </Popover>
              ) : null}

              {reglagesVisibles ? (
                <ReglagesPopover
                  titre={titre}
                  widgetId={widget.id}
                  honors={honors}
                  triPertinent={triPertinent}
                  presentation={presentation}
                  onChangePresentation={onChangePresentation}
                />
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
