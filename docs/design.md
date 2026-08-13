# Design system — CPI GO

Source unique de vérité pour **les deux** clients : `apps/web` (Tailwind v4) et
`apps/mobile` (Flutter Material 3). Un token change ici, il change des deux côtés.

Repris de
`/Users/cheikh/Workspace/CPI/Projects/PLATEFORME/GRANDPUBLIC/cpi-grand-public-frontend/`
(`docs/design.md` + `src/styles/globals.css`), seule palette CPI dont les ratios de contraste
ont été mesurés paire par paire. Base structurelle : **Material Design 3**.

---

## 1. Principes

1. **Structure Material 3, couleur CPI.** On ne redessine pas les composants, on les habille.
2. **Un token, un rôle.** Aucune couleur en dur dans un widget ou un composant. Si un rôle
   manque, on l'ajoute ici — on ne bricole pas localement.
3. **Le contraste n'est pas négociable.** AA (4.5:1) pour le texte, 3:1 pour les éléments non
   textuels. Toute paire non listée ici doit être mesurée avant usage.
4. **Cible tactile minimale 44 px.** L'app est utilisée debout, au soleil, parfois à une main.

---

## 2. Couleurs — mode clair

### 2.1 Base

| Token               | Hex                  | Rôle                         |
| ------------------- | -------------------- | ---------------------------- |
| `background`        | `#FFFFFF`            | Fond d'application           |
| `foreground`        | `#1C0810`            | Texte courant                |
| `card` / `popover`  | `#FBFBFC`            | Surfaces élevées             |
| `border`            | `rgba(99,2,16,0.12)` | Séparateurs décoratifs       |
| `input-background`  | `#F5ECEE`            | Fond de champ                |
| `input-border`      | `#AF7D84`            | Contour de champ — 3,24:1    |
| `switch-background` | `#C4A0AA`            | Piste d'interrupteur         |

### 2.2 Bordeaux CPI — primaire

| Token                  | Hex       | Rôle                           |
| ---------------------- | --------- | ------------------------------ |
| `primary`              | `#630210` | Actions principales, en-têtes  |
| `primary-hover`        | `#7E0417` | Survol / pression              |
| `primary-foreground`   | `#FFFFFF` | Texte sur bordeaux             |
| `primary-text`         | `#630210` | `primary` en texte et icônes   |
| `secondary`            | `#F5ECEE` | Surface prune claire           |
| `secondary-foreground` | `#630210` | Texte sur surface prune claire |
| `muted`                | `#EDE4E6` | Surface neutre                 |
| `muted-foreground`     | `#6B4A52` | Texte secondaire               |
| `ring`                 | `#630210` | Anneau de focus                |

### 2.3 Or CPI — la règle à ne jamais oublier

`#C8921A` fait **2,77:1 sur blanc**. Il échoue AA texte (4,5:1) _et_ le seuil grand texte (3:1).

> **L'or ne sert jamais de couleur de texte.** Jamais. C'est une surface décorative.

| Token               | Hex       | Usage autorisé                                               |
| ------------------- | --------- | ------------------------------------------------------------ |
| `accent`            | `#C8921A` | **Surface décorative uniquement**                            |
| `accent-foreground` | `#1C0810` | Texte posé _sur_ une surface or — 6,95:1                     |
| `accent-text`       | `#856011` | **Seule** déclinaison pour texte et icônes — 5,71:1 sur card |
| `accent-border`     | `#A87A15` | Bordures et traits or — 3,85:1 sur blanc                     |
| `accent-on-dark`    | `#FFC65A` | Texte or sur bordeaux — 8,71:1 sur `primary`                 |
| `accent-surface`    | `#FAF4E8` | Fond de statut « attention » (or 10 % aplati)                |

### 2.4 Statuts

| Token         | Couleur   | Surface   |
| ------------- | --------- | --------- |
| `success`     | `#1A6B44` | `#E8F0EC` |
| `destructive` | `#B91C1C` | `#F8E8E8` |
| `warning`     | `#856011` | `#FAF4E8` |
| `info`        | `#A34462` | `#F7EEF1` |

### 2.5 Navigation (sidebar web, AppBar mobile)

| Token                         | Hex                      |
| ----------------------------- | ------------------------ |
| `sidebar`                     | `#3A010A`                |
| `sidebar-foreground`          | `#DFC0C8`                |
| `sidebar-accent` (item actif) | `#4A0110`                |
| `sidebar-accent-foreground`   | `#FFFFFF`                |
| `sidebar-border`              | `rgba(255,255,255,0.08)` |
| `sidebar-ring`                | `#B05070`                |

### 2.6 Graphiques (Chart.js et mobile)

