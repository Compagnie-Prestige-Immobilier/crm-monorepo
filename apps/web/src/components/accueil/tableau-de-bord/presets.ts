import {
  SOURCES,
  type DashboardMarque,
  type DashboardPreset,
  type DashboardSource,
} from '@/components/accueil/tableau-de-bord/sources';

export interface PresetWidget {
  source: DashboardSource;
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
  { source: 'par-jour-semaine', marque: 'radar', taille: 'demi' },
];

const ORGANISATION: PresetWidget[] = [
  { source: 'par-destinataire', marque: 'barres-horizontales', taille: 'pleine' },
  { source: 'par-direction', marque: 'anneau', taille: 'demi' },
  { source: 'par-destinataire-direction', marque: 'carte-de-chaleur', taille: 'pleine' },
  { source: 'par-agent', marque: 'barres-horizontales', taille: 'demi' },
  { source: 'par-entreprise-objet', marque: 'carte-de-chaleur', taille: 'pleine' },
];

const COMPLET: PresetWidget[] = (Object.keys(SOURCES) as DashboardSource[]).map((source) => {
  const forme = SOURCES[source].forme;
  const marque: DashboardMarque =
    forme === 'scalaire'
      ? 'tuile'
      : forme === 'classement'
        ? 'barres-horizontales'
        : forme === 'serie-temporelle'
          ? 'courbe'
          : forme === 'cyclique'
            ? 'aire-polaire'
            : forme === 'matrice'
              ? 'carte-de-chaleur'
              : 'barres-100';
  return { source, marque, taille: forme === 'scalaire' ? 'demi' : 'pleine' };
});

export const PRESETS: Record<DashboardPreset, PresetWidget[]> = {
  essentiel: ESSENTIEL,
  affluence: AFFLUENCE,
  organisation: ORGANISATION,
  complet: COMPLET,
};
