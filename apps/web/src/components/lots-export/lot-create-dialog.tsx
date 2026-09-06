'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PROSPECT_TYPES, PROSPECT_TYPE_LABELS } from '@/lib/data/grand-public';
import {
  campagnesPath,
  createLotExport,
  fetchTeleconseillers,
  previewLotExport,
  type CreateLotExportInput,
  type LotExportPreview,
  type Teleconseiller,
} from '@/lib/data/lots-export';
import { fetchDepartements, fetchIefs } from '@/lib/data/reference';
import { formatDateTime, formatNumber } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  BDD_SEGMENTS,
  SEGMENT_LABELS,
  type BddSegment,
  type Departement,
  type Ief,
  type Projet,
  type ProspectType,
} from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

/** Chaque cible appartient à UNE coque : le dialogue ne propose que celles du projet ouvert. */
const CIBLES = [
  {
    cle: 'chues',
    projet: 'CHUES',
    titre: 'Tous les prospects CHUES',
    aide: 'Toutes les fiches du projet CHUES, les quatre segments confondus.',
  },
  {
    cle: 'chues-segment',
    projet: 'CHUES',
    titre: 'Prospects CHUES d’un segment',
    aide: 'Un seul segment, de BDD1 à BDD4.',
  },
  {
    cle: 'grand-public',
    projet: 'GRAND_PUBLIC',
    titre: 'Prospects Grand Public',
    aide: 'Les fiches hors CHUES, tous types ou un seul.',
  },
  {
    cle: 'representants',
    projet: 'CHUES',
    titre: 'Représentants (CHUES)',
    aide: 'Les personnes qui remettent les listes, et non leurs prospects.',
  },
  {
    cle: 'representants-injoignables',
    projet: 'CHUES',
    titre: 'Représentants injoignables',
    aide: 'Ceux dont le dernier appel n’a abouti à aucun échange, sauf les injoignables définitifs.',
  },
  {
    cle: 'contacts-recommandes',
    projet: 'CHUES',
    titre: 'Contacts recommandés',
    aide: 'Les numéros donnés par un représentant qui décline. Une fiche est créée pour chacun au lancement.',
  },
] as const satisfies readonly { cle: string; projet: Projet; titre: string; aide: string }[];

type CleCible = (typeof CIBLES)[number]['cle'];

/** Trois cibles tirent des représentants : les mêmes filtres de lieu leur servent. */
type CleRepresentants = 'representants' | 'representants-injoignables' | 'contacts-recommandes';

const CIBLE_API: Record<CleRepresentants, CreateLotExportInput['cible']> = {
  representants: 'REPRESENTANTS',
  'representants-injoignables': 'REPRESENTANTS_INJOIGNABLES',
  'contacts-recommandes': 'CONTACTS_RECOMMANDES',
};

const TETE: Record<CleRepresentants, string> = {
  representants: 'Représentants',
  'representants-injoignables': 'Représentants injoignables',
  'contacts-recommandes': 'Contacts recommandés',
};

const surRepresentants = (cle: CleCible): cle is CleRepresentants => cle in CIBLE_API;

/** Valeur de liste déroulante qui veut dire « ne pas filtrer ». */
const TOUS = 'TOUS';

/** Le contrat engendré exige ce drapeau : une fiche supprimée ne s'exporte pas. */
const PROSPECTS_VIVANTS = { includeDeleted: false } as const;

const FICHES_PAR_JOUR_DEFAUT = 50;
const JOURS_DEFAUT = 1;

interface Choix {
  cle: CleCible;
  segment: BddSegment;
  type: ProspectType | typeof TOUS;
  departementId: string;
  iefId: string;
  nonQualifies: boolean;
}

const choixInitial = (cle: CleCible): Choix => ({
  cle,
  segment: 'BDD1',
  type: TOUS,
  departementId: TOUS,
  iefId: TOUS,
  nonQualifies: true,
});

/** Ce qui n'est pas un entier valable n'est pas envoyé : le serveur retombe sur le défaut. */
function objectifsRetenus(
  equipe: readonly Teleconseiller[],
  saisies: Readonly<Record<string, string>>,
): { teleconseillerId: string; fichesParJour: number }[] {
  return equipe.flatMap((compte) => {
    const saisi = Number.parseInt(saisies[compte.id] ?? '', 10);
    return Number.isFinite(saisi) && saisi >= 1
      ? [{ teleconseillerId: compte.id, fichesParJour: Math.min(500, saisi) }]
      : [];
  });
}

