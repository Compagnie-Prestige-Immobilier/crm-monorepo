import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Attente, ChampSelect } from '@/components/banque/champs';
import { ChampObligatoire } from '@/components/banque/pieces';
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
import { creerEtape, renommerEtape, type EtapeBanque } from '@/lib/data/bank-cases';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const COULEURS: readonly { value: string; label: string }[] = [
  { value: 'info', label: 'Information (rose CPI)' },
  { value: 'warning', label: 'Attention (or)' },
  { value: 'success', label: 'Succès (vert)' },
  { value: 'destructive', label: 'Alerte (rouge)' },
  { value: 'secondary', label: 'Neutre' },
];

const CODE_VALIDE = /^[A-Z][A-Z0-9_]{1,39}$/u;

function ChampCode({
  id,
  visible,
  code,
  valide,
  onChange,
}: {
  id: string;
  visible: boolean;
  code: string;
  valide: boolean;
  onChange: (code: string) => void;
}) {
  if (!visible) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        Code
        <ChampObligatoire />
      </Label>
      <Input
        id={id}
        value={code}
        maxLength={40}
        autoComplete="off"
        spellCheck={false}
        placeholder="VALIDATION_DIRECTION"
        aria-invalid={code !== '' && !valide}
        aria-describedby={`${id}-aide`}
        onChange={(evenement) => {
          onChange(evenement.target.value.toUpperCase());
        }}
      />
      <p id={`${id}-aide`} className="text-[0.75rem] text-muted-foreground">
        Majuscules, chiffres et tirets bas. Définitif.
      </p>
    </div>
  );
}

function titre(mode: 'creation' | 'renommage', etape: EtapeBanque | null): string {
  return mode === 'creation' ? 'Nouvelle étape du flux' : `Renommer « ${etape?.label ?? ''} »`;
}

function description(mode: 'creation' | 'renommage'): string {
  return mode === 'creation'
    ? 'Ajoutée à la fin du flux ouvert, déplaçable ensuite.'
    : 'Le code reste inchangé.';
}

function messageSucces(mode: 'creation' | 'renommage', label: string): string {
  return mode === 'creation' ? `Étape « ${label} » créée.` : `Étape renommée en « ${label} ».`;
}

function codeAcceptable(mode: 'creation' | 'renommage', code: string): boolean {
  return mode === 'renommage' || CODE_VALIDE.test(code.trim().toUpperCase());
}

function libelleAcceptable(libelle: string): boolean {
  const taille = libelle.trim().length;
  return taille >= 2 && taille <= 80;
}

interface SaisieEtape {
  code: string;
  libelle: string;
  couleur: string;
  setCode: (valeur: string) => void;
  setLibelle: (valeur: string) => void;
  setCouleur: (valeur: string) => void;
  oublier: () => void;
}

/** La saisie se recale sur l'étape ouverte, sans effet : c'est un rendu, pas une synchronisation. */
function useSaisieEtape(
  mode: 'creation' | 'renommage',
  etape: EtapeBanque | null,
  ouvert: boolean,
): SaisieEtape {
  const [initialise, setInitialise] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const [couleur, setCouleur] = useState('info');

  const cle = etape?.id ?? 'nouvelle';
  if (ouvert && initialise !== cle) {
    setInitialise(cle);
    setCode('');
    setLibelle(etape?.label ?? '');
    setCouleur(etape?.color ?? 'info');
  }

  return {
    code,
    libelle,
    couleur,
    setCode,
    setLibelle,
    setCouleur,
    oublier: () => {
      setInitialise(null);
    },
  };
}

function enregistrerEtape(
  mode: 'creation' | 'renommage',
  etape: EtapeBanque | null,
  saisie: SaisieEtape,
): Promise<EtapeBanque> {
  const corps = { label: saisie.libelle.trim(), color: saisie.couleur };
  if (mode === 'creation') {
    return creerEtape({ code: saisie.code.trim().toUpperCase(), ...corps });
  }
  return renommerEtape(etape?.id ?? '', corps);
}

export function DialogueEtape({
  mode,
  etape,
  ouvert,
  onOuvert,
}: {
  mode: 'creation' | 'renommage';
  etape: EtapeBanque | null;
  ouvert: boolean;
  onOuvert: (ouvert: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const codeId = useId();
  const libelleId = useId();

  const saisie = useSaisieEtape(mode, etape, ouvert);
  const { code, libelle, couleur } = saisie;

  const enregistrer = useMutation({
    mutationFn: () => enregistrerEtape(mode, etape, saisie),
    onSuccess: (resultat) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankStagesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
      toast.success(messageSucces(mode, resultat.label));
      saisie.oublier();
      onOuvert(false);
    },
    onError: (erreur: unknown) => {
      toastApiError(erreur, 'L’étape n’a pas pu être enregistrée.');
    },
  });

  const codeValide = codeAcceptable(mode, code);
  const libelleValide = libelleAcceptable(libelle);

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(suivant) => {
        if (!suivant && enregistrer.isPending) return;
        if (!suivant) saisie.oublier();
        onOuvert(suivant);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titre(mode, etape)}</DialogTitle>
          <DialogDescription>{description(mode)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <ChampCode
            id={codeId}
            visible={mode === 'creation'}
            code={code}
            valide={codeValide}
            onChange={saisie.setCode}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={libelleId}>
              Libellé affiché
              <ChampObligatoire />
            </Label>
            <Input
              id={libelleId}
              value={libelle}
              maxLength={80}
              autoComplete="off"
              placeholder="Validation direction"
              aria-invalid={libelle !== '' && !libelleValide}
              onChange={(evenement) => {
                saisie.setLibelle(evenement.target.value);
              }}
            />
          </div>

          <ChampSelect
            label="Couleur de la pastille"
            placeholder="Choisir une couleur"
            options={COULEURS}
            valeur={couleur}
            onChange={saisie.setCouleur}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={enregistrer.isPending}
            onClick={() => {
              onOuvert(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={enregistrer.isPending || !codeValide || !libelleValide}
            onClick={() => {
              enregistrer.mutate();
            }}
          >
            <Attente enCours={enregistrer.isPending} libelle="Enregistrer" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
