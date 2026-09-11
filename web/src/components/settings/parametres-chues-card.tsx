'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchJournalParametres,
  fetchParametresChues,
  updateParametresChues,
  type ParametresChues,
} from '@/lib/data/parametres-chues';
import { formatDateTime } from '@/lib/format';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const LIBELLES: Record<string, string> = {
  plateformeChuesUrl: 'Lien de la plateforme CPI CHUES',
  plateformeGrandPublicUrl: 'Lien de la plateforme Grand Public',
  emailChues: 'Adresse e-mail CHUES',
  whatsappChuesE164: 'Numéro WhatsApp CHUES',
  messageWhatsapp: 'Message WhatsApp',
  accuseReceptionObjet: 'Accusé de réception, objet',
  accuseReceptionCorps: 'Accusé de réception, corps',
  adhesionObjet: 'Avis d’adhésion, objet',
  adhesionCorps: 'Avis d’adhésion, corps',
  destinatairesAdhesion: 'Avis d’adhésion, destinataires',
  destinatairesEnrolement: 'Cellule enrôlement',
  destinatairesBpe: 'Cellule BPE',
  destinatairesSupervision: 'Superviseurs',
  destinatairesDirection: 'Direction',
};

const LISTES = [
  'destinatairesEnrolement',
  'destinatairesBpe',
  'destinatairesSupervision',
  'destinatairesDirection',
  'destinatairesAdhesion',
] as const;

/** Une adresse par ligne : c'est ainsi qu'on les copie depuis un annuaire. */
const enLignes = (adresses: readonly string[]): string => adresses.join('\n');
const enListe = (saisie: string): string[] =>
  saisie
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

export function ParametresChuesCard({ peutToutRegler }: { peutToutRegler: boolean }) {
  const queryClient = useQueryClient();
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });
  const [brouillon, setBrouillon] = useState<Partial<Record<string, string>>>({});

  const enregistrement = useMutation({
    mutationFn: (corps: Record<string, unknown>) => updateParametresChues(corps),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.parametresChues, suivants);
      void queryClient.invalidateQueries({ queryKey: queryKeys.parametresChuesJournal });
      setBrouillon({});
      toast.success('Paramètres enregistrés.');
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Les paramètres n’ont pas pu être enregistrés.'));
    },
  });

  if (parametres.isPending) return <Skeleton className="h-96 rounded-lg" />;
  if (parametres.isError)
    return (
      <QueryErrorState
        error={parametres.error}
        onRetry={() => {
          void parametres.refetch();
        }}
        fallback="Les paramètres CHUES n’ont pas pu être lus."
      />
    );

  const lus = parametres.data;
  const valeur = (cle: CleTexte): string => {
    const saisi = brouillon[cle];
    if (saisi !== undefined) return saisi;
    const stockee = lus[cle];
    return Array.isArray(stockee) ? enLignes(stockee) : stockee;
  };
  const saisir = (cle: string, texte: string) => {
    setBrouillon((courant) => ({ ...courant, [cle]: texte }));
  };
  const modifie = Object.keys(brouillon).length > 0;

  const envoyer = () => {
    const corps: Record<string, unknown> = {};
    for (const [cle, texte] of Object.entries(brouillon)) {
      if (texte === undefined) continue;
      corps[cle] = (LISTES as readonly string[]).includes(cle) ? enListe(texte) : texte;
    }
    enregistrement.mutate(corps);
  };

  return (
    <div className="flex flex-col gap-6">
      {peutToutRegler ? <CartePlateformes valeur={valeur} saisir={saisir} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Messages envoyés aux prospects</CardTitle>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">
            Les mots entre accolades sont remplacés à l’envoi : {'{prenom}'}, {'{lien}'}, {'{date}'}
            , {'{informations}'}. L’avis d’adhésion connaît en plus {'{prenomNom}'}, {'{telephone}'}
            , {'{offre}'}, {'{paiement}'}, {'{montant}'} et {'{teleconseiller}'}.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(['accuseReceptionObjet', 'adhesionObjet'] as const).map((cle) => (
            <Field key={cle} label={LIBELLES[cle] ?? cle}>
              {(props) => (
                <Input
                  {...props}
                  value={valeur(cle)}
                  onChange={(event) => {
                    saisir(cle, event.target.value);
                  }}
                />
              )}
            </Field>
          ))}
          {(['messageWhatsapp', 'accuseReceptionCorps', 'adhesionCorps'] as const).map((cle) => (
            <Field key={cle} label={LIBELLES[cle] ?? cle}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={cle === 'messageWhatsapp' ? 4 : 6}
                  value={valeur(cle)}
                  onChange={(event) => {
                    saisir(cle, event.target.value);
                  }}
                />
              )}
            </Field>
          ))}
        </CardContent>
      </Card>

      {peutToutRegler ? <CarteDestinataires valeur={valeur} saisir={saisir} /> : null}

      <div className="flex items-center justify-end gap-3">
        {enregistrement.isError ? (
          <p role="alert" className="text-[0.875rem] text-destructive">
            {apiErrorText(enregistrement.error, 'Les paramètres n’ont pas pu être enregistrés.')}
          </p>
        ) : null}
        <Button type="button" disabled={!modifie || enregistrement.isPending} onClick={envoyer}>
          {enregistrement.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Enregistrer
        </Button>
      </div>

      <JournalDesParametres />
    </div>
  );
}

