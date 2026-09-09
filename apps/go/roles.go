package main

import (
	"fmt"
	"maps"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

type Role string

const (
	Admin           Role = "ADMIN"
	Commercial      Role = "COMMERCIAL"
	BanqueFinance   Role = "BANQUE_FINANCE"
	Superviseur     Role = "SUPERVISEUR"
	Direction       Role = "DIRECTION"
	Accueil         Role = "ACCUEIL"
	ChargeClientele Role = "CHARGE_CLIENTELE"
	Public          Role = "PUBLIC"
)

var (
	tous        = []Role{Admin, Commercial, BanqueFinance, Superviseur, Direction, Accueil, ChargeClientele}
	parcours    = []Role{Admin, Commercial, ChargeClientele, Superviseur, Direction}
	encadrement = []Role{Admin, Superviseur, Direction}
	registre    = []Role{Admin, Direction, Accueil}
	banque      = []Role{Admin, BanqueFinance}
	admin       = []Role{Admin}
)

// Une entrée par route, clé "METHODE chemin huma", fusion des gardes de chaque
// domaine (domaines.go). Toute route sans entrée, ou toute entrée sans route,
// arrête le démarrage (verifierGarde).
var garde = map[string][]Role{}

var gardeAuth = map[string][]Role{
	"GET /health/ready":          {Public},
	"POST /api/v1/auth/login":    {Public},
	"POST /api/v1/auth/logout":   tous,
	"GET /api/v1/auth/me":        tous,
	"POST /api/v1/auth/password": tous,
}

func fusionnerGardes(gardes ...map[string][]Role) {
	clear(garde)
	for _, g := range gardes {
		maps.Copy(garde, g)
	}
}

func cleGarde(method, path string) string {
	return strings.ToUpper(method) + " " + path
}

func autorise(roles []Role, role Role) bool {
	for _, r := range roles {
		if r == role || r == Public {
			return true
		}
	}
	return false
}

func verifierGarde(api huma.API) error {
	vues := map[string]bool{}
	for path, item := range api.OpenAPI().Paths {
		ops := map[string]*huma.Operation{
			"GET": item.Get, "POST": item.Post, "PUT": item.Put, "PATCH": item.Patch,
			"DELETE": item.Delete, "HEAD": item.Head, "OPTIONS": item.Options,
		}
		for method, op := range ops {
			if op == nil {
				continue
			}
			cle := cleGarde(method, path)
			if _, ok := garde[cle]; !ok {
				return fmt.Errorf("route sans entrée dans garde : %s", cle)
			}
			vues[cle] = true
		}
	}
	for cle := range garde {
		if !vues[cle] {
			return fmt.Errorf("entrée de garde sans route : %s", cle)
		}
	}
	return nil
}
