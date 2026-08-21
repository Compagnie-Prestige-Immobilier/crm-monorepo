import Link from 'next/link';

import { homePathForRole } from '@/components/layout/nav-items';
import { buttonVariants } from '@/components/ui/button';
import { getSession } from '@/lib/session';

export default async function NotFound() {
  const session = await getSession();
  const home = session === null ? '/connexion' : homePathForRole(session.role);

  return (
    <main
      id="contenu-principal"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"
    >
      {/* Un `<h1>`, pas un `<p>` maquillé en titre : c'est le titre de la page,
          et le document ne doit pas commencer sans niveau 1. */}
      <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-[800] tracking-[-0.02em]">
        Page introuvable
      </h1>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">
        Cette adresse ne correspond à aucun écran du panel.
      </p>
      {/* Un LIEN habillé en bouton, pas un bouton : la primitive `Button` de
          Base UI poserait `role="button"` sur le `<a>` et lui retirerait sa
          sémantique de lien. Seule la peau est empruntée. */}
      <Link href={home} className={buttonVariants()}>
        {session === null ? 'Aller à la connexion' : 'Revenir aux espaces'}
      </Link>
    </main>
  );
}
