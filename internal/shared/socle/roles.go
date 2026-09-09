package socle

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
	Tous        = []Role{Admin, Commercial, BanqueFinance, Superviseur, Direction, Accueil, ChargeClientele}
	Parcours    = []Role{Admin, Commercial, ChargeClientele, Superviseur, Direction}
	Encadrement = []Role{Admin, Superviseur, Direction}
	Registre    = []Role{Admin, Direction, Accueil}
	Banque      = []Role{Admin, BanqueFinance}
	AdminSeul   = []Role{Admin}
)

// Une entrée par route, clé "METHODE chemin huma", fusion des gardes de chaque
// domaine (domaines.go). Toute route sans entrée, ou toute entrée sans route,
// arrête le démarrage (verifierGarde).
var Garde = map[string][]Role{}

func FusionnerGardes(gardes ...map[string][]Role) {
	clear(Garde)
	for _, g := range gardes {
		maps.Copy(Garde, g)
	}
}

func cleGarde(method, path string) string {
	return strings.ToUpper(method) + " " + path
}

func Autorise(roles []Role, role Role) bool {
	for _, r := range roles {
		if r == role || r == Public {
			return true
		}
	}
	return false
}

func VerifierGarde(api huma.API) error {
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
			if _, ok := Garde[cle]; !ok {
				return fmt.Errorf("route sans entrée dans garde : %s", cle)
			}
			vues[cle] = true
		}
	}
	for cle := range Garde {
		if !vues[cle] {
			return fmt.Errorf("entrée de garde sans route : %s", cle)
		}
	}
	return nil
}
