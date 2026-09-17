'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarIcon, CopyIcon, PencilIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BrouillonEnAttente } from '@/components/console/brouillon-en-attente';
import { AUCUN_MOTIF, Palier, type Choix } from '@/components/console/console-paliers';
import { Chrono, Kbd, copyPhone } from '@/components/console/console-ui';
import { Commentaire } from '@/components/console/console-view';
import {
  ChampAnnuaire,
  FiltreRelation,
  ListeSkeleton,
  Pages,
  ResultatsAnnuaire,
} from '@/components/console/rep-annuaire';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { EtapesProgression } from '@/components/grand-public/etapes';
import { AppelsRepresentant } from '@/components/representants/appels-representant';
import { RelationBadge } from '@/components/representants/relation-badge';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  buildRepAttempt,
  callbackHalfHours,
  callbackSlots,
  formatCallbackAt,
  lireBrouillonRep,
  pushRepCallAttempt,
  repRelationSettled,
  type RepAnswer,
} from '@/lib/data/console';
import { ouvrirFiche, type OuvertureFiche } from '@/lib/data/ouvertures';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  fetchRepresentant,
  fetchRepresentantCallAttempts,
  fetchRepresentantsAQualifier,
  type ScriptedRepresentant,
} from '@/lib/data/representants';
import {
  exigeMotif,
  fetchStatutsQualification,
  libelleStatut,
  statutDuSouhait,
  souhaitDuStatut,
  sousStatutsDe,
  statutsDeLaBranche,
  statutsRacine,
  type StatutQualification,
  type StatutQualificationEffect,
} from '@/lib/data/statuts-qualification';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { RepresentantRelation } from '@/lib/representant-filters';
import { useBrouillonAuto } from '@/lib/use-brouillon-auto';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

/** L'appel a abouti, ou non. Ce qu'il a donné se dit ensuite, au statut. */
type Resultat = 'JOIGNABLE' | 'INJOIGNABLE';

const OUTCOME_PAR_EFFET: Record<StatutQualificationEffect, RepAnswer['outcome']> = {
  REACHED: 'REACHED',
  REFUSED: 'REFUSED',
  SCHEDULE_CALLBACK: 'CALLBACK',
  UNREACHABLE: 'UNREACHABLE',
  WRONG_NUMBER: 'WRONG_NUMBER',
};

/** Le serveur dérive la même issue et refuse celle qui le contredit. */
const outcomeDuStatut = (effect: StatutQualificationEffect): RepAnswer['outcome'] =>
  OUTCOME_PAR_EFFET[effect];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1 à 9', 'Répondre'],
  ['Entrée', 'Continuer ou enregistrer'],
  ['Échap', 'Pas précédent'],
  ['C', 'Copier le numéro'],
  ['E', 'Corriger la fiche'],
];

const digitsOf = (value: string): number => value.replace(/\D/gu, '').length;

