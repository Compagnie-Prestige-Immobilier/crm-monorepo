package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/analytics"
	"cpi-go/internal/shared/socle"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const qualificationAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

func qualificationCodeCourt(id string) string {
	somme := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(id))))
	bits := binary.BigEndian.Uint32(somme[:4]) >> 2
	code := make([]byte, 6)
	for i := range code {
		code[5-i] = qualificationAlphabet[bits&31]
		bits >>= 5
	}
	return string(code)
}

var qualificationTransitionsSuggestion = map[string][]string{
	string(db.SuggestionStatusAAPPELER):  {string(db.SuggestionStatusAPPELE), string(db.SuggestionStatusABANDONNE)},
	string(db.SuggestionStatusAPPELE):    {},
	string(db.SuggestionStatusABANDONNE): {},
}

func qualificationBorneJour(iso string, fin bool, loc *time.Location) (*time.Time, error) {
	j, err := time.ParseInLocation(time.DateOnly, iso, loc)
	if err != nil {
		return nil, socle.Problem(http.StatusBadRequest, "BAD_REQUEST", "Date invalide : "+iso)
	}
	if fin {
		j = j.Add(24*time.Hour - time.Millisecond)
	}
	borne := j.UTC()
	return &borne, nil
}

type QualificationRappelDTO struct {
	ID             string  `json:"id" format:"uuid"`
	ProspectID     string  `json:"prospectId" format:"uuid"`
	ShortCode      string  `json:"shortCode"`
	ProspectName   string  `json:"prospectName"`
	Projet         string  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	PhoneE164      *string `json:"phoneE164"`
	ScheduledAt    string  `json:"scheduledAt" format:"date-time"`
	Comment        *string `json:"comment"`
	AssignedToID   string  `json:"assignedToId" format:"uuid"`
	AssignedToName string  `json:"assignedToName"`
	// Le statut qui a promis le rappel : « RV téléphonique », « RV CPI »…
	ReasonLabel *string `json:"reasonLabel"`
	ReasonCode  *string `json:"reasonCode"`
	// Fiche en rendez-vous : seul le RDV téléphonique se reporte ou s'annule depuis Rappels.
	RendezVous bool `json:"rendezVous"`
	Overdue    bool `json:"overdue"`
}

type qualificationRappelLigne struct {
	ID, ProspectID, Prenom, Nom, Projet, AssigneID, AssigneNom string
	Phone                                                      *string
	Comment                                                    *string
	Motif, MotifCode                                           *string
	RendezVous                                                 bool
	Quand                                                      time.Time
}

func qualificationRappelDTO(l *qualificationRappelLigne, maintenant time.Time) QualificationRappelDTO {
	return QualificationRappelDTO{
		ID: l.ID, ProspectID: l.ProspectID, ShortCode: qualificationCodeCourt(l.ProspectID),
		ProspectName: strings.TrimSpace(l.Prenom + " " + l.Nom), PhoneE164: l.Phone,
		Projet:      l.Projet,
		ScheduledAt: qualificationISO(l.Quand), Comment: l.Comment, AssignedToID: l.AssigneID,
		ReasonLabel: l.Motif, ReasonCode: l.MotifCode, RendezVous: l.RendezVous,
		AssignedToName: l.AssigneNom, Overdue: l.Quand.Before(maintenant),
	}
}

type QualificationRappelsInput struct {
	Projet       string `query:"projet" enum:",CHUES,GRAND_PUBLIC"`
	Scope        string `query:"scope" enum:"today,overdue,week,all" default:"today"`
	AssignedToID string `query:"assignedToId" maxLength:"64"`
	Page         int    `query:"page" minimum:"1" maximum:"100000" default:"1"`
	PageSize     int    `query:"pageSize" minimum:"1" maximum:"100" default:"50"`
}

type QualificationRappelsOutput struct {
	Body struct {
		Items      []QualificationRappelDTO `json:"items"`
		ServerTime string                   `json:"serverTime" format:"date-time"`
		Total      int                      `json:"total"`
		Page       int                      `json:"page"`
		PageSize   int                      `json:"pageSize"`
		PageCount  int                      `json:"pageCount"`
	}
}

