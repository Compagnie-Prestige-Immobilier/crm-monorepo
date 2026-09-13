# Grand Public : ce qui est nouveau

Travail livré le 11 septembre 2026, à partir des demandes du prospect relevées
la veille et des arbitrages du propriétaire. Le plan qui les chiffre est dans
`demandes-grand-public.md` ; ce document dit ce qui existe désormais dans le
code.

Cinq lots, plus trois corrections trouvées en chemin. Aucune ligne n'a été
écrite sans qu'un écran, un rôle ou une demande ne l'exige.

## 1. L'écran d'appel montre les fiches de la campagne

L'écran listait « les vingt dernières fiches ajoutées au projet », triées par
date de création : les attributions de campagne y étaient noyées dans les
saisies personnelles du téléconseiller.

Il rend maintenant ses propres fiches et celles qu'une campagne lui a confiées,
triées par nom. Le mécanisme n'a pas été inventé : CHUES l'expose depuis
toujours sous le nom `mesFiches`, et la clause `EXISTS` sur `lot_export_items`
existait déjà dans `sql/queries/prospects.sql` sans jamais être restreinte.

- `internal/prospects/prospects.go` : `MesFiches` dans l'entrée de liste, la
  portée large désarmée quand il est posé.
- `web/src/lib/data/prospects.ts` : `fetchProspectsAQualifier`, calqué sur son
  homologue représentants.
- `mesFiches` ajouté à `/api/v1/prospects` dans `web/contrat-v1.openapi.json`.

L'annuaire est désormais un **tableau** à trois colonnes : nom et prénom,
numéro, dernier appel. Le composant `Table` du dépôt gère seul le défilement
horizontal et fige la première colonne sous 768 px.

## 2. Joignable et injoignable, avec leurs sous-options

L'écran proposait cinq boutons à plat, écrits en dur. Il pose maintenant une
question, puis les motifs du groupe choisi :

```
Avez-vous eu la personne au téléphone ?

  [ 1  Joignable ]        [ 2  Injoignable ]
         |                        |
   Intéressé              À rappeler   -> demande l'échéance
   Pas intéressé          Faux numéro  -> clôt la fiche
   Retraité               Autre        -> exige un commentaire
   Hors cible
   Décédé
```

Les motifs viennent du référentiel administrable `call_outcome_reasons`, que
l'écran d'administration gère déjà et que le panneau n'utilisait pas. Le serveur
n'a rien eu à apprendre : `POST /phase2/call-attempts` acceptait déjà
`reasonCode`, vérifiait son existence, son activité et la cohérence de son effet
avec l'issue.

Le regroupement se lit sur **l'effet** du motif, pas sur le drapeau
`countsAsReached` :

| Effet                 | Groupe      | Issue envoyée     |
| --------------------- | ----------- | ----------------- |
| Clôt, méthode obtenue | Joignable   | `METHOD_OBTAINED` |
| Clôt, refus           | Joignable   | `REFUSED`         |
| Planifie un rappel    | Injoignable | `CALLBACK`        |
| Clôt, faux numéro     | Injoignable | `WRONG_NUMBER`    |
| Laisse ouvert         | Injoignable | `UNREACHABLE`     |

Deux raisons à ce choix. Les six motifs semés sont `isSystem` et le serveur
refuse toute modification de leur règle : l'administrateur ne pourrait pas
corriger le classement du seed, qui range « À rappeler » du côté joignable. Et
`countsAsReached` est un drapeau mort : écrit, exposé avec la promesse « compte
dans les statistiques », lu par personne, alors que les tableaux de bord calculent
l'injoignabilité depuis `outcome = 'UNREACHABLE'`.

Si la lecture du référentiel échoue, l'écran retombe sur les six motifs système.
Sans ce repli, une panne réseau sur ce seul appel laisserait le téléconseiller
devant une fiche verrouillée sans aucune issue.

**Le vocabulaire est unifié sur « Faux numéro ».** Le dépôt portait deux
constantes Go pour le même concept, avec deux orthographes ; la seconde a
disparu. Les classeurs d'export et les PDF de campagne suivent.

**À faire avant la mise en ligne** : l'administrateur doit saisir les cinq
statuts joignables dans `/admin/referentiels/issues-appel`, avec l'effet
« Clôt, méthode obtenue » pour « Intéressé » et « Clôt, refus » pour les quatre
autres.

## 3. Champs de la fiche : crédit immobilier et type de bien

Le mode de paiement accepte une troisième valeur, « Crédit immobilier », **sans
durée** : la contrainte `prospect_conversions_payment_check` n'autorise déjà une
durée que sur « Échelonné » et l'interdit donc d'elle-même.

Un select **Type de bien** (Terrain, Villa) ferme le formulaire d'ajout de
prospect, juste avant les boutons.

Migration `sql/migrations/20260911090000_paiement_credit_et_type_bien.sql`, en
`NO TRANSACTION` parce que `ALTER TYPE … ADD VALUE` ne s'exécute pas dans une
transaction. Chaque instruction est rejouable (`IF NOT EXISTS` sur la valeur et
la colonne, `EXCEPTION WHEN duplicate_object` sur le type), sans quoi une
reprise après incident resterait bloquée. `sql/schema.sql` porte les mêmes
ajouts : c'est lui que sqlc compile et dont la CI bâtit sa base de test.

Le mode de paiement était déclaré à onze endroits, dont **trois listes écrites
en dur** dans le panneau. Elles sont maintenant dérivées de `PAYMENT_MODES` : la
prochaine valeur n'exigera plus trois modifications identiques.

Le **formulaire public** ouvert aux inconnus garde son contrat à deux valeurs et
filtre explicitement le crédit immobilier.

