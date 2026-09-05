# Lot 4, conversion et parametres

Ce que le lot 4 change, ce qui a ete tranche quand la demande se contredisait,
et ce qui reste a faire tourner. Ecrit le 6 septembre 2026, branche
`feat/lot4-conversion-et-parametres`.

Source : le fichier `commentaire` a la racine, qui porte la demande brute du 4
septembre 2026. `TODO.md` en donne l'etat par exigence.

## Ce qui a ete tranche

Trois points de la demande se contredisaient. Ils ont ete arbitres avant
d'ecrire, et non devines :

| Point | Contradiction | Retenu |
| --- | --- | --- |
| EB-24, sort de `PHYSICAL` | `commentaire:129` la fond dans RDV CPI, `:75` dans la plateforme | Ni l'un ni l'autre : `PHYSICAL` reste distincte. Aucune donnee historique n'est reinterpretee. |
| EB-22, portee du retrait | « enlever duree du system de paiement » sans dire si la colonne part | Le formulaire de conversion seulement. La colonne reste. |
| EB-29, portee des parametres | `commentaire` ne nomme que trois reglages, `TODO.md` parle du connecteur | Les trois reglages ET les acces des deux plateformes. |

## Les sept exigences

### EB-20, etablissement a la creation

`prospects.etablissement`, texte facultatif, sur les deux projets. En clair et
non en referentiel : la variete des ecoles, cliniques et casernes n'en
supporterait pas un.

Le champ persiste d'une fiche a l'autre dans la rafale de saisie, comme la
banque et le syndicat : une tournee se fait dans un seul etablissement. Seule
l'identite repart de zero.

### EB-21, revenu mensuel obligatoire

Verifie cote serveur, sur la fiche APRES correction et non sur l'operation. Le
teleconseiller n'a donc rien a ressaisir quand la tranche est deja en base, et
la conversion est refusee seulement quand elle ne se trouve nulle part.

La regle ne vaut QUE pour une issue qui clot sur la methode obtenue : un
injoignable sans tranche s'enregistre toujours, sinon l'appel ne pourrait plus
se clore. Code d'erreur `PHASE2_INCOME_BAND_REQUIRED`, pose par l'ecran sous le
champ de la tranche.

### EB-22, duree dans la fonction

Le libelle « Duree dans l'etablissement » devient « Duree dans la fonction », et
« Duree du systeme de paiement » quitte le formulaire de conversion.

`dureeSystemeMois` RESTE en base et dans le contrat : les imports Grand Public,
les exports XLSX et la synchronisation mobile l'ecrivent encore. Le champ reste
admis a la conversion pour que les tentatives mises en file par un mobile avant
la bascule puissent finir de se vider.

### EB-23, numero WhatsApp

La conversion demande si le numero de la fiche porte WhatsApp. Oui : il est
recopie tel quel. Non : un champ s'ouvre et reclame celui qui le porte. La
question se pose sur les deux projets et la conversion ne part pas sans reponse.

`whatsappE164` existait deja sur la fiche, reserve a la diaspora. Il sert
maintenant aux deux, ce que son commentaire dit desormais.

### EB-24, methodes d'enrolement

`EMAIL` et `WHATSAPP` rejoignent l'enumeration. « Vocal ou messagerie
electronique » quitte le formulaire, et ses lignes existantes basculent vers
`EMAIL` : l'ancienne valeur couvrait les deux canaux sans les distinguer, et
l'e-mail est celui dont il reste une trace ecrite. Choisir WHATSAPP aurait
affirme un canal que la donnee ne dit pas.

Les libelles suivent la demande : « Plateforme en ligne », « RDV CPI »,
« Envoi par e-mail », « WhatsApp ». Les identifiants techniques `PLATFORM` et
`APPOINTMENT` ne bougent pas : les renommer aurait touche plus de deux cents
points d'appel et la contrainte CHECK du rendez-vous, pour un gain nul.

