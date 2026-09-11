# Intégration des plateformes : pièces et webhook

Ce que l'intégrateur des plateformes doit savoir pour que le CRM reçoive les
pièces d'un dossier et soit prévenu dès qu'un dossier est complet.

## 1. Pièces déposées : rien à faire côté plateforme

Le CRM les récupère avec le jeton d'intégration déjà en place, par les routes
qui existent. Le personnel bancaire clique « Pièces déposées » et reçoit une archive. Le
bouton est sur l'écran des dossiers à ouvrir ET sur le dossier ouvert : la
banque doit pouvoir lire les justificatifs pour décider, pas seulement après
avoir décidé. L'archive s'adresse donc à l'inscription,
`GET /api/v1/bank-inscriptions/{id}/pieces.zip`.

CHUES : `GET /dossiers/{dossierId}/archive`. Le rôle `integration` porte
`view-dossiers` et `DossierPolicy::view` le nomme explicitement. L'identifiant
du dossier est celui que `GET /clients` renvoie dans `dossier.id`.

Grand Public : `GET /staff/clients/{clientId}/docs`, sous le préfixe `/staff`
comme le reste des routes du personnel. Le rôle `integration` passe `StaffAuth`
et porte `view-documents`. Chaque pièce y porte une `fileUrl` signée de courte
durée, sur un stockage privé. Le CRM télécharge ces URL et assemble
l'archive lui-même, la banque n'ayant pas à ouvrir un lien par document avant
son expiration.

Le jeton ne quitte jamais le serveur CRM. La banque télécharge depuis le CRM,
jamais depuis la plateforme.

## 2. Webhook : une route à appeler

Le CRM interroge encore les plateformes toutes les quelques minutes. Ce tirage
reste le filet de sécurité, mais il retarde l'alerte de la banque. Pour la
rendre immédiate, la plateforme appelle, dès qu'un dossier passe à l'état qui
le rend complet :

```
POST {CRM}/api/v1/webhooks/enrolement/{secret}/{projet}
```

`{projet}` vaut `chues` ou `grand-public`. `{secret}` est la valeur de
`PLATEFORME_WEBHOOK_SECRET`, transmise hors bande et jamais commise.

Le corps est ignoré : le CRM relit la plateforme, seule autorité sur l'état des
inscriptions. Envoyer un corps vide convient.

Réponses : `202` quand la relecture est lancée, `404` si le secret est faux, le
projet inconnu ou la plateforme non configurée. Un `404` ne distingue pas ces
trois cas, pour ne rien apprendre à qui essaie des secrets.

La plateforme n'a pas à réessayer ni à garder une file. Un appel perdu coûte au
pire le délai du tirage suivant, et un appel de trop ne coûte rien : une
relecture déjà en cours est ignorée.

## Ce qui existait déjà

Le courriel de dossier complet porte son lien d'ouverture directe, sous le
libellé « Ouvrir le dossier bancaire dans CPI GO », et nomme le téléconseiller
qui a suivi le prospect. Le nom se lit aussi sur la fiche du dossier, sur sa
carte du Kanban et sur l'écran des dossiers à ouvrir.
