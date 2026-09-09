# CPI GO, recette des formulaires et des saisies

Date : 30 août 2026
Commit : `e8baacd` (arbre de travail modifié)
Périmètre : `apps/mobile` (Flutter 3.41.7, FVM), écrans de saisie métier.
Preuves : lectures `fichier:ligne`, tests de widgets `apps/mobile/test/qa/qa_form_*`,
réponses du serveur local `http://localhost:3001`.

## Synthèse

| Réf    | Sévérité | Formulaire                             | Titre                                                                      |
| ------ | -------- | -------------------------------------- | -------------------------------------------------------------------------- |
| FOR-01 | majeur   | Prospect (CHUES et Grand Public)       | Nom et prénom sans longueur maximale, refusés par le serveur               |
| FOR-02 | majeur   | Prospect Grand Public                  | Ancienneté hors des bornes admises (0, 9999 mois)                          |
| FOR-03 | mineur   | Prospect Grand Public                  | Profession sans longueur maximale, bornée partout ailleurs                 |
| FOR-04 | majeur   | Prospect, Représentant, WhatsApp       | Un numéro collé au format international devient un autre numéro            |
| FOR-05 | majeur   | Conversion (phase 2)                   | Adresse e-mail à domaine d'une lettre acceptée, refusée par le serveur     |
| FOR-06 | mineur   | Qualification représentant             | Deux appuis sur « Enregistrer » consignent deux appels                     |
| FOR-07 | mineur   | Qualification représentant, conversion | L'heure de rappel choisie disparaît de l'écran sans disparaître de l'envoi |
| FOR-08 | mineur   | Visite (accueil)                       | « −15 min » avant minuit inscrit la visite la veille                       |
| FOR-09 | mineur   | Connexion                              | Champs d'identifiants hors `AutofillGroup` : rien n'est jamais enregistré  |

Total : 4 majeurs, 5 mineurs, 0 bloquant.

## FOR-01 Nom et prénom sans longueur maximale

**Scénario.** Nouveau prospect chez un représentant. Coller un nom de 121
caractères (une ligne de tableur, un copier-coller de message), un numéro
valide, enregistrer.

**Attendu.** Le champ borne la saisie à 120 caractères, comme le fait déjà la
fiche représentant (`representant_form_screen.dart:825`, `maxLength: 2000` pour
les notes) et l'écran de conversion (`phase2_screen.dart:643`,
`maxLength: kProfessionMaxLength`).

**Observé.** Aucune borne, aucun reproche, le bouton reste allumé. La fiche est
écrite en base et mise en file telle quelle. Le serveur refuse le lot entier.

**Preuve.**

Client, aucun `maxLength` sur les deux champs :

```dart
// apps/mobile/lib/features/prospect/presentation/prospect_entry_screen.dart:655
CpiField(
  label: 'Prénom',
  controller: _prenom,
  ...
// :670
CpiField(
  label: 'Nom',
  controller: _nom,
```

Serveur, `apps/api/src/modules/sync/dto.ts:108` :

```ts
@ApiPropertyOptional({ maxLength: 120, description: 'Prospect : nom.' })
@IsOptional()
@IsString()
@MaxLength(120)
nom?: string;
```

Test (`apps/mobile/test/qa/qa_form_prospect_test.dart`) :

```
00:00 +0: un nom de 121 caractères s'enregistre et part dans le lot
00:01 +1: ...
```

Réponse du serveur pour cette charge utile :

```
POST /api/v1/sync/push  (prospect, nom de 121 caractères)
HTTP 400
{"code":"VALIDATION_FAILED","message":"nom must be shorter than or equal to 120 characters",
 "statusCode":400,"details":["nom must be shorter than or equal to 120 characters"]}
```

**Aggravation mesurée.** Le refus porte sur le LOT, pas sur l'opération. Un lot
de deux saisies dont une seule est fautive est refusé en bloc :

```
POST /api/v1/sync/push  (rang 0 valide, rang 1 avec un nom de 121 caractères)
HTTP 400
{"code":"VALIDATION_FAILED","details":["nom must be shorter than or equal to 120 characters"]}
```

Le mobile ne peut pas nommer la coupable : `rejectedOperationsOf`
(`apps/mobile/lib/core/sync/dio_api.dart:547`) cherche un préfixe
`operations.<rang>` dans `details`, que `flattenValidationErrors`
(`apps/api/src/bootstrap.ts:26`) calcule mais n'écrit jamais devant le message.
La liste revient vide, et `_applyTerminalRefusal`
(`apps/mobile/lib/core/sync/sync_engine.dart:1125`) bascule alors TOUTES les
lignes du lot en échec, ce que son propre commentaire dit vouloir éviter.

