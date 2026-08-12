import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

/**
 * Enregistrement Chart.js — une seule fois, ici.
 *
 * Chart.js 4 est modulaire : rien n'est enregistré par défaut. On déclare
 * exactement les éléments utilisés (ligne, barre, arc) plutôt que d'importer
 * `chart.js/auto`, qui embarque tous les types de graphes et alourdit le
 * bundle du panel sans contrepartie.
 */
Chart.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

export { Chart };
