import { useQuery } from '@tanstack/react-query';
import { useState, type Dispatch, type SetStateAction } from 'react';

import { AideNumero, type ConflitNumero } from '@/components/representants/aide-numero';
import type { RelationRepresentant } from '@/components/representants/filtres';
import {
  ChampRelation,
  ChampsQualification,
  ChampsWhatsappProfession,
  ChampTexte,
} from '@/components/representants/formulaire-champs';
import type { SaisieFiche } from '@/components/representants/formulaire-patch';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  enOptions,
  fetchIefs,
  fetchReferentiels,
  REFERENTIELS_STALE_MS,
} from '@/lib/data/referentiels';
import type { Representant, StatutWhatsapp } from '@/lib/data/representants';
import { queryKeys } from '@/lib/query-keys';

export type SaisieOuverte = Omit<SaisieFiche, 'departementId'> & {
  departementId: string | null;
};

export interface IdsFiche {
  nom: string;
  phone: string;
  notes: string;
  relation: string;
  motif: string;
  whatsapp: string;
  whatsappNumber: string;
  profession: string;
  prenom: string;
  etablissement: string;
  connaitUES: string;
  contacte: string;
}

function ChampsLocalisation({
  saisie,
  setSaisie,
}: {
  saisie: SaisieOuverte;
  setSaisie: Dispatch<SetStateAction<SaisieOuverte>>;
}) {
  const [regionBrouillon, setRegionBrouillon] = useState<string | null>(null);

  const referentiels = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });
  const iefs = useQuery({
    queryKey: queryKeys.iefs,
    queryFn: () => fetchIefs(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const departements = referentiels.data?.departements ?? [];
  const regionId =
    departements.find((item) => item.id === saisie.departementId)?.regionId ?? regionBrouillon;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FilterCombobox
          label="Région"
          placeholder="Toutes les régions"
          value={regionId}
          options={enOptions(referentiels.data?.regions)}
          onChange={(valeur) => {
            setRegionBrouillon(valeur);
            setSaisie((courant) => ({ ...courant, departementId: null, iefId: null }));
          }}
        />
        <FilterCombobox
          label="Département"
          placeholder="Choisir un département"
          required
          value={saisie.departementId}
          options={enOptions(
            departements.filter((item) => regionId === null || item.regionId === regionId),
            (item) => item.regionName ?? undefined,
          )}
          onChange={(departementId) => {
            setSaisie((courant) => ({ ...courant, departementId, iefId: null }));
          }}
        />
        <FilterCombobox
          label="IEF"
          placeholder="Aucune"
          value={saisie.iefId}
          options={enOptions(
            (iefs.data ?? []).filter(
              (ief) => saisie.departementId === null || ief.departementId === saisie.departementId,
            ),
            (item) => item.departementName ?? undefined,
          )}
          onChange={(iefId) => {
            setSaisie((courant) => ({ ...courant, iefId }));
          }}
        />
      </div>
      <p className="-mt-2 text-[0.75rem] text-muted-foreground">
        L’IEF est facultative : les fiches saisies avant l’arrivée de ce référentiel n’en portent
        pas.
      </p>
    </>
  );
}

function ChampsEdition({
  ids,
  saisie,
  representant,
  modifier,
}: {
  ids: IdsFiche;
  saisie: SaisieOuverte;
  representant: Representant;
  modifier: <K extends keyof SaisieOuverte>(cle: K, valeur: SaisieOuverte[K]) => void;
}) {
  const syndicats = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  }).data?.syndicats;
  // Le champ stocke le NOM du syndicat ; le combobox choisit par id, résolu ici.
  const syndicatId = (syndicats ?? []).find((item) => item.name === saisie.syndicat)?.id ?? null;

  return (
    <>
      <ChampRelation
        relationId={ids.relation}
        motifId={ids.motif}
        representant={representant}
        relationStatus={saisie.relationStatus}
        basculeVersRefus={
          saisie.relationStatus === 'REFUS' && representant.relationStatus !== 'REFUS'
        }
        motif={saisie.relationReason}
        onRelationStatus={(valeur: RelationRepresentant) => {
          modifier('relationStatus', valeur);
        }}
        onMotif={(valeur) => {
          modifier('relationReason', valeur);
        }}
      />

      <ChampsWhatsappProfession
        ids={{
          whatsapp: ids.whatsapp,
          whatsappNumber: ids.whatsappNumber,
          profession: ids.profession,
        }}
        whatsappStatus={saisie.whatsappStatus}
        whatsappNumber={saisie.whatsappNumber}
        profession={saisie.profession}
        onChange={{
          whatsappStatus: (valeur: StatutWhatsapp) => {
            modifier('whatsappStatus', valeur);
          },
          whatsappNumber: (valeur) => {
            modifier('whatsappNumber', valeur);
          },
          profession: (valeur) => {
            modifier('profession', valeur);
          },
        }}
      />

      <ChampsQualification
        ids={{
          prenom: ids.prenom,
          etablissement: ids.etablissement,
          connaitUES: ids.connaitUES,
          contacte: ids.contacte,
        }}
        valeurs={saisie}
        syndicatId={syndicatId}
        syndicatOptions={enOptions((syndicats ?? []).filter((item) => item.isActive !== false))}
        onChange={{
          prenom: (valeur) => {
            modifier('prenom', valeur);
          },
          etablissement: (valeur) => {
            modifier('etablissement', valeur);
          },
          syndicat: (id) => {
            modifier('syndicat', (syndicats ?? []).find((item) => item.id === id)?.name ?? '');
          },
          connaitUES: (valeur) => {
            modifier('connaitUES', valeur);
          },
          contacte: (valeur) => {
            modifier('contacte', valeur);
          },
        }}
      />
    </>
  );
}

