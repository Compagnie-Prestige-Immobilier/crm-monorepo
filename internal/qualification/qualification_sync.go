package qualification

import (
	"context"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// Seul chemin d'écriture du panneau pour une tentative d'appel prospect : le verdict
// de chaque opération est dans le corps, jamais dans le statut HTTP.
type SyncPushInput struct {
	Body struct {
		ClientBatchID         string             `json:"clientBatchId" format:"uuid"`
		PayloadVersion        int32              `json:"payloadVersion" minimum:"1"`
		Operations            []SyncOperationDTO `json:"operations" maxItems:"200"`
		PendingOps            *int32             `json:"pendingOps,omitempty" minimum:"0"`
		AppVersion            *string            `json:"appVersion,omitempty" maxLength:"32"`
		JournalAppelsAutorise *bool              `json:"journalAppelsAutorise,omitempty"`
	}
}

// `entity` et `op` sont libres : une valeur que le serveur ne traite pas est
// refusée dans les résultats, pas par la validation du schéma.
type SyncOperationDTO struct {
	OpID            string                        `json:"opId" format:"uuid"`
	Seq             int32                         `json:"seq" minimum:"0"`
	Entity          string                        `json:"entity" maxLength:"40"`
	Op              string                        `json:"op" maxLength:"20"`
	EntityID        string                        `json:"entityId" format:"uuid"`
	ClientUpdatedAt time.Time                     `json:"clientUpdatedAt" format:"date-time"`
	BaseRev         *int32                        `json:"baseRev,omitempty"`
	Data            *QualificationCallAttemptBody `json:"data,omitempty"`
	ClearedFields   []string                      `json:"clearedFields,omitempty"`
}

type SyncResultatDTO struct {
	OpID            string  `json:"opId" format:"uuid"`
	Status          string  `json:"status" enum:"applied,duplicate,rejected"`
	EntityID        string  `json:"entityId" format:"uuid"`
	Rev             *int32  `json:"rev"`
	ServerUpdatedAt *string `json:"serverUpdatedAt"`
	ErrorCode       *string `json:"errorCode"`
	Error           *string `json:"error"`
}

type SyncPushOutput struct {
	Body struct {
		BatchID    string            `json:"batchId" format:"uuid"`
		ServerTime string            `json:"serverTime" format:"date-time"`
		Results    []SyncResultatDTO `json:"results"`
		NextCursor *string           `json:"nextCursor"`
	}
}

func syncMonterRoutes(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "pushSync", Method: http.MethodPost, Path: "/api/v1/sync/push",
	}, s.syncPousser)
}

func (s *service) syncPousser(ctx context.Context, in *SyncPushInput) (*SyncPushOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	out := &SyncPushOutput{}
	out.Body.BatchID = in.Body.ClientBatchID
	out.Body.ServerTime = qualificationISO(time.Now())
	out.Body.Results = make([]SyncResultatDTO, 0, len(in.Body.Operations))
	for i := range in.Body.Operations {
		resultat, err := s.syncAppliquer(ctx, &u, &in.Body.Operations[i])
		if err != nil {
			return nil, err
		}
		out.Body.Results = append(out.Body.Results, resultat)
	}
	return out, nil
}

func (s *service) syncAppliquer(ctx context.Context, u *socle.Utilisateur, op *SyncOperationDTO) (SyncResultatDTO, error) {
	if op.Entity != "call_attempt" || op.Op != "create" || op.Data == nil {
		return syncRefus(op, "UNSUPPORTED_OPERATION",
			"Cette opération n’est pas traitée par le serveur : "+op.Entity+"/"+op.Op+"."), nil
	}
	corps := *op.Data
	corps.ID = op.EntityID
	statut, etat, err := s.qualificationConsignerTentative(ctx, u, &corps)
	var refus *socle.ProblemError
	if errors.As(err, &refus) {
		return syncRefus(op, refus.Code, refus.Message), nil
	}
	if err != nil {
		return SyncResultatDTO{}, err
	}
	rev, quand := etat.Rev, etat.UpdatedAt
	return SyncResultatDTO{
		OpID: op.OpID, Status: statut, EntityID: op.EntityID, Rev: &rev, ServerUpdatedAt: &quand,
	}, nil
}

func syncRefus(op *SyncOperationDTO, code, message string) SyncResultatDTO {
	return SyncResultatDTO{
		OpID: op.OpID, Status: "rejected", EntityID: op.EntityID,
		ErrorCode: &code, Error: &message,
	}
}
