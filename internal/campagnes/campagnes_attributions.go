package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/text/transform"
)

type CampagneImportsInput struct {
	Projet string `query:"projet" enum:"CHUES,GRAND_PUBLIC" required:"true"`
}

type CampagneImport struct {
	ID         string `json:"id"`
	FileName   string `json:"fileName"`
	Feuille    string `json:"feuille,omitempty"`
	Libelle    string `json:"libelle"`
	ImportedAt string `json:"importedAt"`
	Fiches     int    `json:"fiches"`
}

var dateFeuilleImport = regexp.MustCompile(`(?i)(\d{1,2})\s+([a-z]{3,10})\.?\s+(\d{2,4})`)

// Le marketing nomme ses onglets « DEBUT CAMPAGNE 10 SEPT 26 » ou « Leads 11
// sept 2026 » : seule la date compte, et elle doit se lire pareil partout. Un
// onglet sans date lisible garde son nom, plutôt qu'une date inventée.
func libelleFeuilleImport(feuille string) string {
	nom := strings.TrimSpace(feuille)
	if nom == "" {
		return ""
	}
	plat, _, err := transform.String(lotPlieurAccents, strings.ToLower(nom))
	if err != nil {
		return nom
	}
	trouve := dateFeuilleImport.FindStringSubmatch(plat)
	if trouve == nil {
		return nom
	}
	jour, _ := strconv.Atoi(trouve[1])
	annee, _ := strconv.Atoi(trouve[3])
	if annee < 100 {
		annee += 2000
	}
	if jour < 1 || jour > 31 {
		return nom
	}
	for i, mois := range lotMoisEnLettres {
		if strings.HasPrefix(trouve[2], abregeMoisImport(mois)) {
			return fmt.Sprintf("Leads %d %s %d", jour, lotMoisEnLettres[i], annee)
		}
	}
	return nom
}

// « septembre » se reconnaît à « sept », « mai » n'a que trois lettres.
func abregeMoisImport(mois string) string {
	plat, _, err := transform.String(lotPlieurAccents, mois)
	if err != nil {
		return mois
	}
	return plat[:min(4, len(plat))]
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
		importeLe := rows[i].FinishedAt
		var feuille string
		if rows[i].ImportFeuille != nil {
			feuille = *rows[i].ImportFeuille
		}
		libelle := libelleFeuilleImport(feuille)
		if libelle == "" {
			libelle = rows[i].FileName
		}
		out.Body.Items = append(out.Body.Items, CampagneImport{
			ID: rows[i].ID, FileName: rows[i].FileName, Feuille: feuille, Libelle: libelle,
			ImportedAt: lotISO(importeLe), Fiches: int(rows[i].Fiches),
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
