import { InfoIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

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
    <main id="contenu-principal" className="grid min-h-dvh lg:grid-cols-2">
      {/* Volet de marque : bordeaux CPI, logo inversé, or réservé aux
          accents décoratifs (jamais au texte — design.md §2.3). */}
      <section className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Image
          src="/brand/cpi-header.png"
          alt="CPI"
          width={489}
          height={200}
          priority
          className="h-10 w-auto"
        />
        <div className="max-w-md">
          <p className="font-display text-[clamp(1.625rem,3vw,2rem)] font-[800] leading-[1.15] tracking-[-0.02em] text-sidebar-accent-foreground">
            La prospection terrain, consolidée au siège.
          </p>
          <p className="mt-3 text-[0.9375rem] opacity-80">
            Représentants, prospects et activité des commerciaux — remontés depuis le terrain,
            filtrables et exportables.
          </p>
          <span aria-hidden="true" className="mt-6 block h-1 w-24 rounded-full bg-accent" />
        </div>
        {/* 4,39:1 à `opacity-60` : sous le seuil pour du 12 px. */}
        <p className="text-[0.75rem] opacity-70">
          CPI — Coopérative de Promotion Immobilière, Sénégal
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm animate-rise">
          <Image
            src="/brand/cpi-logo.png"
            alt="CPI GO"
            width={417}
            height={170}
            priority
            className="mb-8 h-10 w-auto lg:hidden"
          />
          <h1 className="font-display text-[clamp(1.625rem,3vw,2rem)] font-[800] tracking-[-0.02em]">
            Connexion
          </h1>
          <p className="mt-2 mb-8 text-[0.9375rem] text-muted-foreground">
            Panneau d’administration réservé au siège.
          </p>

          {expired ? (
            /* `status` et non `alert` : l'information est contextuelle, pas
               urgente, et `alert` interromprait la lecture du lecteur d'écran
               au moment où il annonce le formulaire. */
            <p
              role="status"
              className="mb-6 flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.8125rem] text-warning"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Votre session a expiré pour cause d’inactivité. Reconnectez-vous pour reprendre où
              vous en étiez.
            </p>
          ) : null}

          <LoginForm next={next} />

          <p className="mt-8 text-[0.75rem] text-muted-foreground">
            Les commerciaux se connectent depuis l’application mobile CPI GO.
          </p>
        </div>
      </section>
    </main>
  );
}
