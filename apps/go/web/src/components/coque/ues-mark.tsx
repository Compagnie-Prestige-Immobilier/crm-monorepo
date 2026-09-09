import { cn } from '@/lib/utils';

export function UesMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn('flex flex-col', compact ? 'items-center gap-1' : 'gap-1.5')}>
      <span
        className={cn(
          'font-display font-[800] leading-none tracking-[0.08em] text-sidebar-primary',
          compact ? 'text-[1.0625rem]' : 'text-[1.5rem]',
        )}
      >
        CHUES
      </span>
      <span
        aria-hidden="true"
        className={cn('h-[3px] rounded-full bg-accent', compact ? 'w-7' : 'w-full')}
      />
    </span>
  );
}
