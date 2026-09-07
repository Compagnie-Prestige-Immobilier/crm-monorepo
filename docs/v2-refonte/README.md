# Refonte v2

Dossier unique de la réécriture. Tout ce qui concerne la v2 vit ici ; rien
ailleurs dans `docs/`.

| Fichier | Contenu |
| --- | --- |
| `plan.md` | Arbitrages du propriétaire (7 et 8 septembre 2026), cible, phases, checklist de parité, runbook du jour J |
| `architecture.md` et `diagrammes/*.puml` | Sept diagrammes PlantUML C4, un par niveau : contexte, conteneurs, composants, déploiement, deux flux, calendrier de 15 jours ouvrés |
| `risques.md` | Registre des risques consolidé à partir des cinq audits, gravité, phase de traitement, état |
| `audits/api.md` | Inventaire des 233 routes, crons, variables, règles métier, contrat de sync |
| `audits/web.md` | Inventaire des 62 pages, formulaires, exports, tableaux de bord, 80 specs |
| `audits/mobile.md` | Inventaire des 26 écrans, tables Drift, moteur de sync, téléphonie native |
| `audits/donnees-infra.md` | Modèle Prisma, contraintes SQL hors schéma, migrations, infra, variables, Redis, prérequis PowerSync |
| `audits/critique-plan.md` | Critique adversariale de la version 1 du plan : erreurs, manques, risques, décisions |

## Où travailler

La v2 se construit dans un worktree séparé, jamais dans le clone principal :

```
git fetch origin
git worktree add ../crm-monorepo-v2 -b v2 origin/dev
cd ../crm-monorepo-v2 && pnpm install
```

Le clone principal reste sur `dev` ou `prod` pour les correctifs et la release
v1 de maintenance. Détail dans `plan.md` §0.

## Ordre de lecture

1. `plan.md` §2 pour les décisions, §7 pour les phases.
2. `architecture.md` pour voir la cible.
3. `risques.md` avant chaque revue de phase.
4. Les audits comme référence, par `chemin:ligne`, quand une règle métier doit
   être portée.

## Règle

Chaque affirmation technique de ce dossier renvoie à un fichier du dépôt ou à
une documentation officielle. Une affirmation sans preuve est marquée « à
prouver en phase 0 » et ne fonde aucune décision.
