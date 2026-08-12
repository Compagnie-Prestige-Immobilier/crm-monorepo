import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
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
        Cette adresse ne correspond à aucun écran du panneau d’administration.
      </p>
      <Button asChild>
        <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
      </Button>
    </main>
  );
}
