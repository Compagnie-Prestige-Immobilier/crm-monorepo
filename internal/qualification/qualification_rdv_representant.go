package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const qualificationOrigineRepresentant = "REPRESENTANT"

// Le rendez-vous pris au script représentant : mêmes motifs et mêmes champs
// que celui d'un prospect, dont il suit ensuite tout le circuit.
type QualificationRepRendezVous struct {
	ReasonCode                string    `json:"reasonCode" minLength:"1" maxLength:"40" doc:"Un motif à l'effet CLOSE_APPOINTMENT."`
	RendezVousAt              time.Time `json:"rendezVousAt" format:"date-time"`
	SiteID                    *string   `json:"siteId,omitempty" format:"uuid"`
	PointRencontreID          *string   `json:"pointRencontreId,omitempty" format:"uuid"`
	PointRencontreCommentaire *string   `json:"pointRencontreCommentaire,omitempty" maxLength:"500"`
	RvExterneType             *string   `json:"rvExterneType,omitempty" enum:"PERSONNE,COOPERATIVE,ENTREPRISE,VISITE_BIEN,AUTRE"`
	RvExternePrecision        *string   `json:"rvExternePrecision,omitempty" maxLength:"200"`
}

type qualificationRdvRep struct {
	corps     QualificationCallAttemptBody
	tentative qualificationTentative
	creer     bool
	phone     string
}

// Tout se vérifie avant la transaction : un refus n'écrit ni l'appel ni la fiche.
func (s *service) qualificationPreparerRdvRep(ctx context.Context, u *socle.Utilisateur, a *qualificationAppelRep) (*qualificationRdvRep, error) {
	r := a.b.RendezVous
	if a.statut.Effect == db.StatutQualificationEffectUNREACHABLE || a.statut.Effect == db.StatutQualificationEffectWRONGNUMBER {
		return nil, socle.Problem(http.StatusBadRequest, "REP_RDV_INJOIGNABLE",
			"Un rendez-vous se prend avec une personne jointe.")
	}
	code := strings.ToUpper(strings.TrimSpace(r.ReasonCode))
	motif, err := s.qualificationMotifDeLIssue(ctx, code)
	if err != nil {
		return nil, err
	}
	if motif.effet != db.CallOutcomeEffectCLOSEAPPOINTMENT {
		return nil, socle.Problem(http.StatusBadRequest, "REP_RDV_MOTIF",
			"Le motif « "+motif.label+" » n’est pas un rendez-vous.")
	}
	rdv := &qualificationRdvRep{phone: a.rep.PhoneE164, corps: QualificationCallAttemptBody{
		ID: a.b.ID, ClientCreatedAt: a.b.ClientCreatedAt, ReasonCode: code, Comment: a.b.Comment,
		CallbackAt: &r.RendezVousAt, SiteID: r.SiteID, PointRencontreID: r.PointRencontreID,
		PointRencontreCommentaire: r.PointRencontreCommentaire,
		RvExterneType:             r.RvExterneType, RvExternePrecision: r.RvExternePrecision,
	}}
	if a.numero != nil {
		rdv.phone = *a.numero
	}
	if rdv.tentative, err = qualificationNormaliserTentative(&rdv.corps, &motif); err != nil {
		return nil, err
	}
	if err := rvExterneVerifier(&rdv.corps, code); err != nil {
		return nil, err
	}
	return rdv, s.qualificationFicheDuRdvRep(ctx, u, rdv)
}

// Le numéro du représentant a peut-être déjà sa fiche prospect : le rendez-vous
// s'y pose, pour garder une seule fiche par personne.
func (s *service) qualificationFicheDuRdvRep(ctx context.Context, u *socle.Utilisateur, rdv *qualificationRdvRep) error {
	existant, err := s.Q.ProspectRattachable(ctx, db.ProspectRattachableParams{Projet: db.ProjetCHUES, PhoneE164: &rdv.phone})
	if errors.Is(err, pgx.ErrNoRows) {
		id, e := uuid.NewV7()
		rdv.corps.ProspectID, rdv.creer = id.String(), true
		return e
	}
	if err != nil {
		return err
	}
	rdv.corps.ProspectID = existant.ID
	return s.qualificationProspectAttribue(ctx, u, existant.ID)
}

func (s *service) qualificationAppliquerRdvRep(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	rdv := a.rdv
	if rdv == nil {
		return nil
	}
	if rdv.creer {
		if err := qualificationCreerFicheRep(ctx, q, a); err != nil {
			return err
		}
	}
	if err := s.rvSiteVerifier(ctx, q, &rdv.corps, rdv.corps.ReasonCode); err != nil {
		return err
	}
	_, _, err := s.qualificationAppliquerTentative(ctx, q, a.u, &rdv.corps, &rdv.tentative)
	return err
}

func qualificationCreerFicheRep(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	origine := qualificationOrigineRepresentant
	id := a.rdv.corps.ProspectID
	if err := q.InsertProspect(ctx, db.InsertProspectParams{
		ID: id, Nom: a.rep.FullName, PhoneE164: &a.rdv.phone, CreatedById: a.u.ID,
		ClientCreatedAt: a.b.ClientCreatedAt.UTC(), Statut: db.ProspectStatutNOUVEAU, Projet: db.ProjetCHUES,
		Etablissement: a.rep.Etablissement, Profession: a.rep.Profession, Origin: &origine,
		WhatsappStatus: db.WhatsappStatusNONDEMANDE,
	}); err != nil {
		return err
	}
	return database.Auditer(ctx, q, a.u.ID, "prospect.rendez_vous_representant", "prospect", id,
		nil, map[string]any{"representantId": a.b.RepresentantID})
}
