# Demandes Grand Public : plan de réalisation

Demandes du prospect relevées le 10 septembre 2026, arbitrages du propriétaire
du même jour (§4). Périmètre : la coque Grand Public. Deux points touchent
CHUES et sont signalés comme tels.

Chaque affirmation renvoie à un `chemin:ligne` du dépôt. Le chiffrage est en
lignes ajoutées ou déplacées, hors tests.

## 1. Ce que le dépôt sait déjà faire et que le panneau n'utilise pas

C'est le fait le plus important du lot. Trois demandes sur treize portent sur
des mécanismes déjà construits, déjà administrables, jamais branchés.

### 1.1 Le référentiel des issues d'appel

La table `call_outcome_reasons` (`sql/schema.sql:437-449`) porte, pour chaque
motif d'appel : un `effect`, un drapeau `requiresComment`, un
`requiresCallback`, un `sortOrder`, une couleur, et surtout un
**`countsAsReached`**, qui est exactement la distinction joignable /
injoignable demandée.

Autour d'elle, tout existe :

| Pièce                                | État                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Écran d'administration               | `/admin/referentiels/issues-appel`, `components/referentiels/call-outcome-reasons-view.tsx`                                  |
| Cinq routes de gestion               | `internal/referentiels/referentiels.go:1287-1291`                                                                            |
| Route de saisie, motifs actifs seuls | `GET /api/v1/call-outcome-reasons` (`referentiels.go:1099`)                                                                  |
| Écriture de la tentative             | `POST /phase2/call-attempts` accepte déjà `reasonCode` (`qualification.go:719`)                                              |
| Règles serveur                       | effet, commentaire exigé, rappel exigé, motif inactif, motif incohérent avec l'issue (`qualification.go:773-801`, `804-842`) |
| Consommation par le panneau          | aucune                                                                                                                       |

L'écran d'appel affiche à la place cinq boutons écrits en dur
(`console-view.tsx:71-77`) et n'envoie jamais `reasonCode`
(`lib/data/console.ts:798`).

Conséquence : les demandes D4 (joignable / injoignable), les cinq statuts et le
faux numéro ne sont pas trois fonctionnalités à construire. C'est un seul
branchement, et les libellés deviennent modifiables par l'ADMIN sans
développeur.

### 1.2 La portée par campagne

`sql/queries/prospects.sql:36-45` contient déjà la clause `EXISTS` sur
`lot_export_items` qui rend à un téléconseiller les fiches qu'une campagne lui
a confiées. Elle n'est simplement jamais restreinte pour lui. CHUES a le même
SQL (`sql/queries/representants.sql:21-28`) et l'expose sous le nom
`mesFiches` (`representants.go:226-232`).

### 1.3 Les paramètres de messagerie

`ProspectParametresChues` (`prospects_conversion.go:509-522`) porte déjà quatre
listes de destinataires et le couple objet / corps d'un accusé de réception,
stockés dans `app_settings`, table clé-valeur (`sql/schema.sql:321-326`) : un
paramètre de plus ne coûte aucune migration. L'envoi Brevo avec substitution de
jetons existe et sert déjà le formulaire public
(`formulaire_public.go:320-348`).

### 1.4 La partie campagne Grand Public

Elle existe : `routes/_panneau/grand-public/campagnes/index.tsx` sert
`LotsExportView` avec `projet="GRAND_PUBLIC"`, comme CHUES, l'onglet est dans
la barre de pilotage (`pilotage/onglets.tsx:33`) et le dialogue de création
propose la cible « Prospects Grand Public » (`lot-create-dialog.tsx:68-73`).

## 2. Les demandes

### D1. Ouvrir la partie campagne pour affecter des prospects

Rien à écrire (§1.4). À vérifier sur la copie de prod : un ADMIN ou un
SUPERVISEUR ouvre `/grand-public/campagnes`, crée un lot sur « Prospects Grand
Public », choisit ses téléconseillers, voit la répartition.

