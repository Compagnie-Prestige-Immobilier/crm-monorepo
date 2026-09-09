import { keepPreviousData, useQueries } from '@tanstack/react-query';

import { BarreChiffres } from '@/components/chiffres/barre';
import {
  adaptateurChiffres,
  CHARGEURS,
  cleDeJeu,
  donneesParSourceDe,
  donneesParWidgetDe,
  etatDesJeux,
  jeuxACharger,
} from '@/components/chiffres/chargeurs';
import { useComposition } from '@/components/chiffres/composition';
import { CorpsChiffres } from '@/components/chiffres/grille';
import { catalogueDe } from '@/components/chiffres/sources';
import { QueryErrorState } from '@/components/query-error-state';
import { BarreEdition } from '@/components/tableau-de-bord/barre-edition';
import { plageDeFiltres, SelecteurPeriode } from '@/components/tableau-de-bord/selecteur-periode';
import { TiroirWidgets } from '@/components/tableau-de-bord/tiroir-widgets';
import type { Perimetre } from '@/lib/data/chiffres';
import { useFiltresUrl } from '@/lib/filtres-url';
import type { Projet, ProjetApi, Role } from '@/lib/types';

export type { FiltresChiffres } from '@/components/chiffres/chargeurs';

export function VueChiffres({
  projet,
  projetApi,
  role,
}: {
  projet: Projet;
  projetApi: ProjetApi;
  role: Role;
}) {
  const { filtres, setFiltres } = useFiltresUrl(adaptateurChiffres);
  const catalogue = catalogueDe({
    projet,
    voitLesMontants: role === 'ADMIN' || role === 'DIRECTION',
    role,
  });
  const composition = useComposition(projet, catalogue);

  const plage = plageDeFiltres(filtres);
  const perimetre: Perimetre = {
    projet: projetApi,
    plage: { from: plage.du, to: plage.au },
    commercialId: filtres.teleconseiller,
  };

  const aCharger = jeuxACharger(catalogue, composition.widgets, composition.edition);
  const resultats = useQueries({
    queries: aCharger.map((jeu) => ({
      queryKey: cleDeJeu(jeu, perimetre),
      queryFn: () => CHARGEURS[jeu](perimetre),
      placeholderData: keepPreviousData,
    })),
  });

  const { jeux, erreur, toutCharge, enRafraichissement } = etatDesJeux(aCharger, resultats);
  const donneesParSource = donneesParSourceDe(catalogue, jeux);
  const donneesParWidget = donneesParWidgetDe(composition.widgets, donneesParSource);
  const pret = composition.disposition !== undefined && toutCharge;
  const panne = erreur ?? composition.erreurDisposition;

  return (
    <div className="flex flex-col gap-4">
      <BarreChiffres
        filtres={filtres}
        onFiltres={setFiltres}
        equipe={jeux.activite?.teleconseillers ?? []}
        projet={projet}
        plage={plage}
        catalogue={catalogue}
        widgets={composition.widgets}
        donneesParWidget={donneesParWidget}
        exportPret={pret && composition.widgets.length > 0}
        dispositionUtilisateur={composition.disposition?.source === 'utilisateur'}
        onReinitialiser={composition.reinitialiser}
        reinitialisationEnCours={composition.reinitialisationEnCours}
        tiroir={
          composition.edition ? (
            <TiroirWidgets
              placees={new Set(composition.widgets.map((widget) => widget.source))}
              donnees={donneesParSource}
              catalogue={catalogue}
              onAjouter={composition.ajouter}
            />
          ) : null
        }
        edition={
          <BarreEdition
            edition={composition.edition}
            modifie={composition.modifie}
            enCours={composition.enregistrementEnCours}
            estAdmin={role === 'ADMIN'}
            chargee={composition.disposition !== undefined}
            libelleEntree="Composer l’écran"
            onEntrer={composition.entrer}
            onEnregistrer={composition.enregistrer}
            onQuitter={composition.quitter}
            onParDefaut={composition.fixerParDefaut}
          />
        }
      />

      <SelecteurPeriode filtres={filtres} onChange={setFiltres} />

      {panne === null ? (
        <CorpsChiffres
          pret={pret}
          widgets={composition.widgets}
          donnees={donneesParWidget}
          edition={composition.edition}
          catalogue={catalogue}
          enRafraichissement={enRafraichissement}
          setBrouillon={composition.setBrouillon}
        />
      ) : (
        <QueryErrorState
          error={panne}
          onRetry={() => {
            for (const resultat of resultats) void resultat.refetch();
            composition.refetch();
          }}
          fallback="Les chiffres n’ont pas pu être calculés. Réessayez."
        />
      )}
    </div>
  );
}