`chart-1 #630210` · `chart-2 #C8921A` · `chart-3 #1A6B44` · `chart-4 #B05070` · `chart-5 #8B5CF6`

Au-delà de 5 séries, on ne rallonge pas la liste : on regroupe en « Autres ». Une palette de
12 teintes rend un graphe illisible bien avant d'être épuisée.

**L'or `#C8921A` en `chart-2` est une exception assumée, pas un oubli.** Il ne fait que 2,77:1
sur blanc, ce qui échouerait pour du texte — mais §2.3 interdit l'or comme couleur de _texte_,
pas comme _surface_, et une série de graphique est une surface. Trois conditions rendent
l'exception acceptable :

1. La série porte une **bordure `accent-border` `#A87A15`** (3,85:1) qui en dessine le contour :
   c'est ce trait, pas le remplissage, qui délimite la forme.
2. Aucune information n'est portée **par la couleur seule** — WCAG 1.4.1. Chaque série est aussi
   identifiée par sa légende, et l'info-bulle nomme la valeur au survol comme au clavier.
3. Les canevas ne sont pas lisibles par un lecteur d'écran de toute façon : tout graphique doit
   être doublé d'une alternative textuelle ou d'un tableau équivalent.

Sans ces trois conditions, l'or redevient interdit. En mode sombre, `chart-2` bascule sur
`#FFC65A`, qui passe largement.

---

## 3. Couleurs — mode sombre

⚠️ Le bloc `.dark` du fichier PLATEFORME d'origine est un **reliquat shadcn en gris neutre**,
sans aucune identité CPI (`--primary: oklch(0.985 0 0)`, soit du blanc). Il n'est pas repris.

La palette sombre ci-dessous est dérivée de la palette claire.

> **Révisée après mesure sur un écran RENDU (2026-08).** Les valeurs de ce bloc
> avaient été dérivées sur le papier et validées par des tests unitaires, sans
> qu'aucune capture d'écran ne soit jamais regardée. Trois d'entre elles ne
> résistaient pas au premier rendu. Elles sont corrigées ici, ancienne valeur en
> regard, et les causes sont en §3.1.

| Token                | Hex                                                                          | Note                                              |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `background`         | `#140206`                                                                    | Prune quasi noir, pas du gris                     |
| `foreground`         | `#F5E6EA`                                                                    | 16,70:1 sur `background`                          |
| `card` / `popover`   | `#1C1A1D`                                                                    |                                                   |
| `primary`            | **`#A81E33`** _(était `#C4566B`)_                                            | Aplat d'action, porte du **blanc** : 7,25:1       |
| `primary-foreground` | **`#FFFFFF`** _(était `#1C0810`)_                                            | L'ancien couple plafonnait à **4,48:1**           |
| `primary-hover`      | **`#BE2439`** _(était `#D3697D`)_                                            | 6,00:1 sur blanc                                  |
| `primary-text`       | **`#F0919F`** _(rôle nouveau)_                                               | `primary` en TEXTE : 8,53:1 sur `card`            |
| `secondary`          | `#2A0810`                                                                    |                                                   |
| `muted`              | `#2A0810`                                                                    |                                                   |
| `muted-foreground`   | `#C4A0AA`                                                                    | 8,60:1 sur `background`, 8,25:1 sur `card`        |
| `input-border`       | **`#7A5F66`** _(rôle nouveau)_                                               | Contour de champ : 3,51:1 sur `background`        |
| `ring`               | **`#F0919F`** _(était `#C4566B`)_                                            | L'anneau de focus doit se voir sur du sombre      |
| `accent`             | `#C8921A`                                                                    | Surface inchangée                                 |
| `accent-text`        | `#FFC65A`                                                                    | En sombre c'est l'or clair qui passe : 12,42:1    |
| `border`             | `rgba(255,255,255,0.10)`                                                     | Séparateur décoratif seulement, jamais un contour |
| `sidebar`            | **`#300710`** _(était `#250408`)_                                            | À `#250408` elle se confondait avec `background`  |
| `sidebar-foreground` | **`#E8CCD3`** _(était `#DFC0C8`)_                                            | 12,04:1 sur `sidebar`                             |
| `success`            | `#4FBF8B` · `destructive` `#F87171` · `warning` `#FFC65A` · `info` `#E08BA6` |                                                   |

### 3.1 Ce que la mesure sur écran a corrigé

Quatre défauts étaient invisibles dans un tableau de paires théoriques. Ils sont
apparus à la première capture d'un écran réellement rendu.

