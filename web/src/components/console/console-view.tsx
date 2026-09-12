'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ArrowLeftIcon, CopyIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Chrono, copyPhone, Kbd } from '@/components/console/console-ui';
import { ConversionFields, type SaisieTelephone } from '@/components/console/conversion-fields';
import { EnvoiLienFormulaire } from '@/components/console/envoi-lien-formulaire';
import { SelectStatut } from '@/components/console/select-statut';
import { useShortcuts, type ShortcutMap } from '@/components/console/use-shortcuts';
import { usePremiereErreur } from '@/components/forms/premiere-erreur';
import {
  ETAPES_DOSSIER,
  EtapesProgression,
  etapesValides,
  filtrerErreurs,
  PiedEtapes,
  premiereEtapeEnErreur,
  type EtapeDossier,
} from '@/components/grand-public/etapes';
import { FiltreOrigine } from '@/components/grand-public/filtre-origine';
import { LienTelephone } from '@/components/lien-telephone';
import { BoutonWhatsApp, type FicheContactable } from '@/components/prospects/bouton-whatsapp';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  ALREADY_COMPLETED,
  AttemptRefused,
  callbackKeys,
  callbackSlots,
  conversionErrorFor,
  conversionFrom,
  formatCallbackAt,
  lireBrouillon,
  newAttemptInput,
  pushCallAttempt,
  validateAttempt,
  validateConversion,
  type AttemptDraft,
  type CallbackSlot,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import {
  enregistrerBrouillon,
  fetchOuvertureCourante,
  ouvrirFiche,
  type OuvertureFiche,
} from '@/lib/data/ouvertures';
import {
  commentaireExigePar,
  issueDuMotif,
  estJoignable,
  fetchMotifsAppel,
  type MotifAppel,
} from '@/lib/data/call-outcome-reasons';
import {
  useChampsConversion,
  type ChampLibre,
  type ReglageChamp,
} from '@/lib/data/champs-conversion';
import type { OrigineFiche } from '@/lib/data/grand-public';
import { fetchProspect, fetchProspectsAQualifier } from '@/lib/data/prospects';
import { dakarLocalToIso, formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  PHASE2_STATUS_LABELS,
  type EnrollmentMethod,
  type ProspectRow,
} from '@/lib/types';
import { useBrouillonAuto } from '@/lib/use-brouillon-auto';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

type Projet = 'CHUES' | 'GRAND_PUBLIC';

/** Seule issue encore atteignable au clavier une fois le dossier ouvert (EB-10). */
const RAPPEL_KEY = '2';

const GROUPES = [
  { cle: 'joignable', touche: '1', label: 'Joignable' },
  { cle: 'injoignable', touche: '2', label: 'Injoignable' },
] as const;

type Groupe = (typeof GROUPES)[number]['cle'];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1', 'Joignable, puis son motif'],
  ['2', 'Injoignable, puis son motif'],
  ['1 … 9', 'Motif, une fois le groupe choisi'],
  ['1 … 6', 'Échéance proposée, après un motif de rappel'],
  ['0', 'Saisir une autre échéance'],

  ['Entrée', 'Valider'],
  ['Échap', 'Revenir en arrière, ou effacer la saisie en cours'],
  ['C', 'Copier le numéro'],
  ['N', 'Ajouter un prospect sur ce représentant'],
  ['R', 'Fiche du représentant'],
  ['?', 'Afficher cette carte'],
];

const CARTE_GRAND_PUBLIC: readonly (readonly [string, string])[] = [
  ['1', 'Joignable'],
  ['2', 'Injoignable, ou « À rappeler » une fois le dossier ouvert'],
  ['1 … 6', 'Échéance proposée, après un statut de rappel'],
  ['0', 'Saisir une autre échéance'],
  ['Entrée', 'Continuer, sinon enregistrer'],
  ['Échap', 'Revenir en arrière, ou effacer la saisie en cours'],
  ['C', 'Copier le numéro'],
  ['?', 'Afficher cette carte'],
];

const ETAPES_APPEL: readonly string[] = ['Réponse', ...ETAPES_DOSSIER];

const carteClavier = (projet: Projet, statutParSelect: boolean) =>
  statutParSelect
    ? CARTE_GRAND_PUBLIC
    : KEYBOARD_MAP.filter(([keys]) => projet === 'CHUES' || (keys !== 'N' && keys !== 'R'));

/**
 * Le repli quand le référentiel ne répond pas : les six motifs système, ceux que
 * le serveur applique lui-même en l'absence de `reasonCode`. Sans lui, une
 * lecture en échec laisserait l'écran d'appel sans aucune issue.
 */
export const MOTIFS_SYSTEME: readonly MotifAppel[] = [
  { code: 'METHOD_OBTAINED', label: 'Méthode obtenue', effect: 'CLOSE_METHOD' },
  { code: 'REFUSED', label: 'Refus', effect: 'CLOSE_REFUSED' },
  { code: 'CALLBACK', label: CALL_OUTCOME_LABELS.CALLBACK, effect: 'SCHEDULE_CALLBACK' },
  { code: 'WRONG_NUMBER', label: CALL_OUTCOME_LABELS.WRONG_NUMBER, effect: 'CLOSE_WRONG_NUMBER' },
  { code: 'UNREACHABLE', label: CALL_OUTCOME_LABELS.UNREACHABLE, effect: 'KEEP_OPEN' },
  { code: 'OTHER', label: 'Autre', effect: 'KEEP_OPEN', requiresComment: true },
].map((motif) => ({ requiresComment: false, ...motif }) as MotifAppel);

/**
 * Grand Public : « Injoignable » propose les statuts non aboutis de CHUES, figés
 * ici pour que l'ADMIN ne puisse pas vider l'écran. Le référentiel porte les
 * mêmes codes en entrées système : sans elles, le serveur refuserait l'appel.
 */
const MOTIFS_INJOIGNABLE: readonly MotifAppel[] = [
  { code: 'PAS_DE_REPONSE', label: 'Pas de réponse' },
  { code: 'NUMERO_OCCUPE', label: 'Occupé' },
  { code: 'MESSAGERIE', label: 'Messagerie' },
  { code: 'TELEPHONE_INDISPONIBLE', label: 'Téléphone indisponible' },
  { code: 'INJOIGNABLE_DEFINITIF', label: 'Injoignable définitif' },
  { code: 'AUTRE_NON_JOINT', label: 'Autre', requiresComment: true },
].map((motif) => ({ effect: 'KEEP_OPEN', requiresComment: false, ...motif }) as MotifAppel);

