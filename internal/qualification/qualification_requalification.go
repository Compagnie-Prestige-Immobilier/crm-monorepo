package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

const (
	qualificationActionRequalification = "prospect.requalification"
	qualificationActionEncadrement     = "requalification_encadrement"
	qualificationCleMotif              = "motif"
	qualificationCleStatut             = "statut"
)

// Une fiche classée que le téléconseiller requalifie revient en cours. Sans
// cela le statut restait celui du premier classement, et l'écran affichait
// « Refus » sur une fiche dont le dernier appel disait autre chose.
func qualificationRouvrirFiche(ctx context.Context, q *db.Queries, u *socle.Utilisateur, prospectID string, parcours *db.ParcoursDuProspectRow) (QualificationProspectPhase2StateDTO, error) {
	if parcours.Phase2Status == db.Phase2StatusPENDING {
		return qualificationEtatRelu(ctx, q, prospectID)
	}
	avant := qualificationTraceStatut(parcours)
	ouvert := string(db.Phase2StatusPENDING)
	if err := q.CloreParcours(ctx, db.CloreParcoursParams{Phase2Status: ouvert, ID: parcours.ID}); err != nil {
		return QualificationProspectPhase2StateDTO{}, err
	}
	if err := q.CloreProspectParTentative(ctx, db.CloreProspectParTentativeParams{Phase2Status: ouvert, ID: prospectID}); err != nil {
		return QualificationProspectPhase2StateDTO{}, err
	}
	etat, err := qualificationEtatRelu(ctx, q, prospectID)
	if err != nil {
		return etat, err
	}
	relu := db.ParcoursDuProspectRow{Phase2Status: db.Phase2Status(etat.Phase2Status)}
	if etat.EnrollmentMethod != nil {
		methode := db.EnrollmentMethod(*etat.EnrollmentMethod)
		relu.EnrollmentMethod = &methode
	}
	return etat, database.Auditer(ctx, q, u.ID, qualificationActionRequalification, "prospect", prospectID, avant, qualificationTraceStatut(&relu))
}

func qualificationTraceStatut(parcours *db.ParcoursDuProspectRow) map[string]any {
	trace := map[string]any{"phase2Status": string(parcours.Phase2Status)}
	if parcours.EnrollmentMethod != nil {
		trace["enrollmentMethod"] = string(*parcours.EnrollmentMethod)
	}
	return trace
}

type QualificationRequalifierProspectInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		ReasonCode string     `json:"reasonCode" minLength:"1" maxLength:"40"`
		CallbackAt *time.Time `json:"callbackAt,omitempty" format:"date-time"`
	}
}

type QualificationRequalifierProspectOutput struct {
	Body QualificationProspectPhase2StateDTO
}

