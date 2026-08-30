# Gnawalma — Spécification

Document unique. Remplace `knowledge-base/`, `docs/` et tous les rapports antérieurs.
Toute règle absente d'ici n'existe pas.

---

## 1. Produit

Gnawalma met en relation des particuliers et des ateliers de couture sénégalais.

**La marketplace est le produit.** L'outil de gestion d'atelier est l'hameçon : il
amène les ateliers sur la plateforme et alimente la marketplace en offre réelle.

Une application, deux espaces. **Le rôle du compte décide de l'espace à la
connexion** — pas de sélecteur, pas de bascule. Un compte atelier ne voit que
l'espace atelier ; un compte client ne voit que la marketplace.

État actuel : démonstration destinée au commanditaire (LIC). Le critère n'est pas
le nombre de fonctions, c'est que l'application paraisse réelle et cohérente.

---

## 2. Utilisateurs

| Rôle | Fait quoi |
|---|---|
| `atelier` | Gère clients, mesures, commandes, paiements. Publie son profil public. |
| `client` | Cherche un atelier, consulte sa fiche, le contacte, laisse un avis. |
| `admin` | Vérifie les ateliers, modère avis et signalements, gère les promotions. |

---

## 3. Décisions arrêtées

| # | Décision |
|---|---|
| D1 | **Pas de hors-ligne.** API d'abord, cache en lecture. Écriture = requête réseau. |
| D2 | **Les « projets » n'existent plus.** Une commande est l'entité unique. |
| D3 | **Les tissus et le stock n'existent plus.** Ni écran, ni table, ni endpoint. |
| D4 | **L'activité partagée entre ateliers n'existe plus.** Voir les commandes d'un autre tailleur était un bug. |
| D5 | **Mesures = un champ texte libre**, pas de formulaire à champs numériques. |
| D6 | **Backend réécrit en Laravel**, Postgres sans PostGIS, JWT + refresh, Docker sur Render. |
| D7 | **Admin en Filament**, dans l'application Laravel. Le projet React `apps/admin` disparaît. |
| D8 | **Pas de note vocale.** Description texte uniquement. |
| D9 | **Les contacts du téléphone sont le chemin principal** de création d'un client. |
| D10 | **Exploration cliente ouverte sans compte.** Le compte est exigé à la première action protégée, et l'action reprend après connexion. |
| D11 | **Trois canaux de contact** : téléphone, WhatsApp, demande interne. Le SMS n'est qu'un repli quand WhatsApp est absent. |
| D12 | **Un contact ouvre le droit à un avis.** Pas de confirmation bilatérale de prestation. |
| D13 | **La carte n'est pas un onglet.** Quatre onglets par espace, jamais cinq. |
| D14 | **Un seul code.** Le code du compte est le mot de passe. Pas de verrou local, pas de re-verrouillage : la session dure jusqu'à la déconnexion. |
| D15 | **Aucun widget Material par défaut.** Chaque contrôle est dessiné. Voir §8. |
| D16 | **Aucun bouton flottant d'action.** L'action principale d'un écran vit dans l'en-tête, à droite. |
| D17 | **Le bon de commande est une image**, pas un PDF. Ni `pdf`, ni `printing`. |
| D18 | **Une relance d'avis par contact**, à J+3 : notification locale et bandeau d'accueil. Aucune notification poussée depuis un serveur. |

### Risque assumé sur D1 + Render gratuit

L'instance Render s'endort. Sans écriture locale, un tailleur qui ouvre
l'application devant un client attend le réveil du serveur avant de pouvoir
enregistrer quoi que ce soit. Le ping `/health` au démarrage masque une partie du
délai, pas sa totalité. À trancher avant la démonstration : offre payante,
cron de réveil, ou acceptation du délai.

---

## 4. Espace atelier

Navigation basse, 4 onglets : **Commandes · Clients · Tableau · Réglages**.
L'onglet d'ouverture est Commandes.

### 4.1 Écrans

