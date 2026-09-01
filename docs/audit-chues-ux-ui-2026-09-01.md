# Audit UX, UI et logique du parcours CHUES

Date : 1 septembre 2026  
Perimetre : CHUES web, CHUES mobile, roles, actions, etats, erreurs, hors ligne et flux bancaires  
Etat audite : arbre de travail courant, avec modifications non commitees

## Verdict

CHUES a une bonne structure de fond : les roles sont separes, les trois gestes metier sont visibles, le hors ligne est traite comme un cas normal, les composants ont de bons contrastes et les parcours web couvrent beaucoup de cas limites.

Le produit n'est toutefois pas pret a etre livre dans son etat courant. Quatre defauts bloquent la confiance :

1. Le mobile accepte encore des numeros que le serveur refuse, puis ne permet pas de les corriger.
2. La conversion mobile peut finir sur un ecran de succes sans sortie.
3. Le nouveau script de qualification mobile peut conserver une ancienne date de rappel apres changement de resultat.
4. Les tests mobiles CHUES ne compilent plus avec le modele courant. La suite web a egalement un test rouge.

Le probleme principal n'est pas l'apparence. C'est l'absence d'un chemin unique, reversible et honnete de bout en bout. Une action peut sembler terminee localement, etre refusee plus tard, puis ne plus offrir le geste necessaire pour reparer.

## Carte complete des parcours

### Web, teleconseiller

1. Espaces -> Projet CHUES -> Mon travail.
2. Etape 1 -> rechercher un representant -> qualifier -> eventuel rappel ou contact recommande -> enregistrer.
3. Etape 2 -> choisir un representant -> ajouter un ou plusieurs prospects -> enregistrer.
4. Etape 3 -> rechercher un prospect -> renseigner le dossier -> choisir le resultat -> enregistrer.
5. Rappels promis -> ouvrir la fiche dans la console ou annuler le rappel.
6. Contacts recommandes -> marquer appele, abandonner ou creer une fiche representant.
7. Representants -> filtrer -> ouvrir -> commenter ou modifier.
8. Prospects -> filtrer -> modifier, fusionner, reaffecter ou exporter selon le role.

### Web, supervision et direction

Ils ont les parcours du teleconseiller, plus :

- tableau de bord et periode ;
- activite de l'equipe ;
- lots d'export ;
- filtres par teleconseiller ;
- disposition personnalisable du tableau de bord.

### Web, administration

L'administration voit 13 destinations CHUES visibles ou repliees : tableau de bord, prospects, representants, lots, dossiers, equipes, rappels, contacts recommandes, vue bancaire, demandes clients, export des dossiers, etapes des dossiers et acces aux trois gestes metier.

### Web, Banque & Finance

1. Vue d'ensemble bancaire.
2. Dossiers bancaires.
3. Ouvrir un dossier.
4. Mes demandes de creation.
5. Exporter les dossiers.

### Mobile, teleconseiller

1. Hub -> Projet CHUES -> Aujourd'hui.
2. Qualifier les representants.
3. Ajouter des prospects.
4. Convertir les prospects en cinq etapes.
5. Consigner un appel depuis un raccourci ou une fiche.
6. Consulter les rappels et annonces.
7. Mes fiches -> representants -> prospects.
8. A corriger -> reessayer, arbitrer un conflit, ouvrir la fiche ou supprimer la saisie.
9. Reglages -> synchronisation, affichage, session et aide.

## Priorites

### P0 - Bloquants avant livraison

#### 1. Une saisie invalide devient impossible a corriger

Le champ telephone mobile accepte un prefixe inconnu avec le message « Il sera enregistre ». Le serveur le refuse ensuite avec `PHONE_INVALID`. Dans « A corriger », le geste principal est « Reessayer », qui rejoue exactement la meme charge. « Voir la fiche » ouvre une fiche sans modification du numero. La meme fiche locale peut ensuite produire un appel refuse avec `PHASE2_PROSPECT_NOT_FOUND`.