// « Tous » ne borne rien : un rappel promis dans trois semaines se voit quand même.
func qualificationBorneRappels(portee string, maintenant time.Time, zone *time.Location) time.Time {
	if portee == "all" {
		return time.Date(9999, 12, 31, 23, 59, 59, 0, time.UTC)
	}
	if portee == "overdue" {
		return maintenant
	}
	jours := 0
	if portee == analytics.CleSemaine {
		jours = 6
	}
	local := maintenant.In(zone)
	return time.Date(local.Year(), local.Month(), local.Day()+jours, 23, 59, 59,
		int(999*time.Millisecond), zone).UTC()
}

const (
	rappelsPageMax        = 100000
	rappelsPageSizeMax    = 100
	rappelsPageSizeDefaut = 50
)

// Le RETARD n'est pas un statut : un rappel de la veille reste PENDING et
// remonte dans la journée courante.
func (s *service) qualificationListerRappels(ctx context.Context, in *QualificationRappelsInput) (*QualificationRappelsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	maintenant := time.Now().UTC()
	borne := qualificationBorneRappels(in.Scope, maintenant, s.Cfg.TimeZone)
	p := db.ListerRappelsParams{Avant: &borne}
	page := in.Page
	if page < 1 || page > rappelsPageMax {
		page = 1
	}
	pageSize := in.PageSize
	if pageSize < 1 || pageSize > rappelsPageSizeMax {
		pageSize = rappelsPageSizeDefaut
	}
	p.PageOffset = int32(page-1) * int32(pageSize)
	p.PageSize = int32(pageSize)
	if in.Projet != "" {
		p.Projet = &in.Projet
	}
	assigne := in.AssignedToID
	if !qualificationVoitTout(&u) {
		assigne = u.ID
	}
	if assigne != "" {
		p.AssignedToID = &assigne
	}
	rows, err := s.Q.ListerRappels(ctx, p)
	if err != nil {
		return nil, err
	}
	total, err := s.Q.CompterRappels(ctx, db.CompterRappelsParams{
		Avant: p.Avant, AssignedToID: p.AssignedToID, Projet: p.Projet,
	})
	if err != nil {
		return nil, err
	}
	out := &QualificationRappelsOutput{}
	out.Body.Items = make([]QualificationRappelDTO, 0, len(rows))
	out.Body.ServerTime = qualificationISO(maintenant)
	out.Body.Total = int(total)
	out.Body.Page = page
	out.Body.PageSize = pageSize
	out.Body.PageCount = (int(total) + pageSize - 1) / pageSize
	for i := range rows {
		r := &rows[i]
		out.Body.Items = append(out.Body.Items, qualificationRappelDTO(&qualificationRappelLigne{
			ID: r.ID, ProspectID: r.ProspectId, Prenom: r.Prenom, Nom: r.Nom, Phone: r.PhoneE164,
			Projet: string(r.Projet), Comment: r.Comment, Motif: r.ReasonLabel, MotifCode: r.ReasonCode, RendezVous: r.RendezVous,
			AssigneID: r.AssignedToId, AssigneNom: r.AssignedToName, Quand: r.ScheduledAt,
		}, maintenant))
	}
	return out, nil
}

type QualificationIDInput struct {
	ID string `path:"id" format:"uuid"`
}

type QualificationRappelOutput struct {
	Body QualificationRappelDTO
}

type QualificationReportInput struct {
	ID    string `path:"id" format:"uuid"`
	Duree string `query:"duree" enum:",15min,1h,2h,demain" doc:"Absente : 15 minutes. « demain » : le lendemain à 8 h 30, heure de Dakar."`
}

var qualificationReports = map[string]time.Duration{"": 15 * time.Minute, "15min": 15 * time.Minute, "1h": time.Hour, "2h": 2 * time.Hour}

func qualificationReportA(duree string, maintenant time.Time, zone *time.Location) time.Time {
	if ecart, ok := qualificationReports[duree]; ok {
		return maintenant.Add(ecart).UTC()
	}
	local := maintenant.In(zone)
	return time.Date(local.Year(), local.Month(), local.Day()+1, 8, 30, 0, 0, zone).UTC()
}