| # | Écran | Voir |
| --- | --- | --- |
| 1 | Carrousel d'introduction | 4.2 |
| 2 | Accueil de marque | 4.2 |
| 3 | Connexion | 4.2 |
| 4 | Inscription | 4.2 |
| 5 | Saisie du code | 4.2 |
| 6 | Assistant de création d'atelier (3 étapes) | 4.3 |
| 7 | Commandes — liste | 4.4 |
| 8 | Commande — détail | 4.5 |
| 9 | Nouvelle commande (3 étapes) | 4.6 |
| 10 | Clients — liste | 4.7 |
| 11 | Client — fiche | 4.8 |
| 12 | Client — création / édition | 4.9 |
| 13 | Bénéficiaire — création / édition | 4.10 |
| 14 | Tableau de bord | 4.11 |
| 15 | Demandes reçues | 4.12 |
| 16 | Profil atelier | 4.13 |
| 17 | Réglages | 4.14 |

### 4.2 Premier lancement, compte et code

**Carrousel d'introduction.** Trois écrans au tout premier lancement, glissables,
avec « Passer » visible en permanence. Vu une fois, jamais revu.

**Accueil de marque.** Deux boutons : *Se connecter* et *Créer un compte*.
Aucun champ.

**Inscription.** Nom complet · identifiant · code · rôle.
L'identifiant est un champ unique : le serveur détecte s'il s'agit d'un numéro ou
d'une adresse. Un numéro sénégalais saisi en local est converti en E.164.
Le rôle — *J'ai un atelier* ou *Je cherche un atelier* — est choisi ici et ne
change plus.

**Connexion.** Identifiant, puis code.

**Saisie du code.** Pavé numérique dessiné, plein écran, touches de 72 dp,
pastilles de progression en haut. Jamais le clavier système.
**Flèche de retour obligatoire** — son absence est un défaut relevé en test.

Code refusé : les pastilles tremblent, un message s'affiche sous le pavé.
À partir du troisième échec, le nombre d'essais restants est annoncé. Au
cinquième, le serveur bloque trente secondes et l'écran affiche un compte à
rebours visible, pas un simple refus.

**Il n'existe qu'un seul code.** Le code du compte est le mot de passe. Aucun
verrou local, aucun re-verrouillage en revenant dans l'application : la session
dure jusqu'à la déconnexion. L'écran de saisie ne se voit qu'à la connexion.

**Code oublié.** Réinitialisation par courriel. Les comptes inscrits par numéro
n'ont pas de récupération en libre-service et passent par le support.
*Conséquence : Laravel doit disposer d'un service d'envoi de courriels.*

**Après connexion.** Un compte atelier sans atelier arrive dans l'assistant, sans
issue : ni retour, ni saut. L'état « compte atelier sans atelier » n'existe donc
dans aucun autre écran de l'application.

### 4.3 Assistant de création d'atelier

Trois étapes, une barre d'avancement.

| Étape | Champs |
|---|---|
| 1 — Identité | Nom · description · téléphone |
| 2 — Localisation | **Région (obligatoire)** · adresse (facultative) · *Utiliser ma position actuelle* |
| 3 — Vitrine | Spécialités · logo · photo de couverture · registre de commerce (facultatif) |

La région se choisit dans une liste fermée des quatorze régions du Sénégal,
présentée par un sélecteur dessiné. Aucune saisie libre : il est impossible
d'enregistrer une région qui n'existe pas. La zone
« Ajouter / Sélectionner / Rechercher » de l'ancienne version est supprimée.

*Utiliser ma position actuelle* prend les coordonnées en un toucher — le tailleur
est dans son atelier au moment de l'inscription. Ces coordonnées alimentent
« Près de chez vous » côté client. Permission refusée : l'étape reste
franchissable, la position est déduite de la région.

Les spécialités sont **Homme · Femme · Enfant**, choix multiple, au moins une.
Le champ libre « Spécialité » de l'ancienne version est supprimé.

**Le bouton de validation s'active dès que les champs obligatoires sont remplis.**
Il ne dépend jamais du clic sur une suggestion d'adresse — c'est le blocage
signalé en test.

**Sortie.** Impossible d'entrer dans l'application sans atelier complet. Mais la
progression est conservée : fermeture, réouverture ou déconnexion ramènent à
l'étape en cours, champs déjà remplis.

### 4.4 Commandes — liste

Onglet d'ouverture de l'espace atelier. C'est l'écran le plus regardé de
l'application.

**Une ligne** porte le nom du client en titre, l'échéance en clair dessous
(« dans 3 jours », « en retard de 2 jours »), et à droite la pastille de statut
suivie du montant restant.

**Tri : échéance la plus proche d'abord.** C'est l'ordre de travail réel.

