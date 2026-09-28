'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const AUTRE = 'Autre, à préciser';

const OUI_NON: readonly string[] = ['Oui', 'Non'];

const CHOIX: Record<Exclude<ChampChoix, 'localite'>, readonly string[]> = {
  superficie: ['300 m²', '200 m²', '225 m²', '150 m²'],
  natureJuridique: ['Titre foncier', 'Bail', 'Notification de bail et délibération'],
  etatSite: ['Viabilisé complet', 'Viabilisé partiel', 'Loti'],
  position: ['Bordure route', 'Deuxième position', 'Angle', 'Double façade', 'Pas angle'],
  auNomDe: ['Le prospect'],
  pieceIdentiteVerifiee: OUI_NON,
  paiementAcompte: OUI_NON,
  origineFondsJustifiee: OUI_NON,
  freinPrincipal: ['Prix', 'Financement'],
  autresPromoteurs: OUI_NON,
  prochaineAction: ['Signature du contrat', 'Rappel'],
};

type ChampChoix =
  | 'localite'
  | 'superficie'
  | 'natureJuridique'
  | 'etatSite'
  | 'position'
  | 'auNomDe'
  | 'pieceIdentiteVerifiee'
  | 'paiementAcompte'
  | 'origineFondsJustifiee'
  | 'freinPrincipal'
  | 'autresPromoteurs'
  | 'prochaineAction';

const SECTIONS: readonly { titre: string; champs: readonly [ChampChoix, string][] }[] = [
  {
    titre: 'Lot',
    champs: [
      ['localite', 'Localité du lot'],
      ['superficie', 'Superficie du lot'],
      ['natureJuridique', 'Nature juridique'],
      ['etatSite', 'État du site'],
      ['position', 'Position'],
    ],
  },
  {
    titre: 'Acquéreur et conformité',
    champs: [
      ['auNomDe', 'Au nom de qui sera le bien ?'],
      ['pieceIdentiteVerifiee', 'Pièce d’identité vérifiée'],
      ['paiementAcompte', 'Paiement de l’acompte'],
      ['origineFondsJustifiee', 'Origine des fonds justifiée'],
    ],
  },
  {
    titre: 'Freins et suivi',
    champs: [
      ['freinPrincipal', 'Frein principal'],
      ['autresPromoteurs', 'A consulté d’autres promoteurs ?'],
      ['prochaineAction', 'Prochaine action *'],
    ],
  },
];

const TEXTES: readonly ['parrain' | 'chargeDeClientele', string][] = [
  ['parrain', 'Parrain ou apporteur'],
  ['chargeDeClientele', 'Chargé de clientèle en charge'],
];

function ChoixOuAutre({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [autre, setAutre] = useState(value !== '' && !options.includes(value));
  const choix = options === OUI_NON ? options : [...options, AUTRE];
  const items = choix.map((option) => ({ value: option, label: option }));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={autre ? AUTRE : value || null}
        onValueChange={(choix) => {
          setAutre(choix === AUTRE);
          onChange(choix === AUTRE || choix === null ? '' : choix);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {autre ? (
        <Input
          aria-label={`${label}, précision`}
          value={value}
          maxLength={120}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : null}
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
  const changer = (champ: keyof Closing) => (valeur: string) => {
    setClosing((avant) => ({ ...avant, [champ]: valeur }));
  };
  const enregistrer = useMutation({
    mutationFn: () => enregistrerClosing(rendezVous.id, closing),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      toast.success('Closing enregistré.');
      onClose();
    },
    onError: (error) => toastApiError(error, 'Le closing n’a pas été enregistré.'),
  });
  const pret = closing.prochaineAction.trim() !== '' && closing.dateRelance !== '';

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (pret) enregistrer.mutate();
      }}
    >
      {SECTIONS.map((section) => (
        <fieldset key={section.titre} className="grid gap-3">
          <legend className="mb-2 font-display text-[1.0625rem] font-[700]">{section.titre}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.champs.map(([champ, label]) => (
              <ChoixOuAutre
                key={champ}
                label={label}
                options={champ === 'localite' ? sites : CHOIX[champ]}
                value={closing[champ]}
                onChange={changer(champ)}
              />
            ))}
            {section.titre === 'Freins et suivi' ? (
              <>
                {TEXTES.map(([champ, label]) => (
                  <div key={champ} className="grid gap-1.5">
                    <Label htmlFor={`closing-${champ}`}>{label}</Label>
                    <Input
                      id={`closing-${champ}`}
                      value={closing[champ]}
                      maxLength={120}
                      onChange={(event) => {
                        changer(champ)(event.target.value);
                      }}
                    />
                  </div>
                ))}
                <div className="grid gap-1.5">
                  <Label htmlFor="closing-date-relance">Date de relance *</Label>
                  <Input
                    id="closing-date-relance"
                    type="date"
                    required
                    value={closing.dateRelance}
                    onChange={(event) => {
                      changer('dateRelance')(event.target.value);
                    }}
                  />
                </div>
              </>
            ) : null}
          </div>
        </fieldset>
      ))}
      <div className="grid gap-1.5">
        <Label htmlFor="closing-compte-rendu">Compte-rendu de l’échange</Label>
        <Textarea
          id="closing-compte-rendu"
          rows={4}
          maxLength={4000}
          placeholder="Ce qui s’est dit, ce qui a été promis."
          value={closing.compteRendu}
          onChange={(event) => {
            changer('compteRendu')(event.target.value);
          }}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Fermer
        </Button>
        <Button type="submit" disabled={!pret || enregistrer.isPending}>
          Enregistrer le closing
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ClosingDialog({
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
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Closing de {rendezVous.prenom} {rendezVous.nom}
          </DialogTitle>
        </DialogHeader>
        {lecture.isError ? (
          <QueryErrorState error={lecture.error} onRetry={() => void lecture.refetch()} />
        ) : null}
        {lecture.isPending ? <Skeleton className="h-96 w-full rounded-lg" /> : null}
        {lecture.data === undefined ? null : (
          <Formulaire rendezVous={rendezVous} lu={lecture.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
