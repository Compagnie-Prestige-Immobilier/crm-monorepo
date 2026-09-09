import { useQuery } from '@tanstack/react-query';
import { Fragment, type ReactNode } from 'react';

import type { OptionListe } from '@/components/chues/console-ui';
import { ChampAjoute, type ContexteConversion } from '@/components/chues/conversion-champs';
import { noeudsDossier } from '@/components/chues/conversion-dossier';
import { noeudsIdentite } from '@/components/chues/conversion-identite';
import {
  reglesChamps,
  type ChampReglable,
  type ConversionErrors,
} from '@/components/chues/conversion-regles';
import type { ChampLibre, ReglageChamp } from '@/lib/data/champs-conversion';
import type { ConversionDraft } from '@/lib/data/console';
import {
  actifs,
  complement,
  fetchReferentiels,
  libelle,
  type ReferentielItem,
} from '@/lib/data/referentiels';
import { queryKeys } from '@/lib/query-keys';

/** L'ordre d'affichage par défaut, quand l'administrateur n'a rien réglé. */
const ORDRE_PAR_DEFAUT: readonly ChampReglable[] = [
  'nom',
  'prenom',
  'phoneE164',
  'whatsappStatus',
  'whatsappE164',
  'email',
  'profession',
  'dureeEtablissementMois',
  'fonctionnaire',
  'type',
  'syndicatId',
  'banqueId',
  'engagementEnCours',
  'incomeBandId',
  'paymentMode',
  'dureeSystemeMois',
  'method',
  'rendezVousAt',
];

/** Situation et mode de paiement n'existent pas sur CHUES : le prospect y est enseignant. */
function visibleParDefaut(champ: string, complet: boolean): boolean {
  if (champ === 'type' || champ === 'paymentMode' || champ === 'dureeSystemeMois') return !complet;
  return true;
}

const parSigle = (items: readonly ReferentielItem[]): OptionListe[] =>
  items.map((item) => ({ value: item.id, label: complement(item) ?? libelle(item) }));

/**
 * L'ordre, la visibilité et le caractère obligatoire viennent de `reglages` :
 * sans réglage chargé, le formulaire reste celui du projet.
 */
export function ConversionFields({
  draft,
  errors,
  phoneE164,
  disabled,
  reglages,
  libres,
  onChange,
}: {
  draft: ConversionDraft;
  errors: ConversionErrors;
  phoneE164: string;
  disabled: boolean;
  reglages: readonly ReglageChamp[];
  libres: readonly ChampLibre[];
  onChange: (patch: Partial<ConversionDraft>) => void;
}) {
  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: fetchReferentiels,
    staleTime: 300_000,
  });

  const complet = draft.projet === 'CHUES';
  const ctx: ContexteConversion = {
    draft,
    errors,
    complet,
    regles: reglesChamps(reglages),
    onChange,
  };

  const noeuds: Partial<Record<ChampReglable, ReactNode>> = {
    ...noeudsIdentite(ctx, phoneE164),
    ...noeudsDossier(ctx, {
      syndicats: parSigle(actifs(referentiels.data?.syndicats)),
      banques: parSigle(actifs(referentiels.data?.banques)),
      tranches: actifs(referentiels.data?.incomeBands).map((item) => ({
        value: item.id,
        label: libelle(item),
      })),
    }),
  };

  const ordre =
    reglages.length > 0 ? reglages.map((regle) => regle.champ as ChampReglable) : ORDRE_PAR_DEFAUT;

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Phase 3 · Conversion
      </legend>

      {ordre.map((champ) =>
        ctx.regles.visible(champ, visibleParDefaut(champ, complet)) ? (
          <Fragment key={champ}>{noeuds[champ]}</Fragment>
        ) : null,
      )}

      {libres.map((champ) => (
        <ChampAjoute
          key={champ.id}
          champ={champ}
          value={draft.champsLibres[champ.id] ?? ''}
          error={errors.libres?.[champ.id]}
          onChange={(valeur) => {
            onChange({ champsLibres: { ...draft.champsLibres, [champ.id]: valeur } });
          }}
        />
      ))}
    </fieldset>
  );
}
