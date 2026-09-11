# Demandes Grand Public : plan de réalisation

Demandes transmises par le prospect, relevées le 10 septembre 2026. Périmètre
annoncé : la coque Grand Public. Deux points touchent CHUES et sont signalés
comme tels.

Chaque ligne renvoie à un `chemin:ligne` du dépôt. Le chiffrage est en lignes
ajoutées ou déplacées, hors tests. Rien n'est codé avant l'arbitrage du §5.

## 1. Ce qui existe déjà

Trois demandes portent sur des écrans qui sont en place. Les vérifier avant de
construire évite de refaire ce que la v1 fournissait.

| Demande                                         | État                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Partie campagne sur Grand Public                | Existe. `web/src/routes/_panneau/grand-public/campagnes/index.tsx` sert `LotsExportView` avec `projet="GRAND_PUBLIC"`, exactement comme CHUES (`web/src/routes/_panneau/chues/campagnes/index.tsx`). L'onglet est déjà dans la barre de pilotage (`web/src/components/pilotage/onglets.tsx:33`). |
| Affectation des prospects à des téléconseillers | Existe. `lot-create-dialog.tsx:68-73` propose la cible « Prospects Grand Public » ; la répartition écrit `lot_export_items."assigneeId"` (`sql/schema.sql:609-616`).                                                                                                                             |
| Joignable / injoignable à la consignation       | Existent. `console-view.tsx:71-77` : Joignable, À rappeler, Injoignable, Mauvais numéro, Autre.                                                                                                                                                                                                  |

La conséquence pratique : la demande 1 est une **vérification**, pas un
développement. Ce qui manque réellement est la demande 2.

## 2. Les demandes, une par une

### D1. Ouvrir la partie campagne pour affecter des prospects (« same as CHUES »)

Rien à écrire. À vérifier sur la copie de prod : qu'un ADMIN ou un SUPERVISEUR
ouvre `/grand-public/campagnes`, crée un lot sur la cible « Prospects Grand
Public », choisit ses téléconseillers et voit la répartition.

**Coût : 0.** Si la vérification échoue, la panne est à qualifier avant de
planifier quoi que ce soit.

### D2. « Appeler un prospect » doit montrer les fiches que la campagne lui a confiées

C'est la seule vraie fonctionnalité manquante du lot.

Aujourd'hui l'écran d'appel Grand Public liste « les vingt dernières fiches
ajoutées au projet » (`console-view.tsx:98-105`, `annuaireFilters`), triées par
date de création. Le téléconseiller y retrouve ses attributions mêlées à ses
propres saisies, sans ordre utile.

CHUES a déjà exactement le mécanisme demandé, et il porte le nom que la demande
emploie : `GET /api/v1/representants?mesFiches=true` rend « ses propres fiches
et celles qu'une campagne lui a confiées »
(`web/src/lib/data/representants.ts:147-152`). Le serveur le fait en désarmant
la portée large (`internal/representants/representants.go:226-232`) au-dessus
d'une clause `EXISTS` sur `lot_export_items`
(`sql/queries/representants.sql:21-28`).

Le côté prospects a **déjà la même clause `EXISTS`**
(`sql/queries/prospects.sql:36-45`) : elle est simplement toujours court-circuitée
pour l'encadrement et jamais restreinte pour le téléconseiller.

**Plus petit changement complet**, calqué sur CHUES :

1. `internal/prospects/prospects.go` : un champ `MesFiches bool` dans
   `ProspectListInput` (~ligne 441) et un `if in.MesFiches { p.tout = false }`
   dans le calcul de portée (~ligne 520). **~6 lignes. Aucun SQL, aucune
   migration.**
2. `web/src/components/console/console-view.tsx` : `annuaireFilters` passe
   `mesFiches: true`, et le tri devient l'ordre de la campagne plutôt que la
   date de création. **~5 lignes.**
3. Les deux textes d'aide de l'écran (`console-view.tsx:226-230`) : ils
   annoncent « les vingt dernières fiches ajoutées », ce qui devient faux.
   **~2 lignes.**

**Coût : ~13 lignes, 3 fichiers, 0 migration.** Le parcours e2e
`parite-qualification.spec.ts` couvre l'écran ; une assertion de plus y suffit.

Hors périmètre : un écran « mes campagnes » séparé, un compteur de reste à
faire, une file de travail. Aucun n'est demandé.

### D3. Nom, prénom et numéro sous forme de tableau

L'annuaire d'appel est une liste de boutons empilés
(`console-view.tsx:410-443`) : nom et prénom sur une ligne, puis numéro, banque
et date du dernier appel en gris dessous.

