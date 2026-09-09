import { LIBELLES_METHODE } from '@/components/chues/conversion-champs';
import type { EvenementHistorique } from '@/components/historique/evenement';
import { Champ } from '@/components/historique/historique';
import { CALL_OUTCOME_LABELS } from '@/lib/data/console';
import type { AppelProspect, Prospect } from '@/lib/data/prospects';
import { formatDateTime, formatDuree, formatNumber } from '@/lib/format';

const SANS_VALEUR = '–';

function ouiNon(valeur: boolean | null): string {
  if (valeur === null) return SANS_VALEUR;
  return valeur ? 'Oui' : 'Non';
}

function ouVide(valeur: string | null, repli: string = SANS_VALEUR): string {
  return valeur === null || valeur === '' ? repli : valeur;
}

export function evenementCreation(projet: string, prospect: Prospect): EvenementHistorique {
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
            href: `/${projet}/representants/${prospect.representantId}`,
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

function resumeAppel(appel: AppelProspect): string {
  if (appel.comment !== null && appel.comment !== '') return appel.comment;
  if (appel.method !== null) {
    return `Méthode : ${LIBELLES_METHODE[appel.method as keyof typeof LIBELLES_METHODE] ?? appel.method}`;
  }
  if (appel.rendezVousAt !== null) return `Rendez-vous le ${formatDateTime(appel.rendezVousAt)}`;
  return '';
}

function DetailAppel({ appel }: { appel: AppelProspect }) {
  const commentaire = appel.comment ?? '';
  const methode = appel.method;
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Issue">
          {CALL_OUTCOME_LABELS[appel.outcome as keyof typeof CALL_OUTCOME_LABELS] ?? appel.outcome}
        </Champ>
        <Champ label="Motif retenu">{ouVide(appel.reasonLabel, 'Aucun')}</Champ>
        <Champ label="Temps de traitement">
          {appel.dureeTraitementSecondes === null
            ? SANS_VALEUR
            : formatDuree(appel.dureeTraitementSecondes)}
        </Champ>
        <Champ label="Méthode d’enrôlement">
          {methode === null
            ? SANS_VALEUR
            : (LIBELLES_METHODE[methode as keyof typeof LIBELLES_METHODE] ?? methode)}
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
              ? SANS_VALEUR
              : `${formatNumber(appel.dureeEtablissementMois)} mois dans la fonction`}
          </Champ>
          <Champ label="E-mail">{ouVide(appel.email)}</Champ>
        </dl>
      </section>
      {commentaire === '' ? null : (
        <section className="flex flex-col gap-1">
          <p className="eyebrow text-muted-foreground">Commentaire</p>
          <p className="whitespace-pre-wrap">{commentaire}</p>
        </section>
      )}
    </>
  );
}

export function evenementAppel(appel: AppelProspect): EvenementHistorique {
  return {
    id: appel.id,
    categorie: 'appel',
    at: appel.clientCreatedAt,
    titre:
      appel.reasonLabel ??
      CALL_OUTCOME_LABELS[appel.outcome as keyof typeof CALL_OUTCOME_LABELS] ??
      appel.outcome,
    resume: resumeAppel(appel),
    acteur: appel.performedByName,
    detail: <DetailAppel appel={appel} />,
  };
}

/** Les deux bascules que la fiche porte elle-même : la méthode obtenue et la revue. */
export function evenementsDeLaFiche(prospect: Prospect): EvenementHistorique[] {
  const evenements: EvenementHistorique[] = [];
  const methode = prospect.enrollmentMethod;

  if (prospect.enrollmentCapturedAt !== null && methode !== null) {
    const libelle = LIBELLES_METHODE[methode as keyof typeof LIBELLES_METHODE] ?? methode;
    evenements.push({
      id: `enrolement-${prospect.id}`,
      categorie: 'statut',
      at: prospect.enrollmentCapturedAt,
      titre: 'Méthode obtenue',
      variant: 'success',
      resume: libelle,
      acteur: prospect.enrollmentCapturedByName ?? prospect.ownedByCommercialName,
      detail: (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Méthode d’enrôlement">{libelle}</Champ>
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
