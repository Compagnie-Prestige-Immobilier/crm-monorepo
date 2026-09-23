package prospects

import (
	"context"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

// Route à part, jamais jointe à la fiche principale : la liste paginée et la
// lecture d'une fiche n'ont pas besoin de ces deux requêtes supplémentaires,
// et prospects.go est déjà au plafond de lignes.
const prospectCheminParrainage = prospectCheminID + "/parrainage"

var GardeParrainage = map[string]socle.Permission{
	"GET " + prospectCheminParrainage: prospectLecture,
}

func MonterParrainage(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{OperationID: "getProspectParrainage", Method: http.MethodGet, Path: prospectCheminParrainage}, s.prospectHandlerParrainage)
}

type ProspectParrainageOutput struct {
	Body ProspectParrainageDTO
}

type ProspectParrainageDTO struct {
	RecommandeParID  *string              `json:"recommandeParId"`
	RecommandeParNom *string              `json:"recommandeParNom"`
	ARecommande      []ProspectRecommande `json:"aRecommande"`
}

type ProspectRecommande struct {
	ID     string `json:"id"`
	Nom    string `json:"nom"`
	Statut string `json:"statut" enum:"NOUVEAU,CONTACTE,CONVERTI,PERDU,VENDU"`
}

func nomComplet(prenom, nom string) string {
	return strings.TrimSpace(strings.TrimSpace(prenom) + " " + nom)
}

func (s *service) prospectHandlerParrainage(ctx context.Context, in *ProspectIDInput) (*ProspectParrainageOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	out := &ProspectParrainageOutput{Body: ProspectParrainageDTO{ARecommande: []ProspectRecommande{}}}
	parrain, err := s.Q.ParrainDuProspect(ctx, &in.ID)
	if err == nil {
		nom := nomComplet(parrain.Prenom, parrain.Nom)
		out.Body.RecommandeParID, out.Body.RecommandeParNom = &parrain.ID, &nom
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	filleuls, err := s.Q.ProspectsRecommandesPar(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	for _, f := range filleuls {
		out.Body.ARecommande = append(out.Body.ARecommande, ProspectRecommande{
			ID: f.ID, Nom: nomComplet(f.Prenom, f.Nom), Statut: string(f.Statut),
		})
	}
	return out, nil
}
