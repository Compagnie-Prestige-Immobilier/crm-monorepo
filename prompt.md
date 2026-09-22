# Guide de déploiement Dokploy : CRM & Kairos (avec JEV AI Classifier)

Ce document s'adresse à l'assistant IA ou à l'opérateur chargé du déploiement et de la configuration de production dans Dokploy.

---

## 1. Synthèse des modifications apportées

L'agent IA classificateur **JEV** a été intégré nativement au moteur d'ingénierie **Kairos** (`ticket-solver`) pour remplacer les heuristiques manuelles et fluidifier le traitement des tickets GLPI :

1. **Client JEV HTTP (`ticket-solver/internal/classifier/classifier.go`)** :
   - Client HTTP avec authentification Bearer token, timeout de 5 secondes, gestion d'erreurs et fallback automatique vers les règles locales en cas d'indisponibilité.
   - Normalisation des catégories (`CODE_DEFECT`, `INSUFFICIENT_INFO`, `ACCESS_CREDENTIALS`, `FUNCTIONAL_HOWTO`, `FEATURE_REQUEST`) et niveaux de complexité (`basse`, `moyenne`, `haute`, `complexe`).
   - Pré-qualification amont sans clonage de code pour les demandes d'accès, questions d'usage et tickets imprécis (avec passage en attente dans GLPI et réponse automatique cordiale).
   - Diagnostic intelligent des échecs de vérification (`DiagnostiquerEchec`) pour aiguiller l'agent lors des corrections automatiques (`LINTER`, `TYPAGE_COMPILATION`, `TEST_REGRESSION`, `TIMEOUT`).
   - Détection des tickets sans marqueur `[crm]` (`ClassifyProject`) afin de déterminer si le ticket cible le projet sans l'ignorer par erreur.

2. **Routage dynamique de complexité (`ticket-solver/internal/solver/solver.go`)** :
   - Les escalades et notifications exploitent la complexité évaluée par JEV pour router vers les bons développeurs (`config.Routes` : Mahdi pour basse/moyenne, Beni pour haute, Cheikh & Beni pour complexe) au lieu d'imposer systématiquement le niveau "complexe".

3. **Traçabilité et stockage SQLite (`ticket-solver/internal/state/state.go`)** :
   - Ajout des colonnes `jev_categorie` et `jev_confiance` dans la table `kairo_jobs`.
   - Remontée des métadonnées dans l'API de statut `/etat` et `jevActif: bool`.

4. **Interface d'administration CRM (`web/src/routes/_panneau/admin/kairo.tsx`, `carte-tickets.tsx`, `dialog-detail-ticket.tsx`)** :
   - Avatar officiel de Kairo (`/brand/kairo.png`) avec son nom et une couronne (`CrownIcon`).
   - Tag bleu `JEV` dans le bandeau d'état lorsque le classificateur est actif.
   - Pastilles JEV avec indice de confiance (`JEV · 95%`) sur chaque ticket qualifié.
   - Détails de qualification JEV consultables et copiables dans la modal de détail.

5. **Sélection dynamique du modèle IA (`haiku`, `sonnet`, `opus`)** :
   - Selon la complexité et l'analyse de la tâche par JEV, l'agent choisit le modèle adapté :
     - `haiku` : tâches simples, triviales ou de basse complexité.
     - `sonnet` : tâches moyennes et travail standard (équilibre rapidité/précision).
     - `opus` : tâches de haute complexité ou complexes (modifications transverses, architecture).
   - En cas d'indisponibilité, d'erreur ou d'absence de JEV, fallback automatique et transparent sur `sonnet`.

6. **Mémoire des tickets & Clôture automatique des tickets GLPI oubliés** :
   - Kairo mémorise l'historique des tickets traités et vérifie avant tout appel LLM si le ticket a déjà été résolu pour ne pas gaspiller de tokens :
     - **Mémoire interne & Doublons récents (60 jours)** : si le ticket a déjà été traité avec succès ou duplique un ticket résolu, Kairo associe la solution, clôture automatiquement le ticket dans GLPI (`status: 5`) et termine en 0 token.
     - **Détection des Pull Requests déjà fusionnées sur GitHub** : si une PR liée au ticket a déjà été mergée sur la branche cible mais que le ticket est resté ouvert dans GLPI, Kairo notifie le lien de la PR et ferme le ticket GLPI.
     - **Détection des commits existants dans le code** : si un développeur a déjà poussé un commit corrigeant l'anomalie (mention du ticket `#ID`, `ticket ID`, `glpi ID` ou correspondance du titre dans les 50 derniers commits) sans fermer GLPI, Kairo repère le commit, poste un message explicatif avec le SHA du commit et résout le ticket dans GLPI.

---

## 2. Secrets et variables d'environnement à configurer dans Dokploy

Dans l'interface **Dokploy**, configurer les variables d'environnement suivantes pour les services respectifs :

