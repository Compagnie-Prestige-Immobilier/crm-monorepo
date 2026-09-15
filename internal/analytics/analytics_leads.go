package analytics

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// Les motifs qui font remonter un lead à la Direction, arrêtés le 15 septembre 2026.
var motifsTresInteresse = []string{"DEMANDE_INFORMATION", "RDV_TELEPHONIQUE", "TRANSFERT_ENROLEMENT", "CONSTRUCTION"}

type ImportDeLeads struct {
	ID         string    `json:"id"`
	Fichier    string    `json:"fichier"`
	ImporteLe  time.Time `json:"importeLe"`
	Importes   int       `json:"importes"`
	Appeles    int       `json:"appeles"`
	Joints     int       `json:"joints"`
	Interesses int       `json:"interesses"`
}

type LeadTresInteresse struct {
	ID          string    `json:"id"`
	Nom         string    `json:"nom"`
	Prenom      string    `json:"prenom"`
	PhoneE164   *string   `json:"phoneE164"`
	Statut      string    `json:"statut"`
	Fichier     string    `json:"fichier"`
	Feuille     *string   `json:"feuille"`
	AppeleLe    time.Time `json:"appeleLe"`
	AppelePar   string    `json:"appelePar"`
	Motif       string    `json:"motif"`
	Commentaire *string   `json:"commentaire"`
}

type LeadsImportes struct {
	Imports []ImportDeLeads     `json:"imports"`
	Fiches  []LeadTresInteresse `json:"fiches" doc:"Les 500 plus récentes au plus."`
	// Le tableau s'arrête à 500 lignes : ce nombre dit ce qu'il ne montre pas.
	TotalFiches int `json:"totalFiches"`
}

type LeadsImportesOutput struct{ Body LeadsImportes }

func (s *service) leadsImportes(ctx context.Context, _ *struct{}) (*LeadsImportesOutput, error) {
	imports, err := s.Q.LeadsImportesParImport(ctx, motifsTresInteresse)
	if err != nil {
		return nil, err
	}
	fiches, err := s.Q.LeadsImportesInteresses(ctx, motifsTresInteresse)
	if err != nil {
		return nil, err
	}
	total, err := s.Q.LeadsImportesInteressesTotal(ctx, motifsTresInteresse)
	if err != nil {
		return nil, err
	}
	corps := LeadsImportes{
		Imports:     make([]ImportDeLeads, 0, len(imports)),
		Fiches:      make([]LeadTresInteresse, 0, len(fiches)),
		TotalFiches: int(total),
	}
	for _, ligne := range imports {
		corps.Imports = append(corps.Imports, ImportDeLeads{
			ID: ligne.ID, Fichier: ligne.Fichier, ImporteLe: ligne.ImporteLe,
			Importes: int(ligne.Importes), Appeles: int(ligne.Appeles),
			Joints: int(ligne.Joints), Interesses: int(ligne.Interesses),
		})
	}
	for i := range fiches {
		ligne := &fiches[i]
		corps.Fiches = append(corps.Fiches, LeadTresInteresse{
			ID: ligne.ID, Nom: ligne.Nom, Prenom: ligne.Prenom, PhoneE164: ligne.PhoneE164,
			Statut: string(ligne.Statut), Fichier: ligne.Fichier, Feuille: ligne.Feuille,
			AppeleLe: ligne.AppeleLe, AppelePar: ligne.AppelePar, Motif: ligne.Motif,
			Commentaire: ligne.Commentaire,
		})
	}
	return &LeadsImportesOutput{Body: corps}, nil
}

func monterLeadsImportes(api huma.API, s *service) {
	routeDeLecture(api, "getSupervisionLeadsImportes", "/api/v1/supervision/leads-importes", s.leadsImportes)
}