// L'encadrement pose le motif sans appel : la fiche suit l'effet du motif
// comme après un appel, mais aucune tentative n'est comptée à personne et le
// rappel promis revient au dernier appelant.
func (s *service) qualificationRequalifierProspect(ctx context.Context, in *QualificationRequalifierProspectInput) (*QualificationRequalifierProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	motif, err := s.qualificationMotifDeLIssue(ctx, in.Body.ReasonCode)
	if err != nil {
		return nil, err
	}
	issue := qualificationIssue{
		prospectID: in.ID, motif: motif, regle: qualificationReglesEffet[motif.effet],
		reference: time.Now().UTC(), assignedTo: u.ID,
	}
	rappel, err := qualificationRappelPromis(in.Body.CallbackAt, issue.reference, &issue.motif, &issue.regle)
	if err != nil {
		return nil, err
	}
	issue.callbackAt = qualificationInstant(rappel)
	out := &QualificationRequalifierProspectOutput{}
	err = qualificationTx(ctx, s, func(q *db.Queries) error {
		var e error
		out.Body, e = qualificationAppliquerRequalification(ctx, q, &u, &issue)
		return e
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func qualificationAppliquerRequalification(ctx context.Context, q *db.Queries, u *socle.Utilisateur, issue *qualificationIssue) (QualificationProspectPhase2StateDTO, error) {
	var vide QualificationProspectPhase2StateDTO
	avant, err := q.ProspectPourRequalification(ctx, issue.prospectID)
	if errors.Is(err, pgx.ErrNoRows) {
		return vide, socle.Problem(http.StatusNotFound, "PHASE2_PROSPECT_NOT_FOUND", "Prospect introuvable ou supprimé.")
	}
	if err != nil {
		return vide, err
	}
	if avant.Statut == db.ProspectStatutCONVERTI || avant.Statut == db.ProspectStatutVENDU {
		return vide, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_CONVERTI", "Une fiche convertie ou vendue ne se requalifie pas.")
	}
	issue.statut = avant.Statut
	if avant.LastCallById != nil {
		issue.assignedTo = *avant.LastCallById
	}
	parcours, err := qualificationOuvrirParcours(ctx, q, issue.prospectID, avant.Projet)
	if err != nil {
		return vide, err
	}
	if err := q.RequalifierMotifProspect(ctx, db.RequalifierMotifProspectParams{ReasonID: issue.motif.id, ID: issue.prospectID}); err != nil {
		return vide, err
	}
	if err := qualificationPlanifierRappel(ctx, q, issue); err != nil {
		return vide, err
	}
	etat, err := qualificationAppliquerIssue(ctx, q, u, issue, &parcours)
	if err != nil {
		return vide, err
	}
	return etat, database.Auditer(ctx, q, u.ID, "prospect."+qualificationActionEncadrement, "prospect", issue.prospectID,
		map[string]any{qualificationCleMotif: avant.MotifLabel},
		map[string]any{qualificationCleMotif: issue.motif.label, "phase2Status": etat.Phase2Status})
}

type QualificationRequalifierRepresentantInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		StatutQualificationID string     `json:"statutQualificationId" format:"uuid"`
		CallbackAt            *time.Time `json:"callbackAt,omitempty" format:"date-time"`
	}
}

type QualificationRequalifierRepresentantOutput struct {
	Body struct {
		StatutQualificationID string `json:"statutQualificationId"`
		RelationStatus        string `json:"relationStatus"`
	}
}

func (s *service) qualificationRequalifierRepresentant(ctx context.Context, in *QualificationRequalifierRepresentantInput) (*QualificationRequalifierRepresentantOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	statut, err := s.qualificationStatutActif(ctx, in.Body.StatutQualificationID)
	if err != nil {
		return nil, err
	}
	if err := qualificationReglesRepIssue(in.Body.CallbackAt, &statut); err != nil {
		return nil, err
	}
	out := &QualificationRequalifierRepresentantOutput{}
	out.Body.StatutQualificationID = statut.ID
	err = qualificationTx(ctx, s, func(q *db.Queries) error {
		avant, e := q.RepresentantPourRequalification(ctx, in.ID)
		if errors.Is(e, pgx.ErrNoRows) {
			return socle.Problem(http.StatusNotFound, "REPRESENTANT_NOT_FOUND", "Représentant introuvable.")
		}
		if e != nil {
			return e
		}
		quand, origine := qualificationProchainRappel(in.Body.CallbackAt, time.Now().UTC(), &statut)
		if e := q.RequalifierRepresentant(ctx, db.RequalifierRepresentantParams{
			StatutQualificationID: &statut.ID, NextCallbackAt: quand, NextCallbackOrigine: origine, ID: in.ID,
		}); e != nil {
			return e
		}
		depuis := string(avant.RelationStatus)
		vers := qualificationRelationAPoser(&QualificationRepAttemptBody{}, &statut, depuis)
		if e := qualificationBasculerRelation(ctx, q, in.ID, depuis, vers, u.ID); e != nil {
			return e
		}
		out.Body.RelationStatus = depuis
		if vers != nil {
			out.Body.RelationStatus = *vers
		}
		return database.Auditer(ctx, q, u.ID, "representant."+qualificationActionEncadrement, "representant", in.ID,
			map[string]any{qualificationCleStatut: avant.StatutLabel}, map[string]any{qualificationCleStatut: statut.Label})
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func qualificationMonterRequalification(api huma.API, s *service) {
	huma.Register(api, qualificationRoute("requalifierProspectParMotif", http.MethodPost,
		"/api/v1/prospects/{id}/statut-qualification"), s.qualificationRequalifierProspect)
	huma.Register(api, qualificationRoute("requalifierRepresentantParStatut", http.MethodPost,
		"/api/v1/representants/{id}/statut-qualification"), s.qualificationRequalifierRepresentant)
}
