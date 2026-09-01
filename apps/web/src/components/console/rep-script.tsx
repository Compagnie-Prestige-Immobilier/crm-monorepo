'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, CalendarIcon, CopyIcon, PencilIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { copyPhone } from '@/components/console/console-ui';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  buildRepAttempt,
  buildRepQueue,
  callbackHalfHours,
  callbackSlots,
  fetchRepScriptQueue,
  formatCallbackAt,
  pushRepCallAttempt,
  repRelationSettled,
  repScriptKeys,
  type RepAnswer,
} from '@/lib/data/console';
import { fetchRepresentants, type ScriptedRepresentant } from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantFilters } from '@/lib/representant-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

/**
 * Ce que l'appel a donné : les TROIS issues du mobile, et rien d'autre.
 * `WRONG_NUMBER` reste lisible sur les appels déjà consignés — il n'est
 * simplement plus proposé à la saisie ; corriger un numéro faux se fait sur la
 * fiche, ce n'est pas le résultat d'un appel.
 */
type Resultat = 'JOIGNABLE' | 'RAPPEL' | 'INJOIGNABLE';

const RESULTATS: readonly { valeur: Resultat; label: string }[] = [
  { valeur: 'JOIGNABLE', label: 'Joignable' },
  { valeur: 'RAPPEL', label: 'À rappeler' },
  { valeur: 'INJOIGNABLE', label: 'Injoignable' },
];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['C', 'Copier le numéro'],
  ['E', 'Corriger la fiche'],
  ['Échap', 'Revenir en arrière'],
];

const digitsOf = (value: string): number => value.replace(/\D/gu, '').length;

function recapOuiNon(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? 'Oui' : 'Non';
}

function recapEtablissement(confirme: boolean | null, nouvel: string): string | null {
  if (confirme === null) return null;
  if (confirme) return 'Confirmé';
  return nouvel.trim() === '' ? 'À corriger' : nouvel.trim();
}

interface JoignableState {
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  ambassadeur: boolean | null;
  numeroConfirme: boolean | null;
  nouveauNumero: string;
  memeWhatsapp: boolean | null;
  whatsapp: string;
}

/** Le script joignable, dans l'ordre : chaque réponse manquante bloque la suivante. */
function manqueJoignable(s: JoignableState): string | null {
  if (s.etablissementConfirme === null) return 'Dites si l’établissement est confirmé';
  if (s.etablissementConfirme === false && s.nouvelEtablissement.trim() === '') {
    return 'Écrivez le nouvel établissement';
  }
  if (s.contacte === null) return 'Dites s’il a déjà été contacté';
  if (s.connaitUES === null) return 'Dites s’il connaît l’UES';
  if (s.ambassadeur === null) return 'Dites s’il est représentant CPI CHUES';
  if (s.ambassadeur !== true) return null;
  if (s.numeroConfirme === null) return 'Dites si le numéro est confirmé';
  if (s.numeroConfirme === false && digitsOf(s.nouveauNumero) < 9) {
    return 'Écrivez le nouveau numéro';
  }
  if (s.memeWhatsapp === null) return 'Dites s’il a WhatsApp sur ce numéro';
  if (s.memeWhatsapp === false && digitsOf(s.whatsapp) < 9) return 'Écrivez le numéro WhatsApp';
  return null;
}

/** Confirmation de l'établissement, et sa nouvelle valeur seulement si infirmée. */
function etablissementAnswer(confirme: boolean | null, nouvel: string): Partial<RepAnswer> {
  if (confirme === null) return {};
  const nom = nouvel.trim();
  return { etablissementConfirme: confirme, ...(confirme === false && nom !== '' ? { etablissement: nom } : {}) };
}

/** Confirmation du numéro, et le nouveau numéro seulement s'il est infirmé et lisible. */
function numeroAnswer(confirme: boolean | null, nouveau: string): Partial<RepAnswer> {
  if (confirme === null) return {};
  return {
    numeroConfirme: confirme,
    ...(confirme === false && digitsOf(nouveau) >= 9 ? { phone: nouveau.trim() } : {}),
  };
}

/** Apparition d'une question qui n'était pas là : douce, et coupée si l'on préfère. */
const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