1. **`primary` + `primary-foreground` = 4,48:1.** Le couple « rose pâle, texte
   sombre » échouait AA sur le bouton principal de l'écran de connexion, celui
   par lequel tout le monde entre. Un bordeaux franc portant du blanc rétablit
   7,25:1, et ressemble à CPI, ce que le rose pâle ne faisait pas.

2. **`primary` servait deux rôles incompatibles.** Le même token remplissait les
   aplats ET colorait texte et icônes. Un aplat sombre conçu pour porter du
   blanc ne peut pas, par construction, servir de couleur de texte sur une
   surface sombre. D'où la scission `primary` / `primary-text`.

3. **Les champs de saisie n'avaient aucun contour.** `--border` à
   `rgba(255,255,255,0.10)` donnait **1,23:1**, et le remplissage `#2A0810` sur
   `#140206` n'ajoutait que 1,10:1 : rien ne délimitait le champ, alors que
   WCAG 1.4.11 exige 3:1 pour la limite d'une commande. Le même défaut existait
   en clair (**1,27:1**). D'où `input-border`, mesuré dans les deux thèmes.

4. **La sidebar disparaissait dans le fond.** `#250408` sur `#140206` ne se
   distinguait pas : le volet de marque de l'écran de connexion n'existait
   simplement plus en mode sombre.

**Corollaire de méthode.** Une paire de tokens ne se valide pas dans un tableau,
elle se valide sur le pixel rendu, **chaîne d'opacités héritées comprise**. Ce
n'était pas la valeur des tokens qui délavait le volet de marque, c'était
`opacity-70` et `opacity-80` posés par-dessus. Un audit qui ne compose pas les
opacités des ancêtres ne mesure pas ce que l'utilisateur voit. Toute couleur de
texte se pose donc avec un token, jamais avec une opacité.

**États désactivés.** `opacity-40` sur un bouton plein tombait à **1,53:1** en
clair. WCAG exempte les commandes inactives, donc aucun audit automatique ne le
signale, mais le libellé devient illisible et l'utilisateur ne sait plus ce que
le bouton refuse de faire. Un composant désactivé change donc de **peau**
(`muted` + `muted-foreground`, 6,18:1 en clair, 7,85:1 en sombre) au lieu de
s'effacer : il perd sa couleur, son ombre et son survol, pas sa lisibilité.

### La couleur de marque n'est pas une couleur de fond

Les surfaces sont **neutres**, dans les deux thèmes. Le fond clair a d'abord été
un `#FAF7F7` teinté de rose et le fond sombre un `#140206` prune : sur un grand
écran de travail, la teinte se voit, et le plan de lecture entier vire au rouge.

Le bordeaux CPI vit dans la **barre latérale**, les **actions** et les
**accents**. Il ne passe jamais sous les chiffres qu'un administrateur lit
pendant huit heures. Une identité forte tient à quelques surfaces bien placées,
pas à la teinte du papier.

Le panel web démarre en **thème clair**, et non sur la préférence système : c'est
un outil de bureau, fait de tableaux et de chiffres. Le sombre reste accessible
d'un clic.

**Le mobile ne suit pas le thème système.** L'app est verrouillée en clair : elle sert en
extérieur, en plein soleil, où le mode sombre réduit la lisibilité. Le mode sombre est réservé
au panel web.

---

## 4. Typographie

| Rôle   | Police                          |
| ------ | ------------------------------- |
| Titres | **Bricolage Grotesque** 300–800 |
| Texte  | **Plus Jakarta Sans** 300–700   |

Sur mobile les deux sont **empaquetées dans l'APK** (`assets/fonts/`), pas chargées via
`google_fonts` en ligne : un premier lancement sur réseau faible ne doit pas afficher une police
de repli pendant dix secondes.

Échelle (racine 16 px) :

```
display    clamp(2rem, 4vw, 2.75rem)     h1  clamp(1.625rem, 3vw, 2rem)
h2         1.5rem                        h3  1.25rem
h4         1.0625rem                     body-xl  1.125rem
body       0.9375rem                     small    0.8125rem
caption    0.75rem                       label    0.6875rem
```

Interlignes : `tight 1.15` · `snug 1.35` · `normal 1.55`.
Graisses : normal 400, medium 600, display 700–800. Titres à `letter-spacing: -0.02em`.

---

## 5. Espacement, rayons, élévation

**Grille 4 pt** — `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80`

**Rayons** — `xs 6 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · full 9999`
(`--radius` de base : `0.25rem`)

**Élévation** — ombres teintées prune `rgba(28,8,16,·)`, jamais du noir pur :

