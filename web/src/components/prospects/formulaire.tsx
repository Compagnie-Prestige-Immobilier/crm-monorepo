import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import {
  ChampTelephone,
  indicatifsDe,
  INDICATIF_SENEGAL,
  versE164,
} from '@/components/grand-public/telephone';
import { ConflitTelephoneCarte } from '@/components/prospects/conflit-telephone';
import { useOptionsRepresentants } from '@/components/prospects/options-representants';
import { FormulaireRepresentant } from '@/components/representants/formulaire';
import type { AmorceRepresentant } from '@/components/representants/formulaire-patch';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { Input } from '@/components/ui/input';
import { conflitTelephone, type ConflitTelephone } from '@/lib/data/grand-public';
import { creerProspectChues, type ProspectBody } from '@/lib/data/prospects';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

type Champ = 'prenom' | 'nom' | 'phone';

function valider(etat: {
  prenom: string;
  nom: string;
  phone: string;
  e164: string | null;
}): Partial<Record<Champ, string>> {
  const erreurs: Partial<Record<Champ, string>> = {};
  if (etat.prenom.trim() === '') erreurs.prenom = 'Le prénom est obligatoire.';
  if (etat.nom.trim() === '') erreurs.nom = 'Le nom est obligatoire.';
  if (etat.phone.trim() === '') erreurs.phone = 'Le numéro est obligatoire.';
  else if (etat.e164 === null) erreurs.phone = 'Numéro invalide pour le pays choisi.';
  return erreurs;
}

/**
 * La saisie s'enchaîne : seule l'identité repart de zéro, le représentant, la
 * banque et le syndicat restent pour toute une tournée.
 */
export function FormulaireProspect({
  representantId,
  onEnregistre,
}: {
  representantId: string | null;
  onEnregistre?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const prenomRef = useRef<HTMLInputElement>(null);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [phone, setPhone] = useState('');
  const [indicatif, setIndicatif] = useState(INDICATIF_SENEGAL);
  const [etablissement, setEtablissement] = useState('');
  const [banqueId, setBanqueId] = useState<string | null>(null);
  const [syndicatId, setSyndicatId] = useState<string | null>(null);
  const [repId, setRepId] = useState<string | null>(representantId);
  const [repCree, setRepCree] = useState<OptionFiltre | null>(null);
  const [amorceRep, setAmorceRep] = useState<AmorceRepresentant | null>(null);
  const [erreurs, setErreurs] = useState<Partial<Record<Champ, string>>>({});
  const [conflit, setConflit] = useState<ConflitTelephone | null>(null);
  const [enregistres, setEnregistres] = useState(0);

  const referentiels = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const representants = useOptionsRepresentants(repCree, representantId === null);

  const enregistrer = useMutation({
    mutationFn: (variables: { corps: ProspectBody; enchainer: boolean }) =>
      creerProspectChues(variables.corps),
    onSuccess: (prospect, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      setEnregistres((courant) => courant + 1);
      toast.success(`${prospect.prenom} ${prospect.nom} enregistré.`);

      if (!variables.enchainer) {
        onEnregistre?.();
        return;
      }
      setPrenom('');
      setNom('');
      setPhone('');
      setErreurs({});
      prenomRef.current?.focus();
    },
    onError: (erreur) => {
      const existante = conflitTelephone(erreur);
      if (existante !== null) {
        setConflit(existante);
        return;
      }
      toastApiError(erreur, 'Le prospect n’a pas pu être enregistré.');
    },
  });

  function envoyer(enchainer: boolean): void {
    if (enregistrer.isPending) return;
    const e164 = versE164(phone, indicatif);
    const trouvees = valider({ prenom, nom, phone, e164 });
    setErreurs(trouvees);
    if (e164 === null || Object.keys(trouvees).length > 0) return;

    setConflit(null);
    const lieu = etablissement.trim();
    enregistrer.mutate({
      enchainer,
      corps: {
        prenom: prenom.trim(),
        nom: nom.trim(),
        phone: e164,
        ...(lieu === '' ? {} : { etablissement: lieu }),
        ...(repId === null ? {} : { representantId: repId }),
        ...(banqueId === null ? {} : { banqueId }),
        ...(syndicatId === null ? {} : { syndicatId }),
      },
    });
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- raccourci Ctrl+Entrée du formulaire
    <form
      className="flex w-full flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        envoyer(true);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        envoyer(true);
      }}
    >
      {representantId === null ? (
        <FilterCombobox
          label="Représentant (facultatif)"
          placeholder="Choisir un représentant"
          value={repId}
          options={representants.options}
          filtrer={false}
          onSearchChange={representants.onSearchChange}
          onChange={setRepId}
          onCreer={(terme) => {
            const aDesLettres = /\p{Letter}/u.test(terme);
            setAmorceRep({
              fullName: aDesLettres ? terme : '',
              phone: aDesLettres ? '' : terme,
              notes: '',
            });
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={erreurs.prenom}>
          {(props) => (
            <Input
              {...props}
              ref={prenomRef}
              value={prenom}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => {
                setPrenom(event.target.value);
              }}
            />
          )}
        </Field>
        <Field label="Nom" required error={erreurs.nom}>
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

      <ChampTelephone
        indicatifs={indicatifsDe(referentiels.data?.pays)}
        indicatif={indicatif}
        valeur={phone}
        erreur={erreurs.phone}
        onIndicatif={setIndicatif}
        onChange={(valeur) => {
          setPhone(valeur);
          setConflit(null);
        }}
      />

      <ConflitTelephoneCarte conflit={conflit} />

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
        <FilterCombobox
          label="Banque"
          placeholder="Choisir une banque"
          value={banqueId}
          options={enOptions(referentiels.data?.banques)}
          onChange={setBanqueId}
        />
        <FilterCombobox
          label="Syndicat"
          placeholder="Choisir un syndicat"
          value={syndicatId}
          options={enOptions(referentiels.data?.syndicats)}
          onChange={setSyndicatId}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-[0.8125rem] text-muted-foreground" aria-live="polite">
          {enregistres === 0
            ? 'Ctrl + Entrée enregistre et enchaîne.'
            : `${String(enregistres)} prospect${enregistres > 1 ? 's' : ''} enregistré${enregistres > 1 ? 's' : ''}.`}
        </p>
        {onEnregistre === undefined ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={enregistrer.isPending}
            onClick={() => {
              envoyer(false);
            }}
          >
            Enregistrer et terminer
          </Button>
        )}
        <Button type="submit" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Enregistrer ce prospect
        </Button>
      </div>

      <FormulaireRepresentant
        open={amorceRep !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setAmorceRep(null);
        }}
        representant={null}
        amorce={amorceRep}
        onEnregistre={(cree) => {
          setRepCree({
            value: cree.id,
            label: `${cree.fullName} - ${formatPhone(cree.phoneE164)}`,
            hint: cree.departementName,
          });
          setRepId(cree.id);
          setAmorceRep(null);
        }}
      />
    </form>
  );
}
