'use client';

import { unwrap } from '@crm/api-client/query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, ExternalLinkIcon, LifeBuoyIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  IMAGES_MAX,
  imagesDepuis,
  PiecesJointes,
  type Image,
  type PiecesJointesHandle,
} from '@/components/layout/pieces-jointes';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Choix {
  value: string;
  label: string;
}

const URGENCES: Choix[] = [
  { value: '2', label: 'Urgence basse' },
  { value: '3', label: 'Urgence moyenne' },
  { value: '4', label: 'Urgence haute' },
];

function contexteDePage(ecran: string): string {
  return [
    `Écran : ${ecran}`,
    `Adresse : ${window.location.href}`,
    `Fenêtre : ${String(window.innerWidth)} × ${String(window.innerHeight)}`,
    `Navigateur : ${navigator.userAgent}`,
    `Heure : ${new Date().toLocaleString('fr-FR')}`,
  ].join('\n');
}

async function envoyerTicket(champs: Record<string, string>, images: Image[]) {
  const form = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) form.append(nom, valeur);
  for (const image of images) form.append('images', image.fichier);
  return unwrap(
    await getApiClient().POST('/api/v1/support/tickets', {
      body: { description: '', contexte: '', images: [], urgence: 3, categorie: 1 },
      bodySerializer: () => form,
    }),
  );
}

async function lireCategories(): Promise<Choix[]> {
  const categories = unwrap(await getApiClient().GET('/api/v1/support/categories'));
  return categories.map((c) => ({ value: String(c.id), label: c.nom }));
}

function Choisir({
  libelle,
  choix,
  valeur,
  changer,
}: {
  libelle: string;
  choix: Choix[];
  valeur: string;
  changer: (valeur: string) => void;
}) {
  return (
    <Select
      items={choix}
      value={valeur === '' ? null : valeur}
      onValueChange={(v) => changer(v ?? valeur)}
    >
      <SelectTrigger aria-label={libelle}>
        <SelectValue placeholder={libelle} />
      </SelectTrigger>
      <SelectContent>
        {choix.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Le panneau reste ouvert et non modal : la page derrière répond aux clics et
// au survol, pour que le signalant montre l'écran fautif sans perdre son message.
function useSurvolDeLaPage(actif: boolean) {
  useEffect(() => {
    if (!actif) return;
    let survole: Element | null = null;
    const marquer = (event: MouseEvent) => {
      const cible = event.target;
      if (!(cible instanceof Element) || cible.closest('[data-slot="sheet-content"]')) return;
      survole?.classList.remove('cpi-survol-signale');
      survole = cible;
      cible.classList.add('cpi-survol-signale');
    };
    const oublier = () => {
      survole?.classList.remove('cpi-survol-signale');
      survole = null;
    };
    document.addEventListener('mouseover', marquer);
    document.addEventListener('mouseleave', oublier);
    return () => {
      document.removeEventListener('mouseover', marquer);
      document.removeEventListener('mouseleave', oublier);
      oublier();
    };
  }, [actif]);
}

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
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState('');
  const [categorie, setCategorie] = useState('');
  const pieces = useRef<PiecesJointesHandle>(null);
  useSurvolDeLaPage(ouvert);
  useEffect(() => {
    if (!ouvert) return;
    const surCapture = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        void pieces.current?.capturer();
      }
    };
    window.addEventListener('keydown', surCapture);
    return () => window.removeEventListener('keydown', surCapture);
  }, [ouvert]);
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
    const nouvelles = await imagesDepuis(fichiers);
    setImages((actuelles) => [...actuelles, ...nouvelles].slice(0, IMAGES_MAX));
  };

  const fermer = (suivant: boolean) => {
    if (suivant) return;
    setOuvert(false);
    if (!envoi.isSuccess) return;
    setDescription('');
    setImages([]);
    setCategorie('');
    setUrgence('');
    envoi.reset();
  };

  const lienPlateforme = plateforme ? <LienPlateforme /> : null;
  const listeCategories = categories.data ?? [];
  const envoyable =
    description.trim().length >= 3 && urgence !== '' && categorie !== '' && !envoi.isPending;
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
        onClick={() => setOuvert(true)}
      >
        <LifeBuoyIcon className="size-5" aria-hidden="true" />
      </Button>
      <Sheet open={ouvert} onOpenChange={fermer} modal={false} disablePointerDismissal>
        <SheetContent side="right" voile={false} className="w-full sm:max-w-md pointer-events-auto">
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
                aria-label="Ce qui ne va pas"
                placeholder="Ce qui ne va pas, ce que vous attendiez"
                className="min-h-32"
                value={description}
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) envoyer();
                }}
                onPaste={(event) => void ajouter([...event.clipboardData.files])}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void ajouter([...event.dataTransfer.files]);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Choisir libelle="Urgence" choix={URGENCES} valeur={urgence} changer={setUrgence} />
                <Choisir
                  libelle="Catégorie"
                  choix={listeCategories}
                  valeur={categorie}
                  changer={setCategorie}
                />
              </div>
              {categories.isSuccess && listeCategories.length === 0 ? (
                <p role="alert" className="text-[0.8125rem] text-destructive">
                  Les catégories GLPI sont illisibles. Prévenez l'administrateur.
                </p>
              ) : null}
              <PiecesJointes
                images={images}
                ajouter={ajouter}
                retirer={(id) => setImages((actuelles) => actuelles.filter((i) => i.id !== id))}
                masquerPanneau={(masque) => setOuvert(!masque)}
              />
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
