# QA adversariale de CPI GO (mobile)

Campagne du 30 août 2026, sur le commit `e8baacd` avec l'arbre de travail modifié (retrait des campagnes, migration ForUI en cours). Cinq testeurs en compétition, chacun sur un domaine, avec preuve obligatoire pour chaque défaut ; les rapports ont été contre-vérifiés par sondage sur le code (aucune affirmation sondée n'était fausse).

| Rapport                                    | Domaine                                                           | Défauts | Dont bloquants / majeurs | Méthode                        |
| ------------------------------------------ | ----------------------------------------------------------------- | ------- | ------------------------ | ------------------------------ |
| [securite-session.md](securite-session.md) | authentification, session, mise à jour, permissions, stockage     | 11      | 1 / 4                    | lecture + HTTP réel            |
| [synchronisation.md](synchronisation.md)   | sync, hors ligne, base locale, idempotence, tombstones            | 7       | 1 / 6                    | tests Flutter + HTTP réel      |
| [formulaires.md](formulaires.md)           | validations, brouillons, anti-double-envoi, écarts client/serveur | 9       | 0 / 4                    | tests Flutter + HTTP réel      |
| [navigation-ui.md](navigation-ui.md)       | navigation, états, accessibilité, responsive, textes              | 19      | 0 / 7                    | lecture (5 cosmétiques)        |
| [emulateur.md](emulateur.md)               | boîte noire sur émulateur (13 parcours non couverts, listés)      | 8       | 1 / 2                    | émulateur Android, build debug |

## À corriger en premier

0. **EMU-01** : un prospect saisi avec un numéro à préfixe inconnu est promis « Il sera enregistré. », refusé par le serveur (`PHONE_INVALID`), puis impossible à corriger (« Réessayer » rejoue la même requête, la fiche n'offre pas de modification du numéro) ; l'accueil le compte quand même et la conversion en 5 étapes se déroule sur cette fiche condamnée, produisant une seconde saisie bloquée. Voir aussi EMU-02 (écran « Enregistré » sans sortie) et EMU-03 (chaque frappe bloque le fil principal, mesuré en debug : à confirmer en `--profile`).
1. **SEC-01 / SYN-02** : la déconnexion ne purge ni la base locale ni le curseur de synchronisation. Les fiches d'un commercial restent lisibles par le suivant, sa file part sous son nom, et le suivant reçoit zéro fiche au tirage.
2. **SYN-01** : un renvoi partiel d'un lot rejoue la clé d'idempotence avec un autre contenu ; l'API répond 422 et tout le lot passe en échec définitif, que « Réessayer » ne débloque pas. Aggravé par FOR-01 : le serveur ne préfixe pas ses erreurs par opération, donc une seule saisie fautive condamne le lot.
3. **SEC-03** : un build release sans `key.properties` est signé avec la clé de debug publique.
4. **SEC-04** : une réponse de renouvellement perdue après rotation révoque toute la famille de jetons ; déconnexion forcée en plein terrain.
5. **UI-03 / UI-07** : l'accueil Grand Public affiche « 0 appel du jour » en dur ; les étapes CHUES comptent tout au lieu du reste à faire.
6. **FOR-04 / FOR-05 / FOR-02 / FOR-01** : le client accepte ce que le serveur refuse (téléphone collé avec indicatif, e-mail à domaine d'une lettre, ancienneté hors bornes, nom de plus de 120 caractères).

## Tests de preuve

`apps/mobile/test/qa/` : `qa_form_prospect_test.dart`, `qa_form_phase2_test.dart` (verts, ils constatent l'état actuel) et `qa_sync_preuves.dart` (affirme le comportement attendu : 8 tests sur 11 échouent tant que SYN-01 à SYN-07 sont ouverts ; hors de la découverte de `flutter test` à dessein, se lance par `fvm flutter test test/qa/qa_sync_preuves.dart`). Scripts HTTP : `syn01.sh`, `syn02.sh` (mot de passe des comptes de recette lu dans `SEED_FIXTURE_PASSWORD`).

## Classement

Compte tenu des seuls défauts réels et prouvés, pondérés par leur gravité :

1. **Synchronisation** : 1 bloquant, 6 majeurs, tous prouvés par des tests exécutables et deux scripts HTTP rejouables.
2. **Sécurité et session** : 1 bloquant, 4 majeurs, vérifications HTTP en direct ; le bloquant est le même défaut de fond que SYN-02.
3. **Émulateur** : 1 bloquant, 2 majeurs, en conditions réelles, mais 13 parcours non couverts et une mesure de performance en debug.
4. **Formulaires** : 4 majeurs, tous prouvés par test et HTTP.
5. **Navigation et UI** : 19 constats, 7 majeurs, mais 5 cosmétiques et 2 « à confirmer par test ».

Aucune affirmation sondée n'était fausse ; un candidat de l'émulateur (teinte CHUES) a été écarté par le testeur lui-même. Gagnant : synchronisation.
