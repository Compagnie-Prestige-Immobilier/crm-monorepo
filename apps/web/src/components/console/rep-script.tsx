'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ArrowLeftIcon, CalendarIcon, CopyIcon, PencilIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { copyPhone } from '@/components/console/console-ui';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { FilterCombobox } from '@/components/filters/filter-combobox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  buildRepAttempt,
  callbackHalfHours,
  callbackSlots,
  formatCallbackAt,
  pushRepCallAttempt,
  repRelationSettled,
  repScriptKeys,
  type RepAnswer,
} from '@/lib/data/console';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchRepresentants, type ScriptedRepresentant } from '@/lib/data/representants';
import {
  fetchStatutsQualification,
  statutsDeLaBranche,
  type StatutQualification,
  type StatutQualificationEffect,
} from '@/lib/data/statuts-qualification';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantFilters } from '@/lib/representant-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

/** L'appel a abouti, ou non. Ce qu'il a donné se dit ensuite, au statut. */
type Resultat = 'JOIGNABLE' | 'INJOIGNABLE';

const RESULTATS: readonly { valeur: Resultat; label: string }[] = [
  { valeur: 'JOIGNABLE', label: 'Joignable' },
  { valeur: 'INJOIGNABLE', label: 'Injoignable' },
];

const OUTCOME_PAR_EFFET: Record<StatutQualificationEffect, RepAnswer['outcome']> = {
  REACHED: 'REACHED',
  REFUSED: 'REFUSED',
  SCHEDULE_CALLBACK: 'CALLBACK',
  UNREACHABLE: 'UNREACHABLE',
  WRONG_NUMBER: 'WRONG_NUMBER',
};

/** Le serveur dérive la même issue et refuse celle qui le contredit. */
export const outcomeDuStatut = (effect: StatutQualificationEffect): RepAnswer['outcome'] =>
  OUTCOME_PAR_EFFET[effect];

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
  if (s.memeWhatsapp === null) return 'Dites s’il a WhatsApp sur ce numéro';
  if (s.memeWhatsapp === false && digitsOf(s.whatsapp) < 9) return 'Écrivez le numéro WhatsApp';
  return null;
}

