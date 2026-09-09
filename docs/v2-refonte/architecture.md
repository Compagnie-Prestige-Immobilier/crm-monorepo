# Architecture v2 : diagrammes

Un diagramme par niveau, un fichier par diagramme, dans `diagrammes/`. Langage
PlantUML avec la bibliothèque C4, parce que C4 sépare par construction ce que
Mermaid mélangeait : le contexte (qui parle à quoi), les conteneurs (les
briques déployables), les composants (le rangement du code), le déploiement
(où tourne chaque brique). Le calendrier est un Gantt. Chaque diagramme tient
sur une page large (`LAYOUT_LEFT_RIGHT`) et ne porte que ce qu'il faut pour
être lu en une fois ; le détail est dans `plan.md` et les audits.

| Fichier                            | Type           | Répond à                                                       |
| ---------------------------------- | -------------- | -------------------------------------------------------------- |
| `diagrammes/01-contexte.puml`      | C4 niveau 1    | Qui utilise le système, avec quels services externes           |
| `diagrammes/02-conteneurs.puml`    | C4 niveau 2    | Les deux briques : apps/go, Postgres                           |
| `diagrammes/03-composants-go.puml` | C4 niveau 3    | Comment le code de `apps/go` est rangé                         |
| `diagrammes/04-deploiement.puml`   | C4 déploiement | Où tourne chaque brique : Cloudflare, VPS Dokploy, volumes, S3 |
| `diagrammes/07-calendrier.puml`    | Gantt          | 16 jours ouvrés, du 14 septembre au 5 octobre 2026             |

Les diagrammes 05 et 06 (flux d'écriture hors ligne, flux JWT PowerSync) ont
été retirés avec le mobile : une écriture v2 est une requête HTTP ordinaire.

## Rendre les diagrammes

VS Code : extension « PlantUML » (jebbs), `Alt+D` sur un fichier `.puml`.

En ligne de commande, sans installation locale :

```
docker run --rm -v "$PWD/docs/v2-refonte/diagrammes:/work" -w /work plantuml/plantuml -tsvg "*.puml"
```

Les SVG sont produits à côté des sources et ne sont pas commités.

## Lecture

1. `01-contexte` : trois personnes, un système, trois services externes. Le
   téléconseiller y est sur téléphone, en navigateur.
2. `02-conteneurs` : un binaire et un Postgres.
3. `03-composants-go` : un package Go de vingt fichiers, six transverses
   (`main`, `middleware`, `errors`, `cache`, `auth`, `roles`), un par
   domaine métier, le SQL compilé par sqlc et la SPA embarquée.
4. `04-deploiement` : une application Dokploy (`cpi-go`), un Postgres, quatre
   volumes, une sauvegarde S3, deux noms d'hôte derrière Cloudflare.
5. `07-calendrier` : les huit phases, en jours.
