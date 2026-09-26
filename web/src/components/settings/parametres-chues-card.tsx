'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChampTexteVariables } from '@/components/forms/champ-texte-variables';
import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchJournalParametres,
  fetchParametresChues,
  updateParametresChues,
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
  destinatairesSupervision: 'Demande déposée, adresses en copie',
  codificationProvenances: 'Règles de provenance',
};

/** Derrière le « i » de chaque réglage : ce qu'il change, et où. */
const INFOS: Record<string, string> = {
  plateformeChuesUrl:
    'Le lien de la plateforme CHUES, affiché en lecture seule dans le formulaire de conversion et posé dans le message WhatsApp par {lien}.',
  plateformeGrandPublicUrl:
    'Le lien de la plateforme Grand Public, même usage que celui de CHUES pour les prospects Grand Public.',
  emailChues:
    'L’adresse de contact donnée aux prospects dans l’accusé de réception, par {emailChues}.',
  whatsappChuesE164:
    'Le numéro WhatsApp donné aux prospects dans l’accusé de réception, par {whatsappChues}.',
  messageWhatsapp:
    'Le message prérempli quand un téléconseiller ouvre WhatsApp depuis une fiche ou la console.',
};

const CODIFICATION = 'codificationProvenances';
const VARIABLES_WHATSAPP = ['prenom', 'lien', 'teleconseiller', 'telephoneTeleconseiller'];
/** Le serveur refuse plus de cent règles. */
const PROVENANCES_MAX = 100;

const PROJETS = [
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

type Regle = { motif: string; canal: string; projet: string };

/** Le serveur lit « motif | canal | projet » : le tableau garde ce format stocké. */
const enRegle = (ligne: string): Regle => {
  const [motif = '', canal = '', projet = 'CHUES'] = ligne.split('|').map((part) => part.trim());
  return { motif, canal, projet };
};
const enLigne = (regle: Regle): string => `${regle.motif} | ${regle.canal} | ${regle.projet}`;

export function ParametresChuesCard({ peutToutRegler }: { peutToutRegler: boolean }) {
  const queryClient = useQueryClient();
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });
  const [brouillon, setBrouillon] = useState<Partial<Record<CleTexte, string>>>({});
  const [regles, setRegles] = useState<Regle[] | null>(null);

  const enregistrement = useMutation({
    mutationFn: (corps: Record<string, unknown>) => updateParametresChues(corps),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.parametresChues, suivants);
      void queryClient.invalidateQueries({ queryKey: queryKeys.parametresChuesJournal });
      setBrouillon({});
      setRegles(null);
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
        fallback="Les paramètres n’ont pas pu être lus."
      />
    );

  const lus = parametres.data;
  const valeur = (cle: CleTexte): string => brouillon[cle] ?? lus[cle];
  const saisir = (cle: CleTexte, texte: string) => {
    setBrouillon((courant) => ({ ...courant, [cle]: texte }));
  };
  const reglesAffichees = regles ?? lus.codificationProvenances.map(enRegle);
  const modifie = Object.keys(brouillon).length > 0 || regles !== null;

  const envoyer = () => {
    const corps: Record<string, unknown> = { ...brouillon };
    if (regles !== null) {
      corps[CODIFICATION] = regles
        .filter((regle) => regle.motif.trim() !== '' || regle.canal.trim() !== '')
        .map(enLigne);
    }
    enregistrement.mutate(corps);
  };

  return (
    <div className="flex flex-col gap-6">
      <EnTete peutToutRegler={peutToutRegler} />
      {peutToutRegler ? <CartePlateformes valeur={valeur} saisir={saisir} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Message WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <ChampTexteVariables
            label="Texte du message"
            info={INFOS.messageWhatsapp}
            valeur={valeur('messageWhatsapp')}
            usine={lus.textesUsine.messageWhatsapp}
            variables={VARIABLES_WHATSAPP}
            lignes={4}
            onChange={(saisie) => {
              saisir('messageWhatsapp', saisie);
            }}
          />
        </CardContent>
      </Card>

      {peutToutRegler ? <CarteProvenances regles={reglesAffichees} onChange={setRegles} /> : null}

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

type CleTexte =
  | 'plateformeChuesUrl'
  | 'plateformeGrandPublicUrl'
  | 'emailChues'
  | 'whatsappChuesE164'
  | 'messageWhatsapp';

type ChampsProps = {
  valeur: (cle: CleTexte) => string;
  saisir: (cle: CleTexte, texte: string) => void;
};

function EnTete({ peutToutRegler }: { peutToutRegler: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-h2 font-[800] tracking-[-0.03em]">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Réglages communs à CHUES et Grand Public.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {peutToutRegler ? (
          <Link href="/admin/courriels" className={buttonVariants({ variant: 'outline' })}>
            Courriels et messages
          </Link>
        ) : null}
        <Link href="/admin/referentiels" className={buttonVariants({ variant: 'outline' })}>
          Listes de référence
        </Link>
      </div>
    </div>
  );
}

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
          <Field key={cle} label={LIBELLES[cle] ?? cle} info={INFOS[cle]}>
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

function CarteProvenances({
  regles,
  onChange,
}: {
  regles: Regle[];
  onChange: (regles: Regle[]) => void;
}) {
  const modifier = (index: number, partiel: Partial<Regle>) => {
    onChange(regles.map((regle, i) => (i === index ? { ...regle, ...partiel } : regle)));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provenances des classeurs importés</CardTitle>
        <p className="mt-1 text-[0.875rem] text-muted-foreground">
          Le motif est cherché dans la colonne de provenance du classeur. Une campagne sans règle
          fait refuser ses lignes à l’import.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motif</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>
                <span className="sr-only">Retirer</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regles.map((regle, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    className="min-w-44"
                    aria-label={`Motif de la règle ${String(index + 1)}`}
                    spellCheck={false}
                    value={regle.motif}
                    placeholder="Meta CPI GRAND PUBLIC"
                    onChange={(event) => {
                      modifier(index, { motif: event.target.value });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="min-w-44"
                    aria-label={`Canal de la règle ${String(index + 1)}`}
                    value={regle.canal}
                    placeholder="Meta (Facebook et Instagram)"
                    onChange={(event) => {
                      modifier(index, { canal: event.target.value });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    items={PROJETS}
                    value={regle.projet}
                    onValueChange={(projet) => {
                      if (projet !== null) modifier(index, { projet });
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Projet de la règle ${String(index + 1)}`}
                      className="w-40"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJETS.map((projet) => (
                        <SelectItem key={projet.value} value={projet.value}>
                          {projet.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retirer la règle ${String(index + 1)}`}
                    onClick={() => {
                      onChange(regles.filter((_, i) => i !== index));
                    }}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={regles.length >= PROVENANCES_MAX}
            onClick={() => {
              onChange([...regles, { motif: '', canal: '', projet: 'CHUES' }]);
            }}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Ajouter une règle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Qui a changé quoi, et ce que la valeur disait avant. */
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
