'use client';

import { SearchIcon } from 'lucide-react';

import { AIDE_PERMISSIONS } from '@/components/commerciaux/permissions-aide';
import { Badge } from '@/components/ui/badge';
import { InfoPopover } from '@/components/ui/info-popover';
import { Input } from '@/components/ui/input';
import type { PermissionCatalogue } from '@/lib/data/roles';
import type { Permission } from '@/lib/types';

/** Les domaines du serveur, rangés en familles pour l'écran seulement. */
const FAMILLES: [string, string[]][] = [
  [
    'Téléconseil et fiches',
    ['Fiches', 'Qualification', 'Portefeuille', 'Campagnes', 'Rendez-vous', 'Représentants'],
  ],
  ['Chiffres et exports', ['Chiffres', 'Exports', 'Assistant']],
  ['Banque & Finance, ventes et enrôlement', ['Banque & Finance', 'Ventes', 'Enrôlement']],
  ['Accueil', ['Accueil']],
  ['Comptes et accès', ['Panneau', 'Comptes', 'Données', 'Support']],
  [
    'Administration',
    [
      'Imports',
      'Référentiels',
      'Formulaires',
      'Courriels',
      'Notifications',
      'Paramètres',
      'Exploitation',
      'Bases',
    ],
  ],
];
const AUTRES = 'Autres';

const familleDe = (domaine: string): string =>
  FAMILLES.find(([, domaines]) => domaines.includes(domaine))?.[0] ?? AUTRES;

const sansAccents = (texte: string): string =>
  texte.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();

function correspond(permission: PermissionCatalogue, recherche: string): boolean {
  if (recherche === '') return true;
  const aide = AIDE_PERMISSIONS[permission.permission as Permission] ?? '';
  return sansAccents(`${permission.libelle} ${permission.domaine} ${aide}`).includes(recherche);
}

export function famillesDePermissions(
  catalogue: readonly PermissionCatalogue[],
  recherche: string,
  garder: (permission: string) => boolean = () => true,
): { nom: string; permissions: PermissionCatalogue[] }[] {
  const cle = sansAccents(recherche.trim());
  const visibles = catalogue.filter((p) => correspond(p, cle) && garder(p.permission));
  return [...FAMILLES.map(([nom]) => nom), AUTRES]
    .map((nom) => ({ nom, permissions: visibles.filter((p) => familleDe(p.domaine) === nom) }))
    .filter((famille) => famille.permissions.length > 0);
}

export function RecherchePermission({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label="Chercher une permission"
        placeholder="Chercher une permission"
        className="pl-9"
        value={valeur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

export function LignePermission({
  permission,
  titulaire,
  coche,
  verrouillee,
  marque,
  onChange,
}: {
  permission: PermissionCatalogue;
  titulaire: string;
  coche: boolean;
  verrouillee: boolean;
  marque: string | null;
  onChange: (permission: string, coche: boolean) => void;
}) {
  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-border py-1">
      <input
        type="checkbox"
        className="size-4"
        aria-label={`${permission.libelle} pour ${titulaire}${verrouillee ? ' (verrouillé)' : ''}`}
        checked={coche}
        disabled={verrouillee}
        onChange={(event) => {
          onChange(permission.permission, event.target.checked);
        }}
      />
      <span className="flex flex-1 items-center gap-1.5 text-[0.875rem]">
        {permission.libelle}
        <InfoPopover
          label={permission.libelle}
          description={AIDE_PERMISSIONS[permission.permission as Permission]}
        />
      </span>
      {marque === null ? null : <Badge variant="outline">{marque}</Badge>}
    </li>
  );
}
