# Refonte v2

Dossier unique de la réécriture. Tout ce qui concerne la v2 vit ici ; rien
ailleurs dans `docs/`.

| Fichier | Contenu |
| --- | --- |
| `plan.md` | Arbitrages du propriétaire (7 et 8 septembre 2026), cible, phases, checklist de parité, runbook du jour J |
| `architecture.md` et `diagrammes/*.puml` | Cinq diagrammes PlantUML C4 : contexte, conteneurs, composants, déploiement, calendrier de 16 jours ouvrés |
| `risques.md` | Registre des risques, gravité, phase de traitement, état |
| `unifier-le-contrat-openapi.md` | Tâche à faire : supprimer le contrat v1 figé et typer le panneau depuis l'OpenAPI du Go. Procédure pas à pas, pièges, critères de fin |
| `audits/api.md` | Inventaire des 233 routes, crons, variables, règles métier, contrat de sync |
| `audits/web.md` | Inventaire des 62 pages, formulaires, exports, tableaux de bord, 80 specs |
| `audits/mobile.md` | Inventaire des 26 écrans, tables Drift, moteur de sync, téléphonie native. Historique : le mobile est abandonné (`plan.md` §2.2) |
| `audits/donnees-infra.md` | Modèle Prisma, contraintes SQL hors schéma, migrations, infra, variables, Redis |
| `audits/critique-plan.md` | Critique adversariale de la version 1 du plan : erreurs, manques, risques, décisions |
| `audits/go-api.md` | Portage API vers Go : tri des 234 routes, invariants en pgx, remplaçants des mécanismes Node, notes vocales, contrat d'erreur, estimation par fichier |
| `audits/go-web.md` | Panneau vers SPA : relais Next, chargement, écrans téléconseiller à 390 px, `MediaRecorder`, formulaires, 82 specs vers 16 parcours |
| `audits/go-donnees.md` | Prisma vers sqlc : 79 requêtes brutes classées, types, schéma de référence, tables mortes, transactions, pool, goose |
| `audits/go-securite.md` | Session et CSRF, `roles.go`, entrées, en-têtes, secrets, image, CI, observabilité, structure du package |

Les audits décrivent la v1 et citent la cible Node et PowerSync de la version
1 du plan. Seul `plan.md` fait foi pour la cible.

## Où travailler

À la racine du dépôt : la v1 a été purgée le 9 septembre 2026, `make setup &&
make build` suffit. Détail dans `plan.md` §0.

## Ordre de lecture

1. `plan.md` §2 pour les décisions, §5 pour les phases.
2. `architecture.md` pour voir la cible.
3. `risques.md` avant chaque revue de phase.
4. Les audits comme référence, par `chemin:ligne`, quand une règle métier doit
   être portée.

## Règle

Chaque affirmation technique de ce dossier renvoie à un fichier du dépôt ou à
une documentation officielle. Une affirmation sans preuve est marquée « à
prouver en phase 0 » et ne fonde aucune décision.
