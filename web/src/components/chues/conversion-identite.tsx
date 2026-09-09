import type { ReactNode } from 'react';

import { ChoixOuiNon, type ContexteConversion } from '@/components/chues/conversion-champs';
import type { ChampReglable } from '@/components/chues/conversion-regles';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatPhone } from '@/lib/format';

/** Qui est la personne, et par quel numéro on la joint. */
export function noeudsIdentite(
  ctx: ContexteConversion,
  phoneE164: string,
): Partial<Record<ChampReglable, ReactNode>> {
  const { draft, errors, complet, regles, onChange } = ctx;

  return {
    nom: (
      <Field label="Nom" required={regles.requis('nom', true)} error={errors.nom}>
        {(props) => (
          <Input
            {...props}
            value={draft.nom}
            onChange={(evenement) => {
              onChange({ nom: evenement.target.value });
            }}
          />
        )}
      </Field>
    ),
    prenom: (
      <Field label="Prénom" required={regles.requis('prenom', complet)} error={errors.prenom}>
        {(props) => (
          <Input
            {...props}
            value={draft.prenom}
            onChange={(evenement) => {
              onChange({ prenom: evenement.target.value });
            }}
          />
        )}
      </Field>
    ),
    phoneE164: (
      <Field label="Téléphone" description="Le numéro ne se corrige pas depuis un appel.">
        {(props) => <Input {...props} readOnly value={formatPhone(phoneE164)} />}
      </Field>
    ),
    whatsappStatus: (
      <ChoixOuiNon
        label="Ce numéro est-il un numéro WhatsApp ?"
        name="console-whatsapp"
        value={draft.memeWhatsapp}
        nonDemande={false}
        onChange={(memeWhatsapp) => {
          onChange({ memeWhatsapp, ...(memeWhatsapp === false ? {} : { whatsapp: '' }) });
        }}
      />
    ),
    whatsappE164:
      draft.memeWhatsapp === false ? (
        <Field label="Numéro WhatsApp" error={errors.whatsapp}>
          {(props) => (
            <Input
              {...props}
              inputMode="tel"
              autoComplete="off"
              placeholder="77 123 45 67"
              value={draft.whatsapp}
              onChange={(evenement) => {
                onChange({ whatsapp: evenement.target.value });
              }}
            />
          )}
        </Field>
      ) : null,
    email: (
      <Field label="E-mail" required={regles.requis('email', false)} error={errors.email}>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="off"
            value={draft.email}
            onChange={(evenement) => {
              onChange({ email: evenement.target.value });
            }}
          />
        )}
      </Field>
    ),
    profession: (
      <Field
        label="Profession"
        required={regles.requis('profession', complet)}
        error={errors.profession}
      >
        {(props) => (
          <Input
            {...props}
            value={draft.profession}
            onChange={(evenement) => {
              onChange({ profession: evenement.target.value });
            }}
          />
        )}
      </Field>
    ),
  };
}
