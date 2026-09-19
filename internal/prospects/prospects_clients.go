package prospects

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type ProspectClient struct {
	ID         string  `json:"id"`
	Prenom     string  `json:"prenom"`
	Nom        string  `json:"nom"`
	PhoneE164  *string `json:"phoneE164"`
	Projet     string  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
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

// Les clients d'un téléconseiller : ses contacts vendus, avec la vente rapprochée par téléphone.
func (s *service) prospectClients(ctx context.Context, in *ProspectPipelineInput) (*ProspectClientsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	appelePar := u.ID
	if in.AppelePar != "" && u.Peut(socle.PermissionPortefeuilleVoirTout) {
		appelePar = in.AppelePar
	}
	lignes, err := s.Q.ClientsDuTeleconseiller(ctx, db.ClientsDuTeleconseillerParams{
		AppelePar: appelePar, Projet: prospectTypeEnum[db.Projet](in.Projet),
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
			ID: l.ID, Prenom: l.Prenom, Nom: l.Nom, PhoneE164: l.PhoneE164, Projet: string(l.Projet),
			LastCallAt: prospectISOPtr(l.LastCallAt), Vente: l.Vente, Site: l.Site, DateSouscription: souscription,
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
