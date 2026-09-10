import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { FormulaireDemande } from '@/components/demande/formulaire-demande';
import { getApiClient } from '@/lib/api/browser';
import type { FormulairePublic } from '@/lib/data/formulaire-public';

/** La seule page du panneau ouverte sans compte : la page `demande/[jeton]` de la v1. */
export const Route = createFileRoute('/demande/$jeton')({
  component: DemandePubliquePage,
});

/** Les champs réglés par l'administrateur (EB-27) ; l'API ajoute la clé publique du widget anti-robot. */
async function lireComposition(): Promise<
  (FormulairePublic & { turnstileSiteKey?: string }) | null
> {
  const { data, error } = await getApiClient().GET('/api/v1/formulaire-public/formulaire');
  if (error !== undefined || data === undefined) return null;
  return data;
}

function Indisponible() {
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
    >
      Le formulaire est indisponible pour le moment. Rechargez la page dans un instant, ou appelez
      le conseiller qui vous a transmis ce lien.
    </p>
  );
}

function DemandePubliquePage() {
  const { jeton } = Route.useParams();
  const composition = useQuery({ queryKey: ['formulaire-public'], queryFn: lireComposition });
  const formulaire = composition.data ?? null;
  const cleSite = formulaire?.turnstileSiteKey ?? '';
  let contenu = null;
  if (!composition.isPending) {
    contenu =
      formulaire === null || formulaire.champs.length === 0 ? (
        <Indisponible />
      ) : (
        <FormulaireDemande jeton={jeton} cleSite={cleSite} formulaire={formulaire} />
      );
  }

  return (
    <main id="contenu-principal" className="flex min-h-dvh justify-center bg-background px-6 py-12">
      <div className="animate-rise w-full max-w-[36rem]">
        <img
          src="/brand/cpi-logo.png"
          alt="CPI GO"
          width={417}
          height={170}
          className="mb-8 h-11 w-auto"
        />

        <h1 className="sr-only">Demande de rappel</h1>

        {contenu}

        <p className="mt-10 text-caption text-muted-foreground">
          Compagnie Prestige Immobilier, Sénégal
        </p>
      </div>
    </main>
  );
}
