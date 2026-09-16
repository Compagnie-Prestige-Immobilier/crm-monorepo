'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, CalendarClockIcon, ClockIcon, PhoneCallIcon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BoutonWhatsApp } from '@/components/prospects/bouton-whatsapp';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  callbackKeys,
  cancelCallback,
  fetchCallbacks,
  formatCallbackAt,
  formatDelay,
  snoozeCallback,
  type Callback,
} from '@/lib/data/console';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

type Rappel = Callback;
const EMPTY_CALLBACKS: Callback[] = [];

/** Synthétise un carillon sonore de rappel à trois notes via Web Audio API. */
function jouerSonnerieRappel() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 659.25, time: 0, duration: 0.35, gain: 0.15 },
      { freq: 880, time: 0.15, duration: 0.5, gain: 0.2 },
      { freq: 1046.5, time: 0.35, duration: 0.6, gain: 0.25 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.time);
      g.gain.setValueAtTime(note.gain, now + note.time);
      g.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
    }
    window.setTimeout(() => {
      void ctx.close();
    }, 1_400);
  } catch {
    // Context d'audio bloqué par la politique navigateur ou non disponible.
  }
}

interface ContenuRappelProps {
  readonly callback: Rappel;
  readonly serverTimeMs: number;
  readonly racine: string;
  readonly onIgnorer: () => void;
  readonly onAnnuler: (id: string) => void;
  readonly onReporter: (id: string) => void;
  readonly isPendingCancel: boolean;
  readonly isPendingSnooze: boolean;
  readonly enAttente: number;
}

