import { Link } from '@tanstack/react-router';
import { PencilIcon, UsersRoundIcon } from 'lucide-react';

import { CarteRepresentant } from '@/components/representants/carte';
import { PastilleRelation } from '@/components/representants/pastille-relation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Representant } from '@/lib/data/representants';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { lien } from '@/lib/nav';
import type { Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

const SANS_VALEUR = '–';

function messageVide(
  filtresActifs: number,
  porteeCampagne: boolean,
): { titre: string; detail: string } {
  if (filtresActifs > 0) {
    return {
      titre: 'Aucun représentant ne correspond à ces critères.',
      detail: 'Élargissez la recherche ou retirez un filtre.',
    };
  }
  if (porteeCampagne) {
    return { titre: 'Aucun représentant.', detail: 'Vos campagnes n’en contiennent aucun.' };
  }
  return {
    titre: 'Aucun représentant enregistré.',
    detail: 'Créez la fiche ici, une par une, ou importez un classeur.',
  };
}

export function EtatVide({
  filtresActifs,
  porteeCampagne,
}: {
  filtresActifs: number;
  porteeCampagne: boolean;
}) {
  const { titre, detail } = messageVide(filtresActifs, porteeCampagne);
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
      <UsersRoundIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-[600]">{titre}</p>
      <p className="max-w-md text-[0.8125rem] text-muted-foreground">{detail}</p>
    </div>
  );
}

function LigneRepresentant({
  representant,
  href,
  onModifier,
}: {
  representant: Representant;
  href: string;
  onModifier: (() => void) | null;
}) {
  return (
    <TableRow>
      <TableCell className="font-[600]">
        <Link {...lien(href)} className="hover:underline focus-visible:underline">
          {representant.fullName}
        </Link>
      </TableCell>
      <TableCell>
        <PastilleRelation
          status={representant.relationStatus}
          label={representant.statutQualificationLabel}
          effect={representant.statutQualificationEffect}
          lastCallOutcome={representant.lastCallOutcome}
        />
      </TableCell>
      <TableCell className="tabular-nums">{formatPhone(representant.phoneE164)}</TableCell>
      <TableCell>{representant.departementName}</TableCell>
      {/* Un tiret, et non « aucune » : les fiches saisies avant l'arrivée du
          référentiel n'en portent pas, et ce n'est pas une anomalie. */}
      <TableCell className="text-muted-foreground">{representant.iefName ?? SANS_VALEUR}</TableCell>
      <TableCell className="text-muted-foreground">{representant.createdByName}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(representant.prospectCount)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(representant.clientCreatedAt)}
      </TableCell>
      {onModifier === null ? null : (
        <TableCell className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Modifier la fiche de ${representant.fullName}`}
            onClick={onModifier}
          >
            <PencilIcon className="size-4" aria-hidden="true" />
            <span aria-hidden="true">Modifier</span>
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

export function Resultats({
  items,
  projet,
  enCours,
  onModifier,
}: {
  items: readonly Representant[];
  projet: Projet;
  enCours: boolean;
  onModifier: ((representant: Representant) => void) | null;
}) {
  const hrefDe = (id: string): string => `/${projet}/representants/${id}`;
  const actionDe = (representant: Representant): (() => void) | null =>
    onModifier === null
      ? null
      : () => {
          onModifier(representant);
        };

  return (
    <>
      <ul className={cn('flex flex-col gap-3 lg:hidden', enCours && 'opacity-80')}>
        {items.map((representant) => (
          <li key={representant.id}>
            <CarteRepresentant
              representant={representant}
              href={hrefDe(representant.id)}
              onModifier={actionDe(representant)}
            />
          </li>
        ))}
      </ul>

      <div
        className={cn(
          'hidden overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity lg:block',
          enCours && 'opacity-80',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Représentant</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>IEF</TableHead>
              <TableHead>Saisi par</TableHead>
              <TableHead className="text-right">Prospects</TableHead>
              <TableHead>Première saisie</TableHead>
              {onModifier === null ? null : (
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((representant) => (
              <LigneRepresentant
                key={representant.id}
                representant={representant}
                href={hrefDe(representant.id)}
                onModifier={actionDe(representant)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
