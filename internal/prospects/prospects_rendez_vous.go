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
	prospectIssueReporte      = "REPORTE"
	prospectIssueARecontacter = "A_RECONTACTER"
	prospectIssueHonore       = "HONORE"
	cheminClosing             = "/api/v1/prospects/{id}/closing"
)

// CONFIRME, ANNULE et A_RECONTACTER répondent à la confirmation ; HONORE et NON_HONORE à la présence ; REPORTE aux deux.
type ProspectSuiviRendezVousInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Issue          string     `json:"issue" enum:"CONFIRME,ANNULE,HONORE,NON_HONORE,REPORTE,A_RECONTACTER"`
		ReporteAt      *time.Time `json:"reporteAt,omitempty" format:"date-time"`
		SuiteRencontre *string    `json:"suiteRencontre,omitempty" enum:"TRES_CHAUD,CHAUD,A_SUIVRE"`
		Commentaire    *string    `json:"commentaire,omitempty" maxLength:"1000" doc:"Ce que la personne a dit ; exigé pour A_RECONTACTER."`
		RecontacterLe  *string    `json:"recontacterLe,omitempty" format:"date" doc:"Facultatif, seulement pour A_RECONTACTER."`
	}
}

func suiviRendezVousRefus(issue string, reporteAt *time.Time, suite, commentaire, recontacterLe *string) error {
	if (issue == prospectIssueReporte) != (reporteAt != nil) {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_DATE_REPORT", "Un rendez-vous reporté demande sa nouvelle date, et seulement lui.")
	}
	if suite != nil && issue != prospectIssueHonore {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_SUITE_SANS_RENCONTRE", "La suite après rencontre se note sur un rendez-vous honoré.")
	}
	aRecontacter := issue == prospectIssueARecontacter
	if aRecontacter != (commentaire != nil && strings.TrimSpace(*commentaire) != "") {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_COMMENTAIRE", "Un rendez-vous à recontacter demande ce que la personne a dit, et seulement lui.")
	}
	if recontacterLe != nil && !aRecontacter {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_DATE_RECONTACT", "La date de recontact ne vaut que pour un rendez-vous à recontacter.")
	}
	return nil
}

func dateFacultative(jour *string) pgtype.Date {
	if jour == nil {
		return pgtype.Date{}
	}
	t, err := time.Parse(time.DateOnly, *jour)
	return pgtype.Date{Time: t, Valid: err == nil}
}

func (s *service) prospectSuivreRendezVous(ctx context.Context, in *ProspectSuiviRendezVousInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	b := &in.Body
	if err := suiviRendezVousRefus(b.Issue, b.ReporteAt, b.SuiteRencontre, b.Commentaire, b.RecontacterLe); err != nil {
		return nil, err
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
		avant, err := q.SuivreRendezVous(ctx, db.SuivreRendezVousParams{
			Issue: b.Issue, ReporteAt: reporteAt, Suite: b.SuiteRencontre, ID: in.ID,
			Note: b.Commentaire, RecontacterLe: dateFacultative(b.RecontacterLe), Par: &u.ID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusUnprocessableEntity, "RENDEZ_VOUS_ABSENT", "Cette fiche n'est pas classée en rendez-vous.")
		}
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.suivi_rendez_vous", prospectEntite, in.ID,
			map[string]any{"issue": avant.IssueAvant, "confirmation": avant.ConfirmationAvant, "suiteRencontre": avant.SuiteAvant},
			map[string]any{
				"issue": b.Issue, "suiteRencontre": b.SuiteRencontre, "reporteAt": reporteAt,
				"commentaire": b.Commentaire, "recontacterLe": b.RecontacterLe,
			})
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
	Titulaires            string `json:"titulaires" maxLength:"200"`
	PieceIdentiteVerifiee string `json:"pieceIdentiteVerifiee" maxLength:"120"`
	PersonneExposee       string `json:"personnePolitiquementExposee" maxLength:"120"`
	PaiementAcompte       string `json:"paiementAcompte" maxLength:"120"`
	OrigineFondsJustifiee string `json:"origineFondsJustifiee" maxLength:"120"`
	FreinPrincipal        string `json:"freinPrincipal" maxLength:"120"`
	AutresPromoteurs      string `json:"autresPromoteurs" maxLength:"120"`
	Parrain               string `json:"parrain" maxLength:"120"`
	ChargeDeClientele     string `json:"chargeDeClientele" maxLength:"120"`
	ProchaineAction       string `json:"prochaineAction" maxLength:"120"`
	DateRelance           string `json:"dateRelance" maxLength:"10" doc:"AAAA-MM-JJ, vide si aucune relance n'est prévue."`
	CompteRendu           string `json:"compteRendu" maxLength:"4000"`
}

type ClosingInput struct {
	ID string `path:"id" format:"uuid"`
}

type ClosingOutput struct {
	Body struct {
		Closing Closing  `json:"closing" doc:"Vide, au nom de qui l'ouvre, tant que le formulaire n'a jamais été enregistré."`
		Sites   []string `json:"sites" doc:"Les sites de vente actifs, pour la localité du lot."`
		Charges []string `json:"chargesDeClientele" doc:"Les chargés de clientèle actifs, pour « Chargé de clientèle en charge »."`
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
	if out.Body.Charges, err = s.Q.ChargesDeClientele(ctx); err != nil {
		return nil, err
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
	relance := pgtype.Date{}
	if b.DateRelance != "" {
		jour, err := time.Parse(formatJourRendezVous, b.DateRelance)
		if err != nil {
			return nil, socle.Problem(http.StatusBadRequest, "CLOSING_DATE_RELANCE", "La date de relance n'est pas une date.")
		}
		relance = pgtype.Date{Time: jour, Valid: true}
	}
	err = s.prospectTx(ctx, func(q *db.Queries) error {
		if _, err := q.EnregistrerClosing(ctx, db.EnregistrerClosingParams{
			ProspectID: in.ID, Localite: b.Localite, Superficie: b.Superficie, NatureJuridique: b.NatureJuridique,
			EtatSite: b.EtatSite, Position: b.Position, AuNomDe: b.AuNomDe, PieceIdentiteVerifiee: b.PieceIdentiteVerifiee,
			PaiementAcompte: b.PaiementAcompte, OrigineFondsJustifiee: b.OrigineFondsJustifiee, FreinPrincipal: b.FreinPrincipal,
			AutresPromoteurs: b.AutresPromoteurs, Parrain: b.Parrain, ChargeDeClientele: b.ChargeDeClientele,
			ProchaineAction: strings.TrimSpace(b.ProchaineAction), DateRelance: relance, CompteRendu: b.CompteRendu, AuteurID: u.ID,
			Titulaires: b.Titulaires, PersonnePolitiquementExposee: b.PersonneExposee,
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
		ProchaineAction: l.ProchaineAction, DateRelance: jourOuVide(l.DateRelance), CompteRendu: l.CompteRendu,
		Titulaires: l.Titulaires, PersonneExposee: l.PersonnePolitiquementExposee,
	}
}

func jourOuVide(jour pgtype.Date) string {
	if !jour.Valid {
		return ""
	}
	return jour.Time.Format(formatJourRendezVous)
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
