import {
  CHOIX_RELATION,
  LIBELLES_RELATION,
  type RelationRepresentant,
} from '@/components/representants/filtres';
import { ChampSelect } from '@/components/ui/champ-select';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LIBELLES_WHATSAPP,
  PROFESSIONS,
  STATUTS_WHATSAPP,
  type Representant,
  type StatutWhatsapp,
} from '@/lib/data/representants';

const WHATSAPP = STATUTS_WHATSAPP.map((statut) => ({
  value: statut,
  label: LIBELLES_WHATSAPP[statut],
}));

/** Trois états, car le contrat porte `boolean | null` : « Indéterminé » n'écrit rien. */
const TRI = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'na', label: 'Indéterminé' },
];

function triEnTexte(valeur: boolean | null): string {
  if (valeur === null) return 'na';
  return valeur ? 'oui' : 'non';
}

function triDepuisTexte(valeur: string): boolean | null {
  if (valeur === 'oui') return true;
  if (valeur === 'non') return false;
  return null;
}

export function ChampTexte({
  id,
  label,
  value,
  maxLength,
  placeholder,
  liste,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  placeholder?: string;
  liste?: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        placeholder={placeholder}
        list={liste === undefined ? undefined : `${id}-suggestions`}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {liste === undefined ? null : (
        <datalist id={`${id}-suggestions`}>
          {liste.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/** Le statut relu au chargement reste proposé même s'il n'est plus au choix. */
function choixRelation(courant: RelationRepresentant) {
  return [...new Set<RelationRepresentant>([...CHOIX_RELATION, courant])].map((relation) => ({
    value: relation,
    label: LIBELLES_RELATION[relation],
  }));
}

export function ChampRelation({
  relationId,
  motifId,
  representant,
  relationStatus,
  onRelationStatus,
  basculeVersRefus,
  motif,
  onMotif,
}: {
  relationId: string;
  motifId: string;
  representant: Representant;
  relationStatus: RelationRepresentant;
  onRelationStatus: (value: RelationRepresentant) => void;
  basculeVersRefus: boolean;
  motif: string;
  onMotif: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ChampSelect
        id={relationId}
        label="Qualification"
        aide="Chaque changement est daté et signé dans l’histoire de la fiche."
        items={choixRelation(representant.relationStatus)}
        value={relationStatus}
        onChange={(valeur) => {
          onRelationStatus(valeur as RelationRepresentant);
        }}
      />

      {basculeVersRefus ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <ChampTexte
            id={motifId}
            label="Motif du refus"
            value={motif}
            maxLength={500}
            placeholder="Ce qu’il a répondu"
            onChange={onMotif}
          />
          <p className="text-[0.75rem] text-muted-foreground">
            Facultatif. Repris tel quel dans l’histoire de la relation.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ChampsQualification({
  ids,
  valeurs,
  syndicatId,
  syndicatOptions,
  onChange,
}: {
  ids: { prenom: string; etablissement: string; connaitUES: string; contacte: string };
  valeurs: {
    prenom: string;
    etablissement: string;
    connaitUES: boolean | null;
    contacte: boolean | null;
  };
  syndicatId: string | null;
  syndicatOptions: readonly OptionFiltre[];
  onChange: {
    prenom: (value: string) => void;
    etablissement: (value: string) => void;
    syndicat: (id: string | null) => void;
    connaitUES: (value: boolean | null) => void;
    contacte: (value: boolean | null) => void;
  };
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampTexte
          id={ids.prenom}
          label="Prénom"
          value={valeurs.prenom}
          maxLength={120}
          onChange={onChange.prenom}
        />
        <ChampTexte
          id={ids.etablissement}
          label="Établissement"
          value={valeurs.etablissement}
          maxLength={160}
          onChange={onChange.etablissement}
        />
      </div>

      <FilterCombobox
        label="Syndicat"
        placeholder="Choisir un syndicat"
        value={syndicatId}
        options={syndicatOptions}
        onChange={onChange.syndicat}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ChampSelect
          id={ids.connaitUES}
          label="Connaît l’UES"
          items={TRI}
          value={triEnTexte(valeurs.connaitUES)}
          onChange={(valeur) => {
            onChange.connaitUES(triDepuisTexte(valeur));
          }}
        />
        <ChampSelect
          id={ids.contacte}
          label="Déjà contacté"
          items={TRI}
          value={triEnTexte(valeurs.contacte)}
          onChange={(valeur) => {
            onChange.contacte(triDepuisTexte(valeur));
          }}
        />
      </div>
    </>
  );
}

export function ChampsWhatsappProfession({
  ids,
  whatsappStatus,
  whatsappNumber,
  profession,
  onChange,
}: {
  ids: { whatsapp: string; whatsappNumber: string; profession: string };
  whatsappStatus: StatutWhatsapp;
  whatsappNumber: string;
  profession: string;
  onChange: {
    whatsappStatus: (value: StatutWhatsapp) => void;
    whatsappNumber: (value: string) => void;
    profession: (value: string) => void;
  };
}) {
  return (
    <>
      <ChampSelect
        id={ids.whatsapp}
        label="WhatsApp"
        aide="« Non demandé » dit que la question n’a pas été posée, « pas de WhatsApp » qu’elle l’a été."
        items={WHATSAPP}
        value={whatsappStatus}
        onChange={(valeur) => {
          onChange.whatsappStatus(valeur as StatutWhatsapp);
        }}
      />

      {whatsappStatus === 'AUTRE_NUMERO' ? (
        <ChampTexte
          id={ids.whatsappNumber}
          label="Numéro WhatsApp"
          value={whatsappNumber}
          maxLength={40}
          placeholder="77 123 45 67"
          onChange={onChange.whatsappNumber}
        />
      ) : null}

      <ChampTexte
        id={ids.profession}
        label="Profession"
        value={profession}
        maxLength={120}
        liste={PROFESSIONS}
        onChange={onChange.profession}
      />
    </>
  );
}
