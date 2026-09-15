package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/qualification"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"time"
)

type ProspectCallAttempt struct {
	ID                        string                      `json:"id"`
	Outcome                   string                      `json:"outcome"`
	ReasonCode                *string                     `json:"reasonCode"`
	ReasonLabel               *string                     `json:"reasonLabel"`
	Method                    *string                     `json:"method"`
	Comment                   *string                     `json:"comment"`
	Email                     *string                     `json:"email"`
	Fonctionnaire             *bool                       `json:"fonctionnaire"`
	EngagementEnCours         *bool                       `json:"engagementEnCours"`
	DureeEtablissementMois    *int32                      `json:"dureeEtablissementMois"`
	RendezVousAt              *string                     `json:"rendezVousAt"`
	CallbackAt                *string                     `json:"callbackAt"`
	DeviceCallType            *string                     `json:"deviceCallType"`
	DeviceCallDurationSeconds *int32                      `json:"deviceCallDurationSeconds"`
	DeviceCallAt              *string                     `json:"deviceCallAt"`
	PerformedByID             string                      `json:"performedById"`
	PerformedByName           string                      `json:"performedByName"`
	ClientCreatedAt           string                      `json:"clientCreatedAt"`
	DureeTraitementSecondes   *int32                      `json:"dureeTraitementSecondes"`
	Editable                  bool                        `json:"editable"`
	Modifications             []ProspectAppelModification `json:"modifications"`
}

type ProspectAppelModification struct {
	At       string                               `json:"at"`
	UserName *string                              `json:"userName"`
	Avant    qualification.QualificationAppelEtat `json:"avant"`
	Apres    qualification.QualificationAppelEtat `json:"apres"`
}

type ProspectCallAttemptsOutput struct {
	Body struct {
		Items []ProspectCallAttempt `json:"items"`
	}
}

func prospectDureeTraitement(premiereSaisie, fermeture *time.Time) *int32 {
	if premiereSaisie == nil || fermeture == nil {
		return nil
	}
	return prospectPtr(int32(fermeture.Sub(*premiereSaisie).Round(time.Second).Seconds()))
}

func prospectModificationsParAppel(traces []db.ModificationsDesTentativesRow) (map[string][]ProspectAppelModification, error) {
	parAppel := map[string][]ProspectAppelModification{}
	for i := range traces {
		m := ProspectAppelModification{At: prospectISO(traces[i].At), UserName: traces[i].UserName}
		if err := json.Unmarshal(traces[i].Before, &m.Avant); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(traces[i].After, &m.Apres); err != nil {
			return nil, err
		}
		parAppel[traces[i].AttemptID] = append(parAppel[traces[i].AttemptID], m)
	}
	return parAppel, nil
}

// Même portée que la fiche : qui peut la lire peut relire ses appels.
func (s *service) prospectTentatives(ctx context.Context, in *ProspectIDInput) (*ProspectCallAttemptsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	lignes, err := s.Q.TentativesDuProspect(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	traces, err := s.Q.ModificationsDesTentatives(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	parAppel, err := prospectModificationsParAppel(traces)
	if err != nil {
		return nil, err
	}
	confie, err := qualification.QualificationProspectConfie(ctx, s.Q, &u, in.ID)
	if err != nil {
		return nil, err
	}
	out := &ProspectCallAttemptsOutput{}
	out.Body.Items = make([]ProspectCallAttempt, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		out.Body.Items = append(out.Body.Items, ProspectCallAttempt{
			ID: l.ID, Outcome: string(l.Outcome), ReasonCode: l.ReasonCode, ReasonLabel: l.ReasonLabel,
			Method: prospectEnum(l.Method), Comment: l.Comment, Email: l.Email, Fonctionnaire: l.Fonctionnaire,
			EngagementEnCours: l.EngagementEnCours, DureeEtablissementMois: l.DureeEtablissementMois,
			RendezVousAt: prospectISOPtr(l.RendezVousAt), CallbackAt: prospectISOPtr(l.CallbackAt),
			DeviceCallType: l.DeviceCallType, DeviceCallDurationSeconds: l.DeviceCallDurationSeconds,
			DeviceCallAt: prospectISOPtr(l.DeviceCallAt), PerformedByID: l.PerformedById,
			PerformedByName: l.PerformedByName, ClientCreatedAt: prospectISO(l.ClientCreatedAt),
			DureeTraitementSecondes: prospectDureeTraitement(l.OuvertureFirstInputAt, l.OuvertureClosedAt),
			Editable:                qualification.QualificationAppelModifiable(&u, l.PerformedById, confie, string(l.Outcome)),
			Modifications:           append([]ProspectAppelModification{}, parAppel[l.ID]...),
		})
	}
	return out, nil
}
