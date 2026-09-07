'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ChevronRightIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DetailBackLink } from '@/components/detail-back-link';
import { FicheEnTete, type ChiffreDeFiche } from '@/components/fiche-en-tete';
import {
  CarteHistoire,
  Champ,
  Historique,
  type EvenementHistorique,
} from '@/components/historique/historique';
import { QueryErrorState } from '@/components/query-error-state';
import { RELATION_VARIANTS, RelationBadge } from '@/components/representants/relation-badge';
import {
  ComposeurFil,
  SupprimerCommentaireDialog,
} from '@/components/representants/representant-comments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/data/admin';
import { fetchProspects } from '@/lib/data/prospects';
import {
  fetchRepresentant,
  fetchRepresentantCallAttempts,
  fetchRepresentantComments,
  fetchRepresentantDeviceCalls,
  fetchRepresentantFicheHistory,
  fetchRepresentantRelationHistory,
  representantCommentsQueryKey,
  scriptOf,
  WHATSAPP_STATUS_LABELS,
  whatsappLabel,
  type DeviceCallDetection,
  type RepresentantCallAttempt,
  type RepresentantComment,
  type RepresentantFicheChange,
  type RepresentantRelationChange,
} from '@/lib/data/representants';
import { EMPTY_FILTERS } from '@/lib/filters';
import {
  formatDate,
  formatDateTime,
  formatDetectedCall,
  formatDeviceCall,
  formatNumber,
  formatPhone,
} from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { REPRESENTANT_RELATION_LABELS } from '@/lib/representant-filters';
import {
  PROSPECT_STATUT_LABELS,
  REP_CALL_OUTCOME_LABELS,
  REP_CALL_OUTCOME_VARIANTS,
  type Paginated,
  type ProspectRow,
  type RepresentantRow,
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

function pluriel(count: number): string {
  return count === 1 ? '' : 's';
}

function evenementCreation(representant: RepresentantRow): EvenementHistorique {
  return {
    id: `creation-${representant.id}`,
    categorie: 'fiche',
    at: representant.clientCreatedAt,
    titre: 'Fiche créée',
    resume: `${representant.departementName}${representant.iefName === null ? '' : ` · ${representant.iefName}`}`,
    acteur: representant.createdByName,
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Département">{representant.departementName}</Champ>
        <Champ label="IEF">{ouVide(representant.iefName)}</Champ>
        <Champ label="Saisi par">{representant.createdByName}</Champ>
        <Champ label="Le">{formatDateTime(representant.clientCreatedAt)}</Champ>
      </dl>
    ),
  };
}

function resumeAppel(appel: RepresentantCallAttempt): string {
  if (appel.comment !== null && appel.comment !== '') return appel.comment;
  if (appel.promisedProspects !== null) {
    return `${formatNumber(appel.promisedProspects)} prospect${pluriel(appel.promisedProspects)} promis`;
  }
  if (appel.callbackAt !== null) return `Rappel le ${formatDateTime(appel.callbackAt)}`;
  return '';
}

