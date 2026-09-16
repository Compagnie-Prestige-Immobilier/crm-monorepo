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
	// Chargé de clientèle plateforme : appelle les fiches venues des plateformes
	// d'enrôlement, et elles seules (docs/decisions/fiches-plateforme.md).
	CCP    Role = "CCP"
	Public Role = "PUBLIC"
)

var (
	Tous          = []Role{Admin, Commercial, BanqueFinance, Superviseur, Direction, Accueil, ChargeClientele, CCP}
	Parcours      = []Role{Admin, Commercial, ChargeClientele, CCP, Superviseur, Direction}
	Encadrement   = []Role{Admin, Superviseur, Direction}
	Registre      = []Role{Admin, Direction, Accueil}
	Banque        = []Role{Admin, BanqueFinance}
	BanqueLecture = []Role{Admin, BanqueFinance, Superviseur, Direction}
	AdminSeul     = []Role{Admin}
)

// Une entrée par route, clé "METHODE chemin huma", fusion des gardes de chaque
// domaine (domaines.go). Toute route sans entrée, ou toute entrée sans route,
// arrête le démarrage (verifierGarde).
var Garde map[string][]Role

// Construite UNE fois. Toutes les instances montent les mêmes routes, donc la
// carte est identique à chaque appel ; la reconstruire écrivait dans une map que
// la garde d'accès lit à chaque requête, et créer une base de démonstration sous
// trafic faisait alors planter le processus sur « concurrent map read and map
// write ».
var gardesConstruites sync.Once

func FusionnerGardes(gardes ...map[string][]Role) {
	gardesConstruites.Do(func() {
		Garde = make(map[string][]Role)
		for _, g := range gardes {
			maps.Copy(Garde, g)
		}
	})
}

func cleGarde(method, path string) string {
	return strings.ToUpper(method) + " " + path
}

// Lecture d'une fiche plateforme : nil, l'encadrement lit tout ; vrai, le CCP
// ne voit que les fiches venues des plateformes ; faux, personne d'autre ne
// les voit jamais. Lire n'est pas toucher : voir PorteeSaisiePlateforme.
func PorteePlateforme(r Role) *bool {
	if r == Admin || r == Superviseur || r == Direction {
		return nil
	}
	if r == CCP {
		return &vrai
	}
	return &faux
}

// Saisie sur une fiche plateforme, annuaire d'appel compris : seul le CCP.
// L'encadrement suit le travail des CCP sans jamais composer leurs numéros.
func PorteeSaisiePlateforme(r Role) *bool {
	if r == CCP {
		return &vrai
	}
	return &faux
}

var vrai, faux = true, false

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
