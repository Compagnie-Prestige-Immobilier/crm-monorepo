import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChoixListe } from '@/components/admin/statut-form-dialog';
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
  creerCompte,
  modifierCompte,
  MOT_DE_PASSE_MAX,
  MOT_DE_PASSE_MIN,
  ROLES_COMPTE,
  type Compte,
} from '@/lib/data/users';
import { champsRefuses, toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { ROLE_LABELS, type Role } from '@/lib/types';

const OPTIONS_ROLE = ROLES_COMPTE.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

const AIDES_ROLE: Record<Role, string> = {
  ADMIN: 'Accès complet, y compris les comptes et les listes de référence.',
  COMMERCIAL: 'Passe les appels et saisit les fiches.',
  BANQUE_FINANCE: 'Accède aux dossiers bancaires, pas aux prospects.',
  SUPERVISEUR: 'Passe ses propres appels et suit le travail de son équipe.',
  DIRECTION: 'Passe les appels, lit tout le téléconseil et tient le registre des visites.',
  ACCUEIL: 'Tient le registre des visites, et rien d’autre.',
  CHARGE_CLIENTELE: 'Passe les appels, relit et revoit toute demande convertie.',
};

interface Brouillon {
  fullName: string;
  email: string;
  username: string;
  phone: string;
  role: Role;
  password: string;
}

const BROUILLON_VIDE: Brouillon = {
  fullName: '',
  email: '',
  username: '',
  phone: '',
  role: 'COMMERCIAL',
  password: '',
};

function brouillonDe(compte: Compte | null): Brouillon {
  if (compte === null) return BROUILLON_VIDE;
  return {
    fullName: compte.fullName,
    email: compte.email,
    username: compte.username,
    phone: compte.phoneE164 ?? '',
    role: compte.role,
    password: '',
  };
}

function ChampsCompte({
  creation,
  brouillon,
  erreurs,
  onChange,
}: {
  creation: boolean;
  brouillon: Brouillon;
  erreurs: Record<string, string>;
  onChange: (patch: Partial<Brouillon>) => void;
}) {
  return (
    <>
      <Field label="Nom complet" required error={erreurs['fullName']}>
        {(props) => (
          <Input
            {...props}
            required
            autoComplete="name"
            value={brouillon.fullName}
            onChange={(event) => {
              onChange({ fullName: event.target.value });
            }}
          />
        )}
      </Field>

      <Field label="Adresse e-mail" required error={erreurs['email']}>
        {(props) => (
          <Input
            {...props}
            required
            type="email"
            autoComplete="email"
            value={brouillon.email}
            onChange={(event) => {
              onChange({ email: event.target.value });
            }}
          />
        )}
      </Field>

      <Field
        label="Identifiant"
        required
        description="Sert à la connexion, avec l’e-mail."
        error={erreurs['username']}
      >
        {(props) => (
          <Input
            {...props}
            required
            autoCapitalize="none"
            spellCheck={false}
            value={brouillon.username}
            onChange={(event) => {
              onChange({ username: event.target.value });
            }}
          />
        )}
      </Field>

      <Field label="Téléphone" description="Format libre." error={erreurs['phone']}>
        {(props) => (
          <Input
            {...props}
            type="tel"
            placeholder="77 123 45 67"
            value={brouillon.phone}
            onChange={(event) => {
              onChange({ phone: event.target.value });
            }}
          />
        )}
      </Field>

      <ChoixListe
        label="Rôle"
        valeur={brouillon.role}
        options={OPTIONS_ROLE}
        aide={AIDES_ROLE[brouillon.role]}
        onChange={(valeur) => {
          onChange({ role: valeur as Role });
        }}
      />

      {creation ? (
        <Field
          label="Mot de passe"
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
              value={brouillon.password}
              onChange={(event) => {
                onChange({ password: event.target.value });
              }}
            />
          )}
        </Field>
      ) : null}
    </>
  );
}

export function CompteFormDialog({
  compte,
  open,
  onOpenChange,
}: {
  compte: Compte | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(compte));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const poser = (patch: Partial<Brouillon>): void => {
    setBrouillon((courant) => ({ ...courant, ...patch }));
  };

  const enregistrer = useMutation({
    mutationFn: () => {
      const telephone = brouillon.phone.trim();
      const commun = {
        fullName: brouillon.fullName.trim(),
        email: brouillon.email.trim(),
        username: brouillon.username.trim(),
        role: brouillon.role,
      };
      if (compte === null) {
        return creerCompte({
          ...commun,
          password: brouillon.password,
          ...(telephone === '' ? {} : { phone: telephone }),
        });
      }
      // La chaîne VIDE et non l'absence : sur un PATCH un champ absent ne change
      // rien, et le téléphone ne s'effacerait jamais.
      return modifierCompte(compte.id, { ...commun, phone: telephone });
    },
    onSuccess: (enregistre) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(
        compte === null
          ? `Compte de ${enregistre.fullName} créé.`
          : `Compte de ${enregistre.fullName} mis à jour.`,
      );
      onOpenChange(false);
    },
    onError: (erreur) => {
      setErreurs(champsRefuses(erreur));
      toastApiError(
        erreur,
        compte === null ? 'Création impossible. Réessayez.' : 'Modification impossible. Réessayez.',
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{compte === null ? 'Nouvel utilisateur' : 'Modifier le compte'}</DialogTitle>
          <DialogDescription>
            {compte === null
              ? 'Le rôle décide de ce que le compte pourra consulter.'
              : 'Le mot de passe se change depuis le menu de la ligne.'}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setErreurs({});
            enregistrer.mutate();
          }}
        >
          <ChampsCompte
            creation={compte === null}
            brouillon={brouillon}
            erreurs={erreurs}
            onChange={poser}
          />

          <DialogFooter className="sm:col-span-2">
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
              {compte === null ? 'Créer le compte' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
