'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, LoaderIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Field } from '@/components/forms/field';
import {
  InternationalPhoneField,
  toInternationalE164,
} from '@/components/forms/international-phone-field';
import { Button } from '@/components/ui/button';
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
import {
  DUREES_MOIS,
  PROSPECT_TYPES,
  PROSPECT_TYPE_LABELS,
  createGrandPublicProspect,
  formatDureeMois,
  fetchCanauxProvenance,
  grandPublicKeys,
  type GrandPublicProspectInput,
  type ProspectType,
} from '@/lib/data/grand-public';
import { prospectPhoneConflict, type ProspectPhoneConflict } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { PaymentMode } from '@/lib/types';

type Errors = Partial<Record<'prenom' | 'nom' | 'phone' | 'banqueId', string>>;

export function GrandPublicProspectForm({
  embedded = false,
  onSaved,
}: {
  embedded?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prenomRef = useRef<HTMLInputElement>(null);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [phone, setPhone] = useState('');
  const [callingCode, setCallingCode] = useState('221');
  const [professionId, setProfessionId] = useState<string | null>(null);
  const [incomeBandId, setIncomeBandId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [type, setType] = useState<ProspectType | null>(null);
  const [banqueId, setBanqueId] = useState<string | null>(null);
  const [syndicatId, setSyndicatId] = useState<string | null>(null);
  const [dureeMois, setDureeMois] = useState<number | null>(null);
  const [canalId, setCanalId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<ProspectPhoneConflict | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const canaux = useQuery({
    queryKey: grandPublicKeys.canaux,
    queryFn: () => fetchCanauxProvenance(),
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (variables: { input: GrandPublicProspectInput; andNext: boolean }) =>
      createGrandPublicProspect(variables.input),
    onSuccess: (prospect, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      setSaved((previous) => [...previous, `${prospect.prenom} ${prospect.nom}`]);
      toast.success(`${prospect.prenom} ${prospect.nom} enregistré.`);

      if (!variables.andNext) {
        if (onSaved !== undefined) {
          onSaved();
          return;
        }
        router.push(`/grand-public/${prospect.id}`);
        return;
      }

      // Seule l'identité repart de zéro : une rafale vient du même canal et
      // s'accorde sur la même durée de système.
      setPrenom('');
      setNom('');
      setPhone('');
      setProfessionId(null);
      setIncomeBandId(null);
      setType(null);
      setBanqueId(null);
      setSyndicatId(null);
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
    const found: Errors = {};
    if (prenom.trim() === '') found.prenom = 'Le prénom est obligatoire.';
    if (nom.trim() === '') found.nom = 'Le nom est obligatoire.';
    if (phone.trim() === '') found.phone = 'Le numéro est obligatoire.';
    else if (e164 === null) found.phone = 'Numéro invalide pour le pays choisi.';
    if (type === 'FONCTIONNAIRE' && banqueId === null) {
      found.banqueId = 'Choisissez la banque de domiciliation.';
    }

    setErrors(found);
    if (e164 === null || Object.keys(found).length > 0) return;

    setConflict(null);
    const input: GrandPublicProspectInput = { prenom: prenom.trim(), nom: nom.trim(), phone: e164 };
    if (professionId !== null) input.professionId = professionId;
    if (incomeBandId !== null) input.incomeBandId = incomeBandId;
    if (paymentMode !== null) input.paymentMode = paymentMode;
    if (type !== null) input.type = type;
    if (banqueId !== null) input.banqueId = banqueId;
    if (syndicatId !== null) input.syndicatId = syndicatId;
    if (paymentMode === 'ECHELONNE' && dureeMois !== null) input.dureeSystemeMois = dureeMois;
    if (canalId !== null) input.canalProvenanceId = canalId;

    save.mutate({ input, andNext });
  }

  const last = saved.at(-1);
  const plural = saved.length > 1 ? 's' : '';
  const searchHref = `/grand-public?search=${encodeURIComponent(toInternationalE164(phone, callingCode) ?? phone)}`;
  const selectedProfession = reference.data?.professions.find(
    (profession) => profession.id === professionId,
  );

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
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
      {embedded ? null : (
        <div>
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            Nouveau prospect Grand Public
          </h1>
          <p className="text-body text-muted-foreground">
            Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.prenom}>
          {(props) => (
            <Input
              {...props}
              ref={prenomRef}
              value={prenom}
              maxLength={120}
              autoComplete="off"
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

      {conflict !== null ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3">
            <AlertTriangleIcon
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div role="alert" className="flex min-w-0 flex-col gap-1">
              <p className="font-[600]">
                Ce numéro est déjà celui de {conflict.prenom} {conflict.nom}.
              </p>
              <p className="text-[0.8125rem] text-muted-foreground">
                Saisi par le téléconseiller {conflict.ownedByCommercialName} le{' '}
                {formatDateTime(conflict.createdAt)}.
              </p>
              <Link
                href={searchHref}
                className="w-fit rounded-sm font-[600] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Chercher cette fiche dans le Grand Public
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <FilterCombobox
        label="Profession"
        placeholder="Rechercher une profession"
        value={professionId}
        options={(reference.data?.professions ?? [])
          .filter((profession) => profession.isActive)
          .map((profession) => ({ value: profession.id, label: profession.label }))}
        onChange={setProfessionId}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[0.875rem] font-[600] text-foreground">Situation</legend>
        <div className="flex flex-wrap gap-2">
          {PROSPECT_TYPES.map((option) => {
            const active = type === option;
            return (
              <Button
                key={option}
                type="button"
                size="lg"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                onClick={() => {
                  setType(active ? null : option);
                }}
              >
                {PROSPECT_TYPE_LABELS[option]}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilterCombobox
          label="Banque de domiciliation"
          placeholder="Choisir une banque"
          value={banqueId}
          options={(reference.data?.banques ?? [])
            .filter((banque) => banque.isActive)
            .map((banque) => ({ value: banque.id, label: banque.name, hint: banque.shortName }))}
          onChange={setBanqueId}
        />
        {errors.banqueId ? (
          <p role="alert" className="text-[0.75rem] text-destructive">
            {errors.banqueId}
          </p>
        ) : null}
        {selectedProfession?.isTeaching ? (
          <FilterCombobox
            label="Syndicat"
            placeholder="Choisir un syndicat"
            value={syndicatId}
            options={(reference.data?.syndicats ?? [])
              .filter((syndicat) => syndicat.isActive)
              .map((syndicat) => ({
                value: syndicat.id,
                label: syndicat.name,
                hint: syndicat.sigle,
              }))}
            onChange={setSyndicatId}
          />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilterCombobox
          label="Revenu mensuel"
          placeholder="Choisir une tranche"
          value={incomeBandId}
          options={(reference.data?.incomeBands ?? [])
            .filter((band) => band.isActive)
            .map((band) => ({ value: band.id, label: band.label }))}
          onChange={setIncomeBandId}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="gp-paiement">Paiement</Label>
          <Select
            value={paymentMode ?? ''}
            onValueChange={(value) => {
              const mode = value === '' || value === null ? null : (value as PaymentMode);
              setPaymentMode(mode);
              if (mode !== 'ECHELONNE') setDureeMois(null);
            }}
          >
            <SelectTrigger id="gp-paiement">
              <SelectValue placeholder="Choisir un mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPTANT">Comptant</SelectItem>
              <SelectItem value="ECHELONNE">Échelonné</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {paymentMode === 'ECHELONNE' ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="gp-duree">Durée de remboursement</Label>
            <Select
              value={dureeMois === null ? '' : String(dureeMois)}
              onValueChange={(value) => {
                setDureeMois(value === null || value === '' ? null : Number(value));
              }}
            >
              <SelectTrigger id="gp-duree">
                <SelectValue placeholder="Choisir une durée" />
              </SelectTrigger>
              <SelectContent>
                {DUREES_MOIS.map((mois) => (
                  <SelectItem key={mois} value={String(mois)}>
                    {formatDureeMois(mois)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <FilterCombobox
          label="Canal de provenance"
          placeholder="Choisir un canal"
          value={canalId}
          options={(canaux.data ?? [])
            .filter((canal) => canal.isActive)
            .map((canal) => ({ value: canal.id, label: canal.label }))}
          onChange={setCanalId}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p aria-live="polite" className="mr-auto text-[0.8125rem] text-muted-foreground">
          {last === undefined
            ? 'Ctrl + Entrée enregistre et enchaîne. Le canal et la durée restent en place.'
            : `${String(saved.length)} prospect${plural} enregistré${plural}. Dernier : ${last}.`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={save.isPending}
          onClick={() => {
            submit(false);
          }}
        >
          Enregistrer et ouvrir la fiche
        </Button>
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? (
            <>
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Enregistrement…
            </>
          ) : (
            'Enregistrer et suivant'
          )}
        </Button>
      </div>
    </form>
  );
}