export function CorpsFormulaireRepresentant({
  ids,
  saisie,
  setSaisie,
  representant,
  conflit,
  setConflit,
  verification,
  onVerifierNumero,
}: {
  ids: IdsFiche;
  saisie: SaisieOuverte;
  setSaisie: Dispatch<SetStateAction<SaisieOuverte>>;
  representant: Representant | null;
  conflit: ConflitNumero | null;
  setConflit: (conflit: ConflitNumero | null) => void;
  verification: boolean;
  onVerifierNumero: (numero: string) => void;
}) {
  const modifier = <K extends keyof SaisieOuverte>(cle: K, valeur: SaisieOuverte[K]): void => {
    setSaisie((courant) => ({ ...courant, [cle]: valeur }));
  };

  return (
    <div className="flex flex-col gap-4">
      <ChampTexte
        id={ids.nom}
        label="Nom complet"
        value={saisie.fullName}
        maxLength={160}
        onChange={(fullName) => {
          modifier('fullName', fullName);
        }}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.phone}>Téléphone</Label>
        <Input
          id={ids.phone}
          value={saisie.phone}
          maxLength={40}
          inputMode="tel"
          autoComplete="off"
          placeholder="77 123 45 67"
          aria-invalid={conflit !== null}
          aria-describedby={conflit === null ? `${ids.phone}-aide` : `${ids.phone}-conflit`}
          onChange={(event) => {
            modifier('phone', event.target.value);
            setConflit(null);
          }}
          onBlur={(event) => {
            const valeur = event.target.value.trim();
            if (valeur.replace(/\D/gu, '').length >= 9) onVerifierNumero(valeur);
          }}
        />
        <AideNumero phoneId={ids.phone} conflit={conflit} verification={verification} />
      </div>

      <ChampsLocalisation saisie={saisie} setSaisie={setSaisie} />

      {representant === null ? null : (
        <ChampsEdition ids={ids} saisie={saisie} representant={representant} modifier={modifier} />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.notes}>Notes</Label>
        <Textarea
          id={ids.notes}
          value={saisie.notes}
          rows={3}
          maxLength={2000}
          onChange={(event) => {
            modifier('notes', event.target.value);
          }}
        />
      </div>
    </div>
  );
}
