'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ContactRoundIcon,
  FileSpreadsheetIcon,
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
import {
  ChampImport,
  cleImport,
  type ImportChoisi,
} from '@/components/lots-export/lot-import-select';
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
  type LotExportPreview,
  type Teleconseiller,
} from '@/lib/data/lots-export';
import { fetchDepartements, fetchIefs } from '@/lib/data/reference';
import { formatDateTime, formatNumber } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Departement, Ief, Projet, ProspectType } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

interface Tuile<T extends string> {
  cle: T;
  titre: string;
  aide: string;
  icon: LucideIcon;
}

type Famille = 'prospects' | 'representants' | 'import';
type CleRepresentants = 'representants' | 'representants-injoignables' | 'contacts-recommandes';

const FAMILLES: readonly Tuile<Famille>[] = [
  {
    cle: 'prospects',
    titre: 'Prospects',
    aide: 'CHUES ou Grand Public, tous ou seulement les injoignables.',
    icon: UsersRoundIcon,
  },
  {
    cle: 'representants',
    titre: 'Représentants',
    aide: 'Ceux qui remettent les listes, les injoignables ou leurs contacts.',
    icon: UserRoundCheckIcon,
  },
  {
    cle: 'import',
    titre: 'Fiches importées',
    aide: 'Un classeur importé, puis CHUES, Grand Public ou les deux.',
    icon: FileSpreadsheetIcon,
  },
];

const PROJETS: readonly Tuile<Projet | typeof TOUS>[] = [
  {
    cle: 'TOUS',
    titre: 'CHUES et Grand Public',
    aide: 'Les deux projets ensemble.',
    icon: UsersRoundIcon,
  },
  {
    cle: 'CHUES',
    titre: 'Prospects CHUES',
    aide: 'Les quatre segments confondus.',
    icon: UsersRoundIcon,
  },
  {
    cle: 'GRAND_PUBLIC',
    titre: 'Prospects Grand Public',
    aide: 'Tous les types ou un seul.',
    icon: ContactRoundIcon,
  },
];

const REPRESENTANTS: readonly Tuile<CleRepresentants>[] = [
  {
    cle: 'representants',
    titre: 'Tous les représentants',
    aide: 'Les personnes qui remettent les listes.',
    icon: UserRoundCheckIcon,
  },
  {
    cle: 'representants-injoignables',
    titre: 'Injoignables',
    aide: 'Dernier appel sans échange, hors injoignables définitifs.',
    icon: PhoneMissedIcon,
  },
  {
    cle: 'contacts-recommandes',
    titre: 'Contacts recommandés',
    aide: 'Les numéros donnés par un représentant qui décline.',
    icon: UserRoundPlusIcon,
  },
];

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
  famille: Famille;
  projet: Projet | typeof TOUS;
  type: ProspectType | typeof TOUS;
  injoignables: boolean;
  representants: CleRepresentants;
  departementId: string;
  iefId: string;
  nonQualifies: boolean;
  importe: ImportChoisi | null;
}

const choixInitial = (famille: Famille, projet: Projet | typeof TOUS): Choix => ({
  famille,
  projet,
  type: TOUS,
  injoignables: false,
  representants: 'representants',
  departementId: TOUS,
  iefId: TOUS,
  nonQualifies: true,
  importe: null,
});

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

const pluriel = (n: number, mot: string) => `${formatNumber(n)} ${mot}${n > 1 ? 's' : ''}`;

function texteApercu(
  apercu: LotExportPreview,
  fichesParJour: number,
  jours: number,
  equipeCount: number,
): string {
  const { eligible, places, parTeleconseiller } = apercu;
  if (eligible === 0) return 'Aucune fiche ne correspond aux critères.';
  const duree = pluriel(jours, 'jour');
  if (eligible < places) {
    const parJour = Math.max(1, Math.ceil(parTeleconseiller / jours));
    return `Seulement ${pluriel(eligible, 'fiche')} pour ${pluriel(equipeCount, 'personne')} : chacun aura ${parJour} par jour sur ${duree}, pas ${fichesParJour}. Décochez des personnes ou baissez le chiffre.`;
  }
  const rythme = `chacun aura ${fichesParJour} fiches par jour sur ${duree}`;
  if (eligible === places) return `${pluriel(eligible, 'fiche')} : ${rythme}.`;
  return `${pluriel(eligible, 'fiche')} disponibles pour ${formatNumber(places)} places : ${rythme}, ${formatNumber(eligible - places)} attendront la prochaine campagne.`;
}

