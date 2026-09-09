import { Link } from '@tanstack/react-router';
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react';

import { CATEGORIES, type EvenementHistorique } from '@/components/historique/evenement';
import { buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime } from '@/lib/format';
import { lien } from '@/lib/nav';
import { cn } from '@/lib/utils';

function PiedDeVolet({ evenement }: { evenement: EvenementHistorique }) {
  const cible = evenement.lien ?? null;
  if (cible === null && evenement.action === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
      {cible === null ? null : (
        <Link {...lien(cible.href)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ExternalLinkIcon aria-hidden="true" />
          {cible.label}
        </Link>
      )}
      {evenement.action}
    </div>
  );
}

export function VoletEvenement({
  evenement,
  onClose,
}: {
  evenement: EvenementHistorique | null;
  onClose: () => void;
}) {
  const categorie = evenement === null ? null : CATEGORIES[evenement.categorie];
  const Icone = categorie?.icone ?? FileTextIcon;

  return (
    <Sheet
      open={evenement !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <SheetContent className="sm:max-w-md">
        {evenement === null || categorie === null ? null : (
          <>
            <SheetHeader className="border-b border-border pr-14">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full',
                    categorie.teinte,
                  )}
                >
                  <Icone className="size-3.5" />
                </span>
                <span className="eyebrow text-muted-foreground">{categorie.label}</span>
              </span>
              <SheetTitle>{evenement.titre}</SheetTitle>
              <SheetDescription>
                <time dateTime={evenement.at} className="tabular-nums">
                  {formatDateTime(evenement.at)}
                </time>{' '}
                · {evenement.acteur}
                {evenement.source === null || evenement.source === undefined
                  ? ''
                  : ` · ${evenement.source}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex grow flex-col gap-4 overflow-y-auto p-4 text-[0.875rem]">
              {evenement.detail}
            </div>
            <PiedDeVolet evenement={evenement} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
