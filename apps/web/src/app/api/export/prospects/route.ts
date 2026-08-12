import { relayXlsx, toSearchParams } from '@/app/api/export/relay';
import { toFilterQuery } from '@/lib/api/query-params';
import { exportFileName, type ProspectExportMode } from '@/lib/data/export';
import { parseProspectFilters } from '@/lib/filters';

/**
 * `GET /api/export/prospects`
 *
 * Relais vers `GET {API_URL}/api/v1/export/prospects.xlsx`. La mécanique — mise
 * en flux, rotation de jeton, refus de tout fichier de repli — vit dans
 * `../relay.ts`, partagée avec l'export des dossiers bancaires.
 *
 * Deux modes, et ils ne décrivent pas la même chose :
 *
 *  - `filtered` (défaut) : une feuille correspondant EXACTEMENT aux filtres de
 *    l'écran, plus Représentants et Synthèse ;
 *  - `consolidated` : cinq feuilles fixes — Consolidé, BDD1, BDD2, BDD3, BDD4.
 *    Le critère `segment` y est retiré, puisque c'est le classeur lui-même qui
 *    porte la segmentation. Le laisser passer produirait quatre feuilles vides
 *    sur cinq, et l'utilisateur ne le découvrirait qu'en ouvrant Excel.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode: ProspectExportMode =
    url.searchParams.get('mode') === 'consolidated' ? 'consolidated' : 'filtered';

  // On repasse par le parseur : une valeur inconnue collée dans l'URL ne doit
  // pas être relayée telle quelle au backend. Le tri et la pagination sont
  // écartés — un export contient TOUT ce que le filtre sélectionne, pas la page
  // affichée.
  const filters = parseProspectFilters(url.searchParams);
  const query = toFilterQuery(mode === 'consolidated' ? { ...filters, segment: null } : filters);

  const search = toSearchParams(query);
  if (mode === 'consolidated') search.set('mode', 'consolidated');

  return relayXlsx({
    upstreamPath: 'export/prospects.xlsx',
    search,
    filename: exportFileName(new Date(), mode),
  });
}
