'use client';

import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/data/admin';
import { formatDateTime, formatDeviceCall, formatPhone } from '@/lib/format';
import type { RepresentantCallAttempt } from '@/lib/data/representants';
import { REP_CALL_OUTCOME_LABELS } from '@/lib/types';

function ouiNon(value: boolean): string {
  return value ? 'Oui' : 'Non';
}

/** Le statut exigeait une explication : ce texte est un motif, pas un aparté. */
function exigeaitUnMotif(appel: RepresentantCallAttempt): boolean {
  return (
    (appel as { statutQualificationRequiresComment?: boolean })
      .statutQualificationRequiresComment === true
  );
}

function reponsesDuScript(appel: RepresentantCallAttempt): string[] {
  return [
    appel.etablissementConfirme === null
      ? null
      : `Établissement confirmé : ${ouiNon(appel.etablissementConfirme)}`,
    appel.contacte === null ? null : `Contacté : ${ouiNon(appel.contacte)}`,
    appel.connaitUES === null ? null : `Connaît l’UES : ${ouiNon(appel.connaitUES)}`,
    appel.syndicat === null || appel.syndicat === '' ? null : `Syndicat : ${appel.syndicat}`,
  ].filter((ligne) => ligne !== null);
}

function notePourPersonneProposee(note: string | null): string {
  return note === null || note === '' ? '' : ` · ${note}`;
}

function libelleMotif(appel: RepresentantCallAttempt): string {
  return exigeaitUnMotif(appel) ? 'Motif' : 'Commentaire';
}

function AppelItem({ appel }: { appel: RepresentantCallAttempt }) {
  const reponses = reponsesDuScript(appel);
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {appel.statutQualificationLabel ?? REP_CALL_OUTCOME_LABELS[appel.outcome]}
        </Badge>
        {appel.callbackAt === null ? null : (
          <span className="text-[0.8125rem]">Rappel le {formatDateTime(appel.callbackAt)}</span>
        )}
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        <time dateTime={appel.clientCreatedAt} className="tabular-nums">
          {formatDateTime(appel.clientCreatedAt)}
        </time>{' '}
        · {appel.performedByName}
      </p>
      <p className="text-[0.8125rem] text-muted-foreground">{formatDeviceCall(appel)}</p>
      {appel.dureeTraitementSecondes === null ? null : (
        <p className="text-[0.8125rem] text-muted-foreground">
          Traitement : {formatDuration(appel.dureeTraitementSecondes)}
        </p>
      )}
      {reponses.length === 0 ? null : (
        <p className="text-[0.8125rem] text-muted-foreground">{reponses.join(' · ')}</p>
      )}
      {appel.suggestedPhoneE164 === null ? null : (
        <p className="text-[0.8125rem]">
          Personne proposée : {appel.suggestedName ?? 'sans nom'},{' '}
          {formatPhone(appel.suggestedPhoneE164)}
          {notePourPersonneProposee(appel.suggestedNote)}
        </p>
      )}
      {appel.comment === null || appel.comment === '' ? null : (
        <p className="max-w-prose text-[0.875rem]">
          <span className="text-muted-foreground">{libelleMotif(appel)} : </span>
          {appel.comment}
        </p>
      )}
    </li>
  );
}

/** Chaque appel avec les réponses du script telles qu'elles ont été dites ce jour-là. */
export function AppelsRepresentant({ items }: { items: readonly RepresentantCallAttempt[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucun appel consigné. Le premier se note depuis la console ou le téléphone.
      </p>
    );
  }
  return (
    <ol aria-label="Appels" className="flex flex-col divide-y divide-border">
      {items.map((appel) => (
        <AppelItem key={appel.id} appel={appel} />
      ))}
    </ol>
  );
}