Preuves :

- `apps/mobile/lib/core/utils/phone.dart:29`
- `apps/mobile/lib/features/prospect/presentation/prospect_entry_screen.dart:307-333`
- `apps/mobile/lib/features/corrections/presentation/corrections_screen.dart:277-292`
- `apps/mobile/lib/features/corrections/presentation/corrections_screen.dart:481-520`
- `docs/qa-mobile/captures/emu06-a-corriger-impasse.jpg`
- `docs/qa-mobile/captures/emu06-cascade-2-saisies.jpg`

Correction minimale : le meme validateur de numero doit etre utilise par le champ, la base locale et l'API. Une erreur terminale modifiable doit ouvrir directement le formulaire sur le champ fautif. « Reessayer » ne doit apparaitre que pour une erreur temporaire.

Critere : aucun numero refuse par l'API ne peut passer la validation locale ; toute saisie terminale modifiable possede un geste « Corriger » qui produit une nouvelle operation valide.

#### 2. La conversion mobile se termine sur un ecran sans sortie

Quand l'etat devient `confirmed`, la flèche d'en-tete et le retour systeme sont desactives. Le seul geste est « Numero suivant ». Un utilisateur qui a fini sa journee ne peut revenir ni a la fiche ni a l'accueil.

Preuves :

- `apps/mobile/lib/features/phase2/presentation/phase2_screen.dart:238-246`
- `apps/mobile/lib/features/phase2/presentation/phase2_screen.dart:326-329`
- `apps/mobile/lib/features/phase2/presentation/phase2_screen.dart:1617-1652`
- `docs/qa-mobile/captures/emu07-ecran-sans-sortie.jpg`

Correction minimale : apres succes, proposer « Retour a la fiche » et « Numero suivant ». Le retour Android et la fleche doivent faire « Retour a la fiche ».

Critere : les trois sorties fonctionnent apres succes : fleche, retour systeme et bouton explicite.

#### 3. Une ancienne date de rappel peut survivre a un changement de resultat

Dans le nouveau script mobile, choisir « A rappeler » pose `rappelAt`. Revenir ensuite a « Joignable » ou « Injoignable » ne vide pas cette valeur. L'enregistrement transmet alors `callbackAt` avec une issue non `CALLBACK`, cree un rappel local et programme une notification. Le serveur refuse cette combinaison.

Preuves :

- `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:462-466`
- `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:267-344`
- `apps/mobile/lib/data/repositories/write_repository.dart:950-979`
- `apps/api/src/modules/rep-campaigns/rep-campaigns.service.ts:165-168`

Correction minimale : quand le resultat quitte « A rappeler », vider immediatement `rappelAt`. Le depot local doit aussi ignorer une date si l'issue n'est pas `CALLBACK`.

Critere : un test change « A rappeler » vers chaque autre issue et verifie absence de rappel local, de notification et de `callbackAt` dans la charge.

#### 4. La regression mobile n'est plus executable

`flutter analyze` echoue sur l'override du faux `WriteRepository` et sur cinq champs obligatoires du DTO genere. Les tests de qualification, conversion, formulaires, rappels, historique et erreurs ne chargent donc pas.

Preuves d'execution :

- `test/features/representant_qualification_test.dart:337`
- `test/support/fake_api.dart:583`
- 9 problemes dans `flutter analyze`, dont 6 erreurs de compilation.

Correction minimale : mettre a jour le faux depot et le constructeur `RepresentantDto`, puis ajouter les cas du nouveau script avant toute autre modification UX.

Critere : `flutter analyze` et les tests CHUES mobiles passent ; chaque nouveau champ a au moins un test de transport et un test d'interface.

### P1 - Majeurs

#### 5. Les compteurs mobiles ne mesurent pas le travail restant

« Representants a appeler » utilise le nombre total de representants. « Prospects a appeler » utilise le nombre total de prospects. Ils ne diminuent donc pas apres traitement, contrairement au texte et au tableau de bord web.