type Critere = { corps: Omit<CreateLotExportInput, 'name' | 'distribution'>; etiquette: string };

function critereRepresentants(
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  const cle = choix.representants;
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

const TETE_PROSPECTS: Record<Projet | typeof TOUS, string> = {
  TOUS: 'CHUES et Grand Public',
  CHUES: 'Prospects CHUES',
  GRAND_PUBLIC: 'Prospects Grand Public',
};

// Un onglet du classeur peut mêler CHUES et Grand Public : le projet choisi
// détermine les fiches retenues, ou les deux si « CHUES et Grand Public » est choisi.
function critereImport(choix: Choix): Critere {
  const importe = choix.importe;
  const projet = choix.projet === TOUS ? null : choix.projet;
  return {
    corps: {
      cible: 'PROSPECTS',
      prospects: {
        ...PROSPECTS_VIVANTS,
        ...(projet === null ? {} : { projet }),
        ...(importe === null
          ? {}
          : {
              importJobId: importe.id,
              ...(importe.feuille == null ? {} : { importFeuille: importe.feuille }),
            }),
      },
    },
    etiquette: [importe === null ? 'Fiches importées' : importe.libelle]
      .concat(projet === null ? [] : [TETE_PROSPECTS[projet]])
      .join(', '),
  };
}

function critereProspects(choix: Choix): Critere {
  const type = choix.projet === 'GRAND_PUBLIC' && choix.type !== TOUS ? choix.type : null;
  return {
    corps: {
      cible: 'PROSPECTS',
      prospects: {
        ...PROSPECTS_VIVANTS,
        ...(choix.projet === TOUS ? {} : { projet: choix.projet }),
        ...(type === null ? {} : { type }),
        ...(choix.injoignables ? { injoignables: true } : {}),
      },
    },
    etiquette: [
      TETE_PROSPECTS[choix.projet],
      choix.injoignables ? 'injoignables' : null,
      type === null ? null : PROSPECT_TYPE_LABELS[type],
    ]
      .filter((part) => part !== null)
      .join(choix.injoignables ? ' ' : ', '),
  };
}

function critereDuChoix(
  choix: Choix,
  nomDepartement: string | null,
  nomIef: string | null,
): Critere {
  if (choix.famille === 'representants') return critereRepresentants(choix, nomDepartement, nomIef);
  if (choix.famille === 'import') return critereImport(choix);
  return critereProspects(choix);
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
  projet: Projet | null;
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

function Tuiles<T extends string>({
  legende,
  groupe,
  tuiles,
  valeur,
  onChange,
}: {
  legende: string;
  groupe: string;
  tuiles: readonly Tuile<T>[];
  valeur: T;
  onChange: (cle: T) => void;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-3 text-[0.9375rem] font-[600]">{legende}</legend>
      {tuiles.map((tuile) => {
        const Icon = tuile.icon;
        const choisie = valeur === tuile.cle;
        return (
          <label
            key={tuile.cle}
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
              value={tuile.cle}
              checked={choisie}
              onChange={() => onChange(tuile.cle)}
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
              <span className="text-[0.875rem] font-[600] text-foreground">{tuile.titre}</span>
              <span className="text-[0.75rem] text-muted-foreground">{tuile.aide}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function Case({
  coche,
  onChange,
  children,
}: {
  coche: boolean;
  onChange: (coche: boolean) => void;
  children: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[0.875rem] text-foreground">
      <input
        type="checkbox"
        checked={coche}
        className="size-4 shrink-0 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

function Step1Cibles({
  familles,
  groupe,
  choix,
  onChange,
  departements,
  iefs,
}: {
  familles: readonly Tuile<Famille>[];
  groupe: string;
  choix: Choix;
  onChange: (choix: Choix) => void;
  departements: readonly Departement[];
  iefs: readonly Ief[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Tuiles
        legende="Quelles fiches ?"
        groupe={`${groupe}-famille`}
        tuiles={familles}
        valeur={choix.famille}
        onChange={(famille) => onChange(choixInitial(famille, choix.projet))}
      />
      {choix.famille === 'prospects' ? (
        <ChampsProspects groupe={groupe} choix={choix} onChange={onChange} />
      ) : null}
      {choix.famille === 'representants' ? (
        <ChampsRepresentants
          groupe={groupe}
          choix={choix}
          onChange={onChange}
          departements={departements}
          iefs={iefs}
        />
      ) : null}
      {choix.famille === 'import' ? (
        <Tuiles
          legende="Quel projet ?"
          groupe={`${groupe}-projet`}
          tuiles={PROJETS}
          valeur={choix.projet}
          onChange={(projet) => onChange({ ...choix, projet })}
        />
      ) : null}
      {choix.famille === 'import' ? (
        <ChampImport
          valeur={choix.importe === null ? '' : cleImport(choix.importe)}
          onChange={(importe) => onChange({ ...choix, importe })}
        />
      ) : null}
    </div>
  );
}

function ChampsProspects({
  groupe,
  choix,
  onChange,
}: {
  groupe: string;
  choix: Choix;
  onChange: (choix: Choix) => void;
}) {
  return (
    <>
      <Tuiles
        legende="Quel projet ?"
        groupe={`${groupe}-projet`}
        tuiles={PROJETS}
        valeur={choix.projet}
        onChange={(projet) => onChange({ ...choix, projet, type: TOUS })}
      />
      {choix.projet === 'GRAND_PUBLIC' ? (
        <Field label="Type de prospect">
          {(props) => (
            <Liste
              id={props.id}
              describedBy={props['aria-describedby']}
              items={[
                { value: TOUS, label: 'Tous les types' },
                ...PROSPECT_TYPES.map((type) => ({
                  value: type,
                  label: PROSPECT_TYPE_LABELS[type],
                })),
              ]}
              value={choix.type}
              placeholder="Type"
              onChange={(value) =>
                onChange({ ...choix, type: value as ProspectType | typeof TOUS })
              }
            />
          )}
        </Field>
      ) : null}
      <Case
        coche={choix.injoignables}
        onChange={(injoignables) => onChange({ ...choix, injoignables })}
      >
        Seulement les injoignables : dernier appel sans échange, hors injoignables définitifs
      </Case>
    </>
  );
}

function ChampsRepresentants({
  groupe,
  choix,
  onChange,
  departements,
  iefs,
}: {
  groupe: string;
  choix: Choix;
  onChange: (choix: Choix) => void;
  departements: readonly Departement[];
  iefs: readonly Ief[];
}) {
  const iefsDuDepartement = iefs.filter(
    (ief) => choix.departementId === TOUS || ief.departementId === choix.departementId,
  );

  return (
    <>
      <Tuiles
        legende="Lesquels ?"
        groupe={`${groupe}-representants`}
        tuiles={REPRESENTANTS}
        valeur={choix.representants}
        onChange={(representants) => onChange({ ...choix, representants })}
      />
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
      {choix.representants === 'representants' ? (
        <Case
          coche={choix.nonQualifies}
          onChange={(nonQualifies) => onChange({ ...choix, nonQualifies })}
        >
          Exclure les représentants déjà qualifiés (ambassadeur ou refus)
        </Case>
      ) : null}
    </>
  );
}

function ListeTeleconseillers({
  chargement,
  isError,
  erreur,
  liste,
  decoches,
  onChangeDecoches,
}: {
  chargement: boolean;
  isError: boolean;
  erreur: unknown;
  liste: readonly Teleconseiller[];
  decoches: readonly string[];
  onChangeDecoches: (decoches: readonly string[]) => void;
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
          <li key={compte.id} className={cn('px-3 py-1.5', !coche && 'opacity-60')}>
            <label className="flex min-h-9 min-w-0 cursor-pointer items-center gap-3">
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
  fichesParJourSaisi,
  setFichesParJourSaisi,
  joursSaisi,
  setJoursSaisi,
  apercu,
}: {
  teleconseillers: readonly Teleconseiller[] | undefined;
  chargement: boolean;
  isError: boolean;
  erreur: unknown;
  decoches: readonly string[];
  onChangeDecoches: (decoches: readonly string[]) => void;
  fichesParJourSaisi: string;
  setFichesParJourSaisi: (v: string) => void;
  joursSaisi: string;
  setJoursSaisi: (v: string) => void;
  apercu: React.ReactNode;
}) {
  const liste = teleconseillers ?? [];
  const equipe = liste.filter((c) => !decoches.includes(c.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fiches par téléconseiller et par jour">
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
            Qui appelle ?
            <span className="ml-2 text-[0.8125rem] font-[500] text-muted-foreground tabular-nums">
              {equipe.length} sur {liste.length}
            </span>
          </p>
          {liste.length > 0 ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => onChangeDecoches(equipe.length > 0 ? liste.map((c) => c.id) : [])}
            >
              {equipe.length > 0 ? 'Tout décocher' : 'Tout cocher'}
            </Button>
          ) : null}
        </div>
        <ListeTeleconseillers
          chargement={chargement}
          isError={isError}
          erreur={erreur}
          liste={liste}
          decoches={decoches}
          onChangeDecoches={onChangeDecoches}
        />
      </div>

      {apercu}
    </div>
  );
}

function Apercu({
  equipeCount,
  apercu,
  critereStable,
  fichesParJour,
  jours,
}: {
  equipeCount: number;
  apercu: UseQueryResult<LotExportPreview>;
  critereStable: boolean;
  fichesParJour: number;
  jours: number;
}) {
  if (equipeCount === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Cochez au moins une personne pour voir ce que chacun recevra.
      </p>
    );
  }
  if (apercu.isError) {
    return (
      <p role="alert" className="text-[0.875rem] text-destructive">
        {apiErrorText(apercu.error, 'Le comptage a échoué.')}
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
  const insuffisant = apercu.data.eligible > 0 && apercu.data.eligible < apercu.data.places;
  return (
    <p className={cn('text-[0.875rem]', insuffisant ? 'text-warning' : 'text-foreground')}>
      {texteApercu(apercu.data, fichesParJour, jours, equipeCount)}
    </p>
  );
}

function Step3Resume({
  etiquette,
  equipeCount,
  fichesParJour,
  jours,
  apercu,
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
  apercu: React.ReactNode;
  nomSaisi: string | null;
  nomPropose: string;
  setNomSaisi: (val: string) => void;
  error: unknown;
  isError: boolean;
}) {
  const lignes = [
    ['Fiches', etiquette],
    ['Équipe', pluriel(equipeCount, 'personne')],
    ['Rythme', `${fichesParJour} fiches par personne et par jour sur ${pluriel(jours, 'jour')}`],
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
        <div className="px-3 py-2.5">{apercu}</div>
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

function useLotFormState(projet: Projet | null) {
  const familles = FAMILLES.filter((f) => projet !== 'GRAND_PUBLIC' || f.cle !== 'representants');
  const [step, setStep] = useState<Etape>(1);
  const [choix, setChoix] = useState<Choix>(() => choixInitial('prospects', projet ?? TOUS));
  const [decoches, setDecoches] = useState<readonly string[] | null>(null);
  const [fichesParJourSaisi, setFichesParJourSaisi] = useState(String(FICHES_PAR_JOUR_DEFAUT));
  const [joursSaisi, setJoursSaisi] = useState(String(JOURS_DEFAUT));
  const [nomSaisi, setNomSaisi] = useState<string | null>(null);

  return {
    familles,
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
    nomSaisi,
    setNomSaisi,
  };
}

function useLotFormQueries(choix: Choix) {
  const referentielsUtiles = choix.famille === 'representants';
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
  const sourceChoisie = choix.famille !== 'import' || choix.importe !== null;

  return { departements, iefs, corps, etiquette, sourceChoisie };
}

// Tant que personne n'a touché la liste, seuls les téléconseillers appellent.
function equipeCochee(
  liste: readonly Teleconseiller[] | undefined,
  saisies: readonly string[] | null,
): { decoches: readonly string[]; equipe: Teleconseiller[] } {
  const comptes = liste ?? [];
  const decoches =
    saisies ?? comptes.filter((compte) => compte.role !== 'COMMERCIAL').map((c) => c.id);
  return { decoches, equipe: comptes.filter((compte) => !decoches.includes(compte.id)) };
}

function useLotFormMutationAndQueries(
  projet: Projet | null,
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

  const { decoches, equipe } = equipeCochee(teleconseillers.data, state.decoches);
  const fichesParJour = entierBorne(state.fichesParJourSaisi, FICHES_PAR_JOUR_DEFAUT, 1, 500);
  const jours = entierBorne(state.joursSaisi, JOURS_DEFAUT, 1, 10);
  const distribution = { teleconseillerIds: equipe.map((c) => c.id), fichesParJour, jours };

  const queryInfo = useLotFormQueries(state.choix);
  const equipeChoisie = equipe.length > 0;

  const cleCritere = JSON.stringify([queryInfo.corps, distribution]);
  const cleDifferee = useDebouncedValue(cleCritere, 250);
  const critereStable = cleDifferee === cleCritere;

  const apercu = useQuery({
    queryKey: queryKeys.lotsExportApercu({ cle: cleCritere }),
    queryFn: () =>
      previewLotExport({ ...queryInfo.corps, name: queryInfo.etiquette, distribution }),
    enabled: critereStable && equipeChoisie && queryInfo.sourceChoisie,
  });

  const eligible = apercu.isSuccess ? apercu.data.eligible : null;
  const nomPropose = `${queryInfo.etiquette}, ${formatDateTime(maintenant)}`.slice(0, 120);
  const nom = state.nomSaisi === null ? nomPropose.trim() : state.nomSaisi.trim();

  const creation = useMutation({
    mutationFn: () => createLotExport({ ...queryInfo.corps, distribution, name: nom }),
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
    decoches,
    equipe,
    fichesParJour,
    jours,
    departements: queryInfo.departements,
    iefs: queryInfo.iefs,
    etiquette: queryInfo.etiquette,
    sourceChoisie: queryInfo.sourceChoisie,
    equipeChoisie,
    critereStable,
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
  projet: Projet | null;
  onCree: () => void;
  onAnnule: () => void;
}) {
  const groupe = useId();
  const state = useLotFormState(projet);
  const data = useLotFormMutationAndQueries(projet, state, onCree);
  const suivantBloque = state.step === 1 ? !data.sourceChoisie : !data.equipeChoisie;
  const apercu = (
    <Apercu
      equipeCount={data.equipe.length}
      apercu={data.apercu}
      critereStable={data.critereStable}
      fichesParJour={data.fichesParJour}
      jours={data.jours}
    />
  );

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
            familles={state.familles}
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
            decoches={data.decoches}
            onChangeDecoches={state.setDecoches}
            fichesParJourSaisi={state.fichesParJourSaisi}
            setFichesParJourSaisi={state.setFichesParJourSaisi}
            joursSaisi={state.joursSaisi}
            setJoursSaisi={state.setJoursSaisi}
            apercu={apercu}
          />
        ) : null}
        {state.step === 3 ? (
          <Step3Resume
            etiquette={data.etiquette}
            equipeCount={data.equipe.length}
            fichesParJour={data.fichesParJour}
            jours={data.jours}
            apercu={apercu}
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
