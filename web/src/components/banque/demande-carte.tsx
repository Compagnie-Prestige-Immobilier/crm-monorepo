import { LandmarkIcon } from 'lucide-react';

import type { Arbitrage } from '@/components/banque/demandes-arbitrage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LIBELLES_STATUT_DEMANDE, type DemandeClient } from '@/lib/data/client-requests';
import { formatDateTime, formatPhone } from '@/lib/format';

const VARIANTE: Record<DemandeClient['status'], 'warning' | 'success' | 'destructive'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
};

function Arbitree({ demande }: { demande: DemandeClient }) {
  if (demande.status === 'PENDING') return null;
  return (
    <p className="text-[0.75rem] text-muted-foreground">
      Arbitrée par {demande.reviewedByName ?? 'un administrateur'}
      {demande.reviewedAt === null ? null : (
        <>
          {' le '}
          <time dateTime={demande.reviewedAt}>{formatDateTime(demande.reviewedAt)}</time>
        </>
      )}
    </p>
  );
}

function Actions({
  demande,
  arbitre,
  onArbitrer,
}: {
  demande: DemandeClient;
  arbitre: boolean;
  onArbitrer: (arbitrage: Arbitrage) => void;
}) {
  if (demande.status !== 'PENDING') return null;

  // L'agent bancaire n'arbitre pas : le dire vaut mieux qu'une carte muette.
  if (!arbitre) {
    return (
      <p className="text-[0.8125rem] text-muted-foreground">
        En attente d’arbitrage par l’administration.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        onClick={() => {
          onArbitrer({ demande, action: 'approuver' });
        }}
      >
        Approuver et créer le prospect
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onArbitrer({ demande, action: 'refuser' });
        }}
      >
        Refuser
      </Button>
    </div>
  );
}

export function CarteDemande({
  demande,
  arbitre,
  onArbitrer,
}: {
  demande: DemandeClient;
  arbitre: boolean;
  onArbitrer: (arbitrage: Arbitrage) => void;
}) {
  return (
    <Card className="animate-rise">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
              {demande.prenom} {demande.nom}
            </h2>
            <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
              {formatPhone(demande.phoneE164)}
            </p>
          </div>
          <Badge variant={VARIANTE[demande.status]}>
            {LIBELLES_STATUT_DEMANDE[demande.status]}
          </Badge>
        </div>

        {/* La provenance en clair : elle explique qu'un prospect créé ici n'ait
            pas de représentant de terrain, et on la retrouve en statistique. */}
        <p className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
          <LandmarkIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-[600]">Demande de {demande.banqueName}</span>
          <span className="text-muted-foreground">
            déposée par {demande.requestedByName} le{' '}
            <time dateTime={demande.createdAt}>{formatDateTime(demande.createdAt)}</time>
          </span>
        </p>

        {demande.note === null || demande.note === '' ? null : (
          <p className="max-w-prose rounded-md bg-muted px-3 py-2 text-[0.8125rem]">
            {demande.note}
          </p>
        )}

        {demande.status === 'REJECTED' && demande.rejectionNote !== null ? (
          <p className="max-w-prose text-[0.8125rem] text-destructive">
            Refusée : {demande.rejectionNote}
          </p>
        ) : null}

        <Arbitree demande={demande} />
        <Actions demande={demande} arbitre={arbitre} onArbitrer={onArbitrer} />
      </CardContent>
    </Card>
  );
}
