package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type ProspectClient struct {
	ID         string  `json:"id" doc:"La fiche ; « vente-N » pour une vente saisie sans fiche au même téléphone."`
	AvecFiche  bool    `json:"avecFiche"`
	Prenom     string  `json:"prenom"`
	Nom        string  `json:"nom"`
	PhoneE164  *string `json:"phoneE164"`
	Projet     *string `json:"projet" enum:"CHUES,GRAND_PUBLIC" doc:"Absent pour une vente sans fiche."`
	LastCallAt *string `json:"lastCallAt"`
	// Faux quand la fiche est vendue sans vente rapprochée par téléphone.
	Vente            bool    `json:"vente"`
	Site             string  `json:"site"`
	DateSouscription *string `json:"dateSouscription"`
	NombreLots       int32   `json:"nombreLots"`
	NumerosLots      string  `json:"numerosLots"`
	PrixTotal        int64   `json:"prixTotal"`
	Reliquat         int64   `json:"reliquat"`
	Canal            string  `json:"canal"`
}

type ProspectClientsOutput struct {
	Body struct {
		Items []ProspectClient `json:"items"`
	}
}

// Les clients d'un téléconseiller, comptés comme la page Ventes : ses fiches vendues
// qu'il a appelées, et les ventes saisies à son nom.
func (s *service) prospectClients(ctx context.Context, in *ProspectPipelineInput) (*ProspectClientsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	appelePar, nom := u.ID, u.FullName
	if in.AppelePar != "" && in.AppelePar != u.ID && u.Peut(socle.PermissionPortefeuilleVoirTout) {
		noms, err := s.Q.NomsUtilisateurs(ctx, []string{in.AppelePar})
		if err != nil {
			return nil, err
		}
		appelePar, nom = in.AppelePar, ""
		if len(noms) == 1 {
			nom = noms[0].FullName
		}
	}
	lignes, err := s.Q.ClientsDuTeleconseiller(ctx, db.ClientsDuTeleconseillerParams{
		AppelePar: appelePar, NomComplet: nom, Projet: prospectVide(in.Projet),
	})
	if err != nil {
		return nil, err
	}
	out := &ProspectClientsOutput{}
	out.Body.Items = make([]ProspectClient, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		var souscription *string
		if l.DateSouscription.Valid {
			jour := l.DateSouscription.Time.Format("2006-01-02")
			souscription = &jour
		}
		out.Body.Items = append(out.Body.Items, ProspectClient{
			ID: l.ID, AvecFiche: l.AvecFiche, Prenom: l.Prenom, Nom: l.Nom, PhoneE164: prospectVide(l.PhoneE164),
			Projet: prospectVide(l.Projet), LastCallAt: prospectVide(l.LastCallAt), Vente: l.Vente, Site: l.Site, DateSouscription: souscription,
			NombreLots: l.NombreLots, NumerosLots: l.NumerosLots, PrixTotal: l.PrixTotal, Reliquat: l.Reliquat, Canal: l.Canal,
		})
	}
	return out, nil
}

func prospectMonterClients(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "clientsDuTeleconseiller", Method: http.MethodGet,
		Path: "/api/v1/prospects/clients",
	}, s.prospectClients)
}
