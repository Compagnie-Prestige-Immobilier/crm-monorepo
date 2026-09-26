# Courriels d'enrôlement, ergonomie et administration, 26 septembre 2026

Trois questions du propriétaire : pourquoi les courriels « méthode d'enrôlement » sont pénibles, où le panneau est difficile à utiliser, et pourquoi l'administration l'est encore plus.

Méthode : lecture du code, puis parcours réels de chaque rôle dans le panneau (Chromium, base de revue jetable de 483 fiches, un compte par rôle), en 1440 × 900 et 390 × 844. Rien n'est codé : toute refonte d'écran attend l'accord écrit du propriétaire (`CLAUDE.md`).

## 1. Les courriels « méthode d'enrôlement »

### Ce que c'est

Un seul courriel est en cause : `PROSPECT_ENROLEMENT`. Il part par Brevo **à chaque appel consigné dont l'issue est « méthode obtenue »** (`internal/qualification/qualification.go:995-996`, contenu dans `internal/qualification/qualification_enrolement.go:15-86`).

- Objet : « Prospect transmis à l'enrôlement : <client> » ou « Rendez-vous d'enrôlement : <client> ».
- Corps : un tableau de 7 à 8 lignes et un lien vers la fiche, **plus un PDF joint qui répète le même tableau** (`qualification_enrolement.go:80`).
- Destinataires : les adresses de la carte « Rendez-vous d'enrôlement » de l'écran **Admin > Courriels** (`web/src/components/settings/courriels-reglages.tsx:25-31`). Ni le prospect, ni le téléconseiller, ni les superviseurs ne le reçoivent d'office.

### Pourquoi c'est pénible (tout est CONFIRMÉ dans le code)

1. **Un courriel pour chaque méthode, pas seulement pour les rendez-vous.** L'écran annonce « Rendez-vous d'enrôlement », mais le code envoie aussi pour Plateforme en ligne, WhatsApp et Mail. Avec une dizaine de téléconseillers à 3 à 5 méthodes par jour, chaque adresse reçoit 30 à 50 courriels par jour, chacun avec un PDF redondant.
2. **Renvoi sur une fiche déjà enrôlée.** Rappeler une fiche déjà en « méthode obtenue » et reconsigner une méthode (confirmer le rendez-vous, passer de WhatsApp à RV CPI) renvoie un courriel complet. Seul le rejeu réseau est dédoublonné.
3. **Impossible à couper.** Il n'y a pas d'interrupteur. Vider la liste des destinataires ne l'arrête pas : chaque envoi devient une ligne en échec « Aucun destinataire configuré » (`internal/notifications/courriels.go:293-296`), relancée trois fois, puis citée le lendemain dans **l'alerte d'incident de 7 h envoyée à tous les ADMIN**.
4. **Trois listes de destinataires qui ne servent à rien.** L'écran Téléconseil > Paramètres CHUES propose « Cellule enrôlement », « Cellule BPE » et « Direction » avec l'aide « Reçoit une copie de chaque demande » ; aucun code ne lit ces listes (`internal/prospects/prospects_conversion.go:697-700`). Retirer son adresse à cet endroit ne change rien.
5. **Rafale du matin.** Ce qui est consigné après 18 h ou le dimanche part d'un bloc à 8 h (20 toutes les 5 minutes) et apparaît entre-temps « en échec » dans Exploitation, ce qui ressemble à une panne.
6. **Incohérence** : quand l'encadrement change la méthode depuis la fiche ou par requalification, aucun courriel ne part (`internal/prospects/prospects_methode.go:22-58`).

