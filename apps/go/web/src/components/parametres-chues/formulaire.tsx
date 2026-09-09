import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { JournalParametres } from '@/components/parametres-chues/journal';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  enLignes,
  enListe,
  fetchParametresChues,
  LIBELLES_PARAMETRE,
  LISTES_DESTINATAIRES,
  majParametresChues,
  type MajParametresChues,
  type ParametresChues,
} from '@/lib/data/parametres-chues';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

type CleTexte = Exclude<keyof ParametresChues, 'verrouFiches'>;

const PLATEFORMES: readonly CleTexte[] = [
  'plateformeChuesUrl',
  'plateformeGrandPublicUrl',
  'emailChues',
  'whatsappChuesE164',
];

type Saisie = Partial<Record<string, string>>;

interface Champs {
  valeur: (cle: CleTexte) => string;
  saisir: (cle: string, texte: string) => void;
}

function CartePlateformes({ valeur, saisir }: Champs) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plateformes et contacts</CardTitle>
        <CardDescription>
          Ces valeurs s’affichent en lecture seule dans le formulaire de conversion et dans les
          messages envoyés.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {PLATEFORMES.map((cle) => (
          <Field key={cle} label={LIBELLES_PARAMETRE[cle] ?? cle}>
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

function CarteDestinataires({ valeur, saisir }: Champs) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Destinataires en copie</CardTitle>
        <CardDescription>
          Une adresse par ligne. Ces comptes reçoivent une copie des demandes déposées.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {LISTES_DESTINATAIRES.map((cle) => (
          <Field key={cle} label={LIBELLES_PARAMETRE[cle] ?? cle}>
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

function CarteMessages({ valeur, saisir }: Champs) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages envoyés aux prospects</CardTitle>
        <CardDescription>
          Les mots entre accolades sont remplacés à l’envoi : {'{prenom}'}, {'{lien}'}, {'{date}'},{' '}
          {'{informations}'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field label={LIBELLES_PARAMETRE.accuseReceptionObjet ?? ''}>
          {(props) => (
            <Input
              {...props}
              value={valeur('accuseReceptionObjet')}
              onChange={(event) => {
                saisir('accuseReceptionObjet', event.target.value);
              }}
            />
          )}
        </Field>
        {(['messageWhatsapp', 'accuseReceptionCorps'] as const).map((cle) => (
          <Field key={cle} label={LIBELLES_PARAMETRE[cle] ?? cle}>
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
  );
}

function PiedEnregistrement({
  modifie,
  enCours,
  erreur,
  onEnregistrer,
}: {
  modifie: boolean;
  enCours: boolean;
  erreur: unknown;
  onEnregistrer: () => void;
}) {
  const repli = 'Les paramètres n’ont pas pu être enregistrés.';
  return (
    <div className="flex items-center justify-end gap-3">
      {erreur === null ? null : (
        <p role="alert" className="text-[0.875rem] text-destructive">
          {apiErrorText(erreur, repli)}
        </p>
      )}
      <Button type="button" disabled={!modifie || enCours} onClick={onEnregistrer}>
        {enCours ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}

function CarteVerrou({ actif, onChange }: { actif: boolean; onChange: (actif: boolean) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verrou des fiches</CardTitle>
        <CardDescription>
          Une seule fiche ouverte à la fois par téléconseiller. Désactivé, deux personnes peuvent
          appeler le même numéro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Switch checked={actif} aria-label="Verrou des fiches" onCheckedChange={onChange} />
      </CardContent>
    </Card>
  );
}

function lireValeur(lus: ParametresChues, saisie: Saisie, cle: CleTexte): string {
  const saisi = saisie[cle];
  if (saisi !== undefined) return saisi;
  const stockee = lus[cle];
  if (Array.isArray(stockee)) return enLignes(stockee);
  return stockee ?? '';
}

function corpsDe(saisie: Saisie, verrou: boolean | null): MajParametresChues {
  const corps: Record<string, unknown> = {};
  for (const [cle, texte] of Object.entries(saisie)) {
    if (texte === undefined) continue;
    corps[cle] = (LISTES_DESTINATAIRES as readonly string[]).includes(cle) ? enListe(texte) : texte;
  }
  if (verrou !== null) corps.verrouFiches = verrou;
  return corps as MajParametresChues;
}

export function FormulaireParametresChues({ peutToutRegler }: { peutToutRegler: boolean }) {
  const queryClient = useQueryClient();
  const [saisie, setSaisie] = useState<Saisie>({});
  const [verrou, setVerrou] = useState<boolean | null>(null);

  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });

  const enregistrer = useMutation({
    mutationFn: (corps: MajParametresChues) => majParametresChues(corps),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.parametresChues, suivants);
      void queryClient.invalidateQueries({ queryKey: queryKeys.parametresChuesJournal });
      setSaisie({});
      setVerrou(null);
      toast.success('Paramètres enregistrés.');
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Les paramètres n’ont pas pu être enregistrés.'));
    },
  });

  if (parametres.isPending) return <Skeleton className="h-96 rounded-lg" />;
  if (parametres.isError) {
    return (
      <QueryErrorState
        error={parametres.error}
        onRetry={() => {
          void parametres.refetch();
        }}
        fallback="Les paramètres CHUES n’ont pas pu être lus."
      />
    );
  }

  const champs: Champs = {
    valeur: (cle) => lireValeur(parametres.data, saisie, cle),
    saisir: (cle, texte) => {
      setSaisie((courant) => ({ ...courant, [cle]: texte }));
    },
  };
  const modifie = Object.keys(saisie).length > 0 || verrou !== null;

  return (
    <div className="flex flex-col gap-6">
      {peutToutRegler ? (
        <CarteVerrou actif={verrou ?? parametres.data.verrouFiches} onChange={setVerrou} />
      ) : null}

      {peutToutRegler ? <CartePlateformes {...champs} /> : null}

      <CarteMessages {...champs} />

      {peutToutRegler ? <CarteDestinataires {...champs} /> : null}

      <PiedEnregistrement
        modifie={modifie}
        enCours={enregistrer.isPending}
        erreur={enregistrer.error}
        onEnregistrer={() => {
          enregistrer.mutate(corpsDe(saisie, verrou));
        }}
      />

      <JournalParametres />
    </div>
  );
}