/** Le libellé d'un référentiel, nul tant qu'il n'est pas lu ou que rien n'est filtré. */
function nomDe(lignes: readonly { id: string; name: string }[] | undefined, id: string) {
  const ligne = (lignes ?? []).find((row) => row.id === id);
  return ligne === undefined ? null : ligne.name;
}

function entierBorne(saisie: string, defaut: number, min: number, max: number): number {
  const valeur = Number.parseInt(saisie, 10);
  if (!Number.isFinite(valeur)) return defaut;
  return Math.min(max, Math.max(min, valeur));
}

/** L'aperçu vient entièrement du serveur : rien n'est recompté ici. */
function texteApercu(apercu: LotExportPreview, jours: number): string {
  const { eligible, places, retenues } = apercu;
  if (eligible === 0) return 'Aucune fiche ne correspond.';

  const pluriel = eligible > 1 ? 's' : '';
  const disponibles = `${formatNumber(eligible)} fiche${pluriel} disponible${pluriel}`;
  const reparties = `${formatNumber(retenues)} seront réparties selon les capacités choisies`;

  if (eligible <= places) {
    return `${disponibles}. ${formatNumber(places)} places pondérées sur ${formatNumber(jours)} jour${jours > 1 ? 's' : ''} : les ${reparties}.`;
  }

  return `${disponibles} pour ${formatNumber(places)} places : ${reparties} ; ${formatNumber(eligible - retenues)} attendront une prochaine campagne.`;
}

type Critere = { corps: Omit<CreateLotExportInput, 'name' | 'distribution'>; etiquette: string };

/**
 * Les trois cibles de représentants partagent les mêmes filtres de lieu. Seule
 * « Représentants » exclut les déjà qualifiés : les injoignables et les
 * contacts recommandés le sont par construction.
 */
function critereRepresentants(
  cle: CleRepresentants,
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  const lieu = [
    nomDepartement === null ? null : `département de ${nomDepartement}`,
    nomIef === null ? null : `IEF ${nomIef}`,
  ].filter((part) => part !== null);
  const exclureQualifies = cle === 'representants' && choix.nonQualifies;
  return {
    corps: {
      cible: CIBLE_API[cle],
      representants: {
        ...(choix.departementId === TOUS ? {} : { departementId: choix.departementId }),
        ...(choix.iefId === TOUS ? {} : { iefId: choix.iefId }),
        ...(exclureQualifies ? { relationStatus: 'INCONNU' as const } : {}),
      },
    },
    etiquette: [exclureQualifies ? 'Représentants non qualifiés' : TETE[cle], ...lieu].join(', '),
  };
}

/**
 * Les critères envoyés à l'API, et l'étiquette qui les dit en français. Cette
 * étiquette devient le nom du lot : le formulaire n'en demande aucun.
 */
function critereDuChoix(
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  if (surRepresentants(choix.cle))
    return critereRepresentants(choix.cle, choix, nomDepartement, nomIef);

  if (choix.cle === 'grand-public') {
    return {
      corps: {
        cible: 'PROSPECTS',
        prospects: {
          ...PROSPECTS_VIVANTS,
          projet: 'GRAND_PUBLIC',
          ...(choix.type === TOUS ? {} : { type: choix.type }),
        },
      },
      etiquette:
        choix.type === TOUS
          ? 'Prospects Grand Public'
          : `Prospects Grand Public, ${PROSPECT_TYPE_LABELS[choix.type]}`,
    };
  }

  if (choix.cle === 'chues-segment') {
    return {
      corps: {
        cible: 'PROSPECTS',
        prospects: { ...PROSPECTS_VIVANTS, projet: 'CHUES', segment: choix.segment },
      },
      etiquette: `Prospects CHUES, segment ${choix.segment}`,
    };
  }

  return {
    corps: { cible: 'PROSPECTS', prospects: { ...PROSPECTS_VIVANTS, projet: 'CHUES' } },
    etiquette: 'Prospects CHUES',
  };
}

