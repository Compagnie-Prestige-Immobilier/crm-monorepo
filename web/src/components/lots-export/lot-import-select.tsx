'use client';

import { useQuery } from '@tanstack/react-query';

import { Field } from '@/components/forms/field';
import { Liste } from '@/components/forms/liste';
import { fetchLotExportImports, type LotExportImport } from '@/lib/data/lots-export';
import { formatDateTime, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

export type ImportChoisi = LotExportImport & { projet: Projet };

// Le relevé tourne tous les quarts d'heure : sans l'heure, trois imports du même
// jour portent le même nom et le superviseur ne peut plus les distinguer.
export function etiquetteImport(projet: Projet, importedAt: string): string {
  return `Import ${projet === 'CHUES' ? 'CHUES' : 'GP'} du ${formatDateTime(importedAt)}`;
}

// Un classeur de leads porte un onglet par jour et garde le nom de fichier du
// premier : deux lignes partagent donc l'identifiant du classeur, et seule
// l'adjonction de l'onglet les distingue.
export function cleImport(lot: ImportChoisi): string {
  return `${lot.projet}::${lot.id}::${lot.feuille ?? ''}`;
}

function libelle(lot: ImportChoisi): string {
  const pluriel = lot.fiches > 1 ? 's' : '';
  return `${etiquetteImport(lot.projet, lot.importedAt)} · ${formatNumber(lot.fiches)} fiche${pluriel} · ${lot.libelle}`;
}

function placeholder(chargement: boolean, vide: boolean): string {
  if (chargement) return 'Lecture des imports…';
  if (vide) return 'Aucun import n’a encore créé de fiche.';
  return 'Choisir un import';
}

function useImports(projet: Projet) {
  return useQuery({
    queryKey: queryKeys.lotsExportImports(projet),
    queryFn: () => fetchLotExportImports(projet),
    select: (lots): ImportChoisi[] => lots.map((lot) => ({ ...lot, projet })),
  });
}

export function ChampImport({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (lot: ImportChoisi) => void;
}) {
  const chues = useImports('CHUES');
  const grandPublic = useImports('GRAND_PUBLIC');
  const lots = [...(chues.data ?? []), ...(grandPublic.data ?? [])].sort((a, b) =>
    b.importedAt.localeCompare(a.importedAt),
  );

  return (
    <Field label="Import" description="Du plus récent au plus ancien, CHUES et Grand Public.">
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          items={lots.map((lot) => ({ value: cleImport(lot), label: libelle(lot) }))}
          value={valeur}
          placeholder={placeholder(chues.isPending || grandPublic.isPending, lots.length === 0)}
          onChange={(cle) => {
            const lot = lots.find((candidat) => cleImport(candidat) === cle);
            if (lot !== undefined) onChange(lot);
          }}
        />
      )}
    </Field>
  );
}
