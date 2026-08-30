import {
  SOURCES,
  type DashboardMarque,
  type DashboardPreset,
  type VisiteSource,
} from '@/components/accueil/tableau-de-bord/sources';

export interface PresetWidget {
  source: VisiteSource;
  marque: DashboardMarque;
  taille: 'demi' | 'pleine';
}

const ESSENTIEL: PresetWidget[] = [
  { source: 'total-visites', marque: 'tuile', taille: 'demi' },
  { source: 'moyenne-journaliere', marque: 'tuile', taille: 'demi' },
  { source: 'jour-le-plus-charge', marque: 'tuile', taille: 'demi' },
  { source: 'avec-telephone', marque: 'barres-100', taille: 'demi' },
  { source: 'par-entreprise', marque: 'barres-horizontales', taille: 'pleine' },
  { source: 'par-objet', marque: 'anneau', taille: 'demi' },
  { source: 'par-jour', marque: 'courbe', taille: 'demi' },
];

const AFFLUENCE: PresetWidget[] = [
  { source: 'total-visites', marque: 'tuile', taille: 'demi' },
  { source: 'jour-le-plus-charge', marque: 'tuile', taille: 'demi' },
  { source: 'par-heure-jour-semaine', marque: 'carte-de-chaleur', taille: 'pleine' },
  { source: 'par-heure', marque: 'aire-polaire', taille: 'demi' },
  { source: 'par-jour-semaine', marque: 'barres-verticales', taille: 'demi' },
];

const ORGANISATION: PresetWidget[] = [
  { source: 'par-destinataire', marque: 'barres-horizontales', taille: 'pleine' },
  { source: 'par-direction', marque: 'anneau', taille: 'demi' },
  { source: 'par-destinataire-direction', marque: 'carte-de-chaleur', taille: 'pleine' },
  { source: 'par-agent', marque: 'barres-horizontales', taille: 'demi' },
  { source: 'par-entreprise-objet', marque: 'carte-de-chaleur', taille: 'pleine' },
];

const COMPLET: PresetWidget[] = (Object.keys(SOURCES) as VisiteSource[]).map((source) => {
  const forme = SOURCES[source].forme;
  const marque: DashboardMarque = (() => {
    if (forme === 'scalaire') return 'tuile';
    return (() => {
      if (forme === 'classement') return 'barres-horizontales';
      return (() => {
        if (forme === 'serie-temporelle') return 'courbe';
        return (() => {
          if (forme === 'cyclique') return 'aire-polaire';
          return (() => {
            if (forme === 'matrice') return 'carte-de-chaleur';
            return 'barres-100';
          })();
        })();
      })();
    })();
  })();
  return { source, marque, taille: forme === 'scalaire' ? 'demi' : 'pleine' };
});

export const PRESETS: Record<DashboardPreset, PresetWidget[]> = {
  essentiel: ESSENTIEL,
  affluence: AFFLUENCE,
  organisation: ORGANISATION,
  complet: COMPLET,
};
