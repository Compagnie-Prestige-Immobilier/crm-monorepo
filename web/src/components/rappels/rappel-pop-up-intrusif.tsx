'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRingIcon, ClockIcon, PhoneCallIcon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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
  type Callback,
} from '@/lib/data/console';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

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
  } catch {
    // Context d'audio bloqué par la politique navigateur ou non disponible.
  }
}

interface ContenuRappelProps {
  readonly callback: Callback;
  readonly serverTimeMs: number;
  readonly racine: string;
  readonly onIgnorer: () => void;
  readonly onAnnuler: (id: string) => void;
  readonly isPendingCancel: boolean;
}

function ContenuRappelPopUp({
  callback,
  serverTimeMs,
  racine,
  onIgnorer,
  onAnnuler,
  isPendingCancel,
}: ContenuRappelProps) {
  const retardMs = serverTimeMs - Date.parse(callback.scheduledAt);
  const retardTxt = retardMs > 0 ? formatDelay(retardMs) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onIgnorer()}>
      <DialogContent showCloseButton className="border-2 border-amber-500/50 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-30" />
              <BellRingIcon className="h-6 w-6 animate-bounce text-amber-600" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-200">
                Rappel d’échéance prospect
                <Badge variant="destructive" className="ml-1 uppercase">
                  Urgent
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Une heure de rappel est atteinte. Contactez le prospect dès maintenant.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-3 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Téléphone</p>
              <p className="text-xl font-bold tracking-tight text-foreground">
                {formatPhone(callback.phoneE164)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Fiche</p>
              <p className="font-mono text-sm font-semibold">{callback.shortCode}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Prévu à : </span>
              <time className="font-semibold" dateTime={callback.scheduledAt}>
                {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
              </time>
            </div>
            {retardTxt ? (
              <div className="text-right">
                <span className="text-muted-foreground">Retard : </span>
                <span className="font-semibold text-destructive">{retardTxt}</span>
              </div>
            ) : null}
          </div>

          {callback.comment ? (
            <div className="mt-2 rounded border bg-background p-2.5 text-xs text-foreground">
              <span className="mb-0.5 block font-semibold text-muted-foreground">
                Dernier commentaire :
              </span>
              <p className="whitespace-pre-wrap italic">&laquo; {callback.comment} &raquo;</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={onIgnorer} className="gap-1.5">
            <ClockIcon className="h-4 w-4" />
            Plus tard
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={isPendingCancel}
            onClick={() => onAnnuler(callback.id)}
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          >
            <XCircleIcon className="h-4 w-4" />
            Annuler rappel
          </Button>

          <Link
            href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
            onClick={onIgnorer}
            className={buttonVariants({ variant: 'default', size: 'sm', className: 'gap-1.5' })}
          >
            <PhoneCallIcon className="h-4 w-4" />
            Consigner l’appel
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RappelPopUpIntrusif() {
  const pathname = usePathname();
  const grandPublic = pathname.startsWith('/grand-public');
  const projet = grandPublic ? 'GRAND_PUBLIC' : 'CHUES';
  const racine = grandPublic ? '/grand-public' : '/chues';
  const queryClient = useQueryClient();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const alertedIdsRef = useRef<Set<string>>(new Set());

  const overdueQuery = useQuery({
    queryKey: [...callbackKeys.list('overdue', null), projet, 'intrusif'],
    queryFn: () => fetchCallbacks('overdue', null, undefined, projet),
    refetchInterval: 15_000,
  });

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

  const callbacks = overdueQuery.data?.items ?? [];
  const serverTimeStr = overdueQuery.data?.serverTime ?? new Date().toISOString();
  const serverTimeMs = Date.parse(serverTimeStr);

  const activeCallback: Callback | null =
    callbacks.find((c) => !dismissedIds.has(c.id) && c.overdue) ?? null;

  useEffect(() => {
    if (!activeCallback) return;
    if (alertedIdsRef.current.has(activeCallback.id)) return;

    alertedIdsRef.current.add(activeCallback.id);
    jouerSonnerieRappel();
  }, [activeCallback]);

  if (!activeCallback) return null;

  const ignorerRappel = () => {
    setDismissedIds((prev) => new Set([...prev, activeCallback.id]));
  };

  const annulerRappel = (id: string) => {
    cancelMutation.mutate(id);
    ignorerRappel();
  };

  return (
    <ContenuRappelPopUp
      callback={activeCallback}
      serverTimeMs={serverTimeMs}
      racine={racine}
      onIgnorer={ignorerRappel}
      onAnnuler={annulerRappel}
      isPendingCancel={cancelMutation.isPending}
    />
  );
}
