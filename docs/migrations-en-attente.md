# Migrations retenues, et ce qui les libère

Ce fichier ne contient que des migrations ÉCRITES, RELUES, et volontairement
tenues hors d'une version. Il n'est pas un carnet d'idées : ce qui est ici part
tel quel, dès que la condition nommée est remplie.

## Pourquoi retenir une migration plutôt que la fusionner

Une version qui n'AJOUTE que des tables et des colonnes se rembobine sans
toucher à la base : l'ancienne application ignore ce qu'elle ne connaît pas.
Une seule suppression change cette propriété pour la version entière. Le client
Prisma sélectionne ses colonnes NOMMÉMENT ; une colonne disparue n'est pas
ignorée par l'ancienne version, elle fait échouer sa requête. Revenir en arrière
exige alors de restaurer la base, c'est-à-dire de disposer d'une sauvegarde dont
la restauration a réellement été éprouvée.

Tant que cette épreuve n'a pas eu lieu, une suppression coûte le droit de
revenir en arrière. C'est cher pour de la donnée morte.

---

## 1. Suppression du sous-système de notifications push

**Retenue le 15 août 2026.** Écrite d'abord sous
`20260814090200_supprimer_jetons_appareil`, retirée de la version avant
publication.

### Ce qu'elle supprime

- la table `device_tokens` et le type `DevicePlatform` ;
- `notification_deliveries.deviceToken` ;
- `notifications.payload`.

### Pourquoi c'est justifié sur le fond

Firebase a quitté l'application mobile. Aucun client ne peut plus produire de
jeton d'enregistrement, les routes qui alimentaient la table sont parties, et
aucun code du dépôt ne lit ni n'écrit ces objets — ce qui se vérifie :

```bash
grep -rn "deviceToken\|DeviceToken\|DevicePlatform" apps/api/src packages/database/src
```

Cette commande ne doit rien rendre hors des tests. Si elle rend autre chose, la
migration n'est PAS prête : quelque chose s'est rebranché dessus.

### Pourquoi elle est retenue malgré tout

La version en production au moment de la rédaction (`e52b80d`) lit ces trois
objets. Les supprimer rend le retour arrière de l'application impossible sans
restauration préalable de la base. Or, sur cette installation, aucune
restauration n'a jamais été exécutée : la procédure de `infra/README.md` §4.3 a
été corrigée mais jamais éprouvée. Une sauvegarde non restaurée n'est pas une
sauvegarde, c'est un fichier.

### Condition exacte de libération

Les trois, dans cet ordre :

1. `deploy.py backup` a produit une archive, et `rclone ls` la montre dans le
   dépôt S3 ;
2. cette archive précise a été restaurée sur une base jetable, et le contrôle
   §4.3 de `infra/README.md` y est passé au vert avec `ON_ERROR_STOP=1` ;
3. la version qui contient le retrait de Firebase tourne en production depuis
   assez longtemps pour qu'un retour arrière ne soit plus envisagé.

### La migration, à recréer telle quelle

Répertoire : `packages/database/prisma/migrations/<horodatage>_supprimer_jetons_appareil/migration.sql`.
Elle part SEULE, sans autre changement dans la même version — c'est tout
l'intérêt de l'avoir sortie d'ici.

```sql
-- L'ORDRE COMPTE. Le type `DevicePlatform` n'est référencé que par
-- `device_tokens.platform` : PostgreSQL refuse le DROP TYPE tant que la colonne
-- existe, la table part donc en premier.

-- Les index et la clé étrangère vers `users` partent avec la table.
DROP TABLE "device_tokens";

DROP TYPE "DevicePlatform";

ALTER TABLE "notification_deliveries" DROP COLUMN "deviceToken";

ALTER TABLE "notifications" DROP COLUMN "payload";
```

Côté `schema.prisma`, retirer alors : le modèle `DeviceToken`, l'enum
`DevicePlatform`, la relation `User.deviceTokens`, `Notification.payload` et
`NotificationDelivery.deviceToken`. Retirer aussi `deviceToken` de la liste
`DEMO_MODELS` (`apps/api/src/prisma/demo-visibility.sweep.test.ts`), sans quoi
le test « la liste des modèles suit le schéma » rougit — c'est son rôle.