**Coût : 0.**

### D2. « Appeler un prospect » montre les fiches que la campagne lui a confiées

L'écran d'appel liste aujourd'hui « les vingt dernières fiches ajoutées au
projet » (`console-view.tsx:98-105`), triées par date de création : les
attributions de campagne y sont noyées dans les saisies personnelles.

Portage de `mesFiches` (§1.2), à l'identique de CHUES :

1. `internal/prospects/prospects.go` : champ `MesFiches bool` dans
   `ProspectListInput` (~ligne 441), et `p.tout = false` quand il est posé
   (~ligne 520). **~6 lignes, aucun SQL, aucune migration.**
2. `console-view.tsx` : `annuaireFilters` passe `mesFiches: true`, et le tri
   suit la campagne au lieu de la date de création. **~5 lignes.**
3. Les deux textes d'aide (`console-view.tsx:226-230`) annoncent « les vingt
   dernières fiches ajoutées », ce qui devient faux. **~2 lignes.**

**Coût : ~13 lignes, 3 fichiers, 0 migration.**

Hors périmètre : écran « mes campagnes » séparé, compteur de reste à faire,
file de travail priorisée.

### D3. Nom, prénom et numéro sous forme de tableau

L'annuaire est une liste de boutons empilés (`console-view.tsx:410-443`). Le
remplacer par un tableau à trois colonnes (Nom et prénom · Numéro · Dernier
appel), ligne entière cliquable, sur le patron de
`components/prospects/prospects-table.tsx` sans son moteur de tri.

**Coût : ~40 lignes remplacées, 1 fichier.**

Sous 768 px un tableau à trois colonnes ne tient pas au pouce ; le dépôt
bascule ces cas en cartes (`plan.md` §3). Le tableau vaut donc pour le poste,
l'affichage actuel reste sur téléphone.

### D4. Joignable et injoignable, avec leurs sous-options

Regroupe trois demandes de la première version du plan, les issues d'appel, les
cinq statuts et le faux numéro : une seule construction les sert (§1.1).

Cible retenue :

```
Qui avez-vous eu au téléphone ?

  [ 1  Joignable ]   [ 2  Injoignable ]
         |                    |
         v                    v
   Intéressé            À rappeler   -> demande l'échéance
   Pas intéressé        Faux numéro  -> clôt la fiche
   Retraité             Autre        -> exige un commentaire
   Hors cible
   Décédé
```

Les deux boutons sont pilotés par `countsAsReached` ; les sous-options sont les
lignes actives du référentiel, dans leur `sortOrder`. « Intéressé » porte
l'effet `CLOSE_METHOD` et ouvre le dossier d'adhésion : le statut est donc
choisi avant la profession, ce que la demande exige, sans champ supplémentaire.

Travail :

1. `lib/data/call-outcome-reasons.ts` : une lecture de la variante saisie
   (`GET /api/v1/call-outcome-reasons`), à côté de la variante administration
   déjà écrite (lignes 45-50). **~8 lignes.**
2. `console-view.tsx` : `ISSUES` en dur (lignes 71-77) remplacé par les deux
   boutons et leurs sous-options ; envoi de `reasonCode` ; table de
   correspondance effet vers `outcome`, que le serveur vérifie
   (`qualification.go:796`). Raccourcis clavier renumérotés (lignes 79-92).
   **~70 lignes.**
3. `lib/data/console.ts` : `reasonCode` dans le corps de la tentative
   (ligne 798) et règles locales de validation alignées sur celles du
   référentiel (lignes 638-657). **~15 lignes.**
4. Vocabulaire « Faux numéro » : le serveur l'emploie déjà (`exports.go:70`),
   le panneau dit « Mauvais numéro » à quatre endroits (`types.ts:215,250,271`,
   `console-view.tsx:83`) et le serveur se contredit lui-même avec
   `ExportLibelleMauvaisNumero`. **~6 lignes.**
