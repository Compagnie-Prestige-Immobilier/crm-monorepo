'use client';

import { CircleHelpIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ACTIONS,
  EVENTS,
  Joyride,
  type EventData,
  type Locale,
  type Step,
  type TooltipRenderProps,
} from 'react-joyride';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const CLE_VUE = 'cpi-tableau-de-bord-visite-vue';

const LOCALE: Locale = {
  back: 'Précédent',
  close: 'Fermer',
  last: 'Terminer',
  next: 'Suivant',
  skip: 'Passer',
};

function etapes(avecEntree: boolean, isAdmin: boolean): Step[] {
  const edition: Step[] = [
    {
      target: '[data-visite="poignee"]',
      title: 'Déplacer une carte',
      content:
        'Glissez la poignée pour changer l’ordre. Sur tablette, gardez le doigt appuyé un instant avant de glisser.',
    },
    {
      target: '[data-visite="actions-carte"]',
      title: 'Régler une carte',
      content: 'Ces boutons changent la forme du graphique, sa largeur, ou retirent la carte.',
    },
    {
      target: '[data-visite="tiroir"]',
      title: 'Ajouter un graphique',
      content: 'Le tiroir liste les indicateurs qui ne sont pas encore posés sur cet écran.',
    },
    {
      target: '[data-visite="enregistrer"]',
      title: 'Garder cette organisation',
      content: isAdmin
        ? 'Enregistrer garde cette organisation pour votre compte. Proposer par défaut la donne aux comptes qui n’ont rien enregistré.'
        : 'Enregistrer garde cette organisation pour votre compte.',
    },
  ];

  if (!avecEntree) return edition;

  return [
    {
      target: '[data-visite="entrer"]',
      title: 'Organiser cet écran',
      content: 'Ce bouton ouvre le mode organisation.',
    },
    ...edition,
  ];
}

/** Le mode organisation s'ouvre après l'étape qui montre son bouton. */
function ouvreLOrganisation(data: EventData): boolean {
  return data.type === EVENTS.STEP_AFTER && data.index === 0 && data.action !== ACTIONS.SKIP;
}

function dejaVue(): boolean {
  try {
    return globalThis.localStorage.getItem(CLE_VUE) !== null;
  } catch {
    return true;
  }
}

function marquerVue(): void {
  try {
    globalThis.localStorage.setItem(CLE_VUE, '1');
  } catch {
    // stockage refusé : la visite reviendra au prochain chargement
  }
}

function Bulle({
  backProps,
  index,
  isLastStep,
  primaryProps,
  size: nombreEtapes,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <Card
      {...tooltipProps}
      className="w-[min(24rem,calc(100vw-2rem))] gap-3 px-4 py-4 shadow-elev-xl"
    >
      <p className="font-display text-[1rem] font-[700] leading-tight">{step.title}</p>
      <div className="text-[0.875rem] text-muted-foreground">{step.content}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] text-muted-foreground">
          {index + 1} / {nombreEtapes}
        </span>
        <div className="flex items-center gap-2">
          <Button {...skipProps} type="button" variant="ghost" size="sm">
            Passer
          </Button>
          {index === 0 ? null : (
            <Button {...backProps} type="button" variant="outline" size="sm">
              Précédent
            </Button>
          )}
          <Button {...primaryProps} type="button" size="sm">
            {isLastStep ? 'Terminer' : 'Suivant'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function VisiteGuidee({
  editing,
  isAdmin,
  onEnter,
}: {
  editing: boolean;
  isAdmin: boolean;
  onEnter: () => void;
}) {
  const [avecEntree, setAvecEntree] = useState<boolean | null>(() => (dejaVue() ? null : true));

  useEffect(() => {
    marquerVue();
  }, []);

  const etapesEnCours = useMemo(() => etapes(avecEntree === true, isAdmin), [avecEntree, isAdmin]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Visite guidée"
        onClick={() => {
          setAvecEntree(!editing);
        }}
      >
        <CircleHelpIcon aria-hidden="true" />
      </Button>
      {avecEntree === null ? null : (
        <Joyride
          run
          continuous
          steps={etapesEnCours}
          locale={LOCALE}
          tooltipComponent={Bulle}
          floatingOptions={{ hideArrow: true }}
          options={{ skipBeacon: true, spotlightPadding: 6, targetWaitTimeout: 3000 }}
          onEvent={(data) => {
            if (data.type === EVENTS.TOUR_END) setAvecEntree(null);
            else if (avecEntree && ouvreLOrganisation(data)) onEnter();
          }}
        />
      )}
    </>
  );
}
