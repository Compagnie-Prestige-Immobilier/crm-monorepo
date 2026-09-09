import type { SourceVisite } from '@/components/accueil/sources-visites';
import type { Donnees } from '@/components/tableau-de-bord/sources';
import type { Widget } from '@/lib/data/disposition';
import type { StatsVisites } from '@/lib/data/visites-stats';

export type Brouillon = Widget[] | null;

export function reordonner(widgets: Brouillon, deId: string, versId: string): Brouillon {
  if (widgets === null) return widgets;
  const depuis = widgets.findIndex((widget) => widget.id === deId);
  const vers = widgets.findIndex((widget) => widget.id === versId);
  if (depuis === -1 || vers === -1) return widgets;
  const suite = [...widgets];
  const [deplace] = suite.splice(depuis, 1);
  if (deplace === undefined) return widgets;
  suite.splice(vers, 0, deplace);
  return suite;
}

export function decaler(widgets: Brouillon, id: string, sens: -1 | 1): Brouillon {
  if (widgets === null) return widgets;
  const index = widgets.findIndex((widget) => widget.id === id);
  const cible = index + sens;
  if (index === -1 || cible < 0 || cible >= widgets.length) return widgets;
  const suite = [...widgets];
  const [deplace] = suite.splice(index, 1);
  if (deplace === undefined) return widgets;
  suite.splice(cible, 0, deplace);
  return suite;
}

export function modifier(widgets: Brouillon, id: string, patch: Partial<Widget>): Brouillon {
  return widgets?.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)) ?? widgets;
}

/** Un widget dont la source a disparu du catalogue du rôle ne se dessine pas. */
export function widgetsActifs(
  edition: boolean,
  brouillon: Brouillon,
  enregistres: readonly Widget[] | undefined,
  catalogue: Readonly<Record<string, SourceVisite>>,
): Widget[] {
  const base = edition ? (brouillon ?? []) : (enregistres ?? []);
  return base.filter((widget) => catalogue[widget.source] !== undefined);
}

export function donneesParSource(
  catalogue: Readonly<Record<string, SourceVisite>>,
  stats: StatsVisites | undefined,
): Map<string, Donnees> {
  const donnees = new Map<string, Donnees>();
  if (stats === undefined) return donnees;
  for (const [source, entree] of Object.entries(catalogue)) {
    donnees.set(source, entree.extraire(stats));
  }
  return donnees;
}

export function donneesParWidget(
  widgets: readonly Widget[],
  parSource: Map<string, Donnees>,
): Map<string, Donnees> {
  const donnees = new Map<string, Donnees>();
  for (const widget of widgets) {
    const donnee = parSource.get(widget.source);
    if (donnee !== undefined) donnees.set(widget.id, donnee);
  }
  return donnees;
}
