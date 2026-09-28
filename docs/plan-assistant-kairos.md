# CRM : interface personnalisée de l'assistant Kairos

28 septembre 2026. Implémentation en cours de réception ; mise en production à vérifier.

Le contrat et la matrice de parité ont une source unique dans le dépôt Kairos :
[`docs/plan-parite-assistant-sdk.md`](../../kairo/docs/plan-parite-assistant-sdk.md).
Ce chemin suppose les deux dépôts voisins ; dans une distribution séparée,
consulter ce fichier dans le dépôt Kairos à la version de SDK retenue.

## Décision

Le CRM garde son interface, ses tableaux, ses graphiques Nivo, ses exports,
ses questions enregistrées/épinglées et ses permissions. Il devient un client
complet de Kairos au même titre que les widgets officiels. Le choix d'une UI
personnalisée ne doit plus faire perdre streaming, arrêt, historique, actions,
contexte, transmission, capture, voix ou feedback lorsqu'ils sont disponibles.

## Changements prévus

1. Remplacer le chemin conversationnel JSON de `conversation.tsx` et
   `poserQuestion` par le client Kairos sans UI et un adaptateur progressif
   `assistant-ui`. Utiliser le contrat de conversation, pas découper le JSON
   de `/v1/sdk/taches` pour simuler une réponse progressive.
2. Ajouter un relais SSE dans le service assistant Go, même origine/session,
   avec identité espace/application signée côté serveur, flush, annulation,
   reprise et erreurs normalisées. Aucun accès direct requis au réseau Dokploy.
3. Exposer à Kairos les outils métier déjà implémentés dans `internal/assistant`.
   Conserver leur SQL contrôlé, leurs limites et permissions dans le CRM.
   Un résultat validé devient un bloc structuré du contrat partagé.
4. Adapter `reponse-assistant.tsx` aux blocs génériques et aux extensions CRM ;
   conserver calculs, Nivo, liens, exports, filtres, sauvegarde et épinglage.
   L'UI fournit les rendus, pas un autre moteur de conversation.
5. Ajouter arrêt, reprise, nouvelle conversation/historique et suggestions ;
   brancher actions, feedback, navigation/repères et visites via les modules
   communs. Aucun geste ne contourne les contrôles métier côté serveur.
6. Intégrer voix/capture/transfert humain et les vues optionnelles autorisées
   des règles/traitements. Capacités détectées, états d'absence explicites,
   permissions utilisateur respectées. Pas de stockage hors ligne ajouté.
7. Retirer le chemin conversationnel redondant après bascule. Garder le client
   de tâches pour les usages non conversationnels (résumés, reformulation),
   en réutilisant les erreurs, identités et limites communes.

## Réception

- Le premier fragment d'une réponse lente s'affiche avant sa fin ; arrêter ne
  laisse pas l'interface bloquée et une reconnexion ne duplique pas les effets.
- Le même utilisateur peut effectuer chaque scénario autorisé de la matrice
  officielle depuis l'UI CRM, sans charger le widget Kairos.
- Les résultats, filtres, droits, exports et questions sauvegardées restent
  identiques aux parcours actuels. Une action inconnue a un repli sûr.
- Vérifier côté serveur et en Playwright contre PostgreSQL, puis les CI des deux
  dépôts ; aucun test unitaire CRM et aucun changement de workers.
- Déployer d'abord un Kairos compatible, puis le CRM ; vérifier la page réelle,
  le flux, les données métier, l'arrêt/reprise et la transmission. Ne pas déclarer
  la parité sur la seule base d'un HTTP 200 ou d'une bulle visible.

L'exécution suit les six étapes du plan Kairos. La portée concerne l'assistant,
pas une nouvelle refonte du CRM ou un remplacement de son design.

## Contrat du client personnalisé

La bulle charge les modules partagés `client.js` et `browser.js` au travers du
relais authentifié du CRM. Le protocole durable v1 conserve la clé de requête et
le curseur de reprise ; Stop appelle l’annulation explicite du tour. Une coupure
réseau ne devient pas une seconde question. Après rechargement, l’historique
permet de rouvrir la conversation et de reprendre son tour encore actif.

Les actions proposées montrent leurs valeurs avant confirmation ; leurs états
sont relus par Kairos. Les gestes et visites utilisent le module navigateur
partagé. Une capture se vérifie et se masque avant le consentement au transfert.
Les règles, tâches et journaux appartiennent à l’identité signée, sans jeton
administrateur dans le navigateur. Les sorties de tâches restent consultables.

Les options affichent les capacités et les raisons d’indisponibilité. La voix
reste désactivée dans le CRM. Une application sans outil d’écriture ne propose
pas de confirmation métier ; aucune écriture CRM n’est inventée pour cette UI.

## Vérification reproductible

Les tests Go `TestAssistantRelaisPersonnel` et
`TestAssistantFluxProgressifEtAnnulation` vérifient méthodes, chemins, identité
signée, protocole et curseur avec une vraie session PostgreSQL. Retirer le
curseur fait échouer le second test.

`e2e/assistant.spec.ts` couvre l’indisponibilité, les questions épinglées et les
permissions. `e2e/assistant-kairos.spec.ts` s’active avec `KAIROS_E2E_PARITE=1`
et un serveur Kairos de parcours PostgreSQL configuré dans l’environnement du
serveur CRM. Il vérifie les résultats structurés, l’historique, les capacités
et les tâches via les deux serveurs réels. Le serveur de parcours Kairos fournit
un modèle déterministe ; aucun secret de production n’est nécessaire.
