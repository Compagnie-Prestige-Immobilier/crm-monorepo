'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { AUCUN_MOTIF, Palier, type Choix } from '@/components/console/console-paliers';
import {
  brouillonDe,
  choixDe,
  Commentaire,
  draftDe,
  MOTIFS_SYSTEME,
  PanneauDossier,
  qualificationDe,
  statutsJoignables,
  titreEcheance,
} from '@/components/console/console-view';
import { PanneauEcheance } from '@/components/console/panneau-echeance';
import { useRvSite } from '@/components/console/rendez-vous-site';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { toInternationalE164 } from '@/components/forms/international-phone-field';
import { EtapesProgression } from '@/components/grand-public/etapes';
import { Button } from '@/components/ui/button';
import {
  commentaireExigePar,
  fetchMotifsAppel,
  sousMotifsDe,
  type MotifAppel,
} from '@/lib/data/call-outcome-reasons';
import { useChampsConversion } from '@/lib/data/champs-conversion';
import { fetchCanauxProvenance, grandPublicKeys } from '@/lib/data/grand-public';
import { ouvrirFiche } from '@/lib/data/ouvertures';
import {
  AttemptRefused,
  callbackKeys,
  conversionErrorFor,
  dossierVide,
  newAttemptInput,
  callbackSlots,
  pushCallAttempt,
  validateAttempt,
  validateConversion,
  type AttemptDraft,
  type CallbackSlot,
  type ChampReglable,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import {
  createProspect,
  prospectPhoneConflict,
  type CreateProspectInput,
} from '@/lib/data/prospects';
import { dakarLocalToIso } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet, ProspectRow } from '@/lib/types';

const maintenant = (): number => Date.now();
const INDICATIF = '221';
const TRANCHES: readonly (readonly ChampReglable[])[] = [
  ['nom', 'prenom', 'phoneE164', 'whatsappStatus', 'whatsappE164', 'email'],
  ['profession', 'dureeEtablissementMois', 'type', 'syndicatId', 'banqueId', 'engagementEnCours'],
  ['incomeBandId', 'paymentMode', 'dureeSystemeMois', 'method', 'rendezVousAt'],
];
const ERREURS_IDENTITE = ['nom', 'prenom', 'email'] as const;
const ERREURS_SITUATION = [
  'profession',
  'dureeEtablissementMois',
  'fonctionnaire',
  'type',
  'syndicatId',
  'banqueId',
  'engagementEnCours',
] as const;

function renseigne(cle: string, valeur: string | number | null): Record<string, string | number> {
  return valeur === null || valeur === '' ? {} : { [cle]: valeur };
}

function creationDepuis(
  dossier: ConversionDraft,
  phone: string,
  canalProvenanceId: string | null,
): Omit<CreateProspectInput, 'projet'> {
  const dureeSystemeMois = dossier.dureeSystemeMois.trim();
  return {
    nom: dossier.nom.trim(),
    phone,
    ...renseigne('prenom', dossier.prenom.trim()),
    ...renseigne('profession', dossier.profession.trim()),
    ...renseigne('type', dossier.type),
    ...renseigne('syndicatId', dossier.syndicatId),
    ...renseigne('banqueId', dossier.banqueId),
    ...renseigne('incomeBandId', dossier.incomeBandId),
    ...renseigne('paymentMode', dossier.paymentMode),
    ...renseigne('dureeSystemeMois', dureeSystemeMois === '' ? null : Number(dureeSystemeMois)),
    ...renseigne('canalProvenanceId', canalProvenanceId),
    ...(Object.keys(dossier.champsLibres).length === 0
      ? {}
      : { champsLibres: dossier.champsLibres }),
  };
}

function erreursIdentite({ nom, prenom, libres }: ConversionErrors): ConversionErrors {
  return {
    ...(nom === undefined ? {} : { nom }),
    ...(prenom === undefined ? {} : { prenom }),
    ...(libres === undefined ? {} : { libres }),
  };
}

function erreurTelephone(saisi: string, e164: string | null): string | undefined {
  if (saisi.trim() === '') return 'Le numéro est obligatoire.';
  return e164 === null ? 'Numéro invalide.' : undefined;
}

function etapePourErreurs(problemes: ConversionErrors): number {
  if (ERREURS_IDENTITE.some((cle) => problemes[cle] !== undefined)) return 0;
  if (ERREURS_SITUATION.some((cle) => problemes[cle] !== undefined)) return 1;
  return 2;
}

async function consignerSur(
  prospectId: string,
  appel: AttemptDraft,
  brouillon: Record<string, unknown>,
): Promise<void> {
  const ouverture =
    appel.effect === 'SCHEDULE_CALLBACK'
      ? await ouvrirFiche({ prospectId, draft: brouillon }).catch(() => null)
      : null;
  await pushCallAttempt(
    newAttemptInput(
      prospectId,
      ouverture === null ? appel : { ...appel, ouvertureId: ouverture.id },
    ),
  );
}

