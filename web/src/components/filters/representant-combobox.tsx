'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { getApiClient } from '@/lib/api/browser';
import { unwrap } from '@crm/api-client/query';
import { fetchRepresentant } from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const RESULTATS_MAX = 50;

function optionRepresentant(representant: {
  id: string;
  fullName: string;
  phoneE164: string;
  departementName?: string | null;
}): FilterOption {
  return {
    value: representant.id,
    label: `${representant.fullName} - ${formatPhone(representant.phoneE164)}`,
    hint: representant.departementName ?? undefined,
  };
}

export function useRepresentantLabel(id: string | null): string | null {
  const detail = useQuery({
    queryKey: queryKeys.representant(id ?? ''),
    queryFn: () => fetchRepresentant(id ?? ''),
    enabled: id !== null,
    staleTime: 5 * 60_000,
  });
  return detail.data === undefined ? null : optionRepresentant(detail.data).label;
}

export function RepresentantCombobox({
  label,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
}) {
  const [search, setSearch] = useState('');
  const cherche = useDebouncedValue(search.trim());
  const resultats = useQuery({
    queryKey: [...queryKeys.representantsRoot, 'choix', cherche] as const,
    queryFn: async () =>
      unwrap(
        await getApiClient().GET('/api/v1/representants', {
          params: {
            query: { pageSize: RESULTATS_MAX, ...(cherche === '' ? {} : { search: cherche }) },
          },
        }),
      ).items.map(optionRepresentant),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const libelleChoisi = useRepresentantLabel(value);

  const options = resultats.data ?? [];
  const avecChoisi =
    value === null || libelleChoisi === null || options.some((option) => option.value === value)
      ? options
      : [{ value, label: libelleChoisi }, ...options];

  return (
    <FilterCombobox
      label={label}
      placeholder={placeholder}
      options={avecChoisi}
      value={value}
      onChange={onChange}
      onSearchChange={setSearch}
      filterOptions={false}
      required={required}
    />
  );
}
