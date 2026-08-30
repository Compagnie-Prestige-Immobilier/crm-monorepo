---
version: alpha
name: Gnawalma
description: Marketplace d'ateliers de couture senegalais et outil de gestion d'atelier.
colors:
  primary: "#BC3714"
  ink: "#0B0B0C"
  ink-secondary: "#52525B"
  ink-tertiary: "#6B6B75"
  canvas: "#FFFFFF"
  surface-low: "#FAFAF9"
  sunken: "#F4F4F5"
  hairline: "#E7E7EA"
  accent: "#BC3714"
  on-accent: "#FFFFFF"
  success: "#0F6B4F"
  warning: "#8A4B00"
  danger: "#A62A1F"
  dark-ink: "#ECECEF"
  dark-ink-secondary: "#A6A6B0"
  dark-ink-tertiary: "#8E8E9A"
  dark-canvas: "#101014"
  dark-surface-low: "#17171C"
  dark-container: "#1D1D23"
  dark-sunken: "#26262E"
  dark-hairline: "#2C2C34"
  dark-accent: "#FF8A63"
  dark-success: "#4ECFA3"
  dark-warning: "#E5A93C"
  dark-danger: "#FF7A6B"
typography:
  display-lg:  { fontFamily: system-ui, fontSize: 34px, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.7px }
  display-md:  { fontFamily: system-ui, fontSize: 28px, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5px }
  headline:    { fontFamily: system-ui, fontSize: 24px, fontWeight: 600, lineHeight: 1.2,  letterSpacing: -0.3px }
  title-lg:    { fontFamily: system-ui, fontSize: 20px, fontWeight: 600, lineHeight: 1.2,  letterSpacing: -0.2px }
  title-md:    { fontFamily: system-ui, fontSize: 16px, fontWeight: 600, lineHeight: 1.3 }
  body-lg:     { fontFamily: system-ui, fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
  body-md:     { fontFamily: system-ui, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  label:       { fontFamily: system-ui, fontSize: 14px, fontWeight: 600, lineHeight: 1.2,  letterSpacing: 0.1px }
  caption:     { fontFamily: system-ui, fontSize: 12px, fontWeight: 400, lineHeight: 1.4,  letterSpacing: 0.1px }
  money-xl:    { fontFamily: system-ui, fontSize: 32px, fontWeight: 600, lineHeight: 1.1,  letterSpacing: -0.5px, fontFeature: "tnum" }
  money-lg:    { fontFamily: system-ui, fontSize: 20px, fontWeight: 600, lineHeight: 1.2,  fontFeature: "tnum" }
  money-md:    { fontFamily: system-ui, fontSize: 15px, fontWeight: 600, lineHeight: 1.2,  fontFeature: "tnum" }
rounded:
  control: 12px
  container: 16px
  sheet: 24px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  page: 20px
  xl: 24px
  xxl: 32px
  xxxl: 48px
components:
  button-primary:      { backgroundColor: "{colors.ink}", textColor: "{colors.on-accent}", rounded: "{rounded.control}", typography: "{typography.label}", height: 52px }
  button-secondary:    { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", rounded: "{rounded.control}", typography: "{typography.label}", height: 52px }
  button-ghost:        { backgroundColor: "{colors.canvas}", textColor: "{colors.accent}", rounded: "{rounded.control}", typography: "{typography.label}", height: 48px }
  button-accent:       { backgroundColor: "{colors.primary}", textColor: "{colors.on-accent}", rounded: "{rounded.control}", typography: "{typography.label}", height: 52px }
  field:               { backgroundColor: "{colors.sunken}", textColor: "{colors.ink}", rounded: "{rounded.control}", typography: "{typography.body-lg}", height: 56px }
  field-label:         { backgroundColor: "{colors.canvas}", textColor: "{colors.ink-secondary}", typography: "{typography.caption}" }
  field-hint:          { backgroundColor: "{colors.sunken}", textColor: "{colors.ink-tertiary}", typography: "{typography.body-lg}" }
  row:                 { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.title-md}", padding: "{spacing.page}" }
  row-caption:         { backgroundColor: "{colors.canvas}", textColor: "{colors.ink-secondary}", typography: "{typography.body-md}" }
  divider:             { backgroundColor: "{colors.hairline}", textColor: "{colors.ink}", height: 1px }
  card-photo:          { backgroundColor: "{colors.surface-low}", textColor: "{colors.ink}", rounded: "{rounded.container}", padding: "{spacing.page}" }
  sheet:               { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", rounded: "{rounded.sheet}", padding: "{spacing.page}" }
  nav-bar:             { backgroundColor: "{colors.canvas}", textColor: "{colors.ink-secondary}", typography: "{typography.caption}", rounded: "{rounded.full}", padding: "{spacing.md}" }
  nav-bar-active:      { backgroundColor: "{colors.canvas}", textColor: "{colors.primary}", typography: "{typography.caption}", rounded: "{rounded.full}" }
  money:               { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", typography: "{typography.money-lg}" }
  tag:                 { backgroundColor: "{colors.sunken}", textColor: "{colors.ink-secondary}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  tag-success:         { backgroundColor: "{colors.canvas}", textColor: "{colors.success}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  tag-warning:         { backgroundColor: "{colors.canvas}", textColor: "{colors.warning}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  tag-danger:          { backgroundColor: "{colors.canvas}", textColor: "{colors.danger}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  button-primary-dark: { backgroundColor: "{colors.dark-ink}", textColor: "{colors.dark-canvas}", rounded: "{rounded.control}", typography: "{typography.label}", height: 52px }
  button-ghost-dark:   { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-accent}", rounded: "{rounded.control}", typography: "{typography.label}", height: 48px }
  field-dark:          { backgroundColor: "{colors.dark-sunken}", textColor: "{colors.dark-ink}", rounded: "{rounded.control}", typography: "{typography.body-lg}", height: 56px }
  field-label-dark:    { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-ink-secondary}", typography: "{typography.caption}" }
  field-hint-dark:     { backgroundColor: "{colors.dark-sunken}", textColor: "{colors.dark-ink-tertiary}", typography: "{typography.body-lg}" }
  row-dark:            { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-ink}", typography: "{typography.title-md}", padding: "{spacing.page}" }
  row-caption-dark:    { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-ink-secondary}", typography: "{typography.body-md}" }
  divider-dark:        { backgroundColor: "{colors.dark-hairline}", textColor: "{colors.dark-ink}", height: 1px }
  card-photo-dark:     { backgroundColor: "{colors.dark-surface-low}", textColor: "{colors.dark-ink}", rounded: "{rounded.container}", padding: "{spacing.page}" }
  sheet-dark:          { backgroundColor: "{colors.dark-container}", textColor: "{colors.dark-ink}", rounded: "{rounded.sheet}", padding: "{spacing.page}" }
  nav-bar-dark:        { backgroundColor: "{colors.dark-container}", textColor: "{colors.dark-ink-secondary}", typography: "{typography.caption}" }
  money-dark:          { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-ink}", typography: "{typography.money-lg}" }
  tag-dark:            { backgroundColor: "{colors.dark-sunken}", textColor: "{colors.dark-ink-secondary}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  tag-success-dark:    { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-success}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  tag-warning-dark:    { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-warning}", rounded: "{rounded.full}", typography: "{typography.caption}" }
  tag-danger-dark:     { backgroundColor: "{colors.dark-canvas}", textColor: "{colors.dark-danger}", rounded: "{rounded.full}", typography: "{typography.caption}" }
---

# DESIGN — Gnawalma

Contrat de conception. `SPEC.md` dit ce que fait l'application ; ce document dit
à quoi elle ressemble. Tout travail futur étend ce fichier, ne le contredit
jamais en silence. Une décision qui change se met à jour ici, dans le même
commit que le code.

## Overview

**Style : Elegant & Premium.** Raffiné, photo mise en valeur, profondeur
discrète. La référence assumée est Airbnb, pas Uber : la marketplace vend des
ateliers, et on ne vend pas un savoir-faire avec une grille grise.

**Thème principal : clair.** C'est la cible de conception. Le palette se règle en
clair, chaque écran se construit et se relit en clair, la démonstration se fait
en clair. Le sombre est livré complet, jamais compilé sans avoir été regardé,
mais il est dérivé ensuite.

La raison est physique : un tailleur travaille de jour, souvent près d'une porte
ouverte, sur un écran bon marché peu lumineux, parfois dehors. Le sombre en plein
soleil est illisible.

**Deux registres, un seul système.**

| Espace | Registre | Ce que ça change |
|---|---|---|
| Atelier | Utility | L'outil disparaît derrière la tâche. Dense, sobre, rapide. Familiarité gagnée plutôt que surprise. |
| Client | Expressive | La conception *est* le produit. Photo en avant, plus d'air, une composition par écran clé. |

Mêmes jetons, mêmes composants, mêmes couleurs. La différence se joue sur la
densité et sur la place donnée à l'image, jamais sur une seconde palette ni sur
un second jeu de widgets.

**Molettes.**

| | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Espace atelier | 4 | 5 | 5 |
| Espace client | 6 | 6 | 4 |
| Introduction et assistant | 7 | 7 | 3 |

VARIANCE 6 côté client impose au moins une composition sur mesure : c'est la
fiche atelier, avec sa couverture pleine largeur qui se replie. VARIANCE 4 côté
atelier interdit l'inverse : aucun écran de gestion n'a de direction artistique
propre, tous partagent la même anatomie.

MOTION 5–6 veut dire mouvement montré, pas seulement annoncé : transitions de
conteneur, transition héros sur l'ouverture d'une fiche atelier, retour au
toucher partout. **Contrainte matérielle : appareil de référence Android 10,
3 Go de RAM.** Toute animation qui ne tient pas 60 images par seconde dessus est
retirée, pas optimisée plus tard.

**L'action numéro un.**

- Côté client : **contacter un atelier**, atteint en le trouvant. La découverte
  est le chemin, le contact est la fin. Sur la fiche atelier, un seul bouton
  plein à fort contraste : Contacter. Sur l'accueil, l'élément focal est la
  recherche.
- Côté atelier : **créer une commande**. C'est le geste quotidien.

**Voix : sobre et factuelle.** Phrases courtes, verbe en premier, aucune
familiarité, aucun trait d'humour, jamais dans un message d'erreur. On dit ce qui
s'est passé et ce qu'il faut faire.

## Colors

**Stratégie : retenue.** Neutres et un seul accent, qui n'occupe jamais plus de
10 % d'un écran. L'accent sert l'action principale, la sélection et l'état. Il
n'est jamais décoratif.

**L'accent est `#BC3714`**, l'orange LIC (`#E64922`) assombri jusqu'à passer les
seuils dans les deux sens. Il reste reconnaissable comme la couleur de la marque.
En sombre il devient `#FF8A63`, désaturé pour ne pas vibrer.

Un seul accent dans toute l'application. Une pastille turquoise sur un écran
serait une erreur, pas une variante.

**Contrastes vérifiés** (calculés, pas estimés) :

| Rôle | Sur blanc | Sur surface basse | Sur champ |
|---|---|---|---|
| Encre `#0B0B0C` | 19,67 | 18,84 | 17,90 |
| Encre secondaire `#52525B` | 7,73 | 7,40 | 7,03 |
| Encre tertiaire `#6B6B75` | 5,27 | 5,05 | 4,79 |
| Accent `#BC3714` | 5,68 | 5,44 | 5,17 |

En sombre, sur `#101014` : encre 16,10 · secondaire 7,87 · tertiaire 5,86 ·
accent 8,20. Le minimum de tout le système est 4,64 (encre tertiaire sur la
surface la plus haute en sombre), au-dessus du seuil de 4,5.

**États sémantiques** — hors `ColorScheme`, donc dans une `ThemeExtension` :
succès `#0F6B4F` / `#4ECFA3`, alerte `#8A4B00` / `#E5A93C`, danger `#A62A1F` /
`#FF7A6B`. Tous au-dessus de 6:1 dans leur mode.

Un état ne se lit jamais à la couleur seule : toujours le mot, toujours la
position. Huit pour cent des hommes ne distinguent pas le rouge du vert.

**L'argent est toujours en encre.** Jamais vert, jamais rouge, jamais dans une
pastille colorée. Une colonne de montants d'une seule teinte se parcourt ; une
colonne teintée par état devient une texture.

**Le sombre est conçu, pas inversé.** Base `#101014`, jamais `#000000` : le noir
pur tue l'élévation et bave au défilement sur OLED. La profondeur vient de
surfaces plus claires, jamais d'une ombre portée.

**Vérification anti-réflexe.** Le réflexe pour « couture, Afrique de l'Ouest »
serait terre cuite, motifs de pagne et or. Ce n'est pas ce qui est fait ici :
l'accent est la couleur réelle du commanditaire, la base est neutre, et il n'y a
aucun motif. La chaleur vient des photos des ateliers, pas d'un aplat.

## Typography

**Police système.** Roboto sur Android, SF sur iOS. Décision assumée : elle rend
mieux sur un appareil modeste, elle ne pèse rien, elle ne dépend d'aucune
licence. Le caractère vient donc de l'échelle et de la mise en page, pas de la
fonte, ce qui met la barre plus haut sur les deux.

Une seule famille. Trois graisses : 400, 600, 700.

Onze rôles, tailles entières, aucun demi-point. L'ancienne application avait six
tailles dans une plage de cinq points, ce qui n'est pas une hiérarchie mais du
bruit. Plancher à 12 : l'ancienne étiquette d'état était à 10,5 et portait le mot
`EN RETARD`.

Interlignes : titres 1,12 à 1,3 — **jamais en dessous de 1,1**, sous peine de
rogner les jambages. Corps 1,5.

Approche négative proportionnelle à la taille, plafonnée à −0,02 × la taille.
L'ancienne échelle était à −1,4 sur 36 points, assez pour faire se toucher les
chiffres.

**Les styles de texte ne portent pas de couleur.** La couleur arrive du thème au
moment de l'usage. C'est la règle qui empêche le défaut le plus courant de
Flutter : un blanc figé dans une constante, invisible dès qu'on passe en clair.
L'ancienne application appelait ses styles statiques 333 fois contre 10 lectures
du thème, et rattrapait la couleur à la main à chaque appel.

**Chiffres tabulaires obligatoires** sur tout montant. Séparateur de milliers
U+202F, zéro décimale : `12 000 FCFA`.

Tout se relit à 130 % d'échelle de texte, les écrans clés à 200 %.

## Layout

Base 4 points. Une seule gouttière : **le contenu commence à 20 points du bord**,
16 en dessous de 360 points de large. Le remplissage intérieur d'une carte vaut
aussi 20, de sorte que le texte d'une carte et celui d'une ligne pleine largeur
partagent le même bord gauche.

C'est la règle qui fait qu'un écran paraît composé plutôt qu'assemblé.

Éléments liés : 8 à 12 d'écart. Sections : 24 à 32. Titre d'écran vers premier
bloc : 24.

**Les listes sont des lignes pleine largeur séparées par un filet, pas des
cartes.** Une liste de cartes bordées est le motif le plus reconnaissable d'une
application non finie. La carte est réservée à deux cas : un élément porteur
d'une photo, et un objet unique récapitulé sur un écran.

Aucune carte imbriquée, jamais.

`SafeArea` partout. Aucun débordement à 320 points de large, en paysage, ni à
130 % d'échelle. Classes de taille gérées si l'application vise la tablette ;
largeur de lecture plafonnée autour de 680 points.

## Elevation & Depth

**Deux ombres dans toute l'application** : la feuille modale et la barre d'action
fixe. Rien d'autre n'a d'ombre.

En sombre, aucune ombre : la profondeur vient de l'échelle de surfaces
(`#101014` → `#17171C` → `#1D1D23` → `#26262E`). Une ombre sur du presque noir
ne se voit pas.

**La carte par défaut n'a ni bordure, ni fond, ni ombre.** Le regroupement vient
du blanc, du poids typographique et des filets pleine largeur. L'ancienne
application bordait ses cartes à 1,27:1 sur blanc : sur un écran bon marché à
mi-luminosité, ce n'est pas un trait, c'est rien. Une bordure qui promet une
structure qu'elle ne rend pas est pire que pas de bordure.

Les bordures survivent à trois endroits : l'anneau de focus d'un champ, un bloc
qui doit être visiblement clos (le total d'un bon de commande), et le bord
supérieur de la barre de navigation et de la barre d'action.

## Shapes

Une seule famille de rayons, douce : contrôle 12, conteneur 16, feuille 24,
cercle 999. Rien d'autre n'existe.

L'ancienne application portait quatre valeurs réelles et douze alias dépréciés
pointant dessus. Les alias ne sont pas repris.

## Components

Les composants déclarés dans l'en-tête YAML sont des *jetons* : des paires
fond/texte que le linteur vérifie, en clair comme en sombre. Les composants
ci-dessous sont les *widgets* Flutter qui les consomment. Les deux listes n'ont
pas la même longueur et c'est normal : un widget porte plusieurs jetons.

Dix widgets partagés. L'ancienne application en avait cinquante-huit, dont
seize sans aucune référence, quatre implémentations d'état vide, et un second jeu
complet réservé à l'espace client.

| Composant | Rôle |
|---|---|
| `AppScaffold` | Structure, zone sûre, rafraîchissement, marge basse. |
| `AppTitle` | Titre d'écran. **Aucun paramètre de sous-titre, aucun surtitre.** |
| `AppRow` | La ligne de liste unique. Absorbe toute tuile, toute carte de liste. |
| `AppButton` | Plein, contour, fantôme, danger. Deux tailles. Verrou anti double envoi. |
| `AppField` | Étiquette au-dessus du champ, sur fond clair. |
| `AppMoney` | Montant tabulaire, séparateur fin, zéro décimale, énoncé vocal. |
| `AppTag` | Étiquette d'état, capitales, 12 points. |
| `AppState` | Vide, filtré, hors ligne, erreur, permission. Une seule surface. |
| `AppSheet` | La modale de l'application. |
| `AppNavBar` | Quatre onglets, libellés toujours visibles, filet supérieur. |

Tout le reste est un widget privé dans le fichier de l'écran qui en a besoin.

Chaque élément interactif livre tous ses états : normal, pressé, désactivé,
chargement, erreur. Retour au toucher partout, mise à l'échelle à 0,97 en 120 ms.

Cibles tactiles ≥ 48 points, ≥ 8 points entre deux cibles voisines. L'action
principale vit dans le tiers inférieur, hors de la zone du geste système.

**Aucun widget Material par défaut.** Ni `DropdownButton`, ni `AlertDialog`, ni
`SnackBar`, ni `ChoiceChip`, ni `SegmentedButton`, ni `showDatePicker`, ni
sélecteur de contacts natif. Chaque contrôle est dessiné.

**Aucun bouton flottant.** L'action principale d'un écran est un bouton dans
l'en-tête, à droite.

Le chargement est un squelette de la forme du contenu attendu, jamais un
indicateur circulaire centré, jamais rien en dessous de 300 ms.

## Motion

Personnalité : fluide et premium.

Durées : retour au toucher 120 ms · changement d'état sur place ≤ 250 ms ·
entrée de feuille ou de conteneur 300 à 400 ms · navigation ≤ 500 ms. Une sortie
vaut 50 à 75 % de l'entrée correspondante.

Courbes : entrée `emphasizedDecelerate`, sortie `emphasizedAccelerate`,
transformation sur place `easeInOutCubicEmphasized`. Jamais `linear`, jamais de
rebond ni d'élastique sur du mobilier d'interface.

Le moment signature est unique : la **transition héros** de la vignette d'atelier
vers sa fiche, la couverture grandissant en place. Une seule, côté client.

Pas d'entrée en cascade sur les listes. Une cascade rend un téléphone lent encore
plus lent et se reconnaît immédiatement.

`MediaQuery.disableAnimationsOf` respecté partout.

## Do's and Don'ts

**À faire**

- Tout passe par le thème. Un widget lit `Theme.of(context)` ou un jeton, jamais
  une valeur écrite à la main.
- Les deux modes se regardent avant de déclarer un écran fini.
- Chaque écran de données livre ses cinq états : chargement, vide, filtré vide,
  hors ligne, erreur.
- Les libellés de formulaire sont permanents, au-dessus du champ.
- Les boutons nomment leur effet : `Enregistrer les modifications`, pas `Valider`.
- Un montant s'annonce à la synthèse vocale en toutes lettres.
- Données d'exemple réalistes et sénégalaises. Jamais `John Doe`, jamais `Acme`.

**À ne jamais faire**

- Une couleur, une taille de police ou un rayon écrit dans un fichier d'écran.
- `#000000` en fond sombre, `#FFFFFF` en texte sombre.
- Une ombre portée pour signifier l'élévation en mode sombre.
- Une grille de cartes identiques icône plus titre plus sous-titre.
- Un liseré de couleur sur le bord gauche d'une carte ou d'une alerte.
- Du texte en dégradé, du verre dépoli par défaut, une lueur néon.
- Un indicateur circulaire centré comme stratégie de chargement.
- Un sous-titre gris sous chaque titre de section.
- Un tiret cadratin dans une chaîne affichée à l'utilisateur.
- Une deuxième couleur d'accent, quelle qu'en soit la raison.
- Une bannière de débogage, une icône de lancement par défaut, un écran de
  démarrage par défaut.

## Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 2026-08-25 | Style Elegant & Premium, référence Airbnb | La marketplace est le produit ; elle vend un savoir-faire, pas une grille. |
| 2026-08-25 | Thème principal clair | Usage de jour, en atelier, sur écran peu lumineux, parfois dehors. |
| 2026-08-25 | Couleur retenue, un seul accent `#BC3714` | Orange LIC assombri jusqu'à 5,68:1. Un seul accent supprime la matrice à quatre quadrants qui avait produit un défaut de contraste en sombre. |
| 2026-08-25 | Bouton principal en encre, pas en accent | Encre sur blanc lit comme un produit ; un aplat de marque lit comme un gabarit. |
| 2026-08-25 | Police système, une famille | Meilleur rendu sur appareil modeste, aucun poids, aucune licence. Le caractère vient de l'échelle. |
| 2026-08-25 | Les styles de texte ne portent pas de couleur | Empêche structurellement le blanc figé invisible en mode clair. |
| 2026-08-25 | Pas de bordure, pas de fond sur la carte par défaut | Une bordure à 1,27:1 ne se voit pas sur l'appareil de référence. |
| 2026-08-25 | Aucun widget Material par défaut | Une application identifiable comme gabarit Flutter est un échec du produit. |
| 2026-08-25 | Aucun bouton flottant | Action principale en en-tête à droite, cohérente entre les deux espaces. |
| 2026-08-25 | Sombre basé sur `#101014` | Le noir pur tue l'élévation et bave au défilement sur OLED. |
| 2026-08-25 | Un seul moment signature : transition héros vers la fiche atelier | MOTION 6 exige un moment montré ; un seul tient 60 i/s sur Android 10 / 3 Go. |
| 2026-08-25 | **Révision après premier rendu, jugé « basique et triste ».** Référence explicite : l'application hôte Airbnb. | La version « lignes nues sur blanc » lisait comme un gabarit. Ce qui manquait : une vraie fonte, un sol teinté, des surfaces, des visages, un titre qui parle. |
| 2026-08-25 | Police embarquée : **Plus Jakarta Sans** 400/500/600/700 | Remplace la police système. Le plus proche équivalent libre de Cereal. Annule la décision « police système » ci-dessus. |
| 2026-08-25 | Fond de page **gris clair `#F7F7F7`**, contenu dans des **cartes blanches à rayon 24 avec une ombre douce** | Annule « pas de fond ni d'ombre sur la carte ». Une seule ombre (`0 6 24 #000 à 6 %`), en clair uniquement ; en sombre la carte est une surface plus claire. |
| 2026-08-25 | Titre d'écran **conversationnel et centré** sur les onglets d'accueil : « Vous avez 7 commandes en cours » | Le titre d'un mot (« Commandes ») n'apportait rien. Les écrans poussés gardent un titre court aligné à gauche. |
| 2026-08-25 | **Pastilles segmentées** (sélection en aplat noir) à la place des onglets soulignés | Le contrôle de la référence ; plus grand, plus tactile. |
| 2026-08-25 | **Avatars** partout où une personne apparaît : initiales sur un aplat doux, dérivé du nom | Un visage ou une initiale ancre la ligne ; sans lui la liste n'est que du texte. |
| 2026-08-25 | Icônes **Lucide** (livrées avec Forui), plus jamais les icônes Material | La signature « Android par défaut » la plus reconnaissable était le jeu d'icônes. |
| 2026-08-25 | Onglet actif de la navigation en **accent** | Une des deux apparitions autorisées de l'accent par écran. |
| 2026-08-25 | **Tuiles noires** pour la valeur clé d'un écran (reste à payer, montant) | Le motif « prix par nuit » de la référence : encre pleine, chiffres blancs. |
