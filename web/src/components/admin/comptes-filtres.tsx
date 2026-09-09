import { SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FILTRES_COMPTES_VIDES, ROLES_COMPTE, type FiltresComptes } from '@/lib/data/users';
import { lireEntier, lireEnum, lireTexte, type AdaptateurFiltres } from '@/lib/filtres-url';
import { ROLE_LABELS, type Role } from '@/lib/types';

const TOUS = 'tous';

const OPTIONS_ROLE = [
  { value: TOUS, label: 'Tous les rôles' },
  ...ROLES_COMPTE.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

const OPTIONS_ETAT = [
  { value: TOUS, label: 'Tous' },
  { value: 'actifs', label: 'Actifs' },
  { value: 'desactives', label: 'Désactivés' },
];

function lireEtat(params: URLSearchParams): boolean | null {
  const etat = lireTexte(params, 'etat');
  if (etat === 'actifs') return true;
  if (etat === 'desactives') return false;
  return null;
}

function valeurEtat(isActive: boolean | null): string {
  if (isActive === null) return TOUS;
  return isActive ? 'actifs' : 'desactives';
}

export const ADAPTATEUR_COMPTES: AdaptateurFiltres<FiltresComptes> = {
  lire: (params) => ({
    ...FILTRES_COMPTES_VIDES,
    search: lireTexte(params, 'recherche') ?? '',
    role: lireEnum(params, 'role', ROLES_COMPTE),
    isActive: lireEtat(params),
    page: lireEntier(params, 'page', 1),
  }),
  ecrire: (filtres) => {
    const params = new URLSearchParams();
    if (filtres.search !== '') params.set('recherche', filtres.search);
    if (filtres.role !== null) params.set('role', filtres.role);
    if (filtres.isActive !== null) params.set('etat', filtres.isActive ? 'actifs' : 'desactives');
    if (filtres.page > 1) params.set('page', String(filtres.page));
    return params;
  },
  efface: () => FILTRES_COMPTES_VIDES,
};

export function ComptesFiltres({
  filtres,
  onChange,
}: {
  filtres: FiltresComptes;
  onChange: (patch: Partial<FiltresComptes>) => void;
}) {
  return (
    <section
      aria-label="Filtres"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <Label htmlFor="recherche-compte">Recherche</Label>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="recherche-compte"
            type="search"
            className="pl-9"
            placeholder="Nom, e-mail, identifiant"
            value={filtres.search}
            onChange={(event) => {
              onChange({ search: event.target.value });
            }}
          />
        </div>
      </div>

      <div className="flex w-48 flex-col gap-1.5">
        <Label htmlFor="role-compte">Rôle</Label>
        <Select
          items={OPTIONS_ROLE}
          value={filtres.role ?? TOUS}
          onValueChange={(valeur) => {
            if (typeof valeur !== 'string') return;
            onChange({ role: valeur === TOUS ? null : (valeur as Role) });
          }}
        >
          <SelectTrigger id="role-compte">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS_ROLE.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-44 flex-col gap-1.5">
        <Label htmlFor="etat-compte">État du compte</Label>
        <Select
          items={OPTIONS_ETAT}
          value={valeurEtat(filtres.isActive)}
          onValueChange={(valeur) => {
            if (typeof valeur !== 'string') return;
            onChange({ isActive: valeur === TOUS ? null : valeur === 'actifs' });
          }}
        >
          <SelectTrigger id="etat-compte">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS_ETAT.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
