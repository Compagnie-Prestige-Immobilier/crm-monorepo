'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createRole, type RoleCompte, updateRole } from '@/lib/data/roles';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { ROLES } from '@/lib/user-filters';

const BASES = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const AUCUNE = 'aucune';

const CREATION = {
  titre: () => 'Nouveau rôle',
  bouton: 'Créer le rôle',
  succes: (libelle: string) => `Rôle ${libelle} créé.`,
};
const EDITION = {
  titre: (libelle: string) => `Modifier ${libelle}`,
  bouton: 'Enregistrer',
  succes: (libelle: string) => `Rôle ${libelle} enregistré.`,
};

function permissionsDe(source: string, roles: RoleCompte[]): string[] {
  if (source === AUCUNE) return [];
  return roles.find((r) => r.id === source)?.permissions ?? [];
}

function enregistrerRole(
  role: RoleCompte | null,
  valeurs: { libelle: string; base: Role; depart: string[] },
): Promise<RoleCompte> {
  if (role !== null)
    return updateRole(role.id, { libelle: valeurs.libelle, roleDeBase: valeurs.base });
  return createRole({
    libelle: valeurs.libelle,
    roleDeBase: valeurs.base,
    permissions: valeurs.depart,
  });
}

/** Sans `role`, crée un rôle ; avec, le renomme ou change sa base. */
export function RoleDialog({
  open,
  onOpenChange,
  role,
  roles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleCompte | null;
  roles: RoleCompte[];
  onSaved: (role: RoleCompte) => void;
}) {
  const queryClient = useQueryClient();
  const libelleId = useId();
  // Le parent remonte le dialogue à chaque ouverture (`key`) : l'état repart du rôle.
  const initial = role ?? { libelle: '', roleDeBase: 'SUPERVISEUR' as Role };
  const [libelle, setLibelle] = useState(initial.libelle);
  const [base, setBase] = useState<Role>(initial.roleDeBase);
  const [source, setSource] = useState<string>(initial.roleDeBase);
  const textes = role === null ? CREATION : EDITION;

  const mutation = useMutation({
    mutationFn: () =>
      enregistrerRole(role, { libelle, base, depart: permissionsDe(source, roles) }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      toast.success(textes.succes(saved.libelle));
      onSaved(saved);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  const sources = [
    ...roles.map((r) => ({ value: r.id, label: r.libelle })),
    { value: AUCUNE, label: 'Aucune permission' },
  ];
  const baseFigee = role !== null && role.comptes > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{textes.titre(initial.libelle)}</DialogTitle>
          <DialogDescription>
            Les notifications, la page d’accueil et les files de rappels suivent le rôle de base.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (libelle.trim().length >= 2) mutation.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={libelleId}>Nom du rôle</Label>
            <Input
              id={libelleId}
              value={libelle}
              maxLength={60}
              onChange={(event) => {
                setLibelle(event.target.value);
              }}
            />
          </div>
          <ChoixListe
            label="Rôle de base"
            description={baseFigee ? 'Ce rôle a des comptes : sa base ne change plus.' : undefined}
            items={BASES}
            value={base}
            disabled={baseFigee}
            onChange={(value) => {
              setBase(value as Role);
            }}
          />
          {role === null ? (
            <ChoixListe
              label="Partir des permissions de"
              items={sources}
              value={source}
              onChange={setSource}
            />
          ) : null}
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
            <Button type="submit" disabled={mutation.isPending || libelle.trim().length < 2}>
              {mutation.isPending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {textes.bouton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChoixListe({
  label,
  description,
  items,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string | undefined;
  items: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} description={description}>
      {(props) => (
        <Select
          items={items}
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            if (next !== null) onChange(next);
          }}
        >
          <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