```
elev-xs  0 1px 2px  /0.04
elev-sm  0 1px 3px  /0.05  +  0 1px 2px  /0.04
elev-md  0 4px 12px /0.06  +  0 2px 6px  /0.04
elev-lg  0 8px 24px /0.08  +  0 4px 12px /0.05
elev-xl  0 16px 48px/0.10  +  0 8px 24px /0.06
hover    0 6px 22px rgba(99,2,16,0.10)
```

Sur mobile bas de gamme, on ne dépasse pas `elev-sm` dans une liste défilante : chaque ombre est
une passe de rendu supplémentaire par élément.

---

## 6. États (Material 3)

Opacités de la couleur de premier plan appliquées par-dessus la surface :

| État                  | Opacité |
| --------------------- | ------- |
| Survol                | 0.08    |
| Focus                 | 0.10    |
| Pression              | 0.12    |
| Sélection             | 0.12    |
| Glissé                | 0.16    |
| Désactivé — contenu   | 0.38    |
| Désactivé — conteneur | 0.12    |

Cible tactile minimale : **44 px**.

Tout composant interactif doit couvrir ses 8 états : repos, survol, focus, pression, sélection,
désactivé, chargement, erreur.

---

## 7. Mouvement

```
dur-1  150ms    micro-retours (coche de sync, pression de bouton)
dur-2  220ms    transitions de composant (ouverture de champ, snackbar)
dur-3  300ms    transitions d'écran

ease-out     cubic-bezier(0.22, 1, 0.36, 1)      entrées et sorties
ease-spring  cubic-bezier(0.34, 1.56, 0.64, 1)   confirmations (rebond léger)
```

Règles :

- `animation-fill-mode: backwards` obligatoire côté web, sinon l'état initial clignote.
- Une animation qui n'informe de rien est supprimée. Le mouvement sert le retour d'action.
- `MediaQuery.disableAnimations` / `prefers-reduced-motion` sont respectés : les durées tombent
  à 0, la logique ne change pas.

---

## 8. Iconographie

**Aucun emoji, nulle part.** Ils rendent différemment selon l'appareil et cassent l'alignement.

- Mobile : `phosphor_flutter`, style `regular`, `duotone` pour les états vides.
- Web : `lucide-react`.

Icônes d'état de synchronisation (les seules qui portent du sens métier) :

| État       | Icône                            | Couleur            |
| ---------- | -------------------------------- | ------------------ |
| `draft`    | `pencil-simple`                  | `muted-foreground` |
| `pending`  | `cloud-slash`                    | `muted-foreground` |
| `syncing`  | `arrows-clockwise` (en rotation) | `info`             |
| `synced`   | `check-circle`                   | `success`          |
| `conflict` | `warning-circle`                 | `warning`          |
| `failed`   | `x-circle`                       | `destructive`      |

---

## 9. Logo

Aucun SVG du wordmark n'existe dans le patrimoine CPI. Masters raster :

| Fichier                    | Usage                                   |
| -------------------------- | --------------------------------------- |
| `cpi-logo.png` (417×170)   | Sur fond clair                          |
| `cpi-header.png` (489×200) | Sur fond bordeaux — version inversée    |
| `favicon.svg` (512×512)    | Symbole seul, seul vectoriel disponible |

Origine : `CPI/Projects/cpi-platform-source-20260717/apps/web/public/logos/`.
Copiés dans `apps/mobile/assets/brand/` et `apps/web/public/brand/`.

---

## 10. Cartographie des tokens

| Ici                            | Tailwind v4 (`apps/web/src/app/globals.css`) | Flutter (`apps/mobile/lib/core/theme/`)     |
| ------------------------------ | -------------------------------------------- | ------------------------------------------- |
| `primary`                      | `--primary` → `--color-primary`              | `ColorScheme.primary`                       |
| `background`                   | `--background`                               | `ColorScheme.surface`                       |
| `card`                         | `--card`                                     | `ColorScheme.surfaceContainerLowest`        |
| `destructive`                  | `--destructive`                              | `ColorScheme.error`                         |
| `accent-text`                  | `--accent-text`                              | `CpiColors.accentText` (extension de thème) |
| `success` / `warning` / `info` | idem                                         | `CpiColors` (Material 3 n'a pas ces rôles)  |

Material 3 ne définit ni `success`, ni `warning`, ni `info`. Côté Flutter ils vivent dans une
`ThemeExtension<CpiColors>` — **pas** dans des constantes globales, pour rester accessibles via
`Theme.of(context)` et testables.

`ColorScheme.fromSeed(#630210)` seul ne suffit pas : l'algorithme de Material dérive des rôles
qui ne correspondent pas aux valeurs auditées ci-dessus. La graine sert de point de départ, puis
les rôles critiques (`primary`, `onPrimary`, `surface`, `error`, `outline`) sont **écrasés
explicitement** avec les hex de ce document.