5. Saisie par l'ADMIN des huit motifs, dans l'écran existant. **0 ligne.**

**Coût : ~99 lignes, 4 fichiers, 0 migration.**

Ce que ce choix apporte en plus : l'ADMIN ajoute un motif, le renomme ou le
retire sans développeur ni redéploiement.

Point de vigilance : un référentiel sans aucun motif `countsAsReached`
laisserait « Joignable » sans sous-option et bloquerait la consignation. Un
repli sur les six motifs système (`qualification.go:703-710`) évite l'écran
mort ; ces ~8 lignes sont comprises dans le chiffrage.

### D5. Envoyer un mail quand l'adhésion est faite

Écran visé, confirmé : la fiche prospect Grand Public, bouton « Confirmer la
conversion » (`grand-public/prospect-detail.tsx:485-547`), qui appelle
`POST /api/v1/prospects/{id}/parcours/grand-public/conversion`
(`prospects_conversion.go:63`).

Destinataire, confirmé : une adresse fixe, réglée dans les paramètres, à
ajouter.

Travail, calqué sur l'envoi du formulaire public
(`formulaire_public.go:320-348`) :

1. `ProspectParametresChues` : trois clés de plus, `destinatairesAdhesion`
   (liste, comme les quatre existantes), `adhesionObjet` et `adhesionCorps`
   avec leurs valeurs d'usine (`prospects_conversion.go:509-548`, `693-709`).
   **~18 lignes, aucune migration**, `app_settings` étant clé-valeur.
2. `settings/parametres-chues-card.tsx` : trois libellés et une entrée dans
   `LISTES` (lignes 27-47). **~6 lignes.**
3. `prospects_conversion.go` : après la transaction (ligne 99), composition et
   envoi, avec les mêmes jetons que l'accusé de réception. **~35 lignes.**

**Coût : ~59 lignes, 3 fichiers, 0 migration.**

Sans clé Brevo, l'envoi est marqué `NOT_CONFIGURED` et ne fait pas échouer la
conversion (`brevo.go:103-108`) : le comportement dégradé est acquis, il n'y a
rien à écrire pour lui.

### D6. Bouton retour de la fiche prospect

Réponse du propriétaire : le retour doit mener à la racine des prospects, celle
que la barre latérale ouvre.

C'est déjà le cas dans les deux coques, et il n'y a qu'un bouton retour par
fiche :

| Coque        | Barre latérale                              | Bouton retour                                                         |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------- |
| Grand Public | `/grand-public` (`nav-items.ts:618`)        | `/grand-public` (`grand-public/prospect-detail.tsx:371-377`)          |
| CHUES        | `/chues/prospects` (`nav-items.ts:315,369`) | `/chues/prospects` (`prospects/prospect-detail-view.tsx:298,308,330`) |

**Coût : 0.** Avant d'écrire quoi que ce soit, il faut la reproduction : depuis
quel écran la fiche était ouverte, et où le bouton a mené. Une piste plausible
et non demandée : le retour perd les filtres posés sur la liste, ce qui donne
l'impression d'atterrir ailleurs.

### D7. Paiement : ajouter « crédit immobilier »

`PaymentMode` est un type énuméré Postgres à deux valeurs
(`sql/schema.sql:154-157`). Le champ vit sur le formulaire d'ajout de prospect
(`grand-public/prospect-form.tsx:447-464`), et pas seulement sur la conversion.

Sans durée, arbitrage du propriétaire : la contrainte
`prospect_conversions_payment_check` (`sql/schema.sql:760`), qui n'autorise une
durée que sur `ECHELONNE`, reste telle quelle et interdit d'elle-même la durée
sur un crédit immobilier. Rien à modifier en base au-delà de l'énuméré.

Travail :

1. Migration goose `ALTER TYPE "PaymentMode" ADD VALUE 'CREDIT_IMMOBILIER'`, en
   `-- +goose NO TRANSACTION`. **~8 lignes.**
