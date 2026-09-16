'use client';

import { useQuery } from '@tanstack/react-query';

import { Field } from '@/components/forms/field';
import { Liste } from '@/components/forms/liste';
import { fetchLotExportImports, type LotExportImport } from '@/lib/data/lots-export';
import { formatDateTime, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export type ImportChoisi = LotExportImport;

// Un classeur de leads porte un onglet par jour et garde le nom de fichier du
// premier : deux lignes partagent donc l'identifiant du classeur, et seule
// l'adjonction de l'onglet les distingue.
export function cleImport(lot: ImportChoisi): string {
  return `${lot.id}::${lot.feuille ?? ''}`;
}

// Le relevé tourne tous les quarts d'heure : sans l'heure, trois imports du même
// jour portent le même nom et le superviseur ne peut plus les distinguer.
function libelle(lot: ImportChoisi): string {
  const parts = [
    lot.libelle,
    `${formatNumber(lot.fichesChues)} CHUES`,
    `${formatNumber(lot.fichesGrandPublic)} Grand Public`,
    `relevé le ${formatDateTime(lot.importedAt)}`,
  ];
  return parts.join(' · ');
}

const RAYON = 8;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

function couleurCompletion(ratio: number): string {
  if (ratio >= 2 / 3) return 'text-success';
  if (ratio >= 1 / 3) return 'text-warning';
  return 'text-destructive';
}

/** La part des fiches déjà appelées : un import vert n'a presque plus rien à donner. */
function AnneauCompletion({ lot }: { lot: ImportChoisi }) {
  const ratio = lot.fiches === 0 ? 0 : lot.appelees / lot.fiches;
  const pourcent = Math.round(ratio * 100);
  return (
    <span
      role="img"
      aria-label={`${String(pourcent)} % des fiches déjà appelées`}
      className="flex shrink-0 items-center gap-1.5"
    >
      <svg viewBox="0 0 20 20" className={cn('size-5 -rotate-90', couleurCompletion(ratio))}>
        <circle
          cx="10"
          cy="10"
          r={RAYON}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-20"
        />
        <circle
          cx="10"
          cy="10"
          r={RAYON}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCONFERENCE}
          strokeDashoffset={CIRCONFERENCE * (1 - ratio)}
        />
      </svg>
      <span className="w-9 text-right text-[0.75rem] text-muted-foreground tabular-nums">
        {pourcent} %
      </span>
    </span>
  );
}

function placeholder(chargement: boolean, vide: boolean): string {
  if (chargement) return 'Lecture des imports…';
  if (vide) return 'Aucun import n’a encore créé de fiche.';
  return 'Choisir un import';
}

export function ChampImport({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (lot: ImportChoisi) => void;
}) {
  const imports = useQuery({
    queryKey: queryKeys.lotsExportImports,
    queryFn: () => fetchLotExportImports(),
  });
  const lots = imports.data ?? [];

  return (
    <Field label="Import" description="Un onglet par ligne, du plus récent au plus ancien.">
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          items={lots.map((lot) => ({
            value: cleImport(lot),
            label: libelle(lot),
            avant: <AnneauCompletion lot={lot} />,
          }))}
          value={valeur}
          placeholder={placeholder(imports.isPending, lots.length === 0)}
          onChange={(cle) => {
            const lot = lots.find((candidat) => cleImport(candidat) === cle);
            if (lot !== undefined) onChange(lot);
          }}
        />
      )}
    </Field>
  );
}
