'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ContactRoundIcon,
  FileSpreadsheetIcon,
  Layers2Icon,
  LoaderIcon,
  PhoneMissedIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Liste } from '@/components/forms/liste';
import { ChampImport, cleImport } from '@/components/lots-export/lot-import-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PROSPECT_TYPES, PROSPECT_TYPE_LABELS } from '@/lib/data/grand-public';
import {
  campagnesPath,
  createLotExport,
  fetchTeleconseillers,
  previewLotExport,
  type CreateLotExportInput,
  type LotExportImport,
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

const CIBLES = [
  {
    cle: 'chues',
    projet: 'CHUES',
    titre: 'Tous les prospects CHUES',
    aide: 'Les quatre segments confondus.',
    icon: UsersRoundIcon,
  },
  {
    cle: 'chues-segment',
    projet: 'CHUES',
    titre: 'Un segment CHUES',
    aide: 'Un seul segment, de BDD1 à BDD4.',
    icon: Layers2Icon,
  },
  {
    cle: 'import-chues',
    projet: 'CHUES',
    titre: 'Fiches importées',
    aide: 'Un classeur importé, choisi par sa date.',
    icon: FileSpreadsheetIcon,
  },
  {
    cle: 'grand-public',
    projet: 'GRAND_PUBLIC',
    titre: 'Prospects Grand Public',
    aide: 'Tous les types ou un seul.',
    icon: ContactRoundIcon,
  },
  {
    cle: 'import-grand-public',
    projet: 'GRAND_PUBLIC',
    titre: 'Fiches importées',
    aide: 'Un classeur importé, choisi par sa date.',
    icon: FileSpreadsheetIcon,
  },
  {
    cle: 'representants',
    projet: 'CHUES',
    titre: 'Représentants',
    aide: 'Les personnes qui remettent les listes.',
    icon: UserRoundCheckIcon,
  },
  {
    cle: 'representants-injoignables',
    projet: 'CHUES',
    titre: 'Représentants injoignables',
    aide: 'Dernier appel sans échange, hors injoignables définitifs.',
    icon: PhoneMissedIcon,
  },
  {
    cle: 'contacts-recommandes',
    projet: 'CHUES',
    titre: 'Contacts recommandés',
    aide: 'Les numéros donnés par un représentant qui décline.',
    icon: UserRoundPlusIcon,
  },
] as const satisfies readonly {
  cle: string;
  projet: Projet;
  titre: string;
  aide: string;
  icon: LucideIcon;
}[];

type CleCible = (typeof CIBLES)[number]['cle'];
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
type CleImport = 'import-chues' | 'import-grand-public';
const surImport = (cle: CleCible): cle is CleImport => cle.startsWith('import-');
const projetDe = (cle: CleCible): Projet => CIBLES.find((c) => c.cle === cle)?.projet ?? 'CHUES';

const TOUS = 'TOUS';
const PROSPECTS_VIVANTS = { includeDeleted: false } as const;
const FICHES_PAR_JOUR_DEFAUT = 50;
const JOURS_DEFAUT = 1;

type Etape = 1 | 2 | 3;
const ETAPES: readonly { id: Etape; titre: string }[] = [
  { id: 1, titre: 'Fiches' },
  { id: 2, titre: 'Équipe' },
  { id: 3, titre: 'Lancement' },
];

interface Choix {
  cle: CleCible;
  segment: BddSegment;
  type: ProspectType | typeof TOUS;
  departementId: string;
  iefId: string;
  nonQualifies: boolean;
  importe: LotExportImport | null;
}

const choixInitial = (cle: CleCible): Choix => ({
  cle,
  segment: 'BDD1',
  type: TOUS,
  departementId: TOUS,
  iefId: TOUS,
  nonQualifies: true,
  importe: null,
});

function objectifsRetenus(
  equipe: readonly Teleconseiller[],
  saisies: Readonly<Record<string, string>>,
): { teleconseillerId: string; fichesParJour: number }[] {
  return equipe.flatMap((compte) => {
    const saisi = Number.parseInt(saisies[compte.id] ?? '', 10);
    if (Number.isFinite(saisi) && saisi >= 1) {
      return [{ teleconseillerId: compte.id, fichesParJour: Math.min(500, saisi) }];
    }
    return [];
  });
}

function nomDe(
  lignes: readonly { id: string; name: string }[] | undefined,
  id: string,
): string | null {
  const ligne = (lignes ?? []).find((row) => row.id === id);
  return ligne === undefined ? null : ligne.name;
}

function entierBorne(saisie: string, defaut: number, min: number, max: number): number {
  const valeur = Number.parseInt(saisie, 10);
  if (!Number.isFinite(valeur)) return defaut;
  return Math.min(max, Math.max(min, valeur));
}

function texteApercu(apercu: LotExportPreview, jours: number): string {
  const { eligible, places, retenues } = apercu;
  if (eligible === 0) return 'Aucune fiche ne correspond aux critères.';

  const pluriel = eligible > 1 ? 's' : '';
  const disponibles = `${formatNumber(eligible)} fiche${pluriel} disponible${pluriel}`;
  const reparties = `${formatNumber(retenues)} seront réparties selon les capacités choisies`;
  const joursTxt = `${formatNumber(jours)} jour${jours > 1 ? 's' : ''}`;

  if (eligible <= places) {
    return `${disponibles}. ${formatNumber(places)} places sur ${joursTxt} : les ${reparties}.`;
  }
  const restant = formatNumber(eligible - retenues);
  return `${disponibles} pour ${formatNumber(places)} places : ${reparties} ; ${restant} attendront la prochaine campagne.`;
}

type Critere = { corps: Omit<CreateLotExportInput, 'name' | 'distribution'>; etiquette: string };

function critereRepresentants(
  cle: CleRepresentants,
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  const lieu = [
    nomDepartement === null ? null : `département ${nomDepartement}`,
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

function critereImport(projet: Projet, importe: LotExportImport | null): Critere {
  return {
    corps: {
      cible: 'PROSPECTS',
      prospects: {
        ...PROSPECTS_VIVANTS,
        projet,
        ...(importe === null
          ? {}
          : {
              importJobId: importe.id,
              ...(importe.feuille == null ? {} : { importFeuille: importe.feuille }),
            }),
      },
    },
    etiquette: importe === null ? 'Fiches importées' : importe.libelle,
  };
}

function critereDuChoix(
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  if (surRepresentants(choix.cle))
    return critereRepresentants(choix.cle, choix, nomDepartement, nomIef);
  if (surImport(choix.cle)) return critereImport(projetDe(choix.cle), choix.importe);

  if (choix.cle === 'grand-public') {
    const typeLabel = choix.type === TOUS ? '' : `, ${PROSPECT_TYPE_LABELS[choix.type]}`;
    return {
      corps: {
        cible: 'PROSPECTS',
        prospects: {
          ...PROSPECTS_VIVANTS,
          projet: 'GRAND_PUBLIC',
          ...(choix.type === TOUS ? {} : { type: choix.type }),
        },
      },
      etiquette: `Prospects Grand Public${typeLabel}`,
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

function capaciteDeDefaut(role: Teleconseiller['role'], fichesParJour: number): number {
  return role === 'COMMERCIAL' ? fichesParJour : Math.max(1, Math.ceil(fichesParJour / 5));
}

function roleLabel(role: Teleconseiller['role']): string {
  if (role === 'COMMERCIAL') return 'Téléconseiller';
  if (role === 'SUPERVISEUR') return 'Superviseur';
  if (role === 'DIRECTION') return 'Direction';
  return 'Agent';
}

function PastilleEtape({ id, courante, faite }: { id: Etape; courante: boolean; faite: boolean }) {
  let couleur = 'border border-border';
  if (courante) couleur = 'bg-primary text-primary-foreground';
  if (faite) couleur = 'bg-primary/15 text-primary';
  return (
    <span
      className={cn(
        'flex size-6 items-center justify-center rounded-full text-[0.75rem] font-[600] tabular-nums',
        couleur,
      )}
    >
      {faite ? <CheckIcon className="size-3.5" aria-hidden="true" /> : id}
    </span>
  );
}

function Etapes({
  etape,
  setEtape,
  accessibles,
}: {
  etape: Etape;
  setEtape: (etape: Etape) => void;
  accessibles: Readonly<Record<Etape, boolean>>;
}) {
  return (
    <ol className="flex items-center gap-2 text-[0.8125rem]">
      {ETAPES.map((e, index) => {
        const courante = e.id === etape;
        const faite = e.id < etape;
        return (
          <li key={e.id} className={cn('flex items-center gap-2', index > 0 && 'flex-1')}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn('h-px flex-1', e.id <= etape ? 'bg-primary' : 'bg-border')}
              />
            ) : null}
            <button
              type="button"
              disabled={!accessibles[e.id]}
              aria-current={courante ? 'step' : undefined}
              onClick={() => setEtape(e.id)}
              className={cn(
                'flex h-8 items-center gap-2 rounded-full pr-2.5 pl-1 transition-colors',
                'disabled:cursor-default enabled:hover:bg-secondary',
                courante ? 'font-[600] text-foreground' : 'text-muted-foreground',
              )}
            >
              <PastilleEtape id={e.id} courante={courante} faite={faite} />
              {e.titre}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

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
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <FormulaireDeLot
          projet={projet}
          onCree={() => onOpenChange(false)}
          onAnnule={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Step1Cibles({
  cibles,
  groupe,
  choix,
  onChange,
  departements,
  iefs,
}: {
  cibles: readonly (typeof CIBLES)[number][];
  groupe: string;
  choix: Choix;
  onChange: (choix: Choix) => void;
  departements: readonly Departement[];
  iefs: readonly Ief[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-3 text-[0.9375rem] font-[600]">Quelles fiches ?</legend>
        {cibles.map((cible) => {
          const Icon = cible.icon;
          const choisie = choix.cle === cible.cle;
          return (
            <label
              key={cible.cle}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                choisie
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground/40 hover:bg-secondary',
              )}
            >
              <input
                type="radio"
                name={groupe}
                value={cible.cle}
                checked={choisie}
                onChange={() => onChange(choixInitial(cible.cle))}
                className="sr-only"
              />
              <span
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm',
                  choisie
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[0.875rem] font-[600] text-foreground">{cible.titre}</span>
                <span className="text-[0.75rem] text-muted-foreground">{cible.aide}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <ChampsCritere choix={choix} onChange={onChange} departements={departements} iefs={iefs} />
    </div>
  );
}

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
  if (choix.cle === 'chues-segment') {
    return (
      <Field label="Segment">
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={BDD_SEGMENTS.map((segment) => ({
              value: segment,
              label: SEGMENT_LABELS[segment],
            }))}
            value={choix.segment}
            placeholder="Segment"
            onChange={(value) => onChange({ ...choix, segment: value as BddSegment })}
          />
        )}
      </Field>
    );
  }

  if (choix.cle === 'grand-public') {
    return (
      <Field label="Type de prospect">
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={[
              { value: TOUS, label: 'Tous les types' },
              ...PROSPECT_TYPES.map((type) => ({ value: type, label: PROSPECT_TYPE_LABELS[type] })),
            ]}
            value={choix.type}
            placeholder="Type"
            onChange={(value) => onChange({ ...choix, type: value as ProspectType | typeof TOUS })}
          />
        )}
      </Field>
    );
  }

  if (surImport(choix.cle)) {
    return (
      <ChampImport
        projet={projetDe(choix.cle)}
        valeur={choix.importe === null ? '' : cleImport(choix.importe)}
        onChange={(importe) => onChange({ ...choix, importe })}
      />
    );
  }

  if (!surRepresentants(choix.cle)) return null;

  const iefsDuDepartement = iefs.filter(
    (ief) => choix.departementId === TOUS || ief.departementId === choix.departementId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Département">
          {(props) => (
            <Liste
              id={props.id}
              describedBy={props['aria-describedby']}
              items={[
                { value: TOUS, label: 'Tous les départements' },
                ...departements.map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={choix.departementId}
              placeholder="Département"
              onChange={(value) => onChange({ ...choix, departementId: value, iefId: TOUS })}
            />
          )}
        </Field>
        <Field label="IEF">
          {(props) => (
            <Liste
              id={props.id}
              describedBy={props['aria-describedby']}
              items={[
                { value: TOUS, label: 'Toutes les IEF' },
                ...iefsDuDepartement.map((row) => ({ value: row.id, label: row.name })),
              ]}
              value={choix.iefId}
              placeholder="IEF"
              onChange={(value) => onChange({ ...choix, iefId: value })}
            />
          )}
        </Field>
      </div>

      {choix.cle === 'representants' ? (
        <label className="flex cursor-pointer items-center gap-3 text-[0.875rem] text-foreground">
          <input
            type="checkbox"
            checked={choix.nonQualifies}
            className="size-4 shrink-0 accent-primary"
            onChange={(event) => onChange({ ...choix, nonQualifies: event.target.checked })}
          />
          Exclure les représentants déjà qualifiés (ambassadeur ou refus)
        </label>
      ) : null}
    </div>
  );
}

function ListeTeleconseillers({
  chargement,
  isError,
  erreur,
  liste,
  decoches,
  onChangeDecoches,
  objectifs,
  onObjectif,
  defaut,
}: {
  chargement: boolean;
  isError: boolean;
  erreur: unknown;
  liste: readonly Teleconseiller[];
  decoches: readonly string[];
  onChangeDecoches: (decoches: readonly string[]) => void;
  objectifs: Readonly<Record<string, string>>;
  onObjectif: (id: string, saisie: string) => void;
  defaut: number;
}) {
  if (chargement) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-sm" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <output className="block rounded-md bg-destructive-surface p-4 text-[0.875rem] text-destructive">
        {apiErrorText(erreur, 'Les téléconseillers n’ont pas pu être chargés.')}
      </output>
    );
  }
  if (liste.length === 0) {
    return (
      <output className="block rounded-md bg-muted p-4 text-[0.875rem] text-muted-foreground">
        Aucun téléconseiller actif. Créez-en un dans Utilisateurs.
      </output>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {liste.map((compte) => {
        const coche = !decoches.includes(compte.id);
        return (
          <li
            key={compte.id}
            className={cn('flex items-center gap-3 px-3 py-1.5', !coche && 'opacity-60')}
          >
            <label className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={coche}
                aria-label={compte.fullName}
                className="size-4 shrink-0 accent-primary"
                onChange={() =>
                  onChangeDecoches(
                    coche ? [...decoches, compte.id] : decoches.filter((id) => id !== compte.id),
                  )
                }
              />
              <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <span className="truncate text-[0.875rem] font-[500] text-foreground">
                  {compte.fullName}
                </span>
                <span className="text-[0.75rem] text-muted-foreground">
                  {roleLabel(compte.role)}
                </span>
              </span>
            </label>
            <Input
              type="number"
              min={1}
              max={500}
              disabled={!coche}
              aria-label={`Objectif quotidien de ${compte.fullName}`}
              placeholder={String(capaciteDeDefaut(compte.role, defaut))}
              value={objectifs[compte.id] ?? ''}
              className="h-9 w-20 text-right text-[0.875rem] tabular-nums"
              onChange={(e) => onObjectif(compte.id, e.target.value)}
            />
          </li>
        );
      })}
    </ul>
  );
}

function Step2Equipe({
  teleconseillers,
  chargement,
  isError,
  erreur,
  decoches,
  onChangeDecoches,
  objectifs,
  onObjectif,
  fichesParJourSaisi,
  setFichesParJourSaisi,
  joursSaisi,
  setJoursSaisi,
  defaut,
}: {
  teleconseillers: readonly Teleconseiller[] | undefined;
  chargement: boolean;
  isError: boolean;
  erreur: unknown;
  decoches: readonly string[];
  onChangeDecoches: (decoches: readonly string[]) => void;
  objectifs: Readonly<Record<string, string>>;
  onObjectif: (id: string, saisie: string) => void;
  fichesParJourSaisi: string;
  setFichesParJourSaisi: (v: string) => void;
  joursSaisi: string;
  setJoursSaisi: (v: string) => void;
  defaut: number;
}) {
  const liste = teleconseillers ?? [];
  const equipe = liste.filter((c) => !decoches.includes(c.id));
  const toutCoche = liste.length > 0 && equipe.length === liste.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fiches par jour" description="Pour qui n’a pas d’objectif propre.">
          {(props) => (
            <Input
              {...props}
              type="number"
              min={1}
              max={500}
              value={fichesParJourSaisi}
              onChange={(e) => setFichesParJourSaisi(e.target.value)}
            />
          )}
        </Field>
        <Field label="Jours de traitement">
          {(props) => (
            <Input
              {...props}
              type="number"
              min={1}
              max={10}
              value={joursSaisi}
              onChange={(e) => setJoursSaisi(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.9375rem] font-[600]">
            Téléconseillers
            <span className="ml-2 text-[0.8125rem] font-[500] text-muted-foreground tabular-nums">
              {equipe.length} sur {liste.length}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-[0.75rem] text-muted-foreground sm:inline">
              Objectif par jour
            </span>
            {liste.length > 0 ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => onChangeDecoches(toutCoche ? liste.map((c) => c.id) : [])}
              >
                {toutCoche ? 'Tout décocher' : 'Tout cocher'}
              </Button>
            ) : null}
          </div>
        </div>
        <ListeTeleconseillers
          chargement={chargement}
          isError={isError}
          erreur={erreur}
          liste={liste}
          decoches={decoches}
          onChangeDecoches={onChangeDecoches}
          objectifs={objectifs}
          onObjectif={onObjectif}
          defaut={defaut}
        />
      </div>
    </div>
  );
}

function Apercu({
  equipeCount,
  apercu,
  critereStable,
  jours,
}: {
  equipeCount: number;
  apercu: UseQueryResult<LotExportPreview>;
  critereStable: boolean;
  jours: number;
}) {
  if (equipeCount === 0) {
    return (
      <p className="text-[0.875rem] text-destructive">
        Cochez au moins un téléconseiller à l’étape 2.
      </p>
    );
  }
  if (apercu.isError) {
    return (
      <p className="text-[0.875rem] text-destructive">
        {apiErrorText(apercu.error, 'Le comptage des fiches a échoué.')}
      </p>
    );
  }
  if (!apercu.isSuccess || !critereStable || apercu.isFetching) {
    return (
      <p className="flex items-center gap-2 text-[0.875rem] text-muted-foreground">
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Comptage des fiches…
      </p>
    );
  }
  return <p className="text-[0.875rem] text-foreground">{texteApercu(apercu.data, jours)}</p>;
}

function Step3Resume({
  etiquette,
  equipeCount,
  fichesParJour,
  jours,
  apercu,
  critereStable,
  nomSaisi,
  nomPropose,
  setNomSaisi,
  error,
  isError,
}: {
  etiquette: string;
  equipeCount: number;
  fichesParJour: number;
  jours: number;
  apercu: UseQueryResult<LotExportPreview>;
  critereStable: boolean;
  nomSaisi: string | null;
  nomPropose: string;
  setNomSaisi: (val: string) => void;
  error: unknown;
  isError: boolean;
}) {
  const lignes = [
    ['Fiches', etiquette],
    ['Équipe', `${equipeCount} téléconseiller${equipeCount > 1 ? 's' : ''}`],
    ['Rythme', `${fichesParJour} fiches par jour sur ${jours} jour${jours > 1 ? 's' : ''}`],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Field label="Nom de la campagne" description="Modifiable plus tard.">
        {(props) => (
          <Input
            {...props}
            maxLength={120}
            value={nomSaisi ?? nomPropose}
            onChange={(e) => setNomSaisi(e.target.value)}
          />
        )}
      </Field>

      <dl className="divide-y divide-border rounded-md border border-border text-[0.875rem]">
        {lignes.map(([titre, valeur]) => (
          <div key={titre} className="flex gap-4 px-3 py-2.5">
            <dt className="w-20 shrink-0 text-muted-foreground">{titre}</dt>
            <dd className="min-w-0 flex-1 font-[500] text-foreground">{valeur}</dd>
          </div>
        ))}
        <div className="px-3 py-2.5">
          <Apercu
            equipeCount={equipeCount}
            apercu={apercu}
            critereStable={critereStable}
            jours={jours}
          />
        </div>
      </dl>

      {isError ? (
        <p
          role="alert"
          className="rounded-md bg-destructive-surface p-3 text-[0.875rem] text-destructive"
        >
          {apiErrorText(error, 'La campagne n’a pas pu être créée.')}
        </p>
      ) : null}
    </div>
  );
}

function useLotFormState(projet: Projet) {
  const cibles = CIBLES.filter((c) => c.projet === projet);
  const [step, setStep] = useState<Etape>(1);
  const [choix, setChoix] = useState<Choix>(() => choixInitial(cibles[0]?.cle ?? 'chues'));
  const [decoches, setDecoches] = useState<readonly string[]>([]);
  const [fichesParJourSaisi, setFichesParJourSaisi] = useState(String(FICHES_PAR_JOUR_DEFAUT));
  const [joursSaisi, setJoursSaisi] = useState(String(JOURS_DEFAUT));
  const [objectifsSaisis, setObjectifsSaisis] = useState<Readonly<Record<string, string>>>({});
  const [nomSaisi, setNomSaisi] = useState<string | null>(null);

  return {
    cibles,
    step,
    setStep,
    choix,
    setChoix,
    decoches,
    setDecoches,
    fichesParJourSaisi,
    setFichesParJourSaisi,
    joursSaisi,
    setJoursSaisi,
    objectifsSaisis,
    setObjectifsSaisis,
    nomSaisi,
    setNomSaisi,
  };
}

function computeDistribution(
  equipe: readonly Teleconseiller[],
  fichesParJourSaisi: string,
  joursSaisi: string,
  objectifsSaisis: Readonly<Record<string, string>>,
) {
  const fichesParJour = entierBorne(fichesParJourSaisi, FICHES_PAR_JOUR_DEFAUT, 1, 500);
  const jours = entierBorne(joursSaisi, JOURS_DEFAUT, 1, 10);
  const objectifs = objectifsRetenus(equipe, objectifsSaisis);
  return {
    fichesParJour,
    jours,
    objectifs,
    distribution: {
      teleconseillerIds: equipe.map((c) => c.id),
      fichesParJour,
      jours,
      ...(objectifs.length > 0 ? { objectifs } : {}),
    },
  };
}

function computeCleCritere(
  cle: CleCible,
  segment: BddSegment,
  type: ProspectType | typeof TOUS,
  departementId: string,
  iefId: string,
  nonQualifies: boolean,
  importId: string | undefined,
  teleconseillerIds: readonly string[],
  fichesParJour: number,
  jours: number,
  objectifs: readonly { teleconseillerId: string; fichesParJour: number }[],
): string {
  const objStr = objectifs.map((o) => `${o.teleconseillerId}:${String(o.fichesParJour)}`).join(',');
  return [
    cle,
    segment,
    type,
    departementId,
    iefId,
    String(nonQualifies),
    importId ?? '',
    teleconseillerIds.join(','),
    fichesParJour,
    jours,
    objStr,
  ].join('|');
}

function useLotFormQueries(
  state: ReturnType<typeof useLotFormState>,
  distribution: ReturnType<typeof computeDistribution>,
) {
  const referentielsUtiles = surRepresentants(state.choix.cle);
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
    state.choix,
    nomDe(departements.data, state.choix.departementId),
    nomDe(iefs.data, state.choix.iefId),
  );

  const cleCritere = computeCleCritere(
    state.choix.cle,
    state.choix.segment,
    state.choix.type,
    state.choix.departementId,
    state.choix.iefId,
    state.choix.nonQualifies,
    state.choix.importe?.id,
    distribution.distribution.teleconseillerIds,
    distribution.fichesParJour,
    distribution.jours,
    distribution.objectifs,
  );

  const cleDifferee = useDebouncedValue(cleCritere, 250);
  const critereStable = cleDifferee === cleCritere;
  const sourceChoisie = !surImport(state.choix.cle) || state.choix.importe !== null;

  return { departements, iefs, corps, etiquette, cleCritere, critereStable, sourceChoisie };
}

function useLotFormMutationAndQueries(
  projet: Projet,
  state: ReturnType<typeof useLotFormState>,
  onCree: () => void,
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [maintenant] = useState(() => new Date().toISOString());

  const teleconseillers = useQuery({
    queryKey: queryKeys.lotsExportTeleconseillers,
    queryFn: () => fetchTeleconseillers(),
    staleTime: 5 * 60_000,
  });

  const listeTeleconseillers = teleconseillers.data ?? [];
  const equipe = listeTeleconseillers.filter((compte) => !state.decoches.includes(compte.id));
  const distInfo = computeDistribution(
    equipe,
    state.fichesParJourSaisi,
    state.joursSaisi,
    state.objectifsSaisis,
  );

  const queryInfo = useLotFormQueries(state, distInfo);
  const equipeChoisie = equipe.length > 0;

  const apercu = useQuery({
    queryKey: queryKeys.lotsExportApercu({ cle: queryInfo.cleCritere }),
    queryFn: () =>
      previewLotExport({
        ...queryInfo.corps,
        name: queryInfo.etiquette,
        distribution: distInfo.distribution,
      }),
    enabled: queryInfo.critereStable && equipeChoisie && queryInfo.sourceChoisie,
  });

  const eligible = apercu.isSuccess ? apercu.data.eligible : null;
  const nomPropose = `${queryInfo.etiquette}, ${formatDateTime(maintenant)}`.slice(0, 120);
  const nom = state.nomSaisi === null ? nomPropose.trim() : state.nomSaisi.trim();

  const creation = useMutation({
    mutationFn: () =>
      createLotExport({ ...queryInfo.corps, distribution: distInfo.distribution, name: nom }),
    onSuccess: (lot) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      toast.success(`Campagne créée : ${formatNumber(lot.itemCount)} fiches réparties.`);
      onCree();
      router.push(`${campagnesPath(projet)}/${lot.id}`);
    },
  });

  const pretACreer =
    equipeChoisie && eligible !== null && eligible > 0 && nom.length >= 3 && !creation.isPending;

  return {
    teleconseillers,
    equipe,
    fichesParJour: distInfo.fichesParJour,
    jours: distInfo.jours,
    departements: queryInfo.departements,
    iefs: queryInfo.iefs,
    etiquette: queryInfo.etiquette,
    sourceChoisie: queryInfo.sourceChoisie,
    equipeChoisie,
    critereStable: queryInfo.critereStable,
    apercu,
    nomPropose,
    creation,
    pretACreer,
  };
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
  const groupe = useId();
  const state = useLotFormState(projet);
  const data = useLotFormMutationAndQueries(projet, state, onCree);
  const suivantBloque = state.step === 1 ? !data.sourceChoisie : !data.equipeChoisie;

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border px-6 pt-6 pb-4">
        <DialogTitle>Nouvelle campagne d’appels</DialogTitle>
        <Etapes
          etape={state.step}
          setEtape={state.setStep}
          accessibles={{
            1: true,
            2: data.sourceChoisie,
            3: data.sourceChoisie && data.equipeChoisie,
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {state.step === 1 ? (
          <Step1Cibles
            cibles={state.cibles}
            groupe={groupe}
            choix={state.choix}
            onChange={state.setChoix}
            departements={data.departements.data ?? []}
            iefs={data.iefs.data ?? []}
          />
        ) : null}
        {state.step === 2 ? (
          <Step2Equipe
            teleconseillers={data.teleconseillers.data}
            chargement={data.teleconseillers.isPending}
            isError={data.teleconseillers.isError}
            erreur={data.teleconseillers.error}
            decoches={state.decoches}
            onChangeDecoches={state.setDecoches}
            objectifs={state.objectifsSaisis}
            onObjectif={(id, s) => state.setObjectifsSaisis((prev) => ({ ...prev, [id]: s }))}
            fichesParJourSaisi={state.fichesParJourSaisi}
            setFichesParJourSaisi={state.setFichesParJourSaisi}
            joursSaisi={state.joursSaisi}
            setJoursSaisi={state.setJoursSaisi}
            defaut={data.fichesParJour}
          />
        ) : null}
        {state.step === 3 ? (
          <Step3Resume
            etiquette={data.etiquette}
            equipeCount={data.equipe.length}
            fichesParJour={data.fichesParJour}
            jours={data.jours}
            apercu={data.apercu}
            critereStable={data.critereStable}
            nomSaisi={state.nomSaisi}
            nomPropose={data.nomPropose}
            setNomSaisi={state.setNomSaisi}
            error={data.creation.error}
            isError={data.creation.isError}
          />
        ) : null}
      </div>

      <PiedDeFormulaire
        step={state.step}
        setStep={state.setStep}
        suivantBloque={suivantBloque}
        pretACreer={data.pretACreer}
        enCours={data.creation.isPending}
        onAnnule={onAnnule}
        onCreer={() => data.creation.mutate()}
      />
    </>
  );
}

function PiedDeFormulaire({
  step,
  setStep,
  suivantBloque,
  pretACreer,
  enCours,
  onAnnule,
  onCreer,
}: {
  step: Etape;
  setStep: (maj: (s: Etape) => Etape) => void;
  suivantBloque: boolean;
  pretACreer: boolean;
  enCours: boolean;
  onAnnule: () => void;
  onCreer: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
      {step === 1 ? (
        <Button type="button" variant="ghost" onClick={onAnnule}>
          Annuler
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as Etape)}>
          <ArrowLeftIcon aria-hidden="true" />
          Précédent
        </Button>
      )}
      {step < 3 ? (
        <Button
          type="button"
          disabled={suivantBloque}
          onClick={() => setStep((s) => (s + 1) as Etape)}
        >
          Continuer
          <ArrowRightIcon aria-hidden="true" />
        </Button>
      ) : (
        <Button type="button" disabled={!pretACreer} onClick={onCreer}>
          {enCours ? <LoaderIcon className="animate-spin" aria-hidden="true" /> : null}
          Créer la campagne
        </Button>
      )}
    </div>
  );
}