function problemesAdhesion(
  adhesion: boolean,
  sansAppel: boolean,
  dossier: ConversionDraft,
  formulaire: ReturnType<typeof useChampsConversion>,
): ConversionErrors {
  if (!adhesion || sansAppel) return {};
  return validateConversion(dossier, maintenant(), formulaire.champs, formulaire.libres, true);
}

function appelCree(
  sansAppel: boolean,
  motif: MotifAppel | null,
  callbackAt: string | null,
  dossier: ConversionDraft,
  comment: string,
): AttemptDraft | null {
  if (sansAppel || motif === null) return null;
  return draftDe(motif, callbackAt, dossier, comment, null);
}

type Pas =
  | 'contact'
  | 'canal'
  | 'identite'
  | 'situation'
  | 'revenus'
  | 'statut'
  | 'precision'
  | 'echeance'
  | 'note'
  | 'projet';

const LIBELLES_PAS: Readonly<Record<Pas, string>> = {
  contact: 'Contact',
  canal: 'Canal',
  identite: 'Identité',
  situation: 'Situation',
  revenus: 'Revenus',
  statut: 'Statut',
  precision: 'Précision',
  echeance: 'Échéance',
  note: 'Note',
  projet: 'Projet',
};

const TRANCHES_PAS: readonly Pas[] = ['identite', 'situation', 'revenus'];

function parcoursDe(avecPrecision: boolean, rappelDemande: boolean): Pas[] {
  const pas: Pas[] = ['contact', 'canal', 'identite', 'situation', 'revenus', 'statut'];
  if (avecPrecision) pas.push('precision');
  if (rappelDemande) pas.push('echeance');
  pas.push('note', 'projet');
  return pas;
}

interface Envoi {
  projet: Projet;
  dossier: ConversionDraft;
  phone: string;
  appel: AttemptDraft | null;
  comment: string;
}

