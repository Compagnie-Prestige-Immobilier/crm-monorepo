import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { dureeAffichee, formatPresence } from '@/components/supervision/colonnes';
import {
  appelsParHeure,
  BadgeNote,
  BasculeNote,
  DetailNote,
  Fait,
  Faits,
  parNoteDecroissante,
} from '@/components/supervision/note';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { CompteSupervise, EtatPresence } from '@/lib/data/presence';
import { formatNumber } from '@/lib/format';

const COLONNES = 6;

const ETAT_LABELS: Record<EtatPresence, string> = {
  ONLINE: 'Connecté',
  RECENT: 'Récent',
  AWAY: 'Inactif',
};

const ETAT_VARIANTES: Record<EtatPresence, 'success' | 'info' | 'secondary'> = {
  ONLINE: 'success',
  RECENT: 'info',
  AWAY: 'secondary',
};

function minutesDepuis(iso: string | null, observedAt: string): number | null {
  if (iso === null) return null;
  const vu = Date.parse(iso);
  const maintenant = Date.parse(observedAt);
  if (Number.isNaN(vu) || Number.isNaN(maintenant)) return null;
  return Math.max(0, Math.round((maintenant - vu) / 60_000));
}

function formatEcoule(minutes: number | null): string {
  if (minutes === null) return 'Jamais';
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `${String(minutes)} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${String(heures)} h`;
  return `${String(Math.floor(heures / 24))} j`;
}

const heureDakar = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Dakar',
  hour: '2-digit',
  minute: '2-digit',
});

function formatHeure(iso: string | null): string {
  if (iso === null) return 'Sans objet';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? 'Sans objet' : heureDakar.format(at);
}

function tempsMort(secondes: number, trous: number): string {
  if (trous === 0) return 'Aucun';
  return `${dureeAffichee(secondes)} sur ${formatNumber(trous)} trou${trous > 1 ? 's' : ''}`;
}

export function CarteEtat({
  label,
  valeur,
  ton,
  index,
}: {
  label: string;
  valeur: number;
  ton: 'success' | 'info' | 'muted';
  index: number;
}) {
  const couleur = {
    success: 'text-success',
    info: 'text-info',
    muted: 'text-muted-foreground',
  }[ton];

  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent>
        <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={`mt-1 block font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums ${couleur}`}
        >
          {formatNumber(valeur)}
        </span>
      </CardContent>
    </Card>
  );
}

function LignesCompte({
  compte,
  observedAt,
  ouvert,
  onBascule,
}: {
  compte: CompteSupervise;
  observedAt: string;
  ouvert: boolean;
  onBascule: () => void;
}) {
  return (
    <>
      <tr>
        <th scope="row" className="px-5 py-2 text-left font-[400]">
          <BasculeNote ouvert={ouvert} onBascule={onBascule}>
            <span className="block font-[600]">{compte.fullName}</span>
            <span className="block text-[0.75rem] text-muted-foreground">{compte.username}</span>
          </BasculeNote>
        </th>
        <td className="px-5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={ETAT_VARIANTES[compte.presence]}>{ETAT_LABELS[compte.presence]}</Badge>
            {!compte.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
            {compte.journalAppelsAutorise === false ? (
              <Badge variant="outline">Journal d’appels refusé</Badge>
            ) : null}
          </div>
        </td>
        <td className="px-5 py-2">
          <BadgeNote note={compte.score} />
        </td>
        <td className="px-5 py-2 text-right tabular-nums">
          {formatPresence(compte.activeSecondsToday)}
        </td>
        <td className="px-5 py-2 text-right tabular-nums">{formatNumber(compte.callsToday)}</td>
        <td className="px-5 py-2 text-right tabular-nums">
          {compte.pendingOps === null ? 'Inconnu' : formatNumber(compte.pendingOps)}
        </td>
      </tr>
      {ouvert ? (
        <tr className="bg-muted/40">
          <td colSpan={COLONNES} className="px-5 pb-4 pt-2">
            <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
              <Faits titre="Journée">
                <Fait
                  label="Dernier signal"
                  valeur={formatEcoule(minutesDepuis(compte.lastSeenAt, observedAt))}
                />
                <Fait label="Premier appel" valeur={formatHeure(compte.firstCallAt)} />
                <Fait label="Dernier appel" valeur={formatHeure(compte.lastCallAt)} />
                <Fait
                  label="Appels par heure active"
                  valeur={appelsParHeure(compte.callsToday, compte.activeSecondsInShifts)}
                />
                <Fait label="Cadence médiane" valeur={dureeAffichee(compte.medianGapSeconds)} />
                <Fait label="Temps mort" valeur={tempsMort(compte.deadSeconds, compte.deadGaps)} />
                <Fait label="Reprises" valeur={formatNumber(compte.repeatCalls)} />
                <Fait
                  label="Retard de synchro"
                  valeur={dureeAffichee(compte.medianUploadLagSeconds)}
                />
                <Fait
                  label="Dernière saisie"
                  valeur={formatEcoule(minutesDepuis(compte.lastWriteAt, observedAt))}
                />
              </Faits>

              <DetailNote parts={compte.score.parts} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function TablePresence({
  icon: Icon,
  titre,
  comptes,
  observedAt,
  vide,
}: {
  icon: LucideIcon;
  titre: string;
  comptes: readonly CompteSupervise[];
  observedAt: string;
  vide: string;
}) {
  const [ouvertId, setOuvertId] = useState<string | null>(null);

  return (
    <Card className="animate-rise">
      <CardContent className="scrollbar-thin overflow-x-auto p-0">
        <table className="w-full text-[0.875rem]">
          <caption className="flex items-center gap-2 px-5 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            <Icon className="size-4" aria-hidden="true" />
            {titre}
            <span className="font-sans text-[0.8125rem] font-[400] text-muted-foreground tabular-nums">
              {comptes.length}
            </span>
          </caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                Compte
              </th>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                État
              </th>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                Rendement
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Temps actif aujourd’hui
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Appels aujourd’hui
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                En attente
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parNoteDecroissante(comptes).map((compte) => (
              <LignesCompte
                key={compte.id}
                compte={compte}
                observedAt={observedAt}
                ouvert={ouvertId === compte.id}
                onBascule={() => {
                  setOuvertId(ouvertId === compte.id ? null : compte.id);
                }}
              />
            ))}
            {comptes.length === 0 ? (
              <tr>
                <td colSpan={COLONNES} className="px-5 py-6 text-center text-muted-foreground">
                  {vide}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