function recapEtablissement(confirme: boolean | null, nouvel: string): string | null {
  if (confirme === null) return null;
  if (confirme) return 'Confirmé';
  return nouvel.trim() === '' ? 'À corriger' : nouvel.trim();
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

const RELATIONS_DEMANDEES: Record<RepresentantRelation, RepresentantRelation[]> = {
  INCONNU: ['INCONNU'],
  CONTACTE: ['CONTACTE'],
  AMBASSADEUR: ['AMBASSADEUR'],
  REFUS: ['REFUS'],
};

function parametresAnnuaire(
  cherche: string,
  relation: RepresentantRelation | null,
  page: number,
): { search: string; relationStatus: RepresentantRelation[] | null; page: number } {
  return {
    search: cherche,
    relationStatus: relation === null ? null : RELATIONS_DEMANDEES[relation],
    page,
  };
}

/** Le titre de la confirmation d'ouverture, sans fiche visée hors du dialogue. */
function titreOuverture(aConfirmer: ScriptedRepresentant | null): string {
  return `Ouvrir la fiche de ${aConfirmer === null ? '' : aConfirmer.fullName} ?`;
}

function critereEnCoursDe(cherche: string, relation: RepresentantRelation | null): boolean {
  return cherche !== '' || relation !== null;
}

/**
 * L'annuaire, cherché par le SERVEUR : il compare le nom et le numéro réduit à
 * ses chiffres, donc « 77 123 45 67 » trouve la même fiche que « 771234567 ».
 */
/**
 * Étape 1 : qualifier un représentant, dans l'ordre et les mots de
 * l'application mobile.
 *
 * La qualification ne part au serveur qu'à « Enregistrer », en UNE tentative,
 * c'est ce qui permet de revenir sur chaque réponse jusqu'au bout.
 */
export function RepScript() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [choisi, setChoisi] = useState<Ouverte | null>(null);
  const [visee, setVisee] = useState<ScriptedRepresentant | null>(null);
  // La fiche nommée dans l'URL, depuis « Consigner un appel » de sa page.
  const [demandee, setDemandee] = useState<string | null>(searchParams.get('fiche'));
  const [search, setSearch] = useState('');
  const [relation, setRelation] = useState<RepresentantRelation | null>(null);
  const [page, setPage] = useState(1);
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  const parLien = useQuery({
    queryKey: queryKeys.representant(demandee ?? ''),
    queryFn: () => fetchRepresentant(demandee ?? ''),
    enabled: demandee !== null,
    retry: false,
  });

  const annuaire = useQuery({
    queryKey: [...queryKeys.representantsRoot, 'a-qualifier', cherche, relation, page] as const,
    queryFn: () => fetchRepresentantsAQualifier(parametresAnnuaire(cherche, relation, page)),
    enabled: choisi === null,
    placeholderData: (previous) => previous,
  });

  const { liste, pageCount } = pagesDe(annuaire.data);

  const ouvrir = useMutation({
    mutationFn: async (row: ScriptedRepresentant): Promise<Ouverte> => ({
      representant: row,
      ouverture: await ouvrirFiche({ representantId: row.id }),
    }),
    onSuccess: (ouverte) => {
      setConfirme(null);
      setVisee(null);
      setDemandee(null);
      setChoisi(ouverte);
      queryClient.setQueryData(queryKeys.ouvertureCourante, ouverte.ouverture);
    },
    onError: (error) => {
      toastApiError(error, 'La fiche n’a pas pu être ouverte.');
    },
  });

  const aConfirmer = ficheVisee(visee, demandee, parLien.data);
  const tranchee = aConfirmer === null ? null : relationTrancheeTexte(aConfirmer);

  function fermerConfirmation(ouvert: boolean): void {
    if (ouvert) return;
    setVisee(null);
    setDemandee(null);
  }

  function confirmerOuverture(): void {
    if (aConfirmer !== null) ouvrir.mutate(aConfirmer);
  }

  if (chargementParLien(demandee, parLien.isPending)) return <ListeSkeleton />;

  if (choisi !== null) {
    return (
      <Qualification
        key={choisi.ouverture.id}
        representant={choisi.representant}
        ouverture={choisi.ouverture}
        onAbandon={() => {
          setChoisi(null);
        }}
        onEnregistre={(nom) => {
          setConfirme(nom);
          setChoisi(null);
          // La tentative a fermé l'ouverture : la barre supérieure lit ce cache
          // pour refuser la déconnexion, et le laisser périmé l'y enfermerait.
          queryClient.setQueryData(queryKeys.ouvertureCourante, null);
          // La racine, pas la seule liste de l'écran : le compteur « pas encore
          // qualifiés » de l'accueil se lit sous une autre clé de la même famille.
          void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <BandeauConfirme nom={confirme} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <ChampAnnuaire
            value={search}
            onChange={(valeur) => {
              setSearch(valeur);
              setPage(1);
            }}
          />
        </div>
        <FiltreRelation
          value={relation}
          onChange={(valeur) => {
            setRelation(valeur);
            setPage(1);
          }}
        />
      </div>

      <ResultatsAnnuaire
        annuaire={annuaire}
        liste={liste}
        critereEnCours={critereEnCoursDe(cherche, relation)}
        onOuvrir={setVisee}
      />

      <Pages page={page} pageCount={pageCount} onPage={setPage} />

      <ConfirmDialog
        open={aConfirmer !== null}
        onOpenChange={fermerConfirmation}
        title={titreOuverture(aConfirmer)}
        description={null}
        confirmLabel="Ouvrir"
        confirmVariant="default"
        pending={ouvrir.isPending}
        onConfirm={confirmerOuverture}
      >
        {tranchee === null ? null : <p className="text-[0.9375rem]">{tranchee}</p>}
      </ConfirmDialog>
    </div>
  );
}

/** La fiche ouverte et l'ouverture qui la mesure : les deux vont ensemble. */
interface Ouverte {
  representant: ScriptedRepresentant;
  ouverture: OuvertureFiche;
}

/** La fiche cliquée dans l'annuaire, sinon celle que l'URL demande une fois lue. */
function ficheVisee(
  visee: ScriptedRepresentant | null,
  demandee: string | null,
  lue: ScriptedRepresentant | undefined,
): ScriptedRepresentant | null {
  if (visee !== null) return visee;
  if (demandee === null) return null;
  return lue ?? null;
}

const chargementParLien = (demandee: string | null, isPending: boolean): boolean =>
  demandee !== null && isPending;

function pagesDe(data: Awaited<ReturnType<typeof fetchRepresentantsAQualifier>> | undefined): {
  liste: ScriptedRepresentant[];
  pageCount: number;
} {
  return { liste: data?.items ?? [], pageCount: data?.pageCount ?? 1 };
}

/** Le bandeau que l'annuaire pose après une qualification enregistrée. */
function BandeauConfirme({ nom }: { nom: string | null }) {
  if (nom === null) return null;
  return (
    <p role="status" className={cn('text-[0.875rem] font-[600] text-accent-text', REVELE)}>
      Appel enregistré pour {nom}.
    </p>
  );
}

type Pas =
  | 'reponse'
  | 'ecole'
  | 'contacte'
  | 'ues'
  | 'syndicat'
  | 'representant'
  | 'whatsapp'
  | 'statut'
  | 'precision'
  | 'echeance'
  | 'recommande'
  | 'note';

const LIBELLES_PAS: Readonly<Record<Pas, string>> = {
  reponse: 'Réponse',
  ecole: 'École',
  contacte: 'Contacté',
  ues: 'UES',
  syndicat: 'Syndicat',
  representant: 'Représentant',
  whatsapp: 'WhatsApp',
  statut: 'Statut',
  precision: 'Précision',
  echeance: 'Rappel',
  recommande: 'Recommandé',
  note: 'Note',
};

/** Les questions qui se tranchent d'un clic ; le statut a la sienne selon la branche. */
const QUESTIONS_PAS: Readonly<Partial<Record<Pas, string>>> = {
  reponse: 'Avez-vous eu la personne au téléphone ?',
  ecole: 'L’école de la fiche est-elle la bonne ?',
  contacte: 'A-t-il déjà été contacté par CPI ?',
  ues: 'Connaît-il l’UES ?',
  representant: 'Accepte-t-il d’être représentant CHUES ?',
  whatsapp: 'A-t-il WhatsApp sur ce numéro ?',
  precision: 'Quelle précision ?',
};

const questionDe = (pas: Pas, joignable: boolean): string | null => {
  if (pas !== 'statut') return QUESTIONS_PAS[pas] ?? null;
  return joignable ? 'Quel statut de qualification ?' : 'Pourquoi n’a-t-il pas répondu ?';
};

interface Suite {
  libelle: string;
  passer?: string;
}

const CONTINUER: Suite = { libelle: 'Continuer' };

const SUITE_PAS: Readonly<Partial<Record<Pas, Suite>>> = {
  syndicat: { libelle: 'Continuer', passer: 'Sans syndicat' },
  precision: { libelle: 'Sans précision' },
  echeance: CONTINUER,
  recommande: { libelle: 'Continuer', passer: 'Personne à proposer' },
  note: { libelle: 'Enregistrer l’appel' },
};

/** Le bouton de suite : les pas sans clic unique, et ceux dont la réponse ouvre un champ. */
function suiteDe(
  pas: Pas,
  etat: { ecoleInfirmee: boolean; autreWhatsapp: boolean; statutRetenu: boolean },
): Suite | null {
  switch (pas) {
    case 'ecole':
      return etat.ecoleInfirmee ? CONTINUER : null;
    case 'whatsapp':
      return etat.autreWhatsapp ? CONTINUER : null;
    case 'statut':
      return etat.statutRetenu ? CONTINUER : null;
    default:
      return SUITE_PAS[pas] ?? null;
  }
}

/** Le parcours, recalculé à chaque réponse : la suite dépend de ce qui vient d'être dit. */
function parcoursDe(
  resultat: Resultat | null,
  ambassadeur: boolean | null,
  avecPrecision: boolean,
  avecEcheance: boolean,
): Pas[] {
  const pas: Pas[] = ['reponse'];
  if (resultat === 'JOIGNABLE') {
    pas.push('ecole', 'contacte', 'ues', 'syndicat', 'representant');
    if (ambassadeur === true) pas.push('whatsapp');
  }
  pas.push('statut');
  if (avecPrecision) pas.push('precision');
  if (avecEcheance) pas.push('echeance');
  if (resultat === 'JOIGNABLE' && ambassadeur === false) pas.push('recommande');
  pas.push('note');
  return pas;
}

const suivantDe = (pas: Pas, parcours: readonly Pas[]): Pas =>
  parcours[parcours.indexOf(pas) + 1] ?? 'note';

function choixOuiNon(
  value: boolean | null,
  choisir: (valeur: boolean) => void,
  aides: readonly [string, string] | null = null,
): Choix[] {
  return [
    {
      cle: 'oui',
      label: 'Oui',
      ...(aides === null ? {} : { aide: aides[0] }),
      actif: value === true,
      choisir: () => {
        choisir(true);
      },
    },
    {
      cle: 'non',
      label: 'Non',
      ...(aides === null ? {} : { aide: aides[1] }),
      actif: value === false,
      choisir: () => {
        choisir(false);
      },
    },
  ];
}

/** Ce que le statut entraîne, dit avant de cliquer. */
function aideDuStatut(
  statut: StatutQualification,
  statuts: readonly StatutQualification[],
): string | undefined {
  if (sousStatutsDe(statuts, statut.id).length > 0) return 'Puis une précision';
  if (dateDemandee(statut)) return 'Puis la date et l’heure';
  if (exigeMotif(statut)) return 'Puis le motif';
  return undefined;
}

const choixStatut = (
  statut: StatutQualification,
  statuts: readonly StatutQualification[],
  actif: boolean,
  choisir: () => void,
): Choix => {
  const aide = aideDuStatut(statut, statuts);
  return {
    cle: statut.id,
    label: libelleStatut(statut),
    ...(aide === undefined ? {} : { aide }),
    actif,
    choisir,
  };
};

const raccourcisDe = (choix: readonly Choix[]): Record<string, () => void> =>
  Object.fromEntries(choix.slice(0, 9).map((item, rang) => [String(rang + 1), item.choisir]));

/** Un champ texte posé sous la réponse qui l'ouvre. */
function ChampTexte({
  id,
  label,
  value,
  inputMode,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  inputMode?: 'tel';
  placeholder?: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <div className={cn('flex max-w-80 flex-col gap-1.5', REVELE)}>
      <label htmlFor={id} className="text-[0.875rem] font-[600]">
        {label}
      </label>
      <Input
        id={id}
        autoComplete="off"
        maxLength={160}
        {...(inputMode === undefined ? {} : { inputMode })}
        {...(placeholder === undefined ? {} : { placeholder })}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/** Retour à chaque pas ; la suite quand le pas ne se tranche pas d'un clic. */
function PiedPas({
  premier,
  suite,
  disabled,
  suiteDesactivee,
  onRetour,
  onSuite,
  onPasser,
}: {
  premier: boolean;
  suite: Suite | null;
  disabled: boolean;
  suiteDesactivee: boolean;
  onRetour: () => void;
  onSuite: () => void;
  onPasser: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {premier ? null : (
        <Button variant="outline" disabled={disabled} onClick={onRetour}>
          Retour
          <Kbd>Échap</Kbd>
        </Button>
      )}
      {suite?.passer === undefined ? null : (
        <Button variant="ghost" disabled={disabled} onClick={onPasser}>
          {suite.passer}
        </Button>
      )}
      {suite === null ? null : (
        <Button disabled={disabled || suiteDesactivee} onClick={onSuite}>
          {suite.libelle}
          <Kbd>Entrée</Kbd>
        </Button>
      )}
    </div>
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

interface Reponses {
  resultat: Resultat | null;
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  syndicatName: string;
  ambassadeur: boolean | null;
  memeWhatsapp: boolean | null;
  whatsapp: string;
  statut: StatutQualification | null;
  statuts: readonly StatutQualification[];
  rappelAt: string | null;
  now: number;
  personneProposee: string | null;
}

function ouiNon(valeur: boolean | null, oui: string, non: string): string | null {
  if (valeur === null) return null;
  return valeur ? oui : non;
}

function recapEcole(confirme: boolean | null, nouvel: string): string | null {
  const ecole = recapEtablissement(confirme, nouvel);
  if (ecole === null) return null;
  return ecole === 'Confirmé' ? 'École confirmée' : `École : ${ecole}`;
}

function recapWhatsapp(meme: boolean | null, numero: string): string | null {
  if (meme === null) return null;
  return meme ? 'WhatsApp sur ce numéro' : `WhatsApp : ${numero.trim() || 'à saisir'}`;
}

function recapStatut(
  statut: StatutQualification | null,
  statuts: readonly StatutQualification[],
): string | null {
  if (statut === null) return null;
  const parent = statuts.find((ligne) => ligne.id === statut.parentId);
  return parent === undefined
    ? libelleStatut(statut)
    : `${libelleStatut(parent)} › ${statut.label}`;
}

/** Ce qui est déjà tranché, rappelé au-dessus du pas en cours. */
function recapDe(r: Reponses): string[] {
  const lignes = [
    ouiNon(r.resultat === null ? null : r.resultat === 'JOIGNABLE', 'A répondu', 'N’a pas répondu'),
    recapEcole(r.etablissementConfirme, r.nouvelEtablissement),
    ouiNon(r.contacte, 'Déjà contacté', 'Jamais contacté'),
    ouiNon(r.connaitUES, 'Connaît l’UES', 'Ne connaît pas l’UES'),
    r.syndicatName === '' ? null : r.syndicatName,
    ouiNon(r.ambassadeur, 'Accepte d’être représentant', 'Refuse d’être représentant'),
    recapWhatsapp(r.memeWhatsapp, r.whatsapp),
    recapStatut(r.statut, r.statuts),
    r.rappelAt === null ? null : `Rappel ${formatCallbackAt(r.rappelAt, r.now)}`,
    r.personneProposee === null ? null : `Propose ${r.personneProposee}`,
  ];
  return lignes.filter((ligne): ligne is string => ligne !== null);
}

/** Ce qu'une relation DÉJÀ TRANCHÉE ajoute à la confirmation d'ouverture. */
function relationTrancheeTexte(row: ScriptedRepresentant): string | null {
  if (!repRelationSettled(row)) return null;
  return row.relationStatus === 'AMBASSADEUR'
    ? 'Cette personne a déjà accepté d’être représentant CPI CHUES.'
    : 'Cette personne a déjà refusé.';
}

/**
 * Ce que les appels précédents ont donné, en lecture seule. Rien ne s'y modifie :
 * une nouvelle qualification ajoute une entrée, elle n'en réécrit aucune.
 */
function HistoriqueAppels({ representantId }: { representantId: string }) {
  const appels = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'appels'] as const,
    queryFn: () => fetchRepresentantCallAttempts(representantId),
  });

  if (appels.isPending) return <Skeleton className="mt-2 h-20 w-full" />;
  if (appels.isError || appels.data.length === 0) return null;

  return (
    <div className="mt-2 max-h-64 overflow-y-auto scrollbar-thin">
      <AppelsRepresentant items={appels.data} />
    </div>
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
        <RelationBadge
          status={representant.relationStatus}
          label={representant.statutQualificationLabel}
          effect={representant.statutQualificationEffect}
          lastCallOutcome={representant.lastCallOutcome}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="select-all font-display text-[1.5rem] font-[700] tracking-[-0.02em] tabular-nums">
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

interface QualificationDerivee {
  statuts: readonly StatutQualification[];
  statutPose: StatutQualification | null;
  statutChoisi: StatutQualification | null;
  statut: StatutQualification | null;
  proposeQuelquUn: boolean;
  suggestionCommencee: boolean;
}

/** Accepté et Refusé restent dans la liste : le téléconseiller qui ne voit pas
 * que la question les a posés les y cherche. Les choisir répond à la question. */
function deriverQualification(
  referentiel: readonly StatutQualification[],
  joignable: boolean,
  ambassadeur: boolean | null,
  statutId: string | null,
  sugPhone: string,
  sugName: string,
  sugNote: string,
): QualificationDerivee {
  const statuts = statutsDeLaBranche(referentiel, joignable);
  const statutPose = joignable ? statutDuSouhait(statuts, ambassadeur) : null;
  const statutChoisi = statuts.find((ligne) => ligne.id === statutId) ?? null;
  return {
    statuts,
    statutPose,
    statutChoisi,
    statut: statutChoisi ?? statutPose,
    proposeQuelquUn: joignable && ambassadeur === false,
    suggestionCommencee: sugPhone.trim() !== '' || sugName.trim() !== '' || sugNote.trim() !== '',
  };
}

function syndicatsDe(
  reference: Awaited<ReturnType<typeof fetchReferenceData>> | undefined,
  syndicatId: string | null,
): { options: { value: string; label: string; hint: string }[]; name: string } {
  const syndicats = reference?.syndicats ?? [];
  return {
    options: syndicats
      .filter((syndicat) => syndicat.isActive === true)
      .map((syndicat) => ({
        value: syndicat.id,
        label: syndicat.name ?? '',
        hint: syndicat.sigle ?? '',
      })),
    name: syndicats.find((syndicat) => syndicat.id === syndicatId)?.name ?? '',
  };
}

const TEXTE_MANQUE: Readonly<Partial<Record<Pas, string>>> = {
  reponse: 'Dites d’abord si la personne a répondu.',
  representant: 'Dites s’il accepte d’être représentant CHUES.',
  statut: 'Choisissez un statut.',
  note: 'Écrivez le motif.',
  echeance: 'Choisissez quand rappeler.',
};

/** Le pas où il manque encore une réponse, ou rien : l'appel peut partir. */
function pasManquant(etat: {
  resultat: Resultat | null;
  statut: StatutQualification | null;
  statutChoisi: StatutQualification | null;
  ambassadeur: boolean | null;
  commentaire: string;
  rappelAt: string | null;
}): Pas | null {
  if (etat.resultat === null) return 'reponse';
  // Sans statut retenu à part, c'est la réponse à la question qui le pose.
  if (etat.resultat === 'JOIGNABLE' && etat.statutChoisi === null && etat.ambassadeur === null) {
    return 'representant';
  }
  if (etat.statut === null) return 'statut';
  if (exigeMotif(etat.statut) && etat.commentaire.trim() === '') return 'note';
  if (dateDemandee(etat.statut) && etat.rappelAt === null) return 'echeance';
  return null;
}

interface EtatReponse {
  statut: StatutQualification;
  joignable: boolean;
  ambassadeur: boolean | null;
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

function champsRelation(etat: EtatReponse): Partial<RepAnswer> {
  if (!etat.joignable || etat.ambassadeur === null) return {};
  return { relationStatus: etat.ambassadeur ? ('AMBASSADEUR' as const) : ('REFUS' as const) };
}

function champsWhatsapp(etat: EtatReponse): Partial<RepAnswer> {
  if (!etat.joignable || etat.ambassadeur !== true || etat.memeWhatsapp === null) return {};
  const meme = etat.memeWhatsapp === true;
  return {
    whatsappStatus: meme ? ('MEME_NUMERO' as const) : ('AUTRE_NUMERO' as const),
    ...(meme ? {} : { whatsappE164: etat.whatsapp.trim() }),
  };
}

function champsSuggestion(etat: EtatReponse): Partial<RepAnswer> {
  if (!etat.proposeQuelquUn || !etat.suggestionCommencee || digitsOf(etat.sugPhone) < 9) return {};
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
    ...champsRelation(etat),
    ...champsJoignable(etat),
    ...champsWhatsapp(etat),
    ...(dateDemandee(etat.statut) && etat.rappelAt !== null ? { callbackAt: etat.rappelAt } : {}),
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
  ouverture,
  onAbandon,
  onEnregistre,
}: {
  representant: ScriptedRepresentant;
  ouverture: OuvertureFiche;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const [repris] = useState(() => lireBrouillonRep(ouverture.draft));
  const [pas, setPas] = useState<Pas>('reponse');
  const [resultat, setResultat] = useState<Resultat | null>(repris.resultat);
  const [statutId, setStatutId] = useState<string | null>(repris.statutId);
  const [etablissementConfirme, setEtablissementConfirme] = useState<boolean | null>(
    repris.etablissementConfirme,
  );
  const [nouvelEtablissement, setNouvelEtablissement] = useState(repris.nouvelEtablissement);
  const [contacte, setContacte] = useState<boolean | null>(repris.contacte);
  const [connaitUES, setConnaitUES] = useState<boolean | null>(repris.connaitUES);
  const [syndicatId, setSyndicatId] = useState<string | null>(repris.syndicatId);
  const [ambassadeur, setAmbassadeur] = useState<boolean | null>(repris.ambassadeur);
  const [memeWhatsapp, setMemeWhatsapp] = useState<boolean | null>(repris.memeWhatsapp);
  const [whatsapp, setWhatsapp] = useState(repris.whatsapp);
  const [rappelAt, setRappelAt] = useState<string | null>(repris.rappelAt);
  const [sugPhone, setSugPhone] = useState(repris.sugPhone);
  const [sugName, setSugName] = useState(repris.sugName);
  const [sugNote, setSugNote] = useState(repris.sugNote);
  const [commentaire, setCommentaire] = useState(repris.commentaire);
  const commentaireRef = useRef<HTMLTextAreaElement>(null);
  const [edit, setEdit] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [now] = useState(() => Date.now());

  const { depuis: departChrono, enAttente: brouillonEnAttente } = useBrouillonAuto(ouverture, {
    resultat,
    statutId,
    etablissementConfirme,
    nouvelEtablissement,
    contacte,
    connaitUES,
    syndicatId,
    ambassadeur,
    memeWhatsapp,
    whatsapp,
    rappelAt,
    sugPhone,
    sugName,
    sugNote,
    commentaire,
  });

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
    mutationFn: (answer: RepAnswer) =>
      pushRepCallAttempt(
        buildRepAttempt(representant.id, { ...answer, ouvertureId: ouverture.id }),
      ),
    onSuccess: () => {
      toast.success(`Appel enregistré pour ${representant.fullName}.`);
      onEnregistre(representant.fullName);
    },
    onError: (error) => {
      toastApiError(error, 'La réponse n’a pas été enregistrée.');
    },
  });

  const joignable = resultat === 'JOIGNABLE';
  const { statuts, statutPose, statutChoisi, statut, proposeQuelquUn, suggestionCommencee } =
    deriverQualification(
      referentielStatuts.data ?? [],
      joignable,
      ambassadeur,
      statutId,
      sugPhone,
      sugName,
      sugNote,
    );

  const {
    racineRetenue,
    sousStatuts,
    parcours,
    rang,
    manque,
    motifObligatoire,
    personneProposee,
    suite,
    question,
  } = deriverPas({
    pas,
    resultat,
    joignable,
    ambassadeur,
    statut,
    statutChoisi,
    statutPose,
    statuts,
    commentaire,
    rappelAt,
    etablissementConfirme,
    memeWhatsapp,
    proposeQuelquUn,
    suggestionCommencee,
    sugPhone,
    sugName,
  });

  function enregistrer(): void {
    if (send.isPending) return;
    if (manque !== null) {
      setPas(manque);
      return;
    }
    if (resultat === null || statut === null) return;
    send.mutate(
      reponseDe({
        statut,
        joignable,
        ambassadeur,
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
  }

  function precedent(): void {
    if (rang === 0) {
      onAbandon();
      return;
    }
    setPas(parcours[rang - 1] ?? 'reponse');
  }

  function choisirResultat(valeur: Resultat): void {
    setResultat(valeur);
    // Chaque branche a ses propres statuts : celui d'en face ne vaut plus.
    setStatutId(null);
    if (valeur !== 'JOIGNABLE') {
      setEtablissementConfirme(null);
      setContacte(null);
      setConnaitUES(null);
      setAmbassadeur(null);
      setMemeWhatsapp(null);
      setRappelAt(null);
    }
    setPas(valeur === 'JOIGNABLE' ? 'ecole' : 'statut');
  }

  function choisirEcole(valeur: boolean): void {
    setEtablissementConfirme(valeur);
    if (!valeur) return;
    setNouvelEtablissement('');
    setPas('contacte');
  }

  function choisirContacte(valeur: boolean): void {
    setContacte(valeur);
    setPas('ues');
  }

  function choisirUES(valeur: boolean): void {
    setConnaitUES(valeur);
    setPas('syndicat');
  }

  function choisirAmbassadeur(valeur: boolean): void {
    setAmbassadeur(valeur);
    if (!valeur) setMemeWhatsapp(null);
    setPas(valeur ? 'whatsapp' : 'statut');
  }

  function choisirMemeWhatsapp(valeur: boolean): void {
    setMemeWhatsapp(valeur);
    if (valeur) setPas('statut');
  }

  // Un numéro qui n'a pas répondu se retente : le réessai arrive préréglé au
  // délai du statut, le téléconseiller le déplace s'il veut.
  function choisirStatut(id: string): void {
    setStatutId(id);
    const choisi = statuts.find((ligne) => ligne.id === id) ?? null;
    const souhait = souhaitDuStatut(choisi);
    if (souhait !== null) setAmbassadeur(souhait);
    setRappelAt(rappelInitialDuStatut(choisi, now));
    const suite = parcoursDe(
      resultat,
      souhait ?? ambassadeur,
      sousStatutsDe(statuts, id).length > 0,
      choisi !== null && dateDemandee(choisi),
    );
    setPas(suivantDe('statut', suite));
  }

  function choisirPrecision(id: string | null): void {
    const retenu = statuts.find((ligne) => ligne.id === id) ?? racineRetenue;
    setStatutId(retenu?.id ?? null);
    setRappelAt(rappelInitialDuStatut(retenu, now));
    const suite = parcoursDe(resultat, ambassadeur, true, retenu !== null && dateDemandee(retenu));
    setPas(suivantDe('precision', suite));
  }

  function continuer(): void {
    if (pas === 'note') {
      enregistrer();
      return;
    }
    if (pas === 'precision') {
      choisirPrecision(null);
      return;
    }
    if (pas === 'echeance' && rappelAt === null) return;
    setPas(suivantDe(pas, parcours));
  }

  function passer(): void {
    if (pas === 'syndicat') setSyndicatId(null);
    if (pas === 'recommande') {
      setSugPhone('');
      setSugName('');
      setSugNote('');
    }
    setPas(suivantDe(pas, parcours));
  }

  function choixQuestions(): Choix[] {
    switch (pas) {
      case 'reponse':
        return [
          {
            cle: 'oui',
            label: 'Oui, elle a répondu',
            aide: 'Puis les questions du script',
            actif: resultat === 'JOIGNABLE',
            choisir: () => {
              choisirResultat('JOIGNABLE');
            },
          },
          {
            cle: 'non',
            label: 'Non, elle n’a pas répondu',
            aide: 'Puis la raison',
            actif: resultat === 'INJOIGNABLE',
            choisir: () => {
              choisirResultat('INJOIGNABLE');
            },
          },
        ];
      case 'ecole':
        return choixOuiNon(etablissementConfirme, choisirEcole);
      case 'contacte':
        return choixOuiNon(contacte, choisirContacte);
      case 'ues':
        return choixOuiNon(connaitUES, choisirUES);
      case 'representant':
        return choixOuiNon(ambassadeur, choisirAmbassadeur, [
          'Puis son WhatsApp',
          'Puis quelqu’un à recommander',
        ]);
      case 'whatsapp':
        return choixOuiNon(memeWhatsapp, choisirMemeWhatsapp);
      default:
        return [];
    }
  }

  function choixStatuts(): Choix[] {
    if (pas === 'precision') {
      return sousStatuts.map((ligne) => ({
        cle: ligne.id,
        label: ligne.label,
        actif: statutChoisi?.id === ligne.id,
        choisir: () => {
          choisirPrecision(ligne.id);
        },
      }));
    }
    return statutsRacine(statuts).map((ligne) =>
      choixStatut(ligne, statuts, ligne.id === racineRetenue?.id, () => {
        choisirStatut(ligne.id);
      }),
    );
  }

  const choix = question === null ? [] : choixDuPas(pas, choixStatuts, choixQuestions);
  const recap = recapDe({
    resultat,
    etablissementConfirme,
    nouvelEtablissement,
    contacte,
    connaitUES,
    syndicatName,
    ambassadeur,
    memeWhatsapp,
    whatsapp,
    statut,
    statuts,
    rappelAt,
    now,
    personneProposee,
  });

  useShortcuts(
    {
      Escape: precedent,
      c: () => {
        copyPhone(representant.phoneE164);
      },
      e: () => {
        setEdit(true);
      },
      '?': () => {
        setHelpOpen((open) => !open);
      },
      ...raccourcisDe(choix),
      ...(suite === null ? {} : { Enter: continuer }),
    },
    !edit,
  );

  function complement(): React.ReactNode {
    if (pas === 'ecole' && etablissementConfirme === false) {
      return (
        <ChampTexte
          id="rep-etablissement"
          label="Quelle école ?"
          value={nouvelEtablissement}
          onChange={setNouvelEtablissement}
        />
      );
    }
    if (pas === 'whatsapp' && memeWhatsapp === false) {
      return (
        <ChampTexte
          id="rep-whatsapp"
          label="Son numéro WhatsApp"
          inputMode="tel"
          placeholder="77 123 45 67"
          value={whatsapp}
          onChange={setWhatsapp}
        />
      );
    }
    if (pas === 'statut' && statutChoisi === null && statutPose !== null) {
      return (
        <p className="text-[0.8125rem] text-muted-foreground">
          Posé par votre réponse. Continuez, ou choisissez-en un autre.
        </p>
      );
    }
    return null;
  }

  function corpsLibre(): React.ReactNode {
    if (pas === 'syndicat') {
      return (
        <Question titre="Sur quel syndicat ?">
          <FilterCombobox
            className="max-w-80"
            label=""
            placeholder="Choisir un syndicat"
            value={syndicatId}
            options={syndicatOptions}
            onChange={setSyndicatId}
          />
        </Question>
      );
    }
    if (pas === 'echeance') {
      return (
        <Question titre="Quand rappeler ?">
          <ChoixEcheance now={now} value={rappelAt} onChange={setRappelAt} />
        </Question>
      );
    }
    if (pas === 'recommande') {
      return (
        <QuestionSuggestion
          sugPhone={sugPhone}
          setSugPhone={setSugPhone}
          sugName={sugName}
          setSugName={setSugName}
          sugNote={sugNote}
          setSugNote={setSugNote}
        />
      );
    }
    return (
      <>
        <Commentaire
          value={commentaire}
          titre={motifObligatoire ? 'Motif' : 'Commentaire, facultatif'}
          obligatoirePour={motifObligatoire && statut !== null ? libelleStatut(statut) : null}
          inputRef={commentaireRef}
          onChange={setCommentaire}
          onValidate={enregistrer}
        />
        {manque === null ? null : (
          <p role="alert" className="text-[0.875rem] text-warning">
            {TEXTE_MANQUE[manque]}
          </p>
        )}
      </>
    );
  }

  return (
    <EcranPas
      representant={representant}
      departChrono={departChrono}
      brouillonEnAttente={brouillonEnAttente}
      etapes={parcours.map((item) => LIBELLES_PAS[item])}
      rang={rang}
      recap={recap}
      pied={{
        suite,
        suiteDesactivee: pas === 'echeance' && rappelAt === null,
        onRetour: precedent,
        onSuite: continuer,
        onPasser: passer,
      }}
      pending={send.isPending}
      helpOpen={helpOpen}
      edit={edit}
      onAllerA={(cible) => {
        setPas(parcours[cible] ?? 'reponse');
      }}
      onHelp={setHelpOpen}
      onEdit={setEdit}
    >
      {question === null ? (
        corpsLibre()
      ) : (
        <>
          <Palier
            question={question}
            choix={choix}
            raccourcis
            vide={AUCUN_MOTIF}
            disabled={send.isPending}
          />
          {complement()}
        </>
      )}
    </EcranPas>
  );
}

const choixDuPas = (pas: Pas, statuts: () => Choix[], questions: () => Choix[]): Choix[] =>
  pas === 'statut' || pas === 'precision' ? statuts() : questions();

interface EtatPas {
  pas: Pas;
  resultat: Resultat | null;
  joignable: boolean;
  ambassadeur: boolean | null;
  statut: StatutQualification | null;
  statutChoisi: StatutQualification | null;
  statutPose: StatutQualification | null;
  statuts: readonly StatutQualification[];
  commentaire: string;
  rappelAt: string | null;
  etablissementConfirme: boolean | null;
  memeWhatsapp: boolean | null;
  proposeQuelquUn: boolean;
  suggestionCommencee: boolean;
  sugPhone: string;
  sugName: string;
}

/** Tout ce que le pas courant déduit des réponses : le parcours, ce qui manque, la question posée. */
function deriverPas(e: EtatPas) {
  const racineRetenue =
    e.statutChoisi === null
      ? e.statutPose
      : (e.statuts.find((ligne) => ligne.id === e.statutChoisi?.parentId) ?? e.statutChoisi);
  const sousStatuts = sousStatutsDe(e.statuts, racineRetenue?.id ?? null);
  const parcours = parcoursDe(
    e.resultat,
    e.ambassadeur,
    sousStatuts.length > 0,
    e.statut !== null && dateDemandee(e.statut),
  );
  const personneProposee =
    e.proposeQuelquUn && e.suggestionCommencee
      ? [e.sugPhone.trim(), e.sugName.trim()].filter(Boolean).join(' · ')
      : null;
  return {
    racineRetenue,
    sousStatuts,
    parcours,
    rang: Math.max(parcours.indexOf(e.pas), 0),
    manque: pasManquant(e),
    motifObligatoire: e.statut !== null && exigeMotif(e.statut),
    personneProposee,
    suite: suiteDe(e.pas, {
      ecoleInfirmee: e.etablissementConfirme === false,
      autreWhatsapp: e.memeWhatsapp === false,
      statutRetenu: e.statut !== null,
    }),
    question: questionDe(e.pas, e.joignable),
  };
}

/** La coque du pas en cours : en-tête, progression, réponses déjà données, le pas, son pied. */
function EcranPas({
  representant,
  departChrono,
  brouillonEnAttente,
  etapes,
  rang,
  recap,
  pied,
  pending,
  helpOpen,
  edit,
  onAllerA,
  onHelp,
  onEdit,
  children,
}: {
  representant: ScriptedRepresentant;
  departChrono: string | null;
  brouillonEnAttente: boolean;
  etapes: readonly string[];
  rang: number;
  recap: readonly string[];
  pied: {
    suite: Suite | null;
    suiteDesactivee: boolean;
    onRetour: () => void;
    onSuite: () => void;
    onPasser: () => void;
  };
  pending: boolean;
  helpOpen: boolean;
  edit: boolean;
  onAllerA: (rang: number) => void;
  onHelp: (open: boolean) => void;
  onEdit: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {departChrono === null ? null : <Chrono firstInputAt={departChrono} />}
      </div>
      <BrouillonEnAttente enAttente={brouillonEnAttente} />

      <EnTeteRepresentant representant={representant} />

      {representant.callAttemptCount === 0 ? null : (
        <details className="rounded-lg border border-border bg-card px-4 py-2">
          <summary className="cursor-pointer text-[0.875rem] font-[600]">
            Appels précédents ({representant.callAttemptCount})
          </summary>
          <HistoriqueAppels representantId={representant.id} />
        </details>
      )}

      <EtapesProgression etapes={etapes} courante={rang} maximum={rang} onChoisir={onAllerA} />

      {recap.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Réponses déjà données">
          {recap.map((item) => (
            <li key={item}>
              <Badge variant="secondary">{item}</Badge>
            </li>
          ))}
        </ul>
      )}

      {children}

      <PiedPas
        premier={rang === 0}
        suite={pied.suite}
        disabled={pending}
        suiteDesactivee={pied.suiteDesactivee}
        onRetour={pied.onRetour}
        onSuite={pied.onSuite}
        onPasser={pied.onPasser}
      />

      <details
        open={helpOpen}
        onToggle={(event) => {
          onHelp(event.currentTarget.open);
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
          onEdit(true);
        }}
      >
        <PencilIcon aria-hidden="true" />
        Corriger la fiche
      </Button>

      {edit ? (
        <RepresentantFormDialog
          open
          onOpenChange={onEdit}
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

/**
 * Les créneaux d'un clic, puis « Choisir une date » : calendrier natif du
 * navigateur, puis les demi-heures ouvrées du jour retenu. Même découpage que
 * la feuille du mobile, sans embarquer de bibliothèque de calendrier.
 */
/** Le statut demande une date : rappel promis, ou réessai d'un numéro sans réponse. */
function dateDemandee(statut: { requiresCallback: boolean; retryAfterMinutes: number | null }) {
  return statut.requiresCallback || statut.retryAfterMinutes !== null;
}

/** Le réessai du statut choisi, préréglé, sauf s'il exige un rappel promis. */
function rappelInitialDuStatut(
  statut: { retryAfterMinutes: number | null; requiresCallback: boolean } | null,
  now: number,
): string | null {
  const reessai = statut?.retryAfterMinutes ?? null;
  if (reessai === null || statut?.requiresCallback === true) return null;
  return new Date(now + reessai * 60_000).toISOString();
}

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
