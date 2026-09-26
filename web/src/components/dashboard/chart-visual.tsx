import type { DashboardMarque } from '@/components/accueil/tableau-de-bord/sources';

const MARQUE_TEXTES: Record<DashboardMarque, { nom: string; usage: string }> = {
  'barres-verticales': { nom: 'Barres debout', usage: 'Comparer les quantités d’un coup d’œil' },
  'barres-horizontales': {
    nom: 'Barres couchées',
    usage: 'Comparer qui fait le plus, noms longs lisibles',
  },
  'barres-groupees': { nom: 'Barres côte à côte', usage: 'Comparer deux groupes ligne par ligne' },
  'barres-empilees': { nom: 'Barres empilées', usage: 'Le total, et ce qu’il y a dedans' },
  'barres-100': {
    nom: 'Barres en pourcentage',
    usage: 'Comparer les parts, quel que soit le total',
  },
  courbe: { nom: 'Courbe', usage: 'Voir si ça monte ou descend dans le temps' },
  aire: { nom: 'Courbe remplie', usage: 'L’évolution, avec le volume sous la courbe' },
  escalier: { nom: 'Marches', usage: 'L’évolution par paliers, sans lissage' },
  anneau: { nom: 'Anneau', usage: 'Voir la part de chacun dans le total' },
  camembert: { nom: 'Camembert', usage: 'La part de chacun, en parts de gâteau' },
  'aire-polaire': { nom: 'Rosace', usage: 'Voir les heures ou les jours en cercle' },
  radar: { nom: 'Toile', usage: 'Voir les points forts et les points faibles' },
  nuage: { nom: 'Nuage de points', usage: 'Un point par élément, pour voir les écarts' },
  bulles: { nom: 'Bulles', usage: 'Plus la bulle est grosse, plus le chiffre est haut' },
  mixte: { nom: 'Barres et courbe', usage: 'Les quantités et la tendance ensemble' },
  jauge: { nom: 'Jauge', usage: 'Où on en est par rapport à un objectif' },
  'carte-de-chaleur': { nom: 'Carte de chaleur', usage: 'Repérer les cases les plus chargées' },
  tableau: { nom: 'Tableau', usage: 'Toutes les lignes, avec le chiffre exact' },
  tuile: { nom: 'Chiffre', usage: 'Un seul chiffre, en grand' },
  'tuile-courbe': { nom: 'Chiffre et courbe', usage: 'Le chiffre, avec sa petite courbe' },
};

export function marqueTexte(marque: DashboardMarque): { nom: string; usage: string } {
  return MARQUE_TEXTES[marque];
}
