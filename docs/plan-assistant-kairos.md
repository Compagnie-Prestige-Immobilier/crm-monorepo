# CRM : interface personnalisée de l'assistant Kairos

27 septembre 2026. Plan, pas implémentation livrée.

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
