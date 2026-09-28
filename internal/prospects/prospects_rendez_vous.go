package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const (
	prospectIssueReporte = "REPORTE"
	prospectIssueHonore  = "HONORE"
	cheminClosing        = "/api/v1/prospects/{id}/closing"
)

// CONFIRME et ANNULE répondent à la confirmation ; HONORE et NON_HONORE à la présence ; REPORTE aux deux.
type ProspectSuiviRendezVousInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Issue          string     `json:"issue" enum:"CONFIRME,ANNULE,HONORE,NON_HONORE,REPORTE"`
		ReporteAt      *time.Time `json:"reporteAt,omitempty" format:"date-time"`
		SuiteRencontre *string    `json:"suiteRencontre,omitempty" enum:"TRES_CHAUD,CHAUD,A_SUIVRE"`
	}
}

func (s *service) prospectSuivreRendezVous(ctx context.Context, in *ProspectSuiviRendezVousInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	b := &in.Body
	if (b.Issue == prospectIssueReporte) != (b.ReporteAt != nil) {
		return nil, socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_DATE_REPORT", "Un rendez-vous reporté demande sa nouvelle date, et seulement lui.")
	}
	if b.SuiteRencontre != nil && b.Issue != prospectIssueHonore {
		return nil, socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_SUITE_SANS_RENCONTRE", "La suite après rencontre se note sur un rendez-vous honoré.")
	}
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	var reporteAt *time.Time
	if b.ReporteAt != nil {
		utc := b.ReporteAt.UTC()
		reporteAt = &utc
	}
	err := s.prospectTx(ctx, func(q *db.Queries) error {
		avant, err := q.SuivreRendezVous(ctx, db.SuivreRendezVousParams{Issue: b.Issue, ReporteAt: reporteAt, Suite: b.SuiteRencontre, ID: in.ID})
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusUnprocessableEntity, "RENDEZ_VOUS_ABSENT", "Cette fiche n'est pas classée en rendez-vous.")
		}
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.suivi_rendez_vous", prospectEntite, in.ID,
			map[string]any{"issue": avant.IssueAvant, "confirmation": avant.ConfirmationAvant, "suiteRencontre": avant.SuiteAvant},
			map[string]any{"issue": b.Issue, "suiteRencontre": b.SuiteRencontre, "reporteAt": reporteAt})
	})
	if err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

type Closing struct {
	Localite              string `json:"localite" maxLength:"120"`
	Superficie            string `json:"superficie" maxLength:"120"`
	NatureJuridique       string `json:"natureJuridique" maxLength:"120"`
	EtatSite              string `json:"etatSite" maxLength:"120"`
	Position              string `json:"position" maxLength:"120"`
	AuNomDe               string `json:"auNomDe" maxLength:"120"`
	PieceIdentiteVerifiee string `json:"pieceIdentiteVerifiee" maxLength:"120"`
	PaiementAcompte       string `json:"paiementAcompte" maxLength:"120"`
	OrigineFondsJustifiee string `json:"origineFondsJustifiee" maxLength:"120"`
	FreinPrincipal        string `json:"freinPrincipal" maxLength:"120"`
	AutresPromoteurs      string `json:"autresPromoteurs" maxLength:"120"`
	Parrain               string `json:"parrain" maxLength:"120"`
	ChargeDeClientele     string `json:"chargeDeClientele" maxLength:"120"`
	ProchaineAction       string `json:"prochaineAction" minLength:"1" maxLength:"120"`
	DateRelance           string `json:"dateRelance" format:"date"`
	CompteRendu           string `json:"compteRendu" maxLength:"4000"`
}

type ClosingInput struct {
	ID string `path:"id" format:"uuid"`
}

type ClosingOutput struct {
	Body struct {
		Closing Closing  `json:"closing" doc:"Vide, au nom de qui l'ouvre, tant que le formulaire n'a jamais été enregistré."`
		Sites   []string `json:"sites" doc:"Les sites de vente actifs, pour la localité du lot."`
	}
}

type ClosingEnregistrerInput struct {
	ID   string `path:"id" format:"uuid"`
	Body Closing
}