func (s *service) qualificationRappelAMoi(ctx context.Context, u *socle.Utilisateur, id string) (db.RappelParIdRow, error) {
	row, err := s.Q.RappelParId(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return row, socle.Problem(http.StatusNotFound, "CALLBACK_NOT_FOUND", "Rappel introuvable.")
	}
	if err != nil {
		return row, err
	}
	if !u.Peut(socle.PermissionFichesIgnorerPropriete) && row.AssignedToId != u.ID {
		return row, socle.Problem(http.StatusForbidden, "NOT_OWNER", "Ce rappel a été promis par un autre téléconseiller.")
	}
	return row, nil
}

func qualificationRappelSortie(row *db.RappelParIdRow) *QualificationRappelOutput {
	return &QualificationRappelOutput{Body: qualificationRappelDTO(&qualificationRappelLigne{
		ID: row.ID, ProspectID: row.ProspectId, Prenom: row.Prenom, Nom: row.Nom, Phone: row.PhoneE164,
		Projet: string(row.Projet), Comment: row.Comment, Motif: row.ReasonLabel, MotifCode: row.ReasonCode,
		RendezVous: row.RendezVous, AssigneID: row.AssignedToId, AssigneNom: row.AssignedToName, Quand: row.ScheduledAt,
	}, time.Now().UTC())}
}

