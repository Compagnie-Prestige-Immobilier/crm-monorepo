import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { PastilleRelation } from '@/components/chues/badges';
import { EtatVide } from '@/components/chues/console-ui';
import { FiltreTeleconseiller } from '@/components/chues/filtre-teleconseiller';
import { ListeResponsive, type Colonne } from '@/components/chues/liste-responsive';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CALL_OUTCOME_LABELS,
  PHASE2_STATUS_LABELS,
  prospectsAppelesQuery,
  type CallOutcome,
  type Prospect,
} from '@/lib/data/console';
import { fetchPageProspects } from '@/lib/data/grand-public';
import {
  fetchRepresentantsAppeles,
  LIBELLES_ISSUE_APPEL,
  SUIVI_TAILLE_PAGE,
  type Representant,
} from '@/lib/data/representants';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet } from '@/lib/types';

const SANS_VALEUR = '–';

const quand = (at: string | null): string => (at === null ? SANS_VALEUR : formatDateTime(at));

function colonnesProspects(projet: Projet): Colonne<Prospect>[] {
  return [
    {
      cle: 'nom',
      entete: 'Nom',
      titre: true,
      cellule: (prospect) => (
        <Link
          to={projet === 'grand-public' ? '/$projet/$id' : '/$projet/prospects/$prospectId'}
          params={{ projet, id: prospect.id, prospectId: prospect.id }}
          className="font-[600] underline underline-offset-4"
        >
          {prospect.prenom} {prospect.nom}
        </Link>
      ),
    },
    {
      cle: 'telephone',
      entete: 'Téléphone',
      cellule: (prospect) => (
        <span className="tabular-nums">{formatPhone(prospect.phoneE164)}</span>
      ),
    },
    { cle: 'dernier', entete: 'Dernier appel', cellule: (prospect) => quand(prospect.lastCallAt) },
    {
      cle: 'issue',
      entete: 'Issue',
      cellule: (prospect) =>
        prospect.lastCallOutcome === null
          ? SANS_VALEUR
          : (CALL_OUTCOME_LABELS[prospect.lastCallOutcome as CallOutcome] ??
            prospect.lastCallOutcome),
    },
    {
      cle: 'statut',
      entete: 'Statut',
      cellule: (prospect) => PHASE2_STATUS_LABELS[prospect.phase2Status],
    },
  ];
}

function colonnesRepresentants(projet: Projet): Colonne<Representant>[] {
  return [
    {
      cle: 'nom',
      entete: 'Nom',
      titre: true,
      cellule: (representant) => (
        <Link
          to="/$projet/representants/$representantId"
          params={{ projet, representantId: representant.id }}
          className="font-[600] underline underline-offset-4"
        >
          {representant.fullName}
        </Link>
      ),
    },
    {
      cle: 'telephone',
      entete: 'Téléphone',
      cellule: (representant) => (
        <span className="tabular-nums">{formatPhone(representant.phoneE164)}</span>
      ),
    },
    {
      cle: 'dernier',
      entete: 'Dernier appel',
      cellule: (representant) => quand(representant.lastCallAt),
    },
    {
      cle: 'issue',
      entete: 'Issue',
      cellule: (representant) =>
        representant.lastCallOutcome === null ? (
          SANS_VALEUR
        ) : (
          <Badge variant="outline">{LIBELLES_ISSUE_APPEL[representant.lastCallOutcome]}</Badge>
        ),
    },
    {
      cle: 'statut',
      entete: 'Statut',
      cellule: (representant) => (
        <PastilleRelation
          status={representant.relationStatus}
          label={representant.statutQualificationLabel}
          effect={representant.statutQualificationEffect}
          lastCallOutcome={representant.lastCallOutcome}
        />
      ),
    },
  ];
}

