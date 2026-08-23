import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-6"
      role="status"
      aria-label="Chargement des espaces"
    >
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
