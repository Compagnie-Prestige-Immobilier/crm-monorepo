# Architecture v2 : diagrammes

Un diagramme par niveau, un fichier par diagramme, dans `diagrammes/`. Langage
PlantUML avec la bibliothèque C4, parce que C4 sépare par construction ce que
Mermaid mélangeait : le contexte (qui parle à quoi), les conteneurs (les
briques déployables), les composants (le rangement du code), le déploiement
(où tourne chaque brique). Les diagrammes de flux sont des diagrammes de
séquence, le calendrier un Gantt. Chaque diagramme tient sur une page large
(`LAYOUT_LEFT_RIGHT`) et ne porte que ce qu'il faut pour être lu en une fois ;
le détail est dans `plan.md` et les audits.

| Fichier | Type | Répond à |
| --- | --- | --- |
| `diagrammes/01-contexte.puml` | C4 niveau 1 | Qui utilise le système, avec quels services externes |
| `diagrammes/02-conteneurs.puml` | C4 niveau 2 | Les quatre briques : mobile, apps/go, powersync-service, Postgres |
| `diagrammes/03-composants-go.puml` | C4 niveau 3 | Comment le code de `apps/go` est rangé |
| `diagrammes/04-deploiement.puml` | C4 déploiement | Où tourne chaque brique : Cloudflare, VPS Dokploy, volumes, S3 |
| `diagrammes/05-flux-ecriture.puml` | Séquence | Une saisie hors ligne remonte et reçoit un verdict |
| `diagrammes/06-flux-auth.puml` | Séquence | Connexion mobile, JWT PowerSync |
| `diagrammes/07-calendrier.puml` | Gantt | 20 jours ouvrés, du 14 septembre au 9 octobre 2026 |

## Rendre les diagrammes

VS Code : extension « PlantUML » (jebbs), `Alt+D` sur un fichier `.puml`.

En ligne de commande, sans installation locale :

```
docker run --rm -v "$PWD/docs/v2-refonte/diagrammes:/work" -w /work plantuml/plantuml -tsvg "*.puml"
```

Les SVG sont produits à côté des sources et ne sont pas commités.

## Lecture

1. `01-contexte` : trois personnes, un système, trois services externes.
2. `02-conteneurs` : le mobile écrit vers `apps/go` et lit depuis
   `powersync-service` ; les deux s'appuient sur le même Postgres.
3. `03-composants-go` : un binaire Go, un fichier par domaine métier, trois
   fichiers transverses (`auth.go`, `roles.go`, `sync.go`), le SQL compilé par
   sqlc et la SPA embarquée.
4. `04-deploiement` : deux applications Dokploy (`cpi-go`, `cpi-go-sync`), un
   Postgres, quatre volumes, une sauvegarde S3, trois noms d'hôte derrière
   Cloudflare.
5. `05-flux-ecriture` : la règle centrale de la v2, le serveur répond toujours
   200 et le refus est un verdict synchronisé.
6. `06-flux-auth` : session de 30 jours, JWT d'une heure pour PowerSync.
7. `07-calendrier` : les huit phases, en jours.
