package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const prospectCheminSegment = "/api/v1/prospects/{id}/segment"

type ProspectSegmentBody struct {
	BanqueID    prospectOptionnel[string] `json:"banqueId,omitempty" required:"false"`
	SyndicatID  prospectOptionnel[string] `json:"syndicatId,omitempty" required:"false"`
	Reason      string                    `json:"reason" minLength:"5" maxLength:"500"`
	ExpectedRev *int32                    `json:"expectedRev,omitempty" minimum:"1" required:"false"`
}

type ProspectSegmentInput struct {
	ID   string `path:"id" format:"uuid"`
	Body ProspectSegmentBody
}

type ProspectSegmentChange struct {
	ID             string  `json:"id"`
	ProspectID     string  `json:"prospectId"`
	FromSegment    string  `json:"fromSegment" enum:"BDD1,BDD2,BDD3,BDD4"`
	ToSegment      string  `json:"toSegment" enum:"BDD1,BDD2,BDD3,BDD4"`
	FromBanqueID   string  `json:"fromBanqueId"`
	ToBanqueID     string  `json:"toBanqueId"`
	FromSyndicatID string  `json:"fromSyndicatId"`
	ToSyndicatID   string  `json:"toSyndicatId"`
	Reason         *string `json:"reason"`
	ChangedByID    string  `json:"changedById"`
	ChangedByName  string  `json:"changedByName"`
	Source         string  `json:"source" enum:"WEB,MOBILE"`
	ChangedAt      string  `json:"changedAt"`
}

type ProspectSegmentHistoryOutput struct {
	Body struct {
		Items   []ProspectSegmentChange `json:"items"`
		Tronque bool                    `json:"tronque" doc:"Plus de 500 lignes : seules les 500 plus récentes sont rendues."`
	}
}

func prospectRevConflit(rev int32) error {
	p := socle.Problem(http.StatusConflict, "PROSPECT_REV_CONFLICT",
		"La fiche a été modifiée entre-temps par un autre utilisateur. Rechargez-la et vérifiez son segment avant de réessayer.")
	p.Errors = []*huma.ErrorDetail{{Location: "currentRev", Value: rev}}
	return p
}

// Le segment se calcule, il ne se stocke pas : sans les deux axes il n'existe
// pas, et la trace de bascule n'aurait ni départ ni arrivée à écrire.
func (s *service) prospectBasculerSegment(ctx context.Context, in *ProspectSegmentInput) (*ProspectOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	avant, err := s.Q.ProspectPourSegment(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, prospectCodeIntrouvable, prospectIntrouvable)
	}
	if err != nil {
		return nil, err
	}
	if in.Body.ExpectedRev != nil && *in.Body.ExpectedRev != avant.Rev {
		return nil, prospectRevConflit(avant.Rev)
	}
	depart := prospectSegment(avant.SyndicatSigle, avant.BanqueShortName)
	if depart == nil {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_SEGMENT_UNAVAILABLE",
			"Cette fiche n’a pas de banque ou de syndicat : renseignez-les d’abord, un segment ne se devine pas.")
	}
	arrivee, err := s.prospectSegmentCible(ctx, &avant, &in.Body, *depart)
	if err != nil {
		return nil, err
	}
	if err := s.prospectEcrireBascule(ctx, in, &avant, *depart, arrivee, u.ID); err != nil {
		return nil, err
	}
	item, err := s.prospectLire(ctx, &u, in.ID)
	if err != nil {
		return nil, err
	}
	return &ProspectOutput{Body: *item}, nil
}

type prospectSegmentArrivee struct {
	banqueID, syndicatID, segment string
}

// Une clé absente, vide ou nulle garde la valeur courante : un axe ne se vide
// pas par une bascule de segment.
func prospectSegmentChoix(courant string, demande prospectOptionnel[string]) string {
	if demande.valeur == nil || strings.TrimSpace(*demande.valeur) == "" {
		return courant
	}
	return *demande.valeur
}

