import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { FileQuestionIcon } from 'lucide-react';

import { meQueryOptions } from '@/api/auth';
import { PermissionDenied } from '@/components/permission-denied';
import { QueryErrorState } from '@/components/query-error-state';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefusPermission } from '@/lib/guard';
import { cn } from '@/lib/utils';

/** Un refus de rôle se rend dans la coque, comme en v1 ; le reste est une panne. */
export function EcranErreur({ error, reset }: { error: unknown; reset: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  if (error instanceof RefusPermission) return <PermissionDenied role={error.role} />;

  // `reset` seul rejoue la route sur le cache en échec : la requête doit repartir.
  const reessayer = (): void => {
    void queryClient.invalidateQueries();
    reset();
    void router.invalidate();
  };

  return (
    <QueryErrorState
      error={error}
      onRetry={reessayer}
      fallback="Le serveur est injoignable. Vérifiez votre connexion."
    />
  );
}

/** La coque n'est pas montée quand sa propre session échoue : l'erreur tient l'écran. */
export function EcranErreurPleinePage(props: { error: unknown; reset: () => void }) {
  return (
    <main id="contenu-principal" className="grid min-h-dvh place-items-center p-6">
      <EcranErreur {...props} />
    </main>
  );
}

export function EcranIntrouvable() {
  const { data: user } = useQuery(meQueryOptions);
  const connecte = user !== null && user !== undefined;

  return (
    <Card
      role="alert"
      className="animate-rise mx-auto max-w-lg items-center gap-3 px-6 py-16 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
      >
        <FileQuestionIcon className="size-6" />
      </span>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
        Page introuvable
      </h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">
        Cette adresse ne mène à aucun écran. Elle a pu être déplacée.
      </p>
      <Link
        to={connecte ? '/espaces' : '/connexion'}
        className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}
      >
        {connecte ? 'Tous les espaces' : 'Se connecter'}
      </Link>
    </Card>
  );
}