La valeur retiree reste DECLAREE dans le type et dans
`ENROLLMENT_METHOD_ORDER`. La supprimer exigerait de recreer le type PostgreSQL,
ce qui coute le retour arriere de la version entiere ; la migration est ecrite
et retenue dans `docs/migrations-en-attente.md`. Les fiches historiques restent
donc lisibles et comptees.

### EB-26, ecrire sur WhatsApp

Le numero WhatsApp de la fiche prospect est un lien `wa.me`, qui ouvre la
conversation dans WhatsApp Web ou dans l'application. Pas de message pre-ecrit :
ce que le teleconseiller a a dire depend de l'appel, et un texte impose serait
efface avant d'etre lu.

### EB-29, parametres CHUES

Une carte dans l'ecran d'administration existant, reservee a l'ADMIN, qui porte :

- le lien de la plateforme en ligne, l'adresse CHUES et le numero WhatsApp, que
  le teleconseiller dicte au prospect selon la methode retenue ;
- les acces des deux plateformes d'enrolement, jusqu'ici en variables
  d'environnement.

Trois choix a retenir :

**Les jetons ne sortent jamais en clair.** Une lecture dit seulement s'ils sont
poses. Sans cela, la page les afficherait a qui sait ouvrir un onglet reseau, et
une capture d'ecran suffirait a les fuiter. Un jeton laisse vide reste
inchange ; les remplacer est la seule facon d'en changer.

**La base prime sur l'environnement des qu'une URL y est posee.** Sans cette
regle, saisir l'ecran resterait sans effet sur une installation qui porte encore
les anciennes variables. Chaque plateforme retombe separement.

**Les trois reglages publics se lisent par tout compte connecte**, sur une route
distincte de celle d'administration : le teleconseiller doit lire l'adresse et
le numero au prospect pendant l'appel, et rien de secret n'y passe.

## Migrations

Deux, a appliquer DANS CET ORDRE :

1. `20260906090000_lot4_etablissement_et_canaux` : la colonne `etablissement`,
   puis `EMAIL` et `WHATSAPP` dans le type.
2. `20260906090100_lot4_reprise_des_methodes` : la bascule des lignes.

Elles sont separees parce que PostgreSQL refuse d'employer une valeur
d'enumeration dans la transaction qui la cree. Les deux sont purement
additives : la version precedente ignore ce qu'elle ne connait pas, et le retour
arriere ne touche pas la base.

## Ce qui reste a faire

- Appliquer les deux migrations hors local. Docker n'etait pas lance sur le
  poste de redaction, elles n'ont tourne nulle part.
- Regenerer le client Dart sur une machine qui porte un JDK 17+.
  `etablissement` et `whatsappE164` manquent au mobile tant que ce n'est pas
  fait ; le generateur openapi tourne sur la JVM et aucun JDK n'est installe sur
  le poste.
- Porter la question WhatsApp et le retrait de la duree du systeme sur le
  formulaire de conversion MOBILE. Seul le web est fait.
- Renseigner les parametres depuis l'ecran, ce qui rend inutiles
  `PLATEFORME_CHUES_URL`, `PLATEFORME_CHUES_TOKEN`,
  `PLATEFORME_GRAND_PUBLIC_URL` et `PLATEFORME_GRAND_PUBLIC_TOKEN`.

## Verifie

`pnpm lint` et `pnpm typecheck` : 13 taches sur 13, zero avertissement.

`pnpm test` : les 7 echecs qui restent sont ANTERIEURS a ce lot et propres a
Windows, verifies a l'identique sur l'arbre sans ces changements. Ils tiennent a
`new URL(...).pathname` qui rend `/C:/Users/...`, aux liens symboliques que
Windows refuse sans privilege, et aux bits de permission POSIX qui n'y existent
pas. Un huitieme, `coque-chues.test.ts`, echoue lui aussi sans ces changements.

Les regles neuves ont ete VUES rouges avant d'etre gardees : le revenu
obligatoire fait tomber sept conversions quand on le pose, la recopie du numero
WhatsApp et les trois regles des parametres tombent quand on casse leur code.
