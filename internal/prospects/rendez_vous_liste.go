package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	cheminRendezVous  = "/api/v1/rendez-vous"
	rendezVousParPage = 25
	rendezVousPageMax = 200
	// Au-delà, l'offset dépasse ce que la base contiendra jamais : la demande
	// vient d'une URL bricolée, pas d'un clic.
	rendezVousPagesMax = 10_000
)

// Le comptoir lit les rendez-vous sans lire les fiches : cette liste ne rend ni
// segment, ni banque, ni commentaire d'appel, seulement de quoi accueillir.
type RendezVousObtenu struct {
	ID        string  `json:"id"`
	Prenom    string  `json:"prenom"`
	Nom       string  `json:"nom"`
	PhoneE164 *string `json:"phoneE164"`
	Type      string  `json:"type"`
	TypeCode  string  `json:"typeCode"`
	PrisLe    *string `json:"prisLe"`
	PrisPar   string  `json:"prisPar"`
	Issue     string  `json:"issue" enum:",HONORE,NON_HONORE,REPORTE"`
}

type RendezVousListInput struct {
	Type     string `query:"type" maxLength:"40" doc:"Code du type de rendez-vous : RV_CPI, RV_SITE, RV_EXTERNE."`
	Search   string `query:"search" maxLength:"120" doc:"Nom, prénom ou numéro."`
	Page     int32  `query:"page" minimum:"1" maximum:"10000"`
	PageSize int32  `query:"pageSize" minimum:"1" maximum:"200"`
}

type RendezVousListOutput struct {
	Body struct {
		Items     []RendezVousObtenu `json:"items"`
		Total     int64              `json:"total"`
		Page      int32              `json:"page"`
		PageSize  int32              `json:"pageSize"`
		PageCount int64              `json:"pageCount"`
	}
}

func (s *service) rendezVousLister(ctx context.Context, in *RendezVousListInput) (*RendezVousListOutput, error) {
	page, taille := in.Page, in.PageSize
	if page < 1 || page > rendezVousPagesMax {
		page = 1
	}
	if taille < 1 || taille > rendezVousPageMax {
		taille = rendezVousParPage
	}
	lignes, err := s.Q.RendezVousObtenus(ctx, db.RendezVousObtenusParams{
		TypeCode:  prospectVide(strings.TrimSpace(in.Type)),
		Recherche: prospectVide(strings.TrimSpace(in.Search)),
		Prendre:   taille,
		Sauter:    (page - 1) * taille,
	})
	if err != nil {
		return nil, err
	}
	out := &RendezVousListOutput{}
	out.Body.Items = make([]RendezVousObtenu, 0, len(lignes))
	for i := range lignes {
		ligne := &lignes[i]
		if i == 0 {
			out.Body.Total = ligne.Total
		}
		out.Body.Items = append(out.Body.Items, RendezVousObtenu{
			ID: ligne.ID, Prenom: ligne.Prenom, Nom: ligne.Nom, PhoneE164: ligne.PhoneE164,
			Type: ligne.Type, TypeCode: ligne.TypeCode, PrisLe: rendezVousInstant(ligne.LastCallAt),
			PrisPar: ligne.PrisPar, Issue: ligne.Issue,
		})
	}
	out.Body.Page, out.Body.PageSize = page, taille
	parPage := int64(taille)
	out.Body.PageCount = (out.Body.Total + parPage - 1) / parPage
	return out, nil
}

func rendezVousInstant(quand *time.Time) *string {
	if quand == nil {
		return nil
	}
	rendu := quand.UTC().Format(time.RFC3339)
	return &rendu
}

var GardeRendezVous = map[string]socle.Permission{
	"GET " + cheminRendezVous: socle.PermissionRendezVousVoir,
}

func MonterRendezVous(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{
		OperationID: "listRendezVous", Method: http.MethodGet, Path: cheminRendezVous,
		Summary: "Les rendez-vous obtenus au téléphone, pour le comptoir.",
	}, s.rendezVousLister)
}
