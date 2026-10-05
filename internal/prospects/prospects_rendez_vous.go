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
		ReporteAt      *time.Time `json:"reporteAt,omitempty" format:"date-time" doc:"Facultatif pour REPORTE : sans elle, le rendez-vous passe à recontacter."`
		SuiteRencontre *string    `json:"suiteRencontre,omitempty" enum:"TRES_CHAUD,CHAUD,A_SUIVRE"`
		Commentaire    *string    `json:"commentaire,omitempty" maxLength:"1000" doc:"Exigé pour A_RECONTACTER, facultatif pour HONORE, NON_HONORE et REPORTE, refusé sinon."`
		RecontacterLe  *string    `json:"recontacterLe,omitempty" format:"date" doc:"Facultatif, pour A_RECONTACTER ou un REPORTE sans heure."`
	}
}

func suiviRendezVousRefus(issue string, reporteAt *time.Time, suite, commentaire, recontacterLe *string) error {
	reporte := issue == prospectIssueReporte
	if reporteAt != nil && !reporte {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_DATE_REPORT", "La nouvelle date ne vaut que pour un rendez-vous reporté.")
	}
	if suite != nil && issue != prospectIssueHonore {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_SUITE_SANS_RENCONTRE", "La suite après rencontre se note sur un rendez-vous honoré.")
	}
	if err := commentaireRefus(issue, commentaire); err != nil {
		return err
	}
	aRecontacter := issue == prospectIssueARecontacter
	if recontacterLe != nil && !aRecontacter && (!reporte || reporteAt != nil) {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_DATE_RECONTACT", "La date de recontact ne vaut que pour un rendez-vous à recontacter ou reporté sans heure.")
	}
	return nil
}

func commentaireRefus(issue string, commentaire *string) error {
	aDit := commentaire != nil && strings.TrimSpace(*commentaire) != ""
	if issue == prospectIssueARecontacter && !aDit {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_COMMENTAIRE", "Un rendez-vous à recontacter demande ce que la personne a dit.")
	}
	if aDit && (issue == "CONFIRME" || issue == "ANNULE") {
		return socle.Problem(http.StatusBadRequest, "RENDEZ_VOUS_COMMENTAIRE", "Le commentaire se note au suivi : présent, absent, reporté ou à recontacter.")
	}
	return nil
}

