package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
)

type CampagneImportsInput struct {
	Projet string `query:"projet" enum:"CHUES,GRAND_PUBLIC" required:"true"`
}

type CampagneImport struct {
	ID         string `json:"id"`
	FileName   string `json:"fileName"`
	ImportedAt string `json:"importedAt"`
	Fiches     int    `json:"fiches"`
}

type CampagneImportsOutput struct {
	Body struct {
		Items []CampagneImport `json:"items"`
	}
}

// Les imports qui ont créé des fiches du projet : la source « fiches importées » d'une campagne.
func (s *service) campagneImports(ctx context.Context, in *CampagneImportsInput) (*CampagneImportsOutput, error) {
	rows, err := s.Q.ImportsAvecFiches(ctx, db.Projet(in.Projet))
	if err != nil {
		return nil, err
	}
	out := &CampagneImportsOutput{}
	out.Body.Items = make([]CampagneImport, 0, len(rows))
	for i := range rows {
		importeLe := rows[i].CreatedAt
		if rows[i].FinishedAt != nil {
			importeLe = *rows[i].FinishedAt
		}
		out.Body.Items = append(out.Body.Items, CampagneImport{
			ID: rows[i].ID, FileName: rows[i].FileName, ImportedAt: lotISO(importeLe), Fiches: int(rows[i].Fiches),
		})
	}
	return out, nil
}

type MesAttributionsOutput struct {
	Body struct {
		RepresentantIds []string `json:"representantIds"`
		ProspectIds     []string `json:"prospectIds"`
		Tout            bool     `json:"tout"`
	}
}

// Seul un téléconseiller travaille sur une part du portefeuille ; l'encadrement
// lit tout, et reçoit `tout` plutôt que la liste de toutes les fiches.
func (s *service) mesAttributions(ctx context.Context, _ *struct{}) (*MesAttributionsOutput, error) {
	out := &MesAttributionsOutput{}
	out.Body.RepresentantIds, out.Body.ProspectIds = []string{}, []string{}
	u := socle.UtilisateurCourant(ctx)
	if u.Role != socle.Commercial && u.Role != socle.ChargeClientele {
		out.Body.Tout = true
		return out, nil
	}
	rows, err := s.Q.LotFichesAttribuees(ctx, &u.ID)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		if rows[i].RepresentantId != nil {
			out.Body.RepresentantIds = append(out.Body.RepresentantIds, *rows[i].RepresentantId)
		}
		if rows[i].ProspectId != nil {
			out.Body.ProspectIds = append(out.Body.ProspectIds, *rows[i].ProspectId)
		}
	}
	return out, nil
}
