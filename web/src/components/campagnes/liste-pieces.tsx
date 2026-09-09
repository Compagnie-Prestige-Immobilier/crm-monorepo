import { Link } from '@tanstack/react-router';
import { BoxesIcon, ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CampagneResume } from '@/lib/data/lots-export';
import { formatDate, formatNumber } from '@/lib/format';
import { lien } from '@/lib/nav';
import type { Projet } from '@/lib/types';

export const TOUTES = 'TOUTES';

export type FiltreCible = typeof TOUTES | 'PROSPECTS' | 'REPRESENTANTS';

const CIBLES = [
  { value: TOUTES, label: 'Toutes les cibles' },
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
] as const;

export function BarreFiltres({
  projet,
  recherche,
  cible,
  onRecherche,
  onCible,
}: {
  projet: Projet;
  recherche: string;
  cible: FiltreCible;
  onRecherche: (valeur: string) => void;
  onCible: (valeur: FiltreCible) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="campagnes-recherche">Rechercher une campagne</Label>
        <Input
          id="campagnes-recherche"
          value={recherche}
          placeholder="Nom de la campagne"
          onChange={(event) => {
            onRecherche(event.target.value);
          }}
        />
      </div>
      {/* Un lot de représentants est toujours CHUES : ce filtre ne rendrait
          jamais rien en Grand Public. */}
      {projet === 'grand-public' ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campagnes-cible">Cible</Label>
          <Select
            items={[...CIBLES]}
            value={cible}
            onValueChange={(value) => {
              if (value !== null) onCible(value);
            }}
          >
            <SelectTrigger id="campagnes-cible" className="min-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CIBLES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function CarteCampagne({
  lot,
  projet,
  peutSupprimer,
  onSupprimer,
}: {
  lot: CampagneResume;
  projet: Projet;
  peutSupprimer: boolean;
  onSupprimer: () => void;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[1.0625rem] font-[700]">
          <Link
            {...lien(`/${projet}/campagnes/${lot.id}`)}
            className="hover:underline focus-visible:underline"
          >
            {lot.name}
          </Link>
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-[0.8125rem] text-muted-foreground">
            {formatDate(lot.createdAt)}, par {lot.createdByName}
          </p>
          {peutSupprimer ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Supprimer ${lot.name}`}
              onClick={onSupprimer}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-[0.875rem]">
        {lot.scopeLabel} · <span className="tabular-nums">{formatNumber(lot.itemCount)}</span> fiche
        {lot.itemCount > 1 ? 's' : ''}
      </p>
      <p className="text-[0.8125rem] text-muted-foreground">
        {lot.callsSince === 0
          ? 'Aucun appel consigné depuis la création.'
          : `${formatNumber(lot.callsSince)} appels sur ${formatNumber(lot.fichesAppelees)} fiches depuis la création.`}
      </p>
    </article>
  );
}

export function ListeVide({ filtre }: { filtre: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
      <BoxesIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-[600]">
        {filtre
          ? 'Aucune campagne ne correspond à ces critères.'
          : 'Aucune campagne pour l’instant.'}
      </p>
      <p className="max-w-md text-[0.8125rem] text-muted-foreground">
        {filtre
          ? 'Élargissez la recherche ou changez la cible.'
          : 'Créez-en une pour répartir des fiches.'}
      </p>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Page précédente"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
        {page} / {pageCount}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Page suivante"
        disabled={page >= pageCount}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function DialogueSuppression({
  cible,
  enCours,
  onFermer,
  onConfirmer,
}: {
  cible: { id: string; name: string } | null;
  enCours: boolean;
  onFermer: () => void;
  onConfirmer: (id: string) => void;
}) {
  return (
    <ConfirmDialog
      open={cible !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onFermer();
      }}
      title={`Supprimer « ${cible?.name ?? ''} » ?`}
      description="La campagne et sa répartition disparaissent. Les fiches et les appels déjà consignés restent en base."
      confirmLabel="Supprimer"
      pending={enCours}
      onConfirm={() => {
        if (cible !== null) onConfirmer(cible.id);
      }}
    />
  );
}