Autres messages de la même famille, moins gênants : la notification in-app « Dossier complet » à Banque & Finance (une par inscription, mais toutes renvoyées après une purge du miroir d'inscriptions) et le compte rendu de 17 h (in-app).

### Ce qu'on peut changer

| Option                                                            | Effet                                                                                                                     | Taille                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| A. Liste vide = courriel coupé                                    | l'écran Courriels devient l'interrupteur, plus d'incident à 7 h                                                           | 3 lignes Go, 1 ligne d'aide             |
| B. Un seul courriel par fiche (ou seulement si la méthode change) | fin des renvois                                                                                                           | environ 6 lignes, requête existante     |
| C. Seulement pour les rendez-vous (RV CPI, RV site)               | met le code en accord avec le titre de l'écran ; les enrôlements à distance se suivent déjà dans Plateformes d'enrôlement | 3 lignes, **choix métier à valider**    |
| D. Retirer le PDF joint                                           | un courriel plus léger, rien de perdu                                                                                     | 1 ligne                                 |
| E. Supprimer les trois listes mortes de Paramètres CHUES          | un seul endroit décide qui reçoit                                                                                         | environ 15 lignes                       |
| F. Une notification « N dossiers complets » par tirage            | plus de rafale in-app après une purge                                                                                     | environ 10 lignes                       |
| G. Récapitulatif quotidien à la place de l'envoi par fiche        | un courriel par jour                                                                                                      | environ 80 lignes, seulement sur accord |

Recommandation : **A + B + D** tout de suite (une dizaine de lignes, aucun changement métier), **C** si la direction confirme que seuls les rendez-vous l'intéressent, **E** pour la clarté.

## 2. Ergonomie des écrans du quotidien

### Ce que coûte une journée de téléconseiller

| Tâche                    | Clics aujourd'hui | Frein principal                                                                                            |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Appel sans réponse (NRP) | 5                 | confirmation « Ouvrir la fiche de X ? » à chaque appel                                                     |
| Appel avec rappel daté   | 7                 | confirmation ; « Passer le formulaire » et « Continuer » font la même chose                                |
| RV site                  | 11                | site et point de rencontre obligatoires mais non signalés, demandés après la date : oubli = refus à la fin |
| Traiter un rappel dû     | 10                | après l'enregistrement, retour à la file et non aux rappels                                                |
| Retrouver un prospect    | 3 avant l'appel   | la recherche ne porte que sur « Reste à appeler » et dépend de l'ordre nom/prénom                          |

### Défauts à corriger en priorité

| #   | Gravité | Défaut                                                                                                                                                                                        | Preuve                                                         |
| --- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| U1  | Haute   | **Aucun bouton ne montre le focus clavier.** En Tailwind 4, `outline-none` fixe le style à `none` et `focus-visible:outline-2` ne le rétablit pas. Les téléconseillers travaillent au clavier | `web/src/components/ui/button.tsx:10`                          |
| U2  | Haute   | Au premier pas de la fiche d'appel, aucun bouton pour quitter ; sur téléphone on reste coincé                                                                                                 | `console/console-view.tsx:1599`                                |
| U3  | Haute   | Une fiche convertie ou vendue se remplit sur 5 étapes, puis le serveur la refuse                                                                                                              | `console-view.tsx:1744-1750`                                   |
| U4  | Haute   | Saisie perdue : une fiche quittée par le menu rouvre au pas 1 (le brouillon n'est relu que sur une ouverture fermée)                                                                          | `sql/queries/qualification.sql:335-340`                        |
| U5  | Haute   | Recherche sensible à l'ordre : « Khady Kane » donne 0 résultat là où l'écran l'affiche ainsi ; Rappels et Mes contacts affichent l'ordre inverse                                              | `sql/queries/prospects.sql:180, 331`                           |
| U6  | Haute   | RV site : champs obligatoires non signalés, refus final par un simple toast, récapitulatif « Rappel le » au lieu de « Rendez-vous le »                                                        | `console/rendez-vous-site.tsx:59, 77`                          |
| U7  | Haute   | « Annuler » supprime un rappel promis en un clic, sans confirmation ni rétablissement, à côté de l'action principale                                                                          | `rappels/rappels-view.tsx:256-265`                             |
| U8  | Haute   | Sur téléphone, le numéro n'est pas un lien d'appel dans la fiche d'appel ni dans Rappels                                                                                                      | `console-view.tsx:1704`, `rappels-view.tsx:219`                |
| U9  | Haute   | Sur téléphone, file, rappels et contacts défilent en largeur : numéro et bouton « Consigner l'appel » hors écran                                                                              | captures `m-tc-console.png`, `m-tc-rappels.png`                |
| U10 | Moyenne | Compteurs contradictoires : Mon travail compte CHUES seul (« 28 en retard »), Rappels compte les deux projets (57)                                                                            | `chues/hub-view.tsx:47-58`                                     |
| U11 | Moyenne | Le lien « Tous les prospects » d'une fiche mène le téléconseiller à « Accès refusé »                                                                                                          | `prospects/prospect-detail-view.tsx:82-108`                    |
| U12 | Moyenne | Méthode choisie (« ferme la fiche »), puis l'écran propose encore « Pas intéressé » ; message technique « à renseigner dans les paramètres CHUES » affiché au téléconseiller                  | `conversion-fields.tsx:594`                                    |
| U13 | Moyenne | Jargon : « NRP », « RV CPI », « BDD1 » à « BDD4 », regroupement « aucun », « Méthode d'enrôlement : Aucun »                                                                                   | `prospects-table.tsx:424, 640`, `segment.ts:14`                |
| U14 | Moyenne | Supervision : textes et colonnes sur le « journal du téléphone Android » alors que l'application mobile est abandonnée                                                                        | `supervision/activity-view.tsx:213`                            |
| U15 | Moyenne | La direction arrive sur « Leads importés » (souvent vide) ; Ventes et Banque & Finance à 2 clics                                                                                              | `layout/nav-items.ts:703-715`                                  |
| U16 | Moyenne | Accueil : pas de filtre « aujourd'hui » sur les rendez-vous du jour, numéro brut                                                                                                              | `accueil/rendez-vous-comptoir.tsx:119, 244`                    |
| U17 | Moyenne | Mes contacts : « 242 au total, les 100 plus récents sont affichés » sans page suivante                                                                                                        | `contacts/mes-contacts-view.tsx:470`                           |
| U18 | Moyenne | Sur téléphone, 12 contrôles avant le premier chiffre du tableau de bord ; filtres de Banque & Finance sur tout le premier écran ; `/ventes/sites` déborde la page                             | captures `m-sup-tableau-de-bord.png`, `m-dir-ventes-sites.png` |

Défauts bas (textes et détails) : « 1 heures », « Montant : 0 FCFA » dans un rejet, date ISO et axe décimal au tableau de bord de l'accueil, « Remplacer le classeur » quand il n'y en a pas, code « KXA8DT » au lieu du nom du représentant, cibles tactiles du calendrier RV site de 36 px, touche Entrée qui choisit « Sans précision ».

## 3. Administration et navigation

### Le constat en chiffres

| Rôle             | Espaces ouverts | Destinations de navigation | Arrive sur                                           |
| ---------------- | --------------- | -------------------------- | ---------------------------------------------------- |
| ADMIN            | 5 / 5           | **44**                     | Téléconseil > Tableau de bord (pas l'administration) |
| DIRECTION        | 4 / 5           | 26                         | Leads importés                                       |
| SUPERVISEUR      | 2 / 5           | 16                         | Tableau de bord                                      |
| CHARGE_CLIENTELE | 1 / 5           | 8                          | Mon travail                                          |
| Téléconseiller   | 1 / 5           | 7                          | Mon travail                                          |
| BANQUE_FINANCE   | 1 / 5           | 5                          | Banque & Finance                                     |
| ACCUEIL          | 1 / 5           | 4                          | Accueil                                              |

La barre Admin compte 14 entrées, 4 titres de section et 2 menus « Plus » qui s'ouvrent ensemble (ouvrir l'un ouvre l'autre et pousse Exploitation hors de l'écran, `sidebar-nav.tsx:71`).

### Pourquoi c'est difficile, au-delà du nombre d'entrées

1. **Les réglages sont éparpillés dans 5 espaces.** Courriels : Admin > Courriels **et** Téléconseil > Paramètres CHUES, sans lien entre les deux. Import : 4 portes (Admin, Représentants, Accueil, Ventes). Sites de vente : Ventes > Plus. Étapes des dossiers : Banque & Finance.
2. **Rare, fréquent et dangereux sont mélangés.** « Paramètres » en premier niveau ouvre une **suppression irréversible** des données (`nav-items.ts:600`). « Utilisateurs et rôles », la tâche la plus fréquente, arrive en 4e position après Assistant et Enrôlement.
3. **Jargon technique.** Exploitation et Kairo parlent en p95, 4xx, cron « */5 * * * * », PR, MTTR, « Triage JEV ». L'enrôlement parle de « Tirer », « Vider puis tirer », « miroir ».
4. **Impasses et textes faux.**
   - La synthèse d'enrôlement demande de « renseigner son adresse et son jeton », qui ne se règlent que sur le serveur.
   - L'écran des issues d'appel annonce que les motifs « ne descendent pas sur les téléphones » (application abandonnée) et parle de « Rôle du design system ».
   - L'écran Courriels ne signale pas que les courriels sans destinataire ne partent pas.
   - Le journal affiche « COMMERCIAL » (mot interdit à l'écran), « CREATE », « prospect.statut ».
5. **Éditeur de rôles** : 56 cases à cocher en 24 domaines, dont 12 à une seule case, sur 4 600 px, sans recherche (`role-editeur.tsx:79-100`).
6. **Ajouter un motif d'appel** : il n'est pas dans les 10 onglets de Listes de référence, il faut repérer un lien en fin de phrase (`referentiels-view.tsx:97-101`).
7. **Trouver pourquoi un courriel n'est pas parti** : Système & Audit > Plus > Exploitation, sous la ligne de flottaison, puis un tableau de bord de requêtes HTTP avant l'onglet Courriels, sans filtre par état.

### Barre latérale proposée (à valider)

ADMIN : 9 entrées visibles et 4 repliées, arrivée directe dans Administration.

```
Administration
  Au quotidien
    Comptes et rôles            (onglets Utilisateurs | Rôles)
    Importer un classeur        (seule porte d'import)
    Journal des actions
    Envois et tâches            (ouvre sur Courriels et Tâches, trafic technique en dernier)
  Réglages
    Listes de référence         (Issues d'appel en premier onglet ; liens vers Sites de vente, Étapes des dossiers, Listes de l'accueil)
    Courriels et messages       (fusion des deux écrans actuels)
    Notifications
    Champs de la conversion
    Plateformes d'enrôlement    (réglages en tête)
  Plus
    Assistant, Bases de démonstration, Suppression des données, Kairo
```

Superviseur : 6 entrées visibles, groupées « Piloter » (Tableau de bord, Campagnes, Intéressés et RDV) et « Appeler » (Fiche représentant, Fiche prospect, Rappels promis), le reste sous « Plus ».

Téléconseiller : Mon travail, Fiche représentant, Fiche prospect, Rappels promis, et sous « Plus » Mes contacts, Contacts recommandés, Représentants ; ni écran des espaces ni bouton « Espaces » quand un seul espace est ouvert (4 rôles sur 7).

## 4. Plan proposé

### Lot 1 : correctifs sans refonte (quelques jours, aucun nouvel écran)

1. Focus clavier visible (1 ligne, U1).
2. Courriels d'enrôlement : options A, B, D (et C, E selon décision).
3. Fiche d'appel : ouvrir sans confirmation quand personne d'autre ne tient la fiche (un clic de moins par appel, environ 80 par jour et par téléconseiller), bouton « Quitter la fiche », fiche convertie signalée d'entrée, brouillon repris, « Passer le formulaire » retiré.
4. RV site : champs marqués obligatoires, placés avant la date, « Rendez-vous le ».
5. Recherche insensible à l'ordre nom/prénom, et sur toutes les fiches dès qu'un texte est saisi.
6. Numéros en liens d'appel ; « Annuler » un rappel avec confirmation ou « Rétablir ».
7. Compteurs de Mon travail alignés sur la file ; retour de fiche selon le rôle ; direction et ADMIN arrivent sur leur espace utile.
8. Textes : journal traduit, « Paramètres » renommé « Suppression des données » et rangé sous « Plus », mentions de l'application Android retirées, impasse de l'enrôlement corrigée, courriels sans destinataire signalés, « Issues d'appel » en premier onglet, un état par menu « Plus ».

### Lot 2 : refontes à valider par écrit

- Barre latérale réorganisée comme ci-dessus pour ADMIN, superviseur et téléconseiller.
- Un seul écran « Courriels et messages », une seule porte d'import.
- Éditeur de rôles en 6 familles avec recherche.
- Exploitation ouverte sur « À surveiller » (courriels en échec, tâches en retard), en français courant.
- Sur téléphone : listes en cartes (nom, numéro cliquable, statut, action) pour la file, les rappels et les contacts ; filtres repliés derrière un bouton.
- Appel sans réponse en 3 clics (motif et note sur le même pas).
- Décision sur l'arbre `/grand-public` (17 routes hors navigation, quasi-copies de `/teleconseil`).

### Décisions attendues du propriétaire

1. Courriel d'enrôlement : seulement pour les rendez-vous (option C) ?
2. Libellés des Listes de référence (« NRP » en « Ne répond pas », « RV CPI » en « Rendez-vous au bureau CPI ») : c'est une saisie dans l'écran Issues d'appel, sans code.
3. Accord écrit pour le lot 2, écran par écran.
