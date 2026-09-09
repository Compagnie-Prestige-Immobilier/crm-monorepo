package web

import "embed"

// Le panneau construit par Vite, servi par le binaire.
//
//go:embed all:dist
var Dist embed.FS
