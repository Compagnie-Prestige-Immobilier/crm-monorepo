import type { Metadata } from 'next';
import Image from 'next/image';

import { FormulaireDemande } from '@/app/demande/[jeton]/formulaire-demande';
import { API_PREFIX, serverApiOrigin } from '@/lib/api/config';
import type { FormulairePublic } from '@/lib/data/formulaire-public';

export const metadata: Metadata = {
  title: 'Demande de rappel',
  robots: { index: false, follow: false },
};

function estComposition(charge: unknown): charge is FormulairePublic {
  if (typeof charge !== 'object' || charge === null) return false;
  const { champs, libres, banques, syndicats, revenus } = charge as Record<string, unknown>;
  return [champs, libres, banques, syndicats, revenus].every((liste) => Array.isArray(liste));
}

/** Les champs réglés par l'administrateur (EB-27) : sans eux, aucun formulaire à rendre. */
async function lireComposition(): Promise<FormulairePublic | null> {
  try {
    const reponse = await fetch(`${serverApiOrigin()}${API_PREFIX}/formulaire-public/formulaire`, {
      cache: 'no-store',
    });
    if (!reponse.ok) return null;
    const charge: unknown = await reponse.json();
    return estComposition(charge) ? charge : null;
  } catch {
    return null;
  }
}

/**
 * La seule page du panel ouverte sans compte.
 *
 * Elle ne lit AUCUNE fiche : ni le jeton, ni le numéro saisi, et ne pré-remplit
 * rien. Un lien mort se découvre à l'envoi, et non par une page qui dirait
 * « ce conseiller existe ».
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
  const composition = await lireComposition();

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
          {composition === null || composition.champs.length === 0 ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
            >
              Le formulaire est indisponible pour le moment. Rechargez la page dans un instant, ou
              appelez le conseiller qui vous a transmis ce lien.
            </p>
          ) : (
            <FormulaireDemande jeton={jeton} cleSite={cleSite} formulaire={composition} />
          )}
        </div>

        <p className="mt-10 text-caption text-muted-foreground">
          Compagnie Prestige Immobilier, Sénégal
        </p>
      </div>
    </main>
  );
}
