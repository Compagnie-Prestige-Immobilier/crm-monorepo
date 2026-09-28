'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChoixOuAutre } from '@/components/accueil/choix-ou-autre';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  CLE_RENDEZ_VOUS,
  type Closing,
  enregistrerClosing,
  lireClosing,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { toastApiError } from '@/lib/mutation-feedback';

const OUI_NON: readonly string[] = ['Oui', 'Non'];

type Champ = keyof Closing;
type Question = { champ: Champ; label: string; choix?: readonly string[] | 'sites'; long?: true };

/** Trois écrans courts : le chargé de clientèle enregistre dès qu'il a ce qu'il sait. */
const ETAPES: readonly { titre: string; questions: readonly Question[] }[] = [
  {
    titre: 'Lot',
    questions: [
      { champ: 'localite', label: 'Localité du lot', choix: 'sites' },
      {
        champ: 'superficie',
        label: 'Superficie du lot',
        choix: ['300 m²', '200 m²', '225 m²', '150 m²'],
      },
      {
        champ: 'natureJuridique',
        label: 'Nature juridique',
        choix: ['Titre foncier', 'Bail', 'Notification de bail et délibération'],
      },
      {
        champ: 'etatSite',
        label: 'État du site',
        choix: ['Viabilisé complet', 'Viabilisé partiel', 'Loti'],
      },
      {
        champ: 'position',
        label: 'Position',
        choix: ['Bordure route', 'Deuxième position', 'Angle', 'Double façade', 'Pas angle'],
      },
    ],
  },
  {
    titre: 'Acquéreur',
    questions: [
      { champ: 'auNomDe', label: 'Au nom de qui sera le bien ?', choix: ['Le prospect'] },
      { champ: 'pieceIdentiteVerifiee', label: 'Pièce d’identité vérifiée', choix: OUI_NON },
      { champ: 'paiementAcompte', label: 'Paiement de l’acompte', choix: OUI_NON },
      { champ: 'origineFondsJustifiee', label: 'Origine des fonds justifiée', choix: OUI_NON },
    ],
  },
  {
    titre: 'Suivi',
    questions: [
      { champ: 'freinPrincipal', label: 'Frein principal', choix: ['Prix', 'Financement'] },
      { champ: 'autresPromoteurs', label: 'A consulté d’autres promoteurs ?', choix: OUI_NON },
      { champ: 'parrain', label: 'Parrain ou apporteur' },
      { champ: 'chargeDeClientele', label: 'Chargé de clientèle en charge' },
      {
        champ: 'prochaineAction',
        label: 'Prochaine action',
        choix: ['Signature du contrat', 'Rappel'],
      },
      { champ: 'dateRelance', label: 'Date de relance' },
      { champ: 'compteRendu', label: 'Compte-rendu de l’échange', long: true },
    ],
  },
];

function Saisie({
  question,
  value,
  sites,
  onChange,
}: {
  question: Question;
  value: string;
  sites: string[];
  onChange: (value: string) => void;
}) {
  const id = `closing-${question.champ}`;
  if (question.choix !== undefined) {
    const options = question.choix === 'sites' ? sites : question.choix;
    return (
      <ChoixOuAutre
        label={question.label}
        options={options}
        autre={options !== OUI_NON}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{question.label}</Label>
      {question.long === true ? (
        <Textarea
          id={id}
          rows={4}
          maxLength={4000}
          placeholder="Ce qui s’est dit, ce qui a été promis."
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <Input
          id={id}
          type={question.champ === 'dateRelance' ? 'date' : 'text'}
          maxLength={120}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </div>
  );
}

function Formulaire({
  rendezVous,
  lu: { closing: depart, sites },
  onClose,
}: {
  rendezVous: RendezVousObtenu;
  lu: { closing: Closing; sites: string[] };
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [closing, setClosing] = useState(depart);
  const [etape, setEtape] = useState(0);
  const enregistrer = useMutation({
    mutationFn: () => enregistrerClosing(rendezVous.id, closing),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      toast.success('Closing enregistré.');
      onClose();
    },
    onError: (error) => toastApiError(error, 'Le closing n’a pas été enregistré.'),
  });
  const courante = ETAPES[etape] ?? ETAPES[0];
  const derniere = etape === ETAPES.length - 1;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        enregistrer.mutate();
      }}
    >
      <ol className="flex gap-1 px-4" aria-label="Étapes du closing">
        {ETAPES.map((item, rang) => (
          <li key={item.titre} className="flex-1">
            <button
              type="button"
              aria-current={rang === etape ? 'step' : undefined}
              onClick={() => {
                setEtape(rang);
              }}
              className={`w-full border-b-2 py-2 text-[0.8125rem] font-[600] ${rang === etape ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}
            >
              {rang + 1}. {item.titre}
            </button>
          </li>
        ))}
      </ol>
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
        {courante?.questions.map((question) => (
          <Saisie
            key={question.champ}
            question={question}
            value={closing[question.champ]}
            sites={sites}
            onChange={(valeur) => {
              setClosing((avant) => ({ ...avant, [question.champ]: valeur }));
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border p-4">
        <Button
          type="submit"
          variant={derniere ? 'default' : 'outline'}
          disabled={enregistrer.isPending}
        >
          Enregistrer et fermer
        </Button>
        {derniere ? null : (
          <Button
            type="button"
            onClick={() => {
              setEtape(etape + 1);
            }}
          >
            Suivant
          </Button>
        )}
      </div>
    </form>
  );
}

export function ClosingSheet({
  rendezVous,
  onClose,
}: {
  rendezVous: RendezVousObtenu | null;
  onClose: () => void;
}) {
  const lecture = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, 'closing', rendezVous?.id],
    queryFn: () => lireClosing(rendezVous?.id ?? ''),
    enabled: rendezVous !== null,
  });
  if (rendezVous === null) return null;
  return (
    <Sheet
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            Closing de {rendezVous.prenom} {rendezVous.nom}
          </SheetTitle>
        </SheetHeader>
        {lecture.isError ? (
          <QueryErrorState error={lecture.error} onRetry={() => void lecture.refetch()} />
        ) : null}
        {lecture.isPending ? <Skeleton className="mx-4 h-96 rounded-lg" /> : null}
        {lecture.data === undefined ? null : (
          <Formulaire rendezVous={rendezVous} lu={lecture.data} onClose={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}