export function MesContactsView({
  projet,
  userId,
  peutFiltrer,
}: {
  projet: Projet;
  userId: string;
  peutFiltrer: boolean;
}) {
  const [onglet, setOnglet] = useState<'PROSPECTS' | 'REPRESENTANTS'>('PROSPECTS');
  const [filtreId, setFiltreId] = useState<string | null>(null);

  // L'API ne borne ces listes ni au demandeur ni aux fiches appelées : sans
  // identifiant, elle rendrait aussi les fiches que personne n'a jamais appelées.
  const appeleParId = peutFiltrer ? (filtreId ?? userId) : userId;
  const avecRepresentants = projet === 'chues';
  const vueRepresentants = avecRepresentants && onglet === 'REPRESENTANTS';

  const prospects = useQuery({
    queryKey: queryKeys.mesContacts('prospects', projet, appeleParId),
    queryFn: () => fetchPageProspects(prospectsAppelesQuery(appeleParId, PROJET_API[projet])),
    enabled: !vueRepresentants,
    placeholderData: (precedent) => precedent,
  });

  const representants = useQuery({
    queryKey: queryKeys.mesContacts('representants', projet, appeleParId),
    queryFn: () => fetchRepresentantsAppeles(appeleParId),
    enabled: vueRepresentants,
    placeholderData: (precedent) => precedent,
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.875rem] text-muted-foreground">
          Les personnes appelées, de l’appel le plus récent au plus ancien.
        </p>

        <FiltreTeleconseiller
          id="contacts-appele-par"
          label="Appelé par"
          placeholder="Mes appels"
          actif={peutFiltrer}
          value={filtreId}
          onChange={setFiltreId}
        />
      </div>

      {avecRepresentants ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type de contact">
          {(['PROSPECTS', 'REPRESENTANTS'] as const).map((valeur) => (
            <Button
              key={valeur}
              type="button"
              variant={valeur === onglet ? 'default' : 'outline'}
              aria-pressed={valeur === onglet}
              onClick={() => {
                setOnglet(valeur);
              }}
            >
              {valeur === 'PROSPECTS' ? 'Prospects' : 'Représentants'}
            </Button>
          ))}
        </div>
      ) : null}

      {vueRepresentants ? (
        <Corps
          liste={representants}
          echec="Les représentants appelés n’ont pas pu être lus."
          vide="Un représentant apparaît ici dès que vous consignez un appel sur sa fiche."
          colonnes={colonnesRepresentants(projet)}
          cle={(representant) => representant.id}
          libelle="Représentants appelés"
        />
      ) : (
        <Corps
          liste={prospects}
          echec="Les prospects appelés n’ont pas pu être lus."
          vide="Un prospect apparaît ici dès que vous consignez un appel sur sa fiche."
          colonnes={colonnesProspects(projet)}
          cle={(prospect) => prospect.id}
          libelle="Prospects appelés"
        />
      )}
    </section>
  );
}

function Corps<T>({
  liste,
  echec,
  vide,
  colonnes,
  cle,
  libelle,
}: {
  liste: UseQueryResult<{ items: T[]; total: number }>;
  echec: string;
  vide: string;
  colonnes: readonly Colonne<T>[];
  cle: (item: T) => string;
  libelle: string;
}) {
  if (liste.isError && liste.data === undefined) {
    return (
      <QueryErrorState
        error={liste.error}
        fallback={echec}
        onRetry={() => {
          void liste.refetch();
        }}
      />
    );
  }

  if (liste.data === undefined) return <Skeleton className="h-64" />;
  if (liste.data.items.length === 0) {
    return <EtatVide titre="Aucun appel enregistré" description={vide} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {liste.data.total > liste.data.items.length ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {formatNumber(liste.data.total)} au total, les {formatNumber(SUIVI_TAILLE_PAGE)} plus
          récents sont affichés.
        </p>
      ) : null}
      <ListeResponsive items={liste.data.items} colonnes={colonnes} cle={cle} libelle={libelle} />
    </div>
  );
}