**Retards.** Un bandeau en haut de liste annonce « N commandes en retard » et
filtre au toucher. Pas de rouge répété sur chaque ligne.

**Onglets** : En cours · Prêt · Livré.

**Recherche.** Une loupe dans l'en-tête ; le champ remplace le titre au toucher.
L'écran s'ouvre donc directement sur les commandes.

**Nouvelle commande** : bouton dans l'en-tête, à droite. Aucun bouton flottant.

**Geste.** Le glissement latéral sur une ligne révèle *marquer prêt* et
*encaisser*. Ce geste est un raccourci : **tout ce qu'il permet doit rester
faisable depuis le détail**, sans quoi la fonction est invisible.

**Chargement.** Squelette en forme de lignes, puis défilement infini.

**Vide.** Un message unique. En revanche l'échec de chargement et l'absence de
réseau restent distincts du vide — l'ancienne application affichait un échec
comme « aucune donnée », ce qui ne doit pas se reproduire.

### 4.5 Commande — détail

**En-tête :** nom du client en titre, **reste à payer en très gros chiffres
tabulaires**, échéance dessous. La question d'argent est répondue avant tout
défilement.

**Blocs, dans cet ordre :** Mesures · Photo du tissu · Description · Paiements.
Ce qu'il faut pour coudre d'abord, l'argent ensuite.

**Paiements** : une ligne par encaissement, date et montant, la plus récente en
haut, total en bas. Journal ajout-seul — rien ne se modifie, rien ne s'efface.

**Statut** : un seul bouton, qui nomme l'étape suivante — *Marquer prêt*, puis
*Marquer livré*. L'annulation vit dans un menu discret.

**Encaisser** ouvre une feuille : champ de saisie, clavier numérique, raccourci
*solde entier*, validation.

**Autres actions** : appeler le client · modifier la commande · annuler (avec
confirmation) · partager le bon de commande.

**Le bon de commande est une image** rendue par l'application et partagée, en
pratique par WhatsApp. Ni PDF, ni impression : ces deux dépendances pesaient
environ mille lignes dans l'ancienne version pour un document que personne
n'imprimait.

### 4.6 Nouvelle commande

Trois étapes.

**Étape 1 — Client.** Champ de recherche sur les clients existants ;
*Choisir dans mes contacts* dessous ; *Nouveau client* en dernier recours, qui ne
demande que nom et téléphone et ne fait pas quitter le flux.

**Étape 2 — Mesures et livraison.**
D'abord *Pour qui ?* : les bénéficiaires du client, *Pour lui-même*, ou *Ajouter*.
Puis un grand champ de mesures, **vide**. Si le bénéficiaire a déjà des mesures,
elles s'affichent au-dessus avec *Réutiliser*, qui les recopie dans le champ.
Jamais de pré-remplissage automatique : des mesures périmées conservées par
inadvertance sont un vêtement raté.
Le texte est saisi tel que le tailleur l'écrit —
`48 / 108 / 90 / 63 / 42 / 96 / 92 / 104 / 60 / 105`.
Puis une photo du tissu, unique et remplaçable ; une date de livraison ; une
description libre.

La date se choisit par raccourcis — *Dans 3 jours*, *Dans 1 semaine*,
*Dans 2 semaines* — ou par *Choisir une date*, qui ouvre un calendrier dessiné.

**Étape 3 — Montant.** Montant total, puis acompte proposé en raccourcis
(aucun · la moitié · tout) avec saisie libre possible. Le reste s'affiche en
direct et ne se saisit jamais.

**Obligatoires** : client, montant total, date de livraison, mesures.

**Validation** : le bouton *Suivant* est visiblement inactif tant qu'il manque
quelque chose ; le toucher fait apparaître les erreurs sous les champs concernés.
Jamais de blocage muet.

**Après création** : on arrive sur le détail de la commande, avec une
confirmation brève.

### 4.7 Clients — liste

Un répertoire. Pastille d'initiale, nom, téléphone dessous. Groupé A–Z avec
intertitres et rail alphabétique sur le bord pour sauter à une lettre.

### 4.8 Client — fiche

Blocs : coordonnées avec boutons *Appeler* et *WhatsApp* · total dépensé et reste
dû · bénéficiaires et leurs mesures · commandes du client.

### 4.9 Client — création et édition

