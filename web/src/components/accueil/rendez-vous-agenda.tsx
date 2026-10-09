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
  startOfHour,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type ToolbarProps,
  type View,
} from 'react-big-calendar';

import { ClosingDialog } from '@/components/accueil/closing-dialog';
import {
  CreneauRendezVous,
  Ouvrir,
  tonDuCreneau,
} from '@/components/accueil/rendez-vous-agenda-creneau';
import { FichePopup } from '@/components/accueil/fiche-popup';
import { TYPES } from '@/components/accueil/rendez-vous-filtres';
import { etatDe } from '@/components/accueil/rendez-vous-tableau';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CLE_RENDEZ_VOUS,
  lireRendezVousEntre,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';

const localisateur = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const FORMATS = {
  dayFormat: 'EEE d',
  timeGutterFormat: 'HH:mm',
  dayHeaderFormat: 'EEEE d MMMM',
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`,
};

/** Les heures du comptoir ; une semaine qui déborde élargit la grille, jamais l'inverse. */
const OUVERTURE = 8;
const FERMETURE = 19;

const LEGENDE: readonly { texte: string; ton: 'warning' | 'info' | 'success' | 'destructive' }[] = [
  { texte: 'À confirmer', ton: 'warning' },
  { texte: 'Confirmé', ton: 'info' },
  { texte: 'Présent', ton: 'success' },
  { texte: 'Annulé ou absent', ton: 'destructive' },
];

const STATUTS: readonly { value: string; label: string }[] = [
  { value: 'tous', label: 'Tous les statuts' },
  ...LEGENDE.map((item) => ({ value: item.ton, label: item.texte })),
];

function Choix({
  choix,
  valeur,
  libelle,
  changer,
}: {
  choix: readonly { value: string; label: string }[];
  valeur: string;
  libelle: string;
  changer: (valeur: string) => void;
}) {
  return (
    <Select
      items={choix}
      value={valeur}
      onValueChange={(choisi) => {
        changer(choisi ?? 'tous');
      }}
    >
      <SelectTrigger aria-label={libelle} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choix.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Evenement {
  title: string;
  start: Date;
  end: Date;
  fiches: RendezVousObtenu[];
}

const avantHeure = (fiche: RendezVousObtenu): Date => new Date(fiche.quand ?? 0);

/** En semaine, une heure tient en une carte : sept colonnes étroites rendraient les noms illisibles. */
function evenementsDe(items: readonly RendezVousObtenu[], parHeure: boolean): Evenement[] {
  const groupes = new Map<string, RendezVousObtenu[]>();
  for (const fiche of items) {
    if (fiche.quand === null) continue;
    const cle = parHeure ? format(startOfHour(avantHeure(fiche)), "yyyy-MM-dd'T'HH") : fiche.id;
    groupes.set(cle, [...(groupes.get(cle) ?? []), fiche]);
  }
  return [...groupes.values()].map((fiches) => {
    const premiere = fiches[0] as RendezVousObtenu;
    const start = parHeure ? startOfHour(avantHeure(premiere)) : avantHeure(premiere);
    const titre = `${premiere.prenom} ${premiere.nom}`;
    return {
      title: fiches.length === 1 ? titre : `${String(fiches.length)} rendez-vous`,
      start,
      end: auPlusTot([addHours(start, 1), endOfDay(start)]),
      fiches,
    };
  });
}

const jour = (date: Date): string => format(date, 'yyyy-MM-dd');

function heures(evenements: Evenement[]): { min: Date; max: Date } {
  const debut = Math.min(OUVERTURE, ...evenements.map((e) => e.start.getHours()));
  const fin = Math.max(FERMETURE, ...evenements.map((e) => e.start.getHours() + 1));
  return { min: new Date(1970, 0, 1, debut), max: new Date(1970, 0, 1, Math.min(fin, 23), 59) };
}

function Barre({ label, onNavigate, view, onView }: ToolbarProps<Evenement>) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onNavigate('TODAY');
        }}
      >
        Aujourd’hui
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Période précédente"
        onClick={() => {
          onNavigate('PREV');
        }}
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Période suivante"
        onClick={() => {
          onNavigate('NEXT');
        }}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Button>
      <p className="font-display text-[1.0625rem] font-[700] capitalize">{label}</p>
      <Tabs
        value={view}
        onValueChange={(valeur) => {
          onView(valeur as View);
        }}
        className="ml-auto"
      >
        <TabsList>
          <TabsTrigger value="week">Semaine</TabsTrigger>
          <TabsTrigger value="day">Jour</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function Rendu({ event }: EventProps<Evenement>) {
  const [ouvert, setOuvert] = useState(false);
  const seule = event.fiches.length === 1 ? event.fiches[0] : undefined;
  const sousTitre =
    seule === undefined
      ? event.fiches.map((fiche) => `${fiche.prenom} ${fiche.nom}`).join(', ')
      : `${format(avantHeure(seule), 'HH:mm')} · ${etatDe(seule).texte}`;
  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${event.title}, ${sousTitre}`}
            title={`${event.title} · ${sousTitre}`}
            className="flex h-full w-full min-w-0 flex-col gap-0.5 overflow-hidden text-left leading-tight"
          />
        }
      >
        <span className="truncate font-[600]">{event.title}</span>
        <span className="truncate text-[0.6875rem] tabular-nums opacity-80">{sousTitre}</span>
      </PopoverTrigger>
      <PopoverContent side="right" className="max-h-[80dvh] w-80 overflow-y-auto">
        <CreneauRendezVous
          fiches={event.fiches}
          onFait={() => {
            setOuvert(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function RendezVousAgenda() {
  const [date, setDate] = useState(() => new Date());
  const [vue, setVue] = useState<View>(() => (window.innerWidth < 640 ? 'day' : 'week'));
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const [ficheDe, setFicheDe] = useState<string | null>(null);
  const [type, setType] = useState('tous');
  const [statut, setStatut] = useState('tous');
  const du = jour(startOfWeek(date, { weekStartsOn: 1 }));
  const au = jour(endOfWeek(date, { weekStartsOn: 1 }));
  const semaine = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, 'agenda', du, au, type],
    queryFn: () => lireRendezVousEntre(du, au, type === 'tous' ? '' : type),
  });
  const recus = semaine.data?.items ?? [];
  const visibles =
    statut === 'tous' ? recus : recus.filter((fiche) => etatDe(fiche).ton === statut);
  const evenements = evenementsDe(visibles, vue === 'week');
  const { min, max } = heures(evenements);

  return (
    <Ouvrir.Provider value={{ closing: setClosingDe, fiche: setFicheDe }}>
      <div className="agenda-rendez-vous flex flex-col gap-3">
        {semaine.isError ? (
          <QueryErrorState error={semaine.error} onRetry={() => void semaine.refetch()} />
        ) : null}
        {(semaine.data?.total ?? 0) > recus.length ? (
          <p className="text-sm text-warning">
            Plus de 200 rendez-vous cette semaine : seuls les 200 premiers sont affichés.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Choix choix={STATUTS} valeur={statut} libelle="Statut" changer={setStatut} />
          <Choix choix={TYPES} valeur={type} libelle="Type de rendez-vous" changer={setType} />
          <ul aria-label="Légende" className="ml-auto flex flex-wrap gap-2">
            {LEGENDE.map((item) => (
              <li key={item.texte}>
                <Badge variant={item.ton}>{item.texte}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <Calendar<Evenement>
          localizer={localisateur}
          culture="fr"
          events={evenements}
          date={date}
          view={vue}
          views={['week', 'day']}
          onNavigate={setDate}
          onView={setVue}
          min={min}
          max={max}
          scrollToTime={min}
          step={30}
          timeslots={2}
          // En vue Jour, les rendez-vous d'une même heure se rangent côte à côte au lieu de se recouvrir.
          dayLayoutAlgorithm="no-overlap"
          formats={FORMATS}
          components={{ toolbar: Barre, event: Rendu }}
          eventPropGetter={(evenement) => ({
            className: `agenda-${tonDuCreneau(evenement.fiches)}`,
          })}
          style={{ height: 'calc(100dvh - 9rem)', minHeight: 520 }}
        />
        <ClosingDialog
          rendezVous={closingDe}
          onClose={() => {
            setClosingDe(null);
          }}
        />
        <FichePopup
          prospectId={ficheDe}
          onClose={() => {
            setFicheDe(null);
          }}
        />
      </div>
    </Ouvrir.Provider>
  );
}
