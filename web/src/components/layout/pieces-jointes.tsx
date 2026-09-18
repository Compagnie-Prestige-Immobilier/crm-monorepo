'use client';

import { ImagePlusIcon, ScreenShareIcon, XIcon } from 'lucide-react';
import { forwardRef, useImperativeHandle, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const IMAGES_MAX = 5;

export interface Image {
  id: string;
  fichier: File;
  apercu: string;
}

const attendre = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const captureDisponible = (): boolean =>
  typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia !== undefined;

// Le partage d'onglet est natif : instantané et fidèle, là où rendre le DOM en image fige les pages chargées.
async function capturerOnglet(): Promise<File | null> {
  const options = { video: { displaySurface: 'browser' }, preferCurrentTab: true };
  const flux = await navigator.mediaDevices.getDisplayMedia(options as DisplayMediaStreamOptions);
  try {
    const video = document.createElement('video');
    video.srcObject = flux;
    video.muted = true;
    await video.play();
    await attendre(300);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    return blob === null ? null : new File([blob], 'capture.png', { type: 'image/png' });
  } finally {
    for (const piste of flux.getTracks()) piste.stop();
  }
}

const lireApercu = (fichier: File) =>
  new Promise<string>((resolve) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(typeof lecteur.result === 'string' ? lecteur.result : '');
    lecteur.readAsDataURL(fichier);
  });

export const imagesDepuis = (fichiers: File[]): Promise<Image[]> =>
  Promise.all(
    fichiers
      .filter((f) => f.type.startsWith('image/'))
      .map(async (fichier) => ({
        id: crypto.randomUUID(),
        fichier,
        apercu: await lireApercu(fichier),
      })),
  );

export interface PiecesJointesHandle {
  capturer: () => Promise<void>;
}

export const PiecesJointes = forwardRef<
  PiecesJointesHandle,
  {
    images: Image[];
    ajouter: (fichiers: File[]) => Promise<void>;
    retirer: (id: string) => void;
    masquerPanneau: (masque: boolean) => void;
  }
>(function PiecesJointes({ images, ajouter, retirer, masquerPanneau }, ref) {
  const [capture, setCapture] = useState(false);
  const complet = images.length >= IMAGES_MAX;

  const capturer = async () => {
    if (complet || capture) return;
    setCapture(true);
    masquerPanneau(true);
    await attendre(250);
    try {
      const fichier = await capturerOnglet();
      if (fichier !== null) await ajouter([fichier]);
    } catch {
      // Refus ou annulation du partage : le panneau revient tel quel.
    } finally {
      setCapture(false);
      masquerPanneau(false);
    }
  };

  useImperativeHandle(ref, () => ({ capturer }));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {captureDisponible() ? (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={complet || capture}
            onClick={() => void capturer()}
          >
            <ScreenShareIcon className="size-4" aria-hidden="true" />
            Capturer l'écran
          </Button>
        ) : null}
        <label
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'cursor-pointer gap-1.5',
            complet && 'pointer-events-none opacity-50',
          )}
        >
          <ImagePlusIcon className="size-4" aria-hidden="true" />
          Ajouter des images
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={complet}
            onChange={(event) => {
              void ajouter([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      {images.length === 0 ? null : (
        <ul className="grid grid-cols-2 gap-2">
          {images.map((image) => (
            <li key={image.id} className="relative overflow-hidden rounded-md border border-border">
              <img src={image.apercu} alt="" className="h-28 w-full object-cover object-top" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-8"
                aria-label="Retirer l'image"
                onClick={() => retirer(image.id)}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
});
