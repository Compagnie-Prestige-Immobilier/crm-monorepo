import { ChampListe, type Choix } from '@/components/accueil/champs';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  COLONNES_VISITE,
  type EntreeReferentielVisite,
  type ReferentielsVisite,
  type Visite,
  type VisiteRef,
} from '@/lib/data/visites';
import { formatDate } from '@/lib/format';

export const NOM_MAX = 160;
export const TELEPHONE_MAX = 40;
export const COMMENTAIRE_MAX = 2000;

/**
 * Le serveur ne sert que les entrées encore proposées : sans le courant ajouté
 * à la main, le champ paraîtrait vide sur une ligne dont l'entrée a été retirée.
 */
function choix(
  entrees: readonly EntreeReferentielVisite[] | null | undefined,
  courant: VisiteRef | null,
): Choix[] {
  const liste = (entrees ?? []).map((entree) => ({ value: entree.id, label: entree.label }));
  if (courant !== null && !liste.some((option) => option.value === courant.id)) {
    liste.unshift({ value: courant.id, label: `${courant.label} (retiré)` });
  }
  return liste;
}

export interface Courants {
  entreprise: VisiteRef | null;
  direction: VisiteRef | null;
  destinataire: VisiteRef | null;
  objet: VisiteRef | null;
}

export function courantsDe(visite: Visite | null): Courants {
  if (visite === null) {
    return { entreprise: null, direction: null, destinataire: null, objet: null };
  }
  return {
    entreprise: visite.entreprise,
    direction: visite.direction ?? null,
    destinataire: visite.destinataire ?? null,
    objet: visite.objet,
  };
}

/** L'API refuse de déplacer une ligne d'un jour à l'autre : en correction, la date se lit. */
export function ChampJour({
  correction,
  date,
  erreur,
  onChange,
}: {
  correction: boolean;
  date: string;
  erreur: string | undefined;
  onChange: (date: string) => void;
}) {
  if (correction) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{COLONNES_VISITE.date}</Label>
        <p className="py-2 text-[0.9375rem] font-[600]">{formatDate(date)}</p>
      </div>
    );
  }

  return (
    <Field label={COLONNES_VISITE.date} required error={erreur}>
      {(props) => (
        <Input
          {...props}
          type="date"
          value={date}
          onChange={(evenement) => {
            onChange(evenement.target.value);
          }}
        />
      )}
    </Field>
  );
}

export function ChampsReferentiels({
  referentiels,
  courants,
  valeurs,
  erreurs,
  onChange,
}: {
  referentiels: ReferentielsVisite | undefined;
  courants: Courants;
  valeurs: {
    entrepriseId: string | null;
    directionId: string | null;
    destinataireId: string | null;
    objetId: string | null;
  };
  erreurs: { entrepriseId?: string | undefined; objetId?: string | undefined };
  onChange: (patch: Partial<typeof valeurs>) => void;
}) {
  return (
    <>
      <ChampListe
        label={COLONNES_VISITE.entreprise}
        placeholder="Choisir"
        required
        error={erreurs.entrepriseId}
        options={choix(referentiels?.entreprises, courants.entreprise)}
        value={valeurs.entrepriseId}
        onChange={(entrepriseId) => {
          onChange({ entrepriseId });
        }}
      />
      <ChampListe
        label={COLONNES_VISITE.direction}
        placeholder="Choisir"
        options={choix(referentiels?.directions, courants.direction)}
        value={valeurs.directionId}
        onChange={(directionId) => {
          onChange({ directionId });
        }}
      />
      <ChampListe
        label={COLONNES_VISITE.destinataire}
        placeholder="Choisir"
        options={choix(referentiels?.destinataires, courants.destinataire)}
        value={valeurs.destinataireId}
        onChange={(destinataireId) => {
          onChange({ destinataireId });
        }}
      />
      <ChampListe
        label={COLONNES_VISITE.objet}
        placeholder="Choisir"
        required
        error={erreurs.objetId}
        options={choix(referentiels?.objets, courants.objet)}
        value={valeurs.objetId}
        onChange={(objetId) => {
          onChange({ objetId });
        }}
      />
    </>
  );
}

export function ChampCommentaire({
  valeur,
  erreur,
  onChange,
}: {
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
}) {
  return (
    <Field
      label={COLONNES_VISITE.comment}
      description={`${String(valeur.length)} / ${String(COMMENTAIRE_MAX)} caractères`}
      error={erreur}
    >
      {(props) => (
        <Textarea
          {...props}
          rows={2}
          maxLength={COMMENTAIRE_MAX}
          value={valeur}
          onChange={(evenement) => {
            onChange(evenement.target.value);
          }}
        />
      )}
    </Field>
  );
}