Preuve : `apps/mobile/lib/features/home/presentation/home_screen.dart:49-67`.

Correction : compter les relations non tranchees et les prospects dont la phase 2 est encore ouverte. Garder les nombres totaux uniquement dans les statistiques.

#### 6. Le web perd silencieusement une qualification en cours

Sur le web, « Revenir a la liste » et `Echap` quittent le script sans confirmation, meme apres plusieurs reponses. Le mobile demande confirmation.

Preuve : `apps/web/src/components/console/rep-script.tsx:393-401`.

Correction : si une reponse a change, confirmer « Quitter sans enregistrer ? ». Sans saisie, quitter directement.

#### 7. Le modele d'identite melange « nom complet » et « prenom »

`fullName` reste defini comme nom complet, mais un champ `prenom` a ete ajoute. Le mobile affiche les deux bout a bout et peut produire « Awa Ndiaye Awa ». Le web montre le prenom comme une information secondaire a cote du nom complet.

Preuves :

- `apps/api/src/modules/representants/dto.ts:28-46`
- `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:424-433`
- `apps/web/src/components/representants/representant-detail-view.tsx:95-103`

Correction : choisir un contrat unique. Le plus petit changement est de conserver `fullName` comme nom complet et de supprimer `prenom` des vues et saisies representant. Si prenom et nom doivent etre separes, migrer vers deux champs sans conserver un troisieme nom complet concurrent.

#### 8. Un appel joignable impose trop de questions a chaque fois

Le script exige etablissement, contact anterieur, connaissance UES, statut ambassadeur, numero et WhatsApp. Un representant deja qualifie doit tout repondre de nouveau, car aucun etat existant ne pre-remplit le script.

Preuves :

- `apps/web/src/components/console/rep-script.tsx:298-343`
- `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:89-139`

Correction : pour un premier appel, garder les questions. Pour un rappel, afficher le profil actuel avec « Confirmer les informations » et « Modifier ». Seuls resultat et prochaine action restent obligatoires.

#### 9. Les nouveaux champs mobiles ne bornent pas les longueurs serveur

Le nouvel etablissement et le niveau de syndicat n'ont pas de `maxLength` cote mobile, alors que l'API les limite a 200. Les noms de prospect restent non bornes alors que l'API les limite a 120.

Preuves :

- `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:494-536`
- `apps/mobile/lib/features/prospect/presentation/prospect_entry_screen.dart:655-688`
- `apps/api/src/modules/rep-campaigns/dto.ts:145-151,190-196`
- `apps/api/src/modules/sync/dto.ts:115-124`

Correction : partager les bornes generees ou des constantes de contrat. Afficher le compteur uniquement pres de la limite.

#### 10. Le double appui n'est pas garde dans la qualification mobile

`enregistrer` ne sort pas si `saving` vaut deja vrai. Deux appuis avant reconstruction peuvent donc lancer deux ecritures.

Preuve : `apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:256-271`.

Correction : premier garde de la fonction : `if (saving) return;`.

#### 11. Les rappels web peuvent etre annules sans confirmation ni retour arriere

« Annuler » execute directement la mutation. Un clic accidentel supprime une promesse faite au telephone. Aucun undo n'est propose.

Preuve : `apps/web/src/components/rappels/rappels-view.tsx:86-100,172-184`.

Correction : confirmation courte avec nom, numero et echeance, ou toast avec « Retablir » si l'API le permet.

#### 12. La liste des rappels web n'affiche pas le nom

La colonne « Prospect » contient seulement le numero et un code court. Pendant un appel, le nom est le repere principal.

Preuve : `apps/web/src/components/rappels/rappels-view.tsx:135-143`.

Correction : ajouter le nom au DTO de rappel et le rendre avant le numero.

#### 13. « Contacts recommandes » permet de marquer appele sans geste d'appel

La carte montre le numero mais n'offre ni lien telephone ni copie. Elle propose directement « Marquer appele », ce qui facilite un statut faux.

