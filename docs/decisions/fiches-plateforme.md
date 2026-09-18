# Les inscrits des plateformes ne sont plus des fiches du CRM

Décision du propriétaire, 18 septembre 2026. Le traitement et la répartition des
inscrits de monespace.cpi-chues.com et monespace.cpi.sn se font sur ces
plateformes. Le CRM n'en tient plus de fiche, ne les attribue à personne et n'a
plus de rôle pour les appeler.

## Ce qui a disparu

Le rôle `CCP`, « chargé de clientèle plateforme », et les trois permissions
`plateforme.voir`, `plateforme.saisir` et `plateforme.equipe`. Les écrans
« Mon travail » et « Aperçu plateforme », l'objectif d'appels par jour, le
tableau de suivi par CCP. La notification matinale des fiches arrivées et
l'alerte de renfort au-delà d'un seuil, avec son réglage. La colonne
`prospects."plateformeDepuis"` et tout ce qui la lisait : bornes de lecture et
de saisie, filtre `plateforme` de la liste des prospects, tri par date
d'inscription, colonne « Inscrit le » et étoile d'inscription de la console,
clause d'export, colonne « Passées plateforme » du rapport des leads importés.

Les 200 fiches portant la marque ont été supprimées définitivement, avec leurs
appels, rappels promis et lignes de campagne (migration
`20260917260200_fiches_plateforme_purgees.sql`). Le journal d'audit en garde
l'identité, ligne `prospect.purge_plateforme`. Les comptes CCP sont désactivés
et rattachés au rôle `CHARGE_CLIENTELE` ; la valeur `'CCP'` reste dans l'enum
Postgres `"Role"`, orpheline, PostgreSQL ne sachant pas la retirer.

## Ce que le CRM fait encore

Le relevé d'enrôlement lit les deux plateformes comme avant et dépose chaque
inscription dans `inscriptions_plateforme`. Quand un numéro correspond à une
fiche existante, il la rapproche : ce lien nomme le téléconseiller qui a suivi
la personne sur l'écran des dossiers bancaires. Il ne crée plus de fiche et
n'en marque aucune.

Le classeur des leads du marketing laisse passer les lignes dont le Canal cite
l'une des deux plateformes : elles ne sont ni créées ni mises à jour, et le
rapport du travail les compte sous `PROSPECT_GP_IMPORT_LIGNE_PLATEFORME`. Ces
personnes n'existent que sur la plateforme.

Le suivi se lit dans « Plateformes d'enrôlement » (`/admin/enrolement`) :
inscriptions relevées, étape, dates, filtre « rapproché », entonnoir, et les
widgets `enrolement-par-jour` et `enrolement-par-etape` du tableau de bord.

## Le dossier bancaire ne tient plus à une fiche

Un dossier s'ouvrait seulement sur une inscription rapprochée à un prospect.
Sans fiche, la chaîne Banque & Finance se serait arrêtée. `bank_cases."prospectId"`
est désormais facultatif : le dossier porte le nom et le numéro lus sur
l'inscription, et les écrans qui nommaient le téléconseiller suiveur le laissent
vide. Même chose pour `client_creation_requests."createdProspectId"`, dont la
contrainte « une demande approuvée a créé une fiche » est levée.
