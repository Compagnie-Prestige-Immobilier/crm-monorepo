'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Field } from '@/components/forms/field';
import {
  InternationalPhoneField,
  toInternationalE164,
} from '@/components/forms/international-phone-field';
import {
  RepresentantFormDialog,
  type RepresentantPrefill,
} from '@/components/representants/representant-form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createProspect,
  prospectPhoneConflict,
  type CreateProspectInput,
  type ProspectPhoneConflict,
} from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchRepresentants } from '@/lib/data/representants';
import { formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { EMPTY_REPRESENTANT_FILTERS } from '@/lib/representant-filters';
import type { FilterOption, ReferenceData } from '@/lib/types';

type FieldName = 'prenom' | 'nom' | 'phone';

type Errors = Partial<Record<FieldName, string>>;

interface SaveVariables {
  input: CreateProspectInput;
  andNext: boolean;
}

function optionsRepresentants(source: {
  createdRep: FilterOption | null;
  repSearch: string;
  connus: readonly FilterOption[];
  trouves: readonly { id: string; fullName: string; phoneE164: string; departementName: string }[];
}): FilterOption[] {
  const trouves = source.trouves.map((item) => ({
    value: item.id,
    label: `${item.fullName} - ${formatPhone(item.phoneE164)}`,
    hint: item.departementName,
  }));
  const candidats = [
    ...(source.createdRep === null ? [] : [source.createdRep]),
    ...(source.repSearch.trim() === '' ? source.connus : trouves),
  ];
  return candidats.filter(
    (option, index, options) => options.findIndex((item) => item.value === option.value) === index,
  );
}

function pluralSuffix(count: number): string {
  return count > 1 ? 's' : '';
}

function shouldSearchRepresentants(representantId: string | null, repSearch: string): boolean {
  return representantId === null && repSearch.trim() !== '';
}

function activeBankOptions(reference: ReferenceData | undefined): FilterOption[] {
  const banques = reference?.banques ?? [];
  return banques
    .filter((banque) => banque.isActive)
    .map((banque) => ({ value: banque.id, label: banque.name, hint: banque.shortName }));
}

function activeSyndicatOptions(reference: ReferenceData | undefined): FilterOption[] {
  const syndicats = reference?.syndicats ?? [];
  return syndicats
    .filter((syndicat) => syndicat.isActive)
    .map((syndicat) => ({ value: syndicat.id, label: syndicat.name, hint: syndicat.sigle }));
}

function representantLabelFor(options: FilterOption[], repId: string | null): string | undefined {
  return options.find((option) => option.value === repId)?.label.split(' - ')[0];
}

function validateProspectForm(
  prenom: string,
  nom: string,
  phone: string,
  e164: string | null,
): Errors {
  const found: Errors = {};
  if (prenom.trim() === '') found.prenom = 'Le prénom est obligatoire.';
  if (nom.trim() === '') found.nom = 'Le nom est obligatoire.';
  if (phone.trim() === '') found.phone = 'Le numéro est obligatoire.';
  else if (e164 === null) found.phone = 'Numéro invalide pour le pays choisi.';
  return found;
}

function buildCreateProspectInput(fields: {
  prenom: string;
  nom: string;
  e164: string;
  etablissement: string;
  repId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
}): CreateProspectInput {
  return {
    prenom: fields.prenom.trim(),
    nom: fields.nom.trim(),
    phone: fields.e164,
    ...(fields.etablissement.trim() === '' ? {} : { etablissement: fields.etablissement.trim() }),
    ...(fields.repId === null ? {} : { representantId: fields.repId }),
    ...(fields.banqueId === null ? {} : { banqueId: fields.banqueId }),
    ...(fields.syndicatId === null ? {} : { syndicatId: fields.syndicatId }),
  };
}

function RepresentantPicker({
  representantId,
  repId,
  options,
  onChange,
  onSearchChange,
  onCreate,
}: {
  representantId: string | null;
  repId: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onCreate: (search: string) => void;
}) {
  if (representantId !== null) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <FilterCombobox
        label="Représentant (facultatif)"
        placeholder="Choisir un représentant"
        value={repId}
        options={options}
        onChange={onChange}
        onSearchChange={onSearchChange}
        filterOptions={false}
        onCreate={onCreate}
      />
    </div>
  );
}

