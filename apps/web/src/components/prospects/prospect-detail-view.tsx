'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { DetailBackLink } from '@/components/detail-back-link';
import { FicheEnTete, type ChiffreDeFiche } from '@/components/fiche-en-tete';
import {
  CarteHistoire,
  Champ,
  Historique,
  type EvenementHistorique,
} from '@/components/historique/historique';
import { BoutonWhatsApp } from '@/components/prospects/bouton-whatsapp';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/data/admin';
import { useChampsConversion } from '@/lib/data/champs-conversion';
import {
  fetchProspect,
  fetchProspectCallAttempts,
  fetchProspectDeviceCalls,
  fetchProspectSegmentHistory,
  marquerProspectRevue,
  type DeviceCallDetection,
  type ProspectCallAttempt,
  type SegmentChangeRow,
} from '@/lib/data/prospects';
import {
  formatDate,
  formatDateTime,
  formatDetectedCall,
  formatDeviceCall,
  formatNumber,
  formatPhone,
} from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_VARIANTS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  peutRevoirUneDemande,
  type ProspectRow,
  type Role,
} from '@/lib/types';

const NO_VALUE = '–';

const SOURCE_LABELS = { WEB: 'Panneau', MOBILE: 'Mobile' } as const;

function ouiNon(value: boolean | null): string {
  if (value === null) return NO_VALUE;
  return value ? 'Oui' : 'Non';
}

function ouVide(value: string | null, repli: string = NO_VALUE): string {
  return value === null || value === '' ? repli : value;
}

function voitLeSegment(role: Role): boolean {
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
            href: `/chues/representants/${prospect.representantId}`,
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
  if (appel.method !== null) return `Méthode : ${ENROLLMENT_METHOD_LABELS[appel.method]}`;
  if (appel.rendezVousAt !== null) return `Rendez-vous le ${formatDateTime(appel.rendezVousAt)}`;
  return '';
}

