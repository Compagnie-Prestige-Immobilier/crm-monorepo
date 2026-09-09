import {
  CHOIX_WHATSAPP,
  widgetDe,
  type FormulairePublic,
  type SourceListe,
} from '@/lib/data/formulaire-public-champs';
import {
  DUREES_MOIS,
  PAYMENT_MODE_LABELS,
  PROSPECT_TYPES,
  PROSPECT_TYPE_LABELS,
  formatDureeMois,
} from '@/lib/data/grand-public';

export interface OptionListe {
  readonly value: string;
  readonly label: string;
}

const SITUATIONS: readonly OptionListe[] = PROSPECT_TYPES.map((valeur) => ({
  value: valeur,
  label: PROSPECT_TYPE_LABELS[valeur],
}));

const PAIEMENTS: readonly OptionListe[] = Object.entries(PAYMENT_MODE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const DUREES: readonly OptionListe[] = DUREES_MOIS.map((mois) => ({
  value: String(mois),
  label: formatDureeMois(mois),
}));

const enOption = (option: { id: string; libelle: string }): OptionListe => ({
  value: option.id,
  label: option.libelle,
});

const enTranche = (tranche: { mois: number; libelle: string }): OptionListe => ({
  value: String(tranche.mois),
  label: tranche.libelle,
});

export function optionsDe(
  source: SourceListe | undefined,
  formulaire: FormulairePublic,
): readonly OptionListe[] {
  if (source === undefined) return [];
  return {
    banques: (formulaire.banques ?? []).map(enOption),
    syndicats: (formulaire.syndicats ?? []).map(enOption),
    revenus: (formulaire.revenus ?? []).map(enOption),
    professions: (formulaire.professions ?? []).map(enOption),
    dureesEtablissement: (formulaire.dureesEtablissement ?? []).map(enTranche),
    situations: SITUATIONS,
    paiements: PAIEMENTS,
    durees: DUREES,
    whatsapp: CHOIX_WHATSAPP,
  }[source];
}

export function valeurLisible(champ: string, brut: string, formulaire: FormulairePublic): string {
  const valeur = brut.trim();
  const widget = widgetDe(champ);
  if (valeur === '' || widget === undefined) return valeur;
  if (widget.saisie === 'ouinon') return valeur === 'oui' ? 'Oui' : 'Non';
  if (widget.saisie !== 'liste') return valeur;
  return (
    optionsDe(widget.source, formulaire).find((item) => item.value === valeur)?.label ?? valeur
  );
}
