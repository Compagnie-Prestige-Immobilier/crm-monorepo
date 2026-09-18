package socle

import (
	"fmt"
	"maps"
	"strings"
	"sync"

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
	Tous          = []Role{Admin, Commercial, BanqueFinance, Superviseur, Direction, Accueil, ChargeClientele}
	Parcours      = []Role{Admin, Commercial, ChargeClientele, Superviseur, Direction}
	Encadrement   = []Role{Admin, Superviseur, Direction}
	Registre      = []Role{Admin, Direction, Accueil}
	Banque        = []Role{Admin, BanqueFinance}
	BanqueLecture = []Role{Admin, BanqueFinance, Superviseur, Direction}
	AdminSeul     = []Role{Admin}
)

var Garde map[string]Permission

// Construite UNE fois. Toutes les instances montent les mêmes routes, donc la
// carte est identique à chaque appel ; la reconstruire écrivait dans une map que
// la garde d'accès lit à chaque requête, et créer une base de démonstration sous
// trafic faisait alors planter le processus sur « concurrent map read and map
// write ».
var gardesConstruites sync.Once

func FusionnerGardes(gardes ...map[string]Permission) {
	gardesConstruites.Do(func() {
		Garde = make(map[string]Permission)
		for _, g := range gardes {
			maps.Copy(Garde, g)
		}
	})
}

func cleGarde(method, path string) string {
	return strings.ToUpper(method) + " " + path
}

func VerifierGarde(api huma.API) error {
	vues := map[string]bool{}
	permissionsVues := map[Permission]bool{}
	if err := verifierRoutesGardees(api, vues, permissionsVues); err != nil {
		return err
	}
	for cle := range Garde {
		if !vues[cle] {
			return fmt.Errorf("entrée de garde sans route : %s", cle)
		}
	}
	for p := range permissionsDePortee {
		permissionsVues[p] = true
	}
	for p := range Catalogue {
		if !permissionsVues[p] {
			return fmt.Errorf("permission jamais référencée : %s", p)
		}
	}
	return nil
}

func verifierRoutesGardees(api huma.API, vues map[string]bool, permissionsVues map[Permission]bool) error {
	for path, item := range api.OpenAPI().Paths {
		ops := map[string]*huma.Operation{
			"GET": item.Get, "POST": item.Post, "PUT": item.Put, "PATCH": item.Patch,
			"DELETE": item.Delete, "HEAD": item.Head, "OPTIONS": item.Options,
		}
		for method, op := range ops {
			if op == nil {
				continue
			}
			if err := verifierRouteGardee(method, path, vues, permissionsVues); err != nil {
				return err
			}
		}
	}
	return nil
}

func verifierRouteGardee(method, path string, vues map[string]bool, permissionsVues map[Permission]bool) error {
	cle := cleGarde(method, path)
	p, ok := Garde[cle]
	if !ok {
		return fmt.Errorf("route sans entrée dans garde : %s", cle)
	}
	if !permissionConnue(p) {
		return fmt.Errorf("permission de garde absente du catalogue : %s", p)
	}
	vues[cle] = true
	permissionsVues[p] = true
	return nil
}
