'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import {
  brouillonDe,
  Commentaire,
  MOTIFS_SYSTEME,
  PanneauDossier,
  PanneauEcheance,
  PiedDossier,
  statutsJoignables,
} from '@/components/console/console-view';
import { SelectStatut } from '@/components/console/select-statut';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { toInternationalE164 } from '@/components/forms/international-phone-field';
import { usePremiereErreur } from '@/components/forms/premiere-erreur';
import {
  ETAPES_DOSSIER,
  EtapesProgression,
  etapesValides,
  filtrerErreurs,
  PiedEtapes,
  premiereEtapeEnErreur,
  sansObligationHorsIdentite,
} from '@/components/grand-public/etapes';
import type { FicheContactable } from '@/components/prospects/bouton-whatsapp';
import { Button } from '@/components/ui/button';
import { useGardeSaisie } from '@/components/ui/confirm-dialog';
import {
  commentaireExigePar,
  fetchMotifsAppel,
  issueDuMotif,
  type MotifAppel,
} from '@/lib/data/call-outcome-reasons';
import { useChampsConversion } from '@/lib/data/champs-conversion';
import {
  AttemptRefused,
  callbackKeys,
  callbackSlots,
  conversionErrorFor,
  dossierVide,
  newAttemptInput,
  pushCallAttempt,
  validateAttempt,
  validateConversion,
  type AttemptDraft,
  type CallbackSlot,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import { createGrandPublicProspect, type GrandPublicProspectInput } from '@/lib/data/grand-public';
import { ouvrirFiche } from '@/lib/data/ouvertures';
import { prospectPhoneConflict } from '@/lib/data/prospects';
import { dakarLocalToIso } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ProspectRow } from '@/lib/types';

/** Le numéro se tape comme au téléphone : sans indicatif, il est sénégalais. */
const INDICATIF = '221';

/** L'heure du geste, lue quand le téléconseiller enregistre et non au rendu. */
const maintenant = (): number => Date.now();

interface Envoi {
  input: GrandPublicProspectInput;
  appel: AttemptDraft | null;
  brouillon: Record<string, unknown>;
}

type Renseignes<T> = { [K in keyof T]?: NonNullable<T[K]> };

/** Un champ laissé vide ne part pas : la fiche le recevra quand on le saura. */
function renseignes<T extends Record<string, unknown>>(valeurs: T): Renseignes<T> {
  return Object.fromEntries(
    Object.entries(valeurs).filter(([, valeur]) => valeur !== null && valeur !== ''),
  ) as Renseignes<T>;
}

/**
 * Tout ce que la création sait porter. L'e-mail, l'ancienneté dans la fonction,
 * l'engagement bancaire et la méthode n'existent que sur une adhésion : ils
 * partent avec elle, comme depuis la page d'appel.
 */
function creationDepuis(dossier: ConversionDraft, phone: string): GrandPublicProspectInput {
  const systeme = dossier.dureeSystemeMois.trim();
  return {
    nom: dossier.nom.trim(),
    phone,
    ...renseignes({
      prenom: dossier.prenom.trim(),
      profession: dossier.profession.trim(),
      type: dossier.type,
      syndicatId: dossier.syndicatId,
      banqueId: dossier.banqueId,
      incomeBandId: dossier.incomeBandId,
      paymentMode: dossier.paymentMode,
      dureeSystemeMois: systeme === '' ? null : Number(systeme),
    }),
    ...(Object.keys(dossier.champsLibres).length === 0
      ? {}
      : { champsLibres: dossier.champsLibres }),
  };
}

/** Sans adhésion, seule l'identité compte : le reste du dossier est une conversion. */
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

/** Sans numéro valide, l'identité n'est pas finie : aucune étape suivante ne s'ouvre. */
const etapeAtteignable = (erreurTel: string | undefined, problemes: ConversionErrors): number =>
  erreurTel === undefined ? etapesValides(problemes) : 0;

/** « Il refuse » a son bouton ; les autres statuts du select, « Hors cible » compris, non. */
const sansBouton = (motif: MotifAppel | null, refus: MotifAppel | undefined): boolean =>
  motif !== null && motif.code !== refus?.code;

/** Seul le bouton qui a lancé l'envoi, avec ou sans appel, affiche l'attente. */
const envoiEnCours = (pending: boolean, envoi: Envoi | undefined, avecAppel: boolean): boolean =>
  pending && envoi !== undefined && (envoi.appel !== null) === avecAppel;

