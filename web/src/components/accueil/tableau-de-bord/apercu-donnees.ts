import { useQuery } from '@tanstack/react-query';

import { plageDuPreset, type PeriodePreset } from '@/components/accueil/tableau-de-bord/periode';
import { donneesVides, type DonneesSource } from '@/components/accueil/tableau-de-bord/sources';
import { fetchCalculs, type Calcul, type Proposition } from '@/lib/data/disposition';
import type { NamedCount } from '@/lib/types';

export interface ChargementDonnees {
  plage: { du: string; au: string };
  cleDonnees: readonly unknown[];
  chargerSource: (source: string) => Promise<DonneesSource | null>;
}

export interface DonneesApercu {
  donnees?: DonneesSource;
  note?: string;
  erreur?: string;
}

const ELARGIR: readonly { preset: PeriodePreset; note: string }[] = [
  { preset: 'trois-mois', note: 'Aperçu sur les 3 derniers mois, la période affichée est vide.' },
  { preset: 'douze-mois', note: 'Aperçu sur les 12 derniers mois, la période affichée est vide.' },
];
const NOTE_EXEMPLE =
  'Exemple fictif : aucune donnée pour l’instant. Le tableau de bord montrera les vrais chiffres.';
const VALEURS = [42, 31, 27, 18, 12, 9];
const SEMAINES = 12;

const LISTES: readonly DonneesSource['forme'][] = ['classement', 'cyclique', 'serie-temporelle'];

function vide(donnees: DonneesSource): boolean {
  if (donneesVides(donnees)) return true;
  return (
    LISTES.includes(donnees.forme) &&
    Array.isArray(donnees.donnee) &&
    donnees.donnee.every((item) => 'value' in item && item.value === 0)
  );
}

const serie = (labels: readonly string[]): NamedCount[] =>
  labels.map((label, rang) => ({ id: label, label, value: VALEURS[rang % VALEURS.length] ?? 1 }));

const exemples = (n: number) => Array.from({ length: n }, (_, i) => `Exemple ${String(i + 1)}`);

/** Garde les libellés réels quand il y en a : seules les valeurs sont inventées. */
function exemple(vide: DonneesSource): DonneesSource {
  switch (vide.forme) {
    case 'classement':
    case 'cyclique':
      return { forme: vide.forme, donnee: serie(exemples(5)) };
    case 'serie-temporelle':
      return {
        forme: vide.forme,
        donnee: Array.from({ length: SEMAINES }, (_, i) => ({
          id: `S${String(i + 1)}`,
          label: `S${String(i + 1)}`,
          value: 20 + Math.round(12 * Math.sin(i / 2)) + i,
        })),
      };
    case 'composition': {
      const lignes =
        vide.donnee.length > 0
          ? vide.donnee
          : exemples(4).map((ligne) => ({ ligne, segments: [] }));
      return {
        forme: vide.forme,
        donnee: lignes.map((l, rang) => {
          const labels = l.segments.length > 0 ? l.segments.map((s) => s.label) : ['Valeur'];
          return {
            ...l,
            segments: serie(labels).map((s) => ({ ...s, value: s.value + rang * 5 })),
          };
        }),
      };
    }
    case 'matrice': {
      const lignes = vide.donnee.lignes.length > 0 ? vide.donnee.lignes : exemples(3);
      const colonnes = vide.donnee.colonnes.length > 0 ? vide.donnee.colonnes : exemples(4);
      const cellules = lignes.flatMap((ligne, i) =>
        colonnes.map((colonne, j) => ({
          ligne,
          colonne,
          value: VALEURS[(i + j) % VALEURS.length] ?? 1,
        })),
      );
      return { forme: vide.forme, donnee: { lignes, colonnes, cellules } };
    }
    default:
      return vide;
  }
}

async function calculer(calcul: Calcul, plage: ChargementDonnees['plage']): Promise<DonneesApercu> {
  const [rendu] = await fetchCalculs([calcul], plage);
  if (rendu?.donnees === undefined) return { erreur: rendu?.erreur ?? 'Le calcul a échoué.' };
  return { donnees: rendu.donnees };
}

async function apercuSource(source: string | undefined, chargement: ChargementDonnees) {
  const donnees = source === undefined ? null : await chargement.chargerSource(source);
  if (donnees === null) return { erreur: 'Cet indicateur n’a pas pu être chargé.' };
  return vide(donnees) ? { donnees: exemple(donnees), note: NOTE_EXEMPLE } : { donnees };
}

async function periodeElargie(calcul: Calcul): Promise<DonneesApercu | null> {
  for (const { preset, note } of ELARGIR) {
    const essai = await calculer(
      { ...calcul, periode: 'ecran' },
      plageDuPreset(preset, new Date()),
    );
    if (essai.donnees !== undefined && !vide(essai.donnees))
      return { donnees: essai.donnees, note };
  }
  return null;
}

/** La fenêtre ne montre jamais un graphique vide : période élargie, sinon exemple signalé. */
async function donneesApercu(
  { calcul, source }: Proposition,
  chargement: ChargementDonnees,
): Promise<DonneesApercu> {
  if (calcul === undefined) return apercuSource(source, chargement);
  const premier = await calculer(calcul, chargement.plage);
  if (premier.donnees === undefined || !vide(premier.donnees)) return premier;
  return (
    (await periodeElargie(calcul)) ?? { donnees: exemple(premier.donnees), note: NOTE_EXEMPLE }
  );
}

export function useDonneesApercu(proposition: Proposition, chargement: ChargementDonnees) {
  const { du, au } = chargement.plage;
  const cible = proposition.calcul ?? proposition.source ?? null;
  return useQuery({
    queryKey: ['tableau-de-bord', 'apercu', cible, du, au, ...chargement.cleDonnees],
    queryFn: () => donneesApercu(proposition, chargement),
  });
}
