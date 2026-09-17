package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"maps"
	"net/http"
	"slices"

	"github.com/danielgtaylor/huma/v2"
)

type CampagneAjoutEquipeInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		TeleconseillerID string `json:"teleconseillerId" maxLength:"64"`
		Positions        []int  `json:"positions,omitempty" maxItems:"1000"`
	}
}

// Les fiches données sont prises aux non traitées des collègues : l'ajout ne
// tire aucune fiche nouvelle dans la campagne.
func (s *service) campagneAjouterTeleconseiller(ctx context.Context, in *CampagneAjoutEquipeInput) (*CampagneDetailOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	vers := in.Body.TeleconseillerID
	if _, err := s.lotEquipe(ctx, []string{vers}); err != nil {
		return nil, err
	}
	equipe := lotLireFiltres(row.Filters).Distribution.TeleconseillerIds
	if slices.Contains(equipe, vers) {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_DEJA_DANS_EQUIPE",
			"Ce téléconseiller fait déjà partie de la campagne.")
	}
	mouvements, err := s.lotMouvementsVers(ctx, row, in.Body.Positions, vers, false)
	if err != nil {
		return nil, err
	}
	if len(in.Body.Positions) > 0 && len(mouvements) == 0 {
		return nil, lotReaffectationVide()
	}
	equipe = append(slices.Clone(equipe), vers)
	if err := s.lotAppliquerMouvements(ctx, row, mouvements, equipe, "lot_export.ajout_teleconseiller",
		map[string]any{"teleconseiller": vers}); err != nil {
		return nil, err
	}
	return s.campagneDetail(ctx, &CampagneIDInput{ID: in.ID})
}

func lotReaffectationVide() error {
	return socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_REAFFECTATION_VIDE",
		"Aucune de ces fiches n’est déplaçable : elles sont traitées, ou déjà à ce compte.")
}

// L'ajout ne prend que des fiches non traitées ; la réaffectation choisie par
// l'encadrement peut aussi confier une fiche traitée, ses appels restant à leur auteur.
func (s *service) lotMouvementsVers(ctx context.Context, row *db.LotParIdRow, positions []int, vers string, avecTraitees bool) ([]lotMouvement, error) {
	if len(positions) == 0 {
		return nil, nil
	}
	traitees, err := s.lotPositionsTraitees(ctx, row)
	if err != nil {
		return nil, err
	}
	var candidates []int32
	for _, position := range positions {
		if avecTraitees || !traitees[lotInt32(position)] {
			candidates = append(candidates, lotInt32(position))
		}
	}
	deplacables, err := s.Q.LotPositionsDeplacables(ctx, db.LotPositionsDeplacablesParams{
		LotId: row.ID, Column2: candidates, AssigneeId: lotPointeurTexte(vers),
	})
	if err != nil {
		return nil, err
	}
	parCedant := map[string][]int32{}
	for _, item := range deplacables {
		cedant := lotValeurTexte(item.AssigneeId)
		parCedant[cedant] = append(parCedant[cedant], item.Position)
	}
	mouvements := make([]lotMouvement, 0, len(parCedant))
	for _, cedant := range slices.Sorted(maps.Keys(parCedant)) {
		mouvements = append(mouvements, lotMouvement{de: cedant, vers: vers, positions: parCedant[cedant]})
	}
	return mouvements, nil
}

// Un membre sans fiche n'a aucune ligne dans les requêtes de performance : sans
// lui, l'écran ne montrerait ni celui qu'on vient d'ajouter, ni de quoi le retirer.
func (s *service) lotMembresSansFiche(ctx context.Context, performance []CampagnePerformance, stored lotDistribution) ([]CampagnePerformance, error) {
	presents := map[string]bool{}
	for _, ligne := range performance {
		presents[ligne.TeleconseillerID] = true
	}
	absents := slices.DeleteFunc(slices.Clone(stored.TeleconseillerIds), func(id string) bool { return presents[id] })
	if len(absents) == 0 {
		return performance, nil
	}
	rows, err := s.Q.Teleconseillers(ctx, absents)
	if err != nil {
		return nil, err
	}
	for _, membre := range rows {
		performance = append(performance, CampagnePerformance{
			TeleconseillerID: membre.ID, TeleconseillerName: membre.FullName,
			Objectif: lotObjectifDe(membre.ID, stored),
		})
	}
	return performance, nil
}

func monterCampagnesEquipe(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "ajouterTeleconseillerLotExport", Method: http.MethodPost,
		Path: "/api/v1/lots-export/{id}/equipe",
	}, s.campagneAjouterTeleconseiller)
}
