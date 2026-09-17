# Plan de migration des statuts de qualification et de réaffectation

Source : classeur « arbitrage-statuts-qualification-2026-09-16 » rempli par les
équipes CPI, puis réponses écrites du 17 septembre 2026. Périmètre : statuts
prospects. L'onglet Représentants est une liste de référence, rien n'y change.

État : **règles arrêtées et confirmées (section 8), rien n'est codé.**

## 1. Vocabulaire

**Fiche ouverte** : on doit encore l'appeler.

- elle est dans le reste à appeler et revient dans la file du téléconseiller ;
- dans une campagne, elle compte parmi les fiches à traiter.

**Fiche fermée** : le travail est terminé avec un résultat.

- elle sort du reste à appeler et de ses campagnes ;
- elle garde son statut, affiché en étiquette ;
- elle n'est pas effacée : recherche, listes et historique d'appels restent ;
- un superviseur peut la déqualifier (bouton « Requalifier », remise à traiter)
  ou la confier à un autre téléconseiller.

**Fiche perdue** : fiche fermée mise de côté.

- statut « Perdu » ;
- n'est plus choisie pour une nouvelle campagne ;
- rien n'est détruit, un superviseur peut la récupérer.

**Appel compté** : tout appel compte comme appel émis, puis comme joint ou
injoignable selon la famille de son statut.

## 2. Règle générale

**Tout statut posé ferme la fiche et elle garde son statut.**

Deux exceptions :

- **À rappeler** laisse la fiche ouverte ;
- **À supprimer · Farceur / Non sérieux** ferme la fiche en perdue.

Droits :

- superviseur, direction et admin peuvent déqualifier n'importe quelle fiche ;
- le téléconseiller qualifie les fiches de son reste à appeler ;
- le téléconseiller peut aussi requalifier une fiche de « Mes contacts », **même
  fermée**, car il en a l'historique ;
- hors de ces deux listes, le téléconseiller ne change pas le statut.

## 3. Effet de chaque statut à partir de maintenant

| Statut                              | Famille     | Fermée                 | Appel compté | Rubrique Intéressés / Hésitants / RDV | Rappels promis            | Étiquette                           |
| ----------------------------------- | ----------- | ---------------------- | ------------ | ------------------------------------- | ------------------------- | ----------------------------------- |
| Boîte vocale                        | Injoignable | Oui                    | Injoignable  | Non                                   | Non                       | Boîte vocale                        |
| NRP                                 | Injoignable | Oui                    | Injoignable  | Non                                   | Non                       | NRP                                 |
| Autre injoignable                   | Injoignable | Oui                    | Injoignable  | Non                                   | Non                       | Autre injoignable                   |
| Faux numéro                         | Injoignable | Oui                    | Injoignable  | Non                                   | Non                       | Faux numéro                         |
| Pas intéressé                       | Joignable   | Oui                    | Joint        | Non                                   | Non                       | Pas intéressé                       |
| Demande d'information               | Joignable   | Oui                    | Joint        | Non                                   | Non                       | Demande d'information               |
| Demande de partenariat              | Joignable   | Oui                    | Joint        | Non                                   | Non                       | Demande de partenariat              |
| Hésitant                            | Joignable   | Oui                    | Joint        | **Oui**                               | Non                       | Hésitant                            |
| Intéressé                           | Joignable   | Oui                    | Joint        | **Oui**                               | Non                       | Intéressé                           |
| Intéressé › Terrain                 | Joignable   | Oui, en Intéressé      | Joint        | **Oui**                               | Non                       | Intéressé › Terrain                 |
| Intéressé › Villa                   | Joignable   | Oui, en Intéressé      | Joint        | **Oui**                               | Non                       | Intéressé › Villa                   |
| Intéressé › Construction            | Joignable   | Oui, en Intéressé      | Joint        | **Oui**                               | Non                       | Intéressé › Construction            |
| Intéressé › Formalités domaniales   | Joignable   | Oui, en Intéressé      | Joint        | **Oui**                               | Non                       | Intéressé › Formalités domaniales   |
| Rendez-vous (parent)                | Joignable   | Oui                    | Joint        | **Oui**                               | **Oui**, date obligatoire | Rendez-vous                         |
| Rendez-vous › RV CPI                | Joignable   | Oui                    | Joint        | **Oui**                               | **Oui**, date obligatoire | RV CPI                              |
| Rendez-vous › RV site               | Joignable   | Oui                    | Joint        | **Oui**                               | **Oui**, date obligatoire | RV site                             |
| Rendez-vous › RV externe            | Joignable   | Oui                    | Joint        | **Oui**                               | **Oui**, date obligatoire | RV externe                          |
| Rendez-vous › RV téléphonique       | Joignable   | Oui                    | Joint        | **Oui**                               | **Oui**, date obligatoire | RV téléphonique                     |
| À rappeler                          | Joignable   | **Non**, reste ouverte | Joint        | Non                                   | **Oui**, date obligatoire | À rappeler                          |
| À supprimer · Farceur / Non sérieux | Joignable   | Oui, en **perdue**     | Joint        | Non                                   | Non                       | À supprimer · Farceur / Non sérieux |

Précisions :

- **Intéressé et méthode d'enrôlement** : si une méthode est saisie, la fiche
  garde les deux statuts, Intéressé et Méthode obtenue, tous deux visibles en
  étiquette.
- **Rendez-vous** est le statut parent. RV CPI, RV site, RV externe et RV
  téléphonique sont ses sous-statuts et se comportent tous pareil.