**Depuis les contacts** — chemin principal. L'application lit le répertoire et
affiche **sa propre liste**, cherchable, à ses propres styles ; jamais le
sélecteur natif du système. Un toucher pré-remplit nom et téléphone, modifiables
avant enregistrement.

**Permission refusée** : bascule silencieuse vers la saisie manuelle, avec une
ligne discrète expliquant comment réactiver les contacts. Aucun écran d'erreur.

**Champs manuels** : nom complet (un seul champ, pas prénom et nom séparés) ·
téléphone · adresse · notes.

### 4.10 Bénéficiaires

Un client commande souvent pour d'autres personnes. Un bénéficiaire porte un
libellé (« Awa », « Mon fils »), un genre (homme · femme · enfant) et un texte de
mesures.

**Pas d'historique de versions.** Modifier écrase. La commande, elle, conserve la
copie figée des mesures du jour où elle a été créée.

### 4.11 Tableau de bord

**À encaisser** domine l'écran en très gros chiffres. Dessous, plus petits :
en retard · en cours · prochaine échéance.

Une hiérarchie, pas une grille de quatre blocs égaux — c'est cette grille qui
rendait l'ancien écran plat.

**Les quatre valeurs sont touchables** et ouvrent les commandes correspondantes.
Un chiffre qu'on peut ouvrir est un chiffre auquel on croit.

Dessous, l'accès aux **demandes reçues** avec le nombre de demandes non traitées.
C'est le seul point d'entrée : pas de cinquième onglet, pas de cloche.

### 4.12 Demandes reçues

Demandes internes envoyées par des clients depuis la marketplace.

Une demande porte le nom du client, sa région, son message, la date, et **son
numéro, toujours visible**. Deux actions : appeler, ou créer une commande
pré-remplie avec ce client. Une demande traitée est marquée comme telle ; rien ne
se supprime.

C'est la seule entrée de la marketplace vers l'espace atelier. Sans cet écran,
une demande client n'aurait aucune destination.

### 4.13 Profil atelier

Un formulaire unique, **tous les champs pré-remplis** — l'absence de
pré-remplissage est un défaut relevé en test — et un bouton d'enregistrement.

Champs : nom · description · téléphone · région · adresse · registre de commerce
(facultatif) · spécialités · logo · photo de couverture · réseaux sociaux.

**Portfolio** : grille de photos, ajout multiple, réorganisation par
appui-glisser, suppression. C'est la vitrine marketplace de l'atelier.

### 4.14 Réglages

Thème (clair · sombre · système) · changer mon code · nom et identifiant du
compte · **déconnexion**, avec confirmation.

Rien d'autre. Pas de bascule d'espace : le rôle du compte décide.

---

## 5. Espace client

Navigation basse, 4 onglets : **Accueil · Favoris · Activité · Profil**.
La carte n'est pas un onglet : elle s'ouvre depuis l'accueil et depuis les
résultats de recherche.

### 5.1 Compte et accès

L'exploration est ouverte sans compte : accueil, recherche, résultats, carte et
fiche atelier sont consultables immédiatement. L'application ne s'ouvre jamais
sur un mur de connexion.

Le compte est demandé **à la première action protégée**, et seulement là :
contacter un atelier, mettre en favori, déposer un avis, signaler.

Les boutons d'action restent **actifs et jamais grisés**. Le toucher ouvre une
feuille qui explique en une phrase ce que le compte apporte, propose la
connexion, puis **exécute l'action initialement demandée**. L'utilisateur ne
recommence pas son geste.

### 5.2 Accueil

Trois blocs, dans cet ordre.

**1. Carrousel.** Défilement automatique, pastilles de position, arrêt au
toucher. Il mêle des visuels pilotés par l'administration et des ateliers mis en
avant ; chaque élément renvoie vers un atelier ou vers une recherche. Liste
vide : le bloc disparaît entièrement.

**2. Barre de recherche.** Voir 5.3.

**3. Près de chez vous.** Carrousel horizontal de **cartes photo** : couverture,
nom, spécialités, distance, note.

**Règle d'affichage :** le bloc n'apparaît que si la localisation est autorisée
**et** que des ateliers proches existent. Sinon il est **masqué** — pas de bloc
vide, pas de message d'erreur, pas de squelette permanent.

