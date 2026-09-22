'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  basesDemoQuery,
  creerBaseDemo,
  rafraichirBaseDemo,
  rafraichirToutesBasesDemo,
  supprimerBaseDemo,
} from '@/lib/data/bases';
import { formatDateTime } from '@/lib/format';

export function BasesView() {
  const client = useQueryClient();
  const [nom, setNom] = useState('');
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [aRafraichir, setARafraichir] = useState<string | null>(null);
  const [toutARafraichir, setToutARafraichir] = useState(false);
  const bases = useQuery(basesDemoQuery());

  const invalider = (): void => {
    void client.invalidateQueries({ queryKey: basesDemoQuery().queryKey });
  };

  const creation = useMutation({
    mutationFn: creerBaseDemo,
    onSuccess: () => {
      setNom('');
      invalider();
      toast.success('Base créée. Elle apparaît dans le sélecteur de la page de connexion.');
    },
    onError: (erreur: Error) => {
      toast.error(erreur.message);
    },
  });

  const suppression = useMutation({
    mutationFn: supprimerBaseDemo,
    onSuccess: () => {
      setASupprimer(null);
      invalider();
      toast.success('Base supprimée.');
    },
    onError: (erreur: Error) => {
      toast.error(erreur.message);
    },
  });

  const rafraichissement = useMutation({
    mutationFn: rafraichirBaseDemo,
    onSuccess: () => {
      setARafraichir(null);
      invalider();
      toast.success('Base réinitialisée avec le schéma et les données d’exemple actuels.');
    },
    onError: (erreur: Error) => {
      toast.error(erreur.message);
    },
  });

  const rafraichissementTout = useMutation({
    mutationFn: rafraichirToutesBasesDemo,
    onSuccess: () => {
      setToutARafraichir(false);
      invalider();
      toast.success(
        'Toutes les bases sont réinitialisées avec le schéma et les données d’exemple actuels.',
      );
    },
    onError: (erreur: Error) => {
      toast.error(erreur.message);
    },
  });

  if (bases.data === undefined) return <Skeleton className="h-64 w-full" />;

  const complet = bases.data.items.length >= bases.data.max;

  return (
    <div className="flex flex-col gap-6">
      {/* Pas de titre ici : la barre du haut porte le `h1` de chaque écran. */}
      <p className="text-sm text-muted-foreground">
        Chaque base est une copie vide du CRM, remplie de données d’exemple, avec les comptes de
        connexion rapide. Aucun courriel n’en sort et aucune tâche planifiée n’y tourne.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Créer une base</CardTitle>
          <CardDescription>
            Lettres minuscules, chiffres et tirets, de 3 à 21 caractères. {bases.data.items.length}{' '}
            sur {bases.data.max} utilisées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(evenement) => {
              evenement.preventDefault();
              creation.mutate(nom.trim());
            }}
          >
            <div className="flex-1">
              <Label htmlFor="nom-base">Nom</Label>
              <Input
                id="nom-base"
                value={nom}
                placeholder="formation"
                onChange={(evenement) => {
                  setNom(evenement.target.value);
                }}
              />
            </div>
            <Button type="submit" disabled={creation.isPending || complet || nom.trim() === ''}>
              <DatabaseIcon className="size-4" aria-hidden="true" />
              {creation.isPending ? 'Création en cours…' : 'Créer la base'}
            </Button>
          </form>
          {complet ? (
            <p className="pt-3 text-sm text-muted-foreground">
              Le maximum est atteint. Supprimez une base avant d’en créer une autre.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Bases existantes</CardTitle>
          {bases.data.items.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rafraichissementTout.isPending}
              onClick={() => {
                setToutARafraichir(true);
              }}
            >
              <RefreshCwIcon className="size-4" aria-hidden="true" />
              Rafraîchir tout
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {bases.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune base de démonstration. Créez-en une pour former une recrue ou montrer le CRM
              sans toucher aux données réelles.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {bases.data.items.map((base) => (
                <li
                  key={base.nom}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-[600]">{base.nom}</p>
                    <p className="text-sm text-muted-foreground">
                      Créée le {formatDateTime(base.createdAt)}
                      {base.createdByName === '' ? '' : ` par ${base.createdByName}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={rafraichissement.isPending}
                      onClick={() => {
                        setARafraichir(base.nom);
                      }}
                    >
                      <RefreshCwIcon className="size-4" aria-hidden="true" />
                      Rafraîchir
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={suppression.isPending}
                      onClick={() => {
                        setASupprimer(base.nom);
                      }}
                    >
                      <Trash2Icon className="size-4" aria-hidden="true" />
                      Supprimer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setASupprimer(null);
        }}
        title={`Supprimer la base « ${aSupprimer ?? ''} » ?`}
        description="La base et tout ce qu’elle contient sont détruits sur le serveur. C’est immédiat et sans retour possible."
        confirmLabel="Supprimer définitivement"
        pending={suppression.isPending}
        onConfirm={() => {
          if (aSupprimer !== null) suppression.mutate(aSupprimer);
        }}
      />

      <ConfirmDialog
        open={aRafraichir !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setARafraichir(null);
        }}
        title={`Rafraîchir la base « ${aRafraichir ?? ''} » ?`}
        description="Son contenu repart du schéma et des données d’exemple actuels : ce qui a été saisi dedans depuis sa création est perdu."
        confirmLabel="Rafraîchir"
        pending={rafraichissement.isPending}
        onConfirm={() => {
          if (aRafraichir !== null) rafraichissement.mutate(aRafraichir);
        }}
      />

      <ConfirmDialog
        open={toutARafraichir}
        onOpenChange={setToutARafraichir}
        title="Rafraîchir toutes les bases ?"
        description="Chacune repart du schéma et des données d’exemple actuels : ce qui a été saisi dedans depuis sa création est perdu."
        confirmLabel="Rafraîchir tout"
        pending={rafraichissementTout.isPending}
        onConfirm={() => {
          rafraichissementTout.mutate();
        }}
      />
    </div>
  );
}
