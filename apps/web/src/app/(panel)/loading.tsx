import { Skeleton } from '@/components/ui/skeleton';

/**
 * Repli de navigation COMMUN à tout le panel.
 *
 * `layout.tsx` force le rendu dynamique : chaque écran attend le serveur. Sans
 * cette frontière, la plupart des navigations laissaient la page précédente
 * figée, sans rien qui dise que quelque chose se passe. Les segments qui ont
 * leur propre `loading.tsx` gardent le leur.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