function ContenuRappelPopUp({
  callback,
  serverTimeMs,
  racine,
  onIgnorer,
  onAnnuler,
  onReporter,
  isPendingCancel,
  isPendingSnooze,
  enAttente,
}: ContenuRappelProps) {
  const retardMs = serverTimeMs - Date.parse(callback.scheduledAt);
  const retardTxt = retardMs > 0 ? formatDelay(retardMs) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onIgnorer()}>
      <DialogContent showCloseButton className="w-[calc(100%-1rem)] max-w-lg overflow-x-hidden">
        <DialogHeader>
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <BellIcon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2">
                Rappel à passer
                <ProjetBadge projet={callback.projet} />
              </DialogTitle>
              <DialogDescription className="break-words">
                {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
                {enAttente > 1
                  ? ` · ${enAttente - 1} autre${enAttente > 2 ? 's' : ''} en attente`
                  : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prospect</p>
              <p className="text-lg font-semibold text-foreground">
                {callback.prospectName ?? `Prospect · ${callback.shortCode}`}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium text-muted-foreground">Téléphone</p>
              <p className="font-mono text-base font-semibold text-foreground">
                {formatPhone(callback.phoneE164)}
              </p>
              <p className="font-mono text-xs text-muted-foreground">Fiche {callback.shortCode}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
                Prévu
              </p>
              <time className="font-semibold" dateTime={callback.scheduledAt}>
                {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
              </time>
            </div>
            {retardTxt ? <Badge variant="destructive">Retard {retardTxt}</Badge> : null}
          </div>

          {callback.comment ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
              <p className="whitespace-pre-wrap">{callback.comment}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <a
            href={`tel:${callback.phoneE164}`}
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
              className: 'w-full gap-1.5 sm:w-auto',
            })}
          >
            <PhoneCallIcon className="h-4 w-4" />
            Appeler
          </a>

          <BoutonWhatsApp
            prospect={{
              prenom: callback.prospectName ?? '',
              phoneE164: callback.phoneE164,
              whatsappStatus: 'MEME_NUMERO',
              whatsappNumber: callback.phoneE164,
            }}
          />

          <Button
            variant="outline"
            size="sm"
            disabled={isPendingSnooze}
            onClick={() => onReporter(callback.id)}
            className="w-full gap-1.5 sm:w-auto"
          >
            <ClockIcon className="h-4 w-4" />
            Reporter de 15 min
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={isPendingCancel}
            onClick={() => onAnnuler(callback.id)}
            className="w-full gap-1.5 text-destructive hover:bg-destructive/10 sm:w-auto"
          >
            <XCircleIcon className="h-4 w-4" />
            Annuler ce rappel
          </Button>

          <Link
            href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
            onClick={onIgnorer}
            className={buttonVariants({
              variant: 'default',
              size: 'sm',
              className: 'w-full gap-1.5 sm:w-auto',
            })}
          >
            <PhoneCallIcon className="h-4 w-4" />
            Consigner l’appel
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ne sonne que pour les rappels que la personne connectée a promis elle-même. */
export function RappelPopUpIntrusif({ userId }: { userId: string }) {
  const projet = undefined;
  const racine = '/teleconseil';
  const queryClient = useQueryClient();

  // Un rappel reporté change d'heure : c'est une nouvelle échéance, à signaler à son tour.
  const echeance = (callback: Rappel) => `${callback.id}@${callback.scheduledAt}`;
  const [aSignaler, setASignaler] = useState<Set<string>>(() => new Set());
  const [ecartees, setEcartees] = useState<Set<string>>(() => new Set());
  const echeancesConnuesRef = useRef<Set<string> | null>(null);

  const overdueQuery = useQuery({
    queryKey: [...callbackKeys.list('overdue', userId), projet, 'intrusif'],
    queryFn: () => fetchCallbacks('overdue', userId, undefined, projet),
    refetchInterval: 15_000,
  });

  const callbacks = overdueQuery.data?.items ?? EMPTY_CALLBACKS;
  const serverTimeStr = overdueQuery.data?.serverTime ?? new Date().toISOString();
  const serverTimeMs = Date.parse(serverTimeStr);

  // L'arriéré au chargement reste sur la page Rappels ; seule une échéance qui
  // arrive pendant que le panneau est ouvert interrompt le téléconseiller.
  useEffect(() => {
    if (!overdueQuery.isSuccess) return;
    const enRetard = new Set(callbacks.filter((callback) => callback.overdue).map(echeance));
    const connues = echeancesConnuesRef.current;
    echeancesConnuesRef.current = enRetard;
    if (connues === null) return;
    const nouvelles = [...enRetard].filter((cle) => !connues.has(cle));
    if (nouvelles.length === 0) return;
    setASignaler((previous) => new Set([...previous, ...nouvelles]));
  }, [callbacks, overdueQuery.isSuccess]);

  const enAttente = callbacks.filter(
    (callback) =>
      callback.overdue && aSignaler.has(echeance(callback)) && !ecartees.has(echeance(callback)),
  );
  const activeCallback = enAttente[0] ?? null;

  const masquerRappelsEnAttente = () => {
    setEcartees((previous) => new Set([...previous, ...aSignaler]));
  };

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelCallback(id),
    onSuccess: () => {
      toast.success('Rappel annulé.');
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas été annulé.');
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: (id: string) => snoozeCallback(id),
    onSuccess: () => {
      toast.success('Rappel reporté de 15 minutes.');
      masquerRappelsEnAttente();
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas pu être reporté.');
    },
  });

  useEffect(() => {
    if (activeCallback === null) return;
    jouerSonnerieRappel();
  }, [activeCallback]);

  if (activeCallback === null) return null;

  const annulerRappel = (id: string) => {
    cancelMutation.mutate(id);
    masquerRappelsEnAttente();
  };

  return (
    <ContenuRappelPopUp
      callback={activeCallback}
      serverTimeMs={serverTimeMs}
      racine={racine}
      onIgnorer={masquerRappelsEnAttente}
      onAnnuler={annulerRappel}
      onReporter={(id) => snoozeMutation.mutate(id)}
      isPendingCancel={cancelMutation.isPending}
      isPendingSnooze={snoozeMutation.isPending}
      enAttente={enAttente.length}
    />
  );
}
