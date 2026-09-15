package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type QualificationAppelEtat struct {
	Outcome     string  `json:"outcome" enum:"METHOD_OBTAINED,UNREACHABLE,CALLBACK,REFUSED,WRONG_NUMBER,OTHER"`
	ReasonCode  *string `json:"reasonCode"`
	ReasonLabel *string `json:"reasonLabel"`
	Comment     *string `json:"comment"`
	CallbackAt  *string `json:"callbackAt" format:"date-time"`
}

type QualificationModifierAppelInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Outcome    string     `json:"outcome" enum:"METHOD_OBTAINED,UNREACHABLE,CALLBACK,REFUSED,WRONG_NUMBER,OTHER"`
		ReasonCode *string    `json:"reasonCode,omitempty" maxLength:"40"`
		Comment    *string    `json:"comment,omitempty" maxLength:"2000"`
		CallbackAt *time.Time `json:"callbackAt,omitempty" format:"date-time"`
	}
}

type QualificationModifierAppelOutput struct{ Body QualificationAppelEtat }

// Même règle que la consignation d'un appel : la fiche créée par le téléconseiller, ou confiée par une campagne active.
func QualificationProspectConfie(ctx context.Context, q *db.Queries, u *socle.Utilisateur, prospectID string) (bool, error) {
	if u.Role != socle.Commercial && u.Role != socle.ChargeClientele {
		return false, nil
	}
	return q.ProspectAttribue(ctx, db.ProspectAttribueParams{ID: prospectID, Agent: u.ID})
}

func qualificationRefusDeModifier(u *socle.Utilisateur, auteurID string, confie bool, outcome, nouvelOutcome string) error {
	if u.ID != auteurID && !confie && u.Role != socle.Admin && u.Role != socle.Superviseur {
		return socle.Problem(http.StatusForbidden, "PHASE2_ATTEMPT_NOT_OWNER",
			"Seuls l’auteur de l’appel, un téléconseiller à qui la fiche est confiée, un administrateur ou un superviseur peuvent le modifier.")
	}
	if outcome == exports.ExportCleMethodeObtenue || nouvelOutcome == exports.ExportCleMethodeObtenue {
		return socle.Problem(http.StatusConflict, "PHASE2_ATTEMPT_ENROLMENT",
			"Un appel d’enrôlement ne se modifie pas : consignez un nouvel appel.")
	}
	return nil
}

func QualificationAppelModifiable(u *socle.Utilisateur, auteurID string, confie bool, outcome string) bool {
	return qualificationRefusDeModifier(u, auteurID, confie, outcome, outcome) == nil
}

func qualificationEtatAppel(r *db.TentativeAModifierRow) QualificationAppelEtat {
	return QualificationAppelEtat{
		Outcome: string(r.Outcome), ReasonCode: r.ReasonCode, ReasonLabel: r.ReasonLabel,
		Comment: r.Comment, CallbackAt: qualificationISOPtr(r.CallbackAt),
	}
}

func qualificationAppelAModifier(ctx context.Context, q *db.Queries, u *socle.Utilisateur, id, nouvelOutcome string) (db.TentativeAModifierRow, error) {
	avant, err := q.TentativeAModifier(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return avant, socle.Problem(http.StatusNotFound, "PHASE2_ATTEMPT_NOT_FOUND", "Appel introuvable.")
	}
	if err != nil {
		return avant, err
	}
	confie, err := QualificationProspectConfie(ctx, q, u, avant.ProspectId)
	if err != nil {
		return avant, err
	}
	return avant, qualificationRefusDeModifier(u, avant.PerformedById, confie, string(avant.Outcome), nouvelOutcome)
}