/**
 * Le formulaire vit SOUS `DialogContent`, que Base UI démonte à la fermeture :
 * le choix, l'aperçu et l'erreur du serveur repartent donc à zéro d'eux-mêmes à
 * chaque ouverture, sans effet de remise en état.
 */
export function LotCreateDialog({
  open,
  onOpenChange,
  projet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projet: Projet;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <FormulaireDeLot
          projet={projet}
          onCree={() => {
            onOpenChange(false);
          }}
          onAnnule={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Les critères propres à la cible retenue. Rien à afficher pour « tout CHUES ». */
function ChampsCritere({
  choix,
  onChange,
  departements,
  iefs,
}: {
  choix: Choix;
  onChange: (choix: Choix) => void;
  departements: readonly Departement[];
  iefs: readonly Ief[];
}) {
  if (choix.cle === 'chues-segment')
    return (
      <Field label="Segment">
        {(props) => (
          <Select
            items={BDD_SEGMENTS.map((segment) => ({
              value: segment,
              label: SEGMENT_LABELS[segment],
            }))}
            value={choix.segment}
            onValueChange={(value) => {
              if (value === null) return;
              onChange({ ...choix, segment: value });
            }}
          >
            <SelectTrigger id={props.id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BDD_SEGMENTS.map((segment) => (
                <SelectItem key={segment} value={segment}>
                  {SEGMENT_LABELS[segment]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    );

  if (choix.cle === 'grand-public')
    return (
      <Field label="Type de prospect">
        {(props) => (
          <Select
            items={[
              { value: TOUS, label: 'Tous les types' },
              ...PROSPECT_TYPES.map((type) => ({ value: type, label: PROSPECT_TYPE_LABELS[type] })),
            ]}
            value={choix.type}
            onValueChange={(value) => {
              if (value === null) return;
              onChange({ ...choix, type: value });
            }}
          >
            <SelectTrigger id={props.id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les types</SelectItem>
              {PROSPECT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {PROSPECT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    );

  if (!surRepresentants(choix.cle)) return null;

  const iefsDuDepartement = iefs.filter(
    (ief) => choix.departementId === TOUS || ief.departementId === choix.departementId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Département">
          {(props) => (
            <Select
              items={[
                { value: TOUS, label: 'Tous les départements' },
                ...departements.map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={choix.departementId}
              onValueChange={(value) => {
                if (value === null) return;
                onChange({ ...choix, departementId: value, iefId: TOUS });
              }}
            >
              <SelectTrigger id={props.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Tous les départements</SelectItem>
                {departements.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="IEF">
          {(props) => (
            <Select
              items={[
                { value: TOUS, label: 'Toutes les IEF' },
                ...iefsDuDepartement.map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={choix.iefId}
              onValueChange={(value) => {
                if (value === null) return;
                onChange({ ...choix, iefId: value });
              }}
            >
              <SelectTrigger id={props.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Toutes les IEF</SelectItem>
                {iefsDuDepartement.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      {choix.cle !== 'representants' ? null : (
        <label className="flex cursor-pointer items-start gap-3 text-[0.875rem]">
          <input
            type="checkbox"
            checked={choix.nonQualifies}
            className="mt-0.5 size-4 shrink-0 accent-primary"
            onChange={(event) => {
              onChange({ ...choix, nonQualifies: event.target.checked });
            }}
          />
          Exclure les représentants déjà qualifiés (ambassadeur ou refus)
        </label>
      )}
    </div>
  );
}

function EtatTeleconseillers({
  chargement,
  isError,
  erreur,
  vide,
}: {
  chargement: boolean;
  isError: boolean;
  erreur: unknown;
  vide: boolean;
}) {
  if (chargement) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <output className="block rounded-md bg-muted px-3 py-4 text-[0.8125rem]">
        {apiErrorText(erreur, 'Les téléconseillers n’ont pas pu être lus.')}
      </output>
    );
  }
  if (vide) {
    return (
      <output className="block rounded-md bg-muted px-3 py-4 text-[0.8125rem]">
        Aucun compte téléconseiller actif. Créez-en un depuis l’écran Téléconseillers.
      </output>
    );
  }
  return null;
}

function ChampTeleconseillers({
  comptes,
  chargement,
  isError,
  erreur,
  decoches,
  onChange,
  objectifs,
  onObjectif,
  defaut,
}: {
  comptes: readonly Teleconseiller[] | undefined;
  chargement: boolean;
  isError: boolean;
  erreur: unknown;
  decoches: readonly string[];
  onChange: (decoches: readonly string[]) => void;
  objectifs: Readonly<Record<string, string>>;
  onObjectif: (id: string, saisie: string) => void;
  defaut: number;
}) {
  const aide = useId();
  const liste = comptes ?? [];
  const toutCoche = liste.some((compte) => !decoches.includes(compte.id));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-[600]">Téléconseillers</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={aide} className="text-[0.75rem] text-muted-foreground">
          L’ordre de la liste est l’ordre de distribution. L’objectif est le nombre de fiches à
          traiter par jour.
        </p>
        {liste.length > 0 ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              onChange(toutCoche ? liste.map((compte) => compte.id) : []);
            }}
          >
            {toutCoche ? 'Tout décocher' : 'Tout cocher'}
          </Button>
        ) : null}
      </div>

      <EtatTeleconseillers
        chargement={chargement}
        isError={isError}
        erreur={erreur}
        vide={liste.length === 0}
      />

      {liste.length === 0 ? null : (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1 scrollbar-thin">
          {liste.map((compte) => {
            const coche = !decoches.includes(compte.id);
            return (
              <li key={compte.id}>
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-[0.875rem]',
                    'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                    coche ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={coche}
                    aria-describedby={aide}
                    className="size-4 shrink-0 accent-primary"
                    onChange={() => {
                      onChange(
                        coche
                          ? [...decoches, compte.id]
                          : decoches.filter((id) => id !== compte.id),
                      );
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{compte.fullName}</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    disabled={!coche}
                    aria-label={`Objectif quotidien de ${compte.fullName}`}
                    placeholder={String(capaciteDeDefaut(compte.role, defaut))}
                    value={objectifs[compte.id] ?? ''}
                    className="h-9 w-20 rounded-sm border border-border bg-background px-2 text-right tabular-nums"
                    onClick={(event) => {
                      event.preventDefault();
                    }}
                    onChange={(event) => {
                      onObjectif(compte.id, event.target.value);
                    }}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

/**
 * Ce que le serveur retiendra à défaut d'objectif saisi. Même règle que
 * `capaciteParJour` côté API : supervision et direction appellent en plus de
 * leur travail, pas à la place.
 */
function capaciteDeDefaut(role: Teleconseiller['role'], fichesParJour: number): number {
  return role === 'COMMERCIAL' ? fichesParJour : Math.max(1, Math.ceil(fichesParJour / 5));
}

function ApercuLot({
  apercu,
  stable,
  equipe,
  jours,
}: {
  apercu: UseQueryResult<LotExportPreview>;
  stable: boolean;
  equipe: number;
  jours: number;
}) {
  return (
    <output className="block rounded-md border border-border bg-secondary/50 px-4 py-3 text-[0.9375rem]">
      {(() => {
        if (equipe === 0) return 'Cochez au moins un téléconseiller.';
        if (apercu.isError)
          return (
            <span className="text-destructive">
              {apiErrorText(apercu.error, 'Le nombre de fiches n’a pas pu être compté.')}
            </span>
          );
        if (!apercu.isSuccess || !stable) return 'Comptage des fiches…';
        return texteApercu(apercu.data, jours);
      })()}
    </output>
  );
}

function ChoixCible({
  cibles,
  groupe,
  choix,
  onChange,
}: {
  cibles: readonly (typeof CIBLES)[number][];
  groupe: string;
  choix: Choix;
  onChange: (choix: Choix) => void;
}) {
  return (
    <>
      {/* Une seule cible possible (Grand Public) : rien à choisir, on saute l'étape. */}
    {cibles.length < 2 ? null : (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-[600]">Que voulez-vous exporter&nbsp;?</legend>
        {cibles.map((cible) => (
          <label
            key={cible.cle}
            className={cn(
              'grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 rounded-md border p-3',
              'transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              choix.cle === cible.cle
                ? 'border-primary bg-secondary'
                : 'border-border hover:bg-secondary/60',
            )}
          >
            <input
              type="radio"
              name={groupe}
              value={cible.cle}
              checked={choix.cle === cible.cle}
              onChange={() => {
                onChange(choixInitial(cible.cle));
              }}
              className="row-span-2 mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="font-[600]">{cible.titre}</span>
            <span className="col-start-2 text-[0.75rem] text-muted-foreground">{cible.aide}</span>
          </label>
        ))}
      </fieldset>
    )}
    </>
  );
}

function orEmpty<T>(data: readonly T[] | undefined): readonly T[] {
  return data ?? [];
}

function buildDistribution(
  equipe: readonly Teleconseiller[],
  fichesParJour: number,
  jours: number,
  objectifs: { teleconseillerId: string; fichesParJour: number }[],
) {
  return {
    teleconseillerIds: equipe.map((compte) => compte.id),
    fichesParJour,
    jours,
    ...(objectifs.length > 0 ? { objectifs } : {}),
  };
}

function eligibleDe(apercu: UseQueryResult<LotExportPreview>): number | null {
  return apercu.isSuccess ? apercu.data.eligible : null;
}

function nomRetenu(nomSaisi: string | null, nomPropose: string): string {
  return nomSaisi === null ? nomPropose.trim() : nomSaisi.trim();
}

function peutCreer(
  equipeChoisie: boolean,
  eligible: number | null,
  nom: string,
  pending: boolean,
): boolean {
  if (!equipeChoisie || eligible === null || eligible <= 0) return false;
  if (nom.length < 3) return false;
  return !pending;
}

function ErreurCreation({ isError, error }: { isError: boolean; error: unknown }) {
  if (!isError) return null;
  return (
    <p role="alert" className="text-[0.875rem] text-destructive">
      {apiErrorText(error, 'La campagne n’a pas pu être créée.')}
    </p>
  );
}

function FormulaireDeLot({
  projet,
  onCree,
  onAnnule,
}: {
  projet: Projet;
  onCree: () => void;
  onAnnule: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const groupe = useId();
  // Figée à l'ouverture : recalculée à chaque rendu, la date du nom proposé
  // sauterait d'une seconde à l'autre sous les doigts de celui qui le corrige.
  const [maintenant] = useState(() => new Date().toISOString());
  const cibles = CIBLES.filter((cible) => cible.projet === projet);
  const [choix, setChoix] = useState<Choix>(() => choixInitial(cibles[0]?.cle ?? 'chues'));
  // On retient les comptes DÉCOCHÉS : la liste arrive après le premier rendu, et
  // tout garder coché par défaut se lit alors sans effet de synchronisation.
  const [decoches, setDecoches] = useState<readonly string[]>([]);
  const [fichesParJourSaisi, setFichesParJourSaisi] = useState(String(FICHES_PAR_JOUR_DEFAUT));
  const [joursSaisi, setJoursSaisi] = useState(String(JOURS_DEFAUT));
  const [objectifsSaisis, setObjectifsSaisis] = useState<Readonly<Record<string, string>>>({});
  // EB-14 : nul tant que personne n'a touché au champ. Le nom proposé suit
  // alors les critères ; dès la première frappe, il ne bouge plus tout seul.
  const [nomSaisi, setNomSaisi] = useState<string | null>(null);

  const teleconseillers = useQuery({
    queryKey: queryKeys.lotsExportTeleconseillers,
    queryFn: () => fetchTeleconseillers(),
    staleTime: 5 * 60_000,
  });

  const equipe = orEmpty(teleconseillers.data).filter(
    (compte) => !decoches.includes(compte.id),
  );
  const fichesParJour = entierBorne(fichesParJourSaisi, FICHES_PAR_JOUR_DEFAUT, 1, 500);
  const jours = entierBorne(joursSaisi, JOURS_DEFAUT, 1, 10);
  const objectifs = objectifsRetenus(equipe, objectifsSaisis);
  const distribution = buildDistribution(equipe, fichesParJour, jours, objectifs);

  const referentielsUtiles = surRepresentants(choix.cle);
  const departements = useQuery({
    queryKey: queryKeys.departements,
    queryFn: () => fetchDepartements(),
    enabled: referentielsUtiles,
    staleTime: 30 * 60_000,
  });
  const iefs = useQuery({
    queryKey: queryKeys.iefs,
    queryFn: () => fetchIefs(),
    enabled: referentielsUtiles,
    staleTime: 30 * 60_000,
  });

  const { corps, etiquette } = critereDuChoix(
    choix,
    nomDe(departements.data, choix.departementId),
    nomDe(iefs.data, choix.iefId),
  );

  // La temporisation porte sur une CLÉ, pas sur l'objet des critères : celui-ci
  // est reconstruit à chaque rendu, et son identité relancerait le report sans fin.
  const cleCritere = [
    choix.cle,
    choix.segment,
    choix.type,
    choix.departementId,
    choix.iefId,
    String(choix.nonQualifies),
    distribution.teleconseillerIds.join(','),
    fichesParJour,
    jours,
    objectifs
      .map((objectif) => `${objectif.teleconseillerId}:${String(objectif.fichesParJour)}`)
      .join(','),
  ].join('|');
  const cleDifferee = useDebouncedValue(cleCritere, 250);
  const critereStable = cleDifferee === cleCritere;
  const equipeChoisie = equipe.length > 0;

  const apercu = useQuery({
    queryKey: queryKeys.lotsExportApercu({ cle: cleCritere }),
    queryFn: () => previewLotExport({ ...corps, name: etiquette, distribution }),
    enabled: critereStable && equipeChoisie,
  });

  const eligible = eligibleDe(apercu);

  const nomPropose = `${etiquette}, ${formatDateTime(maintenant)}`.slice(0, 120);
  const nom = nomRetenu(nomSaisi, nomPropose);

  const creation = useMutation({
    mutationFn: () => createLotExport({ ...corps, distribution, name: nom }),
    onSuccess: (lot) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      toast.success(`Campagne créée : ${formatNumber(lot.itemCount)} fiches réparties.`);
      onCree();
      router.push(`${campagnesPath(projet)}/${lot.id}`);
    },
  });

  const pretACreer = peutCreer(equipeChoisie, eligible, nom, creation.isPending);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle campagne</DialogTitle>
        <DialogDescription>
          Choisissez les fiches et les personnes qui les traiteront. Chacun reçoit son programme à
          imprimer.
        </DialogDescription>
      </DialogHeader>

      <ChoixCible cibles={cibles} groupe={groupe} choix={choix} onChange={setChoix} />

      <ChampsCritere
        choix={choix}
        onChange={setChoix}
        departements={orEmpty(departements.data)}
        iefs={orEmpty(iefs.data)}
      />

      <ChampTeleconseillers
        comptes={teleconseillers.data}
        chargement={teleconseillers.isPending}
        isError={teleconseillers.isError}
        erreur={teleconseillers.error}
        decoches={decoches}
        onChange={setDecoches}
        objectifs={objectifsSaisis}
        defaut={fichesParJour}
        onObjectif={(id, saisie) => {
          setObjectifsSaisis((courants) => ({ ...courants, [id]: saisie }));
        }}
      />

      <Field
        label="Nom de la campagne"
        description="Proposé d’après les critères. Modifiable ici et plus tard."
      >
        {(props) => (
          <Input
            {...props}
            maxLength={120}
            value={nomSaisi ?? nomPropose}
            onChange={(event) => {
              setNomSaisi(event.target.value);
            }}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Fiches par jour, à défaut d’objectif"
          description="La valeur retenue pour qui n’a pas d’objectif propre."
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              step={1}
              value={fichesParJourSaisi}
              onChange={(event) => {
                setFichesParJourSaisi(event.target.value);
              }}
            />
          )}
        </Field>
        <Field label="Nombre de jours">
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              step={1}
              value={joursSaisi}
              onChange={(event) => {
                setJoursSaisi(event.target.value);
              }}
            />
          )}
        </Field>
      </div>

      <ApercuLot apercu={apercu} stable={critereStable} equipe={equipe.length} jours={jours} />

      <ErreurCreation isError={creation.isError} error={creation.error} />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onAnnule}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={!pretACreer}
          onClick={() => {
            creation.mutate();
          }}
        >
          {creation.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Créer la campagne
        </Button>
      </DialogFooter>
    </>
  );
}
