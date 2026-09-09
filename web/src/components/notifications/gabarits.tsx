import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  CATEGORY_LABELS,
  creerGabarit,
  fetchGabarits,
  gabaritKeys,
  type GabaritNotification,
  type NotificationCategory,
} from '@/lib/data/notifications';
import { toastApiError } from '@/lib/mutation-feedback';

const CATEGORIES = (['ANNONCE', 'RAPPEL', 'CAMPAGNE', 'DOSSIER', 'SYSTEME'] as const).map(
  (value) => ({ value, label: CATEGORY_LABELS[value] }),
);

const VIDE = {
  name: '',
  category: 'ANNONCE' as NotificationCategory,
  titleTemplate: '',
  bodyTemplate: '',
};

function DialogueGabarit({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  const creer = useMutation({
    mutationFn: () => creerGabarit({ ...brouillon, name: brouillon.name.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gabaritKeys.list });
      toast.success('Gabarit enregistré.');
      setBrouillon(VIDE);
      onOpenChange(false);
    },
    onError: (e) => {
      toastApiError(e, 'Le gabarit n’a pas pu être créé.');
    },
  });

  const soumettre = (): void => {
    if (brouillon.name.trim().length < 2) return setErreur('Le nom est obligatoire.');
    if (brouillon.titleTemplate.trim() === '') return setErreur('Le titre est obligatoire.');
    if (brouillon.bodyTemplate.trim() === '') return setErreur('Le message est obligatoire.');
    setErreur(null);
    creer.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau gabarit</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            soumettre();
          }}
        >
          <Field label="Nom" required>
            {(props) => (
              <Input
                {...props}
                value={brouillon.name}
                onChange={(e) => {
                  setBrouillon({ ...brouillon, name: e.target.value });
                }}
              />
            )}
          </Field>
          <Field label="Catégorie">
            {(props) => (
              <Select
                items={CATEGORIES}
                value={brouillon.category}
                onValueChange={(value) => {
                  if (value !== null) setBrouillon({ ...brouillon, category: value });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Titre" required description="Les variables s’écrivent {prenom}, {date}…">
            {(props) => (
              <Input
                {...props}
                value={brouillon.titleTemplate}
                onChange={(e) => {
                  setBrouillon({ ...brouillon, titleTemplate: e.target.value });
                }}
              />
            )}
          </Field>
          <Field label="Message" required error={erreur ?? undefined}>
            {(props) => (
              <Textarea
                {...props}
                rows={4}
                value={brouillon.bodyTemplate}
                onChange={(e) => {
                  setBrouillon({ ...brouillon, bodyTemplate: e.target.value });
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
            <Button type="submit" disabled={creer.isPending}>
              {creer.isPending ? (
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

export function GabaritsView() {
  const [creation, setCreation] = useState(false);
  const gabarits = useQuery({ queryKey: gabaritKeys.list, queryFn: fetchGabarits });

  if (gabarits.isPending) return <Skeleton className="h-40 w-full" />;
  if (gabarits.isError) {
    return (
      <QueryErrorState
        error={gabarits.error}
        onRetry={() => {
          void gabarits.refetch();
        }}
        fallback="Les gabarits n’ont pas pu être chargés."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.9375rem] text-muted-foreground">
          Un gabarit pré-remplit le composeur. Les variables entre accolades restent à compléter.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCreation(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau gabarit
        </Button>
      </div>
      {gabarits.data.length === 0 ? (
        <p role="status" className="text-[0.9375rem]">
          Aucun gabarit. Créez-en un pour réutiliser un message.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {gabarits.data.map((gabarit) => (
            <li
              key={gabarit.id}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-[600]">{gabarit.name}</p>
                <Badge variant="outline">{CATEGORY_LABELS[gabarit.category]}</Badge>
              </div>
              <p className="text-[0.875rem]">{gabarit.titleTemplate}</p>
              <p className="whitespace-pre-wrap text-[0.8125rem] text-muted-foreground">
                {gabarit.bodyTemplate}
              </p>
            </li>
          ))}
        </ul>
      )}
      <DialogueGabarit open={creation} onOpenChange={setCreation} />
    </div>
  );
}

export function ChoixGabarit({ onChoisir }: { onChoisir: (gabarit: GabaritNotification) => void }) {
  const gabarits = useQuery({ queryKey: gabaritKeys.list, queryFn: fetchGabarits });
  const items = (gabarits.data ?? []).map((g) => ({ value: g.id, label: g.name }));
  if (items.length === 0) return null;
  return (
    <Field label="Partir d’un gabarit">
      {(props) => (
        <Select
          items={items}
          value={null}
          onValueChange={(id) => {
            const gabarit = gabarits.data?.find((g) => g.id === id);
            if (gabarit !== undefined) onChoisir(gabarit);
          }}
        >
          <SelectTrigger id={props.id}>
            <SelectValue placeholder="Aucun" />
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
