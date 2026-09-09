import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  conversionErrorFor,
  validateConversion,
  type ConversionErrors,
  type Formulaire,
} from '@/components/chues/conversion-regles';
import { useBrouillonAuto } from '@/components/chues/hooks';
import type { NoteVocale } from '@/components/chues/note-vocale';
import { callbackSlots, dakarLocalToIso, type CreneauRappel } from '@/lib/data/callbacks';
import {
  ALREADY_COMPLETED,
  buildAttemptBody,
  conversionFrom,
  lireBrouillon,
  pushCallAttempt,
  type AttemptDraft,
  type CallOutcome,
  type ConversionDraft,
  type Prospect,
} from '@/lib/data/console';
import { enregistrerBrouillon, type OuvertureFiche } from '@/lib/data/ouvertures';
import { apiErrorCode, toastApiError } from '@/lib/mutation-feedback';

export type Etape = 'issues' | 'dossier' | 'echeance' | null;

const brouillonDe = (
  comment: string,
  conversion: ConversionDraft | null,
): Record<string, unknown> => ({
  comment,
  ...(conversion === null ? {} : { conversion }),
});

function etapeCourante(
  close: boolean,
  conversion: ConversionDraft | null,
  creneaux: readonly CreneauRappel[] | null,
): Etape {
  if (close) return null;
  if (creneaux !== null) return 'echeance';
  if (conversion !== null) return 'dossier';
  return 'issues';
}

export interface Consigner {
  readonly comment: string;
  readonly setComment: (valeur: string) => void;
  readonly conversion: ConversionDraft | null;
  readonly appliquer: (patch: Partial<ConversionDraft>) => void;
  readonly erreurs: ConversionErrors;
  readonly creneaux: readonly CreneauRappel[] | null;
  readonly echeanceLibre: string;
  readonly setEcheanceLibre: (valeur: string) => void;
  readonly issuePosee: CallOutcome | null;
  readonly etape: Etape;
  readonly close: boolean;
  readonly verrouille: boolean;
  readonly departChrono: string | null;
  readonly enCours: boolean;
  readonly commentRef: React.RefObject<HTMLTextAreaElement | null>;
  readonly echeanceRef: React.RefObject<HTMLInputElement | null>;
  readonly choisir: (outcome: CallOutcome | 'JOIGNABLE') => void;
  readonly rappeler: (at: string) => void;
  readonly ouvrirEcheance: () => void;
  readonly enregistrerAdhesion: () => void;
  readonly refuser: () => void;
  readonly effacerDossier: () => void;
  readonly valider: () => void;
  readonly annuler: () => void;
}

/**
 * Tout ce qu'un appel de conversion écrit : la saisie, ce qui la valide, et la
 * tentative qui la referme. L'écran ne garde que le rendu.
 */
