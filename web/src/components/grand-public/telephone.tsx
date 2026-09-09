import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { actifs, libelle, type ReferentielItem } from '@/lib/data/referentiels';

export interface Indicatif {
  readonly code: string;
  readonly label: string;
}

/** Les pays d'où l'on appelle le plus, tant que le référentiel n'a pas répondu. */
const DEFAUT: readonly Indicatif[] = [
  { code: '221', label: 'Sénégal +221' },
  { code: '33', label: 'France +33' },
  { code: '225', label: 'Côte d’Ivoire +225' },
  { code: '223', label: 'Mali +223' },
  { code: '224', label: 'Guinée +224' },
  { code: '220', label: 'Gambie +220' },
  { code: '222', label: 'Mauritanie +222' },
  { code: '226', label: 'Burkina Faso +226' },
];

export const INDICATIF_SENEGAL = '221';

export function indicatifsDe(pays: readonly ReferentielItem[] | null | undefined): Indicatif[] {
  const liste = actifs(pays)
    .filter((entree) => entree.indicatif !== null && entree.indicatif !== '')
    .map((entree) => ({
      code: entree.indicatif ?? '',
      label: `${libelle(entree)} +${entree.indicatif ?? ''}`,
    }));
  return liste.length === 0 ? [...DEFAUT] : liste;
}

/**
 * Le serveur normalise et valide le numéro (`normaliserTelephone`) : la page
 * n'assemble que l'indicatif et la frappe, sans seconde table de métadonnées.
 */
export function versE164(saisie: string, indicatif: string): string | null {
  const compact = saisie.trim().replaceAll(/[\s.\-()]/gu, '');
  if (compact === '') return null;
  if (compact.startsWith('+')) return compact;
  const chiffres = compact.startsWith('00') ? compact.slice(2) : compact;
  const nombre = chiffres.replaceAll(/\D/gu, '');
  if (nombre === '') return null;
  return nombre.startsWith(indicatif) ? `+${nombre}` : `+${indicatif}${nombre}`;
}

/** L'inverse : l'indicatif connu le plus long en tête, le national derrière. */
export function separer(
  e164: string | null,
  indicatifs: readonly Indicatif[],
): { national: string; indicatif: string } {
  if (e164 === null || !e164.startsWith('+')) {
    return { national: e164 ?? '', indicatif: INDICATIF_SENEGAL };
  }
  const chiffres = e164.slice(1);
  const trouve = [...indicatifs]
    .sort((gauche, droite) => droite.code.length - gauche.code.length)
    .find((entree) => chiffres.startsWith(entree.code));
  if (trouve === undefined) return { national: chiffres, indicatif: INDICATIF_SENEGAL };
  return { national: chiffres.slice(trouve.code.length), indicatif: trouve.code };
}

export function ChampTelephone({
  label = 'Téléphone',
  description = 'Sénégal par défaut. Changez le pays si nécessaire.',
  required = true,
  indicatifs,
  indicatif,
  valeur,
  erreur,
  onIndicatif,
  onChange,
}: {
  label?: string | undefined;
  description?: string | undefined;
  required?: boolean | undefined;
  indicatifs: readonly Indicatif[];
  indicatif: string;
  valeur: string;
  erreur?: string | undefined;
  onIndicatif: (indicatif: string) => void;
  onChange: (valeur: string) => void;
}) {
  const connu = indicatifs.some((entree) => entree.code === indicatif);

  return (
    <Field label={label} required={required} error={erreur} description={description}>
      {(props) => (
        <div className="flex gap-2">
          <select
            aria-label={`Indicatif ${label.toLocaleLowerCase('fr')}`}
            value={indicatif}
            className="h-11 rounded-md border border-input-border bg-input-background px-3 text-[0.875rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onChange={(event) => {
              onIndicatif(event.target.value);
            }}
          >
            {connu ? null : <option value={indicatif}>+{indicatif}</option>}
            {indicatifs.map((entree) => (
              <option key={entree.code} value={entree.code}>
                {entree.label}
              </option>
            ))}
          </select>
          <Input
            {...props}
            value={valeur}
            maxLength={40}
            inputMode="tel"
            autoComplete="tel"
            placeholder="77 123 45 67"
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        </div>
      )}
    </Field>
  );
}
