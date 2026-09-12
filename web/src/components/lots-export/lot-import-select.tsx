'use client';

import { useQuery } from '@tanstack/react-query';

import { Field } from '@/components/forms/field';
import { Liste } from '@/components/forms/liste';
import { fetchLotExportImports, type LotExportImport } from '@/lib/data/lots-export';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

/** Le nom d'un lot importé, tel que le superviseur le retrouve : projet et jour. */
export function etiquetteImport(projet: Projet, importedAt: string): string {
  return `Import ${projet === 'CHUES' ? 'CHUES' : 'GP'} du ${formatDate(importedAt)}`;
}

function libelle(projet: Projet, lot: LotExportImport): string {
  const pluriel = lot.fiches > 1 ? 's' : '';
  return `${etiquetteImport(projet, lot.importedAt)} · ${formatNumber(lot.fiches)} fiche${pluriel} · ${lot.fileName}`;
}

function placeholder(chargement: boolean, vide: boolean): string {
  if (chargement) return 'Lecture des imports…';
  if (vide) return 'Aucun import n’a encore créé de fiche pour ce projet.';
  return 'Choisir un import';
}

export function ChampImport({
  projet,
  valeur,
  onChange,
}: {
  projet: Projet;
  valeur: string;
  onChange: (lot: LotExportImport) => void;
}) {
  const imports = useQuery({
    queryKey: queryKeys.lotsExportImports(projet),
    queryFn: () => fetchLotExportImports(projet),
  });
  const lots = imports.data ?? [];

  return (
    <Field label="Import" description="Du plus récent au plus ancien.">
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          items={lots.map((lot) => ({ value: lot.id, label: libelle(projet, lot) }))}
          value={valeur}
          placeholder={placeholder(imports.isPending, lots.length === 0)}
          onChange={(id) => {
            const lot = lots.find((candidat) => candidat.id === id);
            if (lot !== undefined) onChange(lot);
          }}
        />
      )}
    </Field>
  );
}
