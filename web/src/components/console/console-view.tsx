'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ArrowLeftIcon, CopyIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Chrono, copyPhone, Kbd } from '@/components/console/console-ui';
import { ConversionFields } from '@/components/console/conversion-fields';
import { EnvoiLienFormulaire } from '@/components/console/envoi-lien-formulaire';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { BoutonWhatsApp } from '@/components/prospects/bouton-whatsapp';
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
  EFFET_ISSUE,
  estJoignable,
  fetchMotifsAppel,
  type MotifAppel,
} from '@/lib/data/call-outcome-reasons';
import {
  useChampsConversion,
  type ChampLibre,
  type ReglageChamp,
} from '@/lib/data/champs-conversion';
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
import { useVerrouFiches } from '@/lib/use-verrou-fiches';
import { navigationRetenue, useVerrouNavigation } from '@/lib/use-verrou-navigation';
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

/**
 * Le repli quand le référentiel ne répond pas : les six motifs système, ceux que
 * le serveur applique lui-même en l'absence de `reasonCode`. Sans lui, une
 * lecture en échec laisserait l'écran d'appel sans aucune issue.
 */
const MOTIFS_SYSTEME: readonly MotifAppel[] = [
  { code: 'METHOD_OBTAINED', label: 'Méthode obtenue', effect: 'CLOSE_METHOD' },
  { code: 'REFUSED', label: 'Refus', effect: 'CLOSE_REFUSED' },
  { code: 'CALLBACK', label: CALL_OUTCOME_LABELS.CALLBACK, effect: 'SCHEDULE_CALLBACK' },
  { code: 'WRONG_NUMBER', label: CALL_OUTCOME_LABELS.WRONG_NUMBER, effect: 'CLOSE_WRONG_NUMBER' },
  { code: 'UNREACHABLE', label: CALL_OUTCOME_LABELS.UNREACHABLE, effect: 'KEEP_OPEN' },
  { code: 'OTHER', label: 'Autre', effect: 'KEEP_OPEN', requiresComment: true },
].map((motif) => ({ requiresComment: false, ...motif }) as MotifAppel);

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

const nouveauHref = (projet: Projet): string =>
  projet === 'GRAND_PUBLIC' ? '/grand-public/nouveau' : '/chues/prospects/nouveau';

/**
 * Étape 3 : convertir un prospect. L'écran ouvre sur la recherche, la fiche
 * choisie reçoit l'appel, puis on revient à la liste. `?fiche=<id>` (depuis
 * les rappels) ouvre directement la fiche visée.
 */
