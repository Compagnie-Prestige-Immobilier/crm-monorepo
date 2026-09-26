'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChampTexteVariables } from '@/components/forms/champ-texte-variables';
import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import {
  AucunDestinataire,
  BoutonEnregistrer,
  MessagesProspects,
  enLignes,
  enListe,
} from '@/components/settings/messages-prospects';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchReglagesCourriels,
  saveReglagesCourriels,
  type ReglagesCourrielsLus,
  type TypeReglageCourriel,
} from '@/lib/data/courriels';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ReglagesCourriels } from '@/lib/types';

const COURRIELS: { cle: TypeReglageCourriel; titre: string; quand: string; aide?: string }[] = [
  {
    cle: 'enrolement',
    titre: 'Rendez-vous d’enrôlement',
    quand:
      'Part quand un téléconseiller obtient la méthode d’enrôlement d’un prospect, rendez-vous ou à distance. Une fois par fiche, sauf changement de méthode.',
    aide: 'Liste vide : ce courriel ne part pas.',
  },
  {
    cle: 'encaissement',
    titre: 'Dossier encaissé',
    quand: 'Part quand la banque encaisse un dossier.',
  },
  {
    cle: 'refus',
    titre: 'Dossier refusé',
    quand: 'Part quand la banque rejette un dossier.',
  },
  {
    cle: 'importLeads',
    titre: 'Relevé des leads',
    quand:
      'Part après chaque relevé automatique du classeur des leads, appliqué ou refusé, avec les comptes.',
  },
];

const CLES: TypeReglageCourriel[] = ['enrolement', 'encaissement', 'refus', 'importLeads'];

type Brouillon = { destinataires: string; copies: string; intro: string };

/** Un texte jamais réglé montre celui d'origine : c'est lui qui part. */
function brouillonDe(lus: ReglagesCourrielsLus, cle: TypeReglageCourriel): Brouillon {
  return {
    destinataires: enLignes(lus[cle].destinataires),
    copies: enLignes(lus[cle].copies),
    intro: lus[cle].intro === '' ? lus.aide[cle].introUsine : lus[cle].intro,
  };
}

/** L'API remplace les quatre réglages d'un bloc : les cartes non touchées repartent telles quelles. */
function corpsAvec(
  lus: ReglagesCourrielsLus,
  cle: TypeReglageCourriel,
  brouillon: Brouillon,
): ReglagesCourriels {
  const corps = Object.fromEntries(
    CLES.map((autre) => [
      autre,
      {
        destinataires: lus[autre].destinataires,
        copies: lus[autre].copies,
        intro: lus[autre].intro,
      },
    ]),
  ) as ReglagesCourriels;
  corps[cle] = {
    destinataires: enListe(brouillon.destinataires),
    copies: enListe(brouillon.copies),
    intro: brouillon.intro.trim(),
  };
  return corps;
}

/** Les courriels automatiques et les messages aux prospects, sur un seul écran. */
export function CourrielsReglages() {
  const reglages = useQuery({
    queryKey: queryKeys.courrielsReglages,
    queryFn: () => fetchReglagesCourriels(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.875rem] text-muted-foreground">
          Une adresse par ligne. Les mots entre accolades sont remplacés à l’envoi.
        </p>
        <Link
          href="/admin/exploitation?onglet=courriels"
          className={buttonVariants({ variant: 'outline' })}
        >
          Voir les envois
        </Link>
      </div>

      {reglages.isPending ? <Skeleton className="h-96 rounded-lg" /> : null}
      {reglages.isError ? (
        <QueryErrorState
          error={reglages.error}
          onRetry={() => {
            void reglages.refetch();
          }}
          fallback="Les réglages des courriels n’ont pas pu être lus."
        />
      ) : null}
      {reglages.isSuccess
        ? COURRIELS.map((courriel) => (
            <CarteCourriel
              key={`${courriel.cle}-${JSON.stringify(reglages.data[courriel.cle])}`}
              courriel={courriel}
              lus={reglages.data}
            />
          ))
        : null}

      <MessagesProspects />
    </div>
  );
}

function CarteCourriel({
  courriel,
  lus,
}: {
  courriel: (typeof COURRIELS)[number];
  lus: ReglagesCourrielsLus;
}) {
  const queryClient = useQueryClient();
  const { cle } = courriel;
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(lus, cle));
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(brouillonDe(lus, cle));

  const enregistrement = useMutation({
    mutationFn: (corps: ReglagesCourriels) => saveReglagesCourriels(corps),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.courrielsReglages, suivants);
      toast.success('Réglages des courriels enregistrés.');
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Les réglages n’ont pas pu être enregistrés.'));
    },
  });

  const saisir = (champ: keyof Brouillon, texte: string) => {
    setBrouillon((courant) => ({ ...courant, [champ]: texte }));
  };

  return (
    <Card role="region" aria-label={courriel.titre}>
      <CardHeader>
        <CardTitle>{courriel.titre}</CardTitle>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">{courriel.quand}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Destinataires" description={courriel.aide}>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={brouillon.destinataires}
                placeholder="prenom.nom@cpi.sn"
                onChange={(event) => {
                  saisir('destinataires', event.target.value);
                }}
              />
            )}
          </Field>
          <Field label="En copie">
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={brouillon.copies}
                onChange={(event) => {
                  saisir('copies', event.target.value);
                }}
              />
            )}
          </Field>
        </div>
        {enListe(brouillon.destinataires).length === 0 ? (
          <AucunDestinataire enEchec={cle !== 'enrolement'} />
        ) : null}
        <ChampTexteVariables
          label="Texte d’introduction"
          info="La phrase qui ouvre le courriel, avant le tableau des informations. Vide, le texte d’origine part."
          valeur={brouillon.intro}
          usine={lus.aide[cle].introUsine}
          variables={lus.aide[cle].variables}
          onChange={(texte) => {
            saisir('intro', texte);
          }}
        />
        <BoutonEnregistrer
          modifie={modifie}
          enCours={enregistrement.isPending}
          onClick={() => {
            enregistrement.mutate(corpsAvec(lus, cle, brouillon));
          }}
        />
      </CardContent>
    </Card>
  );
}