**Plus petit changement complet** : remplacer le `<ol>` par un `<table>` à
trois colonnes (Nom et prénom · Numéro · Dernier appel), la ligne entière
restant cliquable. Le patron existe déjà dans le dépôt
(`web/src/components/prospects/prospects-table.tsx`) ; on reprend sa structure,
pas son moteur de tri, dont l'écran d'appel n'a pas besoin.

**Coût : ~40 lignes remplacées dans `console-view.tsx`, 1 fichier.**

À trancher au §5 : sous 768 px, un tableau à trois colonnes ne tient pas sur un
téléphone. Le dépôt bascule ces cas en cartes
(`plan.md` §3, patron `suggestions-view.tsx`). Le tableau vaudrait alors pour
le poste, et l'affichage actuel resterait sur téléphone.

### D4. Joignable et injoignable à la consignation

Les deux issues existent (`console-view.tsx:71-77`), avec trois autres : À
rappeler, Mauvais numéro, Autre.

La demande ne dit pas s'il faut **retirer** les trois autres. Question au §4.
Tant qu'elle n'est pas tranchée : **coût 0**.

Attention si la réponse est « ne garder que deux issues » : « À rappeler » est
le seul chemin qui pose une échéance de rappel, et l'écran « Rappels promis »
(`/grand-public/rappels`) se vide sans lui.

### D5. Envoyer un mail quand l'adhésion est faite

Deux écrans portent aujourd'hui le mot « conversion », et la demande ne dit pas
lequel :

- la **consignation d'appel** : issue « Joignable » puis dossier d'adhésion,
  envoyée par `POST /phase2/call-attempts`
  (`console-view.tsx:629-641`, `submitConversion`) ;
- la **fiche prospect Grand Public**, bouton « Confirmer la conversion », qui
  choisit une offre et un mode de paiement
  (`grand-public/prospect-detail.tsx:485-547`) et appelle
  `POST /api/v1/prospects/{id}/parcours/grand-public/conversion`
  (`internal/prospects/prospects_conversion.go:63`).

Le second est celui que le vocabulaire de la demande désigne (« la page
convertir prospect »).

Le client Brevo existe et est déjà configuré (`internal/notifications/brevo.go`,
`BREVO_*` dans `.env.example`). Sans clé, un envoi est marqué `NOT_CONFIGURED`
et ne fait pas échouer l'appelant : le comportement dégradé est acquis.

**Plus petit changement complet** : après la transaction de conversion
(`prospects_conversion.go:99`), un appel `Envoyer` avec un corps figé.
**~35 lignes dans `prospects_conversion.go`, plus l'injection du service
Brevo.** Un gabarit modifiable par l'ADMIN coûterait ~120 lignes de plus et
n'est pas demandé.

Deux inconnues bloquent l'écriture, au §4 : **à qui** part le mail, et **quel
texte**.

### D6. Statut sur « joignable », avant la profession

Valeurs demandées : intéressé, pas intéressé, retraité, hors cible, décédé.

Le dépôt a déjà le mécanisme : l'ADMIN ajoute des champs au formulaire
d'adhésion depuis `/admin/champs-conversion`, dont des listes de valeurs
(`web/src/lib/data/champs-conversion.ts:15-19`, type `LISTE`), par projet, avec
caractère obligatoire. Les réponses sont stockées, exportées
(`internal/exports/exports_prospects.go:466`) et relues dans le brouillon.

**Option A, zéro code.** L'ADMIN crée le champ « Statut » de type `LISTE` avec
les cinq valeurs sur le projet GRAND_PUBLIC. Limite : les champs ajoutés sont
rendus **après** tous les champs d'origine
(`conversion-fields.tsx:436-451`). Le statut arriverait en fin de formulaire,
pas avant la profession.

**Option B, ~25 lignes.** Faire entrer les champs ajoutés dans la liste
ordonnée `ordre` (`conversion-fields.tsx:427`), pour que l'ADMIN les place où
il veut, profession comprise. Touche `conversion-fields.tsx`, le corps de
`PUT /api/v1/champs-conversion/{projet}`
(`prospects_conversion.go:415-439`, qui écarte aujourd'hui tout nom de champ
inconnu) et l'écran de réglage.

**Option C, ~90 lignes et une migration.** Un vrai champ `statut` sur la
conversion, avec son type énuméré en base. Il gagne un filtre et une colonne de
statistiques que les deux autres options n'offrent pas.

Recommandation : **A d'abord**, en une manipulation, pour que le prospect voie
les cinq valeurs à l'écran. B seulement s'il tient à la position avant la
profession. C seulement s'il veut filtrer et compter sur ce statut, ce qu'il
n'a pas demandé.

