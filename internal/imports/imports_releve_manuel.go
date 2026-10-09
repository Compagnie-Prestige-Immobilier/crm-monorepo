package imports

import (
	"context"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

const cheminReleveLeads = "POST /api/v1/imports/releve-leads"

// Le relevé horaire attend que le classeur change ; ce geste le lance tout de
// suite, classeur inchangé compris, et rend le travail une fois appliqué.
func releveManuelMonterRoute(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "releverLeadsMaintenant", Method: http.MethodPost,
		Path:    "/api/v1/imports/releve-leads",
		Summary: "Relève tout de suite le classeur des leads SharePoint, même inchangé.",
	}, s.releverLeadsMaintenant)
}

func (s *service) releverLeadsMaintenant(ctx context.Context, _ *struct{}) (*ImportJobOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	jobID, err := s.releverLeadsPour(ctx, u.ID, true)
	switch {
	case errors.Is(err, errReleveSansLien):
		return nil, socle.Problem(http.StatusServiceUnavailable, "RELEVE_LEADS_SANS_LIEN",
			"Aucun lien SharePoint n'est réglé sur le serveur (IMPORT_LEADS_URL).")
	case errors.Is(err, errReleveEnCours):
		return nil, socle.Problem(http.StatusConflict, "RELEVE_LEADS_EN_COURS",
			"Un relevé est déjà en cours : son résultat apparaît dans l'historique des imports.")
	case err != nil && jobID == "":
		return nil, socle.Problem(http.StatusBadGateway, "RELEVE_LEADS_INJOIGNABLE",
			"Le classeur SharePoint n'a pas pu être téléchargé : "+err.Error())
	case err != nil:
		return nil, err
	}
	job, err := s.Q.ImportJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	if err := database.Auditer(ctx, s.Q, u.ID, "imports.releve_leads", "import_job", job.ID, nil, map[string]any{
		"fichier": job.FileName, "statut": job.Status, "creees": job.CreatedRows, "misesAJour": job.UpdatedRows,
		"erreurs": job.ErrorRows,
	}); err != nil {
		return nil, err
	}
	return &ImportJobOutput{Status: http.StatusOK, Body: versImportJobDTO(&job)}, nil
}
