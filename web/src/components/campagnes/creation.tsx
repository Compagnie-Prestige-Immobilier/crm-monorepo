import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  CIBLES,
  choixInitial,
  critereDuChoix,
  surRepresentants,
  type Choix,
} from '@/components/campagnes/cibles';
import { ChampsCritere, ChoixCible } from '@/components/campagnes/creation-champs';
import { ChampTeleconseillers } from '@/components/campagnes/creation-equipe';
import {
  Apercu,
  ChampsReglages,
  construireDistribution,
  entierBorne,
  ErreurCreation,
  fetchAppelants,
  FICHES_PAR_JOUR_DEFAUT,
  JOURS_DEFAUT,
  nomsDeLieu,
  objectifsRetenus,
  peutCreer,
  useValeurDifferee,
} from '@/components/campagnes/creation-outils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apercuCampagne, creerCampagne } from '@/lib/data/lots-export';
import { fetchReferentiel, fetchReferentiels } from '@/lib/data/referentiels';
import { formatDateTime, formatNumber } from '@/lib/format';
import { lien } from '@/lib/nav';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

export function DialogueCreation({
  open,
  onOpenChange,
  projet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projet: Projet;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <Formulaire
          projet={projet}
          onFerme={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * `DialogContent` démonte son contenu à la fermeture : le choix, l'aperçu et
 * l'erreur du serveur repartent d'eux-mêmes à zéro à chaque ouverture.
 */
function Formulaire({ projet, onFerme }: { projet: Projet; onFerme: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Figée à l'ouverture : recalculée à chaque rendu, la date du nom proposé
  // sauterait d'une seconde à l'autre sous les doigts de celui qui le corrige.
  const [maintenant] = useState(() => new Date().toISOString());
  const cibles = CIBLES.filter((cible) => cible.projet === projet);
  const [choix, setChoix] = useState<Choix>(() =>
    choixInitial(projet === 'grand-public' ? 'grand-public' : 'chues'),
  );
  // On retient les comptes DÉCOCHÉS : la liste arrive après le premier rendu, et
  // tout garder coché par défaut se lit alors sans effet de synchronisation.
  const [decoches, setDecoches] = useState<readonly string[]>([]);
  const [fichesParJourSaisi, setFichesParJourSaisi] = useState(String(FICHES_PAR_JOUR_DEFAUT));
  const [joursSaisi, setJoursSaisi] = useState(String(JOURS_DEFAUT));
  const [objectifsSaisis, setObjectifsSaisis] = useState<Readonly<Record<string, string>>>({});
  // Nul tant que personne n'a touché au champ : le nom proposé suit alors les
  // critères ; dès la première frappe, il ne bouge plus tout seul.
  const [nomSaisi, setNomSaisi] = useState<string | null>(null);

  const appelants = useQuery({
    queryKey: queryKeys.lotsExportTeleconseillers,
    queryFn: fetchAppelants,
    staleTime: 5 * 60_000,
  });

  const lieuxUtiles = surRepresentants(choix.cle);
  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    enabled: lieuxUtiles,
    staleTime: 30 * 60_000,
  });
  const iefs = useQuery({
    queryKey: queryKeys.iefs,
    queryFn: () => fetchReferentiel('iefs', true),
    enabled: lieuxUtiles,
    staleTime: 30 * 60_000,
  });

  const departements = referentiels.data?.departements ?? [];
  const listeIefs = iefs.data ?? [];
  const comptes = appelants.data ?? [];
  const equipe = comptes.filter((compte) => !decoches.includes(compte.id));
  const fichesParJour = entierBorne(fichesParJourSaisi, FICHES_PAR_JOUR_DEFAUT, 1, 500);
  const jours = entierBorne(joursSaisi, JOURS_DEFAUT, 1, 10);
  const distribution = construireDistribution({
    equipe,
    fichesParJour,
    jours,
    objectifs: objectifsRetenus(equipe, objectifsSaisis),
  });

  const lieux = nomsDeLieu(choix, departements, listeIefs);
  const { corps, etiquette } = critereDuChoix(choix, lieux.departement, lieux.ief);

  // La temporisation porte sur une CLÉ : l'objet des critères est reconstruit à
  // chaque rendu, et son identité relancerait le report sans fin.
  const cleCritere = JSON.stringify([choix, distribution]);
  const critereStable = useValeurDifferee(cleCritere, 250) === cleCritere;

  const apercu = useQuery({
    queryKey: queryKeys.lotsExportApercu({ cle: cleCritere }),
    queryFn: () => apercuCampagne({ ...corps, name: etiquette, distribution }),
    enabled: critereStable && equipe.length > 0,
  });

  const nomAffiche = nomSaisi ?? `${etiquette}, ${formatDateTime(maintenant)}`.slice(0, 120);
  const nom = nomAffiche.trim();

  const creation = useMutation({
    mutationFn: () => creerCampagne({ ...corps, distribution, name: nom }),
    onSuccess: async (lot) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      toast.success(`Campagne créée : ${formatNumber(lot.itemCount)} fiches réparties.`);
      onFerme();
      await navigate(lien(`/${projet}/campagnes/${lot.id}`));
    },
  });

  const pret = peutCreer({
    equipe: equipe.length,
    eligible: apercu.data?.eligible ?? null,
    nom,
    enCours: creation.isPending,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle campagne</DialogTitle>
        <DialogDescription>
          Choisissez les fiches et les personnes qui les traiteront. Chacun reçoit son programme à
          imprimer.
        </DialogDescription>
      </DialogHeader>

      <ChoixCible cibles={cibles} choix={choix} onChange={setChoix} />

      <ChampsCritere
        choix={choix}
        onChange={setChoix}
        departements={departements}
        iefs={listeIefs}
      />

      <ChampTeleconseillers
        comptes={comptes}
        chargement={appelants.isPending}
        erreur={appelants.error}
        decoches={decoches}
        onChange={setDecoches}
        objectifs={objectifsSaisis}
        defaut={fichesParJour}
        onObjectif={(id, saisie) => {
          setObjectifsSaisis((courants) => ({ ...courants, [id]: saisie }));
        }}
      />

      <ChampsReglages
        nom={nomAffiche}
        onNom={setNomSaisi}
        fichesParJour={fichesParJourSaisi}
        onFichesParJour={setFichesParJourSaisi}
        jours={joursSaisi}
        onJours={setJoursSaisi}
      />

      <Apercu apercu={apercu} stable={critereStable} equipe={equipe.length} jours={jours} />

      <ErreurCreation erreur={creation.error} />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onFerme}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={!pret}
          onClick={() => {
            creation.mutate();
          }}
        >
          {creation.isPending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Créer la campagne
        </Button>
      </DialogFooter>
    </>
  );
}
