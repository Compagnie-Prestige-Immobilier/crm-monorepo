'use client';

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';

import {
  ChartPreview,
  ChoixGraphique,
  marquePhrase,
  marquePourKind,
} from '@/components/dashboard/chart-visual';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export type ChartLayoutItem = {
  id: string;
  label: string;
  visible: boolean;
  kind: 'trend' | 'rank' | 'share' | 'category';
};

export function ChartOrganizer({
  title = 'Organiser',
  items,
  onAdd,
  onRemove,
  onMove,
  onReset,
}: {
  title?: string;
  items: readonly ChartLayoutItem[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onReset: () => void;
}) {
  const visibles = items.filter((item) => item.visible);
  const masques = items.filter((item) => !item.visible);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-[700]">{title}</p>
            <p className="text-[0.75rem] text-muted-foreground">
              {masques.length === 0
                ? 'Tout est affiché. Retirez ou déplacez les cartes inutiles.'
                : `${String(masques.length)} carte${masques.length > 1 ? 's disponibles à ajouter.' : ' disponible à ajouter.'}`}
            </p>
          </div>
          <Sheet>
            <SheetTrigger
              render={
                <Button type="button" variant="outline" size="sm" disabled={masques.length === 0}>
                  <PlusIcon aria-hidden="true" />
                  Ajouter un graphique
                </Button>
              }
            />
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Ajouter un graphique</SheetTitle>
                <SheetDescription>
                  Choisissez une carte absente. L’image montre à quoi elle ressemble.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-4">
                {masques.length === 0 ? (
                  <p className="py-6 text-center text-[0.875rem] text-muted-foreground">
                    Toutes les cartes sont déjà affichées.
                  </p>
                ) : (
                  masques.map((item) => (
                    <ChoixGraphique
                      key={item.id}
                      marque={marquePourKind(item.kind)}
                      titre={item.label}
                      phrase={marquePhrase(marquePourKind(item.kind))}
                      onSelect={() => {
                        onAdd(item.id);
                      }}
                    />
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <RotateCcwIcon aria-hidden="true" />
            Réinitialiser
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {visibles.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-primary/25 bg-secondary/60 px-3 py-2"
            >
              <ChartPreview marque={marquePourKind(item.kind)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-[600]">{item.label}</span>
                <span className="block truncate text-[0.75rem] text-muted-foreground">
                  {marquePhrase(marquePourKind(item.kind))}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Monter ${item.label}`}
                disabled={index === 0}
                onClick={() => {
                  onMove(item.id, -1);
                }}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Descendre ${item.label}`}
                disabled={index === visibles.length - 1}
                onClick={() => {
                  onMove(item.id, 1);
                }}
              >
                <ArrowDownIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer ${item.label}`}
                onClick={() => {
                  onRemove(item.id);
                }}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
