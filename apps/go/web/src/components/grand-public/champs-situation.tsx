import type { ReactNode } from 'react';

import { Pays, Relais } from '@/components/grand-public/champs-diaspora';
import { CHAMPS, type Champ, type Situation } from '@/components/grand-public/situation';
import { ChampTelephone, type Indicatif } from '@/components/grand-public/telephone';
import { Field } from '@/components/ui/field';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProspectType } from '@/lib/data/console';
import { MODE_EPARGNE_LABELS, TYPE_CONTRAT_LABELS } from '@/lib/data/grand-public';
import {
  actifs,
  complement,
  libelle,
  type ReferentielItem,
  type Referentiels,
} from '@/lib/data/referentiels';

function enOptions(items: readonly ReferentielItem[] | null | undefined): OptionFiltre[] {
  return actifs(items).map((item) => {
    const hint = complement(item);
    return { value: item.id, label: libelle(item), ...(hint === undefined ? {} : { hint }) };
  });
}

function ListeChamp({
  id,
  label,
  placeholder,
  valeurs,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  valeurs: Readonly<Record<string, string>>;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ''}
        onValueChange={(suivante) => {
          onChange(suivante === null || suivante === '' ? null : suivante);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(valeurs).map(([cle, texte]) => (
            <SelectItem key={cle} value={cle}>
              {texte}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface ProprietesSituation {
  type: ProspectType;
  valeurs: Situation;
  referentiels: Referentiels | undefined;
  enseignante: boolean;
  indicatifs: readonly Indicatif[];
  indicatifWhatsapp: string;
  onIndicatifWhatsapp: (indicatif: string) => void;
  onIndicatifResidence: (indicatif: string) => void;
  onPatch: (patch: Partial<Situation>) => void;
}

/**
 * Référentiel d'abord, saisie libre ensuite : « Créer » retient le texte tapé
 * dans `employeur`, que le serveur garde tel quel faute d'entrée de référence.
 */
function Employeur({ type, valeurs, referentiels, onPatch }: ProprietesSituation) {
  const attendu = type === 'FONCTIONNAIRE' ? 'MINISTERE' : 'ENTREPRISE';
  const liste = enOptions(actifs(referentiels?.employeurs).filter((item) => item.type === attendu));
  const libre = valeurs.employeur.trim() !== '' && valeurs.employeurId === null;

  return (
    <FilterCombobox
      label={type === 'FONCTIONNAIRE' ? 'Ministère ou structure' : 'Employeur'}
      placeholder="Rechercher ou saisir"
      value={libre ? '__libre__' : valeurs.employeurId}
      options={
        libre
          ? [{ value: '__libre__', label: valeurs.employeur, hint: 'Saisi à la main' }, ...liste]
          : liste
      }
      onChange={(value) => {
        onPatch({ employeurId: value === '__libre__' ? null : value, employeur: '' });
      }}
      onCreer={(texte) => {
        onPatch({ employeurId: null, employeur: texte.slice(0, 160) });
      }}
    />
  );
}

/** Une entrée par champ : la table remplace la cascade de conditions. */
const RENDUS: Record<Champ, (p: ProprietesSituation) => ReactNode> = {
  employeur: (p) => <Employeur {...p} />,
  relais: (p) => <Relais valeurs={p.valeurs} onPatch={p.onPatch} />,
  pays: (p) => (
    <Pays
      valeurs={p.valeurs}
      referentiels={p.referentiels}
      options={enOptions(p.referentiels?.pays)}
      onIndicatifResidence={p.onIndicatifResidence}
      onPatch={p.onPatch}
    />
  ),
  contrat: (p) => (
    <ListeChamp
      id="gp-contrat"
      label="Type de contrat"
      placeholder="Choisir un contrat"
      valeurs={TYPE_CONTRAT_LABELS}
      value={p.valeurs.typeContrat}
      onChange={(value) => {
        p.onPatch({ typeContrat: value === null ? null : (value as Situation['typeContrat']) });
      }}
    />
  ),
  epargne: (p) => (
    <ListeChamp
      id="gp-epargne"
      label="Mode d’épargne"
      placeholder="Choisir un mode"
      valeurs={MODE_EPARGNE_LABELS}
      value={p.valeurs.modeEpargne}
      onChange={(value) => {
        p.onPatch({ modeEpargne: value === null ? null : (value as Situation['modeEpargne']) });
      }}
    />
  ),
  banque: (p) => (
    <FilterCombobox
      label={p.type === 'DIASPORA' ? 'Banque au Sénégal' : 'Banque de domiciliation'}
      placeholder="Choisir une banque"
      value={p.valeurs.banqueId}
      options={enOptions(p.referentiels?.banques)}
      onChange={(banqueId) => {
        p.onPatch({ banqueId });
      }}
    />
  ),
  syndicat: (p) =>
    p.enseignante ? (
      <FilterCombobox
        label="Syndicat"
        placeholder="Choisir un syndicat"
        value={p.valeurs.syndicatId}
        options={enOptions(p.referentiels?.syndicats)}
        onChange={(syndicatId) => {
          p.onPatch({ syndicatId });
        }}
      />
    ) : null,
  anciennete: (p) => (
    <Field label="Ancienneté (mois)" description="Chez l’employeur actuel.">
      {(props) => (
        <Input
          {...props}
          type="number"
          min="0"
          max="840"
          inputMode="numeric"
          value={p.valeurs.ancienneteMois}
          onChange={(event) => {
            p.onPatch({ ancienneteMois: event.target.value });
          }}
        />
      )}
    </Field>
  ),
  lieu: (p) => (
    <Field label="Lieu d’activité">
      {(props) => (
        <Input
          {...props}
          value={p.valeurs.lieuActivite}
          maxLength={160}
          onChange={(event) => {
            p.onPatch({ lieuActivite: event.target.value });
          }}
        />
      )}
    </Field>
  ),
  whatsapp: (p) => (
    <ChampTelephone
      label="WhatsApp"
      description="Laissez vide s’il est identique au téléphone."
      required={false}
      indicatifs={p.indicatifs}
      indicatif={p.indicatifWhatsapp}
      valeur={p.valeurs.whatsapp}
      onIndicatif={p.onIndicatifWhatsapp}
      onChange={(whatsapp) => {
        p.onPatch({ whatsapp });
      }}
    />
  ),
};

export function ChampsSituation(
  props: Omit<ProprietesSituation, 'type'> & { type: ProspectType | null },
) {
  const { type } = props;
  if (type === null) return null;

  return (
    <div className="flex flex-col gap-4">
      {CHAMPS[type].map((champ) => (
        <div key={champ} className="contents">
          {RENDUS[champ]({ ...props, type })}
        </div>
      ))}
    </div>
  );
}
