'use client';

import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useQuery } from '@tanstack/react-query';
import {
  addHours,
  endOfDay,
  endOfWeek,
  format,
  getDay,
  min as auPlusTot,
  parse,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';

import { ClosingDialog } from '@/components/accueil/closing-dialog';
import { ActionsRendezVous } from '@/components/accueil/rendez-vous-actions';
import { etatDe } from '@/components/accueil/rendez-vous-liste';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CLE_RENDEZ_VOUS,
  lireRendezVousEntre,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { formatDateTime, formatPhone } from '@/lib/format';

const localisateur = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const MESSAGES = {
  today: 'Aujourd’hui',
  previous: 'Précédent',
  next: 'Suivant',
  week: 'Semaine',
  day: 'Jour',
  noEventsInRange: 'Aucun rendez-vous sur cette période.',
  showMore: (nombre: number) => `+${String(nombre)} autres`,
};

interface Evenement {
  title: string;
  start: Date;
  end: Date;
  fiche: RendezVousObtenu;
}

const jour = (date: Date): string => format(date, 'yyyy-MM-dd');

function Detail({
  fiche,
  onClose,
  onCloser,
}: {
  fiche: RendezVousObtenu | null;
  onClose: () => void;
  onCloser: (fiche: RendezVousObtenu) => void;
}) {
  if (fiche === null) return null;
  const etat = etatDe(fiche);
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {fiche.prenom} {fiche.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-1 text-sm">
          <p className="font-[600]">{fiche.quand === null ? '' : formatDateTime(fiche.quand)}</p>
          <p className="text-muted-foreground">
            {fiche.type}
            {fiche.site === '' ? '' : ` · ${fiche.site}`}
          </p>
          {fiche.phoneE164 === null ? null : (
            <a href={`tel:${fiche.phoneE164}`} className="w-fit font-mono text-primary">
              {formatPhone(fiche.phoneE164)}
            </a>
          )}
          <Badge variant={etat.ton} className="mt-1 w-fit">
            {etat.texte}
          </Badge>
        </div>
        <ActionsRendezVous
          fiche={fiche}
          peutNoter
          peutCloser
          onCloser={(choisie) => {
            onClose();
            onCloser(choisie);
          }}
          onEnregistrerVisite={null}
          onFait={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export function RendezVousAgenda() {
  const [date, setDate] = useState(() => new Date());
  const [vue, setVue] = useState<View>(() => (window.innerWidth < 640 ? 'day' : 'week'));
  const [choisie, setChoisie] = useState<RendezVousObtenu | null>(null);
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const du = jour(startOfWeek(date, { weekStartsOn: 1 }));
  const au = jour(endOfWeek(date, { weekStartsOn: 1 }));
  const semaine = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, 'agenda', du, au],
    queryFn: () => lireRendezVousEntre(du, au),
  });
  const evenements: Evenement[] = (semaine.data?.items ?? []).flatMap((fiche) => {
    if (fiche.quand === null) return [];
    const start = new Date(fiche.quand);
    return [
      {
        title: `${fiche.prenom} ${fiche.nom}`,
        start,
        end: auPlusTot([addHours(start, 1), endOfDay(start)]),
        fiche,
      },
    ];
  });

  return (
    <div className="agenda-rendez-vous flex flex-col gap-3">
      {semaine.isError ? (
        <QueryErrorState error={semaine.error} onRetry={() => void semaine.refetch()} />
      ) : null}
      {(semaine.data?.total ?? 0) > evenements.length ? (
        <p className="text-sm text-warning">
          Plus de 200 rendez-vous cette semaine : seuls les 200 premiers sont affichés.
        </p>
      ) : null}
      <Calendar<Evenement>
        localizer={localisateur}
        culture="fr"
        events={evenements}
        date={date}
        view={vue}
        views={['week', 'day']}
        onNavigate={setDate}
        onView={setVue}
        min={new Date(1970, 0, 1, 7)}
        max={new Date(1970, 0, 1, 23, 59)}
        step={30}
        timeslots={2}
        messages={MESSAGES}
        onSelectEvent={(evenement) => {
          setChoisie(evenement.fiche);
        }}
        eventPropGetter={(evenement) => ({
          className: `agenda-${etatDe(evenement.fiche).ton}`,
        })}
        style={{ height: 'calc(100dvh - 11rem)', minHeight: 520 }}
      />
      <Detail
        fiche={choisie}
        onClose={() => {
          setChoisie(null);
        }}
        onCloser={setClosingDe}
      />
      <ClosingDialog
        rendezVous={closingDe}
        onClose={() => {
          setClosingDe(null);
        }}
      />
    </div>
  );
}
