'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, FileTextIcon, PhoneIcon } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

import { meQueryOptions } from '@/api/auth';
import { ActionsRendezVous } from '@/components/accueil/rendez-vous-actions';
import { etatDe } from '@/components/accueil/rendez-vous-tableau';
import { PastilleQualification } from '@/components/prospects/etiquettes-statut';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { type RendezVousObtenu } from '@/lib/data/rendez-vous';
import { formatDateTime, formatPhone } from '@/lib/format';
import { peut } from '@/lib/types';

type Ton = ReturnType<typeof etatDe>['ton'];

// Closing et fiche s'ouvrent hors de la bulle : elle se referme avant eux.
export const Ouvrir = createContext<{
  closing: (fiche: RendezVousObtenu) => void;
  fiche: (id: string) => void;
}>({ closing: () => undefined, fiche: () => undefined });

/** Le créneau prend la couleur de ce qui demande un geste d'abord. */
const URGENCE: readonly Ton[] = ['warning', 'info', 'success', 'destructive'];

export function tonDuCreneau(fiches: readonly RendezVousObtenu[]): Ton {
  const tons = new Set(fiches.map((fiche) => etatDe(fiche).ton));
  return URGENCE.find((ton) => tons.has(ton)) ?? etatDe(fiches[0] as RendezVousObtenu).ton;
}

function Bulle({ fiche, onFait }: { fiche: RendezVousObtenu; onFait: () => void }) {
  const ouvrir = useContext(Ouvrir);
  const { data: user } = useQuery(meQueryOptions);
  const etat = etatDe(fiche);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-display text-[1.0625rem] font-[700]">
          {fiche.prenom} {fiche.nom}
        </p>
        <p className="text-sm text-muted-foreground">
          {fiche.quand === null ? '' : formatDateTime(fiche.quand)} · {fiche.type}
          {fiche.site === '' ? '' : ` · ${fiche.site}`}
        </p>
        <span className="mt-2 inline-flex flex-wrap gap-1.5">
          <Badge variant={etat.ton}>{etat.texte}</Badge>
          <PastilleQualification qualification={fiche.qualification} />
        </span>
      </div>
      <ActionsRendezVous
        fiche={fiche}
        peutNoter
        peutCloser
        bulle
        onCloser={(choisie) => {
          onFait();
          ouvrir.closing(choisie);
        }}
        onEnregistrerVisite={null}
        onFait={onFait}
      />
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        {peut(user, 'prospects.lire') ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2"
            onClick={() => {
              onFait();
              ouvrir.fiche(fiche.id);
            }}
          >
            <FileTextIcon className="size-4" aria-hidden="true" />
            Ouvrir la fiche
          </Button>
        ) : null}
        {fiche.phoneE164 === null ? null : (
          <a
            href={`tel:${fiche.phoneE164}`}
            aria-label={`Appeler ${formatPhone(fiche.phoneE164)}`}
            className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2' })}
          >
            <PhoneIcon className="size-4" aria-hidden="true" />
            Appeler
          </a>
        )}
      </div>
    </div>
  );
}

/** Un rendez-vous seul ouvre sa bulle ; plusieurs ouvrent d'abord leur liste. */
export function CreneauRendezVous({
  fiches,
  onFait,
}: {
  fiches: readonly RendezVousObtenu[];
  onFait: () => void;
}) {
  const [choisie, setChoisie] = useState<RendezVousObtenu | null>(
    fiches.length === 1 ? (fiches[0] ?? null) : null,
  );
  if (choisie !== null) {
    return (
      <div className="flex flex-col gap-3">
        {fiches.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1"
            onClick={() => {
              setChoisie(null);
            }}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            Tous les rendez-vous du créneau
          </Button>
        ) : null}
        <Bulle fiche={choisie} onFait={onFait} />
      </div>
    );
  }
  return (
    <ul aria-label="Rendez-vous du créneau" className="flex flex-col divide-y divide-border">
      {fiches.map((fiche) => {
        const etat = etatDe(fiche);
        return (
          <li key={fiche.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
              onClick={() => {
                setChoisie(fiche);
              }}
            >
              <span className="min-w-0">
                <span className="block truncate font-[600]">
                  {fiche.prenom} {fiche.nom}
                </span>
                <span className="block text-[0.8125rem] text-muted-foreground tabular-nums">
                  {fiche.quand === null ? '' : formatDateTime(fiche.quand)} · {fiche.type}
                </span>
              </span>
              <Badge variant={etat.ton}>{etat.texte}</Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
