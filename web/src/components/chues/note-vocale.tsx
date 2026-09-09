import { MicIcon, SquareIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatChrono } from '@/lib/data/ouvertures';

/** Safari ne sait pas lire WebM, Chrome Android ne produit que lui : les deux passent. */
const CONTENEURS = ['audio/webm;codecs=opus', 'audio/mp4', ''] as const;

const DUREE_MAX_MS = 120_000;

const cheminNote = (attemptId: string): string =>
  `/api/v1/phase2/call-attempts/${encodeURIComponent(attemptId)}/note-vocale`;

function conteneurSupporte(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of CONTENEURS) {
    if (type === '' || MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export interface NoteVocale {
  readonly disponible: boolean;
  readonly enregistre: boolean;
  readonly secondes: number;
  readonly blob: Blob | null;
  readonly demarrer: () => void;
  readonly arreter: () => void;
  readonly effacer: () => void;
  readonly deposer: (attemptId: string) => Promise<void>;
}

/**
 * `MediaRecorder` natif. Le son reste en mémoire jusqu'à ce que la tentative
 * rende son identifiant : c'est lui qui nomme le fichier côté serveur, et un
 * envoi refusé garde le blob pour un nouvel essai.
 */
export function useNoteVocale(): NoteVocale {
  const [disponible, setDisponible] = useState(
    () => typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined,
  );
  const [enregistre, setEnregistre] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  const arreter = useCallback(() => {
    recorder.current?.stop();
  }, []);

  const demarrer = useCallback(() => {
    const conteneur = conteneurSupporte();
    if (conteneur === null) {
      setDisponible(false);
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (flux) => {
        const enregistreur = new MediaRecorder(
          flux,
          conteneur === '' ? {} : { mimeType: conteneur },
        );
        const morceaux: Blob[] = [];
        enregistreur.ondataavailable = (evenement) => {
          if (evenement.data.size > 0) morceaux.push(evenement.data);
        };
        enregistreur.onstop = () => {
          for (const piste of flux.getTracks()) piste.stop();
          recorder.current = null;
          setEnregistre(false);
          setBlob(new Blob(morceaux, { type: enregistreur.mimeType }));
        };
        recorder.current = enregistreur;
        setBlob(null);
        setSecondes(0);
        setEnregistre(true);
        enregistreur.start();
      },
      () => {
        setDisponible(false);
        toast.error('Le micro n’est pas accessible. La note vocale reste indisponible ici.');
      },
    );
  }, []);

  useEffect(() => {
    if (!enregistre) return undefined;
    const battement = setInterval(() => {
      setSecondes((precedent) => precedent + 1);
    }, 1000);
    const plafond = setTimeout(arreter, DUREE_MAX_MS);
    const surMasquage = (): void => {
      if (document.visibilityState === 'hidden') arreter();
    };
    document.addEventListener('visibilitychange', surMasquage);
    return () => {
      clearInterval(battement);
      clearTimeout(plafond);
      document.removeEventListener('visibilitychange', surMasquage);
    };
  }, [enregistre, arreter]);

  const effacer = useCallback(() => {
    setBlob(null);
    setSecondes(0);
  }, []);

  const deposer = useCallback(
    async (attemptId: string): Promise<void> => {
      if (blob === null) return;
      // Le contrat ne déclare qu'`audio/webm` ; le serveur, lui, reconnaît le
      // conteneur aux premiers octets et accepte aussi bien MP4 qu'Ogg.
      const reponse = await fetch(cheminNote(attemptId), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      });
      if (!reponse.ok) throw new Error('Note vocale refusée.');
      setBlob(null);
      setSecondes(0);
    },
    [blob],
  );

  return { disponible, enregistre, secondes, blob, demarrer, arreter, effacer, deposer };
}

export function BoutonNoteVocale({ note, disabled }: { note: NoteVocale; disabled: boolean }) {
  if (!note.disponible) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {note.enregistre ? (
        <Button type="button" variant="destructive" size="sm" onClick={note.arreter}>
          <SquareIcon aria-hidden="true" />
          Arrêter ({formatChrono(note.secondes)})
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={note.demarrer}
        >
          <MicIcon aria-hidden="true" />
          {note.blob === null ? 'Note vocale' : 'Refaire la note vocale'}
        </Button>
      )}

      {note.blob === null || note.enregistre ? null : (
        <>
          <span className="text-[0.8125rem] text-muted-foreground">
            Note vocale de {formatChrono(note.secondes)}, envoyée avec l’appel.
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={note.effacer}>
            <Trash2Icon aria-hidden="true" />
            Retirer
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Rien dans la tentative ne dit si une note existe : elle se demande, et son
 * absence se lit sur l'erreur de chargement plutôt que sur un appel de plus.
 */
export function EcouteNoteVocale({ attemptId }: { attemptId: string }) {
  const [etat, setEtat] = useState<'repos' | 'ouverte' | 'absente'>('repos');

  if (etat === 'absente') {
    return (
      <p className="text-[0.75rem] text-muted-foreground">Aucune note vocale pour cet appel.</p>
    );
  }

  if (etat === 'repos') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setEtat('ouverte');
        }}
      >
        <MicIcon aria-hidden="true" />
        Écouter la note vocale
      </Button>
    );
  }

  return (
    <audio
      controls
      autoPlay
      preload="auto"
      src={cheminNote(attemptId)}
      className="h-9 w-full max-w-72"
      onError={() => {
        setEtat('absente');
      }}
    >
      <track kind="captions" />
    </audio>
  );
}
