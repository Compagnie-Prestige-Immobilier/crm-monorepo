package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"strings"
)

type CampagneFichesInput struct {
	ID               string `path:"id" format:"uuid"`
	TeleconseillerID string `query:"teleconseillerId" format:"uuid"`
	Etat             string `query:"etat" enum:"NON_TRAITEE,TRAITEE,A_RAPPELER"`
	Page             int    `query:"page" minimum:"1" default:"1"`
	PageSize         int    `query:"pageSize" minimum:"1" maximum:"200" default:"50"`
}

type CampagneFichesOutput struct {
	Body struct {
		Items []CampagneFiche  `json:"items"`
		Meta  CampagnePageMeta `json:"meta"`
	}
}

func (s *service) campagneFiches(ctx context.Context, in *CampagneFichesInput) (*CampagneFichesOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	traitees, err := s.lotPositionsTraitees(ctx, row)
	if err != nil {
		return nil, err
	}
	agent := lotPointeurTexte(in.TeleconseillerID)
	page := lotPage{
		etat:     lotPointeurTexte(in.Etat),
		taille:   int64(in.PageSize),
		decalage: int64((in.Page - 1) * in.PageSize),
	}
	items, err := s.lotLireFiches(ctx, row, traitees, agent, page)
	if err != nil {
		return nil, err
	}
	total, err := s.lotCompterFiches(ctx, row, agent, page)
	if err != nil {
		return nil, err
	}
	out := &CampagneFichesOutput{}
	out.Body.Items = items
	out.Body.Meta = lotMetaPage(total, in.Page, in.PageSize)
	return out, nil
}

// Le lot d'un déploiement porte 3 080 fiches : les remonter toutes pour en
// rendre cinquante coûtait la base entière du lot à chaque page.
type lotPage struct {
	etat     *string
	taille   int64
	decalage int64
}

func (s *service) lotCompterFiches(ctx context.Context, row *db.LotParIdRow, agent *string, page lotPage) (int, error) {
	if lotSurRepresentants(string(row.Cible)) {
		n, err := s.Q.LotFichesRepresentantsCount(ctx, db.LotFichesRepresentantsCountParams{
			LotId: row.ID, AssigneeID: agent, Etat: page.etat, Depuis: row.CreatedAt,
		})
		return int(n), err
	}
	n, err := s.Q.LotFichesProspectsCount(ctx, db.LotFichesProspectsCountParams{
		LotId: row.ID, AssigneeID: agent, Etat: page.etat, Depuis: row.CreatedAt,
	})
	return int(n), err
}

func (s *service) lotLireFiches(ctx context.Context, row *db.LotParIdRow, traitees map[int32]bool,
	agent *string, page lotPage,
) ([]CampagneFiche, error) {
	if lotSurRepresentants(string(row.Cible)) {
		lignes, err := s.Q.LotFichesRepresentants(ctx, db.LotFichesRepresentantsParams{
			LotId: row.ID, AssigneeID: agent, Etat: page.etat, Depuis: row.CreatedAt,
			PageSize: page.taille, PageOffset: page.decalage,
		})
		if err != nil {
			return nil, err
		}
		fiches := make([]CampagneFiche, 0, len(lignes))
		for _, ligne := range lignes {
			fiches = append(fiches, CampagneFiche{
				Position: int(ligne.Position), Jour: int(ligne.Day), FicheID: ligne.FicheId,
				FullName: lotValeurTexte(ligne.FullName), PhoneE164: lotValeurTexte(ligne.PhoneE164),
				TeleconseillerID:   ligne.AssigneeId,
				TeleconseillerName: lotSiVide(lotValeurTexte(ligne.AssigneeName), "Non attribuée"),
				Etat:               lotEtatDe(traitees[ligne.Position], ligne.NextCallbackAt != nil),
				StatutLabel:        ligne.StatutLabel,
			})
		}
		return fiches, nil
	}
	lignes, err := s.Q.LotFichesProspects(ctx, db.LotFichesProspectsParams{
		LotId: row.ID, AssigneeID: agent, Etat: page.etat, Depuis: row.CreatedAt,
		PageSize: page.taille, PageOffset: page.decalage,
	})
	if err != nil {
		return nil, err
	}
	fiches := make([]CampagneFiche, 0, len(lignes))
	for _, ligne := range lignes {
		fiches = append(fiches, CampagneFiche{
			Position: int(ligne.Position), Jour: int(ligne.Day), FicheID: ligne.FicheId,
			FullName: lotNomEtPrenom(ligne.Nom, ligne.Prenom), PhoneE164: lotValeurTexte(ligne.PhoneE164),
			TeleconseillerID:   ligne.AssigneeId,
			TeleconseillerName: lotSiVide(lotValeurTexte(ligne.AssigneeName), "Non attribuée"),
			Etat:               lotEtatDe(traitees[ligne.Position], false),
			StatutLabel:        lotStatutFiche(ligne.LastReasonLabel, ligne.LastCallOutcome),
		})
	}
	return fiches, nil
}

// `A_RAPPELER` prime sur `TRAITEE` : une fiche appelée qui attend un rappel
// n'est pas finie.
func lotEtatDe(traitee, attendUnRappel bool) string {
	if attendUnRappel {
		return exports.LotEtatARappeler
	}
	if traitee {
		return lotEtatTraitee
	}
	return lotEtatNonTraitee
}

func lotNomEtPrenom(nom, prenom *string) string {
	parties := make([]string, 0, 2)
	for _, part := range []string{lotValeurTexte(nom), lotValeurTexte(prenom)} {
		if part != "" {
			parties = append(parties, part)
		}
	}
	return strings.Join(parties, " ")
}

// Le statut choisi par le téléconseiller, à défaut la famille de l'issue.
func lotStatutFiche(libelleMotif *string, issue string) *string {
	if libelleMotif != nil && *libelleMotif != "" {
		return libelleMotif
	}
	return lotPointeurTexte(lotLibellesIssueAppel[issue])
}
