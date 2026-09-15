package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"golang.org/x/text/transform"
)

type CampagneImport struct {
	ID         string `json:"id"`
	FileName   string `json:"fileName"`
	Feuille    string `json:"feuille,omitempty"`
	Libelle    string `json:"libelle"`
	ImportedAt string `json:"importedAt"`
	Projet     string `json:"projet" enum:"CHUES,GRAND_PUBLIC" doc:"Le projet dont le parcours couvre le plus de fiches de l'onglet : celui de la campagne."`
	Fiches     int    `json:"fiches"`
	Appelees   int    `json:"appelees" doc:"Fiches de l'import déjà appelées au moins une fois."`
}

var dateFeuilleImport = regexp.MustCompile(`(?i)(\d{1,2})\s+([a-z]{3,10})\.?(?:\s+(\d{2,4}))?`)

// Le marketing nomme ses onglets « DEBUT CAMPAGNE 10 SEPT 26 », « Leads 11
// sept 2026 » ou « Leads 13 sept » : seule la date compte, et elle doit se lire
// pareil partout. Sans année, c'est celle en cours. Un onglet sans date lisible
// garde son nom, plutôt qu'une date inventée.
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
	annee := time.Now().Year()
	if trouve[3] != "" {
		annee, _ = strconv.Atoi(trouve[3])
	}
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

// Un onglet de leads porte des fiches des deux projets, et chacune a un parcours
// Grand Public : l'onglet ne sort qu'une fois, sous le projet qui couvre le
// plus de fiches, celui que la campagne portera.
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
		projet, fiches, appelees := string(db.ProjetGRANDPUBLIC), r.FichesGp, r.AppeleesGp
		if r.FichesChues > r.FichesGp {
			projet, fiches, appelees = string(db.ProjetCHUES), r.FichesChues, r.AppeleesChues
		}
		out.Body.Items = append(out.Body.Items, CampagneImport{
			ID: r.ID, FileName: r.FileName, Feuille: feuille, Libelle: libelle,
			ImportedAt: lotISO(r.FinishedAt), Projet: projet, Fiches: int(fiches), Appelees: int(appelees),
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