function PhoneConflictCard({
  conflict,
  phone,
  callingCode,
}: {
  conflict: ProspectPhoneConflict | null;
  phone: string;
  callingCode: string;
}) {
  if (conflict === null) return null;
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex items-start gap-3">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div role="alert" className="flex min-w-0 flex-col gap-1">
          <p className="font-[600]">
            Ce numéro est déjà celui de {conflict.prenom} {conflict.nom}.
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Rattaché à {conflict.representantName}, saisi par le téléconseiller{' '}
            {conflict.ownedByCommercialName} le {formatDateTime(conflict.createdAt)}.
          </p>
          <Link
            href={`/chues/prospects?search=${encodeURIComponent(toInternationalE164(phone, callingCode) ?? phone)}`}
            className="w-fit rounded-sm font-[600] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Ouvrir la fiche existante
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitLabel({ pending }: { pending: boolean }) {
  if (!pending) return 'Enregistrer ce prospect';
  return (
    <>
      <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
      Enregistrement…
    </>
  );
}

function SubmitRow({
  showSaveAndClose,
  pending,
  onSaveAndClose,
}: {
  showSaveAndClose: boolean;
  pending: boolean;
  onSaveAndClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <p className="mr-auto text-[0.8125rem] text-muted-foreground">
        Ctrl + Entrée enregistre et enchaîne.
      </p>
      {showSaveAndClose ? (
        <Button type="button" variant="outline" disabled={pending} onClick={onSaveAndClose}>
          Enregistrer et terminer
        </Button>
      ) : null}
      <Button type="submit" disabled={pending}>
        <SubmitLabel pending={pending} />
      </Button>
    </div>
  );
}

function SavedStatusLine({
  visible,
  saved,
  representantLabel,
}: {
  visible: boolean;
  saved: string[];
  representantLabel: string | undefined;
}) {
  if (!visible) return null;

  const plural = pluralSuffix(saved.length);
  const pourLabel = representantLabel === undefined ? '' : ` pour ${representantLabel}`;
  const texte =
    saved.length === 0
      ? 'Aucun prospect noté pour l’instant.'
      : `${String(saved.length)} prospect${plural} noté${plural}${pourLabel} aujourd’hui`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p aria-live="polite" className="text-[0.875rem] text-muted-foreground">
        {texte}
      </p>
      <Link
        href="/chues"
        className="rounded-sm text-[0.875rem] font-[600] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Terminé, revenir au projet
      </Link>
    </div>
  );
}

