-- ─────────────────────────────────────────────────────────────────────────────
-- Suppression du sous-système de notifications push.
--
-- POURQUOI SUPPRIMER PLUTÔT QUE LAISSER DORMIR.
--
-- Firebase a été retiré de l'application mobile. Il n'existe donc plus aucun
-- client capable de produire un jeton d'enregistrement, et les deux routes qui
-- alimentaient `device_tokens` (POST /devices/register et /devices/unregister)
-- n'avaient plus d'appelant, ni sur mobile ni sur le panel web. Une table dont
-- AUCUN écrivain ne peut plus exister n'est pas une réserve pour plus tard :
-- c'est une donnée périmée que les purges, les sauvegardes et les revues de
-- schéma continuent de porter, et qu'un lecteur du schéma prendra pour une
-- fonctionnalité vivante.
--
-- CE QUE CETTE MIGRATION N'EMPORTE PAS. Les notifications elles-mêmes, leurs
-- lignes de livraison, la boîte de réception et les gabarits restent intacts :
-- ce sont eux que le mobile interroge désormais, et le canal e-mail (Brevo)
-- continue de servir les téléconseillers.
--
-- COLONNES DEVENUES INÉCRIVABLES, supprimées pour la même raison :
--
--   · `notification_deliveries.device_token` ne citait qu'un jeton FCM. Sans
--     appareil enregistré, plus rien ne peut l'écrire ; la garder ferait
--     croire à une traçabilité par appareil qui n'existe plus.
--   · `notifications.payload` était accepté à la composition et relu par la
--     seule construction du message FCM. Il n'apparaît dans aucune réponse de
--     l'API et aucune interface ne le renseigne : c'était une colonne en
--     écriture seule.
--
-- L'ORDRE COMPTE. Le type énuméré `DevicePlatform` n'est référencé que par
-- `device_tokens.platform` : il ne peut être supprimé qu'après la table, sinon
-- PostgreSQL refuse le DROP TYPE parce qu'une colonne en dépend encore.
-- ─────────────────────────────────────────────────────────────────────────────

-- Les index et la clé étrangère vers `users` partent avec la table.
DROP TABLE "device_tokens";

DROP TYPE "DevicePlatform";

ALTER TABLE "notification_deliveries" DROP COLUMN "deviceToken";

ALTER TABLE "notifications" DROP COLUMN "payload";
