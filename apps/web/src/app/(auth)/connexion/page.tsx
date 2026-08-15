import { InfoIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { Facade } from '@/app/(auth)/connexion/facade';
import { LoginForm } from '@/app/(auth)/connexion/login-form';
import { homePathForRole } from '@/components/layout/nav-items';
import { SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE } from '@/lib/api/session-expiry';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Connexion',
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Un administrateur déjà connecté n'a rien à faire sur ce formulaire.
  const session = await getSession();
  if (session !== null) redirect(homePathForRole(session.role));

  const params = await searchParams;
  const expired = params[SESSION_EXPIRED_PARAM] === SESSION_EXPIRED_VALUE;

  /**
   * Écran d'origine, pour y revenir après reconnexion. Restreint à un chemin
   * interne : une URL absolue placée dans `?suite=` transformerait l'écran de
   * connexion en tremplin de redirection ouverte, c'est-à-dire en page
   * d'hameçonnage hébergée sur notre propre domaine.
   */
  const rawNext = params['suite'];
  const candidate = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const next =
    typeof candidate === 'string' && /^\/(?!\/)[^\\]*$/.test(candidate) ? candidate : null;

  return (
    <main id="contenu-principal" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Volet de marque : bordeaux CPI, logo inversé, or réservé au MARQUAGE
          (le filet), jamais au texte : design.md §2.3.

          Le contenu est GROUPÉ en bas de colonne plutôt qu'étalé en
          `justify-between` : réparti sur toute la hauteur, il laissait deux
          vides de 300 px et l'écran paraissait inachevé. */}
      <section className="relative hidden flex-col justify-center overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex">
        <Facade />

        {/* `self-start` est OBLIGATOIRE. Dans une colonne flex, un enfant en
            `width:auto` est étiré par `align-items: stretch` : le logotype
            était rendu en 640×40 pour un fichier 489×200, soit une
            déformation horizontale de 6,5×. C'est ce qui le rendait
            illisible, pas son contraste. */}
        <Image
          src="/brand/cpi-header.png"
          alt="CPI"
          width={489}
          height={200}
          priority
          className="absolute left-12 top-12 h-12 w-auto self-start"
        />

        {/* Le volet nomme l'outil et ce qu'il tient. Une ligne, des noms : ni
            argumentaire, ni mode d'emploi. */}
        <div className="max-w-lg">
          <p className="font-display text-[clamp(2.5rem,5vw,3.75rem)] font-[800] leading-[0.95] tracking-[-0.035em] text-sidebar-accent-foreground">
            CPI GO
          </p>
          <p className="mt-5 text-body-xl text-sidebar-foreground">
            Prospects, campagnes d’appels et dossiers bancaires.
          </p>
        </div>

        {/* Logo et mention légale sont SORTIS du flux : le bloc d'identité se
            centre alors sur la même ligne d'horizon que le formulaire d'en
            face. En flux, `justify-between` les écartait aux deux extrémités
            et laissait 550 px de bordeaux vide au milieu. */}
        <p className="absolute inset-x-12 bottom-12 text-caption text-sidebar-foreground">
          Compagnie Prestige Immobilier, Sénégal
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="animate-rise w-full max-w-[26rem]">
          <Image
            src="/brand/cpi-logo.png"
            alt="CPI GO"
            width={417}
            height={170}
            priority
            className="mb-10 h-11 w-auto lg:hidden"
          />

          <div className="rail">
            <h1 className="font-display text-h1 font-[800] tracking-[-0.025em]">Connexion</h1>
            <p className="mt-1.5 text-body text-muted-foreground">Panneau d’administration</p>
          </div>

          {expired ? (
            /* `status` et non `alert` : l'information est contextuelle, pas
               urgente, et `alert` interromprait la lecture du lecteur d'écran
               au moment où il annonce le formulaire. */
            <p
              role="status"
              className="mt-8 flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3.5 py-3 text-small text-warning"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Session expirée. Reconnectez-vous.
            </p>
          ) : null}

          <div className="mt-8">
            <LoginForm next={next} />
          </div>

          <p className="mt-10 border-t border-border pt-5 text-caption text-muted-foreground">
            Les téléconseillers se connectent depuis l’application mobile.
          </p>
        </div>
      </section>
    </main>
  );
}
