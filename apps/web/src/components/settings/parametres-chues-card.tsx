'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchParametresChues,
  updateParametresChues,
  type ParametresChues,
  type UpdateParametresChues,
} from '@/lib/data/parametres';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

interface Saisie {
  plateformeUrl: string;
  email: string;
  whatsappE164: string;
  chuesApiUrl: string;
  chuesApiToken: string;
  grandPublicApiUrl: string;
  grandPublicApiToken: string;
}

const depuis = (parametres: ParametresChues): Saisie => ({
  plateformeUrl: parametres.plateformeUrl ?? '',
  email: parametres.email ?? '',
  whatsappE164: parametres.whatsappE164 ?? '',
  chuesApiUrl: parametres.chuesApiUrl ?? '',
  chuesApiToken: '',
  grandPublicApiUrl: parametres.grandPublicApiUrl ?? '',
  grandPublicApiToken: '',
});

/**
 * Un jeton laisse vide n’est PAS envoye : le serveur ne le rend jamais en clair,
 * et l’envoyer vide effacerait celui qui est en place a chaque enregistrement.
 */
function aEnvoyer(saisie: Saisie): UpdateParametresChues {
  const { chuesApiToken, grandPublicApiToken, ...reste } = saisie;
  return {
    ...reste,
    ...(chuesApiToken === '' ? {} : { chuesApiToken }),
    ...(grandPublicApiToken === '' ? {} : { grandPublicApiToken }),
  };
}

export function ParametresChuesCard() {
  const queryClient = useQueryClient();
  const [saisie, setSaisie] = useState<Saisie | null>(null);

  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });

  const enregistrer = useMutation({
    mutationFn: (body: UpdateParametresChues) => updateParametresChues(body),
    onSuccess: (frais) => {
      queryClient.setQueryData(queryKeys.parametresChues, frais);
      void queryClient.invalidateQueries({ queryKey: queryKeys.parametresEnrolement });
      setSaisie(depuis(frais));
      toast.success('Paramètres CHUES enregistrés.');
    },
    onError: (error) => {
      toastApiError(error, 'Les paramètres n’ont pas pu être enregistrés.');
    },
  });

  if (parametres.isPending) return <Skeleton className="h-96 w-full" />;
  if (parametres.isError) {
    return (
      <QueryErrorState
        error={parametres.error}
        onRetry={() => {
          void parametres.refetch();
        }}
      />
    );
  }

  const courant = saisie ?? depuis(parametres.data);
  const modifie = (patch: Partial<Saisie>): void => {
    setSaisie({ ...courant, ...patch });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres CHUES</CardTitle>
        <CardDescription>
          Ce que le téléconseiller dicte au prospect, et les accès des deux plateformes
          d’enrôlement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plateforme en ligne">
            {(props) => (
              <Input
                {...props}
                inputMode="url"
                placeholder="https://"
                value={courant.plateformeUrl}
                onChange={(event) => {
                  modifie({ plateformeUrl: event.target.value });
                }}
              />
            )}
          </Field>

          <Field label="Adresse électronique CHUES">
            {(props) => (
              <Input
                {...props}
                inputMode="email"
                value={courant.email}
                onChange={(event) => {
                  modifie({ email: event.target.value });
                }}
              />
            )}
          </Field>

          <Field label="Numéro WhatsApp d’enrôlement">
            {(props) => (
              <Input
                {...props}
                inputMode="tel"
                value={courant.whatsappE164}
                onChange={(event) => {
                  modifie({ whatsappE164: event.target.value });
                }}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-[600]">Accès des plateformes</h3>
            {parametres.data.heriteDeLEnvironnement ? (
              <Badge variant="outline">Hérités de l’environnement</Badge>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="API CHUES">
            {(props) => (
              <Input
                {...props}
                inputMode="url"
                placeholder="https://"
                value={courant.chuesApiUrl}
                onChange={(event) => {
                  modifie({ chuesApiUrl: event.target.value });
                }}
              />
            )}
          </Field>

          <Field label="Jeton CHUES"
            description={parametres.data.chuesApiTokenPose ? 'Posé. Le laisser vide le garde.' : 'Absent.'}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="off"
                value={courant.chuesApiToken}
                onChange={(event) => {
                  modifie({ chuesApiToken: event.target.value });
                }}
              />
            )}
          </Field>

          <Field label="API Grand Public">
            {(props) => (
              <Input
                {...props}
                inputMode="url"
                placeholder="https://"
                value={courant.grandPublicApiUrl}
                onChange={(event) => {
                  modifie({ grandPublicApiUrl: event.target.value });
                }}
              />
            )}
          </Field>

          <Field label="Jeton Grand Public"
            description={parametres.data.grandPublicApiTokenPose ? 'Posé. Le laisser vide le garde.' : 'Absent.'}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="off"
                value={courant.grandPublicApiToken}
                onChange={(event) => {
                  modifie({ grandPublicApiToken: event.target.value });
                }}
              />
            )}
          </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            disabled={enregistrer.isPending}
            onClick={() => {
              enregistrer.mutate(aEnvoyer(courant));
            }}
          >
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
