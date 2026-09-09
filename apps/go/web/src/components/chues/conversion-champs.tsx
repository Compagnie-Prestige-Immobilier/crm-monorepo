import { useQuery } from '@tanstack/react-query';

import { apiClient, unwrap } from '@/api/client';
import { Liste } from '@/components/chues/console-ui';
import type { ConversionErrors, ReglesChamps } from '@/components/chues/conversion-regles';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { valeursProposees, type ChampLibre } from '@/lib/data/champs-conversion';
import type { ConversionDraft, EnrollmentMethod, ProspectType } from '@/lib/data/console';
import { PROSPECT_TYPE_LABELS } from '@/lib/data/grand-public';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/** Ce que chaque groupe de champs a besoin de savoir pour se rendre. */
export interface ContexteConversion {
  readonly draft: ConversionDraft;
  readonly errors: ConversionErrors;
  readonly complet: boolean;
  readonly regles: ReglesChamps;
  readonly onChange: (patch: Partial<ConversionDraft>) => void;
}

/** Ce que l'écran propose. `PHYSICAL` en sort : il a été versé dans « RDV CPI ». */
const METHODES_ENROLEMENT = [
  'APPOINTMENT',
  'PLATFORM',
  'VOICE_OR_ELECTRONIC_MESSAGING',
  'WHATSAPP',
] as const satisfies readonly EnrollmentMethod[];

export const LIBELLES_METHODE: Record<EnrollmentMethod, string> = {
  APPOINTMENT: 'RDV CPI',
  PHYSICAL: 'RDV CPI',
  PLATFORM: 'Plateforme en ligne',
  PLATEFORME_EN_LIGNE: 'Plateforme en ligne',
  VOICE_OR_ELECTRONIC_MESSAGING: 'Mail',
  MAIL: 'Mail',
  WHATSAPP: 'WhatsApp',
  RDV_CPI: 'RDV CPI',
};

const TUILE = [
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[0.875rem]',
  'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
].join(' ');

const TUILE_CHOISIE = 'border-primary bg-secondary text-secondary-foreground';
const TUILE_LIBRE = 'border-border hover:bg-secondary/60';

function Tuile({
  type,
  name,
  checked,
  onSelect,
  children,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className={cn(TUILE, checked ? TUILE_CHOISIE : TUILE_LIBRE)}>
      <input
        type={type}
        name={name}
        checked={checked}
        className="size-4 accent-[var(--primary)]"
        onChange={onSelect}
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Erreur({ message }: { message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-[0.75rem] text-destructive">
      {message}
    </p>
  );
}

/**
 * « Non demandé » n'existe que là où la question peut rester sans réponse :
 * confondre ce silence avec « non » inventerait une déclaration jamais faite.
 */
export function ChoixOuiNon({
  label,
  name,
  value,
  nonDemande,
  error,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  nonDemande: boolean;
  error?: string | undefined;
  onChange: (value: boolean | null) => void;
}) {
  const choix: readonly { readonly label: string; readonly value: boolean | null }[] = [
    { label: 'Oui', value: true },
    { label: 'Non', value: false },
    ...(nonDemande ? [{ label: 'Non demandé', value: null }] : []),
  ];

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choix.map((option) => (
          <Tuile
            key={option.label}
            type="radio"
            name={name}
            checked={value === option.value}
            onSelect={() => {
              onChange(option.value);
            }}
          >
            {option.label}
          </Tuile>
        ))}
      </div>
      <Erreur message={error} />
    </fieldset>
  );
}

export function ChoixSituation({
  types,
  value,
  error,
  onChange,
}: {
  types: readonly ProspectType[];
  value: ProspectType | null;
  error: string | undefined;
  onChange: (value: ProspectType | null) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">Situation</legend>
      <div className="flex flex-wrap gap-2">
        {types.map((option) => (
          <Tuile
            key={option}
            type="checkbox"
            name="console-situation"
            checked={value === option}
            onSelect={() => {
              onChange(value === option ? null : option);
            }}
          >
            {PROSPECT_TYPE_LABELS[option]}
          </Tuile>
        ))}
      </div>
      <Erreur message={error} />
    </fieldset>
  );
}

export function ChoixMethode({
  value,
  error,
  onChange,
}: {
  value: EnrollmentMethod | null;
  error: string | undefined;
  onChange: (value: EnrollmentMethod) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
        Méthode d’enrôlement
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {METHODES_ENROLEMENT.map((methode) => (
          <Tuile
            key={methode}
            type="radio"
            name="console-method"
            checked={value === methode}
            onSelect={() => {
              onChange(methode);
            }}
          >
            {LIBELLES_METHODE[methode]}
          </Tuile>
        ))}
      </div>
      <Erreur message={error} />
    </fieldset>
  );
}

const COORDONNEES: Partial<
  Record<
    EnrollmentMethod,
    {
      readonly libelle: string;
      readonly cle: 'plateformeChuesUrl' | 'emailChues' | 'whatsappChuesE164';
    }
  >
> = {
  PLATFORM: { libelle: 'Lien de la plateforme CPI CHUES', cle: 'plateformeChuesUrl' },
  VOICE_OR_ELECTRONIC_MESSAGING: { libelle: 'Adresse e-mail CHUES', cle: 'emailChues' },
  WHATSAPP: { libelle: 'Numéro WhatsApp CHUES', cle: 'whatsappChuesE164' },
};

/** Ce que le téléconseiller dicte au prospect, selon la méthode choisie. */
export function CoordonneeChues({ method }: { method: EnrollmentMethod | null }) {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: async () => unwrap(await apiClient.GET('/api/v1/parametres-chues')),
    staleTime: 300_000,
  });

  const attendue = method === null ? undefined : COORDONNEES[method];
  if (attendue === undefined || parametres.data === undefined) return null;

  const valeur = parametres.data[attendue.cle];
  return (
    <p className="rounded-md border border-border px-3 py-2 text-[0.875rem] sm:col-span-2">
      <span className="text-muted-foreground">{attendue.libelle} : </span>
      {valeur === '' ? (
        'à renseigner dans les paramètres CHUES.'
      ) : (
        <span className="select-all font-[600]">{valeur}</span>
      )}
    </p>
  );
}

export function ChampAjoute({
  champ,
  value,
  error,
  onChange,
}: {
  champ: ChampLibre;
  value: string;
  error: string | undefined;
  onChange: (valeur: string) => void;
}) {
  if (champ.type === 'TEXTE') {
    return (
      <Field label={champ.libelle} required={champ.obligatoire} error={error}>
        {(props) => (
          <Input
            {...props}
            value={value}
            onChange={(evenement) => {
              onChange(evenement.target.value);
            }}
          />
        )}
      </Field>
    );
  }

  const items = valeursProposees(champ).map((option) => ({ value: option, label: option }));
  return (
    <Field label={champ.libelle} required={champ.obligatoire} error={error}>
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          items={items}
          value={value}
          placeholder="Choisir une valeur"
          onChange={onChange}
        />
      )}
    </Field>
  );
}
