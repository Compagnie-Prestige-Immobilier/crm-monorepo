'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@crm/api-client/query';
import {
  AlertTriangleIcon,
  CheckIcon,
  LoaderIcon,
  SearchIcon,
  UserPlusIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ClientRequestDialog } from '@/components/bank/client-request-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createBankCase, fetchBankCases, searchBankProspects } from '@/lib/data/bank-cases';
import { fetchBanques } from '@/lib/data/reference';
import { formatPhone, withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { BankProspectSearchItem } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

export function BankCaseForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const searchId = useId();
  const referenceId = useId();
  const bankId = useId();

  const referenceRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<BankProspectSearchItem | null>(null);
  const [reference, setReference] = useState('');
  const [processingBankId, setProcessingBankId] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; reference: string } | null>(null);
  const [requesting, setRequesting] = useState(false);

  const debounced = useDebouncedValue(term.trim());

  const results = useQuery({
    queryKey: ['bank-prospect-search', debounced] as const,
    queryFn: () => searchBankProspects(debounced),
    enabled: debounced.length >= 2 && selected === null,
    staleTime: 30_000,
  });

  const banques = useQuery({
    queryKey: queryKeys.banques,
    queryFn: () => fetchBanques(),
    staleTime: 5 * 60_000,
  });

  const checkReference = useMutation({
    mutationFn: (value: string) =>
      fetchBankCases({
        ...{
          search: value,
          stageId: null,
          stageType: null,
          banqueId: null,
          agentId: null,
          rejectionReasonId: null,
          dateFrom: null,
          dateTo: null,
          amountMin: null,
          amountMax: null,
          page: 1,
          pageSize: 5,
          sortBy: 'updatedAt' as const,
          sortDir: 'desc' as const,
        },
      }),
    onSuccess: (page, value) => {
      const normalized = value.trim().toLowerCase();
      const match = page.items.find((item) => item.reference.trim().toLowerCase() === normalized);
      setDuplicate(match === undefined ? null : { id: match.id, reference: match.reference });
    },
    onError: () => {
      setDuplicate(null);
    },
  });

  const create = useMutation({
    mutationFn: () => {
      if (selected === null) throw new Error('Aucun client sélectionné.');
      const body: { prospectId: string; reference: string; processingBankId?: string } = {
        prospectId: selected.id,
        reference: reference.trim(),
      };
      if (processingBankId !== null) body.processingBankId = processingBankId;
      return createBankCase(body);
    },
    onSuccess: (bankCase) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
      toast.success(`Dossier ${bankCase.reference} ouvert.`);
      router.push(`/dossiers/${bankCase.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        const existing = (error.body as { existing?: { id?: string; reference?: string } })
          .existing;
        if (existing?.id !== undefined && existing.reference !== undefined) {
          setDuplicate({ id: existing.id, reference: existing.reference });
        }
      }
      toastApiError(error, 'Le dossier n’a pas pu être créé.');
    },
  });

  function selectProspect(prospect: BankProspectSearchItem): void {
    setSelected(prospect);
    setProcessingBankId(prospect.banqueId);
    setDuplicate(null);
    requestAnimationFrame(() => {
      referenceRef.current?.focus();
    });
  }

  const referenceValid = reference.trim().length >= 2 && reference.trim().length <= 64;
  const canSubmit = selected !== null && referenceValid && !create.isPending;

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-24 sm:pb-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) create.mutate();
      }}
    >
      {/* ─── 1. Le client ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <Label htmlFor={searchId} className="text-[1rem]">
          Rechercher un client
          <span className="text-destructive" aria-label="obligatoire">
            *
          </span>
        </Label>
        <p id={`${searchId}-aide`} className="text-[0.8125rem] text-muted-foreground">
          Par nom ou par téléphone. Méthode d’enrôlement obtenue requise.
        </p>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            className="h-14 pl-12 text-[1.125rem]"
            autoComplete="off"
            autoFocus
            value={selected === null ? term : selected.fullName}
            aria-describedby={`${searchId}-aide`}
            placeholder="Aminata Diallo, ou 77 123 45 67"
            readOnly={selected !== null}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
          />
          {selected !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2"
              aria-label="Changer de client"
              onClick={() => {
                setSelected(null);
                setTerm('');
                setDuplicate(null);
              }}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {selected === null && debounced.length >= 2 ? (
          <div role="status" className="rounded-md border border-border bg-card">
            {results.isPending ? (
              <div className="flex flex-col gap-2 p-3" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : results.isError ? (
              <p className="p-4 text-[0.875rem] text-destructive">
                La recherche a échoué. Réessayez.
              </p>
            ) : results.data.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-4">
                <div>
                  <p className="text-[0.875rem] font-[600]">Aucun client ne correspond.</p>
                  <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                    Si le client existe mais n’est pas encore en base, demandez sa création au
                    siège. Elle vous reviendra approuvée, prête à recevoir ce dossier.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequesting(true);
                  }}
                >
                  <UserPlusIcon aria-hidden="true" />
                  Demander la création du client
                </Button>
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
                {results.data.map((prospect) => (
                  <li key={prospect.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      onClick={() => {
                        selectProspect(prospect);
                      }}
                    >
                      <UserRoundIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-[600]">{prospect.fullName}</span>
                        <span className="block truncate text-[0.75rem] text-muted-foreground tabular-nums">
                          {formatPhone(prospect.phoneE164)} · {prospect.banqueName}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {/* ─── 2. Résumé compact ──────────────────────────────────────────── */}
      {selected !== null ? (
        <Card className="animate-rise border-primary/30">
          <CardContent className="flex items-start gap-3">
            <CheckIcon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-[600]">{selected.fullName}</p>
              <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
                {formatPhone(selected.phoneE164)}
              </p>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                Nom et téléphone sont copiés sur le dossier.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── 3. Référence et banque ─────────────────────────────────────── */}
      {/* Pas d'`opacity-50` sur le bloc entier tant qu'aucun client n'est
          choisi. Mesuré à l'écran, ce voile faisait tomber le libellé à
          3,59:1, l'astérisque « obligatoire » à 2,48:1 et l'aide de saisie à
          2,32:1 : l'utilisateur ne pouvait plus LIRE ce que la section
          attendait de lui, au moment précis où il cherche quoi faire.
          `disabled` sur le `fieldset` suffit : chaque champ prend la peau
          désactivée (`muted`), qui reste lisible et dit déjà « pas encore ». */}
      <fieldset disabled={selected === null} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={referenceId}>
            Référence bancaire
            <span className="text-destructive" aria-label="obligatoire">
              *
            </span>
          </Label>
          <Input
            id={referenceId}
            ref={referenceRef}
            value={reference}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            placeholder="CPI-2026-00412"
            aria-invalid={duplicate !== null}
            aria-describedby={duplicate !== null ? `${referenceId}-doublon` : `${referenceId}-aide`}
            onChange={(event) => {
              setReference(event.target.value);
              setDuplicate(null);
            }}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value.length >= 2) checkReference.mutate(value);
            }}
          />
          {duplicate === null ? (
            <p id={`${referenceId}-aide`} className="text-[0.75rem] text-muted-foreground">
              Deux caractères au minimum. Référence unique.
              {checkReference.isPending ? ' Vérification en cours…' : ''}
            </p>
          ) : (
            <p
              id={`${referenceId}-doublon`}
              role="alert"
              className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-destructive"
            >
              <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
              La référence « {duplicate.reference} » existe déjà.
              <Link
                href={`/dossiers/${duplicate.id}`}
                className="rounded-sm font-[600] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Ouvrir ce dossier
              </Link>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={bankId}>Banque de traitement</Label>
          {/* `items` : `Select.Value` de Base UI affiche la VALEUR choisie, pas
              le texte de l'item — ici, l'identifiant de la banque. */}
          <Select
            items={(banques.data ?? []).map((banque) => ({
              value: banque.id,
              label: `${withRetired(banque.shortName, banque.isActive)}, ${banque.name}`,
            }))}
            value={processingBankId ?? ''}
            onValueChange={(value) => {
              if (value === null) return;
              setProcessingBankId(value);
            }}
          >
            <SelectTrigger id={bankId} className="w-full">
              <SelectValue placeholder="Choisir une banque" />
            </SelectTrigger>
            <SelectContent>
              {(banques.data ?? []).map((banque) => (
                <SelectItem key={banque.id} value={banque.id}>
                  {withRetired(banque.shortName, banque.isActive)}, {banque.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[0.75rem] text-muted-foreground">
            Pré-remplie avec la banque du client. Modifiable.
          </p>
        </div>
      </fieldset>

      {/*
        Sur petit écran, le bouton est ÉPINGLÉ en bas de la fenêtre.
        Le formulaire dépasse la hauteur d'un téléphone dès que la liste de
        résultats s'ouvre : sans épinglage, l'agent remplit tout puis cherche un
        bouton parti hors de l'écran. `pb-24` sur le formulaire réserve la place
        pour que la barre ne recouvre jamais le dernier champ.
      */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur-sm',
          'sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none',
        )}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-3">
          {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI
              poserait `role="button"` sur le `<a>`. */}
          <Link href="/dossiers" className={buttonVariants({ variant: 'ghost' })}>
            Annuler
          </Link>
          <Button type="submit" size="lg" disabled={!canSubmit} className="flex-1 sm:flex-none">
            {create.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Création…
              </>
            ) : (
              'Ouvrir le dossier'
            )}
          </Button>
        </div>
      </div>

      {/* Le dialogue est PRÉ-REMPLI avec la recherche saisie : l'agent vient de
          taper ce nom ou ce numéro, le lui redemander serait une double saisie
          et une occasion de divergence entre ce qu'il cherchait et ce qu'il
          demande. */}
      <ClientRequestDialog open={requesting} onOpenChange={setRequesting} initialTerm={debounced} />
    </form>
  );
}
