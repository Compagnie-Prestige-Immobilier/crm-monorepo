package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type ProspectPipelineInput struct {
	AppelePar string `query:"appelePar" format:"uuid" doc:"Téléconseiller ; hors encadrement, toujours soi-même."`
	Projet    string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
}

type ProspectPipelineOutput struct {
	Body struct {
		Appelees    int `json:"appelees"`
		Joignables  int `json:"joignables"`
		Interessees int `json:"interessees"`
		Methodes    int `json:"methodes"`
		Converties  int `json:"converties"`
		Vendues     int `json:"vendues"`
	}
}

// Le parcours d'un téléconseiller sur ses contacts, de l'appel à la vente.
func (s *service) prospectPipeline(ctx context.Context, in *ProspectPipelineInput) (*ProspectPipelineOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	appelePar := u.ID
	if in.AppelePar != "" && u.Peut(socle.PermissionPortefeuilleVoirTout) {
		appelePar = in.AppelePar
	}
	ligne, err := s.Q.PipelineDesContacts(ctx, db.PipelineDesContactsParams{
		AppelePar: appelePar, Projet: prospectTypeEnum[db.Projet](in.Projet),
	})
	if err != nil {
		return nil, err
	}
	out := &ProspectPipelineOutput{}
	out.Body.Appelees, out.Body.Joignables, out.Body.Interessees = int(ligne.Appelees), int(ligne.Joignables), int(ligne.Interessees)
	out.Body.Methodes, out.Body.Converties, out.Body.Vendues = int(ligne.Methodes), int(ligne.Converties), int(ligne.Vendues)
	return out, nil
}

func prospectMonterPipeline(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "pipelineDesContacts", Method: http.MethodGet,
		Path: "/api/v1/prospects/pipeline",
	}, s.prospectPipeline)
}
