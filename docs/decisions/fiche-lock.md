# Fiche ownership lock

The fiche ownership lock is retired.

New qualifications may open another fiche without closing or qualifying a previous one. The web panel no longer blocks navigation, logout, workspace changes, or fiche selection because of an open fiche.

The legacy `ouvertures_fiche` columns and rows remain in old databases for data compatibility. The unique active-opening index is removed by migration; no old row is deleted. The legacy `verrouFiches` setting and API fields remain readable during the transition but have no effect.
