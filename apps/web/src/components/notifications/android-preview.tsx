'use client';

import { BellIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { previewClamp } from './template';

/**
 * Aperçu en direct de la notification Android.
 *
 * POURQUOI CET ÉCRAN EXISTE : un compositeur sans aperçu produit des
 * notifications que personne n'a relues. Le titre part sur une ligne, le corps
 * sur deux ; l'auteur qui rédige dans un `<textarea>` de six lignes n'a aucune
 * idée de l'endroit où sa phrase sera coupée, et l'apprend en le lisant sur son
 * propre téléphone, après l'envoi à 400 personnes.
 *
 * L'aperçu reproduit donc la CONTRAINTE, pas seulement le style : mêmes
 * troncatures qu'une notification repliée, même hiérarchie (nom de
 * l'application, titre, corps), même horodatage.
 *
 * Ce n'est pas un rendu fidèle au pixel d'une ROM Android donnée — il n'y en a
 * pas deux identiques. C'est un modèle honnête des limites communes à toutes.
 */

/** Longueurs au-delà desquelles Android replie. Mesurées sur un écran 360 dp. */
const TITLE_CLAMP = 42;
const BODY_CLAMP = 96;

export function AndroidPreview({
  title,
  body,
  route,
  className,
}: {
  title: string;
  body: string;
  route?: string | null | undefined;
  className?: string | undefined;
}) {
  const shownTitle = previewClamp(title === '' ? 'Titre de la notification' : title, TITLE_CLAMP);
  const shownBody = previewClamp(
    body === '' ? 'Le corps du message apparaîtra ici.' : body,
    BODY_CLAMP,
  );
  const isPlaceholder = title === '' && body === '';

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="text-[0.75rem] font-[600] text-muted-foreground">
        Aperçu sur Android
      </figcaption>

      {/* Fond sombre : une notification s'affiche sur l'écran de verrouillage,
          pas sur le fond clair du panel. Le contraste jugé ici doit être celui
          que l'utilisateur verra. */}
      <div className="rounded-[var(--radius-lg)] bg-[#241016] p-3 shadow-elev-md">
        <div
          className={cn(
            'rounded-[var(--radius-md)] bg-[#f4eef0] p-3 text-[#1c0810]',
            isPlaceholder && 'opacity-70',
          )}
        >
          <div className="flex items-center gap-1.5 text-[0.6875rem] text-[#6b4a52]">
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <BellIcon className="size-2.5" />
            </span>
            <span className="font-[600]">CPI GO</span>
            <span aria-hidden="true">·</span>
            <span>maintenant</span>
            <ChevronRightIcon aria-hidden="true" className="ml-auto size-3.5 rotate-90" />
          </div>

          <p className="mt-1.5 text-[0.875rem] font-[600] break-words">{shownTitle.text}</p>
          <p className="mt-0.5 text-[0.8125rem] leading-[1.35] break-words text-[#3d222a]">
            {shownBody.text}
          </p>
        </div>
      </div>

      {/* Deux informations que l'auteur ne peut deviner autrement : ce qui sera
          coupé, et où le tap conduira. */}
      <div className="flex flex-col gap-1 text-[0.75rem] text-muted-foreground">
        {shownTitle.truncated || shownBody.truncated ? (
          <p role="status" className="text-warning">
            {shownTitle.truncated && shownBody.truncated
              ? 'Le titre et le corps seront coupés tant que la notification n’est pas dépliée.'
              : shownTitle.truncated
                ? 'Le titre sera coupé sur l’écran de verrouillage.'
                : 'Le corps sera coupé tant que la notification n’est pas dépliée.'}
          </p>
        ) : null}
        <p>
          {route === null || route === undefined || route === '' ? (
            'Sans lien : le tap ouvre le centre de notifications.'
          ) : (
            <>
              Le tap ouvre <code className="font-mono text-foreground">{route}</code>.
            </>
          )}
        </p>
      </div>
    </figure>
  );
}
