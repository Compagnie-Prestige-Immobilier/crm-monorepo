'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchMotifsAppel,
  planifieUneDate,
  type MotifAppel,
} from '@/lib/data/call-outcome-reasons';
import { fetchProspect, poserMotifProspect, remettreProspectATraiter } from '@/lib/data/prospects';
import { dakarLocalToIso } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { peut, type Projet, type ProspectRow, type ProspectStatut } from '@/lib/types';

type Famille = 'JOIGNABLE' | 'INJOIGNABLE';

const FAMILLES: readonly { value: Famille; label: string }[] = [
  { value: 'JOIGNABLE', label: 'Joignable' },
  { value: 'INJOIGNABLE', label: 'Injoignable' },
];

const libelleMotif = (motif: MotifAppel, catalogue: readonly MotifAppel[]): string => {
  const parent = catalogue.find((item) => item.id === motif.parentId);
  return parent === undefined ? motif.label : `${parent.label} · ${motif.label}`;
};

interface Choix {
  motif: MotifAppel | null;
  echeance: string;
  commentaire: string;
}

const exigeUneDate = (choix: Choix): boolean =>
  choix.motif !== null && planifieUneDate(choix.motif.effect);

const estPret = (choix: Choix): boolean =>
  choix.motif !== null && (!exigeUneDate(choix) || dakarLocalToIso(choix.echeance) !== null);

async function poserLeMotif(prospect: ProspectRow, choix: Choix): Promise<ProspectRow> {
  if (choix.motif === null) return prospect;
  const callbackAt = exigeUneDate(choix) ? dakarLocalToIso(choix.echeance) : null;
  const commentaire = choix.commentaire.trim();
  await poserMotifProspect(prospect.id, {
    reasonCode: choix.motif.code,
    ...(callbackAt === null ? {} : { callbackAt }),
    ...(commentaire === '' ? {} : { comment: commentaire }),
  });
  return fetchProspect(prospect.id);
}

export function RequalifierFiche({
  prospect,
  projet,
  statut,
  onRequalifiee,
}: {
  prospect: ProspectRow;
  projet: Projet;
  statut: ProspectStatut;
  onRequalifiee?: (saved: ProspectRow) => void;
}) {
  const { data: user } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const [ouverte, setOuverte] = useState(false);
  const [famille, setFamille] = useState<Famille>('JOIGNABLE');
  const [code, setCode] = useState<string | null>(null);
  const [echeance, setEcheance] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const catalogue = useQuery({
    queryKey: queryKeys.motifsAppel,
    queryFn: () => fetchMotifsAppel(),
    enabled: ouverte,
  });
  const liste = catalogue.data ?? [];
  const motifs = liste.filter((motif) =>
    famille === 'JOIGNABLE' ? motif.countsAsReached : !motif.countsAsReached,
  );
  const choix: Choix = {
    motif: motifs.find((item) => item.code === code) ?? null,
    echeance,
    commentaire,
  };

  const terminer = (saved: ProspectRow, message: string) => {
    onRequalifiee?.(saved);
    void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
    setOuverte(false);
    toast.success(message);
  };
  const requalification = useMutation({
    mutationFn: () => poserLeMotif(prospect, choix),
    onSuccess: (saved) => {
      terminer(saved, 'Fiche requalifiée.');
    },
    onError: (error) => toastApiError(error, 'La fiche n’a pas pu être requalifiée.'),
  });
  const remise = useMutation({
    mutationFn: () => remettreProspectATraiter(prospect.id, projet),
    onSuccess: (saved) => {
      terminer(saved, 'Fiche remise à traiter.');
    },
    onError: (error) => toastApiError(error, 'La fiche n’a pas pu être remise à traiter.'),
  });
  const enCours = requalification.isPending || remise.isPending;

  if (!peut(user, 'prospects.superviser') || statut === 'CONVERTI') return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOuverte(true);
        }}
      >
        <RotateCcwIcon aria-hidden="true" />
        Requalifier
      </Button>
      <Dialog open={ouverte} onOpenChange={setOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Requalifier {prospect.prenom} {prospect.nom}
            </DialogTitle>
            <DialogDescription>Nouveau motif, sans appel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Tabs
              value={famille}
              onValueChange={(value) => {
                setFamille(value as Famille);
                setCode(null);
              }}
            >
              <TabsList className="w-full">
                {FAMILLES.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="flex-1">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="grid gap-2">
              <Label htmlFor="requalifier-motif">Motif</Label>
              <Select
                items={motifs.map((item) => ({
                  value: item.code,
                  label: libelleMotif(item, liste),
                }))}
                value={code}
                onValueChange={setCode}
              >
                <SelectTrigger id="requalifier-motif">
                  <SelectValue placeholder="Choisir un motif" />
                </SelectTrigger>
                <SelectContent>
                  {motifs.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {libelleMotif(item, liste)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {exigeUneDate(choix) ? (
              <div className="grid gap-2">
                <Label htmlFor="requalifier-echeance">Date du rappel (heure de Dakar)</Label>
                <Input
                  id="requalifier-echeance"
                  type="datetime-local"
                  value={echeance}
                  onChange={(event) => {
                    setEcheance(event.target.value);
                  }}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="requalifier-commentaire">Commentaire, facultatif</Label>
              <Textarea
                id="requalifier-commentaire"
                value={commentaire}
                onChange={(event) => {
                  setCommentaire(event.target.value);
                }}
              />
            </div>
            <Button
              variant="link"
              className="justify-start px-0"
              disabled={enCours}
              onClick={() => {
                remise.mutate();
              }}
            >
              Remettre à traiter (remise à zéro)
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOuverte(false);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={!estPret(choix) || enCours}
              onClick={() => {
                requalification.mutate();
              }}
            >
              Requalifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