Preuve : `apps/web/src/components/suggestions/suggestions-view.tsx:232-282`.

Correction : action principale « Copier le numero » ou « Appeler », puis « Marquer appele » comme confirmation secondaire.

#### 14. « A corriger » utilise encore une action impossible pour les erreurs terminales

Les erreurs invalides qui ne sont ni conflit de propriete ni referentiel obsolete tombent sur « Reessayer ». Le produit sait pourtant que ces erreurs ne se debloquent pas par le reseau.

Preuve : `apps/mobile/lib/features/corrections/presentation/corrections_screen.dart:244-292`.

Correction : router par famille d'erreur vers « Corriger », « Choisir », « Reessayer » ou « Supprimer ». Aucun bouton ne doit rejouer une erreur deterministe.

#### 15. Le texte peut difficilement atteindre 200 pour cent

Le reglage borne l'echelle systeme a 1,3 et l'echelle totale a 1,8. La combinaison maximale actuelle atteint 1,755.

Preuve : `apps/mobile/lib/core/settings/display_settings.dart:85-87,173-186`.

Correction : accepter 2,0 et corriger les debordements reveles par les tests.

#### 16. Plusieurs chargements mobiles n'ont pas de libelle accessible

Des `FCircularProgress` nus subsistent dans l'historique, le selecteur, les details et « A corriger », alors que `CpiLoadingState` existe.

Preuves :

- `apps/mobile/lib/features/historique/presentation/historique_screen.dart:112`
- `apps/mobile/lib/features/representant/presentation/representant_picker_screen.dart:76`
- `apps/mobile/lib/features/representant/presentation/representant_detail_screen.dart:48`
- `apps/mobile/lib/features/corrections/presentation/corrections_screen.dart:100`

Correction : utiliser `CpiLoadingState` partout.

#### 17. Les codes techniques restent visibles dans « A corriger »

`PHONE_INVALID` et `PHASE2_PROSPECT_NOT_FOUND` apparaissent comme pastilles principales. Ils n'aident pas le teleconseiller a agir.

Correction : afficher le geste humain ; placer le code dans « Details techniques » avec copie pour le support.

#### 18. Les mots ne sont pas coherents entre web et mobile

Le web utilise « Rappels promis », le mobile « Rappels ». « Fiches » signifie representants dans CHUES et prospects dans Grand Public. Le nouveau script alterne « ambassadeur » et « representant CPI CHUES ».

Correction : vocabulaire unique : « Representants », « Prospects », « Rappels promis », « Ambassadeur CHUES » avec une definition courte au premier usage.

### P2 - Simplifications a fort rendement

#### 19. L'administration CHUES a trop de destinations au meme niveau

Treize entrees visibles ou sous « Plus » demandent de connaitre l'organisation interne. Regrouper par objet : Pilotage, Appels, Donnees, Banque.

#### 20. Le bouton mobile « Commencer » repete les cartes d'etapes

L'accueil contient trois grandes cartes puis un bouton qui reouvre deux des memes choix. Cela cree deux chemins equivalant au meme geste.

Preuve : `apps/mobile/lib/features/home/presentation/home_screen.dart:102-126,341-389`.

Correction : supprimer « Commencer ». Les cartes sont deja de grandes cibles tactiles.

#### 21. Le raccourci « Consigner un appel » duplique l'etape 3

Sur le meme ecran, « Convertir les prospects » et « Consigner un appel » ouvrent tous deux `Routes.phase2` avec deux explications differentes.

Preuve : `apps/mobile/lib/features/home/presentation/home_screen.dart:111-125,280-289`.

Correction : garder une seule entree, nommee « Consigner un appel prospect ».

#### 22. Les filtres de rappels et suggestions ne vivent pas dans l'URL

Un rechargement ou un lien partage perd le perimetre et le teleconseiller choisis. Les listes principales utilisent deja des filtres URL.