function evenementAppel(appel: ProspectCallAttempt): EvenementHistorique {
  return {
    id: appel.id,
    categorie: 'appel',
    at: appel.clientCreatedAt,
    titre: appel.reasonLabel ?? CALL_OUTCOME_LABELS[appel.outcome],
    variant: CALL_OUTCOME_VARIANTS[appel.outcome],
    resume: resumeAppel(appel),
    acteur: appel.performedByName,
    source: appel.deviceCallAt === null ? 'Non confirmé par le téléphone' : formatDeviceCall(appel),
    detail: (
      <>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Issue">{CALL_OUTCOME_LABELS[appel.outcome]}</Champ>
          <Champ label="Motif retenu">{ouVide(appel.reasonLabel, 'Aucun')}</Champ>
          <Champ label="Téléphone">{formatDeviceCall(appel).replace('Téléphone : ', '')}</Champ>
          <Champ label="Temps de traitement">
            {appel.dureeTraitementSecondes === null
              ? NO_VALUE
              : formatDuration(appel.dureeTraitementSecondes)}
          </Champ>
          <Champ label="Méthode d’enrôlement">
            {appel.method === null ? NO_VALUE : ENROLLMENT_METHOD_LABELS[appel.method]}
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
            <p className="eyebrow text-muted-foreground">
              {appel.outcome === 'OTHER' ? 'Motif' : 'Commentaire'}
            </p>
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
      resume: ENROLLMENT_METHOD_LABELS[prospect.enrollmentMethod],
      acteur: prospect.enrollmentCapturedByName ?? prospect.ownedByCommercialName,
      detail: (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Méthode d’enrôlement">
            {ENROLLMENT_METHOD_LABELS[prospect.enrollmentMethod]}
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

function chiffresDe(prospect: ProspectRow): ChiffreDeFiche[] {
  const dernierPar = prospect.lastCallByName === null ? '' : ` · ${prospect.lastCallByName}`;
  return [
    {
      label: 'Appels consignés',
      valeur: formatNumber(prospect.callAttemptCount),
      precision:
        prospect.lastCallOutcome === null
          ? 'Jamais appelé'
          : `Dernier : ${CALL_OUTCOME_LABELS[prospect.lastCallOutcome]}`,
    },
    {
      label: 'Dernier appel',
      valeur: prospect.lastCallAt === null ? NO_VALUE : formatDate(prospect.lastCallAt),
      precision:
        prospect.lastCallAt === null ? null : `${formatDateTime(prospect.lastCallAt)}${dernierPar}`,
    },
    {
      label: 'À revoir',
      valeur: prospect.aRevoirAt === null ? 'Aucun' : formatDate(prospect.aRevoirAt),
      precision: prospect.aRevoirAt === null ? null : formatDateTime(prospect.aRevoirAt),
    },
  ];
}

/** La fiche CHUES telle que les téléconseillers l'ont remplie, et tout ce qui lui est arrivé depuis. */
export function ProspectDetailView({ prospectId, role }: { prospectId: string; role: Role }) {
  const fiche = useQuery({
    queryKey: queryKeys.prospect(prospectId),
    queryFn: () => fetchProspect(prospectId),
  });
  const appels = useQuery({
    queryKey: ['prospects', 'call-attempts', prospectId],
    queryFn: () => fetchProspectCallAttempts(prospectId),
  });
  const releves = useQuery({
    queryKey: ['prospects', 'device-calls', prospectId],
    queryFn: () => fetchProspectDeviceCalls(prospectId),
  });
  const segments = useQuery({
    queryKey: ['prospects', 'segment-history', prospectId],
    queryFn: () => fetchProspectSegmentHistory(prospectId),
    enabled: voitLeSegment(role),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/prospects">Tous les prospects</DetailBackLink>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/prospects">Tous les prospects</DetailBackLink>
        <QueryErrorState
          error={fiche.error}
          onRetry={() => {
            void fiche.refetch();
          }}
          fallback="Cette fiche n’a pas pu être chargée."
        />
      </div>
    );
  }

  const prospect: ProspectRow = fiche.data;
  const evenements: EvenementHistorique[] = [
    ...evenementsDeLaFiche(prospect),
    ...(appels.data ?? []).map(evenementAppel),
    ...(releves.data ?? []).filter((r) => r.attemptId === null).map(evenementReleve),
    ...(segments.data ?? []).map(evenementSegment),
  ];

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/chues/prospects">Tous les prospects</DetailBackLink>

      <FicheEnTete
        nom={`${prospect.prenom} ${prospect.nom}`}
        phoneE164={prospect.phoneE164}
        badges={
          <>
            <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
            <Badge variant="secondary">{PHASE2_STATUS_LABELS[prospect.phase2Status]}</Badge>
            <RevueDemande prospect={prospect} role={role} />
          </>
        }
        actions={<BoutonWhatsApp prospect={prospect} />}
        chiffres={chiffresDe(prospect)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CarteHistoire
          titre="Histoire de la fiche"
          description="Chaque appel et chaque bascule, du plus récent au plus ancien. Cliquez une ligne pour tout voir."
          sources={voitLeSegment(role) ? [appels, releves, segments] : [appels, releves]}
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

        <div className="flex min-w-0 flex-col gap-6">
          <FicheProspect prospect={prospect} role={role} />
          <ChampsAjoutes prospect={prospect} />
        </div>
      </div>
    </div>
  );
}

function FicheProspect({ prospect, role }: { prospect: ProspectRow; role: Role }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-[0.875rem]">
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Qui il est</p>
          <dl className="grid grid-cols-2 gap-3">
            <Champ label="WhatsApp">
              {prospect.whatsappNumber === null ? NO_VALUE : formatPhone(prospect.whatsappNumber)}
            </Champ>
            <Champ label="Profession">{ouVide(prospect.profession)}</Champ>
            <Champ label="Établissement">{ouVide(prospect.etablissement)}</Champ>
            <Champ label="Département">{ouVide(prospect.departementName)}</Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Banque et syndicat</p>
          <dl className="grid grid-cols-2 gap-3">
            <Champ label="Banque">{ouVide(prospect.banqueName)}</Champ>
            <Champ label="Syndicat">{ouVide(prospect.syndicatSigle)}</Champ>
            {voitLeSegment(role) ? (
              <Champ label="Segment">
                {prospect.segment === null ? NO_VALUE : SEGMENT_LABELS[prospect.segment]}
              </Champ>
            ) : null}
            <Champ label="Méthode d’enrôlement">
              {prospect.enrollmentMethod === null
                ? NO_VALUE
                : ENROLLMENT_METHOD_LABELS[prospect.enrollmentMethod]}
            </Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Qui s’en occupe</p>
          <dl className="grid grid-cols-2 gap-3">
            <Champ label="Téléconseiller">{prospect.ownedByCommercialName}</Champ>
            <Champ label="Saisi le">{formatDate(prospect.clientCreatedAt)}</Champ>
            <Champ label="Représentant">{ouVide(prospect.representantName)}</Champ>
          </dl>
          {prospect.representantId === null ? null : (
            <Link
              href={`/chues/representants/${prospect.representantId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}
            >
              <ExternalLinkIcon aria-hidden="true" />
              Ouvrir la fiche du représentant
            </Link>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/** Les réponses aux champs que l'administrateur a ajoutés au formulaire. Sans réponse, rien. */
function ChampsAjoutes({ prospect }: { prospect: ProspectRow }) {
  const formulaire = useChampsConversion(prospect.projet);
  const renseignes = formulaire.libres.filter(
    (champ) => (prospect.champsLibres[champ.id] ?? '') !== '',
  );
  if (renseignes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Champs ajoutés</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-[0.875rem]">
          {renseignes.map((champ) => (
            <Champ key={champ.id} label={champ.libelle}>
              {prospect.champsLibres[champ.id]}
            </Champ>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** La revue du closing : rien tant que la demande n'est pas convertie. */
function RevueDemande({ prospect, role }: { prospect: ProspectRow; role: Role }) {
  const queryClient = useQueryClient();
  const revue = useMutation({
    mutationFn: () => marquerProspectRevue(prospect.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Demande revue.');
    },
    onError: (error) => {
      toastApiError(error, 'La revue n’a pas pu être enregistrée.');
    },
  });

  if (prospect.statut !== 'CONVERTI') return null;

  if (prospect.revueAt !== null) {
    return (
      <Badge variant="success">
        Revue le {formatDate(prospect.revueAt)}
        {prospect.revueByName === null ? '' : ` par ${prospect.revueByName}`}
      </Badge>
    );
  }

  return (
    <>
      <Badge variant="warning">Demande non revue</Badge>
      {peutRevoirUneDemande(role) ? (
        <Button
          size="sm"
          disabled={revue.isPending}
          onClick={() => {
            revue.mutate();
          }}
        >
          Marquer revue
        </Button>
      ) : null}
    </>
  );
}
