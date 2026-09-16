package campagnes

import (
	"context"
	"cpi-go/internal/shared/socle"
	"fmt"
	"strings"
	"time"
)

type CampagneImport struct {
	ID                string `json:"id"`
	FileName          string `json:"fileName"`
	Feuille           string `json:"feuille,omitempty"`
	Libelle           string `json:"libelle"`
	ImportedAt        string `json:"importedAt"`
	Fiches            int    `json:"fiches"`
	FichesChues       int    `json:"fichesChues"`
	FichesGrandPublic int    `json:"fichesGrandPublic"`
	Appelees          int    `json:"appelees" doc:"Fiches de l'import déjà appelées au moins une fois."`
}

// Le marketing nomme ses onglets « DEBUT CAMPAGNE 10 SEPT 26 », « Leads 11
// sept 2026 » ou « Leads 13 sept » : seule la date compte, et elle doit se lire
// pareil partout. Un onglet sans date lisible garde son nom.
func libelleFeuilleImport(feuille string) string {
	nom := strings.TrimSpace(feuille)
	date, ok := socle.DateDuNomDeFeuille(nom, time.Now())
	if !ok {
		return nom
	}
	return fmt.Sprintf("Leads %d %s %d", date.Day(), socle.MoisEnLettres[date.Month()-1], date.Year())
}

type CampagneImportsOutput struct {
	Body struct {
		Items []CampagneImport `json:"items"`
	}
}

// Un onglet de leads porte des fiches des deux projets : il sort une fois, avec
// le compte de chacun, et la campagne choisit le sien ou les deux.
func (s *service) campagneImports(ctx context.Context, _ *struct{}) (*CampagneImportsOutput, error) {
	rows, err := s.Q.ImportsAvecFiches(ctx)
	if err != nil {
		return nil, err
	}
	out := &CampagneImportsOutput{}
	out.Body.Items = make([]CampagneImport, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		var feuille string
		if r.ImportFeuille != nil {
			feuille = *r.ImportFeuille
		}
		libelle := libelleFeuilleImport(feuille)
		if libelle == "" {
			libelle = r.FileName
		}
		out.Body.Items = append(out.Body.Items, CampagneImport{
			ID: r.ID, FileName: r.FileName, Feuille: feuille, Libelle: libelle,
			ImportedAt: lotISO(r.FinishedAt), Fiches: int(r.FichesChues + r.FichesGp),
			FichesChues: int(r.FichesChues), FichesGrandPublic: int(r.FichesGp),
			Appelees: int(r.AppeleesChues + r.AppeleesGp),
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
	if u.Role != socle.Commercial && u.Role != socle.ChargeClientele && u.Role != socle.CCP {
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