### A. Service Kairos (`ticket-solver`)

| Variable                    | Description                                     | Valeur / Exemple                                                                                               |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `JEV_API_KEY`               | **Clé API du classificateur JEV (OBLIGATOIRE)** | `REDACTED` |
| `JEV_URL`                   | Endpoint de l'API de classification JEV         | `https://api.jev.ai/v1/classify` (défaut)                                                                      |
| `GLPI_URL`                  | URL de l'instance GLPI CPI                      | `https://support.cpi.sn`                                                                                       |
| `GLPI_APP_TOKEN`            | Token d'application GLPI                        | _(Jeton GLPI de production)_                                                                                   |
| `GLPI_USER_TOKEN`           | Token d'utilisateur GLPI                        | _(Jeton utilisateur Kairo)_                                                                                    |
| `GIT_TOKEN`                 | Jeton GitHub pour Kairo (clone / PR)            | _(GitHub Personal Access Token)_                                                                               |
| `KAIRO_ADMIN_TOKEN`         | Jeton secret pour l'API admin interne           | _(Généré aléatoirement, partagé avec le CRM)_                                                                  |
| `KAIRO_PORT`                | Port d'écoute HTTP interne de Kairo             | `8090`                                                                                                         |
| `CLAUDE_CODE_OAUTH_TOKEN_0` | Jeton Claude Code principal                     | _(Jeton OAuth Anthropic)_                                                                                      |
| `CLAUDE_CODE_OAUTH_TOKEN_1` | Jeton Claude Code secours                       | _(Jeton OAuth Anthropic)_                                                                                      |
| `CODEX_ACCESS_TOKEN`        | Jeton OpenAI Codex de secours                   | _(Optionnel)_                                                                                                  |
| `BREVO_API_KEY`             | Clé API Brevo pour les notifications e-mail     | _(Clé API Brevo)_                                                                                              |

### B. Service CRM (`crm-monorepo`)

| Variable            | Description                               | Valeur / Exemple                                        |
| ------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `KAIRO_URL`         | URL interne d'accès au service Kairos     | `http://kairo:8090` (ou URL de service interne Dokploy) |
| `KAIRO_ADMIN_TOKEN` | Jeton d'administration partagé avec Kairo | _(Même valeur que dans Kairos)_                         |
| `DATABASE_URL`      | Chaîne de connexion PostgreSQL            | `postgres://...`                                        |
| `SESSION_SECRET`    | Secret de chiffrement des sessions        | _(Secret de production)_                                |
| `PORT`              | Port d'écoute du serveur CRM              | `8080`                                                  |

---

## 3. Procédure de déploiement dans Dokploy

Pour déployer les deux applications sur l'infrastructure Dokploy :

### Étape 1 : Mettre à jour les variables d'environnement dans Dokploy

1. Accéder au dashboard Dokploy du projet CRM.
2. Aller dans les paramètres de l'application **Kairos** -> **Environment Variables**.
3. Définir :
   ```env
   JEV_API_KEY=REDACTED
   JEV_URL=https://api.jev.ai/v1/classify
   ```
4. Sauvegarder les variables d'environnement.

### Étape 2 : Déployer le service Kairos

1. Dans Dokploy, déclencher le redéploiement de l'application **Kairos** (`ticket-solver`).
2. Vérifier les logs de démarrage dans Dokploy :
   - S'assurer de l'absence d'erreurs de migration SQLite.
   - Vérifier que le port d'écoute HTTP est actif.

### Étape 3 : Déployer le service CRM

1. Déclencher le redéploiement de l'application principale **CRM**.
2. Dokploy compile le binaire Go (`cmd/server`) incluant la SPA React embarquée (`web/`).
3. Vérifier les logs du serveur :
   - `[INFO] serveur écoute sur :8080`
   - Migrations Goose exécutées avec succès si nécessaire.

---

## 4. Vérification post-déploiement

Une fois le déploiement terminé, effectuer les contrôles de validation suivants :

1. **Sonde de santé Kairo** :

   ```bash
   curl -s http://<kairo-host>:8090/healthz
   # Doit répondre : {"status":"ok"}
   ```

2. **Endpoint d'état interne Kairo** :

   ```bash
   curl -s -H "Authorization: Bearer <KAIRO_ADMIN_TOKEN>" http://<kairo-host>:8090/etat
   # Vérifier que "jevActif": true est présent dans le JSON
   ```

3. **Panneau CRM Administrateur** :
   - Se connecter à l'interface d'administration CRM sur `https://<crm-domain>/_panneau/admin/kairo`.
   - Vérifier la présence :
     - Du logo de Kairo (avatar rond) à côté de son nom avec la couronne dorée.
     - Du badge bleu **JEV** confirmant que le classificateur est actif et opérationnel.
     - Des métriques en temps réel et de la liste des tickets qualifiés avec leur score de confiance.
