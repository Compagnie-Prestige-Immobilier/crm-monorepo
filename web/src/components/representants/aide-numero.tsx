import { AlertTriangleIcon } from 'lucide-react';

export interface ConflitNumero {
  label: string;
  proprietaire: string | null;
}

export function AideNumero({
  phoneId,
  conflit,
  verification,
}: {
  phoneId: string;
  conflit: { label: string; proprietaire: string | null } | null;
  verification: boolean;
}) {
  if (conflit === null) {
    return (
      <p id={`${phoneId}-aide`} className="text-[0.75rem] text-muted-foreground">
        Vérifié contre la base avant enregistrement.
        {verification ? ' Vérification en cours…' : ''}
      </p>
    );
  }

  return (
    <p
      id={`${phoneId}-conflit`}
      role="alert"
      className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-destructive"
    >
      <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      Ce numéro est déjà celui de {conflit.label}
      {conflit.proprietaire === null ? '.' : `, saisi par ${conflit.proprietaire}.`}
    </p>
  );
}
