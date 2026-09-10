# Constat 2 : audit Lighthouse de go-v2.cpi-chues.com

Le 10 septembre 2026, un rapport Lighthouse a été produit depuis Chrome sur la
page `/espaces` de l'hôte d'essai `go-v2.cpi-chues.com`, qui sert le binaire Go
de la v2 avec le panneau React repris de la v1. Ce document reprend chaque
point du rapport, en donne la cause exacte dans le code, mesure l'effet du
correctif quand il a pu l'être, et sépare ce qui mérite une correction de ce
qui n'en mérite pas.

Aucun fichier du dépôt n'a été modifié pour produire ce constat. La seule
écriture a été un build jetable dans un répertoire temporaire, afin de mesurer
l'effet du correctif principal avant de le proposer.

## Les scores du rapport

| Catégorie             | Score | Lecture                                                  |
| --------------------- | ----: | -------------------------------------------------------- |
| Performance           |    72 | FCP 2,4 s, LCP 2,6 s, TBT 0 ms, CLS 0, Speed Index 2,4 s |
| Accessibilité         |   100 | Rien à corriger                                          |
| Bonnes pratiques      |    92 | Erreurs console, HSTS, COOP, Trusted Types               |
| SEO                   |    83 | Pas de meta description, `robots.txt` invalide           |
| Navigation par agents |   2/3 | `llms.txt` non conforme                                  |

Le rapport signale lui-même que les extensions Chrome ont faussé la mesure.
485 Kio de scripts d'extensions (bloqueurs de publicité, Wappalyzer) ont été
exécutés dans la page, et la tâche la plus longue du thread principal, 228 ms,
vient d'une extension, pas du panneau. Les valeurs de FCP et de LCP sont donc
majorées. Toute mesure future doit se faire en navigation privée.

## Méthode

Les fichiers lus pour établir les causes :

- `web/vite.config.ts` : configuration du build et du plugin TanStack Router
- `web/index.html` : gabarit de la page
- `web/dist/index.html` et `web/dist/assets/` : résultat du build courant,
  128 balises `modulepreload`, 257 fichiers JavaScript
- `web/src/routes/**` : définitions des routes, en particulier la propriété
  `pendingComponent`
- `node_modules/@tanstack/router-plugin/dist/esm/core/constants.js` : valeur
  par défaut du découpage
- `cmd/server/main.go`, fonction `servirPanneau` : service des fichiers
  statiques et repli SPA
- `internal/shared/socle/middleware.go` : en-têtes de sécurité
- les en-têtes HTTP renvoyés par `go-v2.cpi-chues.com` sur un fichier de
  `/assets/` et sur `/`

## Constat 1 : 141 fichiers préchargés sur chaque page

### Ce que dit le rapport

`index.html` contient 141 balises `<link rel="modulepreload">`. Sur la page
`/espaces`, qui n'affiche que les cartes des espaces, le navigateur télécharge
le paquet `chart-*.js` (69 Kio, 62 Kio inutilisés), le paquet
`prospects-*.js` (23 Kio, 22 Kio inutilisés) et les vues des tableaux de bord
bancaires. Le rapport classe cela dans « Reduce unused JavaScript » avec une
économie estimée de 312 Kio, et dans « Network dependency tree ».

### La cause

Le plugin TanStack Router est configuré avec `autoCodeSplitting: true`. Par
défaut, ce plugin ne découpe que trois propriétés de route :

```js
var defaultCodeSplitGroupings = [['component'], ['errorComponent'], ['notFoundComponent']];
```

`pendingComponent` n'en fait pas partie. Or presque toutes les routes du
panneau définissent `pendingComponent: Loading`, et ce `Loading` importe son
squelette depuis le module qui contient la vue complète :

```tsx
import { BankDashboardSkeleton, BankDashboardView } from '@/components/bank/bank-dashboard-view';
```

Le squelette reste dans le fichier de route, qui est importé statiquement par
`routeTree.gen.ts`, lui-même importé par l'entrée. Le module
`bank-dashboard-view` entre donc dans le graphe statique de l'entrée, et avec
lui `bank-charts`, `chart-setup` et `chart.js`. Même mécanisme pour
`GrandPublicTableSkeleton`, importé depuis `prospects-view` par quatorze
routes Grand Public.

