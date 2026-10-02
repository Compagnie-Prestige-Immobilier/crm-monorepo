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
	rendezVousPagesMax   = 10_000
	formatJourRendezVous = "2006-01-02"
)

// Le comptoir lit les rendez-vous sans lire les fiches : cette liste ne rend ni
// segment, ni banque, ni commentaire d'appel, seulement de quoi accueillir.
type RendezVousObtenu struct {
	ID                        string  `json:"id"`
	Prenom                    string  `json:"prenom"`
	Nom                       string  `json:"nom"`
	PhoneE164                 *string `json:"phoneE164"`
	TitulaireID               string  `json:"titulaireId"`
	Type                      string  `json:"type"`
	TypeCode                  string  `json:"typeCode"`
	Quand                     *string `json:"quand" doc:"Date du rendez-vous : la date reportée, sinon celle du rappel promis."`
	PrisLe                    *string `json:"prisLe"`
	PrisPar                   string  `json:"prisPar"`
	Issue                     string  `json:"issue" enum:",HONORE,NON_HONORE"`
	Confirmation              string  `json:"confirmation" enum:",CONFIRME,ANNULE,A_RECONTACTER"`
	Reporte                   bool    `json:"reporte"`
	Etape                     string  `json:"etape" enum:"A_CONFIRMER,A_RECONTACTER,CONFIRMES,A_CLOSER,EN_RETARD,HISTORIQUE"`
	Site                      string  `json:"site"`
	SitePrix                  int64   `json:"sitePrix"`
	PointRencontre            string  `json:"pointRencontre"`
	PointRencontreCommentaire string  `json:"pointRencontreCommentaire"`
	RecontacterNote           string  `json:"recontacterNote" doc:"Ce que la personne a dit, sur un rendez-vous à recontacter."`
	RecontacterLe             string  `json:"recontacterLe" doc:"AAAA-MM-JJ, vide si aucune date n'a été choisie."`
	RecontacterAt             string  `json:"recontacterAt"`
	RecontacterPar            string  `json:"recontacterPar"`
	Qualification             string  `json:"qualification" doc:"La qualification posée au closing, vide avant."`
}

type RendezVousListInput struct {
	Type     string `query:"type" maxLength:"40" doc:"Code du type de rendez-vous : RV_CPI, RV_SITE, RV_EXTERNE, RDV_TELEPHONIQUE."`
	Search   string `query:"search" maxLength:"120" doc:"Nom, prénom ou numéro."`
	Etape    string `query:"etape" enum:",A_TRAITER,A_CONFIRMER,A_RECONTACTER,CONFIRMES,A_CLOSER,EN_RETARD,HISTORIQUE" doc:"A_TRAITER regroupe toutes les étapes hors historique."`
	Du       string `query:"du" doc:"Premier jour des rendez-vous, AAAA-MM-JJ."`
	Au       string `query:"au" doc:"Dernier jour des rendez-vous, inclus, AAAA-MM-JJ."`
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
		ParEtape  map[string]int64   `json:"parEtape" doc:"Rendez-vous par étape, au type choisi, sans la recherche ni les dates."`
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
	du, au, err := socle.BornesDuJour(in.Du, in.Au, s.Cfg.TimeZone)
	if err != nil {
		return nil, err
	}
	lignes, err := s.Q.RendezVousObtenus(ctx, db.RendezVousObtenusParams{
		TypeCode:  prospectVide(strings.TrimSpace(in.Type)),
		Recherche: prospectVide(strings.TrimSpace(in.Search)),
		Etape:     prospectVide(in.Etape),
		DebutJour: socle.DebutDuJour(s.Cfg.TimeZone),
		Du:        du,
		Au:        au,
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
		out.Body.Items = append(out.Body.Items, rendezVousDe(ligne))
	}
	etapes, err := s.Q.RendezVousParEtape(ctx, db.RendezVousParEtapeParams{
		DebutJour: socle.DebutDuJour(s.Cfg.TimeZone), TypeCode: prospectVide(strings.TrimSpace(in.Type)),
	})
	if err != nil {
		return nil, err
	}
	out.Body.ParEtape = make(map[string]int64, len(etapes))
	for _, etape := range etapes {
		out.Body.ParEtape[etape.Etape] = etape.Nombre
	}
	out.Body.Page, out.Body.PageSize = page, taille
	parPage := int64(taille)
	out.Body.PageCount = (out.Body.Total + parPage - 1) / parPage
	return out, nil
}

func rendezVousDe(l *db.RendezVousObtenusRow) RendezVousObtenu {
	return RendezVousObtenu{
		ID: l.ID, Prenom: l.Prenom, Nom: l.Nom, PhoneE164: l.PhoneE164, TitulaireID: l.TitulaireId, Type: l.Type, TypeCode: l.TypeCode,
		Quand: prospectVide(l.Quand), PrisLe: rendezVousInstant(l.LastCallAt), PrisPar: l.PrisPar,
		Issue: l.Issue, Confirmation: l.Confirmation, Reporte: l.Reporte, Etape: l.Etape, Site: l.Site, SitePrix: l.SitePrix, PointRencontre: l.PointRencontre,
		PointRencontreCommentaire: l.PointRencontreCommentaire,
		RecontacterNote:           l.RecontacterNote, RecontacterLe: l.RecontacterLe, RecontacterAt: l.RecontacterAt, RecontacterPar: l.RecontacterPar,
		Qualification: l.Qualification,
	}
}

func rendezVousInstant(quand *time.Time) *string {
	if quand == nil {
		return nil
	}
	rendu := quand.UTC().Format(time.RFC3339)
	return &rendu
}

var GardeRendezVous = map[string]socle.Permission{
	"GET " + cheminRendezVous:                socle.PermissionRendezVousVoir,
	"GET /api/v1/prospects/{id}/rendez-vous": socle.PermissionProspectsLire,
}

type RendezVousFicheInput struct {
	ID string `path:"id" format:"uuid"`
}

type RendezVousFicheOutput struct {
	Body struct {
		RendezVous *RendezVousObtenu `json:"rendezVous" doc:"Absent quand la fiche n'est pas en rendez-vous."`
	}
}

// Le rendez-vous en cours d'une fiche, lu comme le comptoir le lit, pour qui
// peut ouvrir la fiche.
func (s *service) rendezVousDeLaFiche(ctx context.Context, in *RendezVousFicheInput) (*RendezVousFicheOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	lignes, err := s.Q.RendezVousObtenus(ctx, db.RendezVousObtenusParams{ProspectID: &in.ID, DebutJour: socle.DebutDuJour(s.Cfg.TimeZone), Prendre: 1})
	if err != nil {
		return nil, err
	}
	out := &RendezVousFicheOutput{}
	if len(lignes) == 1 {
		rdv := rendezVousDe(&lignes[0])
		out.Body.RendezVous = &rdv
	}
	return out, nil
}

func MonterRendezVous(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{
		OperationID: "listRendezVous", Method: http.MethodGet, Path: cheminRendezVous,
		Summary: "Les rendez-vous obtenus au téléphone, pour le comptoir.",
	}, s.rendezVousLister)
	huma.Register(api, huma.Operation{
		OperationID: "rendezVousDeLaFiche", Method: http.MethodGet, Path: "/api/v1/prospects/{id}/rendez-vous",
		Summary: "Le rendez-vous en cours d’une fiche.",
	}, s.rendezVousDeLaFiche)
}
