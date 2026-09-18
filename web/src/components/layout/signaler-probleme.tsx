'use client';

import { unwrap } from '@crm/api-client/query';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  ImagePlusIcon,
  LifeBuoyIcon,
  Loader2Icon,
  ScreenShareIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { getApiClient } from '@/lib/api/browser';
import { toastApiError } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';

const IMAGES_MAX = 5;

interface Image {
  id: string;
  fichier: File;
  apercu: string;
}

const captureDisponible = (): boolean =>
  typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia !== undefined;

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

function contexteDePage(ecran: string): string {
  return [
    `Écran : ${ecran}`,
    `Adresse : ${window.location.href}`,
    `Fenêtre : ${String(window.innerWidth)} × ${String(window.innerHeight)}`,
    `Navigateur : ${navigator.userAgent}`,
    `Heure : ${new Date().toLocaleString('fr-FR')}`,
  ].join('\n');
}

const URGENCES = [
  { value: '2', label: 'Basse' },
  { value: '3', label: 'Moyenne' },
  { value: '4', label: 'Haute' },
];

async function envoyerTicket(champs: Record<string, string>, images: Image[]) {
  const form = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) form.append(nom, valeur);
  for (const image of images) form.append('images', image.fichier);
  return unwrap(
    await getApiClient().POST('/api/v1/support/tickets', {
      body: { description: '', contexte: '', images: [] },
      bodySerializer: () => form,
    }),
  );
}

const lireCategories = async () => unwrap(await getApiClient().GET('/api/v1/support/categories'));

function LienPlateforme() {
  return (
    <a
      href="/api/v1/auth/glpi/ouvrir"
      target="_blank"
      rel="noopener"
      className={cn(buttonVariants({ variant: 'ghost' }), 'gap-1.5')}
    >
      Ouvrir la plateforme de support
      <ExternalLinkIcon className="size-4" aria-hidden="true" />
    </a>
  );
}

export function SignalerProbleme({ ecran, plateforme }: { ecran: string; plateforme: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [images, setImages] = useState<Image[]>([]);
  const [capture, setCapture] = useState(false);
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState('3');
  const [categorie, setCategorie] = useState('0');
  const categories = useQuery({
    queryKey: ['support', 'categories'],
    queryFn: lireCategories,
    enabled: ouvert,
    staleTime: Infinity,
  });

  const envoi = useMutation({
    mutationFn: () =>
      envoyerTicket(
        { description: description.trim(), contexte: contexteDePage(ecran), urgence, categorie },
        images,
      ),
    onError: (error) => {
      toastApiError(error, "Le ticket n'est pas parti. Réessayez.");
    },
  });

  const ajouter = async (fichiers: File[]) => {
    const retenus = fichiers.filter((f) => f.type.startsWith('image/'));
    const nouvelles = await Promise.all(
      retenus.map(async (fichier) => ({
        id: crypto.randomUUID(),
        fichier,
        apercu: await lireApercu(fichier),
      })),
    );
    setImages((actuelles) => [...actuelles, ...nouvelles].slice(0, IMAGES_MAX));
  };

  const capturer = async () => {
    setCapture(true);
    setOuvert(false);
    await attendre(250);
    try {
      const fichier = await capturerOnglet();
      if (fichier !== null) await ajouter([fichier]);
    } catch {
      // Refus ou annulation du partage : le panneau revient tel quel.
    } finally {
      setCapture(false);
      setOuvert(true);
    }
  };

  const fermer = (suivant: boolean) => {
    if (suivant) return;
    setOuvert(false);
    if (!envoi.isSuccess) return;
    setDescription('');
    setImages([]);
    setCategorie('0');
    envoi.reset();
  };

  const listeCategories = [
    { value: '0', label: 'Sans catégorie' },
    ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.nom })),
  ];
  if (listeCategories.length === 1) listeCategories.pop();
  const lienPlateforme = plateforme ? <LienPlateforme /> : null;
  const complet = images.length >= IMAGES_MAX;
  const envoyable = description.trim().length >= 3 && !envoi.isPending;
  const envoyer = () => {
    if (envoyable) envoi.mutate();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Signaler un problème"
        title="Signaler un problème"
        disabled={capture}
        onClick={() => setOuvert(true)}
      >
        <LifeBuoyIcon className="size-5" aria-hidden="true" />
      </Button>
      <Sheet open={ouvert} onOpenChange={fermer}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {envoi.isSuccess ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <CheckCircle2Icon className="size-12 text-success" aria-hidden="true" />
              <SheetTitle>Ticket n° {envoi.data.numero} envoyé</SheetTitle>
              <SheetDescription>Le support vous répondra dans GLPI.</SheetDescription>
              <Button className="mt-2" onClick={() => fermer(false)}>
                Fermer
              </Button>
              {lienPlateforme}
            </div>
          ) : (
            <form
              className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0"
              onSubmit={(event) => {
                event.preventDefault();
                envoyer();
              }}
            >
              <SheetHeader className="px-0">
                <SheetTitle>Signaler un problème</SheetTitle>
                <SheetDescription>
                  La page ouverte part avec votre message. Collez ou déposez vos images dans le
                  message.
                </SheetDescription>
              </SheetHeader>
              <Textarea
                onPaste={(event) => void ajouter([...event.clipboardData.files])}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void ajouter([...event.dataTransfer.files]);
                }}
                aria-label="Ce qui ne va pas"
                placeholder="Ce qui ne va pas, ce que vous attendiez"
                className="min-h-32"
                value={description}
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) envoyer();
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  items={URGENCES}
                  value={urgence}
                  onValueChange={(v) => setUrgence(v ?? '3')}
                >
                  <SelectTrigger aria-label="Urgence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        Urgence {u.label.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {listeCategories.length === 0 ? null : (
                  <Select
                    items={listeCategories}
                    value={categorie}
                    onValueChange={(v) => setCategorie(v ?? '0')}
                  >
                    <SelectTrigger aria-label="Catégorie">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {listeCategories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
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
                    <li
                      key={image.id}
                      className="relative overflow-hidden rounded-md border border-border"
                    >
                      <img
                        src={image.apercu}
                        alt=""
                        className="h-28 w-full object-cover object-top"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute top-1 right-1 size-8"
                        aria-label="Retirer l'image"
                        onClick={() =>
                          setImages((actuelles) => actuelles.filter((i) => i.id !== image.id))
                        }
                      >
                        <XIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="submit" className="mt-auto h-12" disabled={!envoyable}>
                {envoi.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Envoyer au support
              </Button>
              {lienPlateforme}
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