export function ConsoleView({ projet = 'CHUES' }: { projet?: Projet }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const verrouActif = useVerrouFiches();

  const [ouverte, setOuverte] = useState<Ouverte | null>(null);
  const [vise, setVise] = useState<ProspectRow | null>(null);
  const [demandee, setDemandee] = useState<string | null>(searchParams.get('fiche'));
  const [search, setSearch] = useState('');
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
    queryKey: [...queryKeys.prospectsRoot, 'a-qualifier', projet, cherche] as const,
    queryFn: () => fetchProspectsAQualifier({ projet, search: cherche }),
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

  // EB-08 : le verrou vit sur le serveur, l'écran non. Sans cette reprise, un
  // rechargement laisse le téléconseiller devant l'annuaire alors que sa fiche
  // est toujours tenue.
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
      void reprendreOuverte(reprendre, error);
    },
  });

  if (consultee !== null) {
    return (
      <Consignation
        key={consultee.prospect.id}
        prospect={consultee.prospect}
        ouverture={consultee.ouverture}
        projet={projet}
        verrouActif={verrouActif}
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
      {demandee !== null && parLien.isError ? (
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

      <ChampAnnuaire value={search} onChange={setSearch} />

      <p className="text-[0.8125rem] text-muted-foreground">
        {cherche === ''
          ? 'Vos fiches et celles que vos campagnes vous ont confiées. Cherchez un nom ou un numéro pour en voir d’autres.'
          : 'Choisissez qui vous venez d’appeler.'}
      </p>

      <ListeAnnuaire
        annuaire={annuaire}
        cherche={cherche}
        projet={projet}
        onChoisir={(row) => {
          setConfirme(null);
          if (aQualifier(row)) setVise(row);
          else setOuverte({ prospect: row, ouverture: null });
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
        description={descriptionOuverture(verrouActif)}
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

/** La fiche et l'ouverture qui la verrouille. Nulle quand la fiche est close. */
interface Ouverte {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
}

const nomDe = (prospect: ProspectRow): string => `${prospect.nom} ${prospect.prenom}`;

/** Coupé, le serveur referme l'ancienne ouverture de lui-même : la promesse ne tient plus. */
const descriptionOuverture = (verrouActif: boolean): string | null =>
  verrouActif ? 'Vous ne pourrez pas la quitter sans la qualifier.' : null;

/** Ce que `lireBrouillon` sait relire, et rien d'autre. */
const brouillonDe = (
  comment: string,
  conversion: ConversionDraft | null,
): Record<string, unknown> => ({
  comment,
  ...(conversion === null ? {} : { conversion }),
});

const aQualifier = (prospect: ProspectRow): boolean => prospect.phase2Status === 'PENDING';

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
  const aConfirmer =
    vise ?? (venuDesRappels !== null && aQualifier(venuDesRappels) ? venuDesRappels : null);
  // Une fiche close ne peut plus recevoir de statut : l'ouvrir sous verrou y
  // enfermerait le téléconseiller. Elle se consulte, elle ne se compte pas.
  const consultee =
    ouverte ??
    (venuDesRappels !== null && !aQualifier(venuDesRappels)
      ? { prospect: venuDesRappels, ouverture: null }
      : null);
  return { aConfirmer, consultee };
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

function ficheVerrouillee(ouverture: OuvertureFiche | null, closed: boolean): boolean {
  return ouverture !== null && !closed;
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
 * La fiche que le serveur tient encore, remise à l'écran telle quelle : au
 * montage elle répare un rechargement, sur refus d'ouverture elle dit laquelle
 * est tenue, que le serveur ne nomme pas.
 */
async function reprendreOuverte(
  reprendre: (prise: Ouverte) => void,
  refus: unknown = null,
): Promise<void> {
  const courante = await fetchOuvertureCourante().catch(() => null);
  if (courante === null) {
    if (refus !== null) toastApiError(refus, 'La fiche n’a pas pu être ouverte.');
    return;
  }
  if (courante.prospectId === null) {
    toast.error(
      `Vous avez ${courante.ficheNom} en main sur « Qualifier un représentant ». Qualifiez-la avant d’ouvrir une fiche ici.`,
    );
    return;
  }
  const prospect = await fetchProspect(courante.prospectId).catch(() => null);
  if (prospect === null) {
    toast.error(`Vous avez déjà ${courante.ficheNom} en main. Qualifiez-la avant d’en ouvrir une.`);
    return;
  }
  toast.info(`Vous aviez déjà ${courante.ficheNom} en main : la voici.`);
  reprendre({ prospect, ouverture: courante });
}

function ListeAnnuaire({
  annuaire,
  cherche,
  projet,
  onChoisir,
}: {
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchProspectsAQualifier>>>;
  cherche: string;
  projet: Projet;
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
        <Link href={nouveauHref(projet)} className={cn(buttonVariants(), 'self-start')}>
          Ajouter un prospect
        </Link>
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
        {annuaire.data.items.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <button
                type="button"
                onClick={() => {
                  onChoisir(row);
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-sm text-left text-[0.9375rem] font-[600]',
                  'underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                <span className="truncate">
                  {row.nom} {row.prenom}
                </span>
                {row.phase2Status === 'PENDING' ? null : (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.75rem] font-[400] text-muted-foreground">
                    {PHASE2_STATUS_LABELS[row.phase2Status]}
                  </span>
                )}
              </button>
            </TableCell>
            <TableCell className="whitespace-nowrap">{formatPhone(row.phoneE164)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {row.lastAttemptAt === null ? 'Jamais appelé' : formatDateTime(row.lastAttemptAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
function PanneauDossier({
  ouvert,
  prospect,
  conversion,
  errors,
  disabled,
  formulaire,
  onChange,
}: {
  ouvert: boolean;
  prospect: ProspectRow;
  conversion: ConversionDraft | null;
  errors: ConversionErrors;
  disabled: boolean;
  formulaire: { champs: readonly ReglageChamp[]; libres: readonly ChampLibre[] };
  onChange: (patch: Partial<ConversionDraft>) => void;
}) {
  if (!ouvert || conversion === null) return null;

  return (
    <>
      <p className="text-[0.8125rem] font-[600] text-muted-foreground">
        Joignable · son dossier, et la manière dont il adhère
      </p>

      <EnvoiLienFormulaire prospect={prospect} email={conversion.email} />

      <ConversionFields
        draft={conversion}
        errors={errors}
        phoneE164={prospect.phoneE164}
        disabled={disabled}
        reglages={formulaire.champs}
        libres={formulaire.libres}
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
type Etape = 'issues' | 'motifs' | 'dossier' | 'echeance' | null;

function etapeCourante(
  closed: boolean,
  conversion: ConversionDraft | null,
  slots: readonly CallbackSlot[] | null,
  groupe: Groupe | null,
): Etape {
  if (closed) return null;
  if (slots !== null) return 'echeance';
  if (conversion !== null) return 'dossier';
  return groupe === null ? 'issues' : 'motifs';
}

/**
 * La consignation d'un appel, en deux temps : d'abord si la personne était
 * joignable, puis, si oui, son dossier et la manière dont elle adhère.
 */
function Consignation({
  prospect,
  ouverture,
  projet,
  verrouActif,
  onAbandon,
  onEnregistre,
}: {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
  projet: Projet;
  verrouActif: boolean;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const router = useRouter();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);

  const [repris] = useState(() => lireBrouillon(ouverture?.draft));
  const [comment, setComment] = useState(repris.comment);
  const [groupe, setGroupe] = useState<Groupe | null>(null);
  const [motif, setMotif] = useState<MotifAppel | null>(null);
  const [conversion, setConversion] = useState<ConversionDraft | null>(repris.conversion);
  const [conversionErrors, setConversionErrors] = useState<ConversionErrors>({});
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [refusee, setRefusee] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
  const verrouille = verrouActif && ficheVerrouillee(ouverture, closed);

  const departChrono = useBrouillonAuto(ouverture, brouillonDe(comment, conversion));

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
        if (refused !== null) setConversionErrors({ [refused.field]: refused.message });
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
      if (closed || send.isPending) return;
      const draft: AttemptDraft = {
        outcome: EFFET_ISSUE[choisi.effect],
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
    [closed, send, comment, ouverture],
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
    if (Object.keys(problems).length > 0 || conversion.method === null || motif === null) return;
    record(motif, conversion.method, null, conversion);
  }, [conversion, formulaire, motif, record]);

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

  const etape = etapeCourante(closed, conversion, slots, groupe);
  const saisieEnCours = saisieCommencee(conversion, slots, motif, comment);

  const retenu = useCallback(() => {
    toast.error('Consignez l’appel avant de quitter cette fiche.');
  }, []);

  useVerrouNavigation(verrouille, retenu);

  const annuler = useCallback(() => {
    // L'échéance se referme seule : la jeter avec le dossier rempli au-dessous
    // perdrait ce qu'EB-10 demande justement de garder.
    if (slots !== null) {
      setSlots(null);
      return;
    }
    if (!saisieEnCours) {
      // EB-08 : la fiche ouverte ne se quitte pas sans issue. Seul l'envoi la
      // referme, et le chronomètre s'arrête avec elle.
      if (verrouille) retenu();
      else onAbandon();
      return;
    }
    setGroupe(null);
    setMotif(null);
    setComment('');
    setConversion(null);
    setConversionErrors({});
    commentRef.current?.blur();
  }, [slots, saisieEnCours, verrouille, retenu, onAbandon]);

  const proposes = catalogue.filter(
    (item) => (estJoignable(item) ? 'joignable' : 'injoignable') === groupe,
  );
  const motifRappel = catalogue.find((item) => item.effect === 'SCHEDULE_CALLBACK');
  const motifRefus = catalogue.find((item) => item.effect === 'CLOSE_REFUSED');

  const groupeShortcuts: Record<string, () => void> = Object.fromEntries(
    GROUPES.map((item) => [
      item.touche,
      () => {
        setGroupe(item.cle);
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
    setMotif(motifRappel);
    startCallback();
  };

  let digitShortcuts = etape === 'motifs' ? motifShortcuts : groupeShortcuts;
  if (etape === 'dossier') digitShortcuts = { [RAPPEL_KEY]: versLeRappel };
  if (etape === 'echeance') digitShortcuts = slotShortcuts;

  useShortcuts({
    ...digitShortcuts,
    Enter: validate,
    Escape: annuler,
    c: () => {
      copyPhone(prospect.phoneE164);
    },
    n: () => {
      if (navigationRetenue()) return;
      const rep = prospect.representantId;
      if (rep) router.push(`/chues/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
    },
    r: () => {
      if (navigationRetenue()) return;
      const rep = prospect.representantId;
      if (rep) router.push(`/chues/representants/${encodeURIComponent(rep)}`);
    },
    '?': () => {
      setHelpOpen((open) => !open);
    },
  });

  function corpsFiche(): React.ReactNode {
    return (
      <section aria-label="Fiche courante" className="flex flex-col gap-4">
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
          {etape === 'dossier' ? null : <BoutonWhatsApp prospect={prospect} />}
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

        <PanneauDossier
          ouvert={etape === 'dossier'}
          prospect={prospect}
          conversion={conversion}
          errors={conversionErrors}
          disabled={send.isPending}
          formulaire={formulaire}
          onChange={(patch) => {
            setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
          }}
        />

        <ChoixIssue
          etape={etape}
          groupe={groupe}
          proposes={proposes}
          motif={motif}
          disabled={send.isPending}
          onGroupe={setGroupe}
          onMotif={choisir}
        />

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
            obligatoire={motif?.requiresComment ?? false}
            inputRef={commentRef}
            onChange={setComment}
            onValidate={validate}
          />
        )}

        {etape !== 'dossier' ? null : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={submitConversion} disabled={send.isPending}>
                Enregistrer l’adhésion
                <Kbd>Entrée</Kbd>
              </Button>
              {motifRefus === undefined ? null : (
                <Button
                  variant="outline"
                  disabled={send.isPending}
                  onClick={() => {
                    setMotif(motifRefus);
                    record(motifRefus, null);
                  }}
                >
                  Il refuse
                </Button>
              )}
              <Button variant="outline" disabled={send.isPending} onClick={versLeRappel}>
                À rappeler
                <Kbd>{RAPPEL_KEY}</Kbd>
              </Button>
              <Button
                variant="ghost"
                disabled={send.isPending}
                onClick={() => {
                  setConversion(null);
                  setConversionErrors({});
                }}
              >
                Annuler
                <Kbd>Échap</Kbd>
              </Button>
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">
              « À rappeler » garde ce dossier pour le prochain appel. « Annuler » l’efface.
            </p>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {verrouille ? null : (
        <Button variant="ghost" className="self-start px-0" onClick={onAbandon}>
          <ArrowLeftIcon aria-hidden="true" />
          Revenir à la liste
        </Button>
      )}

      {departChrono === null ? null : <Chrono firstInputAt={departChrono} />}

      {corpsFiche()}

      <details
        open={helpOpen}
        onToggle={(event) => {
          setHelpOpen(event.currentTarget.open);
        }}
      >
        <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground">
          Carte clavier <Kbd>?</Kbd>
        </summary>
        <dl className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
          {KEYBOARD_MAP.filter(
            ([keys]) => (projet === 'CHUES' && !verrouille) || (keys !== 'N' && keys !== 'R'),
          ).map(([keys, what]) => (
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

/** L'échéance d'EB-10 : elle s'ouvre aussi PAR-DESSUS un dossier déjà rempli. */
function PanneauEcheance({
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

function Commentaire({
  value,
  obligatoire,
  inputRef,
  onChange,
  onValidate,
}: {
  value: string;
  obligatoire: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onValidate: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-comment" className="text-[0.875rem] font-[600]">
        Commentaire
        {obligatoire ? ' (obligatoire pour Autre)' : ''}
      </label>
      <Textarea
        id="console-comment"
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          onValidate();
        }}
        placeholder="Entrée valide, Maj+Entrée passe à la ligne."
      />
    </div>
  );
}
