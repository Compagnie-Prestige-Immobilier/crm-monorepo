'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, ExternalLinkIcon, LifeBuoyIcon, Loader2Icon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { IndiceCapture } from '@/components/layout/indice-capture';
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
import { rafraichirSignalements, SuiviSignalements } from '@/components/layout/suivi-signalements';
import { envoyerSignalement, lireCategoriesSupport } from '@/lib/data/support';
import { apiErrorText, toastApiError } from '@/lib/mutation-feedback';
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

// Le clavier ne bouge pas la souris : l'élément surligné reste celui à montrer.
function useRaccourcisDeCapture(actif: boolean, pieces: RefObject<PiecesJointesHandle | null>) {
  useEffect(() => {
    if (!actif) return;
    const surCapture = (event: KeyboardEvent) => {
      const touche = event.key.toLowerCase();
      if (!(event.metaKey || event.ctrlKey) || (touche !== 'k' && touche !== 'e')) return;
      event.preventDefault();
      void pieces.current?.capturer(touche === 'e');
    };
    window.addEventListener('keydown', surCapture);
    return () => window.removeEventListener('keydown', surCapture);
  }, [actif, pieces]);
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
  // La cle survit aux echecs reseau : le meme envoi retrouve son signalement
  // plutot que d'en creer un second.
  const [cle, setCle] = useState(() => crypto.randomUUID());
  const [images, setImages] = useState<Image[]>([]);
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState('');
  const [categorie, setCategorie] = useState('');
  const pieces = useRef<PiecesJointesHandle>(null);
  const cache = useQueryClient();
  useSurvolDeLaPage(ouvert);
  useRaccourcisDeCapture(ouvert, pieces);
  const categories = useQuery({
    queryKey: ['support', 'categories'],
    queryFn: lireCategoriesSupport,
    enabled: ouvert,
    staleTime: Infinity,
  });

  const envoi = useMutation({
    mutationFn: () =>
      envoyerSignalement(
        cle,
        { description: description.trim(), contexte: contexteDePage(ecran), urgence, categorie },
        images.map((image) => image.fichier),
      ),
    onSuccess: () => rafraichirSignalements(cache),
    onError: (error) => {
      toastApiError(error, "Le signalement n'est pas parti. Réessayez.");
    },
  });

  const ajouter = async (fichiers: File[]) => {
    const nouvelles = await imagesDepuis(fichiers);
    setImages((actuelles) => [...actuelles, ...nouvelles].slice(0, IMAGES_MAX));
  };

  // Le message, les images et la cle ne sont jetes qu'apres une reception
  // confirmee : un echec les garde pour la tentative suivante.
  const fermer = (suivant: boolean) => {
    if (suivant) return;
    setOuvert(false);
    if (!envoi.isSuccess) return;
    setDescription('');
    setImages([]);
    setCategorie('');
    setUrgence('');
    setCle(crypto.randomUUID());
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
      <IndiceCapture ouvert={ouvert} envoye={envoi.isSuccess} />
      <Sheet open={ouvert} onOpenChange={fermer} modal={false} disablePointerDismissal>
        <SheetContent side="right" voile={false} className="w-full sm:max-w-md pointer-events-auto">
          {envoi.isSuccess ? (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2Icon className="size-12 text-success" aria-hidden="true" />
                <SheetTitle>Signalement reçu.</SheetTitle>
                <SheetDescription>
                  La transmission au support se poursuit sans vous. Le numéro du ticket apparaît
                  ci-dessous.
                </SheetDescription>
                <Button className="mt-2" onClick={() => fermer(false)}>
                  Fermer
                </Button>
                {lienPlateforme}
              </div>
              <SuiviSignalements ouvert={ouvert} />
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
              {categories.isError ? (
                <p role="alert" className="text-[0.8125rem] text-destructive">
                  {apiErrorText(categories.error, 'Les catégories GLPI sont illisibles.')}
                </p>
              ) : null}
              <PiecesJointes
                ref={pieces}
                images={images}
                ajouter={ajouter}
                retirer={(id) => setImages((actuelles) => actuelles.filter((i) => i.id !== id))}
                masquerPanneau={(masque) => setOuvert(!masque)}
              />
              <SuiviSignalements ouvert={ouvert} />
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
