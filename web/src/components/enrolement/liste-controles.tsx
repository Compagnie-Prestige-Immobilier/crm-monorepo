'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';

const TOUS = 'tous';

/**
 * Un statut se lit d'un coup d'oeil par sa teinte : ce qui est abouti, ce qui
 * avance, ce qui attend encore. Le vocabulaire vient des plateformes, le sens
 * est le même des deux côtés.
 */
export function tonStatut(statut: string): 'success' | 'info' | 'outline' | 'destructive' {
  if (statut === 'rejected') return 'destructive';
  if (statut === 'validated' || statut === 'compte-valide' || statut === 'etape-5')
    return 'success';
  if (statut === 'compte-en-attente' || statut === 'etape-0') return 'outline';
  return 'info';
}

/** Les volumes par statut, et le filtre de la liste, sont le même geste. */
export function StatutsBandeau({
  statuts,
  total,
  actif,
  onChoisir,
}: {
  statuts: readonly { id: string; label: string; inscriptions: number }[];
  total: number | undefined;
  actif: string | undefined;
  onChoisir: (statut: string | undefined) => void;
}) {
  if (statuts.length === 0) return null;

  const chips = [
    { id: undefined, label: 'Tous', compte: total ?? 0, ton: 'outline' as const },
    ...statuts.map((statut) => ({
      id: statut.id,
      label: statut.label,
      compte: statut.inscriptions,
      ton: tonStatut(statut.id),
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id ?? TOUS}
          type="button"
          aria-pressed={actif === chip.id}
          onClick={() => {
            onChoisir(chip.id);
          }}
          className={
            actif === chip.id
              ? 'rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.8125rem] text-primary-foreground'
              : 'rounded-full border border-border px-3 py-1.5 text-[0.8125rem] transition-colors hover:bg-secondary'
          }
        >
          {chip.label}
          <span className="ml-2 tabular-nums opacity-80">{formatNumber(chip.compte)}</span>
        </button>
      ))}
    </div>
  );
}

const TAILLES_PAGE = [25, 50, 100] as const;

export function Pagination({
  meta,
  pageSize,
  onPage,
  onPageSize,
}: {
  meta: { total: number; page: number; pageCount: number };
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (taille: number) => void;
}) {
  const pageCount = Math.max(1, meta.pageCount);
  const premiere = meta.total === 0 ? 0 : (meta.page - 1) * pageSize + 1;
  const derniere = Math.min(meta.page * pageSize, meta.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.8125rem] text-muted-foreground tabular-nums" role="status">
        {formatNumber(premiere)}–{formatNumber(derniere)} sur {formatNumber(meta.total)}{' '}
        inscriptions
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="taille-page-enrolement" className="text-[0.8125rem] font-[400]">
            Par page
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(valeur) => {
              if (valeur !== null) onPageSize(Number(valeur));
            }}
          >
            <SelectTrigger id="taille-page-enrolement" size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAILLES_PAGE.map((taille) => (
                <SelectItem key={taille} value={String(taille)}>
                  {formatNumber(taille)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => {
              onPage(meta.page - 1);
            }}
          >
            <ChevronLeftIcon aria-hidden="true" />
            Précédente
          </Button>
          <span className="min-w-16 text-center text-[0.8125rem] tabular-nums">
            {formatNumber(meta.page)} / {formatNumber(pageCount)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={meta.page >= pageCount}
            onClick={() => {
              onPage(meta.page + 1);
            }}
          >
            Suivante
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
