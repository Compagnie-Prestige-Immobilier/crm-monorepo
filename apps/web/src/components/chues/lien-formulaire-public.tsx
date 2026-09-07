'use client';

import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * Le lien du formulaire public, propre au compte qui le partage : la fiche
 * reçue lui revient, et l'avis d'arrivée aussi.
 */
export function LienFormulairePublic({ lien }: { lien: string }) {
  function copier(): void {
    if (!('clipboard' in navigator)) {
      toast.error('Copie indisponible dans ce navigateur.');
      return;
    }
    navigator.clipboard.writeText(lien).then(
      () => {
        toast.success('Lien copié.');
      },
      () => {
        toast.error('Copie refusée par le navigateur.');
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulaire public</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input readOnly value={lien} aria-label="Lien du formulaire public" className="font-mono" />
        <Button type="button" variant="outline" onClick={copier} className="shrink-0">
          <CopyIcon className="size-4" aria-hidden="true" />
          Copier le lien
        </Button>
      </CardContent>
    </Card>
  );
}