/** Après « Joignable », les statuts qui disent le contraire n'ont plus de sens. */
const CODES_INJOIGNABLE: ReadonlySet<string> = new Set([
  'UNREACHABLE',
  ...MOTIFS_INJOIGNABLE.map((motif) => motif.code),
]);

/** Les statuts propres à l'écran Grand Public : la console CHUES garde ses motifs. */
const CODES_GRAND_PUBLIC: ReadonlySet<string> = new Set([
  'INTERESSE',
  'HORS_CIBLE',
  ...MOTIFS_INJOIGNABLE.map((motif) => motif.code),
]);

/** « Méthode obtenue » n'y figure pas : c'est « Enregistrer l'adhésion » qui la pose. */
export const statutsJoignables = (catalogue: readonly MotifAppel[]): MotifAppel[] =>
  catalogue.filter((item) => !CODES_INJOIGNABLE.has(item.code) && item.effect !== 'CLOSE_METHOD');

const statutsDuGroupe = (groupe: Groupe | null, catalogue: readonly MotifAppel[]) =>
  groupe === 'injoignable' ? MOTIFS_INJOIGNABLE : statutsJoignables(catalogue);

/**
 * Le statut de l'adhésion : celui qu'on a choisi s'il en est un, sinon le
 * premier du référentiel. CHUES garde ainsi le motif précis de son bouton.
 */
const statutAdhesion = (
  motif: MotifAppel | null,
  catalogue: readonly MotifAppel[],
): MotifAppel | undefined =>
  motif?.effect === 'CLOSE_METHOD'
    ? motif
    : catalogue.find((item) => item.effect === 'CLOSE_METHOD');

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

const nouveauHref = (projet: Projet): string =>
  projet === 'GRAND_PUBLIC' ? '/grand-public/nouveau' : '/chues/prospects/nouveau';

/** Grand Public consigne l'appel sur son propre écran, le même que depuis la liste des fiches. */
const appelHref = (projet: Projet, id: string): string | null =>
  projet === 'GRAND_PUBLIC' ? `/grand-public/appel/${id}?retour=console` : null;

const CLASSE_CHOIX = cn(
  'flex min-h-11 w-full items-center gap-2 rounded-sm text-left text-[0.9375rem] font-[600]',
  'underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
);

/**
 * Étape 3 : convertir un prospect. L'écran ouvre sur la recherche, la fiche
 * choisie reçoit l'appel, puis on revient à la liste. `?fiche=<id>` (depuis
 * les rappels) ouvre directement la fiche visée.
 */
export function ConsoleView({
  projet = 'CHUES',
  viewerId,
  origineFiltrable = false,
}: {
  projet?: Projet;
  /** Le lecteur : « Ajoutés par moi » se borne à ses saisies. */
  viewerId?: string | undefined;
  /** Seul celui à qui une campagne confie des fiches a deux provenances à départager. */
  origineFiltrable?: boolean | undefined;
}) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [ouverte, setOuverte] = useState<Ouverte | null>(null);
  const [vise, setVise] = useState<ProspectRow | null>(null);
  const [demandee, setDemandee] = useState<string | null>(searchParams.get('fiche'));
  const [search, setSearch] = useState('');
  const origineInitiale: OrigineFiche = projet === 'GRAND_PUBLIC' ? 'CAMPAGNE' : 'TOUS';
  const [origine, setOrigine] = useState<OrigineFiche>(origineInitiale);
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  const parLien = useQuery({
    queryKey: queryKeys.prospect(demandee ?? ''),
    queryFn: () => fetchProspect(demandee ?? ''),
    enabled: demandee !== null,
    retry: false,
  });

  const venuDesRappels = fichePendante(demandee, parLien.data);
  const { aConfirmer, consultee } = deriverFiches(vise, ouverte, venuDesRappels);

  const annuaire = useQuery({
    queryKey: [...queryKeys.prospectsRoot, 'a-qualifier', projet, cherche, origine] as const,
    queryFn: () => fetchProspectsAQualifier({ projet, search: cherche, origine, viewerId }),
    enabled: pasDeFicheOuverte(consultee, aConfirmer),
    placeholderData: (previous) => previous,
  });

  const revenir = useCallback(() => {
    setOuverte(null);
    setVise(null);
    setDemandee(null);
  }, []);

  const reprendre = useCallback((prise: Ouverte) => {
    setVise(null);
    setDemandee(null);
    setOuverte(prise);
  }, []);

  // L'ouverture vit sur le serveur, l'écran non : sans cette reprise, un
  // rechargement perdrait le brouillon et le chronomètre de la fiche en cours.
  const repriseFaite = useRef(false);
  useEffect(() => {
    if (repriseFaite.current) return;
    repriseFaite.current = true;
    void reprendreOuverte(reprendre);
  }, [reprendre]);

  const ouvrir = useMutation({
    mutationFn: async (row: ProspectRow): Promise<Ouverte> => ({
      prospect: row,
      ouverture: await ouvrirFiche({ prospectId: row.id }),
    }),
    onSuccess: (prise) => {
      setConfirme(null);
      setVise(null);
      setDemandee(null);
      setOuverte(prise);
      queryClient.setQueryData(queryKeys.ouvertureCourante, prise.ouverture);
    },
    onError: (error) => {
      toastApiError(error, 'La fiche n’a pas pu être ouverte.');
    },
  });

  if (consultee !== null) {
    return (
      <Consignation
        key={consultee.prospect.id}
        prospect={consultee.prospect}
        ouverture={consultee.ouverture}
        projet={projet}
        onAbandon={revenir}
        onEnregistre={(nom) => {
          setConfirme(nom);
          revenir();
          // La tentative a fermé l'ouverture : la barre supérieure lit ce cache
          // pour refuser la déconnexion, et le laisser périmé l'y enfermerait.
          queryClient.setQueryData(queryKeys.ouvertureCourante, null);
          void queryClient.invalidateQueries({ queryKey: ['prospects'] });
          void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
        }}
      />
    );
  }

  if (chargementParLien(demandee, parLien.isPending)) return <ListeSkeleton />;

  return (
    <div className="flex w-full flex-col gap-5">
      <EnTeteAnnuaire
        lienEnEchec={demandee !== null && parLien.isError}
        confirme={confirme}
        cherche={cherche}
        search={search}
        projet={projet}
        origine={origineFiltrable ? origine : null}
        onSearch={setSearch}
        onOrigine={setOrigine}
      />

      <ListeAnnuaire
        annuaire={annuaire}
        cherche={cherche}
        projet={projet}
        onEffacer={() => {
          setSearch('');
        }}
        onChoisir={(row) => {
          setConfirme(null);
          setVise(row);
        }}
      />

      <ConfirmDialog
        open={aConfirmer !== null}
        onOpenChange={(next) => {
          if (next) return;
          setVise(null);
          setDemandee(null);
        }}
        title={`Ouvrir la fiche de ${aConfirmer === null ? '' : nomDe(aConfirmer)} ?`}
        description={null}
        confirmLabel="Ouvrir"
        confirmVariant="default"
        pending={ouvrir.isPending}
        onConfirm={() => {
          if (aConfirmer !== null) ouvrir.mutate(aConfirmer);
        }}
      />
    </div>
  );
}

