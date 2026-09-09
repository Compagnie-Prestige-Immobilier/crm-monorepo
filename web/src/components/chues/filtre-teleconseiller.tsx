import { useQuery } from '@tanstack/react-query';

import { Liste } from '@/components/chues/console-ui';
import { fetchComptes, FILTRES_REPRENEURS } from '@/lib/data/users';
import { queryKeys } from '@/lib/query-keys';

const TOUS = 'tous';

/**
 * L'encadrement seul choisit de qui il regarde les appels. Rendu nul pour les
 * autres : le filtre n'existe pas, il n'est pas seulement désactivé.
 */
export function FiltreTeleconseiller({
  id,
  label,
  placeholder,
  actif,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  actif: boolean;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const comptes = useQuery({
    queryKey: queryKeys.commerciaux({ role: 'COMMERCIAL', actifs: true }),
    queryFn: () => fetchComptes(FILTRES_REPRENEURS),
    enabled: actif,
    staleTime: 300_000,
  });

  if (!actif) return null;

  return (
    <div className="flex w-72 flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.875rem] font-[600]">
        {label}
      </label>
      <Liste
        id={id}
        items={[
          { value: TOUS, label: placeholder },
          ...(comptes.data?.items ?? []).map((compte) => ({
            value: compte.id,
            label: compte.fullName,
          })),
        ]}
        value={value ?? TOUS}
        placeholder={placeholder}
        onChange={(valeur) => {
          onChange(valeur === TOUS ? null : valeur);
        }}
      />
    </div>
  );
}