**Cause.** Le champ ne connaît pas la borne du contrat ; la constante
`kProfessionMaxLength = 120` (`core/utils/whatsapp.dart:25`) existe et n'est pas
utilisée ici.

**Correctif minimal proposé (non appliqué).** `maxLength: 120` sur les deux
`CpiField`. Accessoirement, préfixer les messages de `flattenValidationErrors`
par leur chemin pour que le refus ne condamne que la saisie fautive.

## FOR-02 Ancienneté hors des bornes admises

**Scénario.** Prospect Grand Public, étape « Que fait-il ? », écrire `0` puis
enregistrer. Recommencer avec `9999`.

**Attendu.** Le champ refuse ce que le serveur refuse : 1 à 600 mois.

**Observé.** Les deux valeurs partent telles quelles.

**Preuve.**

```dart
// prospect_entry_screen.dart:747
CpiField(
  label: 'Ancienneté',
  controller: _duree,
  keyboardType: TextInputType.number,   // aucun inputFormatter, aucune borne
// :390
dureeSystemeMois: int.tryParse(_duree.text.trim()),
```

Serveur, `apps/api/src/modules/sync/dto.ts:255` : `@Min(1) @Max(600)`.

Tests : `l'ancienneté à 0 mois puis à 9999 mois part telle quelle` et
`une ancienneté de 9999 mois passe aussi` (charge utile lue dans l'outbox).

```
POST /api/v1/sync/push  dureeSystemeMois: 0
HTTP 400 {"code":"VALIDATION_FAILED","message":"dureeSystemeMois must not be less than 1"}
POST /api/v1/sync/push  dureeSystemeMois: 9999
HTTP 400 {"code":"VALIDATION_FAILED","message":"dureeSystemeMois must not be greater than 600"}
```

Le même champ, dans la conversion, est correctement tenu :
`phase2_screen.dart:694` pose `FilteringTextInputFormatter.digitsOnly` et
`LengthLimitingTextInputFormatter(3)`, et `Phase2FormFields.erreurDuree`
(`phase2_screen.dart:420`) reproche la valeur hors bornes.

**Écart de contrat relevé au passage.** Le même champ vaut au plus 300 côté REST
(`apps/api/src/modules/prospects/dto.ts:130`) et 600 côté synchronisation
(`sync/dto.ts:264`). Une valeur de 400 mois est admise par un chemin et refusée
par l'autre.

**Correctif minimal proposé.** Reprendre sur ce champ les deux formateurs et le
message d'erreur de `phase2_screen.dart`, avec la borne haute du contrat de
synchronisation.

## FOR-03 Profession sans longueur maximale

**Scénario.** Prospect Grand Public, profession de 121 caractères.

**Attendu.** Borne à 120, comme `representant_form_screen.dart:802` et
`phase2_screen.dart:681`, qui passent tous deux `kProfessionMaxLength`.

**Observé.** Le champ (`prospect_entry_screen.dart:737`) n'a pas de `maxLength` ;
la valeur part entière.

**Preuve.** Test `une profession de 121 caractères part dans le lot`, puis :

```
POST /api/v1/sync/push  profession de 121 caractères
HTTP 400 {"code":"VALIDATION_FAILED","message":"profession must be shorter than or equal to 120 characters"}
```

**Correctif minimal proposé.** `maxLength: kProfessionMaxLength`.

## FOR-04 Un numéro collé au format international devient un autre numéro

**Scénario.** Coller `+221 77 123 45 67` (la forme sous laquelle l'application
elle-même AFFICHE les numéros, et celle qu'on copie depuis WhatsApp) dans le
champ « Téléphone » d'un prospect ou d'un représentant.

**Attendu.** Soit le numéro est reconnu et ramené à `77 123 45 67`, soit il est
refusé. Pas de troisième issue.

**Observé.** Le masque jette le `+`, garde les neuf premiers chiffres et affiche
`22 177 12 34`. Le numéro est jugé VALIDE, avec un simple avertissement de
préfixe, et enregistré en `+221221771234` : un abonné qui n'existe pas.

**Preuve.**

```dart
// apps/mobile/lib/ui/widgets/phone_field.dart:14
static String _digits(String input) => input.replaceAll(RegExp(r'[^0-9]'), '');
// :41
if (digits.length > kSenegalNationalLength) {
  digits = digits.substring(0, kSenegalNationalLength);
```

```dart
// apps/mobile/lib/core/utils/phone.dart:155
final bool known = kSenegalPrefixes.contains(digits.substring(0, 2));
return PhoneValid(
  '+$kSenegalCallingCode$digits',
  digits,
  warning: known ? null : PhoneWarning.unknownPrefix,   // avertissement, pas refus
);
```

Test `coller « +221 77 123 45 67 » enregistre +221221771234` : le champ affiche
`22 177 12 34`, l'avertissement « Préfixe inhabituel » est présent, « Continuer »
est allumé, et la ligne écrite porte `phoneE164 = +221221771234`.

Le serveur, lui, valide le plan de numérotation avec `libphonenumber`
(`apps/api/src/common/phone.ts:50`) :

```
POST /api/v1/sync/push  phone: "+221221771234"
HTTP 200
results[0] = {"status":"invalid","errorCode":"PHONE_INVALID",
              "error":"Numéro de téléphone invalide : +221221771234"}
```

Même verdict pour `+221077123456`, que produit la même mécanique quand le
numéro est tapé avec un zéro de tête. Un verdict `invalid` bascule la ligne en
échec (`sync_engine.dart:681`), donc dans « À corriger », avec un numéro que
personne ne pourra rattacher à la bonne personne.

**Cause.** Le formateur strict tronque au lieu de rendre la main, et
`kSenegalPrefixes` sert d'avertissement là où le serveur en fait une règle.

**Correctif minimal proposé.** Dans `SenegalPhoneFormatter`, retirer l'indicatif
`221` (et le `00221`) avant de tronquer, comme le fait déjà `Phone.digitsOf` ;
et faire du préfixe inconnu un refus dans `Phone.parse`, la règle du serveur
étant celle qui tranche.

## FOR-05 Adresse e-mail à domaine d'une lettre

**Scénario.** Conversion, étape « Qui est-ce ? », saisir `awa@exemple.s`.

**Attendu.** Le reproche sous le champ, comme pour toute autre faute de frappe.

**Observé.** Aucun reproche, l'étape laisse passer, l'appel est consigné et
l'envoi est refusé.

**Preuve.**

```dart
// apps/mobile/lib/data/repositories/write_repository.dart:29
final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$');
```

Le motif du serveur exige deux caractères après le dernier point
(`apps/api/src/modules/phase2/attempt-rules.ts:37`), et le lot passe d'abord par
`@IsEmail()` (`apps/api/src/modules/sync/dto.ts:337`).

Test `une adresse dont le domaine finit par une seule lettre est acceptée`
(`apps/mobile/test/qa/qa_form_phase2_test.dart`) : `validateCallAttemptEmail` et
`Phase2FormFields.erreurEmail` rendent tous deux `null`.

```
POST /api/v1/sync/push  call_attempt email: "awa@exemple.s"
HTTP 400 {"code":"VALIDATION_FAILED","details":[..., "email must be an email"]}
```

**Correctif minimal proposé.** Aligner `_emailPattern` sur celui du serveur :
`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`.

## FOR-06 Deux appuis sur « Enregistrer » consignent deux appels

**Scénario.** Qualification d'un représentant, résultat « À rappeler », une
heure choisie, puis deux appuis rapprochés sur « Enregistrer ».

**Attendu.** Le second appui ne fait rien, comme dans le formulaire de visite
(`visite_form_screen.dart:329`, `if (_envoiEnCours) return;`) et à la connexion
(`login_screen.dart:41`, `if (... isSubmitting) return;`).

**Observé (lecture).** `enregistrer()` n'a aucun verrou de réentrance, et il
attend l'autorisation d'alarme AVANT de poser `saving` :

```dart
// apps/mobile/lib/features/representant/presentation/representant_qualification_screen.dart:243
if (rappelAt != null) {
  await demanderLAlarme(context, ref);
  if (!context.mounted) return;
}
setState(() {
  saving = true;
```

`demanderLAlarme` appelle `ensurePermissions()`
(`core/notifications/rep_callback_notifications.dart:92`), c'est-à-dire un
aller-retour de canal de méthode vers Android. Pendant cette attente, le bouton
reste allumé (`CpiButton` ne s'éteint que sur `loading`, lié à `saving`), et un
second appui rejoue tout : deux lignes en file, deux rappels armés
(`write_repository.dart`, insertion dans `repCallbackReminders`), deux alarmes
programmées.

**Statut de preuve.** À confirmer par test. Le test écrit pour cela
(autorisation retardée de 300 ms, deux appuis à 100 ms d'intervalle) n'a pas pu
être stabilisé dans le temps imparti : il a été retiré plutôt que laissé rouge
sans diagnostic. Le défaut est tenu par la lecture ci-dessus.

**Correctif minimal proposé.** `if (saving) return;` en tête de `enregistrer`,
et poser `saving` AVANT la demande d'autorisation.

## FOR-07 L'heure de rappel choisie disparaît de l'écran

**Scénario.** Qualification, « À rappeler », choisir « Dans 1 h ». Attendre une
minute, ou passer à l'étape 2 puis revenir.

**Attendu.** La puce choisie reste allumée tant que l'heure est retenue.

**Observé.** La sélection ne vit que dans l'état du sélecteur, et elle se lit par
égalité d'INSTANT :

```dart
// apps/mobile/lib/features/phase2/presentation/callback_picker.dart:151
selected: !_perso && _selected == slot.at,
```

L'écran passe `now: DateTime.now()` à chaque `build`
(`representant_qualification_screen.dart:487`), donc « Dans 1 h » désigne un
autre instant à la minute suivante et la puce s'éteint. Le retour à l'étape 1
depuis l'étape 2 démonte le sélecteur (`_corpsResultat` contre `_corpsDetails`,
lignes 382 à 384) et repart d'un état vierge. Dans les deux cas, `rappelAt` est
toujours posé chez le parent et partira à l'enregistrement, et le
récapitulatif de l'étape 2 (`recapDe`, lignes 125 à 151) ne cite jamais l'heure
promise : plus rien à l'écran ne dit quand le représentant sera rappelé.

**Preuve.** Test `la puce « Dans 1 h » s'éteint toute seule à la minute suivante`
(`apps/mobile/test/qa/qa_form_phase2_test.dart`) : après une reconstruction du
parent avec un « maintenant » avancé d'une minute, plus aucune puce n'est
sélectionnée, alors que la seule valeur remontée reste l'heure d'origine. La
perte au retour d'étape est tenue par la lecture (démontage du sous-arbre).

**Correctif minimal proposé.** Remonter l'instant choisi au parent
(`CallbackPicker(value: rappelAt, ...)`) et le rendre à la puce, au lieu de le
garder dans l'état interne ; ajouter la ligne « Rappel » au récapitulatif.

## FOR-08 « −15 min » avant minuit inscrit la visite la veille

**Scénario.** Accueil, visite saisie à 00 h 05, deux appuis sur « −15 min ».

**Attendu.** L'heure recule, le jour du registre ne change pas sans le dire.

**Observé (lecture).** Le recul porte sur l'instant complet, et le jour est
dérivé de ce même instant :

```dart
// apps/mobile/lib/features/accueil/presentation/visite_form_screen.dart:264
setState(() => _moment = _moment.subtract(const Duration(minutes: 15)));
// :360
date: jourDakar(_moment),
```

La ligne d'état n'affiche que l'heure (`_LigneHeure`, « Arrivé à 23 h 50 ») :
la visite bascule dans le registre de la veille sans que rien ne l'annonce, et
elle sort du compteur du jour.

**Statut de preuve.** À confirmer par test (l'horloge est injectable via
`clockProvider`, le test est écrivable rapidement).

**Correctif minimal proposé.** Interdire le recul sous le début du jour de
saisie, ou afficher la date complète dès que `jourDakar(_moment)` diffère de
`jourDakar(_saisiA)`.

## FOR-09 Champs d'identifiants hors `AutofillGroup`

**Scénario.** Se connecter avec un gestionnaire de mots de passe.

**Observé.** Les deux champs portent `AutofillHints.username` et
`AutofillHints.password` (`login_screen.dart:164` et `:186`), mais aucun
`AutofillGroup` n'existe dans l'application, et `TextInput.finishAutofillContext`
n'est appelé nulle part : la recherche des deux symboles sur `apps/mobile/lib`
et `apps/mobile/test` ne rend aucune occurrence. Sans contexte d'autofill
achevé, Android ne propose jamais d'enregistrer l'identifiant après une
connexion réussie.

**Statut de preuve.** Fait de code vérifié ; l'effet sur l'appareil n'a pas pu
être observé (pas d'émulateur disponible).

**Correctif minimal proposé.** Envelopper le `Form` dans un `AutofillGroup` et
appeler `TextInput.finishAutofillContext()` après une connexion réussie.

## Vérifié sans défaut

- **Téléphone obligatoire au registre des visites.** `manque(EtapeVisite.qui)`
  (`visite_champs.dart:80`) retient l'étape tant que le numéro n'est pas
  complet. C'est un choix assumé et gardé par un test existant
  (`test/features/accueil_test.dart:998`, « un visiteur a un numéro : il n'est
  plus facultatif »), alors même que le serveur l'accepte absent.
- **Numéro étranger au registre.** `strictSenegal: false` accepte `+33 6 …` tel
  qu'il est dicté ; le serveur le stocke en clair (`visites/dto.ts:236`).
- **Anti double envoi de la visite.** `_enregistrer` sort sur `_envoiEnCours`
  (`visite_form_screen.dart:329`) et le bouton porte `loading`.
- **Anti double envoi du prospect et du représentant.** `_save` pose `_saving`
  de façon synchrone avant tout `await` (`prospect_entry_screen.dart:356`,
  `representant_form_screen.dart:421`), et `CpiButton` refuse les appuis pendant
  `loading` (`cpi_kit.dart:354`).
- **Anti double envoi à la connexion.** `login_screen.dart:41`.
- **Motifs d'issue d'appel inactifs.** `watchCallReasons`
  (`reference_repository.dart:107`) filtre `is_active = 1` ; seuls les six motifs
  système servent de repli quand la table est vide.
- **Brouillon repris sur le mauvais représentant.** `_acceptsParent`
  (`prospect_entry_screen.dart:213`) refuse un brouillon dont le parent diffère
  du représentant ouvert ; la clé de brouillon distingue les projets
  (`:100`).
- **Brouillon de visite.** Seul un brouillon de plantage est repris, les autres
  sont supprimés à l'ouverture (`visite_form_screen.dart:111`).
- **Longueurs bornées ailleurs.** Notes et commentaires à 2000
  (`representant_form_screen.dart:825`, `representant_qualification_screen.dart:512`
  et `:571`, `phase2_screen.dart:1294` et `:1911`), professions et e-mail dans la
  conversion (`phase2_screen.dart:643`, `:652`, `:669`, `:681`) : toutes ces
  bornes correspondent au contrat.
- **Heure de la visite au clavier.** `_FeuilleHeure._valider`
  (`visite_form_screen.dart:812`) refuse `>23` et `>59`, avec deux formateurs
  chiffres et une limite de deux caractères.
- **Rendez-vous de conversion dans le passé.** `RendezVousSheet._passe`
  (`phase2_screen.dart:1615`) éteint le bouton, avec la même tolérance d'horloge
  que le serveur (`kRendezVousSkew` contre `CALLBACK_CLOCK_SKEW_TOLERANCE_MS`).
- **Identifiants UUID.** Le serveur valide en `@IsUUID()` sans version : les
  identifiants v7 du client passent (vérifié par les envois de la campagne de
  sondes, tous acceptés sur ce point).

## Non vérifié

- Comportement clavier réel (masquage du bouton d'envoi, `textInputAction`,
  passage d'un champ à l'autre) : demande un appareil ou un émulateur.
- Autofill Android de bout en bout (FOR-09) : même raison.
- Reprise de brouillon après un plantage réel du processus (seul l'âge du
  brouillon a été relu).
- Écran de corrections : le rendu du message serveur a été lu
  (`corrections_screen.dart:363`, il affiche `lastErrorMsg` tel quel, donc en
  anglais pour un refus de validation) mais n'a pas été mis sous test ; la
  phrase anglaise est en revanche prouvée côté serveur (`bootstrap.ts:113`,
  messages `class-validator` par défaut).
- Réglages : aucun champ de saisie libre, écran non recetté.
- Formulaire de correction d'une visite (`_corrigerVisite`) et feuille
  d'arbitrage de propriété : hors du temps imparti.

## Comment rejouer

```
cd apps/mobile
fvm flutter test test/qa/qa_form_prospect_test.dart test/qa/qa_form_phase2_test.dart
```

Sondes serveur : `POST http://localhost:3001/api/v1/sync/push`, jeton obtenu par
`POST /api/v1/auth/login` avec un compte de `apps/web/e2e/fixtures.ts`.
