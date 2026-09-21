'use client';

import { CropIcon, ImagePlusIcon, ScreenShareIcon, XIcon } from 'lucide-react';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import ReactCrop, { convertToPixelCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import {
  captureDisponible,
  RACCOURCI_ECRAN,
  RACCOURCI_ZONE,
  Touche,
  zoneSurlignee,
} from '@/components/layout/indice-capture';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const CAPTURES = [
  { zone: false, Icone: ScreenShareIcon, libelle: "Capturer l'écran", raccourci: RACCOURCI_ECRAN },
  { zone: true, Icone: CropIcon, libelle: 'Capturer une zone', raccourci: RACCOURCI_ZONE },
];

export interface PiecesJointesHandle {
  capturer: (zone?: boolean) => Promise<void>;
}

async function recadrer(image: HTMLImageElement, zone: PixelCrop): Promise<File | null> {
  const ratio = image.naturalWidth / image.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(zone.width * ratio);
  canvas.height = Math.round(zone.height * ratio);
  canvas
    .getContext('2d')
    ?.drawImage(
      image,
      zone.x * ratio,
      zone.y * ratio,
      zone.width * ratio,
      zone.height * ratio,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  return blob === null ? null : new File([blob], 'capture.png', { type: 'image/png' });
}

function RecadrageDialog({
  image,
  depart,
  ajouter,
  fermer,
}: {
  image: Image | null;
  depart: Crop | undefined;
  ajouter: (fichiers: File[]) => Promise<void>;
  fermer: () => void;
}) {
  const [zone, setZone] = useState<Crop | undefined>(depart);
  const source = useRef<HTMLImageElement>(null);
  const valide = zone !== undefined && zone.width > 1 && zone.height > 1;

  const garder = async () => {
    if (source.current === null || !valide) return;
    const fichier = await recadrer(
      source.current,
      convertToPixelCrop(zone, source.current.width, source.current.height),
    );
    if (fichier !== null) await ajouter([fichier]);
    fermer();
  };

  return (
    <Dialog
      open={image !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) fermer();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choisir la zone</DialogTitle>
          <DialogDescription>Tracez un rectangle autour de ce qui pose problème.</DialogDescription>
        </DialogHeader>
        {image === null ? null : (
          <ReactCrop
            {...(zone === undefined ? {} : { crop: zone })}
            onChange={(pixels) => {
              setZone(pixels);
            }}
            className="max-h-[60dvh] justify-self-center"
          >
            <img
              ref={source}
              src={image.apercu}
              alt="Capture de l'écran"
              className="max-h-[60dvh]"
            />
          </ReactCrop>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={fermer}>
            Annuler
          </Button>
          <Button type="button" disabled={!valide} onClick={() => void garder()}>
            Joindre la zone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [aRecadrer, setARecadrer] = useState<Image | null>(null);
  const [depart, setDepart] = useState<Crop>();
  const complet = images.length >= IMAGES_MAX;

  const capturer = async (zone = false) => {
    if (complet || capture) return;
    setDepart(zone ? zoneSurlignee() : undefined);
    setCapture(true);
    masquerPanneau(true);
    await attendre(250);
    try {
      const fichier = await capturerOnglet();
      if (fichier === null) return;
      if (zone) setARecadrer((await imagesDepuis([fichier]))[0] ?? null);
      else await ajouter([fichier]);
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
        {captureDisponible()
          ? CAPTURES.map(({ zone, Icone, libelle, raccourci }) => (
              <Button
                key={libelle}
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={complet || capture}
                onClick={() => void capturer(zone)}
              >
                <Icone className="size-4" aria-hidden="true" />
                {libelle}
                <Touche>{raccourci}</Touche>
              </Button>
            ))
          : null}
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
      <RecadrageDialog
        key={aRecadrer?.id ?? 'aucune'}
        image={aRecadrer}
        depart={depart}
        ajouter={ajouter}
        fermer={() => {
          setARecadrer(null);
        }}
      />
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
