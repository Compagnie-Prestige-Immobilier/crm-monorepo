'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, UserPlusIcon } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ajouterTeleconseiller,
  fetchLotExportFichesToutes,
  fetchTeleconseillers,
  type LotExportDetail,
  type LotExportFiche,
} from '@/lib/data/lots-export';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const FICHES_NON_TRAITEES = { etat: 'NON_TRAITEE', page: 1, pageSize: 200 } as const;

export function BoutonAjoutTeleconseiller({ lot }: { lot: LotExportDetail }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOuvert(true);
        }}
      >
        <UserPlusIcon className="size-4" aria-hidden="true" />
        Ajouter un téléconseiller
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-2xl">
          {ouvert ? (
            <FormulaireAjout
              lot={lot}
              onFermer={() => {
                setOuvert(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormulaireAjout({ lot, onFermer }: { lot: LotExportDetail; onFermer: () => void }) {
  const queryClient = useQueryClient();
  const [vers, setVers] = useState<string | null>(null);
  const [cochees, setCochees] = useState<readonly number[]>([]);

  const teleconseillers = useQuery({
    queryKey: queryKeys.lotsExportTeleconseillers,
    queryFn: () => fetchTeleconseillers(),
    staleTime: 5 * 60_000,
  });
  const fiches = useQuery({
    queryKey: queryKeys.lotsExportFiches(lot.id, FICHES_NON_TRAITEES),
    queryFn: () => fetchLotExportFichesToutes(lot.id, FICHES_NON_TRAITEES.etat),
  });

  const membres = new Set(lot.performance.map((ligne) => ligne.teleconseillerId));
  const candidats = (teleconseillers.data ?? []).filter((compte) => !membres.has(compte.id));
  const nom = candidats.find((compte) => compte.id === vers)?.fullName ?? '';

  const ajout = useMutation({
    mutationFn: () =>
      ajouterTeleconseiller(lot.id, { teleconseillerId: vers ?? '', positions: [...cochees] }),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.lotsExportDetail(lot.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportDetail(lot.id) });
      toast.success(`${nom} a rejoint la campagne.`);
      onFermer();
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'L’ajout du téléconseiller a échoué.'));
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ajouter un téléconseiller</DialogTitle>
        <DialogDescription>
          Il rejoint l’équipe de la campagne. Vous pouvez aussi lui confier tout de suite des fiches
          non traitées de ses collègues.
        </DialogDescription>
      </DialogHeader>

      <ChoixTeleconseiller
        candidats={candidats}
        chargement={teleconseillers.isPending}
        vers={vers}
        onVers={setVers}
      />

      <ListeFiches
        fiches={fiches.data ?? []}
        chargement={fiches.isPending}
        cochees={cochees}
        onCochees={setCochees}
      />

      <DialogFooter>
        <Button type="button" variant="outline" disabled={ajout.isPending} onClick={onFermer}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={vers === null || ajout.isPending}
          onClick={() => {
            ajout.mutate();
          }}
        >
          {ajout.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {libelleValidation(cochees.length)}
        </Button>
      </DialogFooter>
    </>
  );
}

function libelleValidation(nombre: number): string {
  if (nombre === 0) return 'Ajouter';
  return `Ajouter et confier ${String(nombre)} fiche${nombre > 1 ? 's' : ''}`;
}

function ChoixTeleconseiller({
  candidats,
  chargement,
  vers,
  onVers,
}: {
  candidats: readonly { id: string; fullName: string }[];
  chargement: boolean;
  vers: string | null;
  onVers: (id: string) => void;
}) {
  if (!chargement && candidats.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Tous les téléconseillers actifs font déjà partie de la campagne.
      </p>
    );
  }
  const items = candidats.map((compte) => ({ value: compte.id, label: compte.fullName }));
  return (
    <label className="flex flex-col gap-1.5 text-[0.8125rem] font-[600]">
      Téléconseiller
      <Select
        items={items}
        value={vers}
        onValueChange={(value) => {
          if (value !== null) onVers(value);
        }}
      >
        <SelectTrigger className="w-full" aria-label="Téléconseiller à ajouter">
          <SelectValue
            placeholder={chargement ? 'Lecture des comptes…' : 'Choisir un téléconseiller'}
          />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ListeFiches({
  fiches,
  chargement,
  cochees,
  onCochees,
}: {
  fiches: readonly LotExportFiche[];
  chargement: boolean;
  cochees: readonly number[];
  onCochees: (positions: readonly number[]) => void;
}) {
  const basculer = (position: number, coche: boolean) => {
    onCochees(coche ? [...cochees, position] : cochees.filter((item) => item !== position));
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-[0.8125rem] font-[600]">
        Fiches à lui confier <span className="font-[400] text-muted-foreground">(facultatif)</span>
      </legend>
      <ContenuFiches
        fiches={fiches}
        chargement={chargement}
        cochees={cochees}
        onBasculer={basculer}
      />
    </fieldset>
  );
}

function ContenuFiches({
  fiches,
  chargement,
  cochees,
  onBasculer,
}: {
  fiches: readonly LotExportFiche[];
  chargement: boolean;
  cochees: readonly number[];
  onBasculer: (position: number, coche: boolean) => void;
}) {
  if (chargement) {
    return <p className="text-[0.875rem] text-muted-foreground">Lecture des fiches…</p>;
  }
  if (fiches.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucune fiche non traitée : il rejoindra la campagne sans fiche.
      </p>
    );
  }
  return (
    <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
      {fiches.map((fiche) => (
        <li key={fiche.position}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-[0.875rem] hover:bg-secondary/60">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={cochees.includes(fiche.position)}
              onChange={(event) => {
                onBasculer(fiche.position, event.target.checked);
              }}
            />
            <span className="min-w-0 flex-1 truncate font-[600]">{fiche.fullName}</span>
            <span className="text-muted-foreground">
              {fiche.teleconseillerName} · jour {fiche.jour}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
