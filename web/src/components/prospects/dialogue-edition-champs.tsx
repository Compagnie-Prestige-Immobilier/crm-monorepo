import { ArrowRightIcon } from 'lucide-react';

import { SEGMENT_LABELS } from '@/components/campagnes/cibles';
import { ChampSelect } from '@/components/ui/champ-select';
import { Field } from '@/components/ui/field';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { Input } from '@/components/ui/input';
import { PROSPECT_STATUTS, PROSPECT_STATUT_LABELS } from '@/lib/data/grand-public';
import { segmentDe, type Prospect } from '@/lib/data/prospects';
import { enOptions, type ReferentielItem } from '@/lib/data/referentiels';

export interface Saisie {
  nom: string;
  prenom: string;
  phone: string;
  statut: (typeof PROSPECT_STATUTS)[number];
  banqueId: string | null;
  syndicatId: string | null;
  representantId: string | null;
}

const STATUTS = PROSPECT_STATUTS.map((statut) => ({
  value: statut,
  label: PROSPECT_STATUT_LABELS[statut],
}));

function segmentCible(
  banques: readonly ReferentielItem[] | null | undefined,
  syndicats: readonly ReferentielItem[] | null | undefined,
  saisie: Saisie,
): string | null {
  const banque = (banques ?? []).find((item) => item.id === saisie.banqueId);
  const syndicat = (syndicats ?? []).find((item) => item.id === saisie.syndicatId);
  if (banque === undefined || syndicat === undefined) return null;
  return segmentDe({
    syndicatSigle: syndicat.sigle ?? '',
    banqueShortName: banque.shortName ?? '',
  });
}

function libelleSegment(segment: string | null): string {
  if (segment === null) return 'Aucun';
  return SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS] ?? segment;
}

export function ChampsEdition({
  statutId,
  saisie,
  prospect,
  banques,
  syndicats,
  representants,
  modifier,
}: {
  statutId: string;
  saisie: Saisie;
  prospect: Prospect;
  banques: readonly ReferentielItem[] | null | undefined;
  syndicats: readonly ReferentielItem[] | null | undefined;
  representants: { options: OptionFiltre[]; onSearchChange: (recherche: string) => void };
  modifier: <K extends keyof Saisie>(cle: K, valeur: Saisie[K]) => void;
}) {
  const cible = segmentCible(banques, syndicats, saisie);
  const bascule = cible !== null && cible !== prospect.segment;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Prénom" required>
        {(props) => (
          <Input
            {...props}
            value={saisie.prenom}
            onChange={(event) => {
              modifier('prenom', event.target.value);
            }}
          />
        )}
      </Field>
      <Field label="Nom" required>
        {(props) => (
          <Input
            {...props}
            value={saisie.nom}
            onChange={(event) => {
              modifier('nom', event.target.value);
            }}
          />
        )}
      </Field>
      <Field label="Téléphone" required description="Un seul prospect par numéro.">
        {(props) => (
          <Input
            {...props}
            type="tel"
            value={saisie.phone}
            onChange={(event) => {
              modifier('phone', event.target.value);
            }}
          />
        )}
      </Field>
      <ChampSelect
        id={statutId}
        label="Statut"
        items={STATUTS}
        value={saisie.statut}
        onChange={(valeur) => {
          modifier('statut', valeur as Saisie['statut']);
        }}
      />
      <FilterCombobox
        label="Banque"
        placeholder="Choisir une banque"
        value={saisie.banqueId}
        options={enOptions(banques)}
        onChange={(banqueId) => {
          modifier('banqueId', banqueId);
        }}
      />
      <FilterCombobox
        label="Syndicat"
        placeholder="Choisir un syndicat"
        value={saisie.syndicatId}
        options={enOptions(syndicats)}
        onChange={(syndicatId) => {
          modifier('syndicatId', syndicatId);
        }}
      />

      {/* Le segment, écrit en clair, JUSTE SOUS les deux listes qui le décident. */}
      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 sm:col-span-2">
        <p className="text-[0.8125rem]">
          <span className="text-muted-foreground">Segment actuel&nbsp;: </span>
          <span className="font-[600]">{libelleSegment(prospect.segment)}</span>
        </p>
        {bascule ? (
          <p role="alert" className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
            <span>{libelleSegment(prospect.segment)}</span>
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            <span className="font-[600]">{libelleSegment(cible)}</span>
            <span className="text-muted-foreground">
              Changer de banque ou de syndicat fait changer la fiche de base.
            </span>
          </p>
        ) : null}
      </div>

      <FilterCombobox
        className="sm:col-span-2"
        label="Représentant"
        placeholder="Choisir un représentant"
        value={saisie.representantId}
        options={representants.options}
        filtrer={false}
        onSearchChange={representants.onSearchChange}
        onChange={(representantId) => {
          modifier('representantId', representantId);
        }}
      />
    </div>
  );
}