/** « À rappeler » garde le dossier : l'ouverture le porte jusqu'au prochain appel. */
async function consignerSur(
  prospectId: string,
  appel: AttemptDraft,
  brouillon: Record<string, unknown>,
): Promise<void> {
  const ouverture =
    appel.outcome === 'CALLBACK'
      ? await ouvrirFiche({ prospectId, draft: brouillon }).catch(() => null)
      : null;
  const tentative = ouverture === null ? appel : { ...appel, ouvertureId: ouverture.id };
  await pushCallAttempt(newAttemptInput(prospectId, tentative));
}

/**
 * Les touches que l'échéance affiche, et Échap qui la referme. Rien d'autre
 * n'écoute le clavier : Échap effacerait sinon une fiche entière.
 */
function useRaccourcisEcheance(
  slots: readonly CallbackSlot[] | null,
  choisir: (at: string) => void,
  autre: () => void,
  fermer: () => void,
): void {
  const touches: Record<string, () => void> = Object.fromEntries(
    (slots ?? []).map((slot) => [
      slot.key,
      () => {
        choisir(slot.at);
      },
    ]),
  );
  if (slots !== null) touches['0'] = autre;
  useShortcuts({ ...touches, Escape: fermer });
}

/**
 * L'ajout d'un prospect Grand Public : le formulaire « joignable » de la page
 * d'appel, vierge. Sans statut la fiche se crée seule ; avec, l'appel est
 * consigné sur la fiche qu'on vient de créer.
 */