La permission n'est jamais demandée au démarrage, mais depuis un bouton
*Activer ma position* posé là où le bloc apparaîtrait.

| État | Comportement |
|---|---|
| Jamais demandée | Bouton *Activer ma position*. |
| Refusée une fois | Même bouton, nouvelle demande possible. |
| Refusée définitivement | Le bouton ouvre les réglages système. |
| Service désactivé | Proposer la saisie d'une région. |

### 5.3 Recherche

**Une seule barre, aucun filtre visible au départ.** La saisie interroge
simultanément le nom de l'atelier, la région, l'adresse et les spécialités.
Taper « Thiès », « Ndiaye » ou « enfant » doit ramener des résultats pertinents
sans que l'utilisateur choisisse un champ.

Affinage disponible **après** une première recherche : région, spécialité,
distance. Jamais avant — un écran de recherche vide ne montre pas de filtres.

Résultats en liste. Un **bouton flottant « Carte »**, centré en bas, bascule vers
la carte et devient « Liste ».

Aucun résultat : proposer d'élargir la zone.

### 5.4 Détail atelier

**Photo de couverture en plein bandeau**, qui se replie au défilement ; le nom
migre alors dans la barre. Son absence d'affichage est le défaut le plus visible
relevé en test : une fiche sans image ne se démontre pas.

**Atelier sans photo** : bandeau de couleur dérivé du nom, portant sa grande
initiale. Jamais d'image cassée, jamais de gris vide.

Contenu, dans l'ordre : couverture, logo, nom, vérification · spécialités,
région, adresse · distance si connue · portfolio · description · horaires ·
avis · barre d'action.

**Avis** : note moyenne, nombre, deux avis récents, lien vers la liste complète.

**Barre d'action fixe** en bas : **Appeler · WhatsApp · Demander**.

Une fiche pauvre reste lisible : chaque bloc absent disparaît, aucun n'affiche
« non renseigné ». Un atelier non vérifié n'affiche aucun signe de vérification,
sans être présenté comme suspect pour autant. Le signalement vit dans un menu
discret, jamais comme action principale.

### 5.5 Contact

| Canal | Comportement |
|---|---|
| **Téléphone** | Ouvre le composeur. |
| **WhatsApp** | Ouvre `wa.me`. WhatsApp absent : bascule sur le SMS, sans erreur. |
| **Demande interne** | Feuille : un champ message et une bascule *Partager mon numéro*. Envoi en un toucher. |

Chaque contact ouvert est enregistré. **L'enregistrement ne prétend jamais que la
conversation a abouti** : il note qu'un canal a été ouvert, rien de plus.

### 5.6 Avis

Un contact ouvre le droit à un avis, quel que soit le canal.
Étoiles obligatoires, texte court facultatif. Modifiable par son auteur
uniquement. L'atelier ne peut ni répondre, ni supprimer, ni signaler.

**Relance.** Trois jours après un contact, deux rappels — et pas un de plus :
une notification locale programmée, et un bandeau en haut de l'accueil à la
réouverture, portant les étoiles directement. Le bandeau est rejetable et ne
revient pas. Une relance par contact.

*Conséquence : `flutter_local_notifications` et le désucrage Java 17 reviennent
dans le projet.*

### 5.7 Carte

Marqueurs des ateliers. Toucher un marqueur fait monter une fiche condensée —
photo, nom, distance — qui ouvre la fiche complète au toucher. Bouton de
recentrage sur la position.

Sans localisation, la carte s'ouvre sur la région saisie, ou sur Dakar.

### 5.8 Favoris

Lignes compactes. Ajout et retrait depuis la fiche atelier et depuis les
résultats. Compte requis.

Liste vide : expliquer à quoi servent les favoris et renvoyer vers la recherche.

### 5.9 Activité

Historique des contacts, le plus récent en premier. Une ligne porte l'atelier, le
canal, la date, et soit *Donner mon avis*, soit les étoiles déjà laissées.

Depuis une ligne : rouvrir la fiche, recontacter, déposer un avis.

### 5.10 Profil

Nom, identifiant de connexion, thème, **déconnexion**. Rien d'autre.
Pas de bascule vers l'espace atelier : le rôle du compte décide.

### 5.11 Perte de réseau

Un bandeau persistant *Hors ligne*. Le contenu déjà chargé reste visible, signalé
comme potentiellement ancien. Les actions protégées sont refusées proprement,
avec un message qui dit quoi faire.

