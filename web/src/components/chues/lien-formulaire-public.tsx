'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyIcon, MessageCircleIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { monLienFormulaireQuery, regenererMonLienFormulaire } from '@/lib/data/lien-formulaire';
import { lienFormulairePublic } from '@/lib/formulaire-public';

/**
 * Le lien du formulaire public, propre au compte qui le partage : la fiche
 * reçue lui revient, et l'avis d'arrivée aussi. Le jeton se régénère, ce qui
 * tue le lien partagé par erreur sans fermer le compte.
 */
export function LienFormulairePublic() {
  const client = useQueryClient();
  const jeton = useQuery(monLienFormulaireQuery());
  const rotation = useMutation({
    mutationFn: regenererMonLienFormulaire,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: monLienFormulaireQuery().queryKey });
      toast.success('Nouveau lien généré. L’ancien ne fonctionne plus.');
    },
    onError: () => {
      toast.error('Le lien n’a pas pu être régénéré.');
    },
  });

  if (jeton.data === undefined) return <Skeleton className="h-40 w-full" />;

  const lien = lienFormulairePublic(jeton.data.jeton);

  function copier(): void {
    if (!('clipboard' in navigator)) {
      toast.error('Copie indisponible dans ce navigateur.');
      return;
    }
    navigator.clipboard.writeText(lien).then(
      () => {
        toast.success('Lien d’auto-enrôlement copié.');
      },
      () => {
        toast.error('Copie refusée par le navigateur.');
      },
    );
  }

  const textePartage = `Bonjour, voici le lien pour compléter votre dossier d'adhésion CHUES : ${lien}`;
  const urlWhatsapp = `https://wa.me/?text=${encodeURIComponent(textePartage)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulaire public d'enrôlement</CardTitle>
        <CardDescription>
          Partagez votre lien personnel. Les fiches complétées par les prospects vous seront
          directement attribuées.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          readOnly
          value={lien}
          aria-label="Lien du formulaire public"
          className="font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={copier}>
            <CopyIcon className="size-4" aria-hidden="true" />
            Copier le lien
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={rotation.isPending}
            onClick={() => {
              rotation.mutate();
            }}
          >
            <RotateCcwIcon className="size-4" aria-hidden="true" />
            Générer un nouveau lien
          </Button>
          <a
            href={urlWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'default' })}
          >
            <MessageCircleIcon className="size-4" aria-hidden="true" />
            Partager sur WhatsApp
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