Vérification dans le build courant : le paquet d'entrée `index-*.js` importe
directement `chart-*.js`, `bank-dashboard-view-*.js` et `prospects-view-*.js`.

### Le correctif

Une option dans `web/vite.config.ts` :

```ts
tanstackRouter({
  target: 'react',
  autoCodeSplitting: true,
  codeSplittingOptions: {
    defaultBehavior: [['component', 'pendingComponent'], ['errorComponent'], ['notFoundComponent']],
  },
});
```

Le squelette part dans le même paquet que la vue, ce qui est déjà le cas dans
le code source puisqu'ils vivent dans le même fichier.

### L'effet mesuré

Build jetable avec cette seule option, comparé au build courant :

| Mesure                                          | Actuel   | Avec l'option |
| ----------------------------------------------- | -------- | ------------- |
| Balises `modulepreload` dans `index.html`       | 128      | 38            |
| JavaScript préchargé au premier rendu           | 1 115 Ko | 330 Ko        |
| `chart.js`, vues banque et prospects préchargés | oui      | non           |
| Fichiers JavaScript produits                    | 257      | 253           |

Le nombre total de fichiers bouge peu : les icônes Lucide partagées entre
plusieurs routes restent chacune un petit paquet. Mais ces paquets ne sont
plus chargés sur chaque page, seulement par la route qui les utilise.

### L'effet de bord à accepter

Pendant le téléchargement du paquet d'une route, le squelette n'est pas encore
disponible, puisqu'il arrive avec la vue. Le squelette s'affiche toujours
pendant le chargement des données, qui est le temps long. Le téléchargement
d'un paquet déjà en cache est immédiat.

## Constat 2 : cache de quatre heures sur les fichiers hachés

### Ce que dit le rapport

« Use efficient cache lifetimes », 503 Kio. Tous les fichiers de `/assets/`,
les polices et les logos ont un TTL de 4 h.

### La cause

Les fichiers de `/assets/` portent un hachage de contenu dans leur nom. Ils
pourraient être mis en cache un an. Le handler Go ne pose aucun en-tête
`Cache-Control` :

```go
fichiers := http.FileServerFS(dist)
```

En l'absence d'en-tête d'origine, Cloudflare applique sa durée par défaut. La
réponse observée sur `go-v2.cpi-chues.com/assets/index-*.js` :

```
cache-control: max-age=14400
cf-cache-status: HIT
```

Quatre heures, posées par Cloudflare, pas par nous. Résultat : toutes les
quatre heures, chaque utilisateur retélécharge l'intégralité du panneau alors
que rien n'a changé.

### Le correctif

Dans `servirPanneau` de `cmd/server/main.go` :

- `/assets/` : `Cache-Control: public, max-age=31536000, immutable`
- `index.html` : `Cache-Control: no-cache`, pour que chaque déploiement soit vu
  au prochain chargement
- `/brand/` : une journée suffit, les logos changent rarement et ne sont pas
  hachés

Cloudflare respecte les en-têtes d'origine quand ils existent. Le cache de
bord gardera donc lui aussi les fichiers hachés un an.

## Constat 3 : `robots.txt` invalide, `llms.txt` non conforme

### Ce que dit le rapport

`robots.txt` : 141 erreurs « Syntax not understood », une par ligne. Les
lignes citées sont `<!doctype html>`, `<html lang="fr">`, puis les 128 balises
`modulepreload`. `llms.txt` : « File is missing a required H1 header », « File
does not appear to contain any links ».

### La cause

Il n'y a ni `robots.txt` ni `llms.txt` dans `web/public/`. Le handler sert
`index.html` pour tout chemin inconnu :

```go
if _, err := fs.Stat(dist, strings.TrimPrefix(r.URL.Path, "/")); err == nil && r.URL.Path != "/" {
    fichiers.ServeHTTP(w, r)
    return
}
r.URL.Path = "/"
fichiers.ServeHTTP(w, r)
```

