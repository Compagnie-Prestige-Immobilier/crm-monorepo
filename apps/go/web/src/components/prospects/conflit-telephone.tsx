import { AlertTriangleIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { ConflitTelephone } from '@/lib/data/grand-public';

/** Le 409 nomme la fiche existante et son propriétaire : sans eux, l'écran ne dit rien. */
export function ConflitTelephoneCarte({ conflit }: { conflit: ConflitTelephone | null }) {
  if (conflit === null) return null;

  const nom = `${conflit.prenom ?? ''} ${conflit.nom ?? ''}`.trim();

  return (
    <Card className="border-destructive/40">
      <CardContent className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div role="alert" className="flex min-w-0 flex-col gap-1">
          <p className="font-[600]">
            Ce numéro est déjà celui de {nom === '' ? 'une fiche existante' : nom}.
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Suivi par {conflit.ownedByCommercialName}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