---

## 6. Règles métier

### Commande

- Champs : client, référence (générée), mesures (texte), date de livraison,
  photo du tissu, description, montant total, acompte, statut.
- **Pas de lignes d'article, pas de type de vêtement, pas de projet.**
- Statuts : `en_cours` · `pret` · `livre` · `annule`.
- Référence générée par le serveur.

### Argent

- Franc CFA, **entier**. Jamais de décimale, jamais de virgule flottante.
- `reste = montant_total − somme(paiements)`. Calculé, jamais stocké comme
  source de vérité, jamais saisi.
- Les paiements forment un journal ajout-seul. Un paiement ne se modifie pas, il
  se contre-passe.
- Affichage : séparateur de milliers U+202F, zéro décimale — `12 000 FCFA`.
- Un montant s'affiche toujours en encre noire. Jamais en vert, jamais en rouge,
  jamais dans une pastille colorée.

### Client et bénéficiaires

- Un client appartient à un atelier et n'est jamais visible d'un autre atelier.
- Un client porte plusieurs bénéficiaires (épouse, enfants).
- Un bénéficiaire porte un libellé et un texte de mesures.

### Contact, avis, favoris

- Un contact est enregistré à l'ouverture du canal, jamais à sa réussite.
  L'application ne sait pas si l'appel a abouti et ne le prétend pas.
- Un client ayant contacté un atelier peut déposer un avis sur cet atelier.
- Étoiles obligatoires, texte facultatif. Modifiable par son auteur uniquement.
- Un atelier ne peut ni répondre à un avis, ni le supprimer.
- Un avis masqué par la modération disparaît des moyennes.
- Les favoris sont propres au compte client et n'ont aucun effet sur le classement.

### Atelier

- Région obligatoire. Adresse et registre de commerce facultatifs.
- Spécialités : sous-ensemble de `homme` · `femme` · `enfant`.
- Un atelier non vérifié n'est jamais présenté comme vérifié.

---

## 7. API (Laravel)

Préfixe `/api/v1`. JSON. Erreurs au format problème (`type`, `title`, `status`,
`detail`, `errors`). Authentification `Bearer`, JWT court + rafraîchissement.

