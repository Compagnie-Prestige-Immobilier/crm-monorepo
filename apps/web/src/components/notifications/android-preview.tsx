'use client';

import { BellIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { previewClamp } from './template';

const TITLE_CLAMP = 42;
const BODY_CLAMP = 96;

function truncationMessage(titleTruncated: boolean, bodyTruncated: boolean): string | null {
  if (titleTruncated && bodyTruncated) return 'Titre et corps coupés une fois repliés.';
  if (titleTruncated) return 'Titre coupé une fois replié.';
  if (bodyTruncated) return 'Corps coupé une fois replié.';
  return null;
}

function TruncationNotice({
  titleTruncated,
  bodyTruncated,
}: {
  titleTruncated: boolean;
  bodyTruncated: boolean;
}) {
  const message = truncationMessage(titleTruncated, bodyTruncated);
  if (message === null) return null;
  return (
    <p role="status" className="text-warning">
      {message}
    </p>
  );
}

function RouteLine({ route }: { route?: string | null | undefined }) {
  if (route === null || route === undefined || route === '') {
    return <p>Sans lien : ouvre le centre de notifications.</p>;
  }
  return (
    <p>
      Ouvre <code className="font-mono text-foreground">{route}</code>.
    </p>
  );
}

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
  const shownBody = previewClamp(body === '' ? 'Corps du message' : body, BODY_CLAMP);
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
        <TruncationNotice
          titleTruncated={shownTitle.truncated}
          bodyTruncated={shownBody.truncated}
        />
        <RouteLine route={route} />
      </div>
    </figure>
  );
}
