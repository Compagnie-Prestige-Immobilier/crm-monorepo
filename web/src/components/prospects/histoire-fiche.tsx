'use client';

import { useQuery } from '@tanstack/react-query';

import {
  CarteHistoire,
  Champ,
  Historique,
  type EvenementHistorique,
} from '@/components/historique/historique';
import { evenementJournal } from '@/components/prospects/journal-fiche';
import { formatDuration } from '@/lib/data/admin';
import {
  fetchProspectCallAttempts,
  fetchProspectDeviceCalls,
  fetchProspectJournal,
  fetchProspectSegmentHistory,
  type DeviceCallDetection,
  type ProspectCallAttempt,
  type SegmentChangeRow,
} from '@/lib/data/prospects';
import { formatDateTime, formatDetectedCall, formatDeviceCall, formatNumber } from '@/lib/format';
import { SEGMENT_LABELS, enrollmentMethodLabel, type ProspectRow, type Role } from '@/lib/types';

export const NO_VALUE = '–';

const SOURCE_LABELS = { WEB: 'Panneau', MOBILE: 'Mobile' } as const;

function ouiNon(value: boolean | null): string {
  if (value === null) return NO_VALUE;
  return value ? 'Oui' : 'Non';
}

export function ouVide(value: string | null, repli: string = NO_VALUE): string {
  return value === null || value === '' ? repli : value;
}

export function voitLeSegment(role: Role): boolean {
  return role === 'ADMIN' || role === 'COMMERCIAL';
}

function evenementCreation(prospect: ProspectRow): EvenementHistorique {
  const origine =
    prospect.representantName === null
      ? ouVide(prospect.originLabel, 'Origine non renseignée')
      : `Apporté par ${prospect.representantName}`;
  return {
    id: `creation-${prospect.id}`,
    categorie: 'fiche',
    at: prospect.clientCreatedAt,
    titre: 'Fiche créée',
    resume: origine,
    acteur: prospect.ownedByCommercialName,
    lien:
      prospect.representantId === null
        ? null
        : {
            href: `/teleconseil/representants/${prospect.representantId}`,
            label: 'Ouvrir la fiche du représentant',
          },
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Téléconseiller">{prospect.ownedByCommercialName}</Champ>
        <Champ label="Le">{formatDateTime(prospect.clientCreatedAt)}</Champ>
        <Champ label="Représentant">{ouVide(prospect.representantName)}</Champ>
        <Champ label="Origine">{ouVide(prospect.originLabel)}</Champ>
      </dl>
    ),
  };
}

function resumeAppel(appel: ProspectCallAttempt): string {
  if (appel.comment !== null && appel.comment !== '') return appel.comment;
  if (appel.method !== null) return `Méthode : ${enrollmentMethodLabel(appel.method)}`;
  if (appel.rendezVousAt !== null) return `Rendez-vous le ${formatDateTime(appel.rendezVousAt)}`;
  return '';
}

function evenementAppel(appel: ProspectCallAttempt): EvenementHistorique {
  return {
    id: appel.id,
    categorie: 'appel',
    at: appel.clientCreatedAt,
    titre: appel.reasonLabel,
    variant: appel.joignable ? 'success' : 'warning',
    resume: resumeAppel(appel),
    acteur: appel.performedByName,
    source: appel.deviceCallAt === null ? 'Non confirmé par le téléphone' : formatDeviceCall(appel),
    detail: (
      <>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Motif retenu">{ouVide(appel.reasonLabel, 'Aucun')}</Champ>
          <Champ label="Téléphone">{formatDeviceCall(appel).replace('Téléphone : ', '')}</Champ>
          <Champ label="Temps de traitement">
            {appel.dureeTraitementSecondes === null
              ? NO_VALUE
              : formatDuration(appel.dureeTraitementSecondes)}
          </Champ>
          <Champ label="Méthode d’enrôlement">
            {appel.method === null ? NO_VALUE : enrollmentMethodLabel(appel.method)}
          </Champ>
          <Champ label="Rendez-vous">
            {appel.rendezVousAt === null ? 'Aucun' : formatDateTime(appel.rendezVousAt)}
          </Champ>
        </dl>
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Réponses du script</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Fonctionnaire">{ouiNon(appel.fonctionnaire)}</Champ>
            <Champ label="Engagement en cours">{ouiNon(appel.engagementEnCours)}</Champ>
            <Champ label="Ancienneté">
              {appel.dureeEtablissementMois === null
                ? NO_VALUE
                : `${formatNumber(appel.dureeEtablissementMois)} mois dans la fonction`}
            </Champ>
            <Champ label="E-mail">{ouVide(appel.email)}</Champ>
          </dl>
        </section>
        {appel.comment === null || appel.comment === '' ? null : (
          <section className="flex flex-col gap-1">
            <p className="eyebrow text-muted-foreground">Commentaire</p>
            <p className="whitespace-pre-wrap">{appel.comment}</p>
          </section>
        )}
      </>
    ),
  };
}