Une colonne « Type de bien » s'ajoute **en fin** du classeur global. Les lignes
sont lues par position (`RowToStructByPos`) : une insertion au milieu aurait
décalé toutes les colonnes en silence.

## 4. Avis d'adhésion par courriel

Valider « Confirmer la conversion » sur une fiche prospect Grand Public envoie
un avis aux adresses réglées par l'administrateur.

Trois paramètres dans `/chues/parametres-chues`, réservés à l'ADMIN : objet,
corps, destinataires. Le texte d'usine connaît six jetons (`{prenomNom}`,
`{telephone}`, `{date}`, `{offre}`, `{paiement}`, `{montant}`,
`{teleconseiller}`), remplacés à l'envoi comme ceux de l'accusé de réception.

Aucune migration : `app_settings` est une table clé-valeur.

Trois garde-fous : l'envoi part **après** la transaction, une messagerie en
panne ne défaisant pas une adhésion acquise ; sans destinataire réglé, rien ne
part, pas même un appel à Brevo ; sans clé Brevo, l'envoi se marque
`NOT_CONFIGURED` sans faire échouer l'appelant.

## 5. Le formulaire d'ajout pose les questions de l'administrateur

Le formulaire d'ajout affiche désormais les champs ajoutés dans
`/admin/champs-conversion` : les mêmes que pose l'écran d'appel, mais **vides,
sans préremplissage**. Ils se saisissent à la création, se relisent, se
modifient, et les obligatoires sont vérifiés des deux côtés.

`champsLibres` était lisible sur une fiche et écrit par le formulaire public et
la consignation d'appel, mais ni la création ni la modification de prospect ne
l'acceptaient. Les deux chemins sont ouverts, avec la validation du formulaire
public réutilisée : une clé qui ne correspond à aucun champ déclaré tombe, une
réponse vide ne s'écrit pas. Le réglage de l'administrateur fait foi, pas ce que
le navigateur envoie.

Ce qui n'a **pas** été fait : remplacer `prospect-form.tsx` par
`ConversionFields`. Cette version supprimait 250 lignes pour en réécrire 120 et
faisait perdre au formulaire ce que la conversion ne porte pas : canal de
provenance, consentement, relais, pays de résidence. Quatre champs de la
conversion restent absents du formulaire d'ajout : e-mail, fonctionnaire,
engagement en cours, durée dans la fonction ; ils appartiennent au dossier
d'adhésion.

## 6. Corrections et permissions

**Le bouton « Enregistrer et ouvrir la fiche » n'ouvrait pas la fiche** quand le
formulaire vivait dans la boîte de dialogue de la liste : `onSaved` refermait la
boîte et abandonnait la navigation. Le booléen `andNext` cède la place à une
intention explicite (`'suivant' | 'fiche' | 'quitter'`) et un bouton
**« Enregistrer et quitter »** s'ajoute.

Un parcours e2e verrouillait ce défaut : GP-18 cliquait « ouvrir la fiche » puis
assertait qu'on restait sur la liste. Il porte maintenant sur « Enregistrer et
quitter », ce qui préserve son intention et couvre le nouveau bouton.

**Le superviseur travaille en Grand Public.** Il lui manquait deux routes
serveur (consentement et conversion), deux gardes de route et deux drapeaux
d'écran. L'import et les dossiers bancaires lui restent fermés, comme demandé ;
l'export des dossiers, lui, s'ouvre.

**« Noter un prospect » et « Appeler les prospects » quittent la barre
latérale** : les deux gestes vivent déjà en en-tête de la page Prospects.

**Le binaire ne démarrait pas sur Windows** : il charge un fuseau IANA et rien
n'embarquait `tzdata`. Un `import _ "time/tzdata"` le rend autonome partout. Le
`Dockerfile` n'installe pas ce paquet non plus : l'image de production
dépendait de ce que l'image de base contenait par hasard.

## 7. Ce qui reste ouvert

**Aucun test n'a été exécuté.** `make test` et `make e2e` n'ont pas tourné :
une douzaine de parcours Playwright ont été réécrits et relus, jamais joués. La
règle du dépôt, casser un parcours avant de le garder, n'a pas pu être
appliquée. C'est la faiblesse principale de ce travail.

Ce qui est vert en local : plafonds, `go build`, `go vet`, `gofmt`,
`golangci-lint`, `tsc`, `oxlint`, `prettier`, `vite build`, binaire compilé,
contrat et types régénérés.

Décisions laissées au propriétaire :

- Le compteur « injoignable » des tableaux de bord compte
  `outcome = 'UNREACHABLE'` : « À rappeler » et « Faux numéro » s'affichent sous
  Injoignable sans porter cette issue. L'écran et le chiffre ne diront pas la
  même chose.
- Le type de bien vit sur la personne, pas sur la vente : un prospect qui veut
  un terrain puis une villa n'aura qu'une valeur.
- Le chargé de clientèle n'a toujours pas « Modifier la fiche » en Grand Public,
  alors que l'API l'y autorise.
- L'export des dossiers n'est pas cloisonné par projet côté serveur : le
  paramètre `projet` vient du navigateur.
- Le crédit immobilier doit-il apparaître sur le formulaire public ? Par défaut,
  non.

Chantier commencé puis retiré de cette branche : **rendre le téléphone du
prospect facultatif**, pour importer les leads publicitaires qui n'ont qu'un nom
et une provenance. La colonne est la clé de déduplication de tout le CRM et le
refactor touche une trentaine de sites Go et soixante-dix dans le panneau ; il
attend un arbitrage sur la forme du contrat : `phoneE164: null` ou chaîne vide.
Il reprendra sur sa propre branche.
