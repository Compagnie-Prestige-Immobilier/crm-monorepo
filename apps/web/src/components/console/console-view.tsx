'use client';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ConsoleView({ projet }: { projet?: 'CHUES' | 'GRAND_PUBLIC' }) {
  const href = projet === 'GRAND_PUBLIC' ? '/grand-public/prospects' : '/chues/prospects';
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h1 className="font-display text-h1 font-[800]">Rechercher une fiche</h1>
      <p className="max-w-2xl text-muted-foreground">
        Les fiches sont consultées librement. Ouvrez l’annuaire pour chercher un prospect et
        consigner l’appel.
      </p>
      <Link className={cn(buttonVariants({ size: 'default' }), 'self-start')} href={href}>
        Ouvrir l’annuaire
      </Link>
    </section>
  );
}
