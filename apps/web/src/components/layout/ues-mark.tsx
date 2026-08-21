import { cn } from '@/lib/utils';

/**
 * Marque de l'Union des Enseignants du Sénégal : « UES » massif, filet bleu,
 * nom en toutes lettres. Posée sur le noir de la barre latérale, elle est
 * INVERSÉE : le « UES » du logo est noir sur blanc et disparaîtrait ici.
 */
export function UesMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn('flex flex-col', compact ? 'items-center gap-1' : 'gap-1.5')}>
      <span
        className={cn(
          'font-display font-[800] leading-none tracking-[0.08em] text-sidebar-primary',
          compact ? 'text-[1.0625rem]' : 'text-[1.5rem]',
        )}
      >
        UES
      </span>
      <span
        aria-hidden="true"
        className={cn('h-[3px] rounded-full bg-accent', compact ? 'w-7' : 'w-full')}
      />
      {compact ? null : (
        <span className="whitespace-nowrap text-[0.5625rem] font-[600] uppercase tracking-[0.08em] text-accent-on-dark">
          Union des Enseignants du Sénégal
        </span>
      )}
    </span>
  );
}