func (s *service) qualificationModifierAppel(ctx context.Context, in *QualificationModifierAppelInput) (*QualificationModifierAppelOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	out := &QualificationModifierAppelOutput{}
	err := qualificationTx(ctx, s, func(q *db.Queries) error {
		avant, err := qualificationAppelAModifier(ctx, q, &u, in.ID, in.Body.Outcome)
		if err != nil {
			return err
		}
		// La date de rappel se juge contre l'appel d'origine, comme à sa création.
		b := QualificationCallAttemptBody{
			ID: in.ID, ProspectID: avant.ProspectId, Outcome: in.Body.Outcome, ReasonCode: in.Body.ReasonCode,
			Comment: in.Body.Comment, CallbackAt: in.Body.CallbackAt, ClientCreatedAt: avant.ClientCreatedAt,
		}
		motif, err := s.qualificationMotifDeLIssue(ctx, &b)
		if err != nil {
			return err
		}
		t, err := qualificationNormaliserTentative(&b, &motif)
		if err != nil {
			return err
		}
		if err := qualificationExigencesChues(&b, &t, avant.Projet); err != nil {
			return err
		}
		if err := qualificationAppliquerModification(ctx, q, &u, &b, &t, &avant); err != nil {
			return err
		}
		apres, err := q.TentativeAModifier(ctx, in.ID)
		if err != nil {
			return err
		}
		out.Body = qualificationEtatAppel(&apres)
		return database.Auditer(ctx, q, u.ID, "call_attempt.update", "call_attempt", in.ID, qualificationEtatAppel(&avant), out.Body)
	})
	return out, err
}

func qualificationAppliquerModification(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody, t *qualificationTentative, avant *db.TentativeAModifierRow) error {
	if err := q.ModifierTentative(ctx, db.ModifierTentativeParams{
		ID: b.ID, Outcome: b.Outcome, ReasonID: t.motif.id, Comment: t.comment,
	}); err != nil {
		return err
	}
	if err := qualificationReprendreRappel(ctx, q, b, t, avant); err != nil {
		return err
	}
	if !avant.Derniere {
		return nil
	}
	auteur, at, outcome := avant.PerformedById, avant.ClientCreatedAt, b.Outcome
	fiche, err := q.CorrigerProspectParTentative(ctx, db.CorrigerProspectParTentativeParams{
		ID: b.ProspectID, MajDernierAppel: true, LastCallOutcome: &outcome, LastCallAt: &at, LastCallByID: &auteur,
	})
	if err != nil {
		return err
	}
	if t.regle.clot {
		parcours, erreur := qualificationOuvrirParcours(ctx, q, b.ProspectID, avant.Projet)
		if erreur != nil {
			return erreur
		}
		_, _, erreur = qualificationCloturerParcours(ctx, q, u, b, t, &fiche, &parcours)
		return erreur
	}
	if !qualificationReglesEffet[qualificationMotifsSysteme[string(avant.Outcome)].effet].clot {
		return nil
	}
	return q.RouvrirPhase2(ctx, db.RouvrirPhase2Params{ProspectID: b.ProspectID, Projet: string(avant.Projet)})
}

// Le créneau de rappel unique du prospect revient à la dernière tentative : une plus
// ancienne ne déplace que le rappel qu'elle a elle-même promis.
func qualificationReprendreRappel(ctx context.Context, q *db.Queries, b *QualificationCallAttemptBody, t *qualificationTentative, avant *db.TentativeAModifierRow) error {
	if t.callbackAt == nil {
		return q.AnnulerRappelDeTentative(ctx, b.ID)
	}
	if !avant.Derniere {
		return q.ReporterRappelDeTentative(ctx, db.ReporterRappelDeTentativeParams{
			ScheduledAt: *t.callbackAt, Comment: t.comment, SourceAttemptID: b.ID,
		})
	}
	if err := q.SupplanterRappels(ctx, b.ProspectID); err != nil {
		return err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return q.PlanifierRappelDeTentative(ctx, db.PlanifierRappelDeTentativeParams{
		ID: id.String(), ProspectID: b.ProspectID, AssignedToID: avant.PerformedById,
		ScheduledAt: *t.callbackAt, Comment: t.comment, SourceAttemptID: b.ID,
	})
}