export function NouveauProspect({
  embedded = false,
  onSaved,
  onAnnuler,
  onModifie,
}: {
  embedded?: boolean;
  onSaved: (prospect: ProspectRow) => void;
  onAnnuler: () => void;
  /** La boîte qui l'héberge se referme aussi par Échap ou un clic à côté : elle doit savoir. */
  onModifie?: (modifie: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);
  // Créée mais l'appel refusé : la reprise ne doit pas la créer une seconde fois.
  const cree = useRef<ProspectRow | null>(null);
  const garde = useGardeSaisie(onAnnuler);
  const racineRef = useRef<HTMLDivElement>(null);
  const signalerEchec = usePremiereErreur(racineRef);

  const [vierge] = useState<ConversionDraft>(() => dossierVide('GRAND_PUBLIC'));
  const [conversion, setConversion] = useState<ConversionDraft>(vierge);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<ConversionErrors>({});
  const [motif, setMotif] = useState<MotifAppel | null>(null);
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [comment, setComment] = useState('');
  const [etape, setEtape] = useState(0);
  const [now] = useState(maintenant);

  const formulaire = useChampsConversion('GRAND_PUBLIC');
  const motifs = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    staleTime: 300_000,
  });
  const catalogue = motifs.data ?? MOTIFS_SYSTEME;
  const motifAdhesion = catalogue.find((item) => item.effect === 'CLOSE_METHOD');
  const motifRefus = catalogue.find((item) => item.effect === 'CLOSE_REFUSED');
  const motifRappel = catalogue.find((item) => item.effect === 'SCHEDULE_CALLBACK');

  const e164 = toInternationalE164(phone, INDICATIF);
  const fiche: FicheContactable = {
    prenom: conversion.prenom.trim(),
    phoneE164: e164,
    whatsappStatus: 'NON_DEMANDE',
    whatsappNumber: null,
  };

  const save = useMutation({
    mutationFn: async ({ input, appel, brouillon }: Envoi): Promise<ProspectRow> => {
      const prospect = cree.current ?? (await createGrandPublicProspect(input));
      cree.current = prospect;
      if (appel !== null) await consignerSur(prospect.id, appel, brouillon);
      return prospect;
    },
    onSuccess: (prospect, { appel }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
      const nom = `${prospect.prenom} ${prospect.nom}`.trim();
      toast.success(appel === null ? `${nom} enregistré.` : `Appel enregistré pour ${nom}.`);
      onSaved(prospect);
    },
    onError: (error) => {
      const existant = prospectPhoneConflict(error);
      if (existant !== null) {
        setPhoneError(`Ce numéro est déjà enregistré pour ${existant.prenom} ${existant.nom}.`);
        setEtape(0);
        signalerEchec();
        return;
      }
      if (error instanceof AttemptRefused) {
        const refuse = conversionErrorFor(error.code);
        if (refuse !== null) bloquer({ [refuse.field]: refuse.message }, undefined);
        toast.error(error.message, {
          description: 'La fiche est créée. Corrigez puis enregistrez pour consigner l’appel.',
        });
        return;
      }
      toastApiError(error, 'Le prospect n’a pas pu être enregistré.');
    },
  });

  function envoyer(appel: AttemptDraft | null): void {
    if (save.isPending || e164 === null) return;
    save.mutate({
      input: creationDepuis(conversion, e164),
      appel,
      brouillon: brouillonDe(comment, conversion),
    });
  }

  /** Montre les erreurs et ouvre l'étape de la première : sa saisie est invisible d'ailleurs. */
  function bloquer(problemes: ConversionErrors, erreurTel: string | undefined): boolean {
    setErrors(problemes);
    setPhoneError(erreurTel);
    const premiere = erreurTel === undefined ? premiereEtapeEnErreur(problemes) : 'Identité';
    if (premiere === null) return false;
    setEtape(ETAPES_DOSSIER.indexOf(premiere));
    signalerEchec();
    return true;
  }

  /** Le numéro et l'identité, que toute saisie exige. */
  function identiteBloquee(): boolean {
    return bloquer(
      erreursIdentite(
        validateConversion(conversion, maintenant(), formulaire.champs, formulaire.libres),
      ),
      erreurTelephone(phone, e164),
    );
  }

  /** « Continuer » ne juge que l'étape affichée ; l'enregistrement juge tout. */
  function continuer(): void {
    const courante = ETAPES_DOSSIER[etape];
    const erreurTel = etape === 0 ? erreurTelephone(phone, e164) : undefined;
    const probleme = filtrerErreurs(
      validateConversion(
        conversion,
        maintenant(),
        sansObligationHorsIdentite(formulaire.champs),
        formulaire.libres,
      ),
      (etapeErreur) => etapeErreur === courante,
    );
    setErrors((avant) => ({
      ...filtrerErreurs(avant, (etapeErreur) => etapeErreur !== courante),
      ...probleme,
    }));
    if (etape === 0) setPhoneError(erreurTel);
    if (erreurTel !== undefined || Object.keys(probleme).length > 0) {
      signalerEchec();
      return;
    }
    setEtape(etape + 1);
  }

  function creerSeulement(): void {
    if (!identiteBloquee()) envoyer(null);
  }

  function adherer(choisi: MotifAppel): void {
    setSlots(null);
    const problemes = validateConversion(
      conversion,
      maintenant(),
      formulaire.champs,
      formulaire.libres,
    );
    if (bloquer(problemes, erreurTelephone(phone, e164))) return;
    if (conversion.method === null) return;
    verifierPuisEnvoyer(choisi, {
      outcome: issueDuMotif(choisi),
      reasonCode: choisi.code,
      method: conversion.method,
      comment,
      callbackAt: null,
      conversion,
    });
  }

  function consigner(choisi: MotifAppel, callbackAt: string | null = null): void {
    if (identiteBloquee()) return;
    verifierPuisEnvoyer(choisi, {
      outcome: issueDuMotif(choisi),
      reasonCode: choisi.code,
      method: null,
      comment,
      callbackAt,
    });
  }

  function verifierPuisEnvoyer(choisi: MotifAppel, appel: AttemptDraft): void {
    const probleme = validateAttempt(appel, maintenant(), choisi.requiresComment);
    if (probleme === null) {
      envoyer(appel);
      return;
    }
    toast.error(probleme);
    if (choisi.requiresComment) commentRef.current?.focus();
  }

  function ouvrirEcheance(): void {
    setFreeCallback('');
    setSlots(callbackSlots(maintenant()));
  }

  function poser(choisi: MotifAppel): void {
    setMotif(choisi);
    if (choisi.effect === 'SCHEDULE_CALLBACK') ouvrirEcheance();
    else setSlots(null);
  }

  function rappeler(): void {
    if (motifRappel === undefined) return;
    setMotif(motifRappel);
    ouvrirEcheance();
  }

  // L'échéance passe devant : ouverte, c'est elle que le téléconseiller choisit.
  function valider(): void {
    if (slots === null) {
      if (motif === null) creerSeulement();
      else consigner(motif);
      return;
    }
    const iso = dakarLocalToIso(freeCallback);
    if (iso === null) {
      toast.error('Choisissez une échéance, ou saisissez sa date et son heure.');
      return;
    }
    if (motif !== null) consigner(motif, iso);
  }

  useRaccourcisEcheance(
    slots,
    (at) => {
      if (motif !== null) consigner(motif, at);
    },
    () => {
      callbackRef.current?.focus();
    },
    () => {
      setSlots(null);
    },
  );

  const modifie =
    phone.trim() !== '' ||
    comment.trim() !== '' ||
    motif !== null ||
    JSON.stringify(conversion) !== JSON.stringify(vierge);
  useEffect(() => {
    onModifie?.(modifie);
  }, [modifie, onModifie]);

  const pending = save.isPending;
  const atteignable = etapeAtteignable(
    erreurTelephone(phone, e164),
    validateConversion(
      conversion,
      now,
      sansObligationHorsIdentite(formulaire.champs),
      formulaire.libres,
    ),
  );

  function derniereEtape(): ReactNode {
    return (
      <>
        <SelectStatut
          catalogue={statutsJoignables(catalogue)}
          motif={motif}
          disabled={pending}
          obligatoire={false}
          placeholder="Sans appel"
          onChange={poser}
          onFerme={() => {
            if (motif?.requiresComment) commentRef.current?.focus();
          }}
        />

        {slots === null ? null : (
          <PanneauEcheance
            slots={slots}
            now={now}
            freeCallback={freeCallback}
            surDossier
            disabled={pending}
            inputRef={callbackRef}
            onChoisir={(at) => {
              if (motif !== null) consigner(motif, at);
            }}
            onFreeCallback={setFreeCallback}
            onValidate={valider}
          />
        )}

        <Commentaire
          value={comment}
          obligatoirePour={commentaireExigePar(motif)}
          inputRef={commentRef}
          onChange={setComment}
          onValidate={valider}
        />

        <PiedDossier
          ouvert
          disabled={pending}
          motifRefus={motifRefus}
          raccourcis={false}
          extra={
            <>
              {sansBouton(motif, motifRefus) ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  pending={envoiEnCours(pending, save.variables, true)}
                  onClick={valider}
                >
                  Enregistrer l’appel
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={pending}
                pending={envoiEnCours(pending, save.variables, false)}
                onClick={creerSeulement}
              >
                Enregistrer sans appel
              </Button>
            </>
          }
          onAdhesion={() => {
            if (motifAdhesion === undefined) {
              toast.error(
                'Le statut « Méthode obtenue » est désactivé dans les listes de référence.',
              );
              return;
            }
            adherer(motifAdhesion);
          }}
          onRefus={(refus) => {
            setMotif(refus);
            consigner(refus);
          }}
          onRappel={rappeler}
          onAnnuler={garde.demanderFermeture}
        />
      </>
    );
  }

  return (
    <div ref={racineRef} className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {embedded ? null : (
        <>
          <Button variant="ghost" className="w-fit -ml-2" onClick={garde.demanderFermeture}>
            <ArrowLeftIcon aria-hidden="true" />
            Revenir à la liste
          </Button>
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            Nouveau prospect Grand Public
          </h1>
        </>
      )}

      <EtapesProgression
        etapes={ETAPES_DOSSIER}
        courante={etape}
        atteignable={atteignable}
        onChoisir={setEtape}
      />

      <section aria-label="Nouveau prospect" className="flex flex-col gap-4">
        <PanneauDossier
          ouvert
          prospect={fiche}
          conversion={conversion}
          errors={errors}
          telephone={{
            value: phone,
            error: phoneError,
            onChange: (valeur) => {
              setPhone(valeur);
              setPhoneError(undefined);
            },
          }}
          disabled={pending}
          formulaire={formulaire}
          etape={ETAPES_DOSSIER[etape]}
          onChange={(patch) => {
            setConversion((dossier) => ({ ...dossier, ...patch }));
          }}
        />

        {etape === ETAPES_DOSSIER.length - 1 ? derniereEtape() : null}

        <PiedEtapes
          courante={etape}
          total={ETAPES_DOSSIER.length}
          disabled={pending}
          onRetour={() => {
            setEtape(etape - 1);
          }}
          onContinuer={continuer}
        />
      </section>
      {garde.confirmation}
    </div>
  );
}