export function ProspectCreateForm({
  representantId,
  onSaved,
}: {
  representantId: string | null;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const prenomRef = useRef<HTMLInputElement>(null);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [phone, setPhone] = useState('');
  const [callingCode, setCallingCode] = useState('221');
  const [etablissement, setEtablissement] = useState('');
  const [banqueId, setBanqueId] = useState<string | null>(null);
  const [syndicatId, setSyndicatId] = useState<string | null>(null);
  const [repId, setRepId] = useState<string | null>(representantId);
  const [repSearch, setRepSearch] = useState('');
  const [createdRep, setCreatedRep] = useState<FilterOption | null>(null);
  const [repPrefill, setRepPrefill] = useState<RepresentantPrefill | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<ProspectPhoneConflict | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const searchedRepresentants = useQuery({
    queryKey: [...queryKeys.representantsRoot, 'select', repSearch.trim()],
    queryFn: () =>
      fetchRepresentants({
        ...EMPTY_REPRESENTANT_FILTERS,
        search: repSearch.trim(),
        sortBy: 'fullName',
        sortDir: 'asc',
        pageSize: 20,
      }),
    enabled: shouldSearchRepresentants(representantId, repSearch),
  });

  const save = useMutation({
    mutationFn: (variables: SaveVariables) => createProspect(variables.input),
    onSuccess: (prospect, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      setSaved((previous) => [...previous, `${prospect.prenom} ${prospect.nom}`]);
      toast.success(`${prospect.prenom} ${prospect.nom} enregistré.`);

      // « Enregistrer et terminer » n'existe que dans la boîte de dialogue, qui
      // se ferme dessus. Sur l'écran de saisie, on reste : la tournée continue.
      if (!variables.andNext) {
        onSaved?.();
        return;
      }

      // La rafale : seule l'identité repart de zéro. L'établissement, la banque
      // et le syndicat sont les mêmes pour toute une tournée chez le même
      // représentant.
      setPrenom('');
      setNom('');
      setPhone('');
      setErrors({});
      prenomRef.current?.focus();
    },
    onError: (error) => {
      const existing = prospectPhoneConflict(error);
      if (existing !== null) {
        setConflict(existing);
        return;
      }
      toastApiError(error, 'Le prospect n’a pas pu être enregistré.');
    },
  });

  function submit(andNext: boolean): void {
    if (save.isPending) return;

    const e164 = toInternationalE164(phone, callingCode);
    const found = validateProspectForm(prenom, nom, phone, e164);
    setErrors(found);
    if (e164 === null || Object.keys(found).length > 0) return;

    setConflict(null);
    save.mutate({
      input: buildCreateProspectInput({
        prenom,
        nom,
        e164,
        etablissement,
        repId,
        banqueId,
        syndicatId,
      }),
      andNext,
    });
  }

  const representantOptions = optionsRepresentants({
    createdRep,
    repSearch,
    connus: reference.data?.representants ?? [],
    trouves: searchedRepresentants.data?.items ?? [],
  });

  // Le libellé porte « Nom - téléphone » ; sous le formulaire, seul le nom se lit.
  const representantLabel = representantLabelFor(representantOptions, repId);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- raccourci Ctrl+Entrée du formulaire
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit(true);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        submit(true);
      }}
    >
      <RepresentantPicker
        representantId={representantId}
        repId={repId}
        options={representantOptions}
        onChange={setRepId}
        onSearchChange={setRepSearch}
        onCreate={(search) => {
          const hasLetters = /\p{Letter}/u.test(search);
          setRepPrefill({
            fullName: hasLetters ? search : '',
            phone: hasLetters ? '' : search,
            notes: '',
          });
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.prenom}>
          {(props) => (
            <Input
              {...props}
              ref={prenomRef}
              value={prenom}
              maxLength={120}
              autoComplete="off"
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- premier champ du formulaire
              autoFocus
              onChange={(event) => {
                setPrenom(event.target.value);
              }}
            />
          )}
        </Field>

        <Field label="Nom" required error={errors.nom}>
          {(props) => (
            <Input
              {...props}
              value={nom}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => {
                setNom(event.target.value);
              }}
            />
          )}
        </Field>
      </div>

      <InternationalPhoneField
        value={phone}
        callingCode={callingCode}
        error={errors.phone}
        onCallingCodeChange={setCallingCode}
        onChange={(value) => {
          setPhone(value);
          setConflict(null);
        }}
      />

      <PhoneConflictCard conflict={conflict} phone={phone} callingCode={callingCode} />

      <Field label="Établissement">
        {(props) => (
          <Input
            {...props}
            value={etablissement}
            maxLength={160}
            autoComplete="off"
            onChange={(event) => {
              setEtablissement(event.target.value);
            }}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FilterCombobox
            label="Banque"
            placeholder="Choisir une banque"
            value={banqueId}
            options={activeBankOptions(reference.data)}
            onChange={setBanqueId}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FilterCombobox
            label="Syndicat"
            placeholder="Choisir un syndicat"
            value={syndicatId}
            options={activeSyndicatOptions(reference.data)}
            onChange={setSyndicatId}
          />
        </div>
      </div>

      {/* UNE action : enregistrer. Le formulaire se vide, le représentant, la
          banque et le syndicat restent : la tournée s'enchaîne sans un clic de
          plus, et sortir de l'écran est un lien, pas un second bouton. */}
      <SubmitRow
        showSaveAndClose={onSaved !== undefined}
        pending={save.isPending}
        onSaveAndClose={() => {
          submit(false);
        }}
      />

      <SavedStatusLine
        visible={onSaved === undefined}
        saved={saved}
        representantLabel={representantLabel}
      />

      <RepresentantFormDialog
        open={repPrefill !== null}
        onOpenChange={(open) => {
          if (!open) setRepPrefill(null);
        }}
        representant={null}
        prefill={repPrefill}
        onSaved={(representant) => {
          setCreatedRep({
            value: representant.id,
            label: `${representant.fullName} - ${formatPhone(representant.phoneE164)}`,
            hint: representant.departementName,
          });
          setRepId(representant.id);
          setRepPrefill(null);
        }}
      />
    </form>
  );
}
