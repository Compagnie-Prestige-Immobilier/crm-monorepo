import { useMutation } from '@tanstack/react-query';
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
  changerMotDePasse,
  MOT_DE_PASSE_MAX,
  MOT_DE_PASSE_MIN,
  type Compte,
} from '@/lib/data/users';
import { champsRefuses, toastApiError } from '@/lib/mutation-feedback';

export function CompteMotDePasseDialog({
  compte,
  open,
  onOpenChange,
}: {
  compte: Compte;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const discordance = confirmation !== '' && confirmation !== password;

  const enregistrer = useMutation({
    mutationFn: () => changerMotDePasse(compte.id, password),
    onSuccess: () => {
      toast.success(`Mot de passe réinitialisé. ${compte.fullName} est déconnecté.`);
      onOpenChange(false);
    },
    onError: (erreur) => {
      setErreurs(champsRefuses(erreur));
      toastApiError(erreur, 'Réinitialisation impossible. Réessayez.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            {`Compte de ${compte.fullName} (${compte.email}). Ses sessions ouvertes seront fermées.`}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (discordance || confirmation === '') return;
            setErreurs({});
            enregistrer.mutate();
          }}
        >
          <Field
            label="Nouveau mot de passe"
            required
            description={`${String(MOT_DE_PASSE_MIN)} à ${String(MOT_DE_PASSE_MAX)} caractères.`}
            error={erreurs['password']}
          >
            {(props) => (
              <Input
                {...props}
                required
                type="password"
                autoComplete="new-password"
                minLength={MOT_DE_PASSE_MIN}
                maxLength={MOT_DE_PASSE_MAX}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />
            )}
          </Field>

          <Field
            label="Confirmation"
            required
            error={discordance ? 'Les deux saisies diffèrent.' : undefined}
          >
            {(props) => (
              <Input
                {...props}
                required
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
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
            <Button
              type="submit"
              disabled={enregistrer.isPending || discordance || confirmation === ''}
            >
              {enregistrer.isPending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Réinitialiser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
