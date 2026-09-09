import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { PaymentMode, Prospect } from '@/lib/data/console';
import { PAYMENT_MODE_LABELS, confirmerConversion } from '@/lib/data/grand-public';
import { actifs, libelle, type ReferentielItem } from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';

const entier = (saisie: string): number | null => {
  const valeur = Number(saisie.trim());
  return saisie.trim() === '' || !Number.isInteger(valeur) ? null : valeur;
};

export function ConversionDialogue({
  prospectId,
  offres,
  ouverte,
  onOuverte,
  onConvertie,
}: {
  prospectId: string;
  offres: readonly ReferentielItem[] | null | undefined;
  ouverte: boolean;
  onOuverte: (ouverte: boolean) => void;
  onConvertie: (prospect: Prospect) => void;
}) {
  const [offerId, setOfferId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [montant, setMontant] = useState('');
  const [duree, setDuree] = useState('');

  const conversion = useMutation({
    mutationFn: (id: string) => {
      const amountXof = entier(montant);
      const durationMonths = entier(duree);
      return confirmerConversion(prospectId, {
        offerId: id,
        ...(paymentMode === null ? {} : { paymentMode }),
        ...(amountXof === null ? {} : { amountXof }),
        ...(durationMonths === null ? {} : { durationMonths }),
      });
    },
    onSuccess: (prospect) => {
      onConvertie(prospect);
      onOuverte(false);
      toast.success('Conversion confirmée.');
    },
    onError: (error) => {
      toastApiError(error, 'La conversion n’a pas pu être confirmée.');
    },
  });

  return (
    <Dialog open={ouverte} onOpenChange={onOuverte}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmer la conversion</DialogTitle>
          <DialogDescription>
            Associez l’offre retenue et, si connu, son paiement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="gp-conversion-offre">Offre</Label>
            <Select
              value={offerId ?? ''}
              onValueChange={(valeur) => {
                setOfferId(valeur === null || valeur === '' ? null : valeur);
              }}
            >
              <SelectTrigger id="gp-conversion-offre">
                <SelectValue placeholder="Choisir une offre" />
              </SelectTrigger>
              <SelectContent>
                {actifs(offres).map((offre) => (
                  <SelectItem key={offre.id} value={offre.id}>
                    {libelle(offre)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gp-conversion-paiement">Mode de paiement</Label>
            <Select
              value={paymentMode ?? ''}
              onValueChange={(valeur) => {
                setPaymentMode(valeur === null || valeur === '' ? null : (valeur as PaymentMode));
              }}
            >
              <SelectTrigger id="gp-conversion-paiement">
                <SelectValue placeholder="Non renseigné" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_MODE_LABELS).map(([cle, texte]) => (
                  <SelectItem key={cle} value={cle}>
                    {texte}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="gp-conversion-montant">Montant (F CFA)</Label>
              <Input
                id="gp-conversion-montant"
                type="number"
                min="0"
                inputMode="numeric"
                value={montant}
                onChange={(event) => {
                  setMontant(event.target.value);
                }}
              />
            </div>
            {paymentMode === 'ECHELONNE' ? (
              <div className="grid gap-2">
                <Label htmlFor="gp-conversion-duree">Durée (mois)</Label>
                <Input
                  id="gp-conversion-duree"
                  type="number"
                  min="1"
                  max="300"
                  inputMode="numeric"
                  value={duree}
                  onChange={(event) => {
                    setDuree(event.target.value);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOuverte(false);
            }}
          >
            Annuler
          </Button>
          <Button
            disabled={offerId === null || conversion.isPending}
            onClick={() => {
              if (offerId !== null) conversion.mutate(offerId);
            }}
          >
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