/** Confirmation de l'établissement, et sa nouvelle valeur seulement si infirmée. */
function etablissementAnswer(confirme: boolean | null, nouvel: string): Partial<RepAnswer> {
  if (confirme === null) return {};
  const nom = nouvel.trim();
  return {
    etablissementConfirme: confirme,
    ...(confirme === false && nom !== '' ? { etablissement: nom } : {}),
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
 * Rien n'est choisi d'office : l'écran ouvre sur la barre de recherche. La
 * qualification ne part au serveur qu'à « Enregistrer », en UNE tentative —
 * c'est ce qui permet de revenir sur chaque réponse jusqu'au bout.
 */
export function RepScript() {
  const queryClient = useQueryClient();

  const [choisi, setChoisi] = useState<ScriptedRepresentant | null>(null);
  const [search, setSearch] = useState('');
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  // Aucune liste par défaut : l'annuaire tient des milliers de fiches, tout
  // dérouler laisse croire à un total faux. Rien ne s'affiche tant qu'on n'a
  // pas cherché.
  const annuaire = useQuery({
    queryKey: queryKeys.representants(annuaireFilters(cherche)),
    queryFn: () => fetchRepresentants(annuaireFilters(cherche)),
    enabled: choisi === null && cherche !== '',
    placeholderData: (previous) => previous,
  });

  const liste = cherche === '' ? [] : (annuaire.data?.items ?? []);

  const ouvrir = useCallback((row: ScriptedRepresentant) => {
    setConfirme(null);
    setChoisi(row);
  }, []);

  const revenir = useCallback(() => {
    setChoisi(null);
  }, []);

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

      <p className="text-[0.8125rem] text-muted-foreground">
        Cherchez qui vous venez d’appeler par nom ou numéro.
      </p>

      {cherche === '' ? null : (
        <ResultatsAnnuaire annuaire={annuaire} liste={liste} onOuvrir={ouvrir} />
      )}
    </div>
  );
}

function ResultatsAnnuaire({
  annuaire,
  liste,
  onOuvrir,
}: {
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchRepresentants>>>;
  liste: readonly ScriptedRepresentant[];
  onOuvrir: (row: ScriptedRepresentant) => void;
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

  if (annuaire.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (liste.length === 0) {
    return <p className="text-[0.9375rem]">Aucun résultat. Vérifiez le nom ou le numéro.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {liste.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => {
              onOuvrir(row);
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

const OUI_NON = [
  { valeur: true, label: 'Oui' },
  { valeur: false, label: 'Non' },
];

interface QuestionsJoignableProps {
  etablissementConfirme: boolean | null;
  setEtablissementConfirme: (valeur: boolean | null) => void;
  nouvelEtablissement: string;
  setNouvelEtablissement: (valeur: string) => void;
  contacte: boolean | null;
  setContacte: (valeur: boolean | null) => void;
  connaitUES: boolean | null;
  setConnaitUES: (valeur: boolean | null) => void;
  syndicatId: string | null;
  setSyndicatId: (valeur: string | null) => void;
  syndicatOptions: { value: string; label: string; hint: string }[];
  ambassadeur: boolean | null;
  setAmbassadeur: (valeur: boolean | null) => void;
  memeWhatsapp: boolean | null;
  setMemeWhatsapp: (valeur: boolean | null) => void;
  whatsapp: string;
  setWhatsapp: (valeur: string) => void;
}

/** Les questions qui n'ont de sens que si la personne a décroché. */
function QuestionsJoignable(props: QuestionsJoignableProps) {
  return (
    <>
      <Question titre="L’établissement de la fiche est-il confirmé ?" anime>
        <Choix
          options={OUI_NON}
          value={props.etablissementConfirme}
          onChange={(valeur) => {
            props.setEtablissementConfirme(valeur);
            if (valeur) props.setNouvelEtablissement('');
          }}
        />
        {props.etablissementConfirme === false ? (
          <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
            <label htmlFor="rep-etablissement" className="text-[0.875rem] font-[600]">
              Nouvel établissement
            </label>
            <Input
              id="rep-etablissement"
              autoComplete="off"
              maxLength={160}
              value={props.nouvelEtablissement}
              onChange={(event) => {
                props.setNouvelEtablissement(event.target.value);
              }}
            />
          </div>
        ) : null}
      </Question>

      <Question titre="A-t-il déjà été contacté ?" anime>
        <Choix options={OUI_NON} value={props.contacte} onChange={props.setContacte} />
      </Question>

      <Question titre="Connaît-il l’UES ?" anime>
        <Choix options={OUI_NON} value={props.connaitUES} onChange={props.setConnaitUES} />
      </Question>

      <Question titre="Sur quel syndicat ? (facultatif)" anime>
        <FilterCombobox
          className="max-w-80"
          label="Syndicat (facultatif)"
          placeholder="Choisir un syndicat"
          value={props.syndicatId}
          options={props.syndicatOptions}
          onChange={props.setSyndicatId}
        />
      </Question>

      <Question titre="Est-il représentant CPI CHUES ?" anime>
        <Choix
          options={OUI_NON}
          value={props.ambassadeur}
          onChange={(valeur) => {
            props.setAmbassadeur(valeur);
            if (!valeur) props.setMemeWhatsapp(null);
          }}
        />
      </Question>

      {props.ambassadeur === true ? (
        <Question titre="A-t-il WhatsApp sur ce numéro ?" anime>
          <Choix options={OUI_NON} value={props.memeWhatsapp} onChange={props.setMemeWhatsapp} />
          {props.memeWhatsapp === false ? (
            <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
              <label htmlFor="rep-whatsapp" className="text-[0.875rem] font-[600]">
                Numéro WhatsApp
              </label>
              <Input
                id="rep-whatsapp"
                inputMode="tel"
                autoComplete="off"
                placeholder="77 123 45 67"
                value={props.whatsapp}
                onChange={(event) => {
                  props.setWhatsapp(event.target.value);
                }}
              />
            </div>
          ) : null}
        </Question>
      ) : null}
    </>
  );
}

interface SuggestionProps {
  sugPhone: string;
  setSugPhone: (valeur: string) => void;
  sugName: string;
  setSugName: (valeur: string) => void;
  sugNote: string;
  setSugNote: (valeur: string) => void;
}

function QuestionSuggestion({
  sugPhone,
  setSugPhone,
  sugName,
  setSugName,
  sugNote,
  setSugNote,
}: SuggestionProps) {
  return (
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
  );
}

/** Le vocabulaire du référentiel, borné à la branche que le résultat ouvre. */
function ChoixStatut({
  statuts,
  value,
  onChange,
}: {
  statuts: readonly StatutQualification[];
  value: string | null;
  onChange: (valeur: string | null) => void;
}) {
  return (
    <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
      <label htmlFor="rep-statut" className="text-[1rem] font-[600]">
        Statut de qualification
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="rep-statut">
          <SelectValue placeholder="Choisir un statut" />
        </SelectTrigger>
        <SelectContent>
          {statuts.map((statut) => (
            <SelectItem key={statut.id} value={statut.id}>
              {statut.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface EtapeQuestionsProps {
  resultat: Resultat | null;
  onResultat: (valeur: Resultat) => void;
  statuts: readonly StatutQualification[];
  statutId: string | null;
  onStatut: (valeur: string | null) => void;
  exigeRappel: boolean;
  joignable: boolean;
  proposeQuelquUn: boolean;
  questionsJoignable: QuestionsJoignableProps;
  suggestion: SuggestionProps;
  rappel: { now: number; value: string | null; onChange: (valeur: string | null) => void };
  commentaire: string;
  onCommentaire: (valeur: string) => void;
  manque: string | null;
  onContinuer: () => void;
}

/** La première étape : les questions, dans l'ordre où l'appel les pose. */
function EtapeQuestions(props: EtapeQuestionsProps) {
  return (
    <div className="flex flex-col gap-5">
      <Question titre="Comment s’est passé l’appel ?">
        <Choix
          options={RESULTATS.map(({ valeur, label }) => ({ valeur, label }))}
          value={props.resultat}
          onChange={props.onResultat}
        />
      </Question>

      {props.joignable ? <QuestionsJoignable {...props.questionsJoignable} /> : null}

      {props.proposeQuelquUn ? <QuestionSuggestion {...props.suggestion} /> : null}

      {props.resultat === null ? null : (
        <ChoixStatut statuts={props.statuts} value={props.statutId} onChange={props.onStatut} />
      )}

      {/* L'échéance ne se demande qu'au statut qui la réclame. Proposée sur
          tout appel abouti, elle armait un rappel que personne n'avait promis,
          et la fiche remontait dans « à rappeler » sans raison. */}
      {props.exigeRappel ? (
        <Question titre="Quand rappeler ?" anime>
          <ChoixEcheance
            now={props.rappel.now}
            value={props.rappel.value}
            onChange={props.rappel.onChange}
          />
        </Question>
      ) : null}

      {props.resultat === null ? null : (
        <Question titre="Quelque chose à ajouter ? (facultatif)" anime>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rep-commentaire" className="text-[0.875rem] font-[600]">
              Commentaire
            </label>
            <Textarea
              id="rep-commentaire"
              rows={3}
              maxLength={2000}
              placeholder="En une phrase"
              value={props.commentaire}
              onChange={(event) => {
                props.onCommentaire(event.target.value);
              }}
            />
          </div>
        </Question>
      )}

      <div className="flex flex-col gap-1.5">
        <Button className="self-start" disabled={props.manque !== null} onClick={props.onContinuer}>
          Continuer
        </Button>
        {props.manque === null ? null : (
          <p className="text-[0.8125rem] text-muted-foreground">{props.manque}</p>
        )}
      </div>
    </div>
  );
}

interface RecapAppelProps {
  representant: ScriptedRepresentant;
  resultat: Resultat | null;
  statutLabel: string | null;
  joignable: boolean;
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  syndicatName: string;
  ambassadeur: boolean | null;
  rappelAt: string | null;
  now: number;
  personneProposee: string | null;
  commentaire: string;
}

function RecapAppel(props: RecapAppelProps) {
  return (
    <dl className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 text-[0.875rem]">
      <Recap intitule="Personne appelée" valeur={props.representant.fullName} />
      <Recap intitule="Téléphone" valeur={formatPhone(props.representant.phoneE164)} />
      <Recap
        intitule="Résultat"
        valeur={RESULTATS.find((item) => item.valeur === props.resultat)?.label ?? null}
      />
      <Recap intitule="Statut" valeur={props.statutLabel} />
      {props.joignable ? (
        <>
          <Recap
            intitule="Établissement"
            valeur={recapEtablissement(props.etablissementConfirme, props.nouvelEtablissement)}
          />
          <Recap intitule="Déjà contacté" valeur={recapOuiNon(props.contacte)} />
          <Recap intitule="Connaît l’UES" valeur={recapOuiNon(props.connaitUES)} />
          {props.syndicatName === '' ? null : (
            <Recap intitule="Syndicat" valeur={props.syndicatName} />
          )}
          <Recap intitule="Représentant CPI CHUES" valeur={recapOuiNon(props.ambassadeur)} />
        </>
      ) : null}
      {props.rappelAt === null ? null : (
        <Recap intitule="Rappel" valeur={formatCallbackAt(props.rappelAt, props.now)} />
      )}
      {props.personneProposee === null ? null : (
        <Recap intitule="Personne proposée" valeur={props.personneProposee} />
      )}
      {props.commentaire === '' ? null : (
        <Recap intitule="Commentaire" valeur={props.commentaire} />
      )}
    </dl>
  );
}

/**
 * La question passe AVANT tout : ni nom, ni numéro, ni question tant qu'on n'a
 * pas répondu. C'est la boîte que le mobile ouvre par-dessus l'écran avant
 * toute saisie. Le titre dit LEQUEL des deux cas on a sous les yeux.
 */
function AvertissementTranchee({
  status,
  onAbandon,
  onContinuer,
}: {
  status: ScriptedRepresentant['relationStatus'];
  onAbandon: () => void;
  onContinuer: () => void;
}) {
  return (
    <Dialog open onOpenChange={onAbandon}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {status === 'AMBASSADEUR'
              ? 'Cette personne a déjà accepté d’être représentant CPI CHUES.'
              : 'Cette personne a déjà refusé.'}
          </DialogTitle>
          <DialogDescription>Voulez-vous quand même consigner un nouvel appel ?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onAbandon}>
            <ArrowLeftIcon aria-hidden="true" />
            Revenir à la liste
          </Button>
          <Button onClick={onContinuer}>Continuer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnTeteRepresentant({ representant }: { representant: ScriptedRepresentant }) {
  const sousTitre = [representant.prenom, representant.etablissement].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            {representant.fullName}
          </h2>
          {representant.prenom === null && representant.etablissement === null ? null : (
            <p className="text-[0.8125rem] text-muted-foreground">{sousTitre}</p>
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
    </>
  );
}

function syndicatsDe(
  reference: Awaited<ReturnType<typeof fetchReferenceData>> | undefined,
  syndicatId: string | null,
): { options: { value: string; label: string; hint: string }[]; name: string } {
  const syndicats = reference?.syndicats ?? [];
  return {
    options: syndicats
      .filter((syndicat) => syndicat.isActive)
      .map((syndicat) => ({ value: syndicat.id, label: syndicat.name, hint: syndicat.sigle })),
    name: syndicats.find((syndicat) => syndicat.id === syndicatId)?.name ?? '',
  };
}

interface EtatManque {
  resultat: Resultat | null;
  statut: StatutQualification | null;
  joignable: boolean;
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  ambassadeur: boolean | null;
  memeWhatsapp: boolean | null;
  whatsapp: string;
  rappelAt: string | null;
  proposeQuelquUn: boolean;
  suggestionCommencee: boolean;
  sugPhone: string;
}

/** Ce qui empêche encore d'enregistrer, en une phrase, ou rien. */
function manqueDe(etat: EtatManque): string | null {
  if (etat.resultat === null) return 'Choisissez d’abord le résultat';
  if (etat.statut === null) return 'Choisissez un statut de qualification';
  if (etat.joignable) {
    const script = manqueJoignable({
      etablissementConfirme: etat.etablissementConfirme,
      nouvelEtablissement: etat.nouvelEtablissement,
      contacte: etat.contacte,
      connaitUES: etat.connaitUES,
      ambassadeur: etat.ambassadeur,
      memeWhatsapp: etat.memeWhatsapp,
      whatsapp: etat.whatsapp,
    });
    if (script !== null) return script;
  }
  if (etat.statut.requiresCallback && etat.rappelAt === null) return 'Choisissez quand rappeler';
  // Le serveur jette une suggestion sans numéro : plutôt que d'effacer en
  // silence ce qui vient d'être dicté, l'enregistrement attend le numéro.
  if (etat.proposeQuelquUn && etat.suggestionCommencee && digitsOf(etat.sugPhone) < 9) {
    return 'Écrivez le numéro de la personne proposée';
  }
  return null;
}

interface EtatReponse {
  resultat: Resultat;
  statut: StatutQualification;
  joignable: boolean;
  chuesOui: boolean;
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  syndicatName: string;
  memeWhatsapp: boolean | null;
  whatsapp: string;
  rappelAt: string | null;
  proposeQuelquUn: boolean;
  suggestionCommencee: boolean;
  sugPhone: string;
  sugName: string;
  sugNote: string;
  commentaire: string;
}

function champsJoignable(etat: EtatReponse): Partial<RepAnswer> {
  if (!etat.joignable) return {};
  return {
    ...etablissementAnswer(etat.etablissementConfirme, etat.nouvelEtablissement),
    ...(etat.contacte === null ? {} : { contacte: etat.contacte }),
    ...(etat.connaitUES === null ? {} : { connaitUES: etat.connaitUES }),
    ...(etat.syndicatName === '' ? {} : { syndicat: etat.syndicatName }),
  };
}

function champsWhatsapp(etat: EtatReponse): Partial<RepAnswer> {
  if (!etat.chuesOui) return {};
  const meme = etat.memeWhatsapp === true;
  return {
    whatsappStatus: meme ? ('MEME_NUMERO' as const) : ('AUTRE_NUMERO' as const),
    ...(meme ? {} : { whatsappE164: etat.whatsapp.trim() }),
  };
}

function champsSuggestion(etat: EtatReponse): Partial<RepAnswer> {
  if (!etat.proposeQuelquUn || !etat.suggestionCommencee) return {};
  return {
    suggestedPhone: etat.sugPhone.trim(),
    ...(etat.sugName.trim() === '' ? {} : { suggestedName: etat.sugName.trim() }),
    ...(etat.sugNote.trim() === '' ? {} : { suggestedNote: etat.sugNote.trim() }),
  };
}

/** Chaque champ voyage seul : ce que la question n'a pas posé ne part pas. */
function reponseDe(etat: EtatReponse): RepAnswer {
  return {
    outcome: outcomeDuStatut(etat.statut.effect),
    statutQualificationId: etat.statut.id,
    ...(etat.resultat === 'JOIGNABLE'
      ? { relationStatus: etat.chuesOui ? ('AMBASSADEUR' as const) : ('REFUS' as const) }
      : {}),
    ...champsJoignable(etat),
    ...champsWhatsapp(etat),
    ...(etat.statut.requiresCallback && etat.rappelAt !== null
      ? { callbackAt: etat.rappelAt }
      : {}),
    ...champsSuggestion(etat),
    ...(etat.commentaire.trim() === '' ? {} : { comment: etat.commentaire.trim() }),
  };
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
  const [statutId, setStatutId] = useState<string | null>(null);
  const [etablissementConfirme, setEtablissementConfirme] = useState<boolean | null>(null);
  const [nouvelEtablissement, setNouvelEtablissement] = useState('');
  const [contacte, setContacte] = useState<boolean | null>(null);
  const [connaitUES, setConnaitUES] = useState<boolean | null>(null);
  const [syndicatId, setSyndicatId] = useState<string | null>(null);
  const [ambassadeur, setAmbassadeur] = useState<boolean | null>(null);
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

  const [now] = useState(() => Date.now());

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });
  const { options: syndicatOptions, name: syndicatName } = syndicatsDe(reference.data, syndicatId);

  const referentielStatuts = useQuery({
    queryKey: queryKeys.statutsQualification,
    queryFn: () => fetchStatutsQualification(),
    staleTime: 5 * 60_000,
  });

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
  const statuts = statutsDeLaBranche(referentielStatuts.data ?? [], joignable);
  const statut = statuts.find((ligne) => ligne.id === statutId) ?? null;
  /** Une personne proposée n'a de sens que si l'appelé a dit non. */
  const proposeQuelquUn = joignable && ambassadeur === false;
  const suggestionCommencee =
    sugPhone.trim() !== '' || sugName.trim() !== '' || sugNote.trim() !== '';

  const manque = manqueDe({
    resultat,
    statut,
    joignable,
    etablissementConfirme,
    nouvelEtablissement,
    contacte,
    connaitUES,
    ambassadeur,
    memeWhatsapp,
    whatsapp,
    rappelAt,
    proposeQuelquUn,
    suggestionCommencee,
    sugPhone,
  });

  const enregistrer = (): void => {
    if (manque !== null || resultat === null || statut === null || send.isPending) return;
    send.mutate(
      reponseDe({
        resultat,
        statut,
        joignable,
        chuesOui: joignable && ambassadeur === true,
        etablissementConfirme,
        nouvelEtablissement,
        contacte,
        connaitUES,
        syndicatName,
        memeWhatsapp,
        whatsapp,
        rappelAt,
        proposeQuelquUn,
        suggestionCommencee,
        sugPhone,
        sugName,
        sugNote,
        commentaire,
      }),
    );
  };

  const choisirResultat = (valeur: Resultat): void => {
    setResultat(valeur);
    // Chaque branche a ses propres statuts : celui d'en face ne vaut plus.
    setStatutId(null);
    if (valeur !== 'JOIGNABLE') {
      setEtablissementConfirme(null);
      setContacte(null);
      setConnaitUES(null);
      setAmbassadeur(null);
      setMemeWhatsapp(null);
    }
    if (valeur === 'INJOIGNABLE') setRappelAt(null);
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
      <AvertissementTranchee
        status={representant.relationStatus}
        onAbandon={onAbandon}
        onContinuer={() => {
          setAvertiTranchee(false);
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <Button variant="ghost" className="self-start px-0" onClick={reculer}>
        <ArrowLeftIcon aria-hidden="true" />
        {etape === 1 ? 'Revenir à la liste' : 'Étape précédente'}
      </Button>

      <EnTeteRepresentant representant={representant} />

      <p className="text-[0.8125rem] font-[600] text-muted-foreground">
        Étape {etape} sur 2 ·{' '}
        {etape === 1 ? 'Comment s’est passé l’appel ?' : 'Quelque chose à ajouter ?'}
      </p>

      {etape === 1 ? (
        <EtapeQuestions
          resultat={resultat}
          onResultat={choisirResultat}
          statuts={statuts}
          statutId={statutId}
          onStatut={setStatutId}
          exigeRappel={statut?.requiresCallback === true}
          joignable={joignable}
          proposeQuelquUn={proposeQuelquUn}
          questionsJoignable={{
            etablissementConfirme,
            setEtablissementConfirme,
            nouvelEtablissement,
            setNouvelEtablissement,
            contacte,
            setContacte,
            connaitUES,
            setConnaitUES,
            syndicatId,
            setSyndicatId,
            syndicatOptions,
            ambassadeur,
            setAmbassadeur,
            memeWhatsapp,
            setMemeWhatsapp,
            whatsapp,
            setWhatsapp,
          }}
          suggestion={{ sugPhone, setSugPhone, sugName, setSugName, sugNote, setSugNote }}
          rappel={{ now, value: rappelAt, onChange: setRappelAt }}
          commentaire={commentaire}
          onCommentaire={setCommentaire}
          manque={manque}
          onContinuer={() => {
            setEtape(2);
          }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <RecapAppel
            representant={representant}
            resultat={resultat}
            statutLabel={statut?.label ?? null}
            joignable={joignable}
            etablissementConfirme={etablissementConfirme}
            nouvelEtablissement={nouvelEtablissement}
            contacte={contacte}
            connaitUES={connaitUES}
            syndicatName={syndicatName}
            ambassadeur={ambassadeur}
            rappelAt={rappelAt}
            now={now}
            personneProposee={
              proposeQuelquUn && suggestionCommencee
                ? [sugPhone.trim(), sugName.trim()].filter(Boolean).join(' · ')
                : null
            }
            commentaire={commentaire.trim()}
          />

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

          {jour === '' || heures.length > 0 ? null : (
            <p className="text-[0.875rem]">
              Plus d’heure disponible ce jour-là. Choisissez un autre jour.
            </p>
          )}

          {jour === '' || heures.length === 0 ? null : (
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
