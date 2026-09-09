import { InfoIcon } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Compte } from '@/lib/data/users';
import { formatNumber } from '@/lib/format';

const TEXTES = {
  desactiver: {
    titre: 'Désactiver le compte de',
    description: 'Sa connexion est fermée immédiatement. Aucune saisie n’est supprimée.',
    confirmer: 'Désactiver le compte',
    apres: 'Le compte peut être réactivé à tout moment.',
  },
  supprimer: {
    titre: 'Supprimer le compte de',
    description:
      'Le compte disparaît de la liste. Les fiches qu’il a saisies restent en base, à son nom.',
    confirmer: 'Supprimer le compte',
    apres: 'Un compte supprimé ne peut plus être réactivé.',
  },
} as const;

export function CompteRepriseDialog({
  compte,
  geste,
  repreneurs,
  pending,
  onOpenChange,
  onConfirm,
}: {
  compte: Compte;
  geste: 'desactiver' | 'supprimer';
  /** Téléconseillers actifs, hors le compte visé. */
  repreneurs: readonly Compte[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (repreneurId?: string) => void;
}) {
  const [repreneur, setRepreneur] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | undefined>(undefined);

  // Sans repreneur, le portefeuille GÈLE : plus aucun téléconseiller actif ne
  // lit ni ne corrige ces fiches. Le serveur refuse alors en `HANDOVER_REQUIRED`.
  const fiches = compte.prospectCount + compte.representantCount;
  const repriseRequise = fiches > 0;
  const candidats = repreneurs.filter((row) => row.isActive && row.role === 'COMMERCIAL');
  const choisi = candidats.find((row) => row.id === repreneur) ?? null;
  const textes = TEXTES[geste];

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      pending={pending}
      confirmLabel={textes.confirmer}
      title={`${textes.titre} ${compte.fullName} ?`}
      description={textes.description}
      onConfirm={() => {
        if (repriseRequise && repreneur === null) {
          setErreur('Désignez le téléconseiller qui reprend le portefeuille.');
          return;
        }
        setErreur(undefined);
        onConfirm(repreneur ?? undefined);
      }}
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
          <span className="font-display text-[1.5rem] font-[800] tabular-nums">
            {formatNumber(fiches)}
          </span>{' '}
          {fiches === 1 ? 'fiche est rattachée' : 'fiches sont rattachées'} à ce compte (
          {formatNumber(compte.prospectCount)} prospects, {formatNumber(compte.representantCount)}{' '}
          représentants).
        </p>

        {repriseRequise ? (
          <Field label="Qui reprend le portefeuille" required error={erreur}>
            {(props) => (
              <Select
                items={candidats.map((row) => ({ value: row.id, label: row.fullName }))}
                value={repreneur}
                onValueChange={(valeur) => {
                  setRepreneur(typeof valeur === 'string' ? valeur : null);
                  setErreur(undefined);
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Choisir un téléconseiller" />
                </SelectTrigger>
                <SelectContent>
                  {candidats.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        ) : null}

        <p className="flex items-start gap-2 rounded-md border border-accent-border/30 bg-accent-surface px-3 py-2.5 text-[0.8125rem]">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
          <span>
            {repriseRequise
              ? `Ses prospects, ses représentants et ses appels à passer sont transférés ${
                  choisi === null ? 'au repreneur' : `à ${choisi.fullName}`
                }. ${textes.apres}`
              : `Ce compte ne détient aucune fiche. ${textes.apres}`}
          </span>
        </p>
      </div>
    </ConfirmDialog>
  );
}
