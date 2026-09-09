import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangleIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Attente, ChampSelect } from '@/components/banque/champs';
import { DialogueDemandeClient } from '@/components/banque/demande-dialogue';
import { ChampObligatoire } from '@/components/banque/pieces';
import { ClientChoisi, ResultatsProspects } from '@/components/banque/recherche-client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import {
  chargeRefus,
  chercherProspects,
  ouvrirDossier,
  type ProspectBanque,
} from '@/lib/data/bank-cases';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet } from '@/lib/types';

interface Doublon {
  id: string;
  reference: string;
}

function lireDoublon(erreur: unknown): Doublon | null {
  const charge = chargeRefus(erreur);
  const existant = charge?.existing;
  if (typeof existant !== 'object' || existant === null) return null;
  const { id, reference } = existant as { id?: unknown; reference?: unknown };
  if (typeof id !== 'string' || typeof reference !== 'string') return null;
  return { id, reference };
}

function AideReference({
  id,
  doublon,
  projet,
}: {
  id: string;
  doublon: Doublon | null;
  projet: Projet;
}) {
  if (doublon === null) {
    return (
      <p id={id} className="text-[0.75rem] text-muted-foreground">
        Deux caractères au minimum. Référence unique.
      </p>
    );
  }
  return (
    <p
      id={id}
      role="alert"
      className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-destructive"
    >
      <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      La référence « {doublon.reference} » existe déjà.
      <Link
        to="/$projet/dossiers/$dossierId"
        params={{ projet, dossierId: doublon.id }}
        className="rounded-sm font-[600] underline underline-offset-2"
      >
        Ouvrir ce dossier
      </Link>
    </p>
  );
}

export function FormulaireDossier({ projet }: { projet: Projet }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const referenceId = useId();

  const [terme, setTerme] = useState('');
  const { brouillon, frapper } = useRechercheDifferee(terme, setTerme);
  const [choisi, setChoisi] = useState<ProspectBanque | null>(null);
  const [reference, setReference] = useState('');
  const [banque, setBanque] = useState<string | null>(null);
  const [doublon, setDoublon] = useState<Doublon | null>(null);
  const [demande, setDemande] = useState(false);

  const resultats = useQuery({
    queryKey: ['bank-prospect-search', projet, terme] as const,
    queryFn: () => chercherProspects(terme, PROJET_API[projet]),
    enabled: terme.trim().length >= 2 && choisi === null,
    staleTime: 30_000,
  });

  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const creer = useMutation({
    mutationFn: () => {
      if (choisi === null) throw new Error('Aucun client sélectionné.');
      return ouvrirDossier({
        prospectId: choisi.id,
        reference: reference.trim(),
        ...(banque === null ? {} : { processingBankId: banque }),
      });
    },
    onSuccess: (dossier) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
      toast.success(`Dossier ${dossier.reference} ouvert.`);
      void navigate({
        to: '/$projet/dossiers/$dossierId',
        params: { projet, dossierId: dossier.id },
      });
    },
    onError: (erreur: unknown) => {
      setDoublon(lireDoublon(erreur));
      toastApiError(erreur, 'Le dossier n’a pas pu être créé.');
    },
  });

  const longueur = reference.trim().length;
  const envoyable = choisi !== null && longueur >= 2 && longueur <= 64 && !creer.isPending;

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      onSubmit={(evenement) => {
        evenement.preventDefault();
        if (envoyable) creer.mutate();
      }}
    >
      {choisi === null ? (
        <section className="flex flex-col gap-2">
          <SearchField
            label="Rechercher un client"
            value={brouillon}
            onChange={frapper}
            placeholder="Aminata Diallo, ou 77 123 45 67"
            className="min-w-0"
          />
          <p className="text-[0.8125rem] text-muted-foreground">
            Par nom ou par téléphone. Méthode d’enrôlement obtenue requise.
          </p>
          {terme.trim().length >= 2 ? (
            <div role="status" className="rounded-md border border-border bg-card">
              <ResultatsProspects
                etat={resultats}
                onChoisir={(prospect) => {
                  setChoisi(prospect);
                  setBanque(prospect.banqueId);
                  setDoublon(null);
                }}
                onDemander={() => {
                  setDemande(true);
                }}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <ClientChoisi
          prospect={choisi}
          onChanger={() => {
            setChoisi(null);
            frapper('');
            setDoublon(null);
          }}
        />
      )}

      {/* `disabled` sur le groupe plutôt qu'un voile : la peau désactivée reste
          lisible et dit déjà que le client vient en premier. */}
      <fieldset disabled={choisi === null} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={referenceId}>
            Référence bancaire
            <ChampObligatoire />
          </Label>
          <Input
            id={referenceId}
            value={reference}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            placeholder="CPI-2026-00412"
            aria-invalid={doublon !== null}
            aria-describedby={`${referenceId}-aide`}
            onChange={(evenement) => {
              setReference(evenement.target.value);
              setDoublon(null);
            }}
          />
          <AideReference id={`${referenceId}-aide`} doublon={doublon} projet={projet} />
        </div>

        <ChampSelect
          label="Banque de traitement"
          placeholder="Choisir une banque"
          aide="Pré-remplie avec la banque du client. Modifiable."
          options={enOptions(referentiels.data?.banques)}
          valeur={banque}
          onChange={setBanque}
        />
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          to="/$projet/dossiers"
          params={{ projet }}
          className={buttonVariants({ variant: 'ghost' })}
        >
          Annuler
        </Link>
        <Button type="submit" size="lg" disabled={!envoyable}>
          <Attente enCours={creer.isPending} libelle="Ouvrir le dossier" />
        </Button>
      </div>

      <DialogueDemandeClient ouvert={demande} onOuvert={setDemande} termeInitial={terme} />
    </form>
  );
}
