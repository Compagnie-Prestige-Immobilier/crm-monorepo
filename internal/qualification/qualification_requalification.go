package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
)

const qualificationActionRequalification = "prospect.requalification"

// Une fiche classée que le téléconseiller requalifie revient en cours. Sans
// cela le statut restait celui du premier classement, et l'écran affichait
// « Refus » sur une fiche dont le dernier appel disait autre chose.
func qualificationRouvrirFiche(ctx context.Context, q *db.Queries, u *socle.Utilisateur,
	b *QualificationCallAttemptBody, prospect *db.CorrigerProspectParTentativeRow, parcours *db.ParcoursDuProspectRow,
) (QualificationProspectPhase2StateDTO, error) {
	etat := qualificationEtatPhase2(prospect.ID, prospect.Rev, prospect.UpdatedAt, parcours)
	if parcours.Phase2Status == db.Phase2StatusPENDING {
		return etat, nil
	}
	avant := qualificationTraceStatut(parcours)
	ouvert := string(db.Phase2StatusPENDING)
	if err := q.CloreParcours(ctx, db.CloreParcoursParams{Phase2Status: ouvert, ID: parcours.ID}); err != nil {
		return etat, err
	}
	if err := q.CloreProspectParTentative(ctx, db.CloreProspectParTentativeParams{Phase2Status: ouvert, ID: prospect.ID}); err != nil {
		return etat, err
	}
	final, err := q.ProspectPourTentative(ctx, b.ProspectID)
	if err != nil {
		return etat, err
	}
	relu, err := q.ParcoursDuProspect(ctx, db.ParcoursDuProspectParams{ProspectID: b.ProspectID, Projet: string(final.Projet)})
	if err != nil {
		return etat, err
	}
	parcoursRelu := relu
	if err := database.Auditer(ctx, q, u.ID, qualificationActionRequalification, "prospect", b.ProspectID,
		avant, qualificationTraceStatut(&parcoursRelu)); err != nil {
		return etat, err
	}
	return qualificationEtatPhase2(final.ID, final.Rev, final.UpdatedAt, &parcoursRelu), nil
}

func qualificationTraceStatut(parcours *db.ParcoursDuProspectRow) map[string]any {
	trace := map[string]any{"phase2Status": string(parcours.Phase2Status)}
	if parcours.EnrollmentMethod != nil {
		trace["enrollmentMethod"] = string(*parcours.EnrollmentMethod)
	}
	return trace
}
