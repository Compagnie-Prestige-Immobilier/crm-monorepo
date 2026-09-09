import type { LucideIcon } from 'lucide-react';

import type { components } from '@/api/schema';
import { formatMontant } from '@/components/banque/montant';
import { Card, CardContent } from '@/components/ui/card';
import { formatDecimal, formatNumber } from '@/lib/format';

export function Kpi({
  label,
  valeur,
  detail,
  icone: Icone,
  index,
}: {
  label: string;
  valeur: string;
  detail: string;
  icone: LucideIcon;
  index: number;
}) {
  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em]">
            {valeur}
          </p>
          <p className="mt-2 text-[0.75rem] text-muted-foreground">{detail}</p>
        </div>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
        >
          <Icone className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function delaiBanque(heures: number | null): string {
  return heures === null ? '–' : `${formatDecimal(heures / 24)} j`;
}

export function TableauMontants({
  banques,
}: {
  banques: readonly components['schemas']['BanqueCompte'][];
}) {
  return (
    <Card>
      <CardContent className="overflow-x-auto scrollbar-thin p-0">
        <table className="figure w-full text-[0.875rem]">
          <caption className="px-5 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            Montants encaissés par banque
          </caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                Banque
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Dossiers
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Encaissés
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Rejetés
              </th>
              {/* Le délai remplace le diagramme d'heures de la v1 : sept banques
                  alignées se comparent mieux en colonne qu'en barres. */}
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Délai moyen
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Montant
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {banques.map((banque) => (
              <tr key={banque.banqueId}>
                <th scope="row" className="px-5 py-2 text-left font-[400]">
                  {banque.label}
                </th>
                <td className="px-5 py-2 text-right">{formatNumber(banque.cases)}</td>
                <td className="px-5 py-2 text-right">{formatNumber(banque.cashed)}</td>
                <td className="px-5 py-2 text-right">{formatNumber(banque.rejected)}</td>
                <td className="px-5 py-2 text-right">{delaiBanque(banque.meanProcessingHours)}</td>
                <td className="px-5 py-2 text-right font-[600]">
                  {formatMontant(banque.amountXof, '0 FCFA')}
                </td>
              </tr>
            ))}
            {banques.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">
                  Aucun dossier sur ces critères.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