| Méthode | Chemin | Objet |
|---|---|---|
| GET | `/health` | Réveil, sans base. |
| POST | `/auth/register` | Création de compte. |
| POST | `/auth/login` | Identifiant + PIN. |
| POST | `/auth/refresh` | Rotation de session. |
| POST | `/auth/logout` | Révocation. |
| POST | `/auth/mot-de-passe-oublie` | Envoi du lien de réinitialisation (courriel uniquement). |
| POST | `/auth/reinitialiser` | Nouveau code depuis le jeton reçu. |
| GET | `/auth/me` | Compte + ateliers. |
| GET | `/ateliers` | Recherche publique : `q`, `region`, `specialite`, `lat`, `lng`, `rayon`. |
| GET | `/ateliers/{id}` | Fiche publique. |
| GET | `/promotions` | Carrousel d'accueil. |
| POST | `/ateliers/{id}/contacts` | Ouvrir un contact (téléphone, whatsapp, demande). |
| GET | `/ateliers/{id}/avis` | Avis publiés d'un atelier. |
| GET | `/mes-contacts` | Historique des contacts du client. |
| GET/POST/DELETE | `/mes-favoris` | Favoris du client. |
| POST | `/avis` | Déposer un avis. |
| POST | `/signalements` | Signaler un atelier ou un avis. |
| PATCH | `/auth/me` | Nom, changement de code (`pin` + `current_pin`). |
| GET | `/mon-atelier` | L'atelier du compte, avec son portfolio. Un compte, un atelier. |
| POST | `/mon-atelier` | Créer (étape 1 de l'assistant). |
| PATCH | `/mon-atelier` | Modifier ; `wizard_step` mémorise la progression. |
| POST | `/mon-atelier/terminer` | Valide région et spécialités, fixe `completed_at`, déduit la position de la région si le GPS manque. |
| GET | `/mon-atelier/tableau` | 4 indicateurs + demandes non traitées. |
| GET | `/mon-atelier/demandes` | Demandes internes reçues. |
| PATCH | `/mon-atelier/demandes/{d}` | Marquer traitée. |
| GET/POST | `/mon-atelier/clients` | Répertoire. |
| GET/PATCH | `/mon-atelier/clients/{c}` | Fiche (bénéficiaires, commandes, totaux) ; édition. |
| POST | `/mon-atelier/clients/{c}/beneficiaires` | Ajouter un bénéficiaire. |
| PATCH | `/mon-atelier/beneficiaires/{b}` | Modifier ; écrase les mesures. |
| GET/POST | `/mon-atelier/commandes` | Liste (`status`, `q`, `impayees`) ; création avec `acompte_cfa`. |
| GET/PATCH | `/mon-atelier/commandes/{c}` | Détail ; édition. |
| PATCH | `/mon-atelier/commandes/{c}/statut` | Changement d'état. |
| POST | `/mon-atelier/commandes/{c}/paiements` | Encaissement ; négatif = contre-passation. |
| POST | `/media` | Photo (`tissu`, `logo`, `couverture`, `portfolio`), 4 Mo max. |
| POST | `/mon-atelier/portfolio` | Ajouter une photo téléversée au portfolio. |
| PATCH | `/mon-atelier/portfolio` | Ordre des photos (`ids`). |
| DELETE | `/mon-atelier/portfolio/{p}` | Retrait d'une photo. |

Erreurs au format RFC 7807 (`application/problem+json`). Connexion : 5 échecs
puis 30 s de blocage par identifiant. Jeton d'accès 15 min, rafraîchissable
30 jours en renvoyant le jeton expiré sur `/auth/refresh`.

**Supprimés** par rapport à l'API actuelle : `/operations/orders/shared`,
tout `/inventory`, les lignes d'article de commande.

Admin en Filament, hors API mobile.

---

## 8. Contraintes

### Interface

**Aucun widget Material par défaut.** Ni `DropdownButton`, ni `AlertDialog`, ni
`SnackBar`, ni `ChoiceChip`, ni `SegmentedButton`, ni `showDatePicker`, ni
sélecteur de contacts natif. Chaque contrôle est dessiné par l'application.
Un écran ne doit jamais pouvoir être identifié comme un gabarit Flutter.

**Aucun bouton flottant.** L'action principale d'un écran est un bouton dans
l'en-tête, à droite.

Un geste raccourci — glissement, appui long — ne porte jamais une fonction qui
n'existe pas ailleurs de façon visible.

### Générales

- **Français uniquement.** Wolof hors périmètre.
- Appareil de référence : Android 10, 3 Go de RAM, écran 360 dp.
- Réseau intermittent. Toute requête peut échouer ; chaque écran a un état
  d'erreur et un état hors ligne distincts de l'état vide.
- WCAG 2.2 AA : 4,5:1 pour le texte, 3:1 pour les bordures porteuses de sens.
- Cibles tactiles ≥ 48 dp, ≥ 8 dp entre deux cibles.
- Mise à l'échelle du texte supportée jusqu'à 2,0. Aucune hauteur de ligne figée.
- Un statut se lit par le mot et la position, jamais par la couleur seule.
- Toute commande à icône seule porte une étiquette d'accessibilité.
- Les montants sont annoncés en toutes lettres à la synthèse vocale.
- Les erreurs de formulaire s'affichent sous le champ, jamais en notification.

Identité visuelle : voir `DESIGN.md`.

---

## 9. Hors périmètre

Paiement en ligne, commission, portefeuille. Messagerie interne — la demande
interne est un formulaire à sens unique, pas une conversation. Classement public
compétitif. Comptabilité, achats, paie. Comptes employés. Multi-pays. Gestion des
tissus et du stock. Note vocale. Synchronisation hors ligne. Activité partagée
entre ateliers. Confirmation bilatérale de prestation. Réponse de l'atelier à un
avis. Bascule entre espaces.

---

## 10. À trancher

- Sommeil de l'instance Render face à une écriture bloquante (voir 3).
- Reprise ou non des données de la base actuelle.
- Hébergement définitif et nom de domaine avant démonstration.
- Fournisseur d'envoi de courriels pour la réinitialisation du code (Mailgun, SES
  ou autre). Sans lui, D-oubli n'existe pas et le support réinitialise à la main.
- Récupération de compte pour les inscriptions par téléphone : aucune solution
  en libre-service tant qu'il n'y a pas d'OTP SMS, écarté par coût.
