# Le journal de la fiche

Le 15 septembre 2026, le propriétaire a demandé que toute fiche prospect, CHUES ou Grand Public, montre tout ce qui lui est arrivé, y compris chaque changement de statut, lisible par quelqu'un qui ne connaît pas la base.

Le journal est `audit_logs`, qui existait déjà. Chaque écriture sur une fiche y laisse une ligne avec l'avant et l'après : modification par le panneau (`prospect.update`), mise à jour par le classeur des leads (`prospect.import`), changement de statut par un appel (`prospect.statut`, « Nouveau → Contacté » au premier appel, « → Perdu » sur « À supprimer », avec le motif), correction de date (`prospect.date_corrigee`), sortie de campagne (`lot_export.plateforme`, `lot_export.hors_projet`), transfert d'un rappel promis (`rappel.reattribue`), réaffectation, segment, consentement, fusion, suppression. Une ligne sans auteur est signée « CPI GO » : une migration ou une tâche a écrit seule.

Un seul point d'accès, `GET /api/v1/prospects/{id}/journal`, rend les lignes de la fiche et celles des campagnes et rappels qui la nomment, du plus récent au plus ancien, sous la même portée que la fiche elle-même.

L'écran : la carte « Histoire de la fiche », la même sur la fiche CHUES et la fiche Grand Public (`web/src/components/prospects/histoire-fiche.tsx`), mêle appels, bascules et lignes du journal. Une ligne du journal se lit en une phrase, « Statut : Nouveau → Contacté », avec qui et quand ; le volet montre chaque champ changé, avant et après, avec des libellés en français et des dates lisibles (`journal-fiche.tsx`). Trois onglets, Appels, Statut, Fiche, filtrent sans rien cacher d'autre.

Hors périmètre : reconstituer la fiche « telle qu'elle était » à une date donnée, qui se lit ligne à ligne dans le journal.
