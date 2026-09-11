'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
  FolderArchiveIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchPiecesDeposees,
  lienDeLArchive,
  lienDeLaPiece,
  PIECE_STATUT_LABELS,
  type PieceDeposee,
} from '@/lib/data/pieces-plateforme';
import { queryKeys } from '@/lib/query-keys';

/** La plateforme rend « 154 KB » ; l'interface du panneau parle français. */
function tailleEnFrancais(taille: string): string {
  if (taille === '') return 'Ouvrir pour lire';
  return taille
    .replace(/\bKB\b/i, 'ko')
    .replace(/\bMB\b/i, 'Mo')
    .replace(/\bGB\b/i, 'Go');
}

const VARIANTES: Record<string, 'success' | 'warning' | 'destructive'> = {
  accepte: 'success',
  'en-attente': 'warning',
  refuse: 'destructive',
};

/**
 * Les pièces que le client a déposées sur la plateforme. Elles s'ouvrent ici :
 * un agent qui doit enregistrer une archive, la décompresser puis chercher le
 * bon fichier ne lit rien avant de décider.
 */
export function PiecesDeposees({ inscriptionId }: { inscriptionId: string }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const pieces = useQuery({
    queryKey: queryKeys.piecesDeposees(inscriptionId),
    queryFn: () => fetchPiecesDeposees(inscriptionId),
  });

  if (pieces.isPending) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (pieces.isError || pieces.data.length === 0) {
    return (
      <EmptyState
        icon={FolderArchiveIcon}
        title="Aucune pièce déposée"
        description="Le client n’a encore rien déposé sur la plateforme, ou la plateforme est injoignable."
      />
    );
  }

  const liste = pieces.data;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {liste.map((piece, index) => (
          <li key={piece.code}>
            <CartePiece piece={piece} onOuvrir={() => setOuverte(index)} />
          </li>
        ))}
      </ul>

      <div>
        <Button
          variant="outline"
          render={
            <a href={lienDeLArchive(inscriptionId)} download>
              <DownloadIcon aria-hidden="true" />
              Tout télécharger
            </a>
          }
        />
      </div>

      <Visionneuse
        inscriptionId={inscriptionId}
        pieces={liste}
        index={ouverte}
        onIndex={setOuverte}
      />
    </div>
  );
}

function CartePiece({ piece, onOuvrir }: { piece: PieceDeposee; onOuvrir: () => void }) {
  const statut = PIECE_STATUT_LABELS[piece.statut];
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
      >
        <FileTextIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-[600]">{piece.label}</span>
        <span className="block truncate text-[0.75rem] text-muted-foreground">
          {tailleEnFrancais(piece.taille)}
        </span>
      </span>
      {statut === undefined ? null : (
        <Badge variant={VARIANTES[piece.statut] ?? 'outline'}>{statut}</Badge>
      )}
    </button>
  );
}

/**
 * Le document occupe l'écran, et les flèches passent au suivant sans revenir à
 * la liste : un dossier se lit d'une traite. Le rendu est celui du navigateur,
 * qui sait déjà zoomer, imprimer et enregistrer un PDF comme une image.
 */
function Visionneuse({
  inscriptionId,
  pieces,
  index,
  onIndex,
}: {
  inscriptionId: string;
  pieces: PieceDeposee[];
  index: number | null;
  onIndex: (index: number | null) => void;
}) {
  useEffect(() => {
    if (index === null) return;
    const auClavier = (evenement: KeyboardEvent): void => {
      if (evenement.key === 'ArrowRight') onIndex(Math.min(index + 1, pieces.length - 1));
      if (evenement.key === 'ArrowLeft') onIndex(Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', auClavier);
    return () => {
      window.removeEventListener('keydown', auClavier);
    };
  }, [index, pieces.length, onIndex]);

  const piece = index === null ? undefined : pieces[index];
  if (piece === undefined || index === null) return null;

  return (
    <Dialog open={true} onOpenChange={(ouvert) => !ouvert && onIndex(null)}>
      <DialogContent
        className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none"
        showCloseButton={true}
      >
        <div className="flex min-w-0 items-center gap-3 pr-12">
          <DialogTitle className="min-w-0 flex-1 truncate">{piece.label}</DialogTitle>
          <span className="shrink-0 text-[0.75rem] text-muted-foreground tabular-nums">
            {index + 1} / {pieces.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Pièce précédente"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Pièce suivante"
            disabled={index === pieces.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            render={
              <a href={lienDeLaPiece(inscriptionId, piece.code)} download>
                <DownloadIcon aria-hidden="true" />
                Enregistrer
              </a>
            }
          />
        </div>
        <iframe
          key={piece.code}
          src={lienDeLaPiece(inscriptionId, piece.code)}
          title={piece.label}
          className="min-h-0 w-full flex-1 rounded-md border border-border bg-muted"
        />
      </DialogContent>
    </Dialog>
  );
}
