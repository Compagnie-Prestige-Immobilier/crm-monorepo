import type { Jeu, Jeux, SourceChiffre } from '@/components/chiffres/formes';
import { adaptateurPeriode } from '@/components/tableau-de-bord/selecteur-periode';
import type { Donnees } from '@/components/tableau-de-bord/sources';
import {
  fetchChiffresActivite,
  fetchChiffresBanques,
  fetchChiffresCampagne,
  fetchChiffresCampagnes,
  fetchChiffresCreneaux,
  fetchChiffresDelais,
  fetchChiffresEnrolement,
  fetchChiffresEntonnoir,
  fetchChiffresMethodes,
  fetchChiffresOuvertures,
  fetchChiffresRendement,
  fetchChiffresRepresentants,
  type Perimetre,
} from '@/lib/data/chiffres';
import type { Widget } from '@/lib/data/disposition';
import type { AdaptateurFiltres } from '@/lib/filtres-url';

/** Une requête par jeu, et seulement pour les jeux qu'une carte posée réclame. */
export const CHARGEURS: Record<Jeu, (perimetre: Perimetre) => Promise<unknown>> = {
  activite: fetchChiffresActivite,
  entonnoir: fetchChiffresEntonnoir,
  delais: fetchChiffresDelais,
  rendement: fetchChiffresRendement,
  methodes: fetchChiffresMethodes,
  banques: fetchChiffresBanques,
  campagne: fetchChiffresCampagne,
  campagnes: fetchChiffresCampagnes,
  creneaux: fetchChiffresCreneaux,
  representants: fetchChiffresRepresentants,
  ouvertures: fetchChiffresOuvertures,
  enrolement: fetchChiffresEnrolement,
};

export const cleDeJeu = (jeu: Jeu, perimetre: Perimetre): readonly unknown[] => [
  'chiffres',
  jeu,
  perimetre.projet,
  perimetre.plage.from,
  perimetre.plage.to,
  perimetre.commercialId,
];

export interface FiltresChiffres {
  preset: string;
  du: string;
  au: string;
  /** Un seul téléconseiller, ou toute l'équipe. */
  teleconseiller: string | null;
}

/**
 * La période et le téléconseiller regardé vivent dans l'URL : un superviseur
 * envoie l'adresse telle quelle et l'autre voit exactement le même écran.
 */
export const adaptateurChiffres: AdaptateurFiltres<FiltresChiffres> = (() => {
  const periode = adaptateurPeriode('ce-mois');
  return {
    lire: (params) => ({ ...periode.lire(params), teleconseiller: params.get('teleconseiller') }),
    ecrire: ({ teleconseiller, ...reste }) => {
      const params = periode.ecrire(reste);
      if (teleconseiller !== null) params.set('teleconseiller', teleconseiller);
      return params;
    },
    efface: (courant) => ({ ...periode.efface(courant), teleconseiller: null }),
  };
})();

/**
 * Le tiroir a besoin d'une donnée pour conseiller une forme, mais l'ouvrir ne
 * doit pas déclencher six requêtes lourdes : en composition on charge tout, en
 * lecture seulement ce que les cartes posées réclament.
 */
export function jeuxACharger(
  catalogue: Record<string, SourceChiffre>,
  widgets: readonly Widget[],
  edition: boolean,
): Jeu[] {
  const sources = edition
    ? Object.values(catalogue)
    : widgets.flatMap((widget) => {
        const source = catalogue[widget.source];
        return source === undefined ? [] : [source];
      });
  return [...new Set(sources.map((source) => source.jeu))];
}

export interface Resultat {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
}

/** Les requêtes lues comme UN état : ce qui est arrivé, ce qui manque, ce qui a cassé. */
export function etatDesJeux(
  aCharger: readonly Jeu[],
  resultats: readonly Resultat[],
): {
  jeux: Jeux;
  erreur: unknown;
  toutCharge: boolean;
  enRafraichissement: boolean;
} {
  const jeux: Jeux = {};
  aCharger.forEach((jeu, index) => {
    const donnee = resultats[index]?.data;
    if (donnee !== undefined) Object.assign(jeux, { [jeu]: donnee });
  });

  return {
    jeux,
    erreur: resultats.find((resultat) => resultat.isError)?.error ?? null,
    toutCharge: aCharger.length === 0 || resultats.every((r) => r.data !== undefined),
    enRafraichissement: resultats.some((r) => r.isFetching && r.data !== undefined),
  };
}

export function donneesParSourceDe(
  catalogue: Record<string, SourceChiffre>,
  jeux: Jeux,
): Map<string, Donnees> {
  const donnees = new Map<string, Donnees>();
  for (const [cle, source] of Object.entries(catalogue)) {
    const donnee = source.extraire(jeux);
    if (donnee !== null) donnees.set(cle, donnee);
  }
  return donnees;
}

export function donneesParWidgetDe(
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

export function deplacer(courant: Widget[] | null, deId: string, versId: string): Widget[] | null {
  if (courant === null) return courant;
  const de = courant.findIndex((widget) => widget.id === deId);
  const vers = courant.findIndex((widget) => widget.id === versId);
  if (de === -1 || vers === -1) return courant;
  const suivant = [...courant];
  const [deplace] = suivant.splice(de, 1);
  if (deplace === undefined) return courant;
  suivant.splice(vers, 0, deplace);
  return suivant;
}

export function decaler(courant: Widget[] | null, id: string, sens: -1 | 1): Widget[] | null {
  if (courant === null) return courant;
  const index = courant.findIndex((widget) => widget.id === id);
  const cible = index + sens;
  if (index === -1 || cible < 0 || cible >= courant.length) return courant;
  const suivant = [...courant];
  const [deplace] = suivant.splice(index, 1);
  if (deplace === undefined) return courant;
  suivant.splice(cible, 0, deplace);
  return suivant;
}
