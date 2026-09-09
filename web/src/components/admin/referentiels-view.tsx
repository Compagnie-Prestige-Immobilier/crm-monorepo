import { Link } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';

import { TableauListe } from '@/components/admin/referentiels-tableau';
import {
  LISTES_REFERENTIEL,
  ONGLET_STATUTS,
  listeParOnglet,
} from '@/components/admin/referentiels-listes';
import { StatutsQualificationView } from '@/components/admin/statuts-qualification-view';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { lireTexte, useFiltresUrl, type AdaptateurFiltres } from '@/lib/filtres-url';

const ONGLET_PAR_DEFAUT = LISTES_REFERENTIEL[0]?.kind ?? 'banques';

const ONGLETS: readonly { value: string; label: string }[] = [
  ...LISTES_REFERENTIEL.map((liste) => ({ value: liste.kind, label: liste.titre })),
  { value: ONGLET_STATUTS, label: 'Statuts de qualification' },
];

interface FiltresListe {
  onglet: string;
  recherche: string;
}

const ADAPTATEUR: AdaptateurFiltres<FiltresListe> = {
  lire: (params) => ({
    onglet: lireTexte(params, 'onglet') ?? ONGLET_PAR_DEFAUT,
    recherche: lireTexte(params, 'recherche') ?? '',
  }),
  ecrire: (filtres) => {
    const params = new URLSearchParams();
    if (filtres.onglet !== ONGLET_PAR_DEFAUT) params.set('onglet', filtres.onglet);
    if (filtres.recherche !== '') params.set('recherche', filtres.recherche);
    return params;
  },
  efface: (filtres) => ({ onglet: filtres.onglet, recherche: '' }),
};

export function ReferentielsView() {
  const { filtres, setFiltres } = useFiltresUrl(ADAPTATEUR);
  const liste = listeParOnglet(filtres.onglet);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Listes de valeurs proposées à la saisie.{' '}
        <Link to="/admin/referentiels/issues-appel" className="underline underline-offset-2">
          Issues d’appel
        </Link>
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-64 flex-col gap-1.5">
          <Label htmlFor="liste-referentiel">Liste</Label>
          <Select
            items={[...ONGLETS]}
            value={
              liste === null && filtres.onglet !== ONGLET_STATUTS
                ? ONGLET_PAR_DEFAUT
                : filtres.onglet
            }
            onValueChange={(valeur) => {
              if (typeof valeur === 'string') setFiltres({ onglet: valeur, recherche: '' });
            }}
          >
            <SelectTrigger id="liste-referentiel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ONGLETS.map((onglet) => (
                <SelectItem key={onglet.value} value={onglet.value}>
                  {onglet.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {liste === null ? null : (
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
            <Label htmlFor="recherche-referentiel">Recherche</Label>
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="recherche-referentiel"
                type="search"
                className="pl-9"
                placeholder="Code ou libellé"
                value={filtres.recherche}
                onChange={(event) => {
                  setFiltres({ recherche: event.target.value });
                }}
              />
            </div>
          </div>
        )}
      </div>

      {liste === null ? (
        <StatutsQualificationView />
      ) : (
        <TableauListe liste={liste} recherche={filtres.recherche} />
      )}
    </div>
  );
}
