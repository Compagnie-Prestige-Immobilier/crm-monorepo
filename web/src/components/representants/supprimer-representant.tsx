'use client';

import { ApiError } from '@crm/api-client/query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteRepresentant } from '@/lib/data/representants';

/**
 * La route existait sans bouton : un représentant créé par erreur restait dans
 * la base. Le serveur refuse en 409 tant que la fiche porte des prospects, et
 * c'est ce refus qui dit combien on emporterait en insistant.
 */
export function SupprimerRepresentant({ representantId }: { representantId: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [porte, setPorte] = useState<string | null>(null);

  const suppression = useMutation({
    mutationFn: (cascade: boolean) => deleteRepresentant(representantId, cascade),
    onSuccess: () => {
      void client.invalidateQueries();
      toast.success('Fiche supprimée.');
      void navigate({ to: '/chues/representants' });
    },
    onError: (erreur: unknown) => {
      if (erreur instanceof ApiError && erreur.status === 409) {
        setPorte(erreur.message);
        return;
      }
      setOuvert(false);
      toast.error(erreur instanceof Error ? erreur.message : 'La suppression a échoué.');
    },
  });

  function fermer(): void {
    setOuvert(false);
    setPorte(null);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start text-destructive hover:text-destructive"
        onClick={() => {
          setOuvert(true);
        }}
      >
        <Trash2Icon className="size-4" aria-hidden="true" />
        Supprimer la fiche
      </Button>

      <ConfirmDialog
        open={ouvert}
        onOpenChange={(suivant) => {
          if (!suivant) fermer();
        }}
        title={porte === null ? 'Supprimer cette fiche ?' : 'Cette fiche porte des prospects'}
        description={
          porte ??
          'La fiche sort des listes et des campagnes. Ses appels et son histoire restent consignés.'
        }
        confirmLabel={porte === null ? 'Supprimer' : 'Tout supprimer'}
        pending={suppression.isPending}
        onConfirm={() => {
          suppression.mutate(porte !== null);
        }}
      />
    </>
  );
}
