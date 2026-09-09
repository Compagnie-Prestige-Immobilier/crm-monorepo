import { ChevronLeftIcon, ChevronRightIcon, LoaderIcon } from 'lucide-react';

import { LienTelechargement } from '@/components/exports/liens';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  urlFichesRecues,
  type CampagneDetail,
  type CampagneFiche,
  type CampagneFicheEtat,
  type CampagneReaffectation,
} from '@/lib/data/lots-export';

export const TOUS = 'TOUS';

export const ETATS: Record<CampagneFicheEtat, string> = {
  NON_TRAITEE: 'Non traitée',
  TRAITEE: 'Traitée',
  A_RAPPELER: 'À rappeler',
};

/** Une fiche traitée ne se déplace pas : le travail resterait au compteur d'un autre. */
export const deplacable = (fiche: CampagneFiche): boolean => fiche.etat === 'NON_TRAITEE';

type Equipe = NonNullable<CampagneDetail['repartition']>;

export function ChoixListe({
  legende,
  label,
  largeur,
  valeur,
  options,
  onChange,
}: {
  legende: string;
  label: string;
  largeur: string;
  valeur: string;
  options: readonly { value: string; label: string }[];
  onChange: (valeur: string) => void;
}) {
  const items = [{ value: TOUS, label }, ...options];
  return (
    <label className="flex flex-col gap-1.5 text-[0.8125rem] font-[600]">
      {legende}
      <Select
        items={items}
        value={valeur}
        onValueChange={(value) => {
          if (value !== null) onChange(value);
        }}
      >
        <SelectTrigger className={largeur}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function BandeauReaffectation({
  equipe,
  nombre,
  vers,
  enCours,
  onVers,
  onAttribuer,
}: {
  equipe: Equipe;
  nombre: number;
  vers: string;
  enCours: boolean;
  onVers: (id: string) => void;
  onAttribuer: () => void;
}) {
  if (nombre === 0) return null;
  const items = equipe.map((ligne) => ({
    value: ligne.teleconseillerId,
    label: ligne.teleconseillerName,
  }));

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3">
      <p className="text-[0.875rem]">
        <span className="tabular-nums">{nombre}</span> fiche{nombre > 1 ? 's' : ''} à attribuer à
      </p>
      <Select
        items={items}
        value={vers === TOUS ? null : vers}
        onValueChange={(value) => {
          if (value !== null) onVers(value);
        }}
      >
        <SelectTrigger className="w-56" aria-label="Attribuer les fiches à">
          <SelectValue placeholder="Choisir un téléconseiller" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" disabled={vers === TOUS || enCours} onClick={onAttribuer}>
        {enCours ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        Attribuer
      </Button>
    </div>
  );
}

export function FenetreFichesRecues({
  lotId,
  recues,
  onFermer,
}: {
  lotId: string;
  recues: readonly CampagneReaffectation[];
  onFermer: () => void;
}) {
  const attribuees = recues.reduce((somme, trace) => somme + trace.fiches, 0);
  const pluriel = attribuees > 1 ? 's' : '';

  return (
    <Dialog
      open={recues.length > 0}
      onOpenChange={(ouvert) => {
        if (!ouvert) onFermer();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {attribuees} fiche{pluriel} attribuée{pluriel} à {recues[0]?.toName}
          </DialogTitle>
          <DialogDescription>
            Son programme papier ne les contient pas. Le PDF ne reprend que ces fiches, à imprimer
            en complément.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFermer}>
            Fermer
          </Button>
          {recues.map((trace) => (
            <LienTelechargement
              key={trace.id}
              href={urlFichesRecues(lotId, trace.toTeleconseillerId, trace.id)}
              label={`Fiches reçues par ${trace.toName}`}
              variant="default"
            >
              {recues.length > 1
                ? `Fiches de ${trace.fromName} (PDF)`
                : 'Télécharger ses fiches reçues (PDF)'}
            </LienTelechargement>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
        Page {page} sur {pageCount}, {total} fiches
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Page précédente"
        disabled={page === 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
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