2. Les `enum:"COMPTANT,ECHELONNE"` des contrats Go, dont
   `prospects_conversion.go:57`.
3. `types.ts:43-48`, puis les trois listes écrites en dur :
   `prospect-form.tsx:459-460`, `grand-public/prospect-detail.tsx:509-510`,
   `console/conversion-fields.tsx:37-40`. La quatrième se met à jour seule.
4. Le champ « durée » ne s'affiche que sur `ECHELONNE`
   (`prospect-form.tsx:486`, `conversion-fields.tsx:352`) : rien à faire.

**Coût : ~25 lignes, 1 migration, 6 fichiers.**

À signaler, non demandé : le formulaire public `/demande/{jeton}` dérive ses
options de `PAYMENT_MODE_LABELS` (`demande/formulaire-demande.tsx:64`).
« Crédit immobilier » y apparaîtra tout seul, devant des inconnus. Par défaut
je l'en exclus (**2 lignes**) ; à dire si le contraire est voulu.

### D8. Corriger « Enregistrer et ouvrir la fiche »

Le défaut est localisé. Le bouton appelle `submit(false)`
(`prospect-form.tsx:805-807`), qui mène à `router.push('/grand-public/<id>')`,
sauf si le formulaire a reçu un `onSaved` : ce rappel l'emporte et la
navigation est abandonnée (`prospect-form.tsx:575-581`).

Or la boîte de création lancée depuis la liste passe justement
`onSaved={() => setCreateOpen(false)}` (`grand-public/prospects-view.tsx:359`).
Depuis la liste, le bouton enregistre, referme la boîte, et n'ouvre jamais la
fiche.

Correctif : rendre l'intention explicite. « suivant » garde `onSaved`, « ouvrir
la fiche » navigue toujours.

**Coût : ~10 lignes, 1 fichier.**

### D9. Ajouter « Enregistrer et quitter »

Le pied du formulaire porte deux boutons (`prospect-form.tsx:813-860`). Il en
faut un troisième, qui enregistre et revient à la racine des prospects.

Se greffe sur D8 : une fois l'intention explicite, la troisième n'est qu'une
valeur de plus. **~12 lignes, 1 fichier.** À faire avec D8, jamais avant.

### D10. Type de bien : terrain, villa

Emplacement retenu : le formulaire d'ajout de prospect, à côté du champ
Paiement.

Aucune colonne ne convient (`sql/schema.sql:784-833`). Il faut donc la chaîne
complète :

1. Migration : type énuméré `TypeBien` (`TERRAIN`, `VILLA`) et colonne
   `prospects."typeBien"`, nullable. **~10 lignes.**
2. `sql/queries/prospects.sql` : la colonne dans la lecture, la création et la
   mise à jour.
3. `internal/prospects/prospects.go` : entrée, sortie.
4. `prospect-form.tsx` : le select, à côté de Paiement.
5. Export : une colonne de plus dans le classeur prospects
   (`internal/exports/exports_prospects.go`).

**Coût : ~45 lignes, 1 migration, 5 fichiers.**

Variante à zéro ligne, écartée puisque le champ est voulu sur le formulaire
d'ajout : un champ ajouté de type liste dans `/admin/champs-conversion`,
qui n'apparaîtrait que sur le formulaire d'adhésion.

### D11. Le formulaire d'ajout, identique à celui d'appel, sans préremplissage

Aujourd'hui deux formulaires distincts :

- ajout : `grand-public/prospect-form.tsx`, 1 218 lignes ;
- adhésion pendant l'appel : `console/conversion-fields.tsx`, 656 lignes,
  piloté par les réglages de l'ADMIN, prérempli depuis la fiche appelée par
  `conversionFrom` (`lib/data/console.ts:310-335`).

Le préremplissage est déjà isolé dans cette seule fonction : « le même
formulaire, sans le préremplissage » revient à appeler `ConversionFields` sur
un brouillon vide.

