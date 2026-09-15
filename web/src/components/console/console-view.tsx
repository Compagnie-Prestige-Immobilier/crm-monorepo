'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CopyIcon,
  PhoneIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { BrouillonEnAttente } from '@/components/console/brouillon-en-attente';
import { Chrono, copyPhone, Kbd } from '@/components/console/console-ui';
import { ConversionFields, type SaisieTelephone } from '@/components/console/conversion-fields';
import { EnvoiLienFormulaire } from '@/components/console/envoi-lien-formulaire';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { FiltreOrigine } from '@/components/grand-public/filtre-origine';
import { BoutonWhatsApp, type FicheContactable } from '@/components/prospects/bouton-whatsapp';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
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
  type ChampReglable,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import { enregistrerBrouillon, ouvrirFiche, type OuvertureFiche } from '@/lib/data/ouvertures';
import { PaliersStatut, Palier, type Choix } from '@/components/console/console-paliers';
import {
  commentaireExigePar,
  issueDuMotif,
  fetchMotifsAppel,
  motifsRacine,
  sousMotifsDe,
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
import { CALL_OUTCOME_LABELS, PHASE2_STATUS_LABELS, type ProspectRow } from '@/lib/types';
import { useBrouillonAuto } from '@/lib/use-brouillon-auto';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

type Projet = 'CHUES' | 'GRAND_PUBLIC';

/** Seule issue encore atteignable au clavier une fois le dossier ouvert (EB-10). */
const RAPPEL_KEY = '2';

const GROUPES = [
  { cle: 'joignable', label: 'Joignable' },
  { cle: 'injoignable', label: 'Injoignable' },
] as const;

type Groupe = (typeof GROUPES)[number]['cle'];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1 … 9', 'Statut au choix'],
  ['1 … 6', 'Échéance proposée'],
  ['0', 'Autre échéance'],
  ['Entrée', 'Valider'],
  ['Échap', 'Revenir'],
  ['C', 'Copier le numéro'],
  ['N', 'Ajouter un prospect'],
  ['R', 'Fiche représentant'],
  ['?', 'Carte clavier'],
];

/**
 * La codification des leads, repli quand le référentiel ne répond pas
 * (docs/decisions/codification-leads.md). Le code tient lieu d'identifiant.
 */
const motifDeRepli = (
  code: string,
  label: string,
  effect: MotifAppel['effect'],
  options: Partial<Pick<MotifAppel, 'countsAsReached' | 'requiresCallback' | 'parentId'>> = {},
): MotifAppel => ({
  id: code,
  code,
  label,
  effect,
  requiresComment: false,
  requiresCallback: false,
  countsAsReached: true,
  parentId: null,
  ...options,
});

const NON_JOINT = { countsAsReached: false } as const;
const AVEC_DATE = { requiresCallback: true } as const;

export const MOTIFS_SYSTEME: readonly MotifAppel[] = [
  motifDeRepli('MESSAGERIE', 'Boîte vocale', 'KEEP_OPEN', NON_JOINT),
  motifDeRepli('PAS_DE_REPONSE', 'NRP', 'KEEP_OPEN', NON_JOINT),
  motifDeRepli('WRONG_NUMBER', 'Faux numéro', 'CLOSE_WRONG_NUMBER', NON_JOINT),
  motifDeRepli('AUTRE_NON_JOINT', 'Autre injoignable', 'KEEP_OPEN', NON_JOINT),
  motifDeRepli('INTERESSE', 'Intéressé', 'KEEP_OPEN'),
  motifDeRepli('TERRAIN', 'Terrain', 'KEEP_OPEN', { parentId: 'INTERESSE' }),
  motifDeRepli('VILLA', 'Villa', 'KEEP_OPEN', { parentId: 'INTERESSE' }),
  motifDeRepli('CONSTRUCTION', 'Construction', 'KEEP_OPEN', { parentId: 'INTERESSE' }),
  motifDeRepli('FORMALITES_DOMANIALES', 'Formalités domaniales', 'KEEP_OPEN', {
    parentId: 'INTERESSE',
  }),
  motifDeRepli('PAS_INTERESSE', 'Pas intéressé', 'CLOSE_REFUSED'),
  motifDeRepli('HESITANT', 'Hésitant', 'KEEP_OPEN'),
  motifDeRepli('CALLBACK', 'À rappeler', 'SCHEDULE_CALLBACK', AVEC_DATE),
  motifDeRepli('DEMANDE_INFORMATION', 'Demande d’information', 'KEEP_OPEN'),
  motifDeRepli('PARTENARIAT', 'Demande de partenariat', 'KEEP_OPEN'),
  motifDeRepli('A_SUPPRIMER', 'À supprimer', 'CLOSE_LOST'),
  motifDeRepli('RENDEZ_VOUS', 'Rendez-vous', 'SCHEDULE_CALLBACK', AVEC_DATE),
  motifDeRepli('RV_CPI', 'RV CPI', 'SCHEDULE_CALLBACK', { ...AVEC_DATE, parentId: 'RENDEZ_VOUS' }),
  motifDeRepli('RV_SITE', 'RV site', 'SCHEDULE_CALLBACK', {
    ...AVEC_DATE,
    parentId: 'RENDEZ_VOUS',
  }),
  motifDeRepli('RV_EXTERNE', 'RV externe', 'SCHEDULE_CALLBACK', {
    ...AVEC_DATE,
    parentId: 'RENDEZ_VOUS',
  }),
  motifDeRepli('RDV_TELEPHONIQUE', 'RV téléphonique', 'SCHEDULE_CALLBACK', {
    ...AVEC_DATE,
    parentId: 'RENDEZ_VOUS',
  }),
];