func (s *service) prospectSegmentCible(ctx context.Context, avant *db.ProspectPourSegmentRow,
	corps *ProspectSegmentBody, depart string,
) (prospectSegmentArrivee, error) {
	var cible prospectSegmentArrivee
	cible.banqueID = prospectSegmentChoix(*avant.BanqueId, corps.BanqueID)
	cible.syndicatID = prospectSegmentChoix(*avant.SyndicatId, corps.SyndicatID)
	// Le refus porte sur les CLÉS : passer d'une banque non-CBAO à une autre
	// laisse la fiche dans le même segment et mérite quand même sa trace.
	if cible.banqueID == *avant.BanqueId && cible.syndicatID == *avant.SyndicatId {
		return cible, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_SEGMENT_UNCHANGED",
			"Ni la banque ni le syndicat ne changent : la fiche reste en "+depart+".")
	}
	sigleBanque := avant.BanqueShortName
	if cible.banqueID != *avant.BanqueId {
		nom, err := s.Q.BanqueSigleSegment(ctx, cible.banqueID)
		if errors.Is(err, pgx.ErrNoRows) {
			return cible, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_BANQUE_NOT_FOUND", "Banque de destination inconnue.")
		}
		if err != nil {
			return cible, err
		}
		sigleBanque = &nom
	}
	sigleSyndicat := avant.SyndicatSigle
	if cible.syndicatID != *avant.SyndicatId {
		sigle, err := s.Q.SyndicatSigleSegment(ctx, cible.syndicatID)
		if errors.Is(err, pgx.ErrNoRows) {
			return cible, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_SYNDICAT_NOT_FOUND", "Syndicat de destination inconnu.")
		}
		if err != nil {
			return cible, err
		}
		sigleSyndicat = &sigle
	}
	cible.segment = *prospectSegment(sigleSyndicat, sigleBanque)
	return cible, nil
}

// Les deux clés et la trace partent dans la MÊME transaction : une trace écrite
// à côté finirait par décrire une bascule qui n'a pas eu lieu.
func (s *service) prospectEcrireBascule(ctx context.Context, in *ProspectSegmentInput,
	avant *db.ProspectPourSegmentRow, depart string, arrivee prospectSegmentArrivee, userID string,
) error {
	trace, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return s.prospectTx(ctx, func(q *db.Queries) error {
		bascules, err := q.BasculerSegmentProspect(ctx, db.BasculerSegmentProspectParams{
			BanqueID: &arrivee.banqueID, SyndicatID: &arrivee.syndicatID, ID: in.ID, Rev: avant.Rev,
		})
		if err != nil {
			return err
		}
		// La garde de révision est DANS la mise à jour : deux bascules
		// simultanées passeraient toutes deux un contrôle fait avant.
		if bascules != 1 {
			courante, err := q.ProspectPourSegment(ctx, in.ID)
			if err != nil {
				return err
			}
			return prospectRevConflit(courante.Rev)
		}
		if err := q.InsererSegmentChange(ctx, db.InsererSegmentChangeParams{
			ID: trace.String(), ProspectId: in.ID,
			FromSegment: db.BddSegment(depart), ToSegment: db.BddSegment(arrivee.segment),
			FromBanqueId: *avant.BanqueId, ToBanqueId: arrivee.banqueID,
			FromSyndicatId: *avant.SyndicatId, ToSyndicatId: arrivee.syndicatID,
			Reason: prospectVide(strings.TrimSpace(in.Body.Reason)), ChangedById: userID, Source: db.ChangeSourceWEB,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, userID, "prospect.segment", prospectEntite, in.ID,
			map[string]any{
				"segment": depart, prospectChampBanque: *avant.BanqueId, prospectChampSyndicat: *avant.SyndicatId,
			},
			map[string]any{
				"segment": arrivee.segment, prospectChampBanque: arrivee.banqueID,
				prospectChampSyndicat: arrivee.syndicatID, "motif": strings.TrimSpace(in.Body.Reason),
			})
	})
}

func (s *service) prospectHistoriqueSegment(ctx context.Context, in *ProspectIDInput) (*ProspectSegmentHistoryOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	lignes, err := s.Q.ListerSegmentChanges(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &ProspectSegmentHistoryOutput{}
	lignes, out.Body.Tronque = prospectHistoriqueBorne(lignes)
	out.Body.Items = make([]ProspectSegmentChange, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		out.Body.Items = append(out.Body.Items, ProspectSegmentChange{
			ID: l.ID, ProspectID: l.ProspectId,
			FromSegment: string(l.FromSegment), ToSegment: string(l.ToSegment),
			FromBanqueID: l.FromBanqueId, ToBanqueID: l.ToBanqueId,
			FromSyndicatID: l.FromSyndicatId, ToSyndicatID: l.ToSyndicatId,
			Reason: l.Reason, ChangedByID: l.ChangedById, ChangedByName: l.ChangedByName,
			Source: string(l.Source), ChangedAt: prospectISO(l.ChangedAt),
		})
	}
	return out, nil
}

func prospectMonterSegment(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "changeProspectSegment", Method: http.MethodPatch, Path: prospectCheminSegment,
		Summary: "Fait basculer un prospect de segment, avec motif et trace.",
	}, s.prospectBasculerSegment)
	huma.Register(api, huma.Operation{
		OperationID: "listProspectSegmentChanges", Method: http.MethodGet,
		Path:    "/api/v1/prospects/{id}/segment-history",
		Summary: "Bascules de segment déjà subies par une fiche, de la plus récente à la plus ancienne.",
	}, s.prospectHistoriqueSegment)
}
