import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import { ChampsSituation } from '@/components/grand-public/champs-situation';
import {
  FICHE_VIDE,
  corpsDe,
  corpsSansVides,
  ficheDepuis,
  patchEntre,
  type EtatFiche,
} from '@/components/grand-public/corps-prospect';
import { IdentiteChamps, type ErreursIdentite } from '@/components/grand-public/identite-champs';
import { MontantsChamps } from '@/components/grand-public/montants-champs';
import { ChoixSituation, PiedFormulaire } from '@/components/grand-public/pied-formulaire';
import { SITUATION_VIDE, pourSituation } from '@/components/grand-public/situation';
import { INDICATIF_SENEGAL, indicatifsDe, versE164 } from '@/components/grand-public/telephone';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import type { Prospect } from '@/lib/data/console';
import {
  conflitTelephone,
  creerProspect,
  modifierProspect,
  type ConflitTelephone,
} from '@/lib/data/grand-public';
import {
  REFERENTIELS_STALE_MS,
  actifs,
  fetchReferentiel,
  fetchReferentiels,
  libelle,
} from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const CLE_CANAUX = [...queryKeys.referentielsRoot, 'canaux-provenance'] as const;

export function ProspectFormulaire({
  initial,
  embarque = false,
  onEnregistre,
}: {
  /** Présente : le formulaire MODIFIE cette fiche au lieu d'en créer une. */
  initial?: Prospect | undefined;
  embarque?: boolean | undefined;
  onEnregistre?: ((prospect: Prospect) => void) | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prenomRef = useRef<HTMLInputElement>(null);

  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const canaux = useQuery({
    queryKey: CLE_CANAUX,
    queryFn: () => fetchReferentiel('canaux-provenance'),
    staleTime: REFERENTIELS_STALE_MS,
  });

  // Le découpage de départ sert AUSSI de référence au correctif : recalculé
  // plus tard sur une autre liste d'indicatifs, il ferait un faux changement.
  const [depart] = useState<EtatFiche>(() =>
    initial === undefined ? FICHE_VIDE : ficheDepuis(initial, indicatifsDe(null)),
  );
  const [etat, setEtat] = useState<EtatFiche>(depart);
  const [erreurs, setErreurs] = useState<ErreursIdentite>({});
  const [conflit, setConflit] = useState<ConflitTelephone | null>(null);
  const [enregistres, setEnregistres] = useState<string[]>([]);

  const indicatifs = indicatifsDe(referentiels.data?.pays);

  const poser = (patch: Partial<EtatFiche>): void => {
    setEtat((precedent) => ({ ...precedent, ...patch }));
  };

  const enregistrer = useMutation({
    mutationFn: (_variables: { suivant: boolean }) => {
      const corps = corpsDe(etat, versE164(etat.phone, etat.indicatif) ?? '');
      if (initial === undefined) return creerProspect(corpsSansVides(corps));
      return modifierProspect(initial.id, patchEntre(corpsDe(depart, initial.phoneE164), corps));
    },
    onSuccess: (prospect, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });

      if (initial !== undefined) {
        toast.success('Fiche modifiée.');
        onEnregistre?.(prospect);
        return;
      }

      setEnregistres((precedent) => [...precedent, `${prospect.prenom} ${prospect.nom}`]);
      toast.success(`${prospect.prenom} ${prospect.nom} enregistré.`);

      if (!variables.suivant) {
        if (onEnregistre !== undefined) {
          onEnregistre(prospect);
          return;
        }
        void navigate({ to: '/$projet/$id', params: { projet: 'grand-public', id: prospect.id } });
        return;
      }

      // Seule l'identité repart de zéro : une rafale vient du même canal et
      // s'accorde sur la même durée de système.
      poser({
        prenom: '',
        nom: '',
        phone: '',
        professionId: null,
        incomeBandId: null,
        type: null,
        situation: SITUATION_VIDE,
      });
      setErreurs({});
      prenomRef.current?.focus();
    },
    onError: (error) => {
      const existante = conflitTelephone(error);
      if (existante !== null) {
        setConflit(existante);
        return;
      }
      toastApiError(error, 'Le prospect n’a pas pu être enregistré.');
    },
  });

  function soumettre(suivant: boolean): void {
    if (enregistrer.isPending) return;
    const trouvees: ErreursIdentite = {};
    if (etat.prenom.trim() === '') trouvees.prenom = 'Le prénom est obligatoire.';
    if (etat.nom.trim() === '') trouvees.nom = 'Le nom est obligatoire.';
    if (versE164(etat.phone, etat.indicatif) === null) {
      trouvees.phone = 'Le numéro est obligatoire.';
    }
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;
    setConflit(null);
    enregistrer.mutate({ suivant });
  }

  const professions = referentiels.data?.professions ?? [];
  const enseignante =
    professions.find((item) => item.id === etat.professionId)?.isTeaching === true;

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- raccourci Ctrl+Entrée du formulaire
    <form
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        soumettre(true);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        soumettre(true);
      }}
    >
      {embarque ? null : (
        <div>
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            Nouveau prospect Grand Public
          </h1>
          <p className="text-body text-muted-foreground">
            Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.
          </p>
        </div>
      )}

      <IdentiteChamps
        etat={etat}
        erreurs={erreurs}
        indicatifs={indicatifs}
        conflit={conflit}
        prenomRef={prenomRef}
        onPoser={poser}
        onNumeroChange={(phone) => {
          poser({ phone });
          setConflit(null);
        }}
      />

      <ChoixSituation
        valeur={etat.type}
        onChange={(suivant) => {
          // L'indicatif venait du pays de résidence : hors diaspora, il repart
          // du Sénégal plutôt que de suivre une fiche abandonnée.
          const retourSenegal = etat.type === 'DIASPORA' && suivant !== 'DIASPORA';
          poser({
            type: suivant,
            situation: pourSituation(suivant, etat.situation),
            ...(retourSenegal
              ? { indicatif: INDICATIF_SENEGAL, indicatifWhatsapp: INDICATIF_SENEGAL }
              : {}),
          });
          setErreurs({});
        }}
      />

      <FilterCombobox
        label={etat.type === 'INFORMEL' ? 'Activité' : 'Profession'}
        placeholder="Rechercher une profession"
        value={etat.professionId}
        options={actifs(referentiels.data?.professions).map((item) => ({
          value: item.id,
          label: libelle(item),
        }))}
        onChange={(professionId) => {
          const choisie = professions.find((item) => item.id === professionId);
          poser({
            professionId,
            ...(choisie?.isTeaching === true
              ? {}
              : { situation: { ...etat.situation, syndicatId: null } }),
          });
        }}
      />

      <ChampsSituation
        type={etat.type}
        valeurs={etat.situation}
        referentiels={referentiels.data}
        enseignante={enseignante}
        indicatifs={indicatifs}
        indicatifWhatsapp={etat.indicatifWhatsapp}
        onIndicatifWhatsapp={(indicatifWhatsapp) => {
          poser({ indicatifWhatsapp });
        }}
        onIndicatifResidence={(indicatif) => {
          poser({ indicatif, indicatifWhatsapp: indicatif });
        }}
        onPatch={(patch) => {
          poser({ situation: { ...etat.situation, ...patch } });
        }}
      />

      <MontantsChamps
        etat={etat}
        referentiels={referentiels.data}
        canaux={canaux.data}
        onPoser={poser}
      />

      <PiedFormulaire
        modification={initial !== undefined}
        enregistres={enregistres}
        enCours={enregistrer.isPending}
        onOuvrirLaFiche={() => {
          soumettre(false);
        }}
      />
    </form>
  );
}
