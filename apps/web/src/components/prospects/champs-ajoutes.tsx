'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChampsConversion } from '@/lib/data/champs-conversion';
import type { ProspectRow } from '@/lib/types';

/**
 * Les réponses aux champs que l'administrateur a ajoutés au formulaire de
 * conversion. Sans réponse, pas de carte : une carte vide ferait croire à une
 * donnée manquante.
 */
export function ChampsAjoutes({ prospect }: { prospect: ProspectRow }) {
  const formulaire = useChampsConversion(prospect.projet);
  const renseignes = formulaire.libres.filter(
    (champ) => (prospect.champsLibres[champ.id] ?? '') !== '',
  );
  if (renseignes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Champs ajoutés</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-4">
          {renseignes.map((champ) => (
            <div key={champ.id} className="min-w-0">
              <dt className="text-muted-foreground">{champ.libelle}</dt>
              <dd className="truncate font-[600]">{prospect.champsLibres[champ.id]}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
