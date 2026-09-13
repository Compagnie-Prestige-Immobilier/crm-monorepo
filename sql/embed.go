// Package sqlsource porte le schéma de départ dans le binaire.
//
// Les migrations ne créent pas les 57 tables : elles s'ajoutent à `schema.sql`,
// appliqué une fois à la main par `make db`. Une base créée depuis le panneau
// n'a personne pour le faire, d'où cet embarquement.
package sqlsource

import _ "embed"

//go:embed schema.sql
var Schema string