### D7. « Fanée number »

Illisible. Aucune fonctionnalité du dépôt ne s'en rapproche. Question au §4.
**Non chiffré.**

### D8. Bouton retour de la fiche prospect

Sur Grand Public, le retour pointe déjà sur `/grand-public`
(`grand-public/prospect-detail.tsx:371-377`), qui est à la fois l'accueil de la
coque et la liste des prospects : les deux adresses de la demande sont la même
page.

La distinction existe en revanche sur **CHUES**, où le retour va sur
`/chues/prospects` (`prospects/prospect-detail-view.tsx:298,308,330`) alors que
l'accueil de la coque est `/chues`. C'est le point « à vérifier sur CHUES »
annoncé.

**Coût : 3 lignes sur CHUES, 1 fichier**, si la demande visait bien CHUES.
Sinon 0. Question au §4.

### D9. Paiement : ajouter « crédit immobilier »

`PaymentMode` est un type énuméré Postgres à deux valeurs
(`sql/schema.sql:154-157` : `COMPTANT`, `ECHELONNE`). Il est porté jusqu'au
panneau (`web/src/lib/types.ts:43-48`) et jusqu'aux deux écrans de paiement
(`conversion-fields.tsx:37-40`, `grand-public/prospect-detail.tsx:503`).

**Plus petit changement complet :**

1. Migration goose `ALTER TYPE "PaymentMode" ADD VALUE 'CREDIT_IMMOBILIER'`,
   en `-- +goose NO TRANSACTION`. **~8 lignes.**
2. Les `enum:"COMPTANT,ECHELONNE"` des contrats Go
   (`prospects_conversion.go:57` et les autres occurrences).
3. `PAYMENT_MODES` et `PAYMENT_MODE_LABELS` (`web/src/lib/types.ts:43-48`), et
   la liste `PAIEMENTS` de `conversion-fields.tsx:37-40`.

**Coût : ~20 lignes, 1 migration, 4 fichiers.**

À trancher : la contrainte `prospect_conversions_payment_check`
(`sql/schema.sql:760`) n'autorise une durée que sur `ECHELONNE`. Un crédit
immobilier porte-t-il une durée ? Si oui, la contrainte change avec la
migration. Question au §4.

### D10. Corriger « Enregistrer et ouvrir la fiche »

Le défaut est réel et localisé. Le bouton appelle `submit(false)`
(`grand-public/prospect-form.tsx:805-807`), qui aboutit à
`router.push('/grand-public/<id>')`, **sauf** si le formulaire a reçu un
`onSaved`, auquel cas ce rappel l'emporte et la navigation est abandonnée
(`prospect-form.tsx:575-581`).

Or la boîte de dialogue de création passe justement
`onSaved={() => setCreateOpen(false)}`
(`grand-public/prospects-view.tsx:359`). Depuis la liste, le bouton
**enregistre et referme la boîte, sans jamais ouvrir la fiche**. C'est très
exactement ce que la demande décrit.

**Plus petit changement complet** : distinguer les deux intentions. « suivant »
garde `onSaved` ; « ouvrir la fiche » navigue toujours. Environ **10 lignes
dans `prospect-form.tsx`**, aucun autre fichier.

### D11. Ajouter « Enregistrer et quitter »

Le pied du formulaire porte deux boutons (`prospect-form.tsx:813-860`) :
« Enregistrer et ouvrir la fiche » et « Enregistrer et suivant ». Il en faut un
troisième, qui enregistre et revient à l'accueil des prospects.

Se greffe sur le correctif D10 : une fois l'intention explicite, la troisième
n'est qu'une valeur de plus. **~12 lignes, 1 fichier.** À faire **avec** D10,
jamais avant.

### D12. Ajouter un select : terrain, villa

Deux lectures, et la demande ne tranche pas :

- **une offre**, à côté de celles que la fiche prospect propose déjà
  (`grand-public/prospect-detail.tsx:485`) : la table `offers`
  (`sql/schema.sql:696-705`) est un référentiel administrable, avec `code`,
  `label` et `position`. Ajouter « Terrain » et « Villa » est alors **zéro
  ligne de code** : deux lignes saisies dans les listes de référence ;
- **un champ de plus sur le formulaire d'adhésion**, à côté du statut de D6 :
  même arbitrage que D6, options A / B / C.

Recommandation : trancher avec D6, et prendre la même option pour les deux.
Question au §4.

### D13. Le formulaire d'ajout, identique à celui d'appel, sans préremplissage

Aujourd'hui les deux formulaires sont distincts :

