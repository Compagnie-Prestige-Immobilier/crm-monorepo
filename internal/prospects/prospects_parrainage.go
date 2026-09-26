package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

// Route à part : la liste et la lecture d'une fiche n'ont pas besoin de ces deux requêtes.
const (
	prospectCheminParrainage = prospectCheminID + "/parrainage"
	cheminClassementParrains = "/api/v1/parrainage/classement"
	plafondTelephonesVentes  = 20000
)

var GardeParrainage = map[string]socle.Permission{
	"GET " + prospectCheminParrainage: prospectLecture,
	"GET " + cheminClassementParrains: socle.PermissionProspectsSuperviser,
}

func MonterParrainage(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{OperationID: "getProspectParrainage", Method: http.MethodGet, Path: prospectCheminParrainage}, s.prospectHandlerParrainage)
	huma.Register(api, huma.Operation{
		OperationID: "classementParrains", Method: http.MethodGet, Path: cheminClassementParrains,
		Summary: "Les vingt parrains dont les recommandations de la période ont le plus abouti.",
	}, s.classementParrains)
}

type ProspectParrainageOutput struct {
	Body ProspectParrainageDTO
}

type ProspectParrainageDTO struct {
	RecommandeParID  *string              `json:"recommandeParId"`
	RecommandeParNom *string              `json:"recommandeParNom"`
	ARecommande      []ProspectRecommande `json:"aRecommande"`
	Suivi            SuiviParrainage      `json:"suivi"`
}

// Un filleul est vendu si sa fiche l'est ou si une vente non archivée porte son numéro.
type SuiviParrainage struct {
	Recommandes int32 `json:"recommandes" doc:"Numéros distincts recommandés."`
	Fiches      int32 `json:"fiches" doc:"Recommandations devenues fiches."`
	Convertis   int32 `json:"convertis" doc:"Fiches converties ou vendues."`
	Vendus      int32 `json:"vendus"`
}

type ParrainClasse struct {
	ID  string `json:"id"`
	Nom string `json:"nom"`
	SuiviParrainage
}

type ClassementParrainsInput struct {
	Du string `query:"du" doc:"Recommandations faites depuis ce jour, AAAA-MM-JJ."`
	Au string `query:"au" doc:"Jusqu'à ce jour inclus, AAAA-MM-JJ."`
}

type ClassementParrainsOutput struct {
	Body struct {
		Parrains []ParrainClasse `json:"parrains" maxItems:"20"`
	}
}

// Le numéro saisi à la vente n'est pas normalisé en base : il l'est ici, comme pour VenteDTO.Parrain.
func (s *service) telephonesVendus(ctx context.Context) ([]string, error) {
	bruts, err := s.Q.TelephonesDesVentes(ctx, plafondTelephonesVentes)
	if err != nil {
		return nil, err
	}
	if len(bruts) == plafondTelephonesVentes {
		slog.Warn("parrainage : seuls les premiers numéros de vente sont rapprochés", "plafond", plafondTelephonesVentes)
	}
	telephones := make([]string, 0, len(bruts))
	for _, brut := range bruts {
		if e164, err := database.NormaliserTelephone(brut, s.Cfg.PhoneRegion); err == nil {
			telephones = append(telephones, e164)
		}
	}
	return telephones, nil
}

func (s *service) classementParrains(ctx context.Context, in *ClassementParrainsInput) (*ClassementParrainsOutput, error) {
	du, au, err := socle.BornesDuJour(in.Du, in.Au, s.Cfg.TimeZone)
	if err != nil {
		return nil, err
	}
	vendus, err := s.telephonesVendus(ctx)
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.ClassementParrains(ctx, db.ClassementParrainsParams{TelephonesVendus: vendus, Du: du, Au: au})
	if err != nil {
		return nil, err
	}
	out := &ClassementParrainsOutput{}
	out.Body.Parrains = make([]ParrainClasse, 0, len(lignes))
	for _, l := range lignes {
		out.Body.Parrains = append(out.Body.Parrains, ParrainClasse{ID: l.ID, Nom: nomComplet(l.Prenom, l.Nom), SuiviParrainage: SuiviParrainage{
			Recommandes: l.Recommandes, Fiches: l.Fiches, Convertis: l.Convertis, Vendus: l.Vendus,
		}})
	}
	return out, nil
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
	vendus, err := s.telephonesVendus(ctx)
	if err != nil {
		return nil, err
	}
	suivi, err := s.Q.SuiviParrainage(ctx, db.SuiviParrainageParams{TelephonesVendus: vendus, Parrain: in.ID})
	if err != nil {
		return nil, err
	}
	out.Body.Suivi = SuiviParrainage(suivi)
	return out, nil
}