Correction : `?periode=retard&teleconseiller=...` et `?statut=a-appeler`.

#### 23. Les succes reposent parfois sur un message fugitif

Le web revient a la liste avec une ligne de confirmation, mais aucune action pour rouvrir la derniere fiche. Le mobile ferme directement la qualification sans confirmation persistante.

Correction : toast ou bande courte avec « Ouvrir la fiche », puis disparition.

#### 24. Les formulaires n'expliquent pas ce qui est sauvegarde hors ligne

Le bandeau dit que la fiche est gardee, mais il ne distingue pas brouillon, en attente et envoye. L'utilisateur ne sait pas toujours quand il peut fermer sans perte.

Correction : trois mots constants : « Brouillon », « A envoyer », « Envoye ».

#### 25. Les erreurs de recherche et les vrais zeros sont parfois confondus

L'accueil mobile affiche un tiret en erreur mais le libelle semantique reste « en cours de lecture ». Un lecteur d'ecran entend donc un chargement pour une panne.

Preuve : `apps/mobile/lib/features/home/presentation/home_screen.dart:181-210`.

Correction : annoncer « Chiffre indisponible » en erreur.

#### 26. Les lignes critiques tronquent encore du texte

Des libelles et bandeaux limitent le texte a deux lignes. Une date limite ou un libelle de formulaire peut disparaitre avec une grande police.

Preuves :

- `apps/mobile/lib/ui/widgets/cpi_kit.dart:994`
- `apps/mobile/lib/features/home/presentation/home_screen.dart:245`
- `docs/qa-mobile/captures/emu04-libelle-tronque.jpg`

Correction : aucune ellipse sur une question, une erreur ou une date limite.

#### 27. Les actions globales bloquent parfois toutes les lignes

Une seule mutation `cancel` ou `decide` porte l'etat pending de toute la liste. Un geste sur une ligne desactive les autres sans montrer clairement laquelle travaille.

Correction : suivre l'identifiant en cours et afficher le pending sur la ligne concernee.

#### 28. L'ecran de detail representant devient trop dense

Profil, statut, compteurs, dix attributs, note, fil, histoire et prospects sont tous ouverts dans une seule colonne.

Correction : entete + deux onglets « Profil » et « Activite ». Ne pas ajouter un nouveau systeme de cartes.

#### 29. Les listes longues cachent leur pagination implicite

Les contacts recommandes disent seulement apres coup que les plus recents sont affiches. Il n'y a pas de geste « Voir la suite ».

Correction : vraie pagination ou bouton « Charger la suite ».

#### 30. La version mobile est affichee en dur

« 1.0.0 » peut differer de l'APK reel et complique le support.

Preuve : `apps/mobile/lib/features/about/presentation/about_screen.dart:47,91`.

Correction : afficher `PackageInfo.version` deja disponible au demarrage.

## Audit sur 36 dimensions UX