func (s *service) qualificationReporterRappel(ctx context.Context, in *QualificationReportInput) (*QualificationRappelOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	row, err := s.qualificationRappelAMoi(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	if row.RendezVousNonReportable && row.Status == db.ScheduledCallbackStatusPENDING {
		return nil, socle.Problem(http.StatusConflict, "RENDEZ_VOUS_NON_REPORTABLE",
			"Un rendez-vous ne se reporte pas d'ici : changez sa date en requalifiant la fiche.")
	}
	if row.Status == db.ScheduledCallbackStatusPENDING {
		row.ScheduledAt = qualificationReportA(in.Duree, time.Now(), s.Cfg.TimeZone)
		if err := s.Q.ReporterRappel(ctx, db.ReporterRappelParams{ID: row.ID, ScheduledAt: row.ScheduledAt}); err != nil {
			return nil, err
		}
	}
	return qualificationRappelSortie(&row), nil
}

func (s *service) qualificationAnnulerRappel(ctx context.Context, in *QualificationIDInput) (*QualificationRappelOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	row, err := s.qualificationRappelAMoi(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	if row.Status == db.ScheduledCallbackStatusPENDING {
		if err := s.Q.AnnulerRappel(ctx, in.ID); err != nil {
			return nil, err
		}
	}
	return qualificationRappelSortie(&row), nil
}

// Rejouer « Rétablir » sur un rappel déjà en attente ne change rien.
func (s *service) qualificationRetablirRappel(ctx context.Context, in *QualificationIDInput) (*QualificationRappelOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	row, err := s.qualificationRappelAMoi(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	if row.Status == db.ScheduledCallbackStatusPENDING {
		return qualificationRappelSortie(&row), nil
	}
	n, err := s.Q.RetablirRappel(ctx, in.ID)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return nil, socle.Problem(http.StatusConflict, "RAPPEL_DEJA_PROMIS",
			"Un autre rappel est déjà promis pour cette fiche : celui-ci ne peut pas être rétabli.")
	}
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, socle.Problem(http.StatusConflict, "RAPPEL_NON_RETABLISSABLE",
			"Ce rappel a été tenu, remplacé ou sa fiche supprimée : il ne peut pas être rétabli.")
	}
	return qualificationRappelSortie(&row), nil
}

type QualificationOuvertureFicheDTO struct {
	ID               string         `json:"id" format:"uuid"`
	OpenedByID       string         `json:"openedById" format:"uuid"`
	OpenedByName     string         `json:"openedByName"`
	RepresentantID   *string        `json:"representantId"`
	ProspectID       *string        `json:"prospectId"`
	FicheNom         string         `json:"ficheNom"`
	OpenedAt         string         `json:"openedAt" format:"date-time"`
	FirstInputAt     *string        `json:"firstInputAt"`
	ClosedAt         *string        `json:"closedAt"`
	DureeSecondes    *int64         `json:"dureeSecondes"`
	ClosingAttemptID *string        `json:"closingAttemptId"`
	Draft            map[string]any `json:"draft"`
	ReleasedByName   *string        `json:"releasedByName"`
	ReleasedAt       *string        `json:"releasedAt"`
}

// Le chronomètre court de la première saisie à la qualification : le temps de
// lecture de la fiche n'est pas du traitement.
func qualificationOuvertureDTO(row *db.ListerOuverturesRow) QualificationOuvertureFicheDTO {
	o := QualificationOuvertureFicheDTO{
		ID: row.ID, OpenedByID: row.OpenedById, OpenedByName: row.OpenedByName,
		RepresentantID: row.RepresentantId, ProspectID: row.ProspectId, FicheNom: row.FicheNom,
		OpenedAt: qualificationISO(row.OpenedAt), FirstInputAt: qualificationISOPtr(row.FirstInputAt),
		ClosedAt: qualificationISOPtr(row.ClosedAt), ClosingAttemptID: row.ClosingAttemptId,
		ReleasedByName: row.ReleasedByName, ReleasedAt: qualificationISOPtr(row.ReleasedAt),
	}
	if row.FirstInputAt != nil && row.ClosedAt != nil {
		secondes := int64(row.ClosedAt.Sub(*row.FirstInputAt).Round(time.Second).Seconds())
		o.DureeSecondes = &secondes
	}
	if len(row.Draft) > 0 {
		_ = json.Unmarshal(row.Draft, &o.Draft)
	}
	return o
}

func qualificationOuvertureParID(ctx context.Context, q *db.Queries, id string) (QualificationOuvertureFicheDTO, error) {
	rows, err := q.ListerOuvertures(ctx, db.ListerOuverturesParams{ID: &id})
	if err != nil {
		return QualificationOuvertureFicheDTO{}, err
	}
	if len(rows) == 0 {
		return QualificationOuvertureFicheDTO{}, socle.Problem(http.StatusNotFound, "OUVERTURE_INTROUVABLE",
			"Cette ouverture n’existe pas, ou elle appartient à un autre téléconseiller.")
	}
	return qualificationOuvertureDTO(&rows[0]), nil
}

type QualificationOuvrirFicheInput struct {
	Body struct {
		ID             string         `json:"id" format:"uuid"`
		RepresentantID *string        `json:"representantId,omitempty" format:"uuid"`
		ProspectID     *string        `json:"prospectId,omitempty" format:"uuid"`
		OpenedAt       time.Time      `json:"openedAt" format:"date-time"`
		Draft          map[string]any `json:"draft,omitempty"`
	}
}

type QualificationOuvertureOutput struct {
	Body QualificationOuvertureFicheDTO
}

func (s *service) qualificationOuvrirFiche(ctx context.Context, in *QualificationOuvrirFicheInput) (*QualificationOuvertureOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	b := &in.Body
	if (b.RepresentantID == nil) == (b.ProspectID == nil) {
		return nil, socle.Problem(http.StatusBadRequest, "OUVERTURE_CIBLE_INVALIDE",
			"Une ouverture porte sur un représentant OU sur un prospect, jamais sur les deux.")
	}
	rejoue, err := s.Q.ListerOuvertures(ctx, db.ListerOuverturesParams{ID: &b.ID})
	if err != nil {
		return nil, err
	}
	if len(rejoue) == 1 {
		if rejoue[0].OpenedById != u.ID {
			return nil, socle.Problem(http.StatusConflict, "OUVERTURE_ID_PRIS",
				"Cet identifiant d’ouverture appartient déjà à un autre téléconseiller.")
		}
		return &QualificationOuvertureOutput{Body: qualificationOuvertureDTO(&rejoue[0])}, nil
	}
	if err := s.qualificationFicheOuvrable(ctx, &u, b.RepresentantID, b.ProspectID); err != nil {
		return nil, err
	}
	brouillon, err := s.qualificationBrouillonDeDepart(ctx, &u, b.RepresentantID, b.ProspectID, b.Draft)
	if err != nil {
		return nil, err
	}
	out := &QualificationOuvertureOutput{}
	err = qualificationTx(ctx, s, func(q *db.Queries) error {
		dto, e := qualificationCreerOuverture(ctx, q, &u, in, brouillon)
		out.Body = dto
		return e
	})
	if err == nil {
		return out, nil
	}
	return s.qualificationOuvertureConcurrente(ctx, &u, b.ID, err)
}

// Le 23505 avorte la transaction : la relecture qui sépare le rejeu d'un
// identifiant pris se fait donc après son annulation.
func (s *service) qualificationOuvertureConcurrente(ctx context.Context, u *socle.Utilisateur, id string, cause error) (*QualificationOuvertureOutput, error) {
	var p *socle.ProblemError
	if !errors.As(cause, &p) || p.Code != "OUVERTURE_ID_PRIS" {
		return nil, cause
	}
	rows, err := s.Q.ListerOuvertures(ctx, db.ListerOuverturesParams{ID: &id})
	if err != nil {
		return nil, err
	}
	if len(rows) == 1 && rows[0].OpenedById == u.ID {
		return &QualificationOuvertureOutput{Body: qualificationOuvertureDTO(&rows[0])}, nil
	}
	return nil, cause
}

func (s *service) qualificationFicheOuvrable(ctx context.Context, u *socle.Utilisateur, representantID, prospectID *string) error {
	introuvable := socle.Problem(http.StatusNotFound, "OUVERTURE_FICHE_INTROUVABLE",
		"Cette fiche n’existe pas, elle n’est pas dans vos campagnes, ou elle est attribuée à quelqu’un d’autre.")
	if representantID != nil {
		_, err := s.Q.RepresentantAQualifier(ctx, db.RepresentantAQualifierParams{
			ID: *representantID, Tous: qualificationVoitTout(u), Agent: u.ID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return introuvable
		}
		return err
	}
	ouvrable, err := s.Q.ProspectOuvrable(ctx, db.ProspectOuvrableParams{
		ID: *prospectID, Tous: qualificationVoitTout(u), Agent: u.ID,
		IgnorerAttribution: u.Peut(socle.PermissionFichesOuvrirAttribuees),
		ConvertiVisible:    u.Peut(socle.PermissionFichesVoirConverties),
	})
	if err != nil {
		return err
	}
	if !ouvrable {
		return introuvable
	}
	return nil
}

// EB-10 : au rappel, le formulaire se rouvre pré-rempli. La reprise se limite
// à l'ouverture précédente du MÊME téléconseiller.
func (s *service) qualificationBrouillonDeDepart(ctx context.Context, u *socle.Utilisateur, representantID, prospectID *string, saisi map[string]any) ([]byte, error) {
	if saisi != nil {
		return json.Marshal(saisi)
	}
	brut, err := s.Q.BrouillonPrecedent(ctx, db.BrouillonPrecedentParams{
		OpenedByID: u.ID, RepresentantID: representantID, ProspectID: prospectID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return brut, err
}

func qualificationCreerOuverture(ctx context.Context, q *db.Queries, u *socle.Utilisateur, in *QualificationOuvrirFicheInput, brouillon []byte) (QualificationOuvertureFicheDTO, error) {
	b := &in.Body
	err := q.CreerOuverture(ctx, db.CreerOuvertureParams{
		ID: b.ID, OpenedByID: u.ID, RepresentantID: b.RepresentantID, ProspectID: b.ProspectID,
		OpenedAt: b.OpenedAt.UTC(), Draft: brouillon,
	})
	if err == nil {
		return qualificationOuvertureParID(ctx, q, b.ID)
	}
	var pg *pgconn.PgError
	if !errors.As(err, &pg) || pg.Code != "23505" {
		return QualificationOuvertureFicheDTO{}, err
	}
	return QualificationOuvertureFicheDTO{}, socle.Problem(http.StatusConflict, "OUVERTURE_ID_PRIS",
		"Cet identifiant d’ouverture appartient déjà à un autre téléconseiller.")
}

type QualificationOuvertureCouranteOutput struct {
	Body *QualificationOuvertureFicheDTO
}

type QualificationOuvertureCouranteInput struct {
	Cible string `query:"cible" enum:"representant,prospect"`
}

// Sans verrou, plusieurs fiches restent ouvertes : chaque console demande la
// sienne, et reprend la plus récente.
func (s *service) qualificationOuvertureCourante(ctx context.Context, in *QualificationOuvertureCouranteInput) (*QualificationOuvertureCouranteOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	var cible *string
	if in.Cible != "" {
		cible = &in.Cible
	}
	rows, err := s.Q.ListerOuvertures(ctx, db.ListerOuverturesParams{OpenedByID: &u.ID, OuvertesSeulement: true, Cible: cible})
	if err != nil {
		return nil, err
	}
	out := &QualificationOuvertureCouranteOutput{}
	if len(rows) > 0 {
		dto := qualificationOuvertureDTO(&rows[0])
		out.Body = &dto
	}
	return out, nil
}

type QualificationBrouillonInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Draft        map[string]any `json:"draft"`
		FirstInputAt *time.Time     `json:"firstInputAt,omitempty" format:"date-time"`
	}
}

// La première requête de brouillon EST la première saisie : `firstInputAt` ne
// se pose qu'une fois, tenu par le `where` et non par l'écran.
func (s *service) qualificationEnregistrerBrouillon(ctx context.Context, in *QualificationBrouillonInput) (*QualificationOuvertureOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	brut, err := json.Marshal(in.Body.Draft)
	if err != nil {
		return nil, err
	}
	out := &QualificationOuvertureOutput{}
	err = qualificationTx(ctx, s, func(q *db.Queries) error {
		n, e := q.EnregistrerBrouillon(ctx, db.EnregistrerBrouillonParams{Draft: brut, ID: in.ID, OpenedByID: u.ID})
		if e != nil {
			return e
		}
		if n == 0 {
			return qualificationBrouillonRefuse(ctx, q, &u, in.ID)
		}
		at := time.Now().UTC()
		if in.Body.FirstInputAt != nil {
			at = in.Body.FirstInputAt.UTC()
		}
		if e := q.PoserPremiereSaisie(ctx, db.PoserPremiereSaisieParams{At: &at, ID: in.ID, OpenedByID: u.ID}); e != nil {
			return e
		}
		out.Body, e = qualificationOuvertureParID(ctx, q, in.ID)
		return e
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// « Pas à vous » ne se confond pas avec « déjà qualifiée ».
func qualificationBrouillonRefuse(ctx context.Context, q *db.Queries, u *socle.Utilisateur, id string) error {
	row, err := q.OuvertureEtat(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && row.OpenedById != u.ID) {
		return socle.Problem(http.StatusNotFound, "OUVERTURE_INTROUVABLE",
			"Cette ouverture n’existe pas, ou elle appartient à un autre téléconseiller.")
	}
	if err != nil {
		return err
	}
	return socle.Problem(http.StatusConflict, "OUVERTURE_DEJA_FERMEE", "Cette fiche a déjà été qualifiée ou libérée.")
}

type QualificationComptageInput struct {
	From       string `query:"from" pattern:"^\\d{4}-\\d{2}-\\d{2}$"`
	To         string `query:"to" pattern:"^\\d{4}-\\d{2}-\\d{2}$"`
	OpenedByID string `query:"openedById" maxLength:"64"`
}

type QualificationComptageJourDTO struct {
	OpenedByID           string `json:"openedById" format:"uuid"`
	OpenedByName         string `json:"openedByName"`
	Jour                 string `json:"jour"`
	Ouvertures           int32  `json:"ouvertures"`
	Qualifiees           int32  `json:"qualifiees"`
	Liberees             int32  `json:"liberees"`
	DureeMoyenneSecondes *int32 `json:"dureeMoyenneSecondes"`
	// Une fiche déjà qualifiée qu'on qualifie de nouveau : comptée ici, pas dans le taux de qualification.
	OuverturesDejaQualifiees int32 `json:"ouverturesDejaQualifiees"`
	Requalifiees             int32 `json:"requalifiees"`
}

type QualificationComptageOutput struct {
	Body struct {
		Items   []QualificationComptageJourDTO `json:"items"`
		Tronque bool                           `json:"tronque" doc:"Plus de 3 000 lignes : seules les plus récentes sont rendues."`
	}
}

const (
	comptageLignesMax  = 3000
	comptagePeriodeMax = 366 * 24 * time.Hour
)

// Un téléconseiller ne lit que son propre compte.
func (s *service) qualificationComptage(ctx context.Context, in *QualificationComptageInput) (*QualificationComptageOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	p := db.ComptageOuverturesParams{}
	borne := in.OpenedByID
	if !qualificationVoitTout(&u) {
		borne = u.ID
	}
	if borne != "" {
		p.OpenedByID = &borne
	}
	var err error
	if p.Depuis, p.Jusqua, err = qualificationPeriodeComptage(in.From, in.To, s.Cfg.TimeZone); err != nil {
		return nil, err
	}
	rows, err := s.Q.ComptageOuvertures(ctx, p)
	if err != nil {
		return nil, err
	}
	out := &QualificationComptageOutput{}
	out.Body.Tronque = len(rows) > comptageLignesMax
	rows = rows[:min(len(rows), comptageLignesMax)]
	out.Body.Items = make([]QualificationComptageJourDTO, 0, len(rows))
	for i := range rows {
		out.Body.Items = append(out.Body.Items, qualificationComptageDTO(&rows[i]))
	}
	return out, nil
}

func qualificationPeriodeComptage(du, au string, zone *time.Location) (depuis, jusqua *time.Time, err error) {
	if du == "" || au == "" {
		return nil, nil, socle.Problem(http.StatusBadRequest, "PERIODE_REQUISE", "Indiquez le premier et le dernier jour de la période.")
	}
	if depuis, err = qualificationBorneJour(du, false, zone); err != nil {
		return nil, nil, err
	}
	if jusqua, err = qualificationBorneJour(au, true, zone); err != nil {
		return nil, nil, err
	}
	if jusqua.Before(*depuis) || jusqua.Sub(*depuis) > comptagePeriodeMax {
		return nil, nil, socle.Problem(http.StatusBadRequest, "PERIODE_INVALIDE", "La période va d'un jour à un an, le premier jour avant le dernier.")
	}
	return depuis, jusqua, nil
}

func qualificationComptageDTO(r *db.ComptageOuverturesRow) QualificationComptageJourDTO {
	item := QualificationComptageJourDTO{
		OpenedByID: r.OpenedById, OpenedByName: r.OpenedByName, Jour: r.Jour,
		Ouvertures: r.Ouvertures, Qualifiees: r.Qualifiees, Liberees: r.Liberees,
		OuverturesDejaQualifiees: r.OuverturesDejaQualifiees, Requalifiees: r.Requalifiees,
	}
	// Une ouverture fermée sans aucune saisie sort du dénominateur au lieu d'y
	// entrer avec une durée de zéro.
	if r.Mesurees > 0 {
		moyenne := r.DureeMoyenneSecondes
		item.DureeMoyenneSecondes = &moyenne
	}
	return item
}

type QualificationSuggestionDTO struct {
	ID                          string  `json:"id" format:"uuid"`
	SourceRepresentantID        string  `json:"sourceRepresentantId" format:"uuid"`
	SourceRepresentantShortCode string  `json:"sourceRepresentantShortCode"`
	SourceRepresentantName      string  `json:"sourceRepresentantName"`
	SuggestedName               *string `json:"suggestedName"`
	SuggestedPhoneE164          string  `json:"suggestedPhoneE164"`
	Note                        *string `json:"note"`
	Status                      string  `json:"status" enum:"A_APPELER,APPELE,ABANDONNE"`
	SuggestedByID               string  `json:"suggestedById" format:"uuid"`
	SuggestedByName             string  `json:"suggestedByName"`
	ResolvedRepresentantID      *string `json:"resolvedRepresentantId"`
	ClientCreatedAt             string  `json:"clientCreatedAt" format:"date-time"`
	CreatedAt                   string  `json:"createdAt" format:"date-time"`
}

// Le représentant source est désigné par son code court, comme sur le
// programme papier : aucun nom n'y figure.
func qualificationSuggestionDTO(row *db.ListerSuggestionsRow) QualificationSuggestionDTO {
	return QualificationSuggestionDTO{
		ID: row.ID, SourceRepresentantID: row.SourceRepresentantId,
		SourceRepresentantShortCode: qualificationCodeCourt(row.SourceRepresentantId),
		SourceRepresentantName:      row.SourceRepresentantName,
		SuggestedName:               row.SuggestedName, SuggestedPhoneE164: row.SuggestedPhoneE164,
		Note: row.Note, Status: string(row.Status), SuggestedByID: row.SuggestedById,
		SuggestedByName: row.SuggestedByName, ResolvedRepresentantID: row.ResolvedRepresentantId,
		ClientCreatedAt: qualificationISO(row.ClientCreatedAt), CreatedAt: qualificationISO(row.CreatedAt),
	}
}

type QualificationSuggestionsInput struct {
	Status   string `query:"status" enum:",A_APPELER,APPELE,ABANDONNE"`
	Page     int32  `query:"page" minimum:"1" maximum:"10000" default:"1"`
	PageSize int32  `query:"pageSize" minimum:"1" maximum:"100" default:"25"`
}

type QualificationSuggestionsOutput struct {
	Body struct {
		Items []QualificationSuggestionDTO `json:"items"`
		Meta  struct {
			Total     int32 `json:"total"`
			Page      int32 `json:"page"`
			PageSize  int32 `json:"pageSize"`
			PageCount int32 `json:"pageCount"`
		} `json:"meta"`
	}
}

// Une piste est le numéro d'un TIERS, donné à un téléconseiller précis : sans
// cette portée, chacun lirait le carnet de ses collègues.
func (s *service) qualificationListerSuggestions(ctx context.Context, in *QualificationSuggestionsInput) (*QualificationSuggestionsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	p := db.ListerSuggestionsParams{
		Tous: qualificationVoitTout(&u), Agent: u.ID, Lim: in.PageSize,
		Decalage: (in.Page - 1) * in.PageSize,
	}
	if in.Status != "" {
		p.Statut = &in.Status
	}
	rows, err := s.Q.ListerSuggestions(ctx, p)
	if err != nil {
		return nil, err
	}
	out := &QualificationSuggestionsOutput{}
	out.Body.Items = make([]QualificationSuggestionDTO, 0, len(rows))
	for i := range rows {
		out.Body.Items = append(out.Body.Items, qualificationSuggestionDTO(&rows[i]))
	}
	out.Body.Meta.Page, out.Body.Meta.PageSize = in.Page, in.PageSize
	if len(rows) > 0 {
		out.Body.Meta.Total = rows[0].Total
	}
	out.Body.Meta.PageCount = 1
	if out.Body.Meta.Total > 0 {
		out.Body.Meta.PageCount = 1 + (out.Body.Meta.Total-1)/in.PageSize
	}
	return out, nil
}

type QualificationSuggestionStatutInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Status string `json:"status" enum:"A_APPELER,APPELE,ABANDONNE"`
	}
}

type QualificationSuggestionOutput struct {
	Body QualificationSuggestionDTO
}

// Une piste soldée l'est : « appelé » et « abandonné » sont terminaux. Le
// statut de départ est dans le `where`, deux bascules ne peuvent pas se croiser.
func (s *service) qualificationBasculerSuggestion(ctx context.Context, in *QualificationSuggestionStatutInput) (*QualificationSuggestionOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	introuvable := socle.Problem(http.StatusNotFound, "SUGGESTION_NOT_FOUND", "Ce numéro suggéré est introuvable.")
	tous := qualificationVoitTout(&u)
	courant, err := s.Q.SuggestionCourante(ctx, db.SuggestionCouranteParams{ID: in.ID, Tous: tous, Agent: u.ID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, introuvable
	}
	if err != nil {
		return nil, err
	}
	depuis := string(courant)
	if !u.Peut(socle.PermissionFichesForcerTransition) && !qualificationTransitionLegale(qualificationTransitionsSuggestion, depuis, in.Body.Status) {
		return nil, socle.Problem(http.StatusForbidden, "SUGGESTION_TRANSITION_REFUSED",
			"Numéro suggéré : le passage de « "+depuis+" » à « "+in.Body.Status+" » n’est pas permis.")
	}
	n, err := s.Q.BasculerSuggestion(ctx, db.BasculerSuggestionParams{
		Vers: in.Body.Status, ID: in.ID, Depuis: depuis, Tous: tous, Agent: u.ID,
	})
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, introuvable
	}
	rows, err := s.Q.ListerSuggestions(ctx, db.ListerSuggestionsParams{
		Tous: true, Agent: u.ID, ID: &in.ID, Lim: 1, Decalage: 0,
	})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, introuvable
	}
	return &QualificationSuggestionOutput{Body: qualificationSuggestionDTO(&rows[0])}, nil
}
