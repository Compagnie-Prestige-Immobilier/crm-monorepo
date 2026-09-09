import { Link } from '@tanstack/react-router';

import { deplacable, ETATS } from '@/components/campagnes/fiches-pieces';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CampagneDetail, CampagneFiche } from '@/lib/data/lots-export';
import { formatPhone } from '@/lib/format';
import { lien } from '@/lib/nav';
import type { Projet } from '@/lib/types';

function LigneFiche({
  fiche,
  projet,
  cible,
  cochable,
  cochee,
  onCocher,
}: {
  fiche: CampagneFiche;
  projet: Projet;
  cible: CampagneDetail['cible'];
  cochable: boolean;
  cochee: boolean;
  onCocher: (coche: boolean) => void;
}) {
  const segment = cible === 'PROSPECTS' ? 'prospects' : 'representants';
  return (
    <TableRow>
      {cochable ? (
        <TableCell>
          <input
            type="checkbox"
            className="size-4 accent-primary"
            aria-label={`Attribuer la fiche de ${fiche.fullName}`}
            disabled={!deplacable(fiche)}
            checked={cochee}
            onChange={(event) => {
              onCocher(event.target.checked);
            }}
          />
        </TableCell>
      ) : null}
      <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
        {fiche.ficheId === null ? (
          fiche.fullName
        ) : (
          <Link
            {...lien(`/${projet}/${segment}/${fiche.ficheId}`)}
            className="hover:underline focus-visible:underline"
          >
            {fiche.fullName}
          </Link>
        )}
      </th>
      <TableCell className="tabular-nums">{formatPhone(fiche.phoneE164)}</TableCell>
      <TableCell>{fiche.teleconseillerName}</TableCell>
      <TableCell className="tabular-nums">{fiche.jour}</TableCell>
      <TableCell>
        <Badge variant={fiche.etat === 'NON_TRAITEE' ? 'outline' : 'secondary'}>
          {ETATS[fiche.etat]}
        </Badge>
      </TableCell>
      <TableCell>{fiche.statutLabel ?? '–'}</TableCell>
    </TableRow>
  );
}

export function TableFiches({
  lignes,
  projet,
  cible,
  peutReaffecter,
  cochables,
  cochees,
  onCocherTout,
  onCocherUne,
}: {
  lignes: readonly CampagneFiche[];
  projet: Projet;
  cible: CampagneDetail['cible'];
  peutReaffecter: boolean;
  cochables: readonly CampagneFiche[];
  cochees: readonly number[];
  onCocherTout: (toutes: boolean) => void;
  onCocherUne: (position: number, coche: boolean) => void;
}) {
  if (lignes.length === 0) return null;

  return (
    <Table aria-label="Fiches de la campagne">
      <TableHeader>
        <TableRow>
          {peutReaffecter ? (
            <TableHead scope="col" className="w-10">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label="Cocher toutes les fiches non traitées de la page"
                checked={cochables.length > 0 && cochees.length === cochables.length}
                disabled={cochables.length === 0}
                onChange={(event) => {
                  onCocherTout(event.target.checked);
                }}
              />
            </TableHead>
          ) : null}
          <TableHead scope="col">Fiche</TableHead>
          <TableHead scope="col">Téléphone</TableHead>
          <TableHead scope="col">Téléconseiller</TableHead>
          <TableHead scope="col">Jour</TableHead>
          <TableHead scope="col">État</TableHead>
          <TableHead scope="col">Statut posé</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((fiche) => (
          <LigneFiche
            key={fiche.position}
            fiche={fiche}
            projet={projet}
            cible={cible}
            cochable={peutReaffecter}
            cochee={cochees.includes(fiche.position)}
            onCocher={(coche) => {
              onCocherUne(fiche.position, coche);
            }}
          />
        ))}
      </TableBody>
    </Table>
  );
}