| Dimension                         | Verdict                      | Observation et action                                                                                |
| --------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Orientation                    | Bon                          | Les trois etapes CHUES sont visibles. Garder cette colonne vertebrale.                               |
| 2. Architecture par role          | Bon                          | Les permissions et destinations sont explicitement separees.                                         |
| 3. Charge de navigation           | A simplifier                 | Admin a 13 destinations CHUES. Regrouper par objet.                                                  |
| 4. Priorite des actions           | Mitige                       | Les cartes sont claires, mais « Commencer » et « Consigner un appel » les dupliquent.                |
| 5. Progression                    | Bon sur conversion           | Les etapes sont numerotees et la question courante est visible.                                      |
| 6. Charge cognitive               | Faible sur le nouveau script | Jusqu'a sept questions obligatoires sur un appel joignable.                                          |
| 7. Prevention des erreurs         | Critique                     | Le mobile accepte des numeros que le serveur refuse.                                                 |
| 8. Recuperation d'erreur          | Critique                     | Certaines erreurs terminales ne proposent que « Reessayer ».                                         |
| 9. Reversibilite                  | Faible                       | Annulation de rappel sans confirmation ; succes mobile sans retour.                                  |
| 10. Validation de formulaire      | Faible                       | Bornes et validateur telephone divergent du serveur.                                                 |
| 11. Doublons                      | Mitige                       | Detection existe, mais peut laisser continuer avant un echec certain.                                |
| 12. Hors ligne                    | Bon principe                 | Ecriture locale d'abord et bandeaux explicites.                                                      |
| 13. Visibilite de synchronisation | Bon                          | En cours, hors ligne, bloque et succes sont distingues.                                              |
| 14. Correction hors ligne         | Faible                       | La plupart des erreurs prospect demandent suppression et ressaisie.                                  |
| 15. Continuité web/mobile         | Faible                       | Meme metier, mais confirmations, termes et nettoyage d'etat divergent.                               |
| 16. Rappels                       | Mitige                       | Echeances bonnes ; annulation, nom et etat stale a corriger.                                         |
| 17. Recherche                     | Bon                          | Nom et numero, focus initial, recherche locale mobile.                                               |
| 18. Filtres                       | Bon sur listes               | Riches et lisibles ; rappels/suggestions devraient persister dans l'URL.                             |
| 19. Etats vides                   | Bon                          | Ils distinguent souvent liste vide et filtre trop strict.                                            |
| 20. Chargement                    | Mitige                       | Squelettes web corrects ; plusieurs spinners mobiles sans libelle.                                   |
| 21. Feedback de succes            | Mitige                       | Visible sur web ; trop abrupt ou piege sur mobile.                                                   |
| 22. Feedback d'erreur             | Mitige                       | Messages humains existent, mais codes bruts et erreurs deterministes persistent.                     |
| 23. Confiance dans les chiffres   | Faible mobile                | Deux compteurs affichent le stock total comme travail restant.                                       |
| 24. Libelles                      | Mitige                       | Directs dans l'ensemble ; « Fiches », « ambassadeur » et « rappels » varient.                        |
| 25. Lisibilite                    | Bonne                        | Typographie et contraste documentes et mesures.                                                      |
| 26. Grande police                 | Faible                       | Plafond sous 200 pour cent et ellipses sur contenu critique.                                         |
| 27. Cibles tactiles               | Bonne                        | Kit mobile a 48 dp, web a 44 px ou plus.                                                             |
| 28. Clavier                       | Bon web                      | Raccourcis documentes et parcours clavier testes.                                                    |
| 29. Lecteur d'ecran               | Mitige                       | Bon socle semantique, mais chargements et quelques etats restent imparfaits.                         |
| 30. Mouvement reduit              | Bon                          | Tokens et alternatives existent ; conserver les tests.                                               |
| 31. Responsive                    | Bon web                      | Plusieurs parcours CHUES ont des tests a 375 px.                                                     |
| 32. Performance percue            | Mitige                       | Listes paresseuses ; une ancienne mesure mobile montre une frappe tres lente a confirmer en profile. |
| 33. Confidentialite               | Mitige                       | Donnees locales et ecrans sensibles ; aucune protection de capture d'ecran relevee.                  |
| 34. Coherence des donnees         | Critique                     | Identite `fullName` + `prenom` et callback stale creent deux verites.                                |
| 35. Observabilite support         | Mitige                       | Codes utiles au support, mais exposes au mauvais niveau.                                             |
| 36. Confiance des tests           | Critique actuellement        | Mobile ne compile pas ; web 1 test rouge ; API ciblee verte.                                         |

## Parcours cible simplifie

### Teleconseiller

1. Aujourd'hui montre trois files reelles : representants a qualifier, representants sans prospect, prospects a appeler.
2. Un appui ouvre directement la premiere fiche prioritaire, avec recherche disponible.
3. L'appel demande d'abord le resultat.
4. Si joignable et premier appel, completer le profil utile.
5. Si deja qualifie, confirmer le profil existant ou le modifier, sans reposer toutes les questions.
6. Relire uniquement les valeurs modifiees.
7. Enregistrer localement.
8. Afficher « A envoyer », puis « Envoye » ou « Corriger ».
9. Apres succes, offrir « Retour a la fiche » et « Suivant ».