- **Intéressé** est le parent de Terrain, Villa, Construction et Formalités
  domaniales. Ces sous-statuts ferment la fiche en Intéressé.
- **À supprimer** est renommé en double étiquette « À supprimer · Farceur / Non
  sérieux ».

Changements par rapport au comportement actuel :

- Boîte vocale, NRP et Autre injoignable ne laissent plus la fiche dans le
  reste à appeler : aucune nouvelle tentative automatique, seul un superviseur
  la remet à traiter ;
- Hésitant, Intéressé et ses sous-statuts, Demande d'information et Demande de
  partenariat ferment désormais la fiche ;
- les rendez-vous ferment la fiche mais restent dans « Rappels promis ».

## 4. Nouvelle rubrique « Intéressés, hésitants et rendez-vous »

- Contenu : fiches fermées en Hésitant, en Intéressé (et ses sous-statuts) ou
  en Rendez-vous (et ses sous-statuts).
- Ces fiches sont sorties de leurs campagnes mais gardent leur statut.
- Accès : superviseurs, direction et administrateurs uniquement. Les
  téléconseillers ne la voient pas.
- Un rendez-vous dont la date est passée **reste** dans la rubrique.

## 5. Reprise des anciens statuts (migration)

Chiffres de la base du 16 septembre 2026.

| Code ancien              | Libellé ancien         | Appels | Fiches (dernier statut) | Nouveau statut       |
| ------------------------ | ---------------------- | -----: | ----------------------: | -------------------- |
| TELEPHONE_INDISPONIBLE   | Téléphone indisponible |     30 |                      25 | Boîte vocale         |
| UNREACHABLE              | Injoignable            |     15 |                      14 | NRP                  |
| NUMERO_OCCUPE            | Occupé                 |      8 |                       4 | NRP                  |
| INJOIGNABLE_DEFINITIF    | Injoignable définitif  |      7 |                       7 | NRP                  |
| AUTRES                   | Autres                 |     37 |                      31 | Pas intéressé        |
| REFUS_PAS_POUR_LE_MOMENT | Pas pour le moment     |     34 |                      25 | Hésitant             |
| HORS_CIBLE               | Hors cible             |      9 |                       9 | Pas intéressé        |
| REFUS_NE_VEUT_PAS        | Ne veut pas            |      7 |                       7 | Pas intéressé        |
| TRANSFERT_ENROLEMENT     | Transfert enrôlement   |      5 |                       3 | Intéressé            |
| REFUS_DEJA_ENGAGE        | Déjà engagé            |      4 |                       4 | Pas intéressé        |
| OTHER                    | Autre                  |      0 |                       0 | Pas intéressé        |
| METHOD_OBTAINED          | Méthode obtenue        |      0 |                       0 | Intéressé            |
| REFUSED                  | Refus                  |      0 |                       0 | Pas intéressé        |
| RDV_AGENCE               | Rendez-vous agence     |      0 |                       0 | Rendez-vous › RV CPI |
| REFUS_PAS_CONFIANCE      | Pas confiance          |      0 |                       0 | Hésitant             |
| REFUS_MEFIANT            | Méfiant                |      0 |                       0 | Hésitant             |

Total : 156 appels consignés.

Règles de reprise :

- chaque appel ancien prend son nouveau statut, l'historique est conservé ;
- TRANSFERT_ENROLEMENT est dans la famille Joignable : le classeur indiquait
  Injoignable, erreur confirmée ;
- toutes les fiches déjà qualifiées sont fermées selon la section 3 ; seules
  celles dont le dernier statut est « À rappeler » restent ouvertes ;
- les fiches reprises en Hésitant, Intéressé ou Rendez-vous apparaissent dans
  la nouvelle rubrique.

## 6. Réaffectation et déqualification (déjà livré sur v3, commit 7f73e48d)

- Dans une campagne, le superviseur coche des fiches, y compris traitées, et
  les confie à un téléconseiller précis. Les appels passés restent à leur
  auteur.
- Retirer un téléconseiller d'une campagne ne redistribue toujours que ses
  fiches non traitées.
- Bouton « Requalifier » sur les fiches CHUES et Grand Public, réservé à
  superviseur, direction et admin : À traiter (remise à zéro), Contacté, Perdu.
  Une fiche convertie ne se requalifie pas. Le geste est audité.

À revoir avec ce plan : « À traiter » doit rouvrir une fiche fermée par un
statut de la section 3.

## 7. Plan technique (à chiffrer avant de coder)

1. Référentiel : sur chaque statut, un réglage « ferme la fiche » et « va dans
   la rubrique », modifiable dans l'écran « Statuts de qualification ». Pas de
   code par statut.
2. Consignation d'un appel : appliquer la section 3 (fermeture, sortie des
   campagnes, rappel pour les rendez-vous, double étiquette Intéressé /
   Méthode obtenue).
3. Migration goose : renommer les appels selon la section 5, corriger la
   famille de TRANSFERT_ENROLEMENT, renommer À supprimer, fermer les fiches
   déjà qualifiées.
4. Rubrique : un écran liste avec un seul endpoint.
5. Tests : un test d'intégration Go par règle modifiée, cassé puis remis ; un
   parcours Playwright pour la rubrique.

## 8. Réponses du 17 septembre 2026

1. **Droits du téléconseiller** : il qualifie les fiches de son reste à appeler
   et peut requalifier une fiche de « Mes contacts » même fermée, car il en a
   l'historique. Superviseur, direction et admin déqualifient toute fiche.
2. **Rubrique** : visible seulement par superviseurs, direction et
   administrateurs.
3. **Rendez-vous passé** : la fiche reste dans la rubrique.
