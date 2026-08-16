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

/**
 * Ouverture d'un dossier bancaire.
 *
 * UNE colonne, pas d'assistant en trois pages. Le formulaire compte trois
 * champs ; le découper en étapes ajouterait deux clics et deux occasions de
 * perdre la saisie, pour aucune décision supplémentaire. Ce qui est guidé, ce
 * n'est pas la navigation, c'est l'ORDRE : on cherche d'abord la personne, on
 * vérifie qu'on a la bonne, puis on saisit la référence.
 *
 * Le premier champ est dominant parce qu'il porte tout le risque : ouvrir un
 * dossier sur le mauvais homonyme se découvre à l'encaissement, quand l'argent
 * est parti. Le résumé qui suit la sélection existe pour cette vérification-là,
 * et il montre le téléphone : le seul champ réellement discriminant.
 */
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

  // Débounce : l'API n'accepte la recherche qu'à partir de deux caractères et
  // plafonne à 300 requêtes par minute. Une requête par frappe épuiserait le
  // quota au premier nom un peu long. Le délai est celui de tout le panel :
  // cet écran en avait pris un autre (300 ms) sans raison énoncée.
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

  /**
   * Contrôle d'unicité de la référence, au FLOU du champ.
   *
   * À chaque frappe, ce serait une requête par caractère pour une information
   * qui n'a de sens qu'une fois la référence complète. Au flou, l'agent a fini
   * de saisir et l'information arrive au moment où elle sert : avant qu'il
   * n'atteigne le bouton d'envoi.
   *
   * Ce contrôle ne REMPLACE pas celui du serveur : l'unicité est une contrainte
   * PostgreSQL, et deux agents peuvent saisir la même référence à la seconde
   * près. Il évite seulement de découvrir le conflit après avoir tout rempli.
   */
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
      // Un contrôle indisponible ne doit pas bloquer la saisie : le serveur
      // refusera de toute façon un doublon. On efface simplement l'avis.
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
      // Le succès n'est annoncé qu'ICI, après la réponse du serveur : jamais au
      // clic. Un message optimiste sur un POST qui échoue ensuite laisse l'agent
      // convaincu d'avoir ouvert un dossier qui n'existe pas.
      toast.success(`Dossier ${bankCase.reference} ouvert.`);
      router.push(`/dossiers/${bankCase.id}`);
    },
    onError: (error) => {
      // Le conflit de référence porte l'identifiant du dossier existant : on
      // s'en sert pour renvoyer l'agent vers lui plutôt que de le laisser
      // chercher.
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
    // La banque du prospect est PRÉ-REMPLIE mais reste modifiable : c'est le
    // cas courant, pas une règle. Un client peut faire traiter son dossier
    // ailleurs, et forcer la banque d'origine obligerait à corriger après coup.
    setProcessingBankId(prospect.banqueId);
    setDuplicate(null);
    // Le focus saute à la référence : c'est le champ suivant du geste réel, et
    // laisser le focus dans la recherche rouvrirait la liste de résultats.
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
            // Champ DOMINANT : 56 px et un texte de 18 px, contre 44 et 15 pour
            // les autres. La hiérarchie visuelle dit où commencer.
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
              /* ─── L'IMPASSE, ET SA SORTIE ────────────────────────────────
                 Cet état n'affichait que « Aucun client ne correspond. » et
                 s'arrêtait là. Le rôle BANQUE_FINANCE n'a aucune route de
                 création de prospect, et rien ne remontait au siège : le
                 dossier ne se faisait pas, ou se faisait sur un homonyme, ce
                 qui se découvre à l'encaissement, quand l'argent est parti. */
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
          <Button
            type="submit"
            size="lg"
            // Désactivé PENDANT l'envoi : un double-clic créerait deux dossiers,
            // dont le second échouerait en conflit de référence : et l'agent
            // verrait une erreur alors que son dossier vient d'être créé.
            disabled={!canSubmit}
            className="flex-1 sm:flex-none"
          >
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
