import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { copyPhone } from '@/components/chues/console-ui';
import {
  useBrouillonAuto,
  useShortcuts,
  useSyndicats,
  useVerrouNavigation,
} from '@/components/chues/hooks';
import { EtapeQuestions } from '@/components/chues/rep-etapes';
import { EnTeteEtape, EtapeRecap, PiedQualification } from '@/components/chues/rep-pied';
import {
  deriverQualification,
  manqueDe,
  recapDe,
  rappelInitialDuStatut,
  reponseDe,
  type EtatScript,
  type Resultat,
} from '@/components/chues/rep-reponse';
import type { OuvertureFiche } from '@/lib/data/ouvertures';
import { buildRepAttempt, lireBrouillonRep, pushRepCallAttempt } from '@/lib/data/rep-campaigns';
import type { Representant } from '@/lib/data/representants';
import { fetchStatutsSaisie, souhaitDuStatut } from '@/lib/data/statuts-qualification';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const STALE_MS = 300_000;

/**
 * La qualification elle-même : deux étapes, comme sur mobile. Aucune réponse ne
 * part avant « Enregistrer », donc chacune reste modifiable jusque-là.
 */
export function Qualification({
  representant,
  ouverture,
  verrouActif,
  onAbandon,
  onEnregistre,
}: {
  representant: Representant;
  ouverture: OuvertureFiche;
  verrouActif: boolean;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const [repris] = useState(() => lireBrouillonRep(ouverture.draft));
  const [etape, setEtape] = useState<1 | 2>(1);
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
  const [aideOuverte, setAideOuverte] = useState(false);
  const [edition, setEdition] = useState(false);
  const [now] = useState(() => Date.now());

  const departChrono = useBrouillonAuto(ouverture, {
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

  const syndicats = useSyndicats(syndicatId);

  const referentielStatuts = useQuery({
    queryKey: queryKeys.statutsQualification,
    queryFn: fetchStatutsSaisie,
    staleTime: STALE_MS,
  });

  const joignable = resultat === 'JOIGNABLE';
  const derivee = deriverQualification(referentielStatuts.data ?? [], {
    joignable,
    ambassadeur,
    statutId,
    sugPhone,
    sugName,
    sugNote,
  });

  const etat: EtatScript = {
    resultat,
    statut: derivee.statut,
    statutChoisi: derivee.statutChoisi,
    joignable,
    etablissementConfirme,
    nouvelEtablissement,
    contacte,
    connaitUES,
    syndicatName: syndicats.nom,
    ambassadeur,
    memeWhatsapp,
    whatsapp,
    rappelAt,
    commentaire,
    proposeQuelquUn: derivee.proposeQuelquUn,
    suggestionCommencee: derivee.suggestionCommencee,
    sugPhone,
    sugName,
    sugNote,
  };

  const manque = manqueDe(etat);
  const statutRetenu = derivee.statut;

  const envoi = useMutation({
    mutationFn: (statut: NonNullable<typeof derivee.statut>) =>
      pushRepCallAttempt(
        buildRepAttempt(representant.id, {
          ...reponseDe(etat, statut),
          ouvertureId: ouverture.id,
        }),
      ),
    onSuccess: () => {
      toast.success(`Appel enregistré pour ${representant.fullName}.`);
      onEnregistre(representant.fullName);
    },
    onError: (error) => {
      toastApiError(error, 'La réponse n’a pas été enregistrée.');
    },
  });

  const bloque = manque !== null || statutRetenu === null || envoi.isPending;

  function enregistrer(): void {
    if (statutRetenu !== null) envoi.mutate(statutRetenu);
  }

  // Un numéro qui n'a pas répondu se retente : le réessai arrive préréglé au
  // délai du statut, le téléconseiller le déplace s'il veut.
  function choisirStatut(id: string | null): void {
    setStatutId(id);
    const choisi = derivee.statuts.find((ligne) => ligne.id === id) ?? null;
    const souhait = souhaitDuStatut(choisi);
    if (souhait !== null) setAmbassadeur(souhait);
    setRappelAt(rappelInitialDuStatut(choisi, now));
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
  }

  const retenu = useCallback(() => {
    toast.error('Posez un statut de qualification avant de quitter cette fiche.');
  }, []);

  useVerrouNavigation(verrouActif, retenu);

  const reculer = useCallback(() => {
    setEtape((courante) => {
      if (courante === 2) return 1;
      // Verrou actif, la fiche ouverte ne se quitte pas sans statut. Seul
      // « Enregistrer » la referme, et le chronomètre s'arrête avec elle.
      if (verrouActif) retenu();
      else onAbandon();
      return 1;
    });
  }, [retenu, verrouActif, onAbandon]);

  // Coupés pendant l'édition : le dialogue a ses propres champs et son Échap.
  useShortcuts(
    {
      Escape: reculer,
      c: () => {
        copyPhone(representant.phoneE164);
      },
      e: () => {
        setEdition(true);
      },
      '?': () => {
        setAideOuverte((ouverte) => !ouverte);
      },
    },
    !edition,
  );

  // Le curseur part sur le motif, une fois le sélecteur refermé : sans cela
  // l'obligation ne se voit pas.
  function fermerStatut(): void {
    if (derivee.motifObligatoire) commentaireRef.current?.focus();
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <EnTeteEtape
        representant={representant}
        etape={etape}
        verrouActif={verrouActif}
        departChrono={departChrono}
        onReculer={reculer}
        onAbandon={onAbandon}
      />

      {etape === 1 ? (
        <EtapeQuestions
          resultat={resultat}
          onResultat={choisirResultat}
          statuts={derivee.statuts}
          statutId={statutId}
          onStatut={choisirStatut}
          onStatutFerme={fermerStatut}
          statutPose={derivee.statutPose}
          exigeRappel={derivee.exigeRappel}
          joignable={joignable}
          proposeQuelquUn={derivee.proposeQuelquUn}
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
            syndicatOptions: syndicats.options,
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
          inputRef={commentaireRef}
          motifObligatoire={derivee.motifObligatoire}
          manque={manque}
          onContinuer={() => {
            setEtape(2);
          }}
        />
      ) : (
        <EtapeRecap
          recap={recapDe(representant, etat, derivee.statutLabel, now)}
          bloque={bloque}
          onEnregistrer={enregistrer}
        />
      )}

      <PiedQualification
        representant={representant}
        aideOuverte={aideOuverte}
        edition={edition}
        onAide={setAideOuverte}
        onEdition={setEdition}
      />
    </div>
  );
}
