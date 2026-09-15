package prospects

import (
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Une ligne du journal de la fiche : qui, quand, quoi, avec l'avant et l'après.
type ProspectJournalEntree struct {
	ID     string         `json:"id"`
	Action string         `json:"action" doc:"prospect.update, prospect.statut, prospect.import, prospect.date_corrigee, lot_export.plateforme, lot_export.hors_projet, rappel.reattribue…"`
	Entite string         `json:"entite"`
	At     string         `json:"at" format:"date-time"`
	Auteur string         `json:"auteur" doc:"« CPI GO » quand une migration ou une tâche a écrit seule."`
	Avant  map[string]any `json:"avant"`
	Apres  map[string]any `json:"apres"`
}

type ProspectJournalFicheOutput struct {
	Body struct {
		Items []ProspectJournalEntree `json:"items"`
	}
}

func (s *service) prospectJournalFiche(ctx context.Context, in *ProspectIDInput) (*ProspectJournalFicheOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.prospectLire(ctx, &u, in.ID); err != nil {
		return nil, err
	}
	lignes, err := s.Q.JournalDeLaFiche(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &ProspectJournalFicheOutput{}
	out.Body.Items = make([]ProspectJournalEntree, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		out.Body.Items = append(out.Body.Items, ProspectJournalEntree{
			ID: l.ID, Action: l.Action, Entite: l.Entity, At: prospectISO(l.At), Auteur: l.Auteur,
			Avant: prospectObjetJSON(l.Before), Apres: prospectObjetJSON(l.After),
		})
	}
	return out, nil
}

func prospectObjetJSON(brut []byte) map[string]any {
	var objet map[string]any
	if len(brut) == 0 || json.Unmarshal(brut, &objet) != nil {
		return map[string]any{}
	}
	return objet
}

func prospectMonterJournal(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "listProspectJournal", Method: http.MethodGet,
		Path:    "/api/v1/prospects/{id}/journal",
		Summary: "Tout ce qui a changé sur la fiche, du plus récent au plus ancien, avec l'avant et l'après.",
	}, s.prospectJournalFiche)
}