C'est la demande la plus lourde et la seule qui touche à une structure.

- **Minimal, ~60 lignes** : le formulaire d'ajout reçoit les champs ajoutés par
  l'ADMIN (`useChampsConversion`) en plus des siens. Les mêmes questions des
  deux côtés, sans rien réécrire.
- **Complet, ~250 lignes supprimées et ~120 réécrites** : `prospect-form.tsx`
  cède la place à `ConversionFields` sur un brouillon vide. Un seul formulaire
  vit, ce qui est le sens littéral de la demande, mais l'écran d'ajout perd ce
  que la conversion ne porte pas (canal de provenance, consentement) tant qu'on
  ne l'a pas remis.

Recommandation : minimal, puis mesurer l'écart restant à l'écran. Le dépôt a
déjà payé cher les réécritures menées avant d'avoir constaté le besoin
(`CONSTAT.md`).

## 3. Ce qui n'est construit dans aucune option

Rien de ceci n'est demandé : file de travail priorisée, notification au
téléconseiller quand une campagne lui affecte des fiches, historique des
affectations à l'écran, statistiques par statut de qualification Grand Public,
gabarit de mail modifiable par écran dédié, mode hors ligne.

## 4. Arbitrages du propriétaire

| #   | Question                        | Réponse                                                     |
| --- | ------------------------------- | ----------------------------------------------------------- |
| Q1  | Combien d'issues d'appel        | Joignable et Injoignable seulement, avec leurs sous-options |
| Q2  | Destinataire du mail d'adhésion | Une adresse fixe, réglée dans les paramètres, à ajouter     |
| Q3  | Quel écran envoie le mail       | La fiche prospect, bouton « Confirmer la conversion »       |
| Q4  | « Fanée number »                | « Faux numéro »                                             |
| Q5  | D'où viennent les sous-options  | Du référentiel administrable, pas du code                   |
| Q5b | Où vit terrain / villa          | Sur le formulaire d'ajout de prospect                       |
| Q6  | Où mène le bouton retour        | À la racine des prospects, comme la barre latérale          |
| Q7  | Durée du crédit immobilier      | Aucune, pour l'instant                                      |

Deux points restent à confirmer, sans bloquer :

- D6 : une reproduction du bouton retour, déjà conforme à la réponse Q6 dans
  les deux coques.
- D7 : « Crédit immobilier » doit-il apparaître sur le formulaire public ouvert
  aux inconnus ? Par défaut, non.

## 5. Ordre proposé

Cinq lots, chacun livrable et vérifiable seul.

| Lot                            | Contenu                                  | Lignes | Migration |
| ------------------------------ | ---------------------------------------- | -----: | --------- |
| 1. Écran d'appel et formulaire | D1 et D6 en vérification, D2, D3, D8, D9 |    ~75 | non       |
| 2. Issues d'appel              | D4, vocabulaire « faux numéro » compris  |    ~99 | non       |
| 3. Champs de la fiche          | D7, D10                                  |    ~70 | 2         |
| 4. Mail d'adhésion             | D5                                       |    ~59 | non       |
| 5. Formulaire unique           | D11, version minimale                    |    ~60 | non       |

**Total : environ 363 lignes, deux migrations, une quinzaine de fichiers.**

Le lot 1 ne dépend d'aucune réponse et répare le bouton cassé : il se commence
tout de suite. Le lot 2 exige que l'ADMIN saisisse les huit motifs avant la
mise en ligne, sinon le repli sur les motifs système prend la main. Le lot 5
vient en dernier : sa forme dépend de ce que les quatre autres auront changé à
l'écran.

Parcours Playwright touchés : `parite-qualification.spec.ts`,
`ajouter-prospect.spec.ts`, `convertir.spec.ts`, `parite-grand-public.spec.ts`.
Chacun se casse avant d'être gardé, comme l'exige `AGENTS.md`.