/** Injoignable : l'appel ne compte pas comme joint. Le faux numéro en fait partie. */
const estInjoignable = (item: MotifAppel): boolean => !item.countsAsReached;

/** Les statuts de premier niveau d'un appel où la personne a répondu. */
export const statutsJoignables = (catalogue: readonly MotifAppel[]): MotifAppel[] =>
  motifsRacine(catalogue).filter((item) => !estInjoignable(item) && item.effect !== 'CLOSE_METHOD');

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

const nouveauHref = (): string => '/teleconseil/prospects';

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
  projet = null,
  viewerId,
  origineFiltrable = false,
  canCreateProspect = false,
  plateforme = false,
}: {
  projet?: Projet | null;
  /** Le lecteur : « Ajoutés par moi » se borne à ses saisies. */
  viewerId?: string | undefined;
  /** Seul celui à qui une campagne confie des fiches a deux provenances à départager. */
  origineFiltrable?: boolean | undefined;
  canCreateProspect?: boolean | undefined;
  /** Les fiches venues des plateformes, partagées entre les CCP, la plus récente d'abord. */
  plateforme?: boolean | undefined;
}) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [ouverte, setOuverte] = useState<Ouverte | null>(null);
  const [vise, setVise] = useState<ProspectRow | null>(null);
  const [demandee, setDemandee] = useState<string | null>(searchParams.get('fiche'));
  const [search, setSearch] = useState('');
  const origineInitiale = origineInitialePour(projet);
  const [origine, setOrigine] = useState<OrigineFiche>(origineInitiale);
  const [resteAAppeler, setResteAAppeler] = useState(true);
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();
  const seulementARappeler = filtreResteAAppeler(resteAAppeler, cherche);

  const parLien = useQuery({
    queryKey: queryKeys.prospect(demandee ?? ''),
    queryFn: () => fetchProspect(demandee ?? ''),
    enabled: demandee !== null,
    retry: false,
  });

  const venuDesRappels = fichePendante(demandee, parLien.data);
  const { aConfirmer, consultee } = deriverFiches(vise, ouverte, venuDesRappels);

  const annuaire = useAnnuaireAQualifier({
    projet,
    cherche,
    origine,
    viewerId,
    seulementARappeler,
    plateforme,
    enabled: pasDeFicheOuverte(consultee, aConfirmer),
  });

  const revenir = useCallback(() => {
    setOuverte(null);
    setVise(null);
    setDemandee(null);
  }, []);

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
        projet={consultee.prospect.projet}
        canCreateProspect={canCreateProspect}
        onAbandon={revenir}
        onEnregistre={(nom, detailStatut) => {
          const text = texteConfirmationAppel(nom, detailStatut);
          setConfirme(text);
          toast.success(text);
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
      <ContexteFile projet={projet} />
      <EnTeteAnnuaire
        lienEnEchec={demandee !== null && parLien.isError}
        confirme={confirme}
        cherche={cherche}
        search={search}
        projet={projet}
        plateforme={plateforme}
        origine={origineAffichee(origineFiltrable, origine)}
        resteAAppeler={resteAAppeler}
        total={totalAffiche(annuaire.data)}
        onSearch={setSearch}
        onOrigine={setOrigine}
        onResteAAppeler={setResteAAppeler}
      />

      <ListeAnnuaire
        annuaire={annuaire}
        cherche={cherche}
        canCreateProspect={canCreateProspect}
        seulementARappeler={seulementARappeler}
        plateforme={plateforme}
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
        description={texteEnCours(aConfirmer)}
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

function ContexteFile({ projet }: { projet: Projet | null }) {
  if (projet !== null) {
    return (
      <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <ProjetBadge projet={projet} />
        <span>Les fiches de ce projet</span>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
      <ProjetBadge projet="CHUES" />
      <ProjetBadge projet="GRAND_PUBLIC" />
      <span>Une seule file pour les deux projets</span>
    </p>
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
  plateforme,
  origine,
  resteAAppeler,
  total,
  onSearch,
  onOrigine,
  onResteAAppeler,
}: {
  lienEnEchec: boolean;
  confirme: string | null;
  cherche: string;
  search: string;
  projet: Projet | null;
  plateforme: boolean;
  /** Nul quand rien n'est confié au lecteur : il n'a qu'une provenance. */
  origine: OrigineFiche | null;
  resteAAppeler: boolean;
  /** Le nombre de fiches de la liste affichée, nul tant qu'elle n'est pas lue. */
  total: number | null;
  onSearch: (value: string) => void;
  onOrigine: (value: OrigineFiche) => void;
  onResteAAppeler: (value: boolean) => void;
}) {
  let texteAide: string;
  if (cherche !== '') texteAide = 'Choisissez qui vous venez d’appeler.';
  else if (plateforme)
    texteAide =
      'Tous les inscrits des plateformes, les plus récents d’abord. Une fiche « en cours » est déjà au téléphone chez un collègue.';
  else if (projet === null)
    texteAide = 'Vos fiches CHUES et Grand Public, y compris celles confiées par une campagne.';
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
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-[0.875rem] font-[600] text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
            REVELE,
          )}
        >
          <CheckCircle2Icon
            className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <span>{confirme}</span>
        </div>
      )}

      <ChampAnnuaire value={search} onChange={onSearch} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Fiches affichées">
          {(
            [
              [true, 'Reste à appeler'],
              [false, 'Toutes'],
            ] as const
          ).map(([valeur, libelle]) => (
            <Button
              key={libelle}
              type="button"
              size="sm"
              variant={resteAAppeler === valeur ? 'default' : 'outline'}
              aria-pressed={resteAAppeler === valeur}
              onClick={() => {
                onResteAAppeler(valeur);
              }}
            >
              {libelle}
              {resteAAppeler === valeur && total !== null && cherche === '' ? (
                <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-[0.75rem] tabular-nums">
                  {total}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
        {origine === null ? null : <FiltreOrigine value={origine} onChange={onOrigine} />}
        <p className="text-[0.8125rem] text-muted-foreground">{texteAide}</p>
      </div>
    </>
  );
}

/** La fiche et l'ouverture qui la mesure. Nulle quand la fiche est close. */
interface Ouverte {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
}

const nomDe = (prospect: ProspectRow): string => `${prospect.nom} ${prospect.prenom}`;

const texteEnCours = (row: ProspectRow | null): string | null =>
  row?.enCoursPar == null ? null : `${row.enCoursPar} a cette fiche ouverte en ce moment.`;

const origineAffichee = (filtrable: boolean, origine: OrigineFiche): OrigineFiche | null =>
  filtrable ? origine : null;

function useAnnuaireAQualifier(criteres: {
  projet: Projet | null;
  cherche: string;
  origine: OrigineFiche;
  viewerId: string | undefined;
  seulementARappeler: boolean;
  plateforme: boolean;
  enabled: boolean;
}) {
  const { projet, cherche, origine, viewerId, seulementARappeler, plateforme } = criteres;
  return useQuery({
    queryKey: [
      ...queryKeys.prospectsRoot,
      'a-qualifier',
      projet,
      cherche,
      origine,
      seulementARappeler,
      plateforme,
    ] as const,
    queryFn: () =>
      fetchProspectsAQualifier({
        projet,
        search: cherche,
        origine,
        viewerId,
        resteAAppeler: seulementARappeler,
        plateforme,
      }),
    enabled: criteres.enabled,
    placeholderData: (previous) => previous,
    // Deux CCP sur le même lot : « en cours par » doit se voir sans recharger.
    refetchInterval: plateforme ? 30_000 : false,
  });
}

const origineInitialePour = (projet: Projet | null): OrigineFiche =>
  projet === 'GRAND_PUBLIC' ? 'CAMPAGNE' : 'TOUS';

const texteConfirmationAppel = (nom: string, detailStatut?: string): string =>
  detailStatut
    ? `Appel consigné pour ${nom} · Statut : ${detailStatut}`
    : `Appel consigné pour ${nom}`;

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

/** Une recherche vise une fiche précise, déjà appelée ou non. */
function totalAffiche(page: { total: number } | undefined): number | null {
  return page === undefined ? null : page.total;
}

function filtreResteAAppeler(resteAAppeler: boolean, cherche: string): boolean {
  return resteAAppeler && cherche === '';
}

function texteListeVide(cherche: string, seulementARappeler: boolean): string {
  if (cherche !== '') return 'Aucun résultat. Vérifiez le nom ou le numéro.';
  if (seulementARappeler)
    return 'Rien ne reste à appeler. Affichez toutes vos fiches, ou demandez une campagne à votre superviseur.';
  return 'Aucune fiche ne vous est attribuée. Ajoutez un prospect, ou demandez une campagne à votre superviseur.';
}

function ListeAnnuaire({
  annuaire,
  cherche,
  canCreateProspect,
  seulementARappeler,
  plateforme,
  onChoisir,
}: {
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchProspectsAQualifier>>>;
  cherche: string;
  canCreateProspect: boolean;
  seulementARappeler: boolean;
  plateforme: boolean;
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
        <p className="text-[0.9375rem]">{texteListeVide(cherche, seulementARappeler)}</p>
        {canCreateProspect ? (
          <Link href={nouveauHref()} className={cn(buttonVariants(), 'self-start')}>
            Ajouter un prospect
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom et prénom</TableHead>
          <TableHead>Projet</TableHead>
          <TableHead>Numéro</TableHead>
          {plateforme ? <TableHead>Inscrit le</TableHead> : null}
          <TableHead>Statut / Qualification</TableHead>
          <TableHead>Dernier appel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {annuaire.data.items.map((row) => {
          return (
            <TableRow key={row.id}>
              <TableCell>
                <button
                  type="button"
                  onClick={() => {
                    onChoisir(row);
                  }}
                  className={CLASSE_CHOIX}
                >
                  <NomProspect row={row} />
                </button>
                {row.enCoursPar == null ? null : (
                  <Badge variant="warning">En cours · {row.enCoursPar}</Badge>
                )}
              </TableCell>
              <TableCell>
                <ProjetBadge projet={row.projet} />
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-[0.875rem]">
                {formatPhone(row.phoneE164)}
              </TableCell>
              {plateforme ? (
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {row.plateformeDepuis == null ? '' : formatDateTime(row.plateformeDepuis)}
                </TableCell>
              ) : null}
              <TableCell>
                <StatutAnnuaire row={row} />
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

function variantDuCode(code: string | null): 'success' | 'destructive' | 'warning' | 'info' {
  if (code === 'METHOD_OBTAINED') return 'success';
  if (code === 'REFUSED' || code === 'WRONG_NUMBER') return 'destructive';
  if (code === 'CALLBACK') return 'warning';
  return 'info';
}

function StatutAnnuaire({ row }: { row: ProspectRow }) {
  if (row.lastAttemptAt === null)
    return <span className="text-[0.8125rem] text-muted-foreground">Non qualifié</span>;
  const label =
    row.lastReasonLabel ?? (row.lastOutcome ? CALL_OUTCOME_LABELS[row.lastOutcome] : 'Qualifié');
  const variant = variantDuCode(
    row.phase2Status === 'METHOD_OBTAINED' ? row.phase2Status : row.lastOutcome,
  );

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={variant} className="w-fit">
        {label}
      </Badge>
      {row.lastAttemptAt ? (
        <span className="text-[0.75rem] text-muted-foreground">
          {formatDateTime(row.lastAttemptAt)}
        </span>
      ) : null}
      {row.lastComment ? (
        <span
          className="max-w-xs truncate text-[0.75rem] text-muted-foreground"
          title={row.lastComment}
        >
          « {row.lastComment} »
        </span>
      ) : null}
    </div>
  );
}

function NomProspect({ row }: { row: ProspectRow }) {
  return (
    <>
      <span className="truncate">
        {row.nom} {row.prenom}
      </span>
      {row.phase2Status === 'PENDING' ? null : (
        <Badge variant={variantDuCode(row.phase2Status)} className="shrink-0 font-[400]">
          {PHASE2_STATUS_LABELS[row.phase2Status]}
        </Badge>
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
  seulement,
  envoiLien = true,
  onChange,
}: {
  ouvert: boolean;
  prospect: FicheContactable;
  conversion: ConversionDraft | null;
  errors: ConversionErrors;
  telephone?: SaisieTelephone | undefined;
  disabled: boolean;
  formulaire: { champs: readonly ReglageChamp[]; libres: readonly ChampLibre[] };
  seulement?: readonly ChampReglable[] | undefined;
  envoiLien?: boolean | undefined;
  onChange: (patch: Partial<ConversionDraft>) => void;
}) {
  if (!ouvert || conversion === null) return null;

  return (
    <>
      <p className="text-[0.8125rem] font-[600] text-muted-foreground">
        Formulaire, tout est facultatif. Une méthode d’enrôlement renseignée vaut adhésion.
      </p>

      {envoiLien ? <EnvoiLienFormulaire prospect={prospect} email={conversion.email} /> : null}

      <ConversionFields
        draft={conversion}
        errors={errors}
        phoneE164={prospect.phoneE164}
        telephone={telephone}
        disabled={disabled}
        reglages={formulaire.champs}
        libres={formulaire.libres}
        seulement={seulement}
        champsFacultatifs
        onChange={onChange}
      />
    </>
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
type Etape = 'issues' | 'motifs' | 'statut' | 'echeance' | null;

function etapeCourante(slots: readonly CallbackSlot[] | null, groupe: Groupe | null): Etape {
  if (slots !== null) return 'echeance';
  return groupe === null ? 'issues' : 'motifs';
}

/** Les statuts de premier niveau du groupe ouvert. */
function statutsDuGroupe(catalogue: readonly MotifAppel[], groupe: Groupe | null): MotifAppel[] {
  if (groupe === null) return [];
  if (groupe === 'injoignable') return motifsRacine(catalogue).filter(estInjoignable);
  return statutsJoignables(catalogue);
}

const choixDe = (item: MotifAppel, actif: boolean, choisir: () => void): Choix => ({
  cle: item.code,
  label: item.label,
  actif,
  choisir,
});

const precisionsDe = (catalogue: readonly MotifAppel[], statut: MotifAppel | null): MotifAppel[] =>
  statut === null ? [] : sousMotifsDe(catalogue, statut.id);

/**
 * Le motif consigné est la précision quand il y en a une, sinon le statut. Une
 * méthode d'enrôlement renseignée dans le formulaire vaut adhésion : elle clôt
 * la fiche et dispense de l'échéance.
 */
function qualificationDe(
  statut: MotifAppel | null,
  precision: MotifAppel | null,
  conversion: ConversionDraft | null,
): { motif: MotifAppel | null; adhesion: boolean; rappelDemande: boolean } {
  const motif = precision ?? statut;
  const adhesion = conversion?.method != null;
  return { motif, adhesion, rappelDemande: !adhesion && motif?.requiresCallback === true };
}

function draftDe(
  choisi: MotifAppel,
  callbackAt: string | null,
  conversion: ConversionDraft | null,
  comment: string,
  ouverture: OuvertureFiche | null,
): AttemptDraft {
  const method = conversion?.method ?? null;
  return {
    outcome: method === null ? issueDuMotif(choisi) : 'METHOD_OBTAINED',
    reasonCode: choisi.code,
    method,
    comment,
    callbackAt,
    ...(conversion === null ? {} : { conversion }),
    ...(ouverture === null ? {} : { ouvertureId: ouverture.id }),
  };
}

function problemesDuDossier(
  conversion: ConversionDraft | null,
  formulaire: { champs: readonly ReglageChamp[]; libres: readonly ChampLibre[] },
): ConversionErrors {
  if (conversion === null) return {};
  return validateConversion(conversion, Date.now(), formulaire.champs, formulaire.libres, true);
}

function etatDe(
  slots: readonly CallbackSlot[] | null,
  adhesion: boolean,
  groupe: Groupe | null,
  statut: MotifAppel | null,
  comment: string,
): { echeanceOuverte: boolean; etape: Etape; saisieEnCours: boolean } {
  const echeanceOuverte = slots !== null && !adhesion;
  return {
    echeanceOuverte,
    etape: etapeCourante(echeanceOuverte ? slots : null, groupe),
    saisieEnCours: statut !== null || comment !== '' || slots !== null,
  };
}

const raccourcisDe = (choix: readonly Choix[]): Record<string, () => void> =>
  Object.fromEntries(choix.slice(0, 9).map((item, rang) => [String(rang + 1), item.choisir]));

/**
 * La consignation d'un appel, en deux temps : d'abord si la personne était
 * joignable, puis, si oui, son dossier et la manière dont elle adhère.
 */
export function Consignation({
  prospect,
  ouverture,
  projet,
  canCreateProspect,
  onAbandon,
  onEnregistre,
}: {
  prospect: ProspectRow;
  ouverture: OuvertureFiche | null;
  projet: Projet;
  canCreateProspect: boolean;
  onAbandon: () => void;
  onEnregistre: (nom: string, detailStatut?: string) => void;
}) {
  const router = useRouter();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);

  const [repris] = useState(() => lireBrouillon(ouverture?.draft));
  const [comment, setComment] = useState(repris.comment);
  // Un brouillon repris vient d'un appel où la personne répondait : la question
  // « joignable ? » est déjà tranchée, la reposer effacerait ce qu'il porte.
  const [groupe, setGroupe] = useState<Groupe | null>(() =>
    repris.conversion === null ? null : 'joignable',
  );
  const [statut, setStatut] = useState<MotifAppel | null>(null);
  const [precision, setPrecision] = useState<MotifAppel | null>(null);
  const [conversion, setConversion] = useState<ConversionDraft | null>(repris.conversion);
  // Le formulaire rempli survit à un passage par « Injoignable ».
  const [dossierMisDeCote, setDossierMisDeCote] = useState<ConversionDraft | null>(null);
  const [conversionErrors, setConversionErrors] = useState<ConversionErrors>({});
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const formulaire = useChampsConversion(projet);
  const motifs = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    staleTime: 300_000,
  });
  const catalogue = motifs.data ?? MOTIFS_SYSTEME;

  const nomComplet = nomDe(prospect);
  const [now] = useState(() => Date.now());

  const { depuis: departChrono, enAttente: brouillonEnAttente } = useBrouillonAuto(
    ouverture,
    brouillonDe(comment, conversion),
  );

  const send = useMutation({
    mutationFn: async (draft: AttemptDraft) => {
      // EB-10 : le brouillon part AVANT la tentative, qui referme l'ouverture et
      // ferait refuser toute écriture postérieure. Le dossier passe par lui et
      // non par la tentative : incomplet, le serveur la refuserait en 400.
      const garderBrouillon =
        draft.outcome === 'CALLBACK' || (draft.method === null && conversion !== null);
      if (garderBrouillon && ouverture !== null) {
        // La borne vient d'ici et non de l'horloge du serveur : la base exige
        // qu'elle suive `openedAt`, qui est l'heure de ce navigateur.
        await enregistrerBrouillon(
          ouverture.id,
          brouillonDe(draft.comment, conversion),
          departChrono ?? new Date().toISOString(),
        );
      }
      return pushCallAttempt(newAttemptInput(prospect.id, draft));
    },
    onSuccess: () => {
      onEnregistre(nomComplet, (precision ?? statut)?.label ?? 'Qualifié');
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

  const { motif, adhesion, rappelDemande } = qualificationDe(statut, precision, conversion);

  const record = useCallback(
    (choisi: MotifAppel, callbackAt: string | null = null) => {
      if (send.isPending) return;
      const draft = draftDe(choisi, callbackAt, conversion, comment, ouverture);
      const problem = validateAttempt(draft, Date.now(), choisi.requiresComment);
      if (problem !== null) {
        toast.error(problem);
        return;
      }
      const problems = problemesDuDossier(conversion, formulaire);
      setConversionErrors(problems);
      if (Object.keys(problems).length > 0) return;
      send.mutate(draft);
    },
    [send, comment, ouverture, conversion, formulaire],
  );

  const startCallback = useCallback(() => {
    setFreeCallback('');
    setSlots(callbackSlots(Date.now()));
  }, []);

  const poser = useCallback(
    (choisi: MotifAppel) => {
      if (choisi.requiresCallback && !adhesion) startCallback();
      else setSlots(null);
    },
    [adhesion, startCallback],
  );

  const validate = useCallback(() => {
    if (motif === null) {
      toast.error('Choisissez un statut de qualification.');
      return;
    }
    if (slots !== null && !adhesion) {
      const iso = dakarLocalToIso(freeCallback);
      if (iso === null) {
        toast.error('Choisissez une échéance, ou saisissez sa date et son heure.');
        return;
      }
      record(motif, iso);
      return;
    }
    if (rappelDemande) {
      startCallback();
      return;
    }
    record(motif);
  }, [motif, slots, adhesion, freeCallback, record, rappelDemande, startCallback]);

  const { echeanceOuverte, etape, saisieEnCours } = etatDe(
    slots,
    adhesion,
    groupe,
    statut,
    comment,
  );

  const annuler = (): void => {
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
    setGroupe(null);
    setStatut(null);
    setPrecision(null);
    setComment('');
    setConversion(null);
    setDossierMisDeCote(null);
    setConversionErrors({});
    commentRef.current?.blur();
  };

  // Joignable ouvre le formulaire, tout facultatif ; injoignable le met de côté.
  const choisirGroupe = (choisi: Groupe): void => {
    setGroupe(choisi);
    setStatut(null);
    setPrecision(null);
    setSlots(null);
    setFreeCallback('');
    setConversionErrors({});
    if (choisi === 'joignable') {
      setConversion(conversion ?? dossierMisDeCote ?? conversionFrom(prospect));
      return;
    }
    if (conversion !== null) setDossierMisDeCote(conversion);
    setConversion(null);
  };

  const choisirStatut = (choisi: MotifAppel): void => {
    setStatut(choisi);
    setPrecision(null);
    poser(choisi);
  };

  const choisirPrecision = (choisi: MotifAppel): void => {
    setPrecision(choisi);
    poser(choisi);
  };

  const groupes: Choix[] = GROUPES.map((item) => ({
    cle: item.cle,
    label: item.label,
    actif: groupe === item.cle,
    choisir: () => {
      choisirGroupe(item.cle);
    },
  }));
  const statuts = statutsDuGroupe(catalogue, groupe).map((item) =>
    choixDe(item, statut?.code === item.code, () => {
      choisirStatut(item);
    }),
  );
  const precisions = precisionsDe(catalogue, statut).map((item) =>
    choixDe(item, precision?.code === item.code, () => {
      choisirPrecision(item);
    }),
  );

  const slotShortcuts: Record<string, () => void> = Object.fromEntries(
    (slots ?? []).map((slot) => [
      slot.key,
      () => {
        if (motif !== null) record(motif, slot.at);
      },
    ]),
  );
  slotShortcuts['0'] = () => {
    callbackRef.current?.focus();
  };

  // Les chiffres visent le dernier palier ouvert : le groupe, le statut, sa précision, ou l'échéance.
  let palierOuvert = groupes;
  if (etape === 'motifs') palierOuvert = precisions.length > 0 ? precisions : statuts;
  const digitShortcuts = etape === 'echeance' ? slotShortcuts : raccourcisDe(palierOuvert);

  useShortcuts({
    ...digitShortcuts,
    Enter: validate,
    Escape: annuler,
    c: () => {
      copyPhone(prospect.phoneE164);
    },
    n: () => {
      if (!canCreateProspect) return;
      const rep = prospect.representantId;
      if (rep) router.push(`/teleconseil/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
    },
    r: () => {
      const rep = prospect.representantId;
      if (rep) router.push(`/teleconseil/representants/${encodeURIComponent(rep)}`);
    },
    '?': () => {
      setHelpOpen((open) => !open);
    },
  });

  function corpsFiche(): React.ReactNode {
    return (
      <section aria-label="Fiche courante" className="flex flex-col gap-5">
        <EnTeteConsignation
          rappelOuvert={echeanceOuverte}
          prospect={prospect}
          nomComplet={nomComplet}
          projet={projet}
          motif={motif}
          surDossier={conversion !== null}
        />

        <Palier
          question="Avez-vous eu la personne au téléphone ?"
          choix={groupes}
          raccourcis={groupe === null}
          vide=""
          disabled={send.isPending}
        />

        <PanneauDossier
          ouvert={groupe === 'joignable' && !echeanceOuverte}
          prospect={prospect}
          conversion={conversion}
          errors={conversionErrors}
          disabled={send.isPending}
          formulaire={formulaire}
          onChange={(patch) => {
            setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
          }}
        />

        {groupe === null ? null : (
          <PaliersStatut
            joignable={groupe === 'joignable'}
            statuts={statuts}
            precisions={precisions}
            raccourcis={etape === 'motifs'}
            disabled={send.isPending}
          />
        )}

        <MotifSelectionne motif={motif} rappelOuvert={echeanceOuverte} />

        {echeanceOuverte && slots !== null ? (
          <PanneauEcheance
            slots={slots}
            now={now}
            freeCallback={freeCallback}
            surDossier={conversion !== null}
            titre={titreEcheance(motif?.code)}
            disabled={send.isPending}
            inputRef={callbackRef}
            onChoisir={(at) => {
              if (motif !== null) record(motif, at);
            }}
            onFreeCallback={setFreeCallback}
            onValidate={validate}
          />
        ) : null}

        {groupe === null ? null : (
          <Commentaire
            value={comment}
            titre={echeanceOuverte ? 'Commentaire du rappel' : 'Commentaire'}
            obligatoirePour={commentaireExigePar(motif)}
            inputRef={commentRef}
            onChange={setComment}
            onValidate={validate}
          />
        )}

        <PiedAppel
          etape={etape}
          disabled={send.isPending}
          statutPose={motif !== null}
          onValidate={validate}
          onAbandon={onAbandon}
        />
      </section>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5">
      <Button variant="ghost" className="self-start px-0" onClick={onAbandon}>
        <ArrowLeftIcon aria-hidden="true" />
        Revenir à la liste
      </Button>

      <ChronoDemarre demarre={departChrono} />
      <BrouillonEnAttente enAttente={brouillonEnAttente} />

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

/** Le chronomètre ne tourne qu'une fois la saisie commencée. */
function ChronoDemarre({ demarre }: { demarre: string | null }) {
  if (demarre === null) return null;
  return <Chrono firstInputAt={demarre} />;
}

/** L'identité de la fiche : qui on appelle, son numéro, et ce qu'on en sait. */
function EnTeteFiche({
  prospect,
  nomComplet,
  projet,
  surDossier,
}: {
  prospect: ProspectRow;
  nomComplet: string;
  projet: Projet;
  surDossier: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ProjetBadge projet={projet} />
        <span className="text-sm font-semibold text-muted-foreground">Fiche à consigner</span>
      </div>
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

      {prospect.phase2Status !== 'PENDING' ? (
        <div
          role="status"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          Déjà classée : {PHASE2_STATUS_LABELS[prospect.phase2Status].toLowerCase()}.
        </div>
      ) : null}
    </>
  );
}

function EnTeteRappel({
  prospect,
  nomComplet,
  motif,
  projet,
}: {
  prospect: ProspectRow;
  nomComplet: string;
  motif: MotifAppel | null;
  projet: Projet;
}) {
  return (
    <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <CalendarClockIcon aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.75rem] font-[700] tracking-[0.08em] text-amber-700 uppercase dark:text-amber-300">
              {motif?.code === 'RDV_AGENCE' ? 'Rendez-vous d’information' : 'Rappel téléphonique'}
            </p>
            <ProjetBadge projet={projet} />
          </div>
          <h2 className="mt-0.5 font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            {nomComplet}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[0.9375rem] text-muted-foreground">
            <PhoneIcon className="size-4" aria-hidden="true" />
            <span className="select-all font-[600] text-foreground">
              {formatPhone(prospect.phoneE164)}
            </span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-[0.8125rem] text-muted-foreground">
        Choisissez le jour et l’heure, puis ajoutez une note utile pour le prochain appel.
      </p>
    </div>
  );
}

function EnTeteConsignation({
  rappelOuvert,
  prospect,
  nomComplet,
  projet,
  motif,
  surDossier,
}: {
  rappelOuvert: boolean;
  prospect: ProspectRow;
  nomComplet: string;
  projet: Projet;
  motif: MotifAppel | null;
  surDossier: boolean;
}) {
  if (rappelOuvert)
    return (
      <EnTeteRappel prospect={prospect} nomComplet={nomComplet} motif={motif} projet={projet} />
    );
  return (
    <EnTeteFiche
      prospect={prospect}
      nomComplet={nomComplet}
      projet={projet}
      surDossier={surDossier}
    />
  );
}

function MotifSelectionne({
  motif,
  rappelOuvert,
}: {
  motif: MotifAppel | null;
  rappelOuvert: boolean;
}) {
  if (motif === null || rappelOuvert) return null;
  return (
    <p role="status" className="text-[0.8125rem] text-muted-foreground">
      Motif sélectionné : <span className="font-[600] text-foreground">{motif.label}</span>.
      Vérifiez la note, puis enregistrez l’appel.
    </p>
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
  if (etape !== 'motifs' && etape !== 'statut' && etape !== 'echeance') return null;
  if (etape === 'motifs' && !statutPose) return null;
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

const titreEcheance = (code: string | undefined): string => {
  if (code === 'RDV_TELEPHONIQUE') return 'Date et heure du rendez-vous téléphonique';
  if (code === 'RV_CPI' || code === 'RV_SITE' || code === 'RV_EXTERNE' || code === 'RENDEZ_VOUS') {
    return 'Date et heure du rendez-vous';
  }
  return 'Échéance du rappel';
};

/** L'échéance d'EB-10 : elle s'ouvre aussi PAR-DESSUS un dossier déjà rempli. */
export function PanneauEcheance({
  slots,
  now,
  freeCallback,
  surDossier,
  titre,
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
  titre?: string;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChoisir: (at: string) => void;
  onFreeCallback: (value: string) => void;
  onValidate: () => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        {titre ?? 'Quand rappeler'}
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
  titre = 'Commentaire',
  obligatoirePour,
  inputRef,
  onChange,
  onValidate,
}: {
  value: string;
  titre?: string;
  /** Le statut qui réclame le commentaire, nul quand il reste facultatif. */
  obligatoirePour: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onValidate: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-comment" className="text-[0.875rem] font-[600]">
        {titre}
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
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          onValidate();
        }}
        placeholder="Entrée valide, Maj+Entrée passe à la ligne."
      />
    </div>
  );
}
