'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ArrowLeftIcon, CopyIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
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
import { useChampsConversion } from '@/lib/data/champs-conversion';
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
import { cn } from '@/lib/utils';

type Projet = 'CHUES' | 'GRAND_PUBLIC';

/** Seule issue encore atteignable au clavier une fois le dossier ouvert (EB-10). */
const RAPPEL_KEY = '2';

const ISSUES: readonly { key: string; label: string; outcome: CallOutcome | 'JOIGNABLE' }[] = [
  { key: '1', label: 'Joignable', outcome: 'JOIGNABLE' },
  { key: '2', label: 'Injoignable', outcome: 'UNREACHABLE' },
];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1', 'Joignable : ouvre le dossier et l’adhésion'],
  ['2', 'Injoignable : enregistre l’appel sans réponse'],
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

  const venuDesRappels = fichePendante(demandee, parLien.data);
  const { aConfirmer, consultee } = deriverFiches(vise, ouverte, venuDesRappels);

  const annuaire = useQuery({
    queryKey: queryKeys.prospects(annuaireFilters(projet, cherche)),
    queryFn: () => fetchProspects(annuaireFilters(projet, cherche)),
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

/** La fiche et l'ouverture qui la chronomètre. */
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

function saisieCommencee(
  conversion: ConversionDraft | null,
  slots: readonly CallbackSlot[] | null,
  draftOutcome: CallOutcome | null,
  comment: string,
): boolean {
  return conversion !== null || slots !== null || draftOutcome !== null || comment !== '';
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
type Etape = 'issues' | 'dossier' | 'echeance';

function etapeCourante(
  conversion: ConversionDraft | null,
  slots: readonly CallbackSlot[] | null,
): Etape {
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
  const [helpOpen, setHelpOpen] = useState(false);

  const formulaire = useChampsConversion(projet);

  const nomComplet = nomDe(prospect);
  const [now] = useState(() => Date.now());

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
      if (send.isPending) return;
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
    [send, comment, ouverture],
  );

  const ouvrirDossier = useCallback(() => {
    if (send.isPending) return;
    setDraftOutcome(null);
    setSlots(null);
    setConversionErrors({});
    setConversion(conversionFrom(prospect));
  }, [send.isPending, prospect]);

  const submitConversion = useCallback(() => {
    if (conversion === null) return;
    const problems = validateConversion(
      conversion,
      Date.now(),
      formulaire.champs,
      formulaire.libres,
    );
    setConversionErrors(problems);
    if (Object.keys(problems).length > 0 || conversion.method === null) return;
    record('METHOD_OBTAINED', conversion.method, null, conversion);
  }, [conversion, formulaire, record]);

  const startOther = useCallback(() => {
    setDraftOutcome('OTHER');
    commentRef.current?.focus();
  }, []);

  const startCallback = useCallback(() => {
    setDraftOutcome(null);
    setFreeCallback('');
    setSlots(callbackSlots(Date.now()));
  }, []);

  const choisir = useCallback(
    (outcome: CallOutcome | 'JOIGNABLE') => {
      if (outcome === 'JOIGNABLE') {
        setDraftOutcome(null);
        if (conversion === null) ouvrirDossier();
      } else if (outcome === 'UNREACHABLE') {
        setConversion(null);
        setConversionErrors({});
        setSlots(null);
        setDraftOutcome('UNREACHABLE');
      } else if (outcome === 'CALLBACK') {
        startCallback();
      } else if (outcome === 'OTHER') {
        startOther();
      } else {
        record(outcome, null);
      }
    },
    [conversion, ouvrirDossier, startCallback, startOther, record],
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

  const etape = etapeCourante(conversion, slots);
  const saisieEnCours = saisieCommencee(conversion, slots, draftOutcome, comment);

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
    setDraftOutcome(null);
    setComment('');
    setConversion(null);
    setConversionErrors({});
    commentRef.current?.blur();
  }, [slots, saisieEnCours, onAbandon]);

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
      const rep = prospect.representantId;
      if (rep) router.push(`/chues/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
    },
    r: () => {
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
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
                {nomComplet}
              </h2>
              <span className="select-all font-mono text-[1.25rem] font-[700] tracking-tight tabular-nums text-foreground">
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
              <BoutonWhatsApp prospect={prospect} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{rattachements(prospect, projet)}</span>
              <span>·</span>
              <span>{resumeDernierAppel(prospect)}</span>
            </div>
          </div>
          {departChrono === null ? null : <Chrono firstInputAt={departChrono} />}
        </div>

        <fieldset className="flex flex-col gap-3" disabled={send.isPending}>
          <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
            Comment s’est passé l’appel ?
          </legend>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              variant={conversion !== null ? 'default' : 'outline'}
              className="min-w-36 justify-center gap-2 font-semibold"
              onClick={() => {
                choisir('JOIGNABLE');
              }}
            >
              <Kbd>1</Kbd>
              Joignable
            </Button>
            <Button
              type="button"
              size="lg"
              variant={
                draftOutcome === 'UNREACHABLE' ||
                draftOutcome === 'WRONG_NUMBER' ||
                draftOutcome === 'OTHER'
                  ? 'default'
                  : 'outline'
              }
              className="min-w-36 justify-center gap-2 font-semibold"
              onClick={() => {
                choisir('UNREACHABLE');
              }}
            >
              <Kbd>2</Kbd>
              Injoignable
            </Button>
          </div>
        </fieldset>

        {draftOutcome !== 'UNREACHABLE' &&
        draftOutcome !== 'WRONG_NUMBER' &&
        draftOutcome !== 'OTHER' ? null : (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Motif de non-joignabilité
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={draftOutcome === 'UNREACHABLE' ? 'default' : 'outline'}
                onClick={() => setDraftOutcome('UNREACHABLE')}
              >
                Ne répond pas
              </Button>
              <Button
                type="button"
                variant={draftOutcome === 'WRONG_NUMBER' ? 'default' : 'outline'}
                onClick={() => setDraftOutcome('WRONG_NUMBER')}
              >
                Mauvais numéro
              </Button>
              <Button
                type="button"
                variant={draftOutcome === 'OTHER' ? 'default' : 'outline'}
                onClick={() => {
                  setDraftOutcome('OTHER');
                  commentRef.current?.focus();
                }}
              >
                Autre
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={validate} disabled={send.isPending}>
                Enregistrer l’issue (
                {draftOutcome === 'WRONG_NUMBER'
                  ? 'Mauvais numéro'
                  : draftOutcome === 'OTHER'
                    ? 'Autre'
                    : 'Ne répond pas'}
                )<Kbd>Entrée</Kbd>
              </Button>
            </div>
          </div>
        )}

        {conversion === null ? null : (
          <>
            <EnvoiLienFormulaire prospect={prospect} email={conversion.email} />

            <ConversionFields
              draft={conversion}
              errors={conversionErrors}
              phoneE164={prospect.phoneE164}
              disabled={send.isPending}
              reglages={formulaire.champs}
              libres={formulaire.libres}
              onChange={(patch) => {
                setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
              }}
            />
          </>
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

        <Commentaire
          value={comment}
          obligatoire={draftOutcome === 'OTHER'}
          inputRef={commentRef}
          onChange={setComment}
          onValidate={validate}
        />

        {draftOutcome !== 'UNREACHABLE' ? null : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={validate} disabled={send.isPending}>
              Enregistrer l’appel injoignable
              <Kbd>Entrée</Kbd>
            </Button>
          </div>
        )}

        {conversion === null ? null : (
          <div className="flex flex-wrap gap-2 pt-2">
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
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Button variant="ghost" className="self-start px-0" onClick={onAbandon}>
        <ArrowLeftIcon aria-hidden="true" />
        Revenir à la liste
      </Button>

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
            ([keys]) => projet === 'CHUES' || (keys !== 'N' && keys !== 'R'),
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