func (s *service) closingLire(ctx context.Context, in *ClosingInput) (*ClosingOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	out := &ClosingOutput{}
	ligne, err := s.Q.LireClosing(ctx, in.ID)
	switch {
	case err == nil:
		out.Body.Closing = closingDe(&ligne)
	case errors.Is(err, pgx.ErrNoRows):
		out.Body.Closing = Closing{ChargeDeClientele: u.FullName}
	default:
		return nil, err
	}
	sites, err := s.Q.RvSiteSites(ctx)
	if err != nil {
		return nil, err
	}
	out.Body.Sites = make([]string, 0, len(sites))
	for _, site := range sites {
		out.Body.Sites = append(out.Body.Sites, site.Nom)
	}
	return out, nil
}

func (s *service) closingEnregistrer(ctx context.Context, in *ClosingEnregistrerInput) (*ClosingOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	fiche, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	if fiche.RendezVousIssue == nil || *fiche.RendezVousIssue != prospectIssueHonore {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "CLOSING_SANS_PRESENCE", "Le closing se remplit après un rendez-vous où le prospect était présent.")
	}
	b := &in.Body
	relance, err := time.Parse(formatJourRendezVous, b.DateRelance)
	if err != nil {
		return nil, socle.Problem(http.StatusBadRequest, "CLOSING_DATE_RELANCE", "La date de relance est obligatoire.")
	}
	if strings.TrimSpace(b.ProchaineAction) == "" {
		return nil, socle.Problem(http.StatusBadRequest, "CLOSING_PROCHAINE_ACTION", "La prochaine action est obligatoire.")
	}
	err = s.prospectTx(ctx, func(q *db.Queries) error {
		if _, err := q.EnregistrerClosing(ctx, db.EnregistrerClosingParams{
			ProspectID: in.ID, Localite: b.Localite, Superficie: b.Superficie, NatureJuridique: b.NatureJuridique,
			EtatSite: b.EtatSite, Position: b.Position, AuNomDe: b.AuNomDe, PieceIdentiteVerifiee: b.PieceIdentiteVerifiee,
			PaiementAcompte: b.PaiementAcompte, OrigineFondsJustifiee: b.OrigineFondsJustifiee, FreinPrincipal: b.FreinPrincipal,
			AutresPromoteurs: b.AutresPromoteurs, Parrain: b.Parrain, ChargeDeClientele: b.ChargeDeClientele,
			ProchaineAction: strings.TrimSpace(b.ProchaineAction), DateRelance: pgtype.Date{Time: relance, Valid: true}, CompteRendu: b.CompteRendu, AuteurID: u.ID,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.closing", prospectEntite, in.ID, nil, b)
	})
	if err != nil {
		return nil, err
	}
	return s.closingLire(ctx, &ClosingInput{ID: in.ID})
}

func closingDe(l *db.RendezVousClosing) Closing {
	return Closing{
		Localite: l.Localite, Superficie: l.Superficie, NatureJuridique: l.NatureJuridique, EtatSite: l.EtatSite,
		Position: l.Position, AuNomDe: l.AuNomDe, PieceIdentiteVerifiee: l.PieceIdentiteVerifiee,
		PaiementAcompte: l.PaiementAcompte, OrigineFondsJustifiee: l.OrigineFondsJustifiee, FreinPrincipal: l.FreinPrincipal,
		AutresPromoteurs: l.AutresPromoteurs, Parrain: l.Parrain, ChargeDeClientele: l.ChargeDeClientele,
		ProchaineAction: l.ProchaineAction, DateRelance: l.DateRelance.Time.Format(formatJourRendezVous), CompteRendu: l.CompteRendu,
	}
}

func prospectMonterRendezVous(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "suivreRendezVousProspect", Method: http.MethodPost,
		Path: "/api/v1/prospects/{id}/suivi-rendez-vous",
	}, s.prospectSuivreRendezVous)
	huma.Register(api, huma.Operation{
		OperationID: "lireClosing", Method: http.MethodGet, Path: cheminClosing,
		Summary: "Le formulaire de closing d’un rendez-vous honoré.",
	}, s.closingLire)
	huma.Register(api, huma.Operation{
		OperationID: "enregistrerClosing", Method: http.MethodPut, Path: cheminClosing,
		Summary: "Enregistre ou corrige le formulaire de closing.",
	}, s.closingEnregistrer)
}
