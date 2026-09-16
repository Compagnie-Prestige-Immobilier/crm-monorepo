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
import { toInternationalE164 } from '@/components/forms/international-phone-field';
import { EtapesProgression } from '@/components/grand-public/etapes';
import {
  consignerSur,
  creationDepuis,
  erreursIdentite,
  erreurTelephone,
  etapePourErreurs,
  INDICATIF,
  TRANCHES,
} from '@/components/grand-public/nouveau-prospect';
import { Button } from '@/components/ui/button';
import {
  commentaireExigePar,
  fetchMotifsAppel,
  sousMotifsDe,
  type MotifAppel,
} from '@/lib/data/call-outcome-reasons';
import { useChampsConversion } from '@/lib/data/champs-conversion';
import {
  AttemptRefused,
  callbackKeys,
  callbackSlots,
  conversionErrorFor,
  dossierVide,
  validateAttempt,
  validateConversion,
  type AttemptDraft,
  type CallbackSlot,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import { createProspect, prospectPhoneConflict } from '@/lib/data/prospects';
import { dakarLocalToIso } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet, ProspectRow } from '@/lib/types';

const maintenant = (): number => Date.now();

type Pas =
  'identite' | 'situation' | 'revenus' | 'statut' | 'precision' | 'echeance' | 'note' | 'projet';

const LIBELLES_PAS: Readonly<Record<Pas, string>> = {
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
  const pas: Pas[] = ['identite', 'situation', 'revenus', 'statut'];
  if (avecPrecision) pas.push('precision');
  if (rappelDemande) pas.push('echeance');
  pas.push('note', 'projet');
  return pas;
}

interface Envoi {
  projet: Projet;
  dossier: ConversionDraft;
  phone: string;
  appel: AttemptDraft;
  comment: string;
}

/** La console d'appel sans « Réponse » : la fiche se crée au choix du projet, puis l'appel s'y consigne. */
export function NouveauProspectConsole({
  onSaved,
  onAnnuler,
}: {
  onSaved: () => void;
  onAnnuler: () => void;
}) {
  const queryClient = useQueryClient();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);
  // Créée mais l'appel refusé : la reprise ne doit pas la créer une seconde fois.
  const cree = useRef<ProspectRow | null>(null);

  const [pas, setPas] = useState<Pas>('identite');
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
  const motifs = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    staleTime: 300_000,
  });
  const catalogue = motifs.data ?? MOTIFS_SYSTEME;
  const e164 = toInternationalE164(phone, INDICATIF);
  const { motif, adhesion, rappelDemande } = qualificationDe(statut, precision, conversion);
  const precisions = statut === null ? [] : sousMotifsDe(catalogue, statut.id);
  const parcours = parcoursDe(precisions.length > 0, rappelDemande);
  const rang = Math.max(parcours.indexOf(pas), 0);

  const save = useMutation({
    mutationFn: async (envoi: Envoi): Promise<ProspectRow> => {
      const input = { ...creationDepuis(envoi.dossier, envoi.phone), projet: envoi.projet };
      const prospect = cree.current ?? (await createProspect(input));
      cree.current = prospect;
      await consignerSur(prospect.id, envoi.appel, brouillonDe(envoi.comment, envoi.dossier));
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
    if (motif === null || e164 === null || save.isPending) return;
    const dossier = { ...conversion, projet };
    const problemes = adhesion
      ? validateConversion(dossier, maintenant(), formulaire.champs, formulaire.libres, true)
      : {};
    setErrors(problemes);
    if (Object.keys(problemes).length > 0) {
      setPas(TRANCHES_PAS[etapePourErreurs(problemes)] ?? 'identite');
      return;
    }
    const appel = draftDe(motif, callbackAt, dossier, comment, null);
    save.mutate({ projet, dossier, phone: e164, appel, comment });
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
    identite: () => tranche(0),
    situation: () => tranche(1),
    revenus: () => tranche(2),
    statut: () => (
      <Palier
        question="Qu’a dit la personne ?"
        choix={choix(statutsJoignables(catalogue), statut, choisirStatut)}
        raccourcis={false}
        vide={AUCUN_MOTIF}
        disabled={pending}
      />
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
        slots={slots}
        now={now}
        freeCallback={freeCallback}
        choisi={callbackAt}
        surDossier={adhesion}
        titre={titreEcheance(motif?.code)}
        disabled={pending}
        inputRef={callbackRef}
        onChoisir={choisirEcheance}
        onFreeCallback={setFreeCallback}
        onValidate={validerEcheance}
      />
    ),
    note: () => (
      <Commentaire
        value={comment}
        titre="Commentaire, facultatif"
        obligatoirePour={commentaireExigePar(motif)}
        inputRef={commentRef}
        onChange={setComment}
        onValidate={quitterNote}
      />
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
          onClick={() => (rang === 0 ? onAnnuler() : setPas(parcours[rang - 1] ?? 'identite'))}
        >
          {rang === 0 ? 'Annuler' : 'Retour'}
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
