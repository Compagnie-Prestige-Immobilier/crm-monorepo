'use client';

import { useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VenteDetailDialog } from '@/components/ventes/vente-detail-dialog';
import { Chiffres, TableEcheances, TableVentes } from '@/components/ventes/ventes-tableaux';
import { formatFcfa, type Vente } from '@/lib/data/ventes';

export function TeleconseillerDetailDialog({
  nom,
  ventes,
  onFermer,
}: {
  nom: string | null;
  ventes: readonly Vente[];
  onFermer: () => void;
}) {
  if (nom === null) return null;
  return <Detail key={nom} nom={nom} ventes={ventes} onFermer={onFermer} />;
}

function Detail({
  nom,
  ventes,
  onFermer,
}: {
  nom: string;
  ventes: readonly Vente[];
  onFermer: () => void;
}) {
  const [venteDetailId, setVenteDetailId] = useState<number | null>(null);
  const onDetail = (vente: Vente) => setVenteDetailId(vente.id);
  const siennes = ventes.filter((vente) => vente.teleconseiller === nom);
  const echeances = siennes.filter((vente) => vente.modePaiement === 'CREDIT' && !vente.soldee);
  const credit = siennes.filter((vente) => vente.modePaiement === 'CREDIT').length;
  const soldees = siennes.filter((vente) => vente.soldee).length;
  const venteDetail = siennes.find((vente) => vente.id === venteDetailId) ?? null;
  const compteurs = [
    { label: 'Lots vendus', valeur: siennes.reduce((s, v) => s + v.nombreLots, 0) },
    { label: 'Au comptant', valeur: siennes.length - credit },
    { label: 'À crédit', valeur: credit },
    { label: 'Soldées', valeur: soldees },
    { label: 'À solder', valeur: siennes.length - soldees },
  ];
  return (
    <Dialog open onOpenChange={(ouvert) => (ouvert ? null : onFermer())}>
      <DialogContent className="grid h-[min(44rem,92dvh)] grid-rows-[auto_1fr] gap-0 p-0 sm:max-w-6xl">
        <div className="border-b border-border px-6 py-4 pr-16">
          <DialogTitle className="text-[1.125rem]">{nom}</DialogTitle>
          <DialogDescription>
            {siennes.length} vente{siennes.length > 1 ? 's' : ''} ·{' '}
            {formatFcfa(siennes.reduce((s, v) => s + v.prixTotal, 0))}
          </DialogDescription>
        </div>
        <Tabs defaultValue="synthese" className="min-h-0 px-6 py-4">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="synthese">1. Synthèse</TabsTrigger>
            <TabsTrigger value="ventes">2. Ventes · {siennes.length}</TabsTrigger>
            <TabsTrigger value="echeances">3. Échéances · {echeances.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="synthese" className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <Chiffres ventes={siennes} />
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-secondary p-4 sm:grid-cols-5">
              {compteurs.map((compteur) => (
                <div key={compteur.label}>
                  <dt className="text-[0.8125rem] text-muted-foreground">{compteur.label}</dt>
                  <dd className="font-[600] tabular-nums">{compteur.valeur}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
          <TabsContent value="ventes" className="min-h-0 overflow-y-auto">
            <TableVentes ventes={siennes} onDetail={onDetail} />
          </TabsContent>
          <TabsContent value="echeances" className="min-h-0 overflow-y-auto">
            {echeances.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">
                Aucune vente à crédit à solder pour ce téléconseiller.
              </p>
            ) : (
              <TableEcheances ventes={echeances} onDetail={onDetail} />
            )}
          </TabsContent>
        </Tabs>
        <VenteDetailDialog
          vente={venteDetail}
          open={venteDetail !== null}
          onOpenChange={(open) => (open ? null : setVenteDetailId(null))}
        />
      </DialogContent>
    </Dialog>
  );
}
