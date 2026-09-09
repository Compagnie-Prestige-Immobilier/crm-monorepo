import { useQuery } from '@tanstack/react-query';

import { FormulaireDemande } from '@/components/demande/formulaire-demande';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchFormulairePublic } from '@/lib/data/formulaire-public';

const INDISPONIBLE =
  'Le formulaire est indisponible pour le moment. Rechargez la page dans un instant, ou appelez le conseiller qui vous a transmis ce lien.';

/**
 * La seule page du panneau ouverte sans compte.
 *
 * Elle ne lit AUCUNE fiche : ni le jeton, ni le numéro saisi, et ne pré-remplit
 * rien. Un lien mort se découvre à l'envoi, et non par une page qui dirait
 * « ce conseiller existe ».
 */
export function PageDemande({ jeton }: { jeton: string }) {
  const formulaire = useQuery({
    queryKey: ['formulaire-public'],
    queryFn: () => fetchFormulairePublic(),
    retry: false,
  });

  const champs = formulaire.data?.champs ?? [];

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

        {formulaire.isPending ? <Skeleton className="h-80 w-full" /> : null}

        {!formulaire.isPending && champs.length === 0 ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
          >
            {INDISPONIBLE}
          </p>
        ) : null}

        {formulaire.data !== undefined && champs.length > 0 ? (
          <FormulaireDemande
            jeton={jeton}
            cleSite={formulaire.data.turnstileSiteKey}
            formulaire={formulaire.data}
          />
        ) : null}

        <p className="mt-10 text-caption text-muted-foreground">
          Compagnie Prestige Immobilier, Sénégal
        </p>
      </div>
    </main>
  );
}