// Un report sans date ni heure fixées attend dans « À recontacter », avec le commentaire.
func issueEnregistree(issue string, reporteAt *time.Time, commentaire *string) (enregistree string, note *string) {
	if issue != prospectIssueReporte || reporteAt != nil {
		return issue, commentaire
	}
	texte := ""
	if commentaire != nil {
		texte = strings.TrimSpace(*commentaire)
	}
	return prospectIssueARecontacter, &texte
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
	fiche, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	var reporteAt *time.Time
	if b.ReporteAt != nil {
		utc := b.ReporteAt.UTC()
		reporteAt = &utc
	}
	issue, note := issueEnregistree(b.Issue, b.ReporteAt, b.Commentaire)
	err = s.prospectTx(ctx, func(q *db.Queries) error {
		avant, err := q.SuivreRendezVous(ctx, db.SuivreRendezVousParams{
			Issue: issue, ReporteAt: reporteAt, Suite: b.SuiteRencontre, ID: in.ID,
			Note: note, RecontacterLe: dateFacultative(b.RecontacterLe), Par: &u.ID, Commentaire: b.Commentaire,
		})
		if errors.Is(err, pgx.ErrNoRows) && fiche.Phase2Status == string(db.Phase2StatusAPPOINTMENT) {
			return socle.Problem(http.StatusConflict, "RENDEZ_VOUS_GESTE_REFUSE",
				"Un rendez-vous annulé ne se note plus, et un RV téléphonique non joint se reporte.")
		}
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
	Localite                 string   `json:"localite" maxLength:"120"`
	Superficie               string   `json:"superficie" maxLength:"120"`
	NatureJuridique          string   `json:"natureJuridique" maxLength:"120"`
	EtatSite                 string   `json:"etatSite" maxLength:"120"`
	Position                 string   `json:"position" maxLength:"120"`
	AuNomDe                  string   `json:"auNomDe" maxLength:"120"`
	Titulaires               string   `json:"titulaires" maxLength:"200"`
	PieceIdentiteVerifiee    string   `json:"pieceIdentiteVerifiee" maxLength:"120"`
	PersonneExposee          string   `json:"personnePolitiquementExposee" maxLength:"120"`
	PaiementAcompte          string   `json:"paiementAcompte" maxLength:"120"`
	OrigineFondsJustifiee    string   `json:"origineFondsJustifiee" maxLength:"120"`
	FreinPrincipal           string   `json:"freinPrincipal" maxLength:"120"`
	AutresPromoteurs         string   `json:"autresPromoteurs" maxLength:"120"`
	Parrain                  string   `json:"parrain" maxLength:"120"`
	ChargeDeClientele        string   `json:"chargeDeClientele" maxLength:"120"`
	ProchaineAction          string   `json:"prochaineAction" maxLength:"120"`
	DateRelance              string   `json:"dateRelance" maxLength:"10" doc:"AAAA-MM-JJ, vide si aucune relance n'est prévue."`
	CompteRendu              string   `json:"compteRendu" maxLength:"4000"`
	Qualification            string   `json:"qualification" maxLength:"120"`
	QualificationCommentaire string   `json:"qualificationCommentaire" maxLength:"4000"`
	QualificationExterne     []string `json:"qualificationExterne" maxItems:"6" doc:"RV externe : cases cochées ; un choix hors liste est le texte de « Autre, à préciser »."`
	DateVisite               string   `json:"dateVisite" maxLength:"10" doc:"RV site : AAAA-MM-JJ, vide si inconnue."`
	HeureVisite              string   `json:"heureVisite" pattern:"^(([01][0-9]|2[0-3]):[0-5][0-9])?$" doc:"RV site : HH:MM, heure de Dakar, vide si inconnue."`
	PointRencontre           string   `json:"pointRencontre" maxLength:"120"`
	SiteInteresse            string   `json:"siteInteresse" maxLength:"120"`
	MoyensUtilises           string   `json:"moyensUtilises" maxLength:"120"`
	Accompagnement           string   `json:"accompagnement" maxLength:"120"`
	Agent                    string   `json:"agent" maxLength:"120"`
	Chauffeur                string   `json:"chauffeur" maxLength:"120"`
}

type ClosingInput struct {
	ID string `path:"id" format:"uuid"`
}

type ClosingOutput struct {
	Body struct {
		Closing Closing  `json:"closing" doc:"Vide, au nom de qui l'ouvre, tant que le formulaire n'a jamais été enregistré."`
		Sites   []string `json:"sites" doc:"Les sites de vente actifs, pour la localité du lot."`
		Charges []string `json:"chargesDeClientele" doc:"Les chargés de clientèle actifs, pour « Chargé de clientèle en charge » et l'agent d'un RV site."`
		Points  []string `json:"pointsRencontre" doc:"Les points de rencontre actifs, pour un RV site."`
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
		out.Body.Closing = Closing{ChargeDeClientele: u.FullName, QualificationExterne: []string{}}
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
	points, err := s.Q.RvSitePoints(ctx)
	if err != nil {
		return nil, err
	}
	out.Body.Points = make([]string, 0, len(points))
	for _, point := range points {
		out.Body.Points = append(out.Body.Points, point.Label)
	}
	return out, nil
}

func jourDuClosing(jour, code, message string) (pgtype.Date, error) {
	if jour == "" {
		return pgtype.Date{}, nil
	}
	t, err := time.Parse(formatJourRendezVous, jour)
	if err != nil {
		return pgtype.Date{}, socle.Problem(http.StatusBadRequest, code, message)
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func (s *service) closingEnregistrer(ctx context.Context, in *ClosingEnregistrerInput) (*ClosingOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	fiche, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	annule := fiche.RendezVousConfirmation != nil && *fiche.RendezVousConfirmation == "ANNULE"
	if fiche.RendezVousIssue == nil || *fiche.RendezVousIssue != prospectIssueHonore || annule {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "CLOSING_SANS_PRESENCE", "Le closing se remplit après un rendez-vous où le prospect était présent.")
	}
	b := &in.Body
	relance, err := jourDuClosing(b.DateRelance, "CLOSING_DATE_RELANCE", "La date de relance n'est pas une date.")
	if err != nil {
		return nil, err
	}
	visite, err := jourDuClosing(b.DateVisite, "CLOSING_DATE_VISITE", "La date de la visite n'est pas une date.")
	if err != nil {
		return nil, err
	}
	for _, choix := range b.QualificationExterne {
		if len([]rune(choix)) > 120 {
			return nil, socle.Problem(http.StatusBadRequest, "CLOSING_QUALIFICATION_LONGUE", "Une qualification tient en 120 caractères.")
		}
	}
	err = s.prospectTx(ctx, func(q *db.Queries) error {
		if _, err := q.EnregistrerClosing(ctx, db.EnregistrerClosingParams{
			ProspectID: in.ID, Localite: b.Localite, Superficie: b.Superficie, NatureJuridique: b.NatureJuridique,
			EtatSite: b.EtatSite, Position: b.Position, AuNomDe: b.AuNomDe, PieceIdentiteVerifiee: b.PieceIdentiteVerifiee,
			PaiementAcompte: b.PaiementAcompte, OrigineFondsJustifiee: b.OrigineFondsJustifiee, FreinPrincipal: b.FreinPrincipal,
			AutresPromoteurs: b.AutresPromoteurs, Parrain: b.Parrain, ChargeDeClientele: b.ChargeDeClientele,
			ProchaineAction: strings.TrimSpace(b.ProchaineAction), DateRelance: relance, CompteRendu: b.CompteRendu, AuteurID: u.ID,
			Titulaires: b.Titulaires, PersonnePolitiquementExposee: b.PersonneExposee,
			Qualification: b.Qualification, QualificationCommentaire: b.QualificationCommentaire,
			QualificationExterne: b.QualificationExterne, DateVisite: visite, HeureVisite: b.HeureVisite,
			PointRencontre: b.PointRencontre, SiteInteresse: b.SiteInteresse, MoyensUtilises: b.MoyensUtilises,
			Accompagnement: b.Accompagnement, Agent: b.Agent, Chauffeur: b.Chauffeur,
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
		Qualification: l.Qualification, QualificationCommentaire: l.QualificationCommentaire,
		QualificationExterne: l.QualificationExterne, DateVisite: jourOuVide(l.DateVisite), HeureVisite: l.HeureVisite,
		PointRencontre: l.PointRencontre, SiteInteresse: l.SiteInteresse, MoyensUtilises: l.MoyensUtilises,
		Accompagnement: l.Accompagnement, Agent: l.Agent, Chauffeur: l.Chauffeur,
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
