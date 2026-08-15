import Link from 'next/link';

import { homePathForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/session';

/**
 * Page introuvable, avec une sortie qui EXISTE pour celui qui la lit.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le seul bouton menait à un écran réservé à l'ADMIN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Retour au tableau de bord » pointait sur `/tableau-de-bord` en dur. Pour un
 * agent BANQUE_FINANCE, la seule issue d'un 404 était donc un second cul-de-sac,
 * « Accès refusé », depuis lequel il fallait recommencer. Deux impasses
 * enchaînées à partir d'une simple faute de frappe dans une URL.
 *
 * `homePathForRole` est la même fonction qu'utilisent la racine (`app/page.tsx`)
 * et le refus de droits (`components/permission-denied.tsx`) : il n'existe qu'un
 * seul endroit où l'on décide de l'accueil d'un rôle.
 *
 * La session peut être absente (404 sur une URL publique, ou visiteur non
 * connecté) : on renvoie alors vers la connexion, ce qui est exact.
 */
export default async function NotFound() {
  const session = await getSession();
  const home = session === null ? '/connexion' : homePathForRole(session.role);

  return (
    /*
      `id="contenu-principal"` : le lien d'évitement du layout racine pointe sur
      cette ancre. Sans elle, l'utilisateur au clavier qui active « Aller au
      contenu » sur cette page ne va nulle part.
    */
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
      <Button asChild>
        <Link href={home}>{session === null ? 'Aller à la connexion' : 'Retour à l’accueil'}</Link>
      </Button>
    </main>
  );
}