/** La console d'appel sans « Réponse » : la fiche se crée au choix du projet, puis l'appel s'y consigne. */
export function NouveauProspectConsole({
  representantId = null,
  onSaved,
  onAnnuler,
}: {
  representantId?: string | null;
  onSaved: () => void;
  onAnnuler: () => void;
}) {
  const queryClient = useQueryClient();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);
  // Créée mais l'appel refusé : la reprise ne doit pas la créer une seconde fois.
  const cree = useRef<ProspectRow | null>(null);

  const [pas, setPas] = useState<Pas>('contact');
  const [canalProvenanceId, setCanalProvenanceId] = useState<string | null>(null);
  const [sansAppel, setSansAppel] = useState(false);
  const [conversion, setConversion] = useState<ConversionDraft>(() => dossierVide('GRAND_PUBLIC'));
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<ConversionErrors>({});
  const [statut, setStatut] = useState<MotifAppel | null>(null);
  const [precision, setPrecision] = useState<MotifAppel | null>(null);
  const [callbackAt, setCallbackAt] = useState<string | null>(null);
  const [slots, setSlots] = useState<readonly CallbackSlot[]>([]);
  const [freeCallback, setFreeCallback] = useState('');
  const [comment, setComment] = useState('');
  const [now] = useState(maintenant);

  const formulaire = useChampsConversion('GRAND_PUBLIC');
  const canaux = useQuery({
    queryKey: grandPublicKeys.canaux,
    queryFn: () => fetchCanauxProvenance(),
    staleTime: 300_000,
  });
  const motifs = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    staleTime: 300_000,
  });
  const catalogue = motifs.data ?? MOTIFS_SYSTEME;
  const e164 = toInternationalE164(phone, INDICATIF);
  const { motif, adhesion, rappelDemande } = qualificationDe(statut, precision, conversion);
  const rvSite = useRvSite(motif?.code);
  const precisions = statut === null ? [] : sousMotifsDe(catalogue, statut.id);
  const parcours = parcoursDe(precisions.length > 0, rappelDemande);
  const rang = Math.max(parcours.indexOf(pas), 0);

  const save = useMutation({
    mutationFn: async (envoi: Envoi): Promise<ProspectRow> => {
      const input = {
        ...creationDepuis(envoi.dossier, envoi.phone, canalProvenanceId),
        projet: envoi.projet,
        ...(representantId === null ? {} : { representantId }),
      };
      const prospect = cree.current ?? (await createProspect(input));
      cree.current = prospect;
      if (envoi.appel !== null) {
        await consignerSur(prospect.id, envoi.appel, brouillonDe(envoi.comment, envoi.dossier));
      }
      return prospect;
    },
    onSuccess: (prospect) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
      toast.success(`${prospect.prenom} ${prospect.nom}`.trim() + ' enregistré.');
      onSaved();
    },
    onError: (error) => {
      const existant = prospectPhoneConflict(error);
      if (existant !== null) {
        setPhoneError(`Ce numéro est déjà enregistré pour ${existant.prenom} ${existant.nom}.`);
        setPas('identite');
        return;
      }
      if (!(error instanceof AttemptRefused)) {
        toastApiError(error, 'Le prospect n’a pas pu être enregistré.');
        return;
      }
      const refuse = conversionErrorFor(error.code);
      if (refuse !== null) setErrors({ [refuse.field]: refuse.message });
      toast.error(error.message, { description: 'La fiche est créée. Corrigez puis réessayez.' });
    },
  });

  const allerA = (cible: Pas): void => {
    if (cible === 'echeance') setSlots(callbackSlots(maintenant()));
    setPas(cible);
  };

  const pasApresMotif = (retenu: MotifAppel): Pas =>
    !adhesion && retenu.requiresCallback ? 'echeance' : 'note';

  const quitterFormulaire = (): void => {
    const erreurTel = erreurTelephone(phone, e164);
    const identite = erreursIdentite(
      validateConversion(conversion, maintenant(), formulaire.champs, formulaire.libres),
    );
    setPhoneError(erreurTel);
    setErrors(identite);
    if (erreurTel === undefined && Object.keys(identite).length === 0) setPas('situation');
  };

  const choisirStatut = (choisi: MotifAppel): void => {
    setSansAppel(false);
    setStatut(choisi);
    setPrecision(null);
    setCallbackAt(null);
    allerA(sousMotifsDe(catalogue, choisi.id).length > 0 ? 'precision' : pasApresMotif(choisi));
  };

  const choisirPrecision = (choisie: MotifAppel | null): void => {
    if (statut === null) return;
    setPrecision(choisie);
    setCallbackAt(null);
    allerA(pasApresMotif(choisie ?? statut));
  };

  const choisirEcheance = (at: string): void => {
    setCallbackAt(at);
    setPas('note');
  };

  const validerEcheance = (): void => {
    const iso = callbackAt ?? dakarLocalToIso(freeCallback);
    if (iso === null) {
      toast.error('Choisissez une échéance, ou saisissez sa date et son heure.');
      return;
    }
    choisirEcheance(iso);
  };

  const quitterNote = (): void => {
    if (motif === null) {
      setPas('statut');
      return;
    }
    const probleme = validateAttempt(
      draftDe(motif, callbackAt, conversion, comment, null),
      maintenant(),
      motif.requiresComment,
    );
    if (probleme === null) setPas('projet');
    else toast.error(probleme);
  };

  const enregistrer = (projet: Projet): void => {
    const appelIncomplet = !sansAppel && motif === null;
    if (appelIncomplet || e164 === null || save.isPending) return;
    const dossier = { ...conversion, projet };
    const problemes = problemesAdhesion(adhesion, sansAppel, dossier, formulaire);
    setErrors(problemes);
    if (Object.keys(problemes).length > 0) {
      setPas(TRANCHES_PAS[etapePourErreurs(problemes)] ?? 'identite');
      return;
    }
    const appel = appelCree(sansAppel, motif, callbackAt, dossier, comment);
    save.mutate({
      projet,
      dossier,
      phone: e164,
      appel: appel && { ...appel, rvSite: rvSite.corps },
      comment,
    });
  };

  const choix = (
    items: readonly MotifAppel[],
    actif: MotifAppel | null,
    choisir: (m: MotifAppel) => void,
  ): Choix[] =>
    items.map((item) => choixDe(item, catalogue, actif?.code === item.code, () => choisir(item)));
  const projets: Choix[] = (['CHUES', 'GRAND_PUBLIC'] as const).map((projet) => ({
    cle: projet,
    label: projet === 'CHUES' ? 'CHUES' : 'Grand Public',
    actif: false,
    choisir: () => enregistrer(projet),
  }));
  const pending = save.isPending;
  const canauxActifs = (canaux.data ?? []).filter((canal) => canal.isActive === true);

  const choisirTypeContact = (code: string): void => {
    setCanalProvenanceId(canauxActifs.find((canal) => canal.code === code)?.id ?? null);
    setPas('canal');
  };

  const tranche = (rangTranche: number): ReactNode => (
    <PanneauDossier
      ouvert
      prospect={{
        prenom: conversion.prenom.trim(),
        phoneE164: e164,
        whatsappStatus: 'NON_DEMANDE',
        whatsappNumber: null,
      }}
      conversion={conversion}
      errors={errors}
      telephone={
        rangTranche === 0
          ? {
              value: phone,
              error: phoneError,
              onChange: (valeur) => {
                setPhone(valeur);
                setPhoneError(undefined);
              },
            }
          : undefined
      }
      disabled={pending}
      formulaire={formulaire}
      seulement={TRANCHES[rangTranche]}
      envoiLien={rangTranche === 0}
      onChange={(patch) => setConversion((dossier) => ({ ...dossier, ...patch }))}
    />
  );

  const corps: Readonly<Record<Pas, () => ReactNode>> = {
    contact: () => (
      <div className="flex flex-col gap-4">
        <p className="text-[0.9375rem] text-muted-foreground">
          Comment ce prospect a-t-il pris contact ?
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="min-w-52 flex-1"
            onClick={() => choisirTypeContact('APPEL_ENTRANT')}
          >
            Appel entrant
          </Button>
          <Button
            variant="outline"
            className="min-w-52 flex-1"
            onClick={() => choisirTypeContact('WHATSAPP')}
          >
            SMS / Whatsapp
          </Button>
        </div>
      </div>
    ),
    canal: () => (
      <FilterCombobox
        label="Canal de provenance"
        placeholder="Choisir un canal"
        value={canalProvenanceId}
        options={canauxActifs.map((canal) => ({ value: canal.id, label: canal.label ?? '' }))}
        onChange={setCanalProvenanceId}
      />
    ),
    identite: () => tranche(0),
    situation: () => tranche(1),
    revenus: () => tranche(2),
    statut: () => (
      <div className="flex flex-col gap-4">
        <Palier
          question="Qu’a dit la personne ?"
          choix={choix(statutsJoignables(catalogue), statut, choisirStatut)}
          raccourcis={false}
          vide={AUCUN_MOTIF}
          disabled={pending}
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            setSansAppel(true);
            setPas('projet');
          }}
        >
          Créer sans consigner un appel
        </Button>
      </div>
    ),
    precision: () => (
      <Palier
        question={`Précisez « ${statut?.label ?? ''} »`}
        choix={choix(precisions, precision, choisirPrecision)}
        raccourcis={false}
        vide={AUCUN_MOTIF}
        disabled={pending}
      />
    ),
    echeance: () => (
      <PanneauEcheance
        slots={rvSite.filtrer(slots) ?? []}
        now={now}
        freeCallback={freeCallback}
        choisi={callbackAt}
        surDossier={adhesion}
        titre={titreEcheance(motif?.code)}
        contenu={rvSite.calendrier(callbackAt, choisirEcheance)}
        disabled={pending}
        inputRef={callbackRef}
        onChoisir={choisirEcheance}
        onFreeCallback={setFreeCallback}
        onValidate={validerEcheance}
      />
    ),
    note: () => (
      <div className="flex flex-col gap-4">
        {rvSite.champs}
        <Commentaire
          value={comment}
          titre="Commentaire, facultatif"
          obligatoirePour={commentaireExigePar(motif)}
          inputRef={commentRef}
          onChange={setComment}
          onValidate={quitterNote}
        />
      </div>
    ),
    projet: () => (
      <Palier
        question="Quel projet ?"
        choix={projets}
        raccourcis={false}
        vide=""
        disabled={pending}
      />
    ),
  };

  const suites: Readonly<Partial<Record<Pas, { libelle: string; action: () => void }>>> = {
    canal: { libelle: 'Continuer', action: () => setPas('identite') },
    identite: { libelle: 'Continuer', action: quitterFormulaire },
    situation: { libelle: 'Continuer', action: () => setPas('revenus') },
    revenus: { libelle: 'Continuer', action: () => setPas('statut') },
    precision: { libelle: 'Sans précision', action: () => choisirPrecision(null) },
    echeance: { libelle: 'Continuer', action: validerEcheance },
    note: { libelle: 'Continuer', action: quitterNote },
  };
  const suite = suites[pas];

  return (
    <div className="flex w-full flex-col gap-4">
      <EtapesProgression
        etapes={parcours.map((item) => LIBELLES_PAS[item])}
        courante={rang}
        maximum={rang}
        onChoisir={(cible) => setPas(parcours[cible] ?? 'identite')}
      />
      {corps[pas]()}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (pas === 'contact') onAnnuler();
            else if (pas === 'canal') setPas('contact');
            else setPas(rang === 0 ? 'canal' : (parcours[rang - 1] ?? 'identite'));
          }}
        >
          {pas === 'contact' ? 'Annuler' : 'Retour'}
        </Button>
        {suite === undefined ? null : (
          <Button disabled={pending} onClick={suite.action}>
            {suite.libelle}
          </Button>
        )}
      </div>
    </div>
  );
}