- **ajout** : `grand-public/prospect-form.tsx`, 1 218 lignes, identité, canal
  de provenance, profession, tranche de revenu, situation ;
- **adhésion pendant l'appel** : `console/conversion-fields.tsx`, 656 lignes,
  piloté par les réglages de l'ADMIN, prérempli depuis la fiche appelée par
  `conversionFrom` (`web/src/lib/data/console.ts:310-335`).

Le préremplissage est déjà isolé dans cette seule fonction : la demande
« le même formulaire, sans le préremplissage » revient à appeler
`ConversionFields` avec un brouillon vide.

C'est la demande **la plus lourde du lot** et la seule qui touche à une
structure. Deux chemins :

- **Minimal, ~60 lignes** : le formulaire d'ajout reçoit les champs ajoutés par
  l'ADMIN (`useChampsConversion`) en plus de ses champs actuels. Le
  téléconseiller retrouve les mêmes questions des deux côtés, sans que rien ne
  soit réécrit.
- **Complet, ~250 lignes supprimées et ~120 réécrites** : `prospect-form.tsx`
  est remplacé par `ConversionFields` sur un brouillon vide. Un seul formulaire
  vit, ce qui est le sens littéral de la demande, mais l'écran d'ajout perd ce
  que la conversion ne porte pas (canal de provenance, consentement) tant qu'on
  ne l'a pas remis.

Recommandation : **minimal**, et mesurer l'écart restant à l'écran avant
d'aller plus loin. Le dépôt a déjà payé cher les réécritures menées avant
d'avoir constaté le besoin (`CONSTAT.md`).

## 3. Ce qui n'est fait dans aucune option

Rien de ceci n'est demandé, et rien n'est construit : file de travail
priorisée, notification au téléconseiller quand une campagne lui affecte des
fiches, historique des affectations à l'écran, statistiques par statut de
qualification Grand Public, gabarit de mail modifiable, mode hors ligne.

## 4. Questions à trancher avant de coder

Sept réponses manquent. Cinq bloquent, deux orientent seulement.

| #   | Question                                                                                                                                     | Bloque |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Q1  | D4 : garder les cinq issues, ou n'en garder que deux ? Deux issues vident l'écran « Rappels promis ».                                        | oui    |
| Q2  | D5 : le mail part au prospect, au téléconseiller ou à une adresse fixe ? Et quel texte porte-t-il ?                                          | oui    |
| Q3  | D5 : l'écran visé est bien « Confirmer la conversion » de la fiche prospect, et non le dossier d'adhésion de l'écran d'appel ?               | oui    |
| Q4  | D7 : que veut dire « Fanée number » ?                                                                                                        | oui    |
| Q5  | D6 et D12 : option A (zéro code, champ en fin de formulaire), B (~25 lignes, position libre) ou C (~90 lignes et une migration, filtrable) ? | oui    |
| Q6  | D8 : la demande vise-t-elle CHUES ? Sur Grand Public, accueil et liste sont la même page.                                                    | non    |
| Q7  | D9 : un crédit immobilier porte-t-il une durée, comme l'échelonné ?                                                                          | non    |

reponses questions : 
Q1 garder uniquement joignable et injoignable avec leurs sous options,
Q2 un mail fixe a configurer en parametre (a ajouter),
Q3 la **fiche prospect Grand Public**, bouton « Confirmer la conversion », qui
  choisit une offre et un mode de paiement,
Q4 c'est fake number (faux numero),
Q5 j'ai pas trop compris la question,
Q6 quand on click sur le button retour ca doi nous ramener sur la page racine de prospetcs pareil que si on click sur prospect depuis la sidebar,
Q7 pour l'instant on laisse ca sans durée , 





## 5. Ordre proposé

Trois lots. Chacun se livre et se vérifie seul.

**Lot 1 : ce qui ne dépend d'aucune réponse. ~85 lignes, 6 fichiers.**
D1 (vérification), D2, D3, D10, D11. Le lot rend l'écran d'appel utile et
répare le bouton cassé.

**Lot 2 : après Q5 et Q7. ~20 à 135 lignes selon l'option.**
D6, D9, D12.

**Lot 3 : après Q1 à Q4. ~35 à 100 lignes.**
D4, D5, D7, D8.

**D13 en dernier**, seul, une fois les lots 1 à 3 à l'écran : c'est la seule
demande dont la forme dépend de ce que les autres auront changé.

Total du chemin recommandé, options minimales retenues : **environ 200 lignes,
une migration, une dizaine de fichiers.** La v1 aurait produit ce lot en
plusieurs milliers.