/**
 * Ce qui précède la liste : l'avis d'un lien mort, la confirmation du dernier
 * appel, la recherche et la provenance.
 */
function EnTeteAnnuaire({
  lienEnEchec,
  confirme,
  cherche,
  search,
  projet,
  origine,
  onSearch,
  onOrigine,
}: {
  lienEnEchec: boolean;
  confirme: string | null;
  cherche: string;
  search: string;
  projet: Projet;
  /** Nul quand rien n'est confié au lecteur : il n'a qu'une provenance. */
  origine: OrigineFiche | null;
  onSearch: (value: string) => void;
  onOrigine: (value: OrigineFiche) => void;
}) {
  let texteAide: string;
  if (cherche !== '') texteAide = 'Choisissez qui vous venez d’appeler.';
  else if (projet === 'GRAND_PUBLIC')
    texteAide = 'Les fiches que vos campagnes vous ont confiées. Cherchez un nom ou un numéro.';
  else
    texteAide =
      'Vos fiches et celles que vos campagnes vous ont confiées. Cherchez un nom ou un numéro pour en voir d’autres.';

  return (
    <>
      {lienEnEchec ? (
        <p
          role="alert"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          La fiche ouverte depuis les rappels n’a pas pu être chargée. Cherchez-la ci-dessous.
        </p>
      ) : null}

      {confirme === null ? null : (
        <p role="status" className={cn('text-[0.875rem] font-[600] text-accent-text', REVELE)}>
          Appel enregistré pour {confirme}.
        </p>
      )}

      <ChampAnnuaire value={search} onChange={onSearch} />

      {origine === null ? null : <FiltreOrigine value={origine} onChange={onOrigine} />}

      <p className="text-[0.8125rem] text-muted-foreground">{texteAide}</p>
    </>
  );
}

/** La fiche et l'ouverture qui la mesure. Nulle quand la fiche est close. */

interface Ouverte {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
}

const nomDe = (prospect: ProspectRow): string => `${prospect.nom} ${prospect.prenom}`;

/** Ce que `lireBrouillon` sait relire, et rien d'autre. */
export const brouillonDe = (
  comment: string,
  conversion: ConversionDraft | null,
): Record<string, unknown> => ({
  comment,
  ...(conversion === null ? {} : { conversion }),
});

function fichePendante(
  demandee: string | null,
  data: ProspectRow | null | undefined,
): ProspectRow | null {
  return demandee === null ? null : (data ?? null);
}

interface FichesDerivees {
  aConfirmer: ProspectRow | null;
  consultee: Ouverte | null;
}

function deriverFiches(
  vise: ProspectRow | null,
  ouverte: Ouverte | null,
  venuDesRappels: ProspectRow | null,
): FichesDerivees {
  return { aConfirmer: vise ?? venuDesRappels, consultee: ouverte };
}

function pasDeFicheOuverte(consultee: Ouverte | null, aConfirmer: ProspectRow | null): boolean {
  return consultee === null && aConfirmer === null;
}

function chargementParLien(demandee: string | null, isPending: boolean): boolean {
  return demandee !== null && isPending;
}

function estFicheClose(prospect: ProspectRow, refusee: boolean): boolean {
  return prospect.phase2Status !== 'PENDING' || refusee;
}

function saisieCommencee(
  conversion: ConversionDraft | null,
  slots: readonly CallbackSlot[] | null,
  motif: MotifAppel | null,
  comment: string,
): boolean {
  return conversion !== null || slots !== null || motif !== null || comment !== '';
}

/**
 * La fiche que le serveur tient encore pour cette console, remise à l'écran
 * telle quelle : au montage, elle répare un rechargement.
 */
async function reprendreOuverte(reprendre: (prise: Ouverte) => void): Promise<void> {
  const courante = await fetchOuvertureCourante('prospect').catch(() => null);
  if (courante === null || courante.prospectId === null) return;
  const prospect = await fetchProspect(courante.prospectId).catch(() => null);
  if (prospect === null) return;
  reprendre({ prospect, ouverture: courante });
}

