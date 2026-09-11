# Pôle déploiement dans le pilotage CHUES

Le Pôle déploiement est un onglet du pilotage CHUES, pas un écran de la coque
Admin. La coque se lit sur le premier segment de l'URL et porte la palette :
un onglet qui pointe vers `/admin/*` fait basculer la barre latérale en
bordeaux au milieu d'un parcours CHUES. Les onglets d'un même tableau de bord
restent donc sous `/chues/`.

Les plateformes d'enrôlement gardent `/admin/enrolement` : l'écran compare
CHUES et Grand Public, il n'appartient à aucun des deux, et les parcours
Playwright épinglent cette route.

## Ce que l'écran mesure

La question n'est pas l'avancement des appels mais ce que vaut la liste remise
par les représentants. Elle porte deux promesses, et une seule mesure chacune :
le représentant répond, et il apporte des prospects.

Le score de la base est la moyenne de ces deux parts. La joignabilité se compte
sur les seules fiches déjà appelées, une fiche jamais appelée ne disant rien de
sa valeur ; « joint » se lit sur l'effet du statut du référentiel, `REACHED`,
`REFUSED` ou `SCHEDULE_CALLBACK`. La productivité se compte sur toute la base,
un représentant qui a apporté des prospects l'ayant fait avec ou sans appel de
notre part. Sans aucune fiche appelée, il n'y a pas de score.

Les contrôles de format de numéro et de doublon ont été retirés le 11 septembre
2026 : ils mesuraient la saisie, pas la véracité, et ne disaient rien qu'un
appel réel ne dise mieux.

Les libellés viennent des listes de référence déjà affichées ailleurs : statuts
de qualification pour les issues, noms de champs du représentant pour la
complétude. Aucun libellé n'est réinventé ici.

Le graphique par département croise les deux promesses : barres des fiches
jointes et non jointes, courbe des prospects apportés sur sa propre échelle.
Les graphiques utilisent Nivo avec le thème du panneau (`useChartTheme`) et
respectent la préférence de mouvement réduit.

L'écran a son propre endpoint, `/api/v1/supervision/representants/qualite`. Le
stock servi à `/api/v1/supervision/representants` alimente le tableau de bord
CHUES et reste tel qu'il était.

## Les trois pôles dans la barre du tableau de bord

La barre du pilotage CHUES porte Pôle déploiement, Pôle enrôlement et Pôle
marketing, sur ordre du propriétaire du 11 septembre 2026. Les trois restent
sous `/chues/` : un onglet qui pointerait vers `/admin/*` ferait basculer la
palette de la coque au milieu du parcours.

`/chues/pole-enrolement` rend le même composant que `/admin/enrolement`, sans
copie de logique. La route Admin reste en place, les parcours Playwright
l'épinglent.

Le Pôle marketing lit la qualité des prospects amenés, par canal de provenance,
sur les deux projets confondus : un canal ne choisit pas le projet où sa fiche
atterrit. Son score suit la même règle que celui de la base représentants, la
conversion prenant la place des prospects apportés. Il a son propre endpoint,
`/api/v1/supervision/prospects/marketing`.

## Les listes de référence font foi

Le Pôle déploiement lit les statuts de qualification des représentants. « Joint »
est l'effet du statut : `REACHED`, `REFUSED` ou `SCHEDULE_CALLBACK`, c'est-à-dire
la section « Appel abouti » de la liste. L'anneau reprend les deux sections de
cette liste, plus les fiches qu'aucun appel n'a encore qualifiées.

Le Pôle marketing lit les motifs d'issue d'appel des prospects, qui sont une
AUTRE liste de référence : les prospects ne portent pas de statut de
qualification, seuls les représentants en portent. Le motif retenu est celui du
dernier appel consigné.

Aucun libellé n'est écrit dans le code. Une liste modifiée par l'administrateur
change les graphiques sans toucher au panneau.
