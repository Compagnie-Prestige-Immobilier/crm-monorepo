package prospects

import (
	"context"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

const cheminLienFormulaire = "/api/v1/formulaire-public/mon-lien"

// Le lien portait l'identifiant du compte : il ne se révoquait qu'en désactivant
// le compte. Le jeton se régénère, l'ancien lien meurt, le compte reste ouvert.
var GardeLienFormulaire = map[string][]socle.Role{
	"GET " + cheminLienFormulaire:                socle.Tous,
	"POST " + cheminLienFormulaire + "/rotation": socle.Tous,
}

type LienFormulaireOutput struct {
	Body struct {
		Jeton string `json:"jeton"`
	}
}

func (s *service) lireMonLienFormulaire(ctx context.Context, _ *struct{}) (*LienFormulaireOutput, error) {
	jeton, err := s.Q.JetonFormulaireDuCompte(ctx, socle.UtilisateurCourant(ctx).ID)
	if err != nil {
		return nil, err
	}
	return lienFormulaireSortie(jeton), nil
}

func (s *service) regenererMonLienFormulaire(ctx context.Context, _ *struct{}) (*LienFormulaireOutput, error) {
	jeton, err := s.Q.JetonFormulaireRegenere(ctx, socle.UtilisateurCourant(ctx).ID)
	if err != nil {
		return nil, err
	}
	return lienFormulaireSortie(jeton), nil
}

func lienFormulaireSortie(jeton *string) *LienFormulaireOutput {
	out := &LienFormulaireOutput{}
	if jeton != nil {
		out.Body.Jeton = *jeton
	}
	return out
}

func MonterLienFormulaire(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{
		OperationID: "lireMonLienFormulaire", Method: http.MethodGet, Path: cheminLienFormulaire,
	}, s.lireMonLienFormulaire)
	huma.Register(api, huma.Operation{
		OperationID: "regenererMonLienFormulaire", Method: http.MethodPost,
		Path: cheminLienFormulaire + "/rotation",
	}, s.regenererMonLienFormulaire)
}