function ListeAnnuaire({
  annuaire,
  cherche,
  projet,
  onEffacer,
  onChoisir,
}: {
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchProspectsAQualifier>>>;
  cherche: string;
  projet: Projet;
  onEffacer: () => void;
  onChoisir: (row: ProspectRow) => void;
}) {
  if (annuaire.isError) {
    return (
      <QueryErrorState
        error={annuaire.error}
        fallback="L’annuaire n’a pas pu être lu."
        onRetry={() => {
          void annuaire.refetch();
        }}
      />
    );
  }

  if (annuaire.isPending) return <ListeSkeleton />;

  if (annuaire.data.items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem]">
          {cherche === ''
            ? 'Aucune fiche ne vous est attribuée. Ajoutez un prospect, ou demandez une campagne à votre superviseur.'
            : 'Aucun résultat. Vérifiez le nom ou le numéro.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {cherche === '' ? null : (
            <Button variant="outline" onClick={onEffacer}>
              Effacer la recherche
            </Button>
          )}
          <Link href={nouveauHref(projet)} className={buttonVariants()}>
            Ajouter un prospect
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom et prénom</TableHead>
          <TableHead>Numéro</TableHead>
          <TableHead>Dernier appel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {annuaire.data.items.map((row) => {
          const href = appelHref(projet, row.id);
          return (
            <TableRow key={row.id}>
              <TableCell>
                {href === null ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChoisir(row);
                    }}
                    className={CLASSE_CHOIX}
                  >
                    <NomProspect row={row} />
                  </button>
                ) : (
                  <Link href={href} className={CLASSE_CHOIX}>
                    <NomProspect row={row} />
                  </Link>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <LienTelephone phoneE164={row.phoneE164} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {row.lastAttemptAt === null ? 'Jamais appelé' : formatDateTime(row.lastAttemptAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function NomProspect({ row }: { row: ProspectRow }) {
  return (
    <>
      <span className="truncate">
        {row.nom} {row.prenom}
      </span>
      {row.phase2Status === 'PENDING' ? null : (
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.75rem] font-[400] text-muted-foreground">
          {PHASE2_STATUS_LABELS[row.phase2Status]}
        </span>
      )}
    </>
  );
}

function ChampAnnuaire({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-annuaire" className="text-[0.875rem] font-[600]">
        Quel prospect avez-vous appelé ?
      </label>
      <Input
        id="console-annuaire"
        ref={champ}
        type="search"
        autoComplete="off"
        placeholder="Chercher un prospect : nom ou numéro"
        className="h-12 text-[1rem]"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/** Le dossier d'adhésion, une fois la personne dite joignable. */
export function PanneauDossier({
  ouvert,
  prospect,
  conversion,
  errors,
  telephone,
  disabled,
  formulaire,
  etape,
  onChange,
}: {
  ouvert: boolean;
  prospect: FicheContactable;
  conversion: ConversionDraft | null;
  errors: ConversionErrors;
  telephone?: SaisieTelephone | undefined;
  disabled: boolean;
  formulaire: { champs: readonly ReglageChamp[]; libres: readonly ChampLibre[] };
  /** Présente : la saisie est découpée, l'étape affichée tient lieu de titre. */
  etape?: EtapeDossier | undefined;
  onChange: (patch: Partial<ConversionDraft>) => void;
}) {
  if (!ouvert || conversion === null) return null;

  return (
    <>
      {etape === undefined ? (
        <p className="text-[0.8125rem] font-[600] text-muted-foreground">
          Joignable · son dossier, et la manière dont il adhère
        </p>
      ) : null}

      {etape === undefined || etape === 'Identité' ? (
        <EnvoiLienFormulaire prospect={prospect} email={conversion.email} />
      ) : null}

      <ConversionFields
        draft={conversion}
        errors={errors}
        phoneE164={prospect.phoneE164}
        telephone={telephone}
        disabled={disabled}
        reglages={formulaire.champs}
        libres={formulaire.libres}
        etape={etape}
        onChange={onChange}
      />
    </>
  );
}

/** Les deux boutons, puis les motifs du groupe ouvert. */
function ChoixIssue({
  etape,
  groupe,
  proposes,
  motif,
  disabled,
  onGroupe,
  onMotif,
}: {
  etape: Etape;
  groupe: Groupe | null;
  proposes: readonly MotifAppel[];
  motif: MotifAppel | null;
  disabled: boolean;
  onGroupe: (groupe: Groupe) => void;
  onMotif: (motif: MotifAppel) => void;
}) {
  if (etape === 'issues') {
    return (
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <LegendeIssue>Avez-vous eu la personne au téléphone ?</LegendeIssue>
        <div className="flex flex-wrap gap-2">
          {GROUPES.map((item) => (
            <Button
              key={item.cle}
              variant="outline"
              onClick={() => {
                onGroupe(item.cle);
              }}
            >
              <Kbd>{item.touche}</Kbd>
              {item.label}
            </Button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (etape !== 'motifs') return null;

  return (
    <fieldset className={cn('flex flex-col gap-2', REVELE)} disabled={disabled}>
      <LegendeIssue>
        {groupe === 'joignable' ? 'Joignable · que dit la personne ?' : 'Injoignable · pourquoi ?'}
      </LegendeIssue>
      {proposes.length === 0 ? (
        <p role="alert" className="text-[0.875rem] text-warning">
          Aucun motif réglé pour ce cas. Demandez à l’administrateur d’en ajouter dans les listes de
          référence.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {proposes.map((item, rang) => (
            <Button
              key={item.code}
              variant={motif?.code === item.code ? 'default' : 'outline'}
              onClick={() => {
                onMotif(item);
              }}
            >
              {rang < 9 ? <Kbd>{String(rang + 1)}</Kbd> : null}
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function LegendeIssue({ children }: { children: ReactNode }) {
  return (
    <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </legend>
  );
}

function ListeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}

function rattachements(prospect: ProspectRow, projet: Projet): string {
  const parts = [prospect.banqueName, prospect.syndicatSigle, prospect.departementName];
  if (projet === 'CHUES') parts.push(`Représentant ${prospect.representantName ?? 'aucun'}`);
  return parts.filter((part) => part !== null && part !== '').join(' · ');
}

function resumeDernierAppel(prospect: ProspectRow): string {
  const commentaire = prospect.lastComment === null ? '' : ` · « ${prospect.lastComment} »`;
  if (prospect.lastAttemptAt === null) return `Jamais appelée.${commentaire}`;
  const issue =
    prospect.lastOutcome === null ? '' : ` · ${CALL_OUTCOME_LABELS[prospect.lastOutcome]}`;
  return `Dernier appel : ${formatDateTime(prospect.lastAttemptAt)}${issue}${commentaire}`;
}

/**
 * L'étape visible, et elle seule : c'est elle qui tranche à qui vont les
 * chiffres, Entrée et Échap quand le dossier et l'échéance coexistent.
 */
type Etape = 'issues' | 'motifs' | 'statut' | 'dossier' | 'echeance' | null;

function etapeCourante(
  closed: boolean,
  conversion: ConversionDraft | null,
  slots: readonly CallbackSlot[] | null,
  groupe: Groupe | null,
  surStatut: boolean,
): Etape {
  if (closed) return null;
  if (slots !== null) return 'echeance';
  if (conversion !== null) return 'dossier';
  if (surStatut) return 'statut';
  return groupe === null ? 'issues' : 'motifs';
}

/** Grand Public : chaque réponse à « joignable ? » ouvre son select de statut. */
const surSelect = (groupe: Groupe | null, statutParSelect: boolean): boolean =>
  statutParSelect && groupe !== null;

/** Grand Public : « Joignable » ouvre en plus le dossier sous le select. */
const surJoignable = (groupe: Groupe | null, statutParSelect: boolean): boolean =>
  statutParSelect && groupe === 'joignable';

/** Grand Public, sur « Réponse » : le dossier ouvert n'y prend pas « 2 », qui vaut sur ses étapes. */
function chiffresDeLEtape(
  etape: Etape,
  surReponse: boolean,
  jeux: { groupes: ShortcutMap; motifs: ShortcutMap; slots: ShortcutMap; rappel: ShortcutMap },
): ShortcutMap {
  if (etape === 'motifs') return jeux.motifs;
  if (etape === 'statut') return {};
  if (etape === 'echeance') return jeux.slots;
  if (etape !== 'dossier') return jeux.groupes;
  return surReponse ? {} : jeux.rappel;
}

/** Entrée passe à l'étape suivante tant que le dossier ouvert en a une. */
const entreeContinue = (statutParSelect: boolean, etape: Etape, rang: number): boolean =>
  statutParSelect && etape === 'dossier' && rang < ETAPES_APPEL.length - 1;

/** Les boutons de motif de la console CHUES, pour le groupe ouvert. */
function motifsDuGroupe(
  catalogue: readonly MotifAppel[],
  groupe: Groupe | null,
): readonly MotifAppel[] {
  return catalogue.filter(
    (item) =>
      !CODES_GRAND_PUBLIC.has(item.code) &&
      (estJoignable(item) ? 'joignable' : 'injoignable') === groupe,
  );
}

/**
 * La consignation d'un appel, en deux temps : d'abord si la personne était
 * joignable, puis, si oui, son dossier et la manière dont elle adhère.
 */
export function Consignation({
  prospect,
  ouverture,
  projet,
  statutParSelect = false,

  onAbandon,
  onEnregistre,
}: {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
  projet: Projet;
  /**
   * Vrai : « Joignable » ouvre le dossier et son select de statut,
   * « Injoignable » les motifs figés. Faux : les motifs du référentiel.
   */
  statutParSelect?: boolean;

  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const router = useRouter();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);

  const [repris] = useState(() => lireBrouillon(ouverture?.draft));
  const [comment, setComment] = useState(repris.comment);
  // Un brouillon repris vient d'un appel où la personne répondait : la question
  // « joignable ? » est déjà tranchée, la reposer effacerait ce qu'il porte.
  const [groupe, setGroupe] = useState<Groupe | null>(
    repris.conversion === null ? null : 'joignable',
  );
  const [motif, setMotif] = useState<MotifAppel | null>(null);
  const [conversion, setConversion] = useState<ConversionDraft | null>(repris.conversion);
  const [conversionErrors, setConversionErrors] = useState<ConversionErrors>({});
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [refusee, setRefusee] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Grand Public seul : le rang affiché dans ETAPES_APPEL.
  const [etapeAppel, setEtapeAppel] = useState(0);
  const racineRef = useRef<HTMLElement>(null);
  const signalerEchec = usePremiereErreur(racineRef);

  const formulaire = useChampsConversion(projet);
  const motifs = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    staleTime: 300_000,
  });
  const catalogue = motifs.data ?? MOTIFS_SYSTEME;

  const nomComplet = nomDe(prospect);
  const closed = estFicheClose(prospect, refusee);
  const [now] = useState(() => Date.now());

  const departChrono = useBrouillonAuto(ouverture, brouillonDe(comment, conversion));

  /** Grand Public : l'étape de la première erreur s'ouvre, sa saisie est invisible d'ailleurs. */
  const montrerErreurs = useCallback(
    (problemes: ConversionErrors): void => {
      const premiere = premiereEtapeEnErreur(problemes);
      if (!statutParSelect || premiere === null) return;
      setEtapeAppel(ETAPES_DOSSIER.indexOf(premiere) + 1);
      signalerEchec();
    },
    [statutParSelect, signalerEchec],
  );

  const send = useMutation({
    mutationFn: async (draft: AttemptDraft) => {
      // EB-10 : le brouillon part AVANT la tentative, qui referme l'ouverture et
      // ferait refuser toute écriture postérieure. Le dossier passe par lui et
      // non par la tentative : incomplet, le serveur la refuserait en 400.
      if (draft.outcome === 'CALLBACK' && ouverture !== null) {
        // La borne vient d'ici et non de l'horloge du serveur : la base exige
        // qu'elle suive `openedAt`, qui est l'heure de ce navigateur.
        await enregistrerBrouillon(
          ouverture.id,
          brouillonDe(draft.comment, conversion),
          departChrono ?? new Date().toISOString(),
        ).catch(() => {
          toast.error('Les réponses saisies n’ont pas pu être conservées. L’appel, lui, part.');
        });
      }
      return pushCallAttempt(newAttemptInput(prospect.id, draft));
    },
    onSuccess: () => {
      onEnregistre(nomComplet);
    },
    onError: (error) => {
      if (error instanceof AttemptRefused && error.code === ALREADY_COMPLETED) {
        setRefusee(true);
        toast.error(error.message);
        return;
      }
      if (error instanceof AttemptRefused) {
        const refused = conversionErrorFor(error.code);
        if (refused !== null) {
          const erreur = { [refused.field]: refused.message };
          setConversionErrors(erreur);
          montrerErreurs(erreur);
        }
        toast.error(error.message);
        return;
      }
      toastApiError(error, 'L’appel n’a pas été enregistré.');
    },
  });

  const record = useCallback(
    (
      choisi: MotifAppel,
      method: EnrollmentMethod | null,
      callbackAt: string | null = null,
      renseignements?: ConversionDraft,
    ) => {
      if (send.isPending) return;
      const draft: AttemptDraft = {
        outcome: issueDuMotif(choisi),
        reasonCode: choisi.code,
        method,
        comment,
        callbackAt,
        ...(renseignements === undefined ? {} : { conversion: renseignements }),
        ...(ouverture === null ? {} : { ouvertureId: ouverture.id }),
      };
      const problem = validateAttempt(draft, Date.now(), choisi.requiresComment);
      if (problem !== null) {
        toast.error(problem);
        return;
      }
      send.mutate(draft);
    },
    [send, comment, ouverture],
  );

  const ouvrirDossier = useCallback(() => {
    if (closed || send.isPending) return;

    setSlots(null);
    setConversionErrors({});
    setConversion(conversionFrom(prospect));
  }, [closed, send.isPending, prospect]);

  const submitConversion = useCallback(() => {
    if (conversion === null) return;
    const problems = validateConversion(
      conversion,
      Date.now(),
      formulaire.champs,
      formulaire.libres,
    );
    setConversionErrors(problems);
    const adhesion = statutAdhesion(motif, catalogue);
    if (Object.keys(problems).length > 0 || conversion.method === null) {
      montrerErreurs(problems);
      return;
    }
    if (adhesion === undefined) {
      toast.error('Le statut « Méthode obtenue » est désactivé dans les listes de référence.');
      return;
    }
    record(adhesion, conversion.method, null, conversion);
  }, [conversion, formulaire, motif, catalogue, record, montrerErreurs]);

  const startCallback = useCallback(() => {
    if (closed) return;

    setFreeCallback('');
    setSlots(callbackSlots(Date.now()));
  }, [closed]);

  const choisir = useCallback(
    (choisi: MotifAppel) => {
      if (closed || send.isPending) return;
      setMotif(choisi);
      if (choisi.effect === 'CLOSE_METHOD') ouvrirDossier();
      else if (choisi.effect === 'SCHEDULE_CALLBACK') startCallback();
      else if (choisi.requiresComment) commentRef.current?.focus();
      else record(choisi, null);
    },
    [closed, send.isPending, ouvrirDossier, startCallback, record],
  );

  /**
   * Le même choix, mais qui ne consigne rien : dans un select, la valeur se
   * survole avant de se poser, et l'appel partirait sur un statut effleuré.
   */
  const poserStatut = useCallback(
    (choisi: MotifAppel) => {
      if (closed || send.isPending) return;
      setMotif(choisi);
      if (choisi.effect === 'CLOSE_METHOD') {
        ouvrirDossier();
        return;
      }
      // Comme « À rappeler » : le dossier rempli attend le prochain appel.
      if (choisi.effect === 'SCHEDULE_CALLBACK') {
        startCallback();
        return;
      }
      setConversion(null);
      setConversionErrors({});
      setSlots(null);
      setEtapeAppel(0);
    },
    [closed, send.isPending, ouvrirDossier, startCallback],
  );

  // L'échéance passe devant le dossier : ouverte par-dessus lui, c'est elle que
  // le téléconseiller est en train de choisir.
  const validate = useCallback(() => {
    if (slots !== null) {
      const iso = dakarLocalToIso(freeCallback);
      if (iso === null) {
        toast.error('Choisissez une échéance, ou saisissez sa date et son heure.');
        return;
      }
      if (motif !== null) record(motif, null, iso);
      return;
    }
    if (conversion !== null) {
      submitConversion();
      return;
    }
    if (motif !== null) record(motif, null);
  }, [conversion, submitConversion, slots, freeCallback, motif, record]);

  const surStatut = surSelect(groupe, statutParSelect);
  const etape = etapeCourante(closed, conversion, slots, groupe, surStatut);
  const saisieEnCours = saisieCommencee(conversion, slots, motif, comment);
  const [quitterOuvert, setQuitterOuvert] = useState(false);

  const quitter = (): void => {
    if (saisieEnCours) setQuitterOuvert(true);
    else onAbandon();
  };

  const annuler = useCallback(() => {
    // L'échéance se referme seule : la jeter avec le dossier rempli au-dessous
    // perdrait ce qu'EB-10 demande justement de garder.
    if (slots !== null) {
      setSlots(null);
      return;
    }
    if (!saisieEnCours) {
      onAbandon();
      return;
    }
    const avant = { groupe, motif, comment, conversion };
    setEtapeAppel(0);
    setGroupe(null);
    setMotif(null);
    setComment('');
    setConversion(null);
    setConversionErrors({});
    commentRef.current?.blur();
    toast('Saisie effacée.', {
      action: {
        label: 'Rétablir',
        onClick: () => {
          setGroupe(avant.groupe);
          setMotif(avant.motif);
          setComment(avant.comment);
          setConversion(avant.conversion);
        },
      },
    });
  }, [slots, saisieEnCours, onAbandon, groupe, motif, comment, conversion]);

  const choisirGroupe = (choisi: Groupe): void => {
    setGroupe(choisi);
    if (surJoignable(choisi, statutParSelect)) ouvrirDossier();
  };

  const proposes = motifsDuGroupe(catalogue, groupe);
  const motifRappel = catalogue.find((item) => item.effect === 'SCHEDULE_CALLBACK');
  const motifRefus = catalogue.find((item) => item.effect === 'CLOSE_REFUSED');

  const groupeShortcuts: Record<string, () => void> = Object.fromEntries(
    GROUPES.map((item) => [
      item.touche,
      () => {
        choisirGroupe(item.cle);
      },
    ]),
  );

  const motifShortcuts: Record<string, () => void> = Object.fromEntries(
    proposes.slice(0, 9).map((item, rang) => [
      String(rang + 1),
      () => {
        choisir(item);
      },
    ]),
  );

  const slotShortcuts: Record<string, () => void> = Object.fromEntries(
    (slots ?? []).map((slot) => [
      slot.key,
      () => {
        if (motif !== null) record(motif, null, slot.at);
      },
    ]),
  );
  slotShortcuts['0'] = () => {
    callbackRef.current?.focus();
  };

  // EB-10 : le rappel reste atteignable au clavier une fois le dossier ouvert.
  const versLeRappel = (): void => {
    if (motifRappel === undefined) return;
    setEtapeAppel(ETAPES_APPEL.length - 1);
    setMotif(motifRappel);
    startCallback();
  };

  const allerA = (rang: number): void => {
    setSlots(null);
    setEtapeAppel(rang);
  };

  const continuer = (): void => {
    const etapeDossier = ETAPES_DOSSIER[etapeAppel - 1];
    if (conversion === null) return;
    if (etapeDossier === undefined) {
      allerA(1);
      return;
    }
    const probleme = filtrerErreurs(
      validateConversion(conversion, Date.now(), formulaire.champs, formulaire.libres),
      (etapeErreur) => etapeErreur === etapeDossier,
    );
    setConversionErrors((avant) => ({
      ...filtrerErreurs(avant, (etapeErreur) => etapeErreur !== etapeDossier),
      ...probleme,
    }));
    if (Object.keys(probleme).length > 0) {
      signalerEchec();
      return;
    }
    allerA(etapeAppel + 1);
  };

  const digitShortcuts = chiffresDeLEtape(etape, statutParSelect && etapeAppel === 0, {
    groupes: groupeShortcuts,
    motifs: motifShortcuts,
    slots: slotShortcuts,
    rappel: { [RAPPEL_KEY]: versLeRappel },
  });

  useShortcuts({
    ...digitShortcuts,
    Enter: entreeContinue(statutParSelect, etape, etapeAppel) ? continuer : validate,
    Escape: annuler,
    c: () => {
      copyPhone(prospect.phoneE164);
    },
    n: () => {
      const rep = prospect.representantId;
      if (projet === 'CHUES' && rep) {
        router.push(`/chues/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
      }
    },
    r: () => {
      const rep = prospect.representantId;
      if (projet === 'CHUES' && rep) router.push(`/chues/representants/${encodeURIComponent(rep)}`);
    },
    '?': () => {
      setHelpOpen((open) => !open);
    },
  });

  const enTete = (surDossier: boolean): ReactNode => (
    <EnTeteFiche
      prospect={prospect}
      nomComplet={nomComplet}
      projet={projet}
      closed={closed}
      surDossier={surDossier}
    />
  );

  const selectStatut = (): ReactNode => (
    <SelectStatut
      catalogue={statutsDuGroupe(groupe, catalogue)}
      motif={motif}
      disabled={send.isPending || closed}
      onChange={poserStatut}
      onFerme={() => {
        if (motif?.requiresComment) commentRef.current?.focus();
      }}
    />
  );

  const panneauDossier = (etapeDossier?: EtapeDossier): ReactNode => (
    <PanneauDossier
      ouvert={etape === 'dossier'}
      prospect={prospect}
      conversion={conversion}
      errors={conversionErrors}
      disabled={send.isPending}
      formulaire={formulaire}
      etape={etapeDossier}
      onChange={(patch) => {
        setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
      }}
    />
  );

  const choixIssue = (): ReactNode => (
    <ChoixIssue
      etape={etape}
      groupe={groupe}
      proposes={proposes}
      motif={motif}
      disabled={send.isPending}
      onGroupe={choisirGroupe}
      onMotif={choisir}
    />
  );

  const piedDossier = (): ReactNode => (
    <PiedDossier
      ouvert={etape === 'dossier'}
      disabled={send.isPending}
      motifRefus={motifRefus}
      onAdhesion={submitConversion}
      onRefus={(refus) => {
        setMotif(refus);
        record(refus, null);
      }}
      onRappel={versLeRappel}
      onAnnuler={() => {
        setConversion(null);
        setConversionErrors({});
        setEtapeAppel(0);
      }}
    />
  );

  const piedEtapes = (): ReactNode => (
    <PiedEtapes
      courante={etapeAppel}
      total={ETAPES_APPEL.length}
      disabled={send.isPending}
      raccourcis
      onRetour={() => {
        allerA(etapeAppel - 1);
      }}
      onContinuer={continuer}
    />
  );

  /** L'échéance, le commentaire et « Enregistrer l'appel » : un appel qui se consigne sans dossier. */
  function finAppel(): ReactNode {
    return (
      <>
        {etape !== 'echeance' || slots === null ? null : (
          <PanneauEcheance
            slots={slots}
            now={now}
            freeCallback={freeCallback}
            surDossier={conversion !== null}
            disabled={send.isPending}
            inputRef={callbackRef}
            onChoisir={(at) => {
              if (motif !== null) record(motif, null, at);
            }}
            onFreeCallback={setFreeCallback}
            onValidate={validate}
          />
        )}

        {etape === null ? null : (
          <Commentaire
            value={comment}
            obligatoirePour={commentaireExigePar(motif)}
            inputRef={commentRef}
            onChange={setComment}
            onValidate={validate}
          />
        )}

        <PiedAppel
          etape={statutParSelect ? etape : null}
          disabled={send.isPending}
          statutPose={motif !== null}
          onValidate={validate}
          onAbandon={quitter}
        />
      </>
    );
  }

  function corpsFiche(): ReactNode {
    return (
      <section aria-label="Fiche courante" className="flex flex-col gap-4">
        {enTete(etape === 'dossier')}
        {surStatut ? selectStatut() : null}
        {panneauDossier()}
        {choixIssue()}
        {finAppel()}
        {piedDossier()}
      </section>
    );
  }

  /** Grand Public : sans dossier ouvert, l'appel se consigne dès « Réponse ». */
  function etapeReponse(): ReactNode {
    return (
      <>
        {surStatut ? (
          <>
            <p className="text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
              {GROUPES.find((item) => item.cle === groupe)?.label}
            </p>
            {selectStatut()}
          </>
        ) : null}
        {choixIssue()}
        {etape === 'dossier' ? piedEtapes() : finAppel()}
      </>
    );
  }

  function etapeDuDossier(etapeDossier: EtapeDossier): ReactNode {
    return (
      <>
        {panneauDossier(etapeDossier)}
        {etapeDossier === 'Adhésion' ? (
          <>
            {finAppel()}
            {piedDossier()}
          </>
        ) : null}
        {piedEtapes()}
      </>
    );
  }

  function corpsAppel(): ReactNode {
    const etapeDossier = ETAPES_DOSSIER[etapeAppel - 1];
    const atteignable =
      conversion === null
        ? 0
        : 1 +
          etapesValides(validateConversion(conversion, now, formulaire.champs, formulaire.libres));
    return (
      <section ref={racineRef} aria-label="Fiche courante" className="flex flex-col gap-4">
        {/* Sur « Identité », le WhatsApp de l'envoi du lien remplace celui de l'en-tête. */}
        {enTete(etape === 'dossier' && etapeDossier === 'Identité')}
        {closed ? null : (
          <EtapesProgression
            etapes={ETAPES_APPEL}
            courante={etapeAppel}
            atteignable={atteignable}
            onChoisir={allerA}
          />
        )}
        {etapeDossier === undefined ? etapeReponse() : etapeDuDossier(etapeDossier)}
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Button variant="ghost" className="w-fit -ml-2" onClick={quitter}>
        <ArrowLeftIcon aria-hidden="true" />
        Revenir à la liste
      </Button>

      <ConfirmDialog
        open={quitterOuvert}
        onOpenChange={setQuitterOuvert}
        title="Quitter sans enregistrer l’appel ?"
        description="L’appel ne sera pas consigné."
        confirmLabel="Quitter"
        cancelLabel="Rester sur l’appel"
        onConfirm={() => {
          setQuitterOuvert(false);
          onAbandon();
        }}
      />

      {departChrono === null ? null : <Chrono firstInputAt={departChrono} />}

      {statutParSelect ? corpsAppel() : corpsFiche()}

      <details
        className="pointer-coarse:hidden"
        open={helpOpen}
        onToggle={(event) => {
          setHelpOpen(event.currentTarget.open);
        }}
      >
        <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground">
          Carte clavier <Kbd>?</Kbd>
        </summary>
        <dl className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
          {carteClavier(projet, statutParSelect).map(([keys, what]) => (
            <div key={keys} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0">
                <Kbd>{keys}</Kbd>
              </dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

/** Les quatre issues du dossier d'adhésion, une fois celui-ci rempli. */
export function PiedDossier({
  ouvert,
  disabled,
  motifRefus,
  raccourcis = true,
  extra,
  onAdhesion,
  onRefus,
  onRappel,
  onAnnuler,
}: {
  ouvert: boolean;
  disabled: boolean;
  motifRefus: MotifAppel | undefined;
  /** Faux : l'écran n'écoute pas le clavier, et les touches ne s'affichent pas. */
  raccourcis?: boolean;
  /** Les gestes propres à l'écran hôte, avant « Annuler ». */
  extra?: ReactNode;
  onAdhesion: () => void;
  onRefus: (motif: MotifAppel) => void;
  onRappel: () => void;
  onAnnuler: () => void;
}) {
  if (!ouvert) return null;
  const touche = (libelle: string): ReactNode => (raccourcis ? <Kbd>{libelle}</Kbd> : null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAdhesion} disabled={disabled}>
          Enregistrer l’adhésion
          {touche('Entrée')}
        </Button>
        {motifRefus === undefined ? null : (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => {
              onRefus(motifRefus);
            }}
          >
            Il refuse
          </Button>
        )}
        <Button variant="outline" disabled={disabled} onClick={onRappel}>
          À rappeler
          {touche(RAPPEL_KEY)}
        </Button>
        {extra}
        <Button variant="ghost" disabled={disabled} onClick={onAnnuler}>
          Annuler
          {touche('Échap')}
        </Button>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">
        « À rappeler » garde ce dossier pour le prochain appel. « Annuler » l’efface.
      </p>
    </>
  );
}

/** L'identité de la fiche : qui on appelle, son numéro, et ce qu'on en sait. */
function EnTeteFiche({
  prospect,
  nomComplet,
  projet,
  closed,
  surDossier,
}: {
  prospect: ProspectRow;
  nomComplet: string;
  projet: Projet;
  closed: boolean;
  surDossier: boolean;
}) {
  return (
    <>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{nomComplet}</h2>

      <div className="flex flex-wrap items-center gap-3">
        <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
          {formatPhone(prospect.phoneE164)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            copyPhone(prospect.phoneE164);
          }}
        >
          <CopyIcon aria-hidden="true" />
          Copier
          <Kbd>C</Kbd>
        </Button>
        {surDossier ? null : <BoutonWhatsApp prospect={prospect} />}
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">{rattachements(prospect, projet)}</p>
      <p className="text-[0.8125rem] text-muted-foreground">{resumeDernierAppel(prospect)}</p>

      {closed ? (
        <div
          role="status"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          Fiche déjà close ({PHASE2_STATUS_LABELS[prospect.phase2Status].toLowerCase()}). Rien à
          consigner ici.
        </div>
      ) : null}
    </>
  );
}

/**
 * Le pied des statuts qui n'ouvrent pas de dossier : eux n'ont pas les quatre
 * boutons de l'adhésion, mais l'appel se consigne quand même.
 */
function PiedAppel({
  etape,
  disabled,
  statutPose,
  onValidate,
  onAbandon,
}: {
  etape: Etape;
  disabled: boolean;
  /** Sans statut, l'appel n'a rien à dire : le bouton attend qu'on en choisisse un. */
  statutPose: boolean;
  onValidate: () => void;
  onAbandon: () => void;
}) {
  if (etape !== 'statut' && etape !== 'echeance') return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onValidate} disabled={disabled || !statutPose}>
        Enregistrer l’appel
        <Kbd>Entrée</Kbd>
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onAbandon}>
        Revenir à la liste
      </Button>
    </div>
  );
}

/** L'échéance d'EB-10 : elle s'ouvre aussi PAR-DESSUS un dossier déjà rempli. */
export function PanneauEcheance({
  slots,
  now,
  freeCallback,
  surDossier,
  disabled,
  inputRef,
  onChoisir,
  onFreeCallback,
  onValidate,
}: {
  slots: readonly CallbackSlot[];
  now: number;
  freeCallback: string;
  surDossier: boolean;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChoisir: (at: string) => void;
  onFreeCallback: (value: string) => void;
  onValidate: () => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Quand rappeler
      </legend>
      {surDossier ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Vous retrouverez le dossier déjà rempli au prochain appel.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <Button
            key={slot.key}
            variant="outline"
            className="h-auto flex-col items-start gap-0.5 py-2"
            onClick={() => {
              onChoisir(slot.at);
            }}
          >
            <span className="flex items-center gap-2">
              <Kbd>{slot.key}</Kbd>
              {slot.label}
            </span>
            <span className="pl-7 text-[0.75rem] font-[400] text-muted-foreground">
              {formatCallbackAt(slot.at, now)}
            </span>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="console-callback-at"
          className="flex items-center gap-2 text-[0.875rem] font-[600]"
        >
          <Kbd>0</Kbd>
          Autre échéance
        </label>
        <Input
          id="console-callback-at"
          ref={inputRef}
          type="datetime-local"
          className="max-w-64"
          value={freeCallback}
          onChange={(event) => {
            onFreeCallback(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onValidate();
          }}
        />
        <p className="text-[0.75rem] text-muted-foreground">
          Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste.{' '}
          {surDossier ? 'Échap revient au dossier.' : 'Échap revient aux issues.'}
        </p>
      </div>
    </fieldset>
  );
}

export function Commentaire({
  value,
  obligatoirePour,
  inputRef,
  onChange,
  onValidate,
}: {
  value: string;
  /** Le statut qui réclame le commentaire, nul quand il reste facultatif. */
  obligatoirePour: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onValidate: () => void;
}) {
  // Un clavier de téléphone n'a pas Maj+Entrée : Entrée y passe à la ligne.
  const tactile = window.matchMedia('(pointer: coarse)').matches;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-comment" className="text-[0.875rem] font-[600]">
        Commentaire
        {obligatoirePour === null ? '' : ` (obligatoire pour ${obligatoirePour})`}
      </label>
      <Textarea
        id="console-comment"
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (tactile || event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          onValidate();
        }}
        placeholder={tactile ? undefined : 'Entrée valide, Maj+Entrée passe à la ligne.'}
      />
    </div>
  );
}
