'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChampTexteVariables } from '@/components/forms/champ-texte-variables';
import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
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

const COURRIELS: { cle: TypeReglageCourriel; titre: string; quand: string }[] = [
  {
    cle: 'enrolement',
    titre: 'Rendez-vous d’enrôlement',
    quand:
      'Part quand un téléconseiller obtient la méthode d’enrôlement d’un prospect, rendez-vous ou à distance.',
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

type Brouillon = Record<
  TypeReglageCourriel,
  { destinataires: string; copies: string; intro: string }
>;

const enLignes = (adresses: readonly string[]): string => adresses.join('\n');
const enListe = (saisie: string): string[] =>
  saisie
    .split(/[\n,;]+/u)
    .map((adresse) => adresse.trim())
    .filter((adresse) => adresse !== '');

const CLES: TypeReglageCourriel[] = ['enrolement', 'encaissement', 'refus', 'importLeads'];

/** Un texte jamais réglé montre celui d'origine : c'est lui qui part. */
function brouillonDe(lus: ReglagesCourrielsLus): Brouillon {
  const de = (cle: TypeReglageCourriel) => ({
    destinataires: enLignes(lus[cle].destinataires),
    copies: enLignes(lus[cle].copies),
    intro: lus[cle].intro === '' ? lus.aide[cle].introUsine : lus[cle].intro,
  });
  return Object.fromEntries(CLES.map((cle) => [cle, de(cle)])) as Brouillon;
}

function corpsDe(brouillon: Brouillon): ReglagesCourriels {
  const de = (cle: TypeReglageCourriel) => ({
    destinataires: enListe(brouillon[cle].destinataires),
    copies: enListe(brouillon[cle].copies),
    intro: brouillon[cle].intro.trim(),
  });
  return Object.fromEntries(CLES.map((cle) => [cle, de(cle)])) as ReglagesCourriels;
}

/** Un courriel automatique par carte : à qui, en copie, et son texte. */
export function CourrielsReglages() {
  const reglages = useQuery({
    queryKey: queryKeys.courrielsReglages,
    queryFn: () => fetchReglagesCourriels(),
  });

  if (reglages.isPending) return <Skeleton className="h-96 rounded-lg" />;
  if (reglages.isError) {
    return (
      <QueryErrorState
        error={reglages.error}
        onRetry={() => {
          void reglages.refetch();
        }}
        fallback="Les réglages des courriels n’ont pas pu être lus."
      />
    );
  }
  return <Formulaire key={JSON.stringify(reglages.data)} lus={reglages.data} />;
}

function Formulaire({ lus }: { lus: ReglagesCourrielsLus }) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(lus));
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(brouillonDe(lus));

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

  const saisir = (
    cle: TypeReglageCourriel,
    champ: keyof Brouillon[TypeReglageCourriel],
    texte: string,
  ) => {
    setBrouillon((courant) => ({ ...courant, [cle]: { ...courant[cle], [champ]: texte } }));
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.875rem] text-muted-foreground">
        Quatre courriels partent d’eux-mêmes. Une adresse par ligne. Le texte d’introduction se
        règle ici, les mots entre accolades sont remplacés à l’envoi. Les envois se lisent dans
        Exploitation.
      </p>

      {COURRIELS.map((courriel) => (
        <Card key={courriel.cle} role="region" aria-label={courriel.titre}>
          <CardHeader>
            <CardTitle>{courriel.titre}</CardTitle>
            <p className="mt-1 text-[0.875rem] text-muted-foreground">{courriel.quand}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Destinataires"
                info="Les adresses qui reçoivent ce courriel, une par ligne. Sans adresse, l’envoi est tracé en échec dans le journal."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={brouillon[courriel.cle].destinataires}
                    placeholder="prenom.nom@cpi.sn"
                    onChange={(event) => {
                      saisir(courriel.cle, 'destinataires', event.target.value);
                    }}
                  />
                )}
              </Field>
              <Field
                label="En copie"
                info="Les adresses mises en copie du même envoi, pour information."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={brouillon[courriel.cle].copies}
                    onChange={(event) => {
                      saisir(courriel.cle, 'copies', event.target.value);
                    }}
                  />
                )}
              </Field>
            </div>
            <ChampTexteVariables
              label="Texte d’introduction"
              info="La phrase qui ouvre le courriel, avant le tableau des informations et la fiche PDF. Les mots entre accolades sont remplacés à l’envoi ; vide, le texte d’origine part."
              valeur={brouillon[courriel.cle].intro}
              usine={lus.aide[courriel.cle].introUsine}
              variables={lus.aide[courriel.cle].variables}
              onChange={(texte) => {
                saisir(courriel.cle, 'intro', texte);
              }}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!modifie || enregistrement.isPending}
          onClick={() => {
            enregistrement.mutate(corpsDe(brouillon));
          }}
        >
          {enregistrement.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