Lighthouse demande `/robots.txt`, reçoit la page HTML du panneau avec un
statut 200, et tente de la lire comme un fichier robots. Les 141 erreurs sont
les 141 lignes de `index.html`. Même chose pour `/llms.txt`.

### Le correctif

Deux gestes dans `servirPanneau` et un fichier :

- un chemin inconnu qui porte une extension (`.txt`, `.json`, `.map`, `.png`)
  reçoit un 404 au lieu du repli SPA. Le repli reste pour les vraies routes du
  panneau, qui n'ont pas d'extension
- `web/public/robots.txt` :

```
User-agent: *
Disallow: /
```

Ce CRM est derrière une connexion. Il n'a aucune raison d'être indexé par un
moteur de recherche ni lu par un agent. `llms.txt` n'existe pas et renverra
404 : l'audit « Navigation par agents » passera en non applicable, ce qui est
la vérité.

### Conséquence sur le score SEO

Avec `Disallow: /`, Lighthouse signalera « page bloquée à l'indexation » et le
score SEO baissera. C'est le bon résultat pour un outil interne. Ajouter une
meta description pour remonter ce score n'apporterait rien à un utilisateur du
panneau. Le score SEO n'est pas un objectif pour ce produit et ne doit pas
être lu comme un défaut.

## Constat 4 : logos PNG trop lourds

### Ce que dit le rapport

« Improve image delivery », 64 Kio. `chues-logo.png` fait 395 x 193 pixels
pour un affichage de 164 x 80 ; `cpi-header.png` fait 489 x 200 pour un
affichage de 156 x 64. Les deux sont en PNG.

### La cause

Les images de `web/public/brand/` ont été reprises telles quelles de la v1 :

| Fichier          | Poids    | Affichage                                |
| ---------------- | -------- | ---------------------------------------- |
| `chues-logo.png` | 38,7 Kio | 164 x 80, hub et barre latérale          |
| `cpi-header.png` | 29,4 Kio | 156 x 64, hub, connexion, barre latérale |
| `icon-512.png`   | 170 Kio  | 36 x 36, barre latérale repliée          |
| `cpi-logo.png`   | 61,5 Kio | connexion, demande, export Excel         |

`icon-512.png` n'apparaît pas dans ce rapport parce que la barre latérale
n'était pas repliée, mais 170 Kio pour une icône de 36 pixels est le cas le
plus lourd des quatre.

### Le correctif

Ré-exporter trois images en WebP à deux fois leur taille d'affichage, pour
les écrans à haute densité, avec `cwebp` déjà installé sur le poste :

| Fichier           | Taille cible |
| ----------------- | ------------ |
| `chues-logo.webp` | 328 x 160    |
| `cpi-header.webp` | 312 x 128    |
| `icon-512.webp`   | 72 x 72      |

Puis mettre à jour les cinq références dans `web/src` (`sidebar-nav.tsx`,
`hub-view.tsx`, `espaces.tsx`, `_hub.tsx`, `connexion.tsx`). Les attributs
`width` et `height` suivent les nouvelles dimensions.

`cpi-logo.png` reste en PNG : `tableau-de-bord-xlsx.ts` le récupère pour
l'incruster dans l'export Excel, et exceljs n'accepte que PNG et JPEG.

## Constat 5 : bonnes pratiques

### Erreurs console

Le rapport indique que des erreurs ont été journalisées dans la console, sans
les citer. L'extension Chrome de l'assistant n'était pas connectée, la console
n'a donc pas pu être lue depuis cette session. Ce point reste ouvert tant que
la ligne d'erreur n'a pas été copiée depuis les outils de développement sur
`/espaces`. Elle seule dit s'il s'agit d'un bug du panneau, d'une extension ou
d'un blocage CSP.

### HSTS

Le middleware pose déjà :

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Un an et les sous-domaines. Lighthouse considère la politique « faible » parce
qu'il manque `preload`. Ajouter ce mot engage à inscrire le domaine sur la
liste de préchargement des navigateurs, une démarche externe et difficilement
réversible. À ne pas faire pour un outil interne.

### COOP

