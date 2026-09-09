import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchJournalParametres, LIBELLES_PARAMETRE } from '@/lib/data/parametres-chues';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/** Qui a changé quoi, et ce que la valeur disait avant. */
export function JournalParametres() {
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
              <span className="font-[600]">{LIBELLES_PARAMETRE[ligne.cle] ?? ligne.cle}</span>
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
