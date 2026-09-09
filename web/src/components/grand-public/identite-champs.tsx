import { Link } from '@tanstack/react-router';
import { AlertTriangleIcon } from 'lucide-react';
import type { RefObject } from 'react';

import type { EtatFiche } from '@/components/grand-public/corps-prospect';
import { ChampTelephone, type Indicatif } from '@/components/grand-public/telephone';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ConflitTelephone } from '@/lib/data/grand-public';
import { formatDateTime } from '@/lib/format';

export type ErreursIdentite = Partial<Record<'prenom' | 'nom' | 'phone', string>>;

function ConflitCarte({ conflit }: { conflit: ConflitTelephone }) {
  const nomme = conflit.prenom !== undefined && conflit.nom !== undefined;

  return (
    <Card className="border-destructive/40">
      <CardContent className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div role="alert" className="flex min-w-0 flex-col gap-1">
          <p className="font-[600]">
            {nomme
              ? `Ce numéro est déjà celui de ${conflit.prenom ?? ''} ${conflit.nom ?? ''}.`
              : 'Ce numéro est déjà enregistré.'}
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Saisi par le téléconseiller {conflit.ownedByCommercialName}
            {conflit.createdAt === undefined ? '.' : ` le ${formatDateTime(conflit.createdAt)}.`}
          </p>
          {conflit.id === undefined ? null : (
            <Link
              to="/$projet/$id"
              params={{ projet: 'grand-public', id: conflit.id }}
              className="w-fit rounded-sm font-[600] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Ouvrir cette fiche
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function IdentiteChamps({
  etat,
  erreurs,
  indicatifs,
  conflit,
  prenomRef,
  onPoser,
  onNumeroChange,
}: {
  etat: EtatFiche;
  erreurs: ErreursIdentite;
  indicatifs: readonly Indicatif[];
  conflit: ConflitTelephone | null;
  prenomRef: RefObject<HTMLInputElement | null>;
  onPoser: (patch: Partial<EtatFiche>) => void;
  onNumeroChange: (phone: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={erreurs.prenom}>
          {(props) => (
            <Input
              {...props}
              ref={prenomRef}
              value={etat.prenom}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => {
                onPoser({ prenom: event.target.value });
              }}
            />
          )}
        </Field>
        <Field label="Nom" required error={erreurs.nom}>
          {(props) => (
            <Input
              {...props}
              value={etat.nom}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => {
                onPoser({ nom: event.target.value });
              }}
            />
          )}
        </Field>
      </div>

      <ChampTelephone
        indicatifs={indicatifs}
        indicatif={etat.indicatif}
        valeur={etat.phone}
        erreur={erreurs.phone}
        onIndicatif={(indicatif) => {
          onPoser({ indicatif });
        }}
        onChange={onNumeroChange}
      />

      {conflit === null ? null : <ConflitCarte conflit={conflit} />}
    </>
  );
}