function evenementReleve(releve: DeviceCallDetection): EvenementHistorique {
  return {
    id: releve.id,
    categorie: 'appel',
    at: releve.deviceCallAt,
    titre: 'Appel non consigné',
    variant: 'warning',
    resume: formatDetectedCall(releve),
    acteur: releve.performedByName,
    source: 'Journal du téléphone',
    detail: (
      <>
        <p className="text-muted-foreground">
          Le téléphone a relevé cet appel, mais personne n’en a consigné le compte rendu.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Appel">{formatDetectedCall(releve)}</Champ>
          <Champ label="Relevé le">{formatDateTime(releve.detectedAt)}</Champ>
        </dl>
      </>
    ),
  };
}

function evenementSegment(change: SegmentChangeRow): EvenementHistorique {
  return {
    id: change.id,
    categorie: 'statut',
    at: change.changedAt,
    titre: `${change.fromSegment} → ${change.toSegment}`,
    variant: 'info',
    resume: change.reason,
    acteur: change.changedByName,
    source: SOURCE_LABELS[change.source],
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Avant">{SEGMENT_LABELS[change.fromSegment]}</Champ>
        <Champ label="Après">{SEGMENT_LABELS[change.toSegment]}</Champ>
        <Champ label="Motif">{ouVide(change.reason, 'Aucun')}</Champ>
        <Champ label="Depuis">{SOURCE_LABELS[change.source]}</Champ>
      </dl>
    ),
  };
}

function evenementsDeLaFiche(prospect: ProspectRow): EvenementHistorique[] {
  const evenements: EvenementHistorique[] = [evenementCreation(prospect)];
  if (prospect.enrollmentCapturedAt !== null && prospect.enrollmentMethod !== null) {
    evenements.push({
      id: `enrolement-${prospect.id}`,
      categorie: 'statut',
      at: prospect.enrollmentCapturedAt,
      titre: 'Méthode obtenue',
      variant: 'success',
      resume: enrollmentMethodLabel(prospect.enrollmentMethod),
      acteur: prospect.enrollmentCapturedByName ?? prospect.ownedByCommercialName,
      detail: (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Méthode d’enrôlement">
            {enrollmentMethodLabel(prospect.enrollmentMethod)}
          </Champ>
          <Champ label="Le">{formatDateTime(prospect.enrollmentCapturedAt)}</Champ>
        </dl>
      ),
    });
  }
  if (prospect.revueAt !== null) {
    evenements.push({
      id: `revue-${prospect.id}`,
      categorie: 'statut',
      at: prospect.revueAt,
      titre: 'Demande revue',
      variant: 'success',
      resume: 'La demande convertie a été relue avant transmission à l’enrôlement.',
      acteur: prospect.revueByName ?? 'Revue',
      detail: (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Revue par">{ouVide(prospect.revueByName)}</Champ>
          <Champ label="Le">{formatDateTime(prospect.revueAt)}</Champ>
        </dl>
      ),
    });
  }
  return evenements;
}

/**
 * Tout ce qui est arrivé à une fiche, CHUES ou Grand Public : ses appels, ses
 * bascules et chaque changement noté au journal, du plus récent au plus ancien.
 */
export function HistoireDeLaFiche({ prospect, role }: { prospect: ProspectRow; role: Role }) {
  const appels = useQuery({
    queryKey: ['prospects', 'call-attempts', prospect.id],
    queryFn: () => fetchProspectCallAttempts(prospect.id),
  });
  const releves = useQuery({
    queryKey: ['prospects', 'device-calls', prospect.id],
    queryFn: () => fetchProspectDeviceCalls(prospect.id),
  });
  const segments = useQuery({
    queryKey: ['prospects', 'segment-history', prospect.id],
    queryFn: () => fetchProspectSegmentHistory(prospect.id),
    enabled: voitLeSegment(role),
  });
  const journal = useQuery({
    queryKey: ['prospects', 'journal', prospect.id],
    queryFn: () => fetchProspectJournal(prospect.id),
  });
  const evenements: EvenementHistorique[] = [
    ...evenementsDeLaFiche(prospect),
    ...(appels.data ?? []).map(evenementAppel),
    ...(releves.data ?? []).filter((r) => r.attemptId === null).map(evenementReleve),
    ...(segments.data ?? []).map(evenementSegment),
    ...(journal.data ?? []).map(evenementJournal),
  ];
  const sources = voitLeSegment(role)
    ? [appels, releves, segments, journal]
    : [appels, releves, journal];

  return (
    <CarteHistoire
      titre="Histoire de la fiche"
      description="Chaque appel, chaque bascule et chaque changement, du plus récent au plus ancien. Cliquez une ligne pour tout voir."
      sources={sources}
    >
      <Historique
        evenements={evenements}
        categories={['appel', 'statut', 'fiche']}
        vide="Rien ne s’est encore passé sur cette fiche. Le premier appel consigné ouvre l’histoire."
        videParCategorie={{
          appel: 'Aucun appel consigné. Le premier se note depuis la console ou le téléphone.',
          statut:
            'Aucune bascule enregistrée. Ni méthode obtenue, ni revue, ni changement de segment.',
        }}
      />
    </CarteHistoire>
  );
}
