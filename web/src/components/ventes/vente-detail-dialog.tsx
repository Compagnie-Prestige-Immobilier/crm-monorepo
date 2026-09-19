'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, LoaderIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addVenteVersement, formatFcfa, totalVerse, type Vente } from '@/lib/data/ventes';
import { formatDate } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const aujourdhui = (): string => new Date().toISOString().slice(0, 10);
const entier = (brut: string) => Number(brut.replace(/\D/g, '')) || 0;
const espaces = (n: number) => (n === 0 ? '' : n.toLocaleString('fr-FR'));

export function VenteDetailDialog({
  vente,
  open,
  onOpenChange,
}: {
  vente: Vente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open || vente === null) return null;
  return <Detail key={vente.id} vente={vente} onFermer={() => onOpenChange(false)} />;
}

/** Ce qu'un client verse d'habitude : le reste divisé par les mois qu'il reste. */
function mensualite(vente: Vente, reste: number): number {
  if (vente.modePaiement !== 'CREDIT' || vente.nombreMois === null) return 0;
  const moisRestants = Math.max(1, vente.nombreMois - vente.versements.length);
  return Math.ceil(reste / moisRestants);
}

function Detail({ vente, onFermer }: { vente: Vente; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(aujourdhui);
  const [montant, setMontant] = useState(0);
  const verse = totalVerse(vente);
  const reste = Math.max(0, vente.prixTotal - verse);
  const parMois = mensualite(vente, reste);
  const ajout = useMutation({
    mutationFn: () => addVenteVersement(vente.id, { date, montant }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ventes });
      setMontant(0);
      setDate(aujourdhui());
      toast.success('Versement ajouté.');
    },
    onError: (error) => toastApiError(error, 'Le versement n’a pas pu être ajouté.'),
  });
  return (
    <Dialog open onOpenChange={(ouvert) => (ouvert ? null : onFermer())}>
      <DialogContent className="grid h-[min(38rem,92dvh)] grid-rows-[auto_auto_1fr_auto] gap-0 p-0 sm:max-w-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-4">
          <div>
            <DialogTitle className="text-[1.125rem]">{vente.client}</DialogTitle>
            <DialogDescription>
              {vente.site} · {vente.nombreLots} lot{vente.nombreLots > 1 ? 's' : ''} · vente n°{' '}
              {vente.numero}
            </DialogDescription>
          </div>
          <Etiquettes vente={vente} />
        </div>

        <dl className="grid grid-cols-3 gap-3 bg-secondary px-6 py-4">
          <Chiffre label="Prix total" valeur={formatFcfa(vente.prixTotal)} />
          <Chiffre label="Déjà payé" valeur={formatFcfa(verse)} />
          <Chiffre label="Reste à payer" valeur={formatFcfa(reste)} fort />
        </dl>

        <div className="flex min-h-0 flex-col gap-4 px-6 py-4">
          {vente.soldee ? (
            <p className="flex items-center gap-2 rounded-md bg-success-surface p-3 text-success">
              <CheckCircle2Icon className="size-5" aria-hidden="true" />
              Cette vente est soldée.
            </p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (montant > 0) ajout.mutate();
              }}
            >
              <label htmlFor="versement-montant" className="text-[1rem] font-[600]">
                Nouveau versement
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="versement-montant"
                  inputMode="numeric"
                  className="h-12 min-w-40 flex-1 text-[1.25rem] tabular-nums"
                  placeholder="Montant"
                  value={espaces(montant)}
                  onChange={(e) => setMontant(Math.min(reste, entier(e.target.value)))}
                />
                <Input
                  aria-label="Date du versement"
                  type="date"
                  className="h-12 w-44"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
                <Button type="submit" size="lg" disabled={ajout.isPending || montant <= 0}>
                  {ajout.isPending ? (
                    <LoaderIcon className="animate-spin" aria-hidden="true" />
                  ) : (
                    <PlusIcon aria-hidden="true" />
                  )}
                  Ajouter
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {parMois > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMontant(parMois)}
                  >
                    Une mensualité · {formatFcfa(parMois)}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => setMontant(reste)}>
                  Tout le reste · {formatFcfa(reste)}
                </Button>
              </div>
            </form>
          )}
          <Versements vente={vente} />
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button variant="outline" size="lg" onClick={onFermer}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Etiquettes({ vente }: { vente: Vente }) {
  const credit = vente.modePaiement === 'CREDIT';
  return (
    <span className="flex gap-1">
      <Badge variant={credit ? 'info' : 'secondary'}>
        {credit ? `Crédit ${vente.nombreMois ?? '?'} mois` : 'Comptant'}
      </Badge>
      <Badge variant={vente.soldee ? 'success' : 'warning'}>
        {vente.soldee ? 'Soldée' : 'À solder'}
      </Badge>
    </span>
  );
}

function Versements({ vente }: { vente: Vente }) {
  const lignes = [
    { date: vente.dateSouscription, montant: vente.acompte, libelle: 'Acompte' },
    ...vente.versements.map((v) => ({ ...v, libelle: 'Versement' })),
  ].filter((ligne) => ligne.montant > 0);
  return (
    <section className="flex min-h-0 flex-col gap-2" aria-label="Versements">
      <p className="text-[0.875rem] text-muted-foreground">
        {lignes.length === 0 ? 'Aucun versement pour l’instant.' : `${lignes.length} versements`}
      </p>
      <ul className="min-h-0 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {lignes.map((ligne, index) => (
          <li key={index} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>
              <span className="text-[0.8125rem] text-muted-foreground">{ligne.libelle} · </span>
              {ligne.date === null ? 'Sans date' : formatDate(ligne.date)}
            </span>
            <strong className="tabular-nums">{formatFcfa(ligne.montant)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chiffre({
  label,
  valeur,
  fort = false,
}: {
  label: string;
  valeur: string;
  fort?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className={fort ? 'text-[1.125rem] font-[700] tabular-nums' : 'font-[600] tabular-nums'}>
        {valeur}
      </dd>
    </div>
  );
}
