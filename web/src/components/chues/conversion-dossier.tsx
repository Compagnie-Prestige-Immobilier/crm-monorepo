import type { ReactNode } from 'react';

import { Liste, type OptionListe } from '@/components/chues/console-ui';
import {
  ChoixMethode,
  ChoixOuiNon,
  ChoixSituation,
  CoordonneeChues,
  type ContexteConversion,
} from '@/components/chues/conversion-champs';
import type { ChampReglable } from '@/components/chues/conversion-regles';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { PaymentMode } from '@/lib/data/console';
import { DUREES_MOIS, formatDureeMois, PROSPECT_TYPES } from '@/lib/data/grand-public';

const PAIEMENTS: readonly OptionListe[] = [
  { value: 'COMPTANT', label: 'Comptant' },
  { value: 'ECHELONNE', label: 'Échelonné' },
];

const DUREES = DUREES_MOIS.map((mois) => ({ value: String(mois), label: formatDureeMois(mois) }));

export interface ListesReference {
  readonly syndicats: readonly OptionListe[];
  readonly banques: readonly OptionListe[];
  readonly tranches: readonly OptionListe[];
}

/** Le dossier, la banque, le revenu, et la manière dont la personne adhère. */
export function noeudsDossier(
  ctx: ContexteConversion,
  listes: ListesReference,
): Partial<Record<ChampReglable, ReactNode>> {
  const { draft, errors, complet, regles, onChange } = ctx;

  return {
    dureeEtablissementMois: (
      <Field
        label="Durée dans la fonction (mois)"
        required={regles.requis('dureeEtablissementMois', complet)}
        error={errors.dureeEtablissementMois}
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            step={1}
            value={draft.dureeEtablissementMois}
            onChange={(evenement) => {
              onChange({ dureeEtablissementMois: evenement.target.value });
            }}
          />
        )}
      </Field>
    ),
    fonctionnaire: (
      <ChoixOuiNon
        label="Fonctionnaire"
        name="console-fonctionnaire"
        value={draft.fonctionnaire}
        nonDemande={!regles.requis('fonctionnaire', complet)}
        error={errors.fonctionnaire}
        onChange={(fonctionnaire) => {
          onChange({ fonctionnaire });
        }}
      />
    ),
    type: (
      <ChoixSituation
        types={PROSPECT_TYPES}
        value={draft.type}
        error={errors.type}
        onChange={(type) => {
          onChange({ type });
        }}
      />
    ),
    syndicatId: (
      <Field
        label="Syndicat"
        required={regles.requis('syndicatId', complet)}
        error={errors.syndicatId}
      >
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={listes.syndicats}
            value={draft.syndicatId}
            placeholder="Choisir un syndicat"
            onChange={(syndicatId) => {
              onChange({ syndicatId });
            }}
          />
        )}
      </Field>
    ),
    banqueId: (
      <Field label="Banque" required={regles.requis('banqueId', complet)} error={errors.banqueId}>
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={listes.banques}
            value={draft.banqueId}
            placeholder="Choisir une banque"
            onChange={(banqueId) => {
              onChange({ banqueId });
            }}
          />
        )}
      </Field>
    ),
    engagementEnCours: (
      <ChoixOuiNon
        label="Engagement en cours à la banque"
        name="console-engagement"
        value={draft.engagementEnCours}
        nonDemande={!regles.requis('engagementEnCours', complet)}
        error={errors.engagementEnCours}
        onChange={(engagementEnCours) => {
          onChange({ engagementEnCours });
        }}
      />
    ),
    incomeBandId: (
      <Field
        label="Revenu mensuel"
        required={regles.requis('incomeBandId', complet)}
        error={errors.incomeBandId}
      >
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={listes.tranches}
            value={draft.incomeBandId}
            placeholder="Choisir une tranche"
            onChange={(incomeBandId) => {
              onChange({ incomeBandId });
            }}
          />
        )}
      </Field>
    ),
    paymentMode: (
      <Field
        label="Paiement"
        required={regles.requis('paymentMode', false)}
        error={errors.paymentMode}
      >
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={PAIEMENTS}
            value={draft.paymentMode ?? ''}
            placeholder="Choisir un mode"
            onChange={(valeur) => {
              const paymentMode = valeur as PaymentMode;
              onChange({
                paymentMode,
                ...(paymentMode === 'ECHELONNE' ? {} : { dureeSystemeMois: '' }),
              });
            }}
          />
        )}
      </Field>
    ),
    dureeSystemeMois:
      draft.paymentMode === 'ECHELONNE' ? (
        <Field
          label="Durée du système de paiement"
          required={regles.requis('dureeSystemeMois', false)}
          error={errors.dureeSystemeMois}
        >
          {(props) => (
            <Liste
              id={props.id}
              describedBy={props['aria-describedby']}
              items={DUREES}
              value={draft.dureeSystemeMois}
              placeholder="Choisir une durée"
              onChange={(dureeSystemeMois) => {
                onChange({ dureeSystemeMois });
              }}
            />
          )}
        </Field>
      ) : null,
    method: (
      <>
        <ChoixMethode
          value={draft.method}
          error={errors.method}
          onChange={(method) => {
            // Changer de méthode efface la date : le serveur refuse un
            // rendez-vous sur toute autre méthode que la prise de rendez-vous.
            onChange({ method, ...(method === 'APPOINTMENT' ? {} : { rendezVousAt: '' }) });
          }}
        />
        <CoordonneeChues method={draft.method} />
      </>
    ),
    rendezVousAt:
      draft.method === 'APPOINTMENT' ? (
        <Field
          label="Date et heure du rendez-vous"
          required
          error={errors.rendezVousAt}
          description="Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste."
        >
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              className="max-w-64"
              value={draft.rendezVousAt}
              onChange={(evenement) => {
                onChange({ rendezVousAt: evenement.target.value });
              }}
            />
          )}
        </Field>
      ) : null,
  };
}
