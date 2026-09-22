# Kairo, assistant de la DSI

Service Dokploy qui traite les tickets GLPI de développement.

## Parcours d'un ticket

1. Toutes les `POLL_INTERVAL_SECONDS`, Kairo lit les tickets « Nouveau » et
   « En cours » de la catégorie de chaque projet de `PROJECTS_JSON`
   (sous-catégories comprises) ou sans catégorie, qui contiennent un des
   `markers` (liste vide : tous).
2. Il s'ajoute aux techniciens assignés, même si quelqu'un l'est déjà, passe
   le ticket « En cours », lui donne la catégorie du projet s'il n'en a pas, et
   le dit au demandeur. Il agit avec l'utilisateur GLPI `kairo` (profil
   Supervisor).
3. Il clone la branche de base, vérifie qu'elle est verte, puis confie le
   ticket à Claude (principal, secours) puis à Codex. Chaque agent répond au
   schéma JSON `SCHEMA` : `resolu` ou `escalade`, et un niveau `basse`,
   `moyenne`, `haute` ou `complexe`.
4. Si la vérification du projet passe, le correctif est rejoué dans un clone
   propre, commité par `Kairo <kairo@cpi.sn>`, poussé sur `kairo/glpi-<id>`, et
   une PR est ouverte. Rien n'est fusionné ni déployé.
5. Le demandeur reçoit un suivi GLPI ; l'équipe reçoit un mail Brevo :
   `basse`/`moyenne` à Mahdi, `haute` à Beni, `complexe` à Cheikh et Beni.

Un échec technique est retenté trois fois, à quinze minutes d'intervalle, puis
signalé à Cheikh et Beni.

## Sécurité

- Le texte du ticket est une donnée non fiable. Les agents et la vérification
  tournent sans aucun secret du service dans leur environnement.
- Claude n'a que les outils de `CLAUDE_TOOLS` ; Codex tourne dans son bac à
  sable `workspace-write`.
- Le correctif est refusé s'il touche un chemin de `protected_paths` ou
  contient la valeur d'un secret du service.
- GitHub passe par l'App `kairo-cpi` (`GITHUB_APP_ID`,
  `GITHUB_APP_PRIVATE_KEY`) : un jeton d'installation d'une heure, limité au
  dépôt et à `contents` + `pull_requests`, sert au clone et au push depuis un
  dépôt que l'agent n'a jamais touché, hooks désactivés. Les PR sont ouvertes
  par `kairo-cpi[bot]`. Sans App, `GIT_TOKEN` est utilisé.

## Exploitation

```
docker build -t kairo ticket-solver
docker run --env-file ticket-solver/.env -v kairo-work:/work kairo python -m app.main doctor
```

Monter un volume sur `/work` (état SQLite, caches Go et pnpm). `GET /healthz`
répond 503 si GLPI n'a pas été lu depuis cinq minutes. Les variables sont
décrites dans `.env.example` ; les secrets viennent de Dokploy, jamais de
l'image.
