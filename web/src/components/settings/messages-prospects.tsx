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
  fetchParametresChues,
  updateParametresChues,
  type ParametresChues,
} from '@/lib/data/parametres-chues';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

type CleTexte = 'accuseReceptionObjet' | 'accuseReceptionCorps' | 'adhesionObjet' | 'adhesionCorps';
type CleListe = 'destinatairesAdhesion' | 'destinatairesSupervision';
type Cle = CleTexte | CleListe;

interface Champ {
  cle: Cle;
  label: string;
  lignes: number;
  /** Les mots que le serveur remplace à l'envoi, quand le texte d'origine est connu. */
  variables?: readonly string[];
}

interface Message {
  titre: string;
  quand: string;
  /** La liste dont le vide empêche l'envoi. */
  sansDestinataire?: CleListe;
  champs: Champ[];
}

const VARIABLES_ACCUSE = [
  'prenomNom',
  'date',
  'informations',
  'telephone',
  'emailChues',
  'whatsappChues',
];

const MESSAGES: Message[] = [
  {
    titre: 'Accusé de réception',
    quand: 'Part au prospect qui dépose une demande par le formulaire public, à l’adresse saisie.',
    champs: [
      {
        cle: 'accuseReceptionObjet',
        label: 'Objet',
        lignes: 1,
        variables: ['prenomNom', 'date'],
      },
      { cle: 'accuseReceptionCorps', label: 'Texte', lignes: 6, variables: VARIABLES_ACCUSE },
    ],
  },
  {
    titre: 'Avis d’adhésion',
    quand: 'Part quand une fiche Grand Public est convertie.',
    sansDestinataire: 'destinatairesAdhesion',
    champs: [
      { cle: 'destinatairesAdhesion', label: 'Destinataires', lignes: 3 },
      { cle: 'adhesionObjet', label: 'Objet', lignes: 1 },
      { cle: 'adhesionCorps', label: 'Texte', lignes: 6 },
    ],
  },
  {
    titre: 'Demande déposée par le formulaire public',
    quand: 'Part aux superviseurs actifs, et en copie aux adresses ci-dessous.',
    champs: [{ cle: 'destinatairesSupervision', label: 'Adresses en copie', lignes: 3 }],
  },
];

export const enLignes = (adresses: readonly string[]): string => adresses.join('\n');
export const enListe = (saisie: string): string[] =>
  saisie
    .split(/[\n,;]+/u)
    .map((adresse) => adresse.trim())
    .filter((adresse) => adresse !== '');

export function AucunDestinataire({ enEchec = false }: { enEchec?: boolean }) {
  return (
    <p role="status" className="text-[0.8125rem] font-[500] text-warning">
      {enEchec
        ? 'Aucun destinataire : ce courriel ne part pas et apparaît en échec.'
        : 'Aucun destinataire : ce courriel ne part pas.'}
    </p>
  );
}

export function BoutonEnregistrer({
  modifie,
  enCours,
  onClick,
}: {
  modifie: boolean;
  enCours: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button type="button" disabled={!modifie || enCours} onClick={onClick}>
        {enCours ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}

const estListe = (cle: Cle): cle is CleListe => cle.startsWith('destinataires');

function valeurLue(lus: ParametresChues, cle: Cle): string {
  return estListe(cle) ? enLignes(lus[cle]) : lus[cle];
}

export function MessagesProspects() {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });

  if (parametres.isPending) return <Skeleton className="h-64 rounded-lg" />;
  if (parametres.isError) {
    return (
      <QueryErrorState
        error={parametres.error}
        onRetry={() => {
          void parametres.refetch();
        }}
        fallback="Les messages aux prospects n’ont pas pu être lus."
      />
    );
  }
  const lus = parametres.data;
  return MESSAGES.map((message) => (
    <CarteMessage
      key={`${message.titre}-${message.champs.map((champ) => valeurLue(lus, champ.cle)).join('|')}`}
      message={message}
      lus={lus}
    />
  ));
}

function CarteMessage({ message, lus }: { message: Message; lus: ParametresChues }) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<Partial<Record<Cle, string>>>({});
  const valeur = (cle: Cle): string => brouillon[cle] ?? valeurLue(lus, cle);
  const modifie = Object.keys(brouillon).length > 0;

  const enregistrement = useMutation({
    mutationFn: () =>
      updateParametresChues(
        Object.fromEntries(
          Object.entries(brouillon).map(([cle, texte]) => [
            cle,
            estListe(cle as Cle) ? enListe(texte) : texte,
          ]),
        ),
      ),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.parametresChues, suivants);
      void queryClient.invalidateQueries({ queryKey: queryKeys.parametresChuesJournal });
      toast.success(`${message.titre} enregistré.`);
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le message n’a pas pu être enregistré.'));
    },
  });

  const saisir = (cle: Cle, texte: string) => {
    setBrouillon((courant) => ({ ...courant, [cle]: texte }));
  };
  const vide =
    message.sansDestinataire !== undefined &&
    enListe(valeur(message.sansDestinataire)).length === 0;

  return (
    <Card role="region" aria-label={message.titre}>
      <CardHeader>
        <CardTitle>{message.titre}</CardTitle>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">{message.quand}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {message.champs.map((champ) =>
          champ.variables === undefined ? (
            <Field key={champ.cle} label={champ.label}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={champ.lignes}
                  value={valeur(champ.cle)}
                  onChange={(event) => {
                    saisir(champ.cle, event.target.value);
                  }}
                />
              )}
            </Field>
          ) : (
            <ChampTexteVariables
              key={champ.cle}
              label={champ.label}
              valeur={valeur(champ.cle)}
              usine={lus.textesUsine[champ.cle as keyof ParametresChues['textesUsine']]}
              variables={champ.variables}
              lignes={champ.lignes}
              onChange={(texte) => {
                saisir(champ.cle, texte);
              }}
            />
          ),
        )}
        {vide ? <AucunDestinataire /> : null}
        <BoutonEnregistrer
          modifie={modifie}
          enCours={enregistrement.isPending}
          onClick={() => {
            enregistrement.mutate();
          }}
        />
      </CardContent>
    </Card>
  );
}