/**
 * L'annuaire, cherché par le SERVEUR : il compare le nom et le numéro réduit à
 * ses chiffres, donc « 77 123 45 67 » trouve la même fiche que « 771234567 ».
 */
const annuaireFilters = (search: string): RepresentantFilters => ({
  ...EMPTY_REPRESENTANT_FILTERS,
  search,
  sortBy: 'fullName',
  sortDir: 'asc',
  pageSize: 20,
});

/**
 * Étape 1 : qualifier un représentant, dans l'ordre et les mots de
 * l'application mobile.
 *
 * Rien n'est choisi d'office : l'écran ouvre sur la liste. La qualification ne
 * part au serveur qu'à « Enregistrer », en UNE tentative — c'est ce qui permet
 * de revenir sur chaque réponse jusqu'au bout.
 */
export function RepScript() {
  const queryClient = useQueryClient();
  const live = useLive();

  const [choisi, setChoisi] = useState<ScriptedRepresentant | null>(null);
  const [search, setSearch] = useState('');
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  const queue = useQuery({
    queryKey: repScriptKeys.queue,
    queryFn: () => fetchRepScriptQueue(),
    refetchInterval: live.refetchInterval,
  });

  const annuaire = useQuery({
    queryKey: queryKeys.representants(annuaireFilters(cherche)),
    queryFn: () => fetchRepresentants(annuaireFilters(cherche)),
    enabled: choisi === null,
    placeholderData: (previous) => previous,
  });

  const aQualifier = useMemo(() => buildRepQueue(queue.data?.items ?? []), [queue.data]);
  // Sans recherche, l'écran ouvre sur les représentants dont la relation n'est
  // pas tranchée. Il ne choisit personne pour autant.
  const liste = cherche === '' && aQualifier.length > 0 ? aQualifier : (annuaire.data?.items ?? []);
  const listeParDefaut = cherche === '' && aQualifier.length > 0;

  const ouvrir = useCallback((row: ScriptedRepresentant) => {
    setConfirme(null);
    setChoisi(row);
  }, []);

  const revenir = useCallback(() => {
    setChoisi(null);
  }, []);

  if (queue.isPending) return <Skeleton className="h-96 w-full" />;

  if (queue.isError) {
    return (
      <QueryErrorState
        error={queue.error}
        fallback="L’annuaire n’a pas pu être lu."
        onRetry={() => {
          void queue.refetch();
        }}
      />
    );
  }

  if (choisi !== null) {
    return (
      <Qualification
        key={choisi.id}
        representant={choisi}
        onAbandon={revenir}
        onEnregistre={(nom) => {
          setConfirme(nom);
          setChoisi(null);
          void queryClient.invalidateQueries({ queryKey: repScriptKeys.root });
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {confirme === null ? null : (
        <p role="status" className={cn('text-[0.875rem] font-[600] text-accent-text', REVELE)}>
          Appel enregistré pour {confirme}.
        </p>
      )}

      <ChampAnnuaire value={search} onChange={setSearch} />

      <p className="text-[0.8125rem] text-muted-foreground">Choisissez qui vous venez d’appeler.</p>

      {annuaire.isError && !listeParDefaut ? (
        <QueryErrorState
          error={annuaire.error}
          fallback="L’annuaire n’a pas pu être lu."
          onRetry={() => {
            void annuaire.refetch();
          }}
        />
      ) : annuaire.isPending && !listeParDefaut ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : liste.length === 0 ? (
        <p className="text-[0.9375rem]">Aucun résultat. Vérifiez le nom ou le numéro.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {liste.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  ouvrir(row);
                }}
                className={cn(
                  'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-3 text-left',
                  'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[0.9375rem] font-[600]">{row.fullName}</span>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    <span className="tabular-nums">{formatPhone(row.phoneE164)}</span>
                    {row.departementName === null ? '' : ` · ${row.departementName}`}
                  </span>
                </span>
                <RelationBadge status={row.relationStatus} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Le champ de recherche, en tête de la liste et jamais replié. */
function ChampAnnuaire({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="rep-annuaire" className="text-[0.875rem] font-[600]">
        Qui avez-vous appelé ?
      </label>
      <Input
        id="rep-annuaire"
        ref={champ}
        type="search"
        autoComplete="off"
        placeholder="Chercher un représentant : nom ou numéro"
        className="h-12 text-[1rem]"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/**
 * La qualification elle-même : deux étapes, comme sur mobile. Aucune réponse ne
 * part avant « Enregistrer », donc chacune reste modifiable jusque-là.
 */
function Qualification({
  representant,
  onAbandon,
  onEnregistre,
}: {
  representant: ScriptedRepresentant;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const [etape, setEtape] = useState<1 | 2>(1);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [etablissementConfirme, setEtablissementConfirme] = useState<boolean | null>(null);
  const [nouvelEtablissement, setNouvelEtablissement] = useState('');
  const [contacte, setContacte] = useState<boolean | null>(null);
  const [connaitUES, setConnaitUES] = useState<boolean | null>(null);
  const [syndicat, setSyndicat] = useState('');
  const [ambassadeur, setAmbassadeur] = useState<boolean | null>(null);
  const [numeroConfirme, setNumeroConfirme] = useState<boolean | null>(null);
  const [nouveauNumero, setNouveauNumero] = useState('');
  const [memeWhatsapp, setMemeWhatsapp] = useState<boolean | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [rappelAt, setRappelAt] = useState<string | null>(null);
  const [sugPhone, setSugPhone] = useState('');
  const [sugName, setSugName] = useState('');
  const [sugNote, setSugNote] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [edit, setEdit] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // La garde du mobile : une relation DÉJÀ TRANCHÉE, acceptation comme refus,
  // ne se requalifie pas sans qu'on l'ait dit.
  const [avertiTranchee, setAvertiTranchee] = useState(repRelationSettled(representant));

  const now = useMemo(() => Date.now(), []);

  const send = useMutation({
    mutationFn: (answer: RepAnswer) => pushRepCallAttempt(buildRepAttempt(representant.id, answer)),
    onSuccess: () => {
      toast.success(`Appel enregistré pour ${representant.fullName}.`);
      onEnregistre(representant.fullName);
    },
    onError: (error) => {
      toastApiError(error, 'La réponse n’a pas été enregistrée.');
    },
  });

  const joignable = resultat === 'JOIGNABLE';
  /** Une personne proposée n'a de sens que si l'appelé a dit non. */
  const proposeQuelquUn = joignable && ambassadeur === false;
  const suggestionCommencee =
    sugPhone.trim() !== '' || sugName.trim() !== '' || sugNote.trim() !== '';

  const manque = ((): string | null => {
    if (resultat === null) return 'Choisissez d’abord le résultat';
    if (joignable) {
      const script = manqueJoignable({
        etablissementConfirme,
        nouvelEtablissement,
        contacte,
        connaitUES,
        ambassadeur,
        numeroConfirme,
        nouveauNumero,
        memeWhatsapp,
        whatsapp,
      });
      if (script !== null) return script;
    }
    if (resultat === 'RAPPEL' && rappelAt === null) return 'Choisissez quand rappeler';
    // Le serveur jette une suggestion sans numéro : plutôt que d'effacer en
    // silence ce qui vient d'être dicté, l'enregistrement attend le numéro.
    if (proposeQuelquUn && suggestionCommencee && digitsOf(sugPhone) < 9) {
      return 'Écrivez le numéro de la personne proposée';
    }
    return null;
  })();

  const enregistrer = (): void => {
    if (manque !== null || resultat === null || send.isPending) return;
    const chuesOui = joignable && ambassadeur === true;

    send.mutate({
      outcome:
        resultat === 'JOIGNABLE'
          ? chuesOui
            ? 'REACHED'
            : 'REFUSED'
          : resultat === 'RAPPEL'
            ? 'CALLBACK'
            : 'UNREACHABLE',
      ...(resultat === 'JOIGNABLE'
        ? { relationStatus: chuesOui ? ('AMBASSADEUR' as const) : ('REFUS' as const) }
        : {}),
      ...(joignable ? etablissementAnswer(etablissementConfirme, nouvelEtablissement) : {}),
      ...(joignable && contacte !== null ? { contacte } : {}),
      ...(joignable && connaitUES !== null ? { connaitUES } : {}),
      ...(joignable && syndicat.trim() !== '' ? { syndicat: syndicat.trim() } : {}),
      ...(chuesOui ? numeroAnswer(numeroConfirme, nouveauNumero) : {}),
      ...(chuesOui
        ? {
            whatsappStatus:
              memeWhatsapp === true ? ('MEME_NUMERO' as const) : ('AUTRE_NUMERO' as const),
            ...(memeWhatsapp === true ? {} : { whatsappE164: whatsapp.trim() }),
          }
        : {}),
      ...(rappelAt === null ? {} : { callbackAt: rappelAt }),
      ...(proposeQuelquUn && suggestionCommencee
        ? {
            suggestedPhone: sugPhone.trim(),
            ...(sugName.trim() === '' ? {} : { suggestedName: sugName.trim() }),
            ...(sugNote.trim() === '' ? {} : { suggestedNote: sugNote.trim() }),
          }
        : {}),
      ...(commentaire.trim() === '' ? {} : { comment: commentaire.trim() }),
    });
  };

  const reculer = useCallback(() => {
    setEtape((courante) => {
      if (courante === 2) return 1;
      onAbandon();
      return 1;
    });
  }, [onAbandon]);

  useShortcuts(
    {
      Escape: reculer,
      c: () => {
        copyPhone(representant.phoneE164);
      },
      e: () => {
        setEdit(true);
      },
      '?': () => {
        setHelpOpen((open) => !open);
      },
    },
    !edit,
  );

  /*
    La question passe AVANT tout : ni nom, ni numéro, ni question tant qu'on n'a
    pas répondu. C'est la boîte que le mobile ouvre par-dessus l'écran avant
    toute saisie. Le titre dit LEQUEL des deux cas on a sous les yeux.
  */
  if (avertiTranchee) {
    return (
      <Dialog open onOpenChange={onAbandon}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {representant.relationStatus === 'AMBASSADEUR'
                ? 'Cette personne a déjà accepté d’être représentant CPI CHUES.'
                : 'Cette personne a déjà refusé.'}
            </DialogTitle>
            <DialogDescription>
              Voulez-vous quand même consigner un nouvel appel ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={onAbandon}>
              <ArrowLeftIcon aria-hidden="true" />
              Revenir à la liste
            </Button>
            <Button
              onClick={() => {
                setAvertiTranchee(false);
              }}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <Button variant="ghost" className="self-start px-0" onClick={reculer}>
        <ArrowLeftIcon aria-hidden="true" />
        {etape === 1 ? 'Revenir à la liste' : 'Étape précédente'}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            {representant.fullName}
          </h2>
          {representant.prenom === null && representant.etablissement === null ? null : (
            <p className="text-[0.8125rem] text-muted-foreground">
              {[representant.prenom, representant.etablissement].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <RelationBadge status={representant.relationStatus} />
      </div>

      <div className="flex items-center gap-3">
        <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
          {formatPhone(representant.phoneE164)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            copyPhone(representant.phoneE164);
          }}
        >
          <CopyIcon aria-hidden="true" />
          Copier
        </Button>
      </div>

      <p className="text-[0.8125rem] font-[600] text-muted-foreground">
        Étape {etape} sur 2 ·{' '}
        {etape === 1 ? 'Comment s’est passé l’appel ?' : 'Quelque chose à ajouter ?'}
      </p>

      {etape === 1 ? (
        <div className="flex flex-col gap-5">
          <Question titre="Comment s’est passé l’appel ?">
            <Choix
              options={RESULTATS.map(({ valeur, label }) => ({ valeur, label }))}
              value={resultat}
              onChange={(valeur) => {
                setResultat(valeur);
                if (valeur !== 'JOIGNABLE') {
                  setEtablissementConfirme(null);
                  setContacte(null);
                  setConnaitUES(null);
                  setAmbassadeur(null);
                  setNumeroConfirme(null);
                  setMemeWhatsapp(null);
                }
                if (valeur !== 'RAPPEL') setRappelAt(null);
              }}
            />
          </Question>

          {joignable ? (
            <Question titre="L’établissement de la fiche est-il confirmé ?" anime>
              <Choix
                options={[
                  { valeur: true, label: 'Oui' },
                  { valeur: false, label: 'Non' },
                ]}
                value={etablissementConfirme}
                onChange={(valeur) => {
                  setEtablissementConfirme(valeur);
                  if (valeur) setNouvelEtablissement('');
                }}
              />
              {etablissementConfirme === false ? (
                <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
                  <label htmlFor="rep-etablissement" className="text-[0.875rem] font-[600]">
                    Nouvel établissement
                  </label>
                  <Input
                    id="rep-etablissement"
                    autoComplete="off"
                    maxLength={160}
                    value={nouvelEtablissement}
                    onChange={(event) => {
                      setNouvelEtablissement(event.target.value);
                    }}
                  />
                </div>
              ) : null}
            </Question>
          ) : null}

          {joignable ? (
            <Question titre="A-t-il déjà été contacté ?" anime>
              <Choix
                options={[
                  { valeur: true, label: 'Oui' },
                  { valeur: false, label: 'Non' },
                ]}
                value={contacte}
                onChange={setContacte}
              />
            </Question>
          ) : null}

          {joignable ? (
            <Question titre="Connaît-il l’UES ?" anime>
              <Choix
                options={[
                  { valeur: true, label: 'Oui' },
                  { valeur: false, label: 'Non' },
                ]}
                value={connaitUES}
                onChange={setConnaitUES}
              />
            </Question>
          ) : null}

          {joignable ? (
            <Question titre="Niveau de syndicat ? (facultatif)" anime>
              <div className="flex max-w-80 flex-col gap-1.5">
                <label htmlFor="rep-syndicat" className="sr-only">
                  Niveau de syndicat
                </label>
                <Input
                  id="rep-syndicat"
                  autoComplete="off"
                  maxLength={160}
                  value={syndicat}
                  onChange={(event) => {
                    setSyndicat(event.target.value);
                  }}
                />
              </div>
            </Question>
          ) : null}

          {joignable ? (
            <Question titre="Est-il représentant CPI CHUES ?" anime>
              <Choix
                options={[
                  { valeur: true, label: 'Oui' },
                  { valeur: false, label: 'Non' },
                ]}
                value={ambassadeur}
                onChange={(valeur) => {
                  setAmbassadeur(valeur);
                  if (!valeur) {
                    setNumeroConfirme(null);
                    setMemeWhatsapp(null);
                  }
                }}
              />
            </Question>
          ) : null}

          {joignable && ambassadeur === true ? (
            <Question titre="Son numéro est-il confirmé ?" anime>
              <Choix
                options={[
                  { valeur: true, label: 'Oui' },
                  { valeur: false, label: 'Non' },
                ]}
                value={numeroConfirme}
                onChange={(valeur) => {
                  setNumeroConfirme(valeur);
                  if (valeur) setNouveauNumero('');
                }}
              />
              {numeroConfirme === false ? (
                <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
                  <label htmlFor="rep-nouveau-numero" className="text-[0.875rem] font-[600]">
                    Nouveau numéro
                  </label>
                  <Input
                    id="rep-nouveau-numero"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="77 123 45 67"
                    value={nouveauNumero}
                    onChange={(event) => {
                      setNouveauNumero(event.target.value);
                    }}
                  />
                </div>
              ) : null}
            </Question>
          ) : null}

          {joignable && ambassadeur === true ? (
            <Question titre="A-t-il WhatsApp sur ce numéro ?" anime>
              <Choix
                options={[
                  { valeur: true, label: 'Oui' },
                  { valeur: false, label: 'Non' },
                ]}
                value={memeWhatsapp}
                onChange={setMemeWhatsapp}
              />
              {memeWhatsapp === false ? (
                <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
                  <label htmlFor="rep-whatsapp" className="text-[0.875rem] font-[600]">
                    Numéro WhatsApp
                  </label>
                  <Input
                    id="rep-whatsapp"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="77 123 45 67"
                    value={whatsapp}
                    onChange={(event) => {
                      setWhatsapp(event.target.value);
                    }}
                  />
                </div>
              ) : null}
            </Question>
          ) : null}

          {proposeQuelquUn ? (
            <Question titre="Il propose quelqu’un d’autre ? (facultatif)" anime>
              <div className="flex max-w-96 flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rep-sug-phone" className="text-[0.875rem] font-[600]">
                    Son numéro
                  </label>
                  <Input
                    id="rep-sug-phone"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="77 123 45 67"
                    value={sugPhone}
                    onChange={(event) => {
                      setSugPhone(event.target.value);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rep-sug-name" className="text-[0.875rem] font-[600]">
                    Son nom et prénom
                  </label>
                  <Input
                    id="rep-sug-name"
                    autoComplete="off"
                    maxLength={160}
                    value={sugName}
                    onChange={(event) => {
                      setSugName(event.target.value);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rep-sug-note" className="text-[0.875rem] font-[600]">
                    Sa remarque
                  </label>
                  <Textarea
                    id="rep-sug-note"
                    rows={2}
                    maxLength={2000}
                    value={sugNote}
                    onChange={(event) => {
                      setSugNote(event.target.value);
                    }}
                  />
                </div>
              </div>
            </Question>
          ) : null}

          {resultat === 'RAPPEL' ? (
            <Question titre="Quand rappeler ?" anime>
              <ChoixEcheance now={now} value={rappelAt} onChange={setRappelAt} />
            </Question>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Button
              className="self-start"
              disabled={manque !== null}
              onClick={() => {
                setEtape(2);
              }}
            >
              Continuer
            </Button>
            {manque === null ? null : (
              <p className="text-[0.8125rem] text-muted-foreground">{manque}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Question titre="Quelque chose à ajouter ?">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rep-commentaire" className="text-[0.875rem] font-[600]">
                Commentaire
              </label>
              <Textarea
                id="rep-commentaire"
                rows={3}
                maxLength={2000}
                placeholder="En une phrase"
                value={commentaire}
                onChange={(event) => {
                  setCommentaire(event.target.value);
                }}
              />
            </div>
          </Question>

          <dl className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 text-[0.875rem]">
            <Recap intitule="Personne appelée" valeur={representant.fullName} />
            <Recap intitule="Téléphone" valeur={formatPhone(representant.phoneE164)} />
            <Recap
              intitule="Résultat"
              valeur={RESULTATS.find((item) => item.valeur === resultat)?.label ?? null}
            />
            {joignable ? (
              <>
                <Recap
                  intitule="Établissement"
                  valeur={recapEtablissement(etablissementConfirme, nouvelEtablissement)}
                />
                <Recap intitule="Déjà contacté" valeur={recapOuiNon(contacte)} />
                <Recap intitule="Connaît l’UES" valeur={recapOuiNon(connaitUES)} />
                {syndicat.trim() === '' ? null : (
                  <Recap intitule="Niveau de syndicat" valeur={syndicat.trim()} />
                )}
                <Recap intitule="Représentant CPI CHUES" valeur={recapOuiNon(ambassadeur)} />
                {ambassadeur === true && numeroConfirme === false && digitsOf(nouveauNumero) >= 9 ? (
                  <Recap intitule="Nouveau numéro" valeur={nouveauNumero.trim()} />
                ) : null}
              </>
            ) : null}
            {rappelAt === null ? null : (
              <Recap intitule="Rappel" valeur={formatCallbackAt(rappelAt, now)} />
            )}
            {proposeQuelquUn && suggestionCommencee ? (
              <Recap
                intitule="Personne proposée"
                valeur={[sugPhone.trim(), sugName.trim()].filter(Boolean).join(' · ')}
              />
            ) : null}
          </dl>

          {/* Un seul retour à l'écran, en tête : deux boutons du même nom
              rendraient le chemin ambigu. */}
          <Button
            className="self-start"
            disabled={manque !== null || send.isPending}
            onClick={enregistrer}
          >
            Enregistrer
          </Button>
        </div>
      )}

      <details
        open={helpOpen}
        onToggle={(event) => {
          setHelpOpen(event.currentTarget.open);
        }}
      >
        <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground">
          Carte clavier
        </summary>
        <dl className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
          {KEYBOARD_MAP.map(([touche, quoi]) => (
            <div key={touche} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0 font-[600]">{touche}</dt>
              <dd className="text-muted-foreground">{quoi}</dd>
            </div>
          ))}
        </dl>
      </details>

      <Button
        variant="ghost"
        className="self-start px-0 text-[0.8125rem]"
        onClick={() => {
          setEdit(true);
        }}
      >
        <PencilIcon aria-hidden="true" />
        Corriger la fiche
      </Button>

      {edit ? (
        <RepresentantFormDialog
          open
          onOpenChange={setEdit}
          representant={representant}
          pendantAppel
        />
      ) : null}
    </div>
  );
}

/** Une question posée, et qui LE RESTE une fois répondue. */
function Question({
  titre,
  anime = false,
  children,
}: {
  titre: string;
  anime?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2', anime && REVELE)}>
      <legend className="pb-2 text-[1rem] font-[600]">{titre}</legend>
      {children}
    </fieldset>
  );
}

/** Tuiles à réponse unique. Retoucher une réponse déjà prise reste possible. */
function Choix<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: readonly { valeur: T; label: string }[];
  value: T | null;
  onChange: (valeur: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const actif = value === option.valeur;
        return (
          <Button
            key={String(option.valeur)}
            type="button"
            variant={actif ? 'default' : 'outline'}
            aria-pressed={actif}
            onClick={() => {
              onChange(option.valeur);
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Les créneaux d'un clic, puis « Choisir une date » : calendrier natif du
 * navigateur, puis les demi-heures ouvrées du jour retenu. Même découpage que
 * la feuille du mobile, sans embarquer de bibliothèque de calendrier.
 */
function ChoixEcheance({
  now,
  value,
  onChange,
}: {
  now: number;
  value: string | null;
  onChange: (at: string | null) => void;
}) {
  const [jour, setJour] = useState('');
  const [ouvert, setOuvert] = useState(false);

  const slots = useMemo(() => callbackSlots(now), [now]);
  const heures = useMemo(() => (jour === '' ? [] : callbackHalfHours(now, jour)), [now, jour]);
  const surMesure = value !== null && !slots.some((slot) => slot.at === value);
  const minimum = new Date(now).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <Button
            key={slot.key}
            type="button"
            variant={value === slot.at ? 'default' : 'outline'}
            aria-pressed={value === slot.at}
            onClick={() => {
              setOuvert(false);
              onChange(value === slot.at ? null : slot.at);
            }}
          >
            {slot.label}
          </Button>
        ))}
        <Button
          type="button"
          variant={surMesure ? 'default' : 'outline'}
          aria-pressed={surMesure}
          onClick={() => {
            setOuvert((open) => !open);
          }}
        >
          <CalendarIcon aria-hidden="true" />
          {surMesure ? formatCallbackAt(value, now) : 'Choisir une date'}
        </Button>
      </div>

      {ouvert ? (
        <div className={cn('flex flex-col gap-3 rounded-lg border border-border p-3', REVELE)}>
          <div className="flex max-w-64 flex-col gap-1.5">
            <label htmlFor="rep-rappel-jour" className="text-[0.875rem] font-[600]">
              Quel jour ?
            </label>
            <Input
              id="rep-rappel-jour"
              type="date"
              min={minimum}
              value={jour}
              onChange={(event) => {
                setJour(event.target.value);
                onChange(null);
              }}
            />
          </div>

          {jour === '' ? null : heures.length === 0 ? (
            <p className="text-[0.875rem]">
              Plus d’heure disponible ce jour-là. Choisissez un autre jour.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-[0.875rem] font-[600]">À quelle heure ?</p>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                {heures.map((heure) => (
                  <Button
                    key={heure.key}
                    type="button"
                    size="sm"
                    variant={value === heure.at ? 'default' : 'outline'}
                    aria-pressed={value === heure.at}
                    onClick={() => {
                      onChange(heure.at);
                    }}
                  >
                    {heure.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Recap({ intitule, valeur }: { intitule: string; valeur: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{intitule}</dt>
      <dd className={cn('text-right', valeur === null && 'text-muted-foreground italic')}>
        {valeur ?? 'Non renseigné'}
      </dd>
    </div>
  );
}