`Cross-Origin-Opener-Policy` est absent. Une ligne dans `middleware.go`, à
côté de HSTS, avec la valeur `same-origin`. Aucun risque : le panneau n'ouvre
pas de fenêtre d'une autre origine qui aurait besoin de garder une référence
vers lui. Le widget Turnstile vit dans une iframe, non concernée.

### Trusted Types

Demanderait `require-trusted-types-for 'script'` dans la CSP et un audit de
chaque bibliothèque qui écrit dans `innerHTML` (chart.js, Base UI, le rendu
des exports). Aucun risque XSS mesuré ne le justifie. La CSP actuelle interdit
déjà les scripts externes et `object-src`. À ne pas faire.

## Ce qui n'est pas un problème

- **Accessibilité 100.** Rien à faire.
- **CSS bloquant le rendu**, 40 ms estimés : une feuille de 16 Kio, c'est le
  fonctionnement normal d'une page. L'inliner ferait perdre son cache.
- **Paquet `exceljs` de 930 Ko** signalé par l'avertissement du build : il
  n'est chargé que lors d'un export, jamais au rendu d'une page.
- **Tâche longue de 74 ms sur `/espaces`** : sous le seuil où un utilisateur
  le perçoit.

## Résumé des changements proposés

| Fichier                               | Changement                                                  | Lignes |
| ------------------------------------- | ----------------------------------------------------------- | -----: |
| `web/vite.config.ts`                  | `pendingComponent` découpé avec `component`                 |      5 |
| `cmd/server/main.go`, `servirPanneau` | `Cache-Control` par type de chemin, 404 sur fichier inconnu |     ~8 |
| `internal/shared/socle/middleware.go` | en-tête `Cross-Origin-Opener-Policy: same-origin`           |      1 |
| `web/public/robots.txt`               | nouveau, `Disallow: /`                                      |      2 |
| `web/public/brand/*.webp`             | trois images ré-exportées                                   |      0 |
| `web/src`, cinq fichiers              | chemins et dimensions des trois images                      |      5 |

Aucune nouvelle dépendance, aucune abstraction, aucun écran touché.

## Ce que le constat ne corrige pas et pourquoi

- **La meta description** : un outil interne bloqué à l'indexation n'a rien à
  décrire à un moteur de recherche.
- **`llms.txt`** : il n'y a rien à exposer à un agent sur un CRM privé. Un 404
  est la réponse honnête.
- **HSTS `preload` et Trusted Types** : coût externe ou audit disproportionné
  pour un risque non mesuré.
- **Le regroupement des petits paquets d'icônes** en un paquet `vendor` :
  possible avec `advancedChunks` de Rolldown, mais à mesurer après le constat 1,
  pas avant. Il se peut que ce ne soit plus nécessaire.

## Application, le même jour

Les cinq changements ont été appliqués sur la branche `v2`. Un test
d'intégration `TestFichiersDuPanneau` couvre le nouveau comportement du
handler : `/robots.txt` en 200 avec `no-cache` et `Disallow: /`, une route du
panneau en 200 avec `no-cache`, `/llms.txt` et un fichier inconnu de
`/assets/` en 404, un fichier haché de `/assets/` avec `immutable`. Le test a
été exécuté contre l'ancien handler pour vérifier qu'il rougit, puis contre le
nouveau.

| Vérification                     | Résultat                                        |
| -------------------------------- | ----------------------------------------------- |
| `go build`, `go vet`             | sans erreur                                     |
| `golangci-lint`, paquets touchés | 0 problème                                      |
| `TestFichiersDuPanneau`          | rouge sur l'ancien handler, vert sur le nouveau |
| `tsc`, `oxlint`, `prettier`      | sans erreur                                     |
| `pnpm plafonds`                  | sans erreur                                     |
| `pnpm build` du panneau          | 38 `modulepreload`, aucun paquet de vue         |
| Poids des trois logos            | 238 Kio en PNG, 28 Kio en WebP                  |

## Prochaines étapes

1. Déployer sur `go-v2.cpi-chues.com`.
2. Relancer Lighthouse sur `/espaces` en navigation privée, sans extension.
3. Copier la ou les erreurs console affichées sur `/espaces` pour clore le
   point ouvert du constat 5.
