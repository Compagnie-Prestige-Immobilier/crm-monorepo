'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ArrowLeftIcon, CopyIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Chrono, copyPhone, Kbd } from '@/components/console/console-ui';
import { ConversionFields } from '@/components/console/conversion-fields';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { fetchProspect, fetchProspects } from '@/lib/data/prospects';
import { EMPTY_FILTERS } from '@/lib/filters';
import { dakarLocalToIso, formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  PHASE2_STATUS_LABELS,
  type CallOutcome,
  type EnrollmentMethod,
  type ProspectFilters,
  type ProspectRow,
} from '@/lib/types';
import { useBrouillonAuto } from '@/lib/use-brouillon-auto';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { navigationRetenue, useVerrouNavigation } from '@/lib/use-verrou-navigation';
import { cn } from '@/lib/utils';

type Projet = 'CHUES' | 'GRAND_PUBLIC';

/** Seule issue encore atteignable au clavier une fois le dossier ouvert (EB-10). */
const RAPPEL_KEY = '2';

/** Ce que l'appel a donné, avant tout : la personne était-elle joignable. */
const ISSUES: readonly { key: string; label: string; outcome: CallOutcome | 'JOIGNABLE' }[] = [
  { key: '1', label: 'Joignable', outcome: 'JOIGNABLE' },
  { key: RAPPEL_KEY, label: CALL_OUTCOME_LABELS.CALLBACK, outcome: 'CALLBACK' },
  { key: '3', label: CALL_OUTCOME_LABELS.UNREACHABLE, outcome: 'UNREACHABLE' },
  { key: '4', label: CALL_OUTCOME_LABELS.WRONG_NUMBER, outcome: 'WRONG_NUMBER' },
  { key: '5', label: 'Autre', outcome: 'OTHER' },
];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1', 'Joignable : ouvre le dossier et l’adhésion'],
  ['2', 'À rappeler, puis échéance'],
  ['3', 'Injoignable'],
  ['4', 'Mauvais numéro'],
  ['5', 'Autre, puis commentaire'],
  ['1 … 6', 'Échéance proposée, après 2'],
  ['0', 'Saisir une autre échéance, après 2'],
  ['Entrée', 'Valider'],
  ['Échap', 'Revenir en arrière, ou effacer la saisie en cours'],
  ['C', 'Copier le numéro'],
  ['N', 'Ajouter un prospect sur ce représentant'],
  ['R', 'Fiche du représentant'],
  ['?', 'Afficher cette carte'],
];

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

/** Sans recherche : les vingt dernières fiches ajoutées au projet. */
const annuaireFilters = (projet: Projet, search: string): ProspectFilters => ({
  ...EMPTY_FILTERS,
  projet,
  search,
  pageSize: 20,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
});

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

  const venuDesRappels = demandee === null ? null : (parLien.data ?? null);
  const aConfirmer =
    vise ?? (venuDesRappels !== null && aQualifier(venuDesRappels) ? venuDesRappels : null);
  // Une fiche close ne peut plus recevoir de statut : l'ouvrir sous verrou y
  // enfermerait le téléconseiller. Elle se consulte, elle ne se compte pas.
  const consultee =
    ouverte ??
    (venuDesRappels !== null && !aQualifier(venuDesRappels)
      ? { prospect: venuDesRappels, ouverture: null }
      : null);

  const annuaire = useQuery({
    queryKey: queryKeys.prospects(annuaireFilters(projet, cherche)),
    queryFn: () => fetchProspects(annuaireFilters(projet, cherche)),
    enabled: consultee === null && aConfirmer === null,
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

  if (demandee !== null && parLien.isPending) return <ListeSkeleton />;

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
          ? 'Les vingt dernières fiches ajoutées. Cherchez un nom ou un numéro pour en voir d’autres.'
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
        description="Vous ne pourrez pas la quitter sans la qualifier."
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

/** Ce que `lireBrouillon` sait relire, et rien d'autre. */
const brouillonDe = (
  comment: string,
  conversion: ConversionDraft | null,
): Record<string, unknown> => ({
  comment,
  ...(conversion === null ? {} : { conversion }),
});

const aQualifier = (prospect: ProspectRow): boolean => prospect.phase2Status === 'PENDING';

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
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchProspects>>>;
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
            ? 'Aucun prospect pour l’instant.'
            : 'Aucun résultat. Vérifiez le nom ou le numéro.'}
        </p>
        <Link href={nouveauHref(projet)} className={cn(buttonVariants(), 'self-start')}>
          Ajouter un prospect
        </Link>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {annuaire.data.items.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => {
              onChoisir(row);
            }}
            className={cn(
              'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-3 text-left',
              'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.9375rem] font-[600]">
                {row.nom} {row.prenom}
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">
                <span className="tabular-nums">{formatPhone(row.phoneE164)}</span>
                {row.banqueName === null ? '' : ` · ${row.banqueName}`}
                {row.lastAttemptAt === null
                  ? ' · jamais appelé'
                  : ` · dernier appel ${formatDateTime(row.lastAttemptAt)}`}
              </span>
            </span>
            {row.phase2Status === 'PENDING' ? null : (
              <span className="rounded-full border border-border px-2 py-0.5 text-[0.75rem] text-muted-foreground">
                {PHASE2_STATUS_LABELS[row.phase2Status]}
              </span>
            )}
          </button>
        </li>
      ))}
    </ol>
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
type Etape = 'issues' | 'dossier' | 'echeance' | null;