### Erreur

Le bouton depend de la cause :

| Cause                        | Action principale                                         |
| ---------------------------- | --------------------------------------------------------- |
| Reseau ou serveur temporaire | Reessayer                                                 |
| Champ invalide               | Corriger le champ                                         |
| Doublon                      | Ouvrir la fiche existante                                 |
| Proprietaire different       | Choisir le rattachement                                   |
| Referentiel obsolete         | Rechoisir dans la liste                                   |
| Fiche supprimee              | Supprimer la saisie locale ou repartir d'une fiche valide |

### Supervision

1. Tableau de bord.
2. Equipe.
3. Files de travail et rappels.
4. Donnees et exports sous une rubrique secondaire.

### Banque

1. Vue d'ensemble.
2. Ouvrir ou retrouver un dossier.
3. Traiter l'etape courante.
4. Suivre les demandes de creation.
5. Export sous action secondaire.

## Ordre de correction recommande

### Lot 1 - Integrite et sorties

- Nettoyer `rappelAt` et durcir le depot local.
- Ajouter les sorties de l'ecran de succes conversion.
- Remplacer « Reessayer » par « Corriger » pour les erreurs terminales.
- Aligner le validateur telephone mobile sur l'API.
- Retablir la compilation et les tests mobiles.

### Lot 2 - Verite de l'interface

- Corriger les trois compteurs.
- Resoudre `fullName` contre `prenom`.
- Aligner les bornes de champs.
- Ajouter nom, confirmation et etat par ligne dans les rappels.

### Lot 3 - Simplification

- Supprimer « Commencer » et le raccourci phase 2 dupliques.
- Alleger le script pour les fiches deja qualifiees.
- Regrouper la navigation admin.
- Uniformiser le vocabulaire.

### Lot 4 - Accessibilite et finition

- Passer a 200 pour cent de texte.
- Retirer les ellipses critiques.
- Remplacer les spinners nus.
- Cacher les codes techniques sous des details.

## Triple verification effectuee

### Passage 1 - Inventaire

- Toutes les routes CHUES web et leurs roles ont ete lues dans `nav-items.ts` et `apps/web/src/app/(panel)/chues`.
- Tous les ecrans CHUES mobiles et routes poussees ont ete inventories.
- Les tests E2E CHUES existants ont servi de liste de parcours et d'etats attendus.

### Passage 2 - Logique de bout en bout

- UI -> depot local -> outbox -> sync -> DTO -> service API ont ete traces pour qualification, prospect, conversion et rappel.
- Les branches succes, rappel, erreur terminale, hors ligne et changement de choix ont ete relues.
- Les modifications non commitees ont ete prises en compte sans etre changees.

### Passage 3 - Preuves

- Captures Android existantes inspectees pour les impasses et troncatures.
- `pnpm --filter @crm/web typecheck` : passe.
- Tests API cibles qualification/representants/sync : 4 fichiers, 103 tests, tous passes.
- Tests web : 1 233 passes, 1 echec dans `representant-detail-view.test.tsx` a cause de plusieurs textes « Non demande ».
- `flutter analyze` : echec, 9 problemes dont 6 erreurs de compilation.
- Tests mobiles CHUES demandes : echec au chargement pour les memes incompatibilites de types.

## Limites honnetes

Le serveur web et l'emulateur n'etaient pas actifs pendant cet audit. Les constats visuels mobiles reposent sur les captures du 30 aout 2026 et ont ete revalides contre le code courant. Les nouveaux ecrans de qualification modifies aujourd'hui n'ont pas pu etre verifies visuellement sur appareil, car leur suite ne compile plus. Ils doivent etre rejoues sur un Android en mode profile apres retablissement des tests.