function evenementAppel(appel: RepresentantCallAttempt): EvenementHistorique {
  return {
    id: appel.id,
    categorie: 'appel',
    at: appel.clientCreatedAt,
    titre: appel.statutQualificationLabel ?? REP_CALL_OUTCOME_LABELS[appel.outcome],
    variant: REP_CALL_OUTCOME_VARIANTS[appel.outcome],
    resume: resumeAppel(appel),
    acteur: appel.performedByName,
    source: appel.deviceCallAt === null ? 'Non confirmé par le téléphone' : formatDeviceCall(appel),
    detail: (
      <>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Champ label="Issue">{REP_CALL_OUTCOME_LABELS[appel.outcome]}</Champ>
          <Champ label="Statut de qualification">
            {ouVide(appel.statutQualificationLabel, 'Aucun')}
          </Champ>
          <Champ label="Téléphone">{formatDeviceCall(appel).replace('Téléphone : ', '')}</Champ>
          <Champ label="Temps de traitement">
            {appel.dureeTraitementSecondes === null
              ? NO_VALUE
              : formatDuration(appel.dureeTraitementSecondes)}
          </Champ>
          <Champ label="Rappel promis">
            {appel.callbackAt === null ? 'Non' : formatDateTime(appel.callbackAt)}
          </Champ>
          <Champ label="Prospects promis">
            {appel.promisedProspects === null ? NO_VALUE : formatNumber(appel.promisedProspects)}
          </Champ>
        </dl>
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Réponses du script</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Champ label="Numéro confirmé">{ouiNon(appel.numeroConfirme)}</Champ>
            <Champ label="Établissement confirmé">{ouiNon(appel.etablissementConfirme)}</Champ>
            <Champ label="Déjà contacté">{ouiNon(appel.contacte)}</Champ>
            <Champ label="Connaît l’UES">{ouiNon(appel.connaitUES)}</Champ>
            <Champ label="Syndicat">{ouVide(appel.syndicat)}</Champ>
          </dl>
        </section>
        {appel.suggestedPhoneE164 === null ? null : (
          <section className="flex flex-col gap-2">
            <p className="eyebrow text-muted-foreground">Personne proposée</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Champ label="Nom">{ouVide(appel.suggestedName, 'Sans nom')}</Champ>
              <Champ label="Téléphone">{formatPhone(appel.suggestedPhoneE164)}</Champ>
              <Champ label="Note">{ouVide(appel.suggestedNote)}</Champ>
            </dl>
          </section>
        )}
        {appel.comment === null || appel.comment === '' ? null : (
          <section className="flex flex-col gap-1">
            <p className="eyebrow text-muted-foreground">
              {appel.statutQualificationRequiresComment ? 'Motif' : 'Commentaire'}
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

function evenementBascule(change: RepresentantRelationChange): EvenementHistorique {
  return {
    id: change.id,
    categorie: 'statut',
    at: change.changedAt,
    titre: `${REPRESENTANT_RELATION_LABELS[change.fromStatus]} → ${REPRESENTANT_RELATION_LABELS[change.toStatus]}`,
    variant: RELATION_VARIANTS[change.toStatus],
    resume: change.reason,
    acteur: change.changedByName,
    source: SOURCE_LABELS[change.source],
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Avant">{REPRESENTANT_RELATION_LABELS[change.fromStatus]}</Champ>
        <Champ label="Après">{REPRESENTANT_RELATION_LABELS[change.toStatus]}</Champ>
        <Champ label="Motif">{ouVide(change.reason, 'Aucun')}</Champ>
        <Champ label="Depuis">{SOURCE_LABELS[change.source]}</Champ>
      </dl>
    ),
  };
}

const CHAMP_LABELS: Record<string, string> = {
  fullName: 'Nom complet',
  prenom: 'Prénom',
  phoneE164: 'Téléphone',
  etablissement: 'Établissement',
  notes: 'Note de la fiche',
  departementId: 'Département',
  iefId: 'IEF',
  whatsappStatus: 'WhatsApp',
  whatsappE164: 'Numéro WhatsApp',
  profession: 'Profession',
  syndicat: 'Syndicat',
  connaitUES: 'Connaît l’UES',
  contacte: 'Déjà contacté',
};

const FICHE_SOURCE_LABELS: Record<RepresentantFicheChange['source'], string> = {
  WEB: 'Panneau',
  MOBILE: 'Mobile',
  APPEL: 'Appel de qualification',
  IMPORT: 'Import Excel',
};

function valeurDeChamp(champ: string, valeur: string | null): string {
  if (valeur === null || valeur === '') return 'Vide';
  if (valeur === 'true') return 'Oui';
  if (valeur === 'false') return 'Non';
  if (champ === 'whatsappStatus') {
    return WHATSAPP_STATUS_LABELS[valeur as keyof typeof WHATSAPP_STATUS_LABELS] ?? valeur;
  }
  if (champ === 'phoneE164' || champ === 'whatsappE164') return formatPhone(valeur);
  return valeur;
}

function evenementFormulaire(change: RepresentantFicheChange): EvenementHistorique {
  const premiereVersion = change.champs.every((c) => c.avant === null);
  return {
    id: change.id,
    categorie: 'fiche',
    at: change.changedAt,
    titre: premiereVersion ? 'Formulaire rempli' : 'Formulaire modifié',
    variant: 'secondary',
    resume: change.champs.map((c) => CHAMP_LABELS[c.champ] ?? c.champ).join(', '),
    acteur: change.changedByName,
    source: FICHE_SOURCE_LABELS[change.source],
    detail: (
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="text-left text-[0.75rem] text-muted-foreground">
            <th className="pb-2 font-[500]">Champ</th>
            <th className="pb-2 font-[500]">Avant</th>
            <th className="pb-2 font-[500]">Après</th>
          </tr>
        </thead>
        <tbody>
          {change.champs.map((c) => (
            <tr key={c.champ} className="border-t border-border align-top">
              <td className="py-2 pr-2 text-muted-foreground">
                {CHAMP_LABELS[c.champ] ?? c.champ}
              </td>
              <td className="py-2 pr-2 break-words line-through decoration-muted-foreground/60">
                {valeurDeChamp(c.champ, c.avant)}
              </td>
              <td className="py-2 font-[600] break-words">{valeurDeChamp(c.champ, c.apres)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
}

function evenementCommentaire(
  comment: RepresentantComment,
  onDelete: (() => void) | null,
): EvenementHistorique {
  return {
    id: comment.id,
    categorie: 'fil',
    at: comment.clientCreatedAt,
    titre: 'Commentaire',
    variant: 'secondary',
    resume: comment.body,
    acteur: comment.authorName,
    detail: <p className="whitespace-pre-wrap">{comment.body}</p>,
    action:
      onDelete === null ? undefined : (
        <Button type="button" size="sm" variant="outline" onClick={onDelete}>
          <Trash2Icon aria-hidden="true" />
          Supprimer
        </Button>
      ),
  };
}

function evenementProspect(prospect: ProspectRow): EvenementHistorique {
  return {
    id: `prospect-${prospect.id}`,
    categorie: 'prospect',
    at: prospect.clientCreatedAt,
    titre: 'Fiche prospect remise',
    variant: 'success',
    resume: `${prospect.prenom} ${prospect.nom} · ${formatPhone(prospect.phoneE164)}`,
    acteur: prospect.ownedByCommercialName,
    lien: { href: `/chues/prospects/${prospect.id}`, label: 'Ouvrir la fiche du prospect' },
    detail: (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Champ label="Prospect">
          {prospect.prenom} {prospect.nom}
        </Champ>
        <Champ label="Téléphone">{formatPhone(prospect.phoneE164)}</Champ>
        <Champ label="Statut">{PROSPECT_STATUT_LABELS[prospect.statut]}</Champ>
        <Champ label="Téléconseiller">{prospect.ownedByCommercialName}</Champ>
      </dl>
    ),
  };
}

function chiffresDe(representant: RepresentantRow): ChiffreDeFiche[] {
  return [
    {
      label: 'Prospects apportés',
      valeur: formatNumber(representant.prospectCount),
      precision: 'sur la dizaine attendue',
    },
    {
      label: 'Appels consignés',
      valeur: formatNumber(representant.callAttemptCount),
      precision:
        representant.lastCallAt === null
          ? 'Jamais appelé'
          : `Dernier le ${formatDateTime(representant.lastCallAt)}`,
    },
    {
      label: 'Prochain rappel',
      valeur:
        representant.nextCallbackAt === null ? 'Aucun' : formatDate(representant.nextCallbackAt),
      precision:
        representant.nextCallbackAt === null ? null : formatDateTime(representant.nextCallbackAt),
    },
  ];
}

/** Les sources encore en chargement comptent pour rien : la carte attend de toute façon. */
function evenementsDe(donnees: {
  representant: RepresentantRow;
  formulaire: readonly RepresentantFicheChange[] | undefined;
  appels: readonly RepresentantCallAttempt[] | undefined;
  releves: readonly DeviceCallDetection[] | undefined;
  bascules: readonly RepresentantRelationChange[] | undefined;
  fil: readonly RepresentantComment[] | undefined;
  prospects: readonly ProspectRow[] | undefined;
  onDeleteComment: ((comment: RepresentantComment) => void) | null;
}): EvenementHistorique[] {
  const { onDeleteComment } = donnees;
  return [
    evenementCreation(donnees.representant),
    ...(donnees.formulaire ?? []).map(evenementFormulaire),
    ...(donnees.appels ?? []).map(evenementAppel),
    ...(donnees.releves ?? []).filter((r) => r.attemptId === null).map(evenementReleve),
    ...(donnees.bascules ?? []).map(evenementBascule),
    ...(donnees.fil ?? []).map((comment) =>
      evenementCommentaire(
        comment,
        onDeleteComment === null ? null : () => onDeleteComment(comment),
      ),
    ),
    ...(donnees.prospects ?? []).map(evenementProspect),
  ];
}

export function RepresentantDetailView({
  representantId,
  author,
  canAdminister = false,
  readOnly = false,
}: {
  representantId: string;
  author: { id: string; fullName: string };
  canAdminister?: boolean;
  readOnly?: boolean;
}) {
  const [aSupprimer, setASupprimer] = useState<RepresentantComment | null>(null);

  const fiche = useQuery({
    queryKey: queryKeys.representant(representantId),
    queryFn: () => fetchRepresentant(representantId),
  });
  const history = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'relation-history'],
    queryFn: () => fetchRepresentantRelationHistory(representantId),
  });
  const appels = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'call-attempts'],
    queryFn: () => fetchRepresentantCallAttempts(representantId),
  });
  const releves = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'device-calls'],
    queryFn: () => fetchRepresentantDeviceCalls(representantId),
  });
  const fil = useQuery({
    queryKey: representantCommentsQueryKey(representantId),
    queryFn: () => fetchRepresentantComments(representantId),
  });
  const formulaire = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'fiche-history'],
    queryFn: () => fetchRepresentantFicheHistory(representantId),
  });
  const prospectFilters = { ...EMPTY_FILTERS, representantId };
  const prospects = useQuery({
    queryKey: queryKeys.prospects(prospectFilters),
    queryFn: () => fetchProspects(prospectFilters),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/representants">Tous les représentants</DetailBackLink>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/representants">Tous les représentants</DetailBackLink>
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

  const representant = fiche.data;
  const evenements = evenementsDe({
    representant,
    formulaire: formulaire.data,
    appels: appels.data,
    releves: releves.data,
    bascules: history.data,
    fil: fil.data,
    prospects: prospects.data?.items,
    onDeleteComment: canAdminister ? setASupprimer : null,
  });

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/chues/representants">Tous les représentants</DetailBackLink>

      <FicheEnTete
        nom={representant.fullName}
        complement={representant.prenom}
        phoneE164={representant.phoneE164}
        badges={
          <>
            <RelationBadge
              status={representant.relationStatus}
              label={representant.statutQualificationLabel}
              effect={representant.statutQualificationEffect}
              lastCallOutcome={representant.lastCallOutcome}
            />
            <Badge variant="outline">
              <span className="text-muted-foreground">Relation</span>
              <span>{REPRESENTANT_RELATION_LABELS[representant.relationStatus]}</span>
            </Badge>
          </>
        }
        chiffres={chiffresDe(representant)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <CarteHistoire
          titre="Histoire de la relation"
          description="Chaque appel, chaque version du formulaire, chaque bascule, chaque commentaire et chaque prospect remis, du plus récent au plus ancien. Cliquez une ligne pour tout voir."
          sources={[history, appels, releves, fil, formulaire, prospects]}
        >
          <Historique
            evenements={evenements}
            categories={['appel', 'statut', 'fil', 'prospect', 'fiche']}
            enTete={
              readOnly ? null : <ComposeurFil representantId={representantId} author={author} />
            }
            vide="Rien ne s’est encore passé sur cette fiche. Le premier appel consigné ouvre l’histoire."
            videParCategorie={{
              appel: 'Aucun appel consigné. Le premier se note depuis la console ou le téléphone.',
              statut:
                'Aucune bascule enregistrée. Le statut se pose en consignant un appel, ou en modifiant la fiche.',
              fil: 'Rien dans le fil. Le premier commentaire dit d’où part la relation.',
              prospect: 'Aucune fiche remise pour l’instant.',
              fiche: 'Aucune version du formulaire enregistrée depuis la mise en place du journal.',
            }}
          />
        </CarteHistoire>

        <div className="flex min-w-0 flex-col gap-6">
          <FicheRepresentant
            representant={representant}
            whatsapp={whatsappLabel(scriptOf(representant))}
          />
          <ProspectsApportes prospects={prospects} />
        </div>
      </div>

      <SupprimerCommentaireDialog
        representantId={representantId}
        comment={aSupprimer}
        onClose={() => {
          setASupprimer(null);
        }}
      />
    </div>
  );
}

function FicheRepresentant({
  representant,
  whatsapp,
}: {
  representant: RepresentantRow;
  whatsapp: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-[0.875rem]">
        <section className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">Où il travaille</p>
          <dl className="grid grid-cols-2 gap-3">
            <Champ label="Département">{representant.departementName}</Champ>
            <Champ label="IEF">{ouVide(representant.iefName)}</Champ>
            <Champ label="Établissement">{ouVide(representant.etablissement)}</Champ>
            <Champ label="Syndicat">{ouVide(representant.syndicat)}</Champ>
            <Champ label="Profession">{ouVide(representant.profession, 'Non demandée')}</Champ>
            <Champ label="WhatsApp">{whatsapp}</Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Ce qu’il a dit</p>
          <dl className="grid grid-cols-2 gap-3">
            <Champ label="Déjà contacté">{ouiNon(representant.contacte)}</Champ>
            <Champ label="Connaît l’UES">{ouiNon(representant.connaitUES)}</Champ>
          </dl>
        </section>
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="eyebrow text-muted-foreground">Saisie</p>
          <dl className="grid grid-cols-2 gap-3">
            <Champ label="Saisi par">{representant.createdByName}</Champ>
            <Champ label="Première saisie">{formatDate(representant.clientCreatedAt)}</Champ>
          </dl>
        </section>
        {representant.notes === null || representant.notes === '' ? null : (
          <section className="flex flex-col gap-1 border-t border-border pt-4">
            <p className="eyebrow text-muted-foreground">Note de la fiche</p>
            <p className="whitespace-pre-wrap">{representant.notes}</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function ProspectsApportes({ prospects }: { prospects: UseQueryResult<Paginated<ProspectRow>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prospects apportés</CardTitle>
      </CardHeader>
      <CardContent>
        {prospects.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {prospects.isError ? (
          <QueryErrorState
            error={prospects.error}
            onRetry={() => {
              void prospects.refetch();
            }}
            fallback="Les prospects de ce représentant n’ont pas pu être chargés."
          />
        ) : null}
        {prospects.isSuccess && prospects.data.items.length === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucune fiche remise pour l’instant. C’est la dizaine de prospects attendue de chaque
            représentant qui reste à recueillir.
          </p>
        ) : null}
        {prospects.isSuccess && prospects.data.items.length > 0 ? (
          <ul className="-mx-2 flex flex-col">
            {prospects.data.items.map((prospect) => (
              <li key={prospect.id}>
                <Link
                  href={`/chues/prospects/${prospect.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 grow">
                    <span className="block truncate text-[0.875rem] font-[600]">
                      {prospect.prenom} {prospect.nom}
                    </span>
                    <span className="block truncate text-[0.75rem] text-muted-foreground tabular-nums">
                      {formatPhone(prospect.phoneE164)}
                    </span>
                  </span>
                  <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
