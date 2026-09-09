import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  creerEntreeReferentiel,
  libelle,
  modifierEntreeReferentiel,
  type ReferentielItem,
} from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const CODE_VALIDE = /^[A-Z0-9_]{2,48}$/u;

function verifier(code: string, label: string, edition: boolean): Partial<Record<string, string>> {
  const erreurs: Record<string, string> = {};
  if (label.trim().length < 2) erreurs.label = 'Le libellé est obligatoire.';
  else if (label.trim().length > 120) erreurs.label = 'Libellé trop long.';
  if (edition) return erreurs;
  if (!CODE_VALIDE.test(code.trim().toUpperCase())) {
    erreurs.code = 'Majuscules, chiffres et tirets bas, deux caractères au moins.';
  }
  return erreurs;
}

export function ListeFormDialog({
  kind,
  titreCreation,
  open,
  onOpenChange,
  entree,
}: {
  kind: string;
  /** Titre déjà accordé : « Nouvelle entreprise », « Nouvel objet ». */
  titreCreation: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entree: ReferentielItem | null;
}) {
  const queryClient = useQueryClient();
  const edition = entree !== null;
  const [code, setCode] = useState(() => entree?.code ?? '');
  const [label, setLabel] = useState(() => (entree === null ? '' : libelle(entree)));
  const [erreurs, setErreurs] = useState<Partial<Record<string, string>>>({});

  const enregistrer = useMutation({
    mutationFn: () =>
      edition
        ? modifierEntreeReferentiel(kind, entree.id, { label: label.trim() })
        : creerEntreeReferentiel(kind, { code: code.trim().toUpperCase(), label: label.trim() }),
    onSuccess: (enregistree) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.visiteReferentielsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(
        edition ? `${libelle(enregistree)} enregistré.` : `${libelle(enregistree)} ajouté.`,
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(suivant) => {
        if (!suivant && enregistrer.isPending) return;
        onOpenChange(suivant);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edition ? `Renommer « ${libelle(entree)} »` : titreCreation}</DialogTitle>
          <DialogDescription>
            {edition
              ? 'Le code reste inchangé : les visites déjà enregistrées le désignent.'
              : 'Le code est définitif, utile pour l’export.'}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trouvees = verifier(code, label, edition);
            setErreurs(trouvees);
            if (Object.keys(trouvees).length === 0) enregistrer.mutate();
          }}
        >
          {edition ? null : (
            <Field
              label="Code"
              required
              description="Majuscules, chiffres et tirets bas. Définitif."
              error={erreurs.code}
            >
              {(props) => (
                <Input
                  {...props}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="SANTARGILE"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                  }}
                />
              )}
            </Field>
          )}

          <Field label="Libellé" required error={erreurs.label}>
            {(props) => (
              <Input
                {...props}
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                }}
              />
            )}
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={enregistrer.isPending}>
              {enregistrer.isPending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