function etapeCourante(
  closed: boolean,
  conversion: ConversionDraft | null,
  slots: readonly CallbackSlot[] | null,
): Etape {
  if (closed) return null;
  if (slots !== null) return 'echeance';
  if (conversion !== null) return 'dossier';
  return 'issues';
}

/**
 * La consignation d'un appel, en deux temps : d'abord si la personne était
 * joignable, puis, si oui, son dossier et la manière dont elle adhère.
 */
function Consignation({
  prospect,
  ouverture,
  projet,
  onAbandon,
  onEnregistre,
}: {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
  projet: Projet;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const router = useRouter();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);

  const [repris] = useState(() => lireBrouillon(ouverture?.draft));
  const [comment, setComment] = useState(repris.comment);
  const [draftOutcome, setDraftOutcome] = useState<CallOutcome | null>(null);
  const [conversion, setConversion] = useState<ConversionDraft | null>(repris.conversion);
  const [conversionErrors, setConversionErrors] = useState<ConversionErrors>({});
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [refusee, setRefusee] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const nomComplet = nomDe(prospect);
  const closed = prospect.phase2Status !== 'PENDING' || refusee;
  const [now] = useState(() => Date.now());
  const verrouille = ouverture !== null && !closed;

  const departChrono = useBrouillonAuto(ouverture, brouillonDe(comment, conversion));

  const send = useMutation({
    mutationFn: async (draft: AttemptDraft) => {
      // EB-10 : le brouillon part AVANT la tentative, qui referme l'ouverture et
      // ferait refuser toute écriture postérieure. Le dossier passe par lui et
      // non par la tentative : incomplet, le serveur la refuserait en 400.
      if (draft.outcome === 'CALLBACK' && ouverture !== null) {
        await enregistrerBrouillon(ouverture.id, brouillonDe(draft.comment, conversion)).catch(
          () => {
            toast.error('Les réponses saisies n’ont pas pu être conservées. L’appel, lui, part.');
          },
        );
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
      outcome: CallOutcome,
      method: EnrollmentMethod | null,
      callbackAt: string | null = null,
      renseignements?: ConversionDraft,
    ) => {
      if (closed || send.isPending) return;
      const draft: AttemptDraft = {
        outcome,
        method,
        comment,
        callbackAt,
        ...(renseignements === undefined ? {} : { conversion: renseignements }),
        ...(ouverture === null ? {} : { ouvertureId: ouverture.id }),
      };
      const problem = validateAttempt(draft);
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
    setDraftOutcome(null);
    setSlots(null);
    setConversionErrors({});
    setConversion(conversionFrom(prospect));
  }, [closed, send.isPending, prospect]);

  const submitConversion = useCallback(() => {
    if (conversion === null) return;
    const problems = validateConversion(conversion);
    setConversionErrors(problems);
    if (Object.keys(problems).length > 0 || conversion.method === null) return;
    record('METHOD_OBTAINED', conversion.method, null, conversion);
  }, [conversion, record]);

  const startOther = useCallback(() => {
    if (closed) return;
    setDraftOutcome('OTHER');
    commentRef.current?.focus();
  }, [closed]);

  const startCallback = useCallback(() => {
    if (closed) return;
    setDraftOutcome(null);
    setFreeCallback('');
    setSlots(callbackSlots(Date.now()));
  }, [closed]);

  const choisir = useCallback(
    (outcome: CallOutcome | 'JOIGNABLE') => {
      if (outcome === 'JOIGNABLE') ouvrirDossier();
      else if (outcome === 'CALLBACK') startCallback();
      else if (outcome === 'OTHER') startOther();
      else record(outcome, null);
    },
    [ouvrirDossier, startCallback, startOther, record],
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
      record('CALLBACK', null, iso);
      return;
    }
    if (conversion !== null) {
      submitConversion();
      return;
    }
    if (draftOutcome !== null) record(draftOutcome, null);
  }, [conversion, submitConversion, slots, freeCallback, draftOutcome, record]);

  const etape = etapeCourante(closed, conversion, slots);
  const saisieEnCours =
    conversion !== null || slots !== null || draftOutcome !== null || comment !== '';

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
    setDraftOutcome(null);
    setComment('');
    setConversion(null);
    setConversionErrors({});
    commentRef.current?.blur();
  }, [slots, saisieEnCours, verrouille, retenu, onAbandon]);

  const issueShortcuts: Record<string, () => void> = Object.fromEntries(
    ISSUES.map((issue) => [
      issue.key,
      () => {
        choisir(issue.outcome);
      },
    ]),
  );

  const slotShortcuts: Record<string, () => void> = Object.fromEntries(
    (slots ?? []).map((slot) => [
      slot.key,
      () => {
        record('CALLBACK', null, slot.at);
      },
    ]),
  );
  slotShortcuts['0'] = () => {
    callbackRef.current?.focus();
  };

  let digitShortcuts = issueShortcuts;
  if (etape === 'dossier') digitShortcuts = { [RAPPEL_KEY]: startCallback };
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {verrouille ? null : (
        <Button variant="ghost" className="self-start px-0" onClick={onAbandon}>
          <ArrowLeftIcon aria-hidden="true" />
          Revenir à la liste
        </Button>
      )}

      {departChrono === null ? null : <Chrono firstInputAt={departChrono} />}

      <section aria-label="Fiche courante" className="flex flex-col gap-4">
        <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{nomComplet}</h2>

        <div className="flex items-center gap-3">
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

        {etape !== 'dossier' || conversion === null ? null : (
          <>
            <p className="text-[0.8125rem] font-[600] text-muted-foreground">
              Joignable · son dossier, et la manière dont il adhère
            </p>

            <ConversionFields
              draft={conversion}
              errors={conversionErrors}
              phoneE164={prospect.phoneE164}
              disabled={send.isPending}
              onChange={(patch) => {
                setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
              }}
            />
          </>
        )}

        {etape !== 'issues' ? null : (
          <fieldset className="flex flex-col gap-2" disabled={send.isPending}>
            <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
              Comment s’est passé l’appel ?
            </legend>
            <div className="flex flex-wrap gap-2">
              {ISSUES.map((issue) => (
                <Button
                  key={issue.key}
                  variant={
                    issue.outcome === 'OTHER' && draftOutcome === 'OTHER' ? 'default' : 'outline'
                  }
                  onClick={() => {
                    choisir(issue.outcome);
                  }}
                >
                  <Kbd>{issue.key}</Kbd>
                  {issue.label}
                </Button>
              ))}
            </div>
          </fieldset>
        )}

        {etape !== 'echeance' || slots === null ? null : (
          <PanneauEcheance
            slots={slots}
            now={now}
            freeCallback={freeCallback}
            surDossier={conversion !== null}
            disabled={send.isPending}
            inputRef={callbackRef}
            onChoisir={(at) => {
              record('CALLBACK', null, at);
            }}
            onFreeCallback={setFreeCallback}
            onValidate={validate}
          />
        )}

        {etape === null ? null : (
          <Commentaire
            value={comment}
            obligatoire={draftOutcome === 'OTHER'}
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
              <Button
                variant="outline"
                disabled={send.isPending}
                onClick={() => {
                  record('REFUSED', null);
                }}
              >
                Il refuse
              </Button>
              <Button variant="outline" disabled={send.isPending} onClick={startCallback}>
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