export function useConsigner(entree: {
  prospect: Prospect;
  ouverture: OuvertureFiche | null;
  verrouActif: boolean;
  formulaire: Formulaire;
  note: NoteVocale;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}): Consigner {
  const { prospect, ouverture, verrouActif, formulaire, note } = entree;
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const echeanceRef = useRef<HTMLInputElement>(null);

  const [repris] = useState(() => lireBrouillon(ouverture?.draft));
  const [comment, setComment] = useState(repris.comment);
  const [issuePosee, setIssuePosee] = useState<CallOutcome | null>(null);
  const [conversion, setConversion] = useState<ConversionDraft | null>(repris.conversion);
  const [erreurs, setErreurs] = useState<ConversionErrors>({});
  const [creneaux, setCreneaux] = useState<readonly CreneauRappel[] | null>(null);
  const [echeanceLibre, setEcheanceLibre] = useState('');
  const [refusee, setRefusee] = useState(false);

  const close = prospect.phase2Status !== 'PENDING' || refusee;
  const verrouille = verrouActif && ouverture !== null && !close;
  const departChrono = useBrouillonAuto(ouverture, brouillonDe(comment, conversion));

  const envoi = useMutation({
    mutationFn: async (draft: AttemptDraft) => {
      // Le brouillon part AVANT la tentative, qui referme l'ouverture et ferait
      // refuser toute écriture postérieure.
      if (draft.outcome === 'CALLBACK' && ouverture !== null) {
        await enregistrerBrouillon(
          ouverture.id,
          brouillonDe(draft.comment, conversion),
          departChrono ?? new Date().toISOString(),
        ).catch(() => {
          toast.error('Les réponses saisies n’ont pas pu être conservées. L’appel, lui, part.');
        });
      }
      const resultat = await pushCallAttempt(buildAttemptBody(prospect.id, draft));
      await note.deposer(resultat.attemptId).catch(() => {
        toast.error('La note vocale n’est pas partie. L’appel, lui, est enregistré.');
      });
      return resultat;
    },
    onSuccess: () => {
      entree.onEnregistre(`${prospect.nom} ${prospect.prenom}`);
    },
    onError: (error) => {
      const code = apiErrorCode(error);
      if (code === ALREADY_COMPLETED) setRefusee(true);
      const refus = code === null ? null : conversionErrorFor(code);
      if (refus !== null) setErreurs({ [refus.field]: refus.message });
      toastApiError(error, 'L’appel n’a pas été enregistré.');
    },
  });

  const enCours = envoi.isPending;

  const consigner = useCallback(
    (partiel: Omit<AttemptDraft, 'comment' | 'ouvertureId' | 'expectedRev'>) => {
      if (close || enCours) return;
      envoi.mutate({
        ...partiel,
        comment,
        ...(ouverture === null ? {} : { ouvertureId: ouverture.id }),
        expectedRev: prospect.rev,
      });
    },
    [close, enCours, envoi, comment, ouverture, prospect.rev],
  );

  const issueSeule = useCallback(
    (outcome: CallOutcome, callbackAt: string | null = null) => {
      consigner({ outcome, method: null, callbackAt });
    },
    [consigner],
  );

  const ouvrirDossier = useCallback(() => {
    if (close || enCours) return;
    setIssuePosee(null);
    setCreneaux(null);
    setErreurs({});
    setConversion(conversionFrom(prospect));
  }, [close, enCours, prospect]);

  const ouvrirEcheance = useCallback(() => {
    if (close) return;
    setIssuePosee(null);
    setEcheanceLibre('');
    setCreneaux(callbackSlots(Date.now()));
  }, [close]);

  const commenter = useCallback(() => {
    if (close) return;
    setIssuePosee('OTHER');
    commentRef.current?.focus();
  }, [close]);

  const enregistrerAdhesion = useCallback(() => {
    if (conversion === null) return;
    const problemes = validateConversion(
      conversion,
      Date.now(),
      formulaire.champs,
      formulaire.libres,
    );
    setErreurs(problemes);
    if (Object.keys(problemes).length > 0 || conversion.method === null) return;
    consigner({
      outcome: 'METHOD_OBTAINED',
      method: conversion.method,
      conversion,
      rendezVousAt: dakarLocalToIso(conversion.rendezVousAt.trim()),
    });
  }, [conversion, formulaire, consigner]);

  const choisir = useCallback(
    (outcome: CallOutcome | 'JOIGNABLE') => {
      if (outcome === 'JOIGNABLE') ouvrirDossier();
      else if (outcome === 'CALLBACK') ouvrirEcheance();
      else if (outcome === 'OTHER') commenter();
      else issueSeule(outcome);
    },
    [ouvrirDossier, ouvrirEcheance, commenter, issueSeule],
  );

  // L'échéance passe devant le dossier : ouverte par-dessus lui, c'est elle que
  // l'appelant est en train de choisir.
  const valider = useCallback(() => {
    if (creneaux !== null) {
      const iso = dakarLocalToIso(echeanceLibre);
      if (iso === null) toast.error('Choisissez une échéance, ou saisissez sa date et son heure.');
      else issueSeule('CALLBACK', iso);
      return;
    }
    if (conversion !== null) enregistrerAdhesion();
    else if (issuePosee !== null) issueSeule(issuePosee);
  }, [creneaux, echeanceLibre, conversion, enregistrerAdhesion, issuePosee, issueSeule]);

  const effacerDossier = useCallback(() => {
    setConversion(null);
    setErreurs({});
  }, []);

  const annuler = useCallback(() => {
    // L'échéance se referme seule : la jeter avec le dossier rempli au-dessous
    // perdrait ce que le rappel doit justement retrouver.
    if (creneaux !== null) {
      setCreneaux(null);
      return;
    }
    if (conversion === null && issuePosee === null && comment === '') {
      if (verrouille) toast.error('Consignez l’appel avant de quitter cette fiche.');
      else entree.onAbandon();
      return;
    }
    setIssuePosee(null);
    setComment('');
    effacerDossier();
    commentRef.current?.blur();
  }, [creneaux, conversion, issuePosee, comment, verrouille, effacerDossier, entree]);

  const appliquer = useCallback((patch: Partial<ConversionDraft>) => {
    setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
  }, []);

  return {
    comment,
    setComment,
    conversion,
    appliquer,
    erreurs,
    creneaux,
    echeanceLibre,
    setEcheanceLibre,
    issuePosee,
    etape: etapeCourante(close, conversion, creneaux),
    close,
    verrouille,
    departChrono,
    enCours,
    commentRef,
    echeanceRef,
    choisir,
    rappeler: (at) => {
      issueSeule('CALLBACK', at);
    },
    ouvrirEcheance,
    enregistrerAdhesion,
    refuser: () => {
      issueSeule('REFUSED');
    },
    effacerDossier,
    valider,
    annuler,
  };
}
