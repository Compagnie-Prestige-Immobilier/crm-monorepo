'use client';

import { useEffect, useRef } from 'react';

import { Kbd } from '@/components/console/console-ui';
import { Button } from '@/components/ui/button';
import type { ReglageChamp } from '@/lib/data/champs-conversion';
import type { ChampReglable, ConversionErrors } from '@/lib/data/console';
import { cn } from '@/lib/utils';

export const ETAPES_DOSSIER = ['Identité', 'Situation', 'Adhésion'] as const;

export type EtapeDossier = (typeof ETAPES_DOSSIER)[number];

/** Exhaustif : un champ ajouté au catalogue sans étape ne compilerait pas, au lieu de disparaître. */
export const ETAPE_DU_CHAMP: Readonly<Record<ChampReglable, EtapeDossier>> = {
  nom: 'Identité',
  prenom: 'Identité',
  phoneE164: 'Identité',
  whatsappStatus: 'Identité',
  whatsappE164: 'Identité',
  email: 'Identité',
  type: 'Situation',
  profession: 'Situation',
  dureeEtablissementMois: 'Situation',
  fonctionnaire: 'Situation',
  syndicatId: 'Situation',
  banqueId: 'Situation',
  engagementEnCours: 'Situation',
  incomeBandId: 'Adhésion',
  paymentMode: 'Adhésion',
  dureeSystemeMois: 'Adhésion',
  method: 'Adhésion',
  rendezVousAt: 'Adhésion',
};

const ETAPE_DE_L_ERREUR: Readonly<Record<keyof ConversionErrors, EtapeDossier>> = {
  ...ETAPE_DU_CHAMP,
  memeWhatsapp: 'Identité',
  whatsapp: 'Identité',
  libres: 'Adhésion',
};

/**
 * Une fiche sans appel n'exige que son identité : ce que l'administrateur rend
 * obligatoire au-delà vaut pour l'adhésion, qui le vérifie à l'enregistrement.
 */
export const sansObligationHorsIdentite = (champs: readonly ReglageChamp[]): ReglageChamp[] =>
  champs.map((regle) =>
    ETAPE_DU_CHAMP[regle.champ as ChampReglable] === 'Identité'
      ? regle
      : { ...regle, obligatoire: false },
  );

export function filtrerErreurs(
  errors: ConversionErrors,
  garder: (etape: EtapeDossier) => boolean,
): ConversionErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([cle]) =>
      garder(ETAPE_DE_L_ERREUR[cle as keyof ConversionErrors]),
    ),
  ) as ConversionErrors;
}

export function premiereEtapeEnErreur(errors: ConversionErrors): EtapeDossier | null {
  const cles = Object.keys(errors) as (keyof ConversionErrors)[];
  return (
    ETAPES_DOSSIER.find((etape) => cles.some((cle) => ETAPE_DE_L_ERREUR[cle] === etape)) ?? null
  );
}

/** Le nombre d'étapes valides depuis la première : la suivante est la dernière atteignable. */
export function etapesValides(errors: ConversionErrors): number {
  const premiere = premiereEtapeEnErreur(errors);
  const valides = premiere === null ? ETAPES_DOSSIER.length : ETAPES_DOSSIER.indexOf(premiere);
  return Math.min(valides, ETAPES_DOSSIER.length - 1);
}

export function EtapesProgression({
  etapes,
  courante,
  atteignable,
  onChoisir,
}: {
  etapes: readonly string[];
  courante: number;
  /** La dernière étape ouverte : au-delà, une étape précédente est encore invalide. */
  atteignable: number;
  onChoisir: (rang: number) => void;
}) {
  const intitule = useRef<HTMLParagraphElement>(null);
  const affichee = useRef(courante);

  // Effet d'un enfant, il passe avant `usePremiereErreur` du formulaire : un champ en erreur garde le focus.
  useEffect(() => {
    if (affichee.current === courante) return;
    affichee.current = courante;
    intitule.current?.focus();
  }, [courante]);

  const ouverte = Math.max(courante, atteignable);

  return (
    <nav aria-label="Étapes" className="flex flex-col gap-2">
      <ol className="flex flex-wrap gap-2">
        {etapes.map((libelle, rang) => (
          <li key={libelle}>
            <BoutonEtape
              libelle={libelle}
              rang={rang}
              active={rang === courante}
              disabled={rang > ouverte}
              onChoisir={onChoisir}
            />
          </li>
        ))}
      </ol>
      <p
        ref={intitule}
        tabIndex={-1}
        className="text-[0.8125rem] font-[600] text-muted-foreground outline-none"
      >
        {`Étape ${String(courante + 1)} sur ${String(etapes.length)} · ${etapes[courante] ?? ''}`}
      </p>
    </nav>
  );
}

function BoutonEtape({
  libelle,
  rang,
  active,
  disabled,
  onChoisir,
}: {
  libelle: string;
  rang: number;
  active: boolean;
  disabled: boolean;
  onChoisir: (rang: number) => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'step' : undefined}
      disabled={disabled}
      onClick={() => {
        onChoisir(rang);
      }}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-md border px-3 text-[0.875rem]',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-secondary font-[600] text-secondary-foreground'
          : 'border-border hover:bg-secondary/60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-[0.75rem] tabular-nums',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {rang + 1}
      </span>
      {libelle}
    </button>
  );
}

export function PiedEtapes({
  courante,
  total,
  disabled,
  raccourcis = false,
  onRetour,
  onContinuer,
}: {
  courante: number;
  total: number;
  disabled: boolean;
  /** Vrai sur l'écran qui écoute Entrée. */
  raccourcis?: boolean;
  onRetour: () => void;
  onContinuer: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {courante > 0 ? (
        <Button variant="outline" disabled={disabled} onClick={onRetour}>
          Retour
        </Button>
      ) : (
        <span />
      )}
      {courante < total - 1 ? (
        <Button disabled={disabled} onClick={onContinuer}>
          Continuer
          {raccourcis ? <Kbd>Entrée</Kbd> : null}
        </Button>
      ) : null}
    </div>
  );
}
