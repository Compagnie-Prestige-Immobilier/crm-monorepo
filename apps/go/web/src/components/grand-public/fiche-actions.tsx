import { PencilIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { components } from '@/api/schema';
import { PROSPECT_STATUT_LABELS, STATUT_VARIANT, type Consentement } from '@/lib/data/grand-public';

type Parcours = components['schemas']['ProspectJourney'];

function ChoixConsentement({
  consent,
  enCours,
  onConsentement,
  onConvertir,
}: {
  consent: Parcours['consent'];
  enCours: boolean;
  onConsentement: (valeur: Consentement) => void;
  onConvertir: () => void;
}) {
  return (
    <>
      <Button
        variant={consent === 'INTERESSE' ? 'default' : 'outline'}
        disabled={enCours}
        onClick={() => {
          onConsentement('INTERESSE');
        }}
      >
        Intéressé
      </Button>
      <Button
        variant={consent === 'REFUSE' ? 'destructive' : 'outline'}
        disabled={enCours}
        onClick={() => {
          onConsentement('REFUSE');
        }}
      >
        Refusé
      </Button>
      {consent === 'INTERESSE' ? (
        <Button onClick={onConvertir}>Confirmer la conversion</Button>
      ) : null}
    </>
  );
}

/** La conversion se confirme depuis la fiche : le serveur exige l'accord d'abord. */
export function FicheActions({
  parcours,
  peutModifier,
  enCours,
  onModifier,
  onConsentement,
  onConvertir,
}: {
  parcours: Parcours;
  peutModifier: boolean;
  enCours: boolean;
  onModifier: () => void;
  onConsentement: (valeur: Consentement) => void;
  onConvertir: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant={STATUT_VARIANT[parcours.statut]} className="text-[0.8125rem]">
        {PROSPECT_STATUT_LABELS[parcours.statut]}
      </Badge>
      {peutModifier ? (
        <Button variant="outline" onClick={onModifier}>
          <PencilIcon aria-hidden="true" />
          Modifier
        </Button>
      ) : null}
      {peutModifier && parcours.statut !== 'CONVERTI' ? (
        <ChoixConsentement
          consent={parcours.consent}
          enCours={enCours}
          onConsentement={onConsentement}
          onConvertir={onConvertir}
        />
      ) : null}
    </div>
  );
}
