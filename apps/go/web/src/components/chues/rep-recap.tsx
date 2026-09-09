import { useQuery } from '@tanstack/react-query';
import { CopyIcon } from 'lucide-react';

import { PastilleRelation } from '@/components/chues/badges';
import { copyPhone } from '@/components/chues/console-ui';
import { EcouteNoteVocale } from '@/components/chues/note-vocale';
import {
  recapEtablissement,
  recapOuiNon,
  RESULTATS,
  type Resultat,
} from '@/components/chues/rep-reponse';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCallbackAt } from '@/lib/data/callbacks';
import {
  fetchAppelsRepresentant,
  LIBELLES_ISSUE_APPEL,
  type Representant,
} from '@/lib/data/representants';
import { formatDateTime, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

function Recap({ intitule, valeur }: { intitule: string; valeur: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{intitule}</dt>
      <dd className={cn('text-right', valeur === null && 'text-muted-foreground italic')}>
        {valeur ?? 'Non renseigné'}
      </dd>
    </div>
  );
}

export interface RecapAppelProps {
  representant: Representant;
  resultat: Resultat | null;
  statutLabel: string | null;
  joignable: boolean;
  etablissementConfirme: boolean | null;
  nouvelEtablissement: string;
  contacte: boolean | null;
  connaitUES: boolean | null;
  syndicatName: string;
  ambassadeur: boolean | null;
  rappelAt: string | null;
  now: number;
  personneProposee: string | null;
  commentaire: string;
}

export function RecapAppel(props: RecapAppelProps) {
  return (
    <dl className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 text-[0.875rem]">
      <Recap intitule="Personne appelée" valeur={props.representant.fullName} />
      <Recap intitule="Téléphone" valeur={formatPhone(props.representant.phoneE164)} />
      <Recap
        intitule="Résultat"
        valeur={RESULTATS.find((item) => item.valeur === props.resultat)?.label ?? null}
      />
      <Recap intitule="Statut" valeur={props.statutLabel} />
      {props.joignable ? (
        <>
          <Recap
            intitule="Établissement"
            valeur={recapEtablissement(props.etablissementConfirme, props.nouvelEtablissement)}
          />
          <Recap intitule="Déjà contacté" valeur={recapOuiNon(props.contacte)} />
          <Recap intitule="Connaît l’UES" valeur={recapOuiNon(props.connaitUES)} />
          {props.syndicatName === '' ? null : (
            <Recap intitule="Syndicat" valeur={props.syndicatName} />
          )}
          <Recap
            intitule="Souhaite être représentant CHUES"
            valeur={recapOuiNon(props.ambassadeur)}
          />
        </>
      ) : null}
      {props.rappelAt === null ? null : (
        <Recap intitule="Rappel" valeur={formatCallbackAt(props.rappelAt, props.now)} />
      )}
      {props.personneProposee === null ? null : (
        <Recap intitule="Personne proposée" valeur={props.personneProposee} />
      )}
      {props.commentaire === '' ? null : (
        <Recap intitule="Commentaire" valeur={props.commentaire} />
      )}
    </dl>
  );
}

export function EnTeteRepresentant({ representant }: { representant: Representant }) {
  const sousTitre = [representant.prenom, representant.etablissement].filter(Boolean).join(' · ');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            {representant.fullName}
          </h2>
          {sousTitre === '' ? null : (
            <p className="text-[0.8125rem] text-muted-foreground">{sousTitre}</p>
          )}
        </div>
        <PastilleRelation
          status={representant.relationStatus}
          label={representant.statutQualificationLabel}
          effect={representant.statutQualificationEffect}
          lastCallOutcome={representant.lastCallOutcome}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
          {formatPhone(representant.phoneE164)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            copyPhone(representant.phoneE164);
          }}
        >
          <CopyIcon aria-hidden="true" />
          Copier
        </Button>
      </div>
    </>
  );
}

/**
 * Ce que les appels précédents ont donné, en lecture seule : une nouvelle
 * qualification ajoute une entrée, elle n'en réécrit aucune.
 */
export function HistoriqueAppels({ representantId }: { representantId: string }) {
  const appels = useQuery({
    queryKey: queryKeys.appelsRepresentant(representantId),
    queryFn: () => fetchAppelsRepresentant(representantId),
  });

  if (appels.isPending) return <Skeleton className="h-20 w-full" />;
  if (appels.isError || appels.data.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <h3 className="text-[0.875rem] font-[600]">Appels précédents</h3>
      <ol className="flex max-h-64 flex-col gap-3 overflow-y-auto scrollbar-thin">
        {appels.data.map((appel) => (
          <li key={appel.id} className="flex flex-col gap-1 text-[0.8125rem]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {appel.statutQualificationLabel ?? LIBELLES_ISSUE_APPEL[appel.outcome]}
              </Badge>
              <time dateTime={appel.clientCreatedAt} className="text-muted-foreground">
                {formatDateTime(appel.clientCreatedAt)}
              </time>
              <span className="text-muted-foreground">par {appel.performedByName}</span>
            </div>
            {appel.comment === null || appel.comment === '' ? null : (
              <p className="max-w-prose">{appel.comment}</p>
            )}
            {appel.hasNoteVocale ? <EcouteNoteVocale attemptId={appel.id} /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
