import type { Metadata } from 'next';
import Image from 'next/image';

import { FormulaireDemande } from '@/app/demande/[jeton]/formulaire-demande';

export const metadata: Metadata = {
  title: 'Demande de rappel',
  robots: { index: false, follow: false },
};

/**
 * La seule page du panel ouverte sans compte.
 *
 * Elle n'interroge RIEN : ni le jeton, ni le numéro saisi. Un lien mort se
 * découvre à l'envoi, et non par une page qui dirait « ce conseiller existe ».
 */
export default async function DemandePubliquePage({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  // Clé publique du widget anti-robot. Absente, la page rend le formulaire sans
  // widget et l'API refuse l'envoi, sauf TURNSTILE_ALLOW_DEGRADED.
  const cleSite = process.env.TURNSTILE_SITE_KEY ?? '';

  return (
    <main id="contenu-principal" className="flex min-h-dvh justify-center bg-background px-6 py-12">
      <div className="animate-rise w-full max-w-[36rem]">
        <Image
          src="/brand/cpi-logo.png"
          alt="CPI GO"
          width={417}
          height={170}
          priority
          className="mb-10 h-11 w-auto"
        />

        <div className="rail">
          <h1 className="font-display text-h1 font-[800] tracking-[-0.025em]">
            Être rappelé par un conseiller
          </h1>
          <p className="mt-1.5 text-body text-muted-foreground">
            Laissez vos coordonnées, un conseiller CPI vous rappelle.
          </p>
        </div>

        <div className="mt-8">
          <FormulaireDemande jeton={jeton} cleSite={cleSite} />
        </div>

        <p className="mt-10 text-caption text-muted-foreground">
          Compagnie Prestige Immobilier, Sénégal
        </p>
      </div>
    </main>
  );
}
