'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { fetchProspectRequalifications } from '@/lib/data/prospects';
import { formatDateTime } from '@/lib/format';
import { PHASE2_STATUS_LABELS, type Phase2Status } from '@/lib/types';

const libelle = (statut: string): string => PHASE2_STATUS_LABELS[statut as Phase2Status] ?? statut;

export function HistoriqueStatuts({ prospectId }: { prospectId: string }) {
  const lignes = useQuery({
    queryKey: ['prospects', 'requalifications', prospectId],
    queryFn: () => fetchProspectRequalifications(prospectId),
  });

  if (lignes.data === undefined || lignes.data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
          Changements de statut
        </h3>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {lignes.data.map((ligne) => (
            <li key={ligne.id} className="flex flex-col gap-0.5">
              <span className="text-[0.9375rem] font-[600]">
                {libelle(ligne.de)} vers {libelle(ligne.vers)}
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">
                {ligne.parNom ?? 'Auteur inconnu'}
                {' · '}
                <time dateTime={ligne.le} className="tabular-nums">
                  {formatDateTime(ligne.le)}
                </time>
              </span>
              {ligne.methodeAnnulee === null || ligne.methodeAnnulee === undefined ? null : (
                <span className="text-[0.8125rem] text-muted-foreground">
                  Adhésion annulée, méthode retirée.
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