type CleTexte = Exclude<keyof ParametresChues, 'verrouFiches'>;

type ChampsProps = {
  valeur: (cle: CleTexte) => string;
  saisir: (cle: string, texte: string) => void;
};

function CartePlateformes({ valeur, saisir }: ChampsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plateformes et contacts</CardTitle>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Ces valeurs s’affichent en lecture seule dans le formulaire de conversion et dans les
          messages envoyés.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {(
          [
            'plateformeChuesUrl',
            'plateformeGrandPublicUrl',
            'emailChues',
            'whatsappChuesE164',
          ] as const
        ).map((cle) => (
          <Field key={cle} label={LIBELLES[cle] ?? cle}>
            {(props) => (
              <Input
                {...props}
                value={valeur(cle)}
                placeholder={cle.endsWith('Url') ? 'https://…' : undefined}
                onChange={(event) => {
                  saisir(cle, event.target.value);
                }}
              />
            )}
          </Field>
        ))}
      </CardContent>
    </Card>
  );
}

function CarteDestinataires({ valeur, saisir }: ChampsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Destinataires en copie</CardTitle>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Une adresse par ligne. Ces comptes reçoivent une copie des demandes déposées.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {LISTES.map((cle) => (
          <Field key={cle} label={LIBELLES[cle] ?? cle}>
            {(props) => (
              <Textarea
                {...props}
                rows={4}
                value={valeur(cle)}
                onChange={(event) => {
                  saisir(cle, event.target.value);
                }}
              />
            )}
          </Field>
        ))}
      </CardContent>
    </Card>
  );
}

/** EB-29 : qui a changé quoi, et ce que la valeur disait avant. */
function JournalDesParametres() {
  const journal = useQuery({
    queryKey: queryKeys.parametresChuesJournal,
    queryFn: () => fetchJournalParametres(),
  });

  if (!journal.isSuccess || journal.data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modifications</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {journal.data.map((ligne) => (
            <li key={ligne.id} className="py-3 text-[0.875rem]">
              <span className="font-[600]">{LIBELLES[ligne.cle] ?? ligne.cle}</span>
              <span className="block text-[0.8125rem] text-muted-foreground">
                {formatDateTime(ligne.le)}, par {ligne.parNom}
              </span>
              <span className="mt-1 block break-words text-[0.8125rem]">
                {ligne.ancienne === null ? (
                  <span className="text-muted-foreground">Première valeur : </span>
                ) : (
                  <span className="text-muted-foreground line-through">{ligne.ancienne} → </span>
                )}
                {ligne.nouvelle}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
