package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"slices"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
)

type CampagneAffecterInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		TeleconseillerID string `json:"teleconseillerId,omitempty" maxLength:"64"`
		CampagneID       string `json:"campagneId,omitempty" format:"uuid" doc:"La campagne choisit le membre le moins chargé."`
	}
}

type CampagneAffecterOutput struct {
	Body struct {
		TeleconseillerID string `json:"teleconseillerId"`
		Campagnes        int    `json:"campagnes" doc:"Campagnes en cours où la fiche a suivi."`
	}
}

// Une fiche suit UN téléconseiller : le titulaire change, les campagnes en
// cours et le rappel promis suivent, les appels passés restent à leurs auteurs.
func (s *service) campagneAffecterProspect(ctx context.Context, in *CampagneAffecterInput) (*CampagneAffecterOutput, error) {
	fiche, err := s.Q.ProspectPourRequalification(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "PHASE2_PROSPECT_NOT_FOUND", "Prospect introuvable ou supprimé.")
	}
	if err != nil {
		return nil, err
	}
	if fiche.Statut == db.ProspectStatutCONVERTI || fiche.Statut == db.ProspectStatutVENDU {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "PROSPECT_CONVERTI", "Une fiche convertie ou vendue ne s’affecte plus.")
	}
	cible := db.LotsActifsDeLaFicheParams{ProspectID: &in.ID}
	vers, err := s.campagneTitulaireVise(ctx, in, cible, false)
	if err != nil {
		return nil, err
	}
	campagnes, err := s.campagneSuivreLaFiche(ctx, cible, vers)
	if err != nil {
		return nil, err
	}
	u := socle.UtilisateurCourant(ctx)
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.ReaffecterProspects(ctx, db.ReaffecterProspectsParams{CommercialID: &vers, Ids: []string{in.ID}}); err != nil {
			return err
		}
		if err := q.PrioriserProspect(ctx, in.ID); err != nil {
			return err
		}
		if err := q.TransfererRappels(ctx, db.TransfererRappelsParams{Vers: vers, ProspectID: in.ID}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "prospect.affectation", "prospect", in.ID,
			campagneTitulaireAvant(fiche.CreatedById, fiche.TitulaireNom), campagneTraceAffectation(vers, campagnes))
	})
	if err != nil {
		return nil, err
	}
	return campagneAffectationFaite(vers, campagnes), nil
}

func (s *service) campagneAffecterRepresentant(ctx context.Context, in *CampagneAffecterInput) (*CampagneAffecterOutput, error) {
	cible := db.LotsActifsDeLaFicheParams{RepresentantID: &in.ID}
	vers, err := s.campagneTitulaireVise(ctx, in, cible, true)
	if err != nil {
		return nil, err
	}
	campagnes, err := s.campagneSuivreLaFiche(ctx, cible, vers)
	if err != nil {
		return nil, err
	}
	u := socle.UtilisateurCourant(ctx)
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		avant, err := q.RepresentantPourRequalification(ctx, in.ID)
		if err == nil {
			_, err = q.AffecterRepresentant(ctx, db.AffecterRepresentantParams{Vers: vers, ID: in.ID})
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusNotFound, "REPRESENTANT_NOT_FOUND", "Représentant introuvable.")
		}
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "representant.affectation", "representant", in.ID,
			campagneTitulaireAvant(avant.CreatedById, avant.TitulaireNom), campagneTraceAffectation(vers, campagnes))
	})
	if err != nil {
		return nil, err
	}
	return campagneAffectationFaite(vers, campagnes), nil
}

func campagneAffectationFaite(vers string, campagnes int) *CampagneAffecterOutput {
	out := &CampagneAffecterOutput{}
	out.Body.TeleconseillerID, out.Body.Campagnes = vers, campagnes
	return out
}

// Le journal garde qui suivait la fiche avant : un compte fermé ou passé à
// l'accueil reste lisible sur les fiches qu'il a portées.
func campagneTitulaireAvant(id, nom string) map[string]any {
	return map[string]any{lotCleTeleconseillerID: id, "teleconseiller": nom}
}

func campagneTraceAffectation(vers string, campagnes int) map[string]any {
	return map[string]any{lotCleTeleconseillerID: vers, "campagnes": campagnes}
}

// Un téléconseiller nommé, ou une campagne qui désigne son membre le moins
// chargé et reçoit la fiche si elle ne l'a pas déjà.
func (s *service) campagneTitulaireVise(ctx context.Context, in *CampagneAffecterInput, fiche db.LotsActifsDeLaFicheParams, surRepresentants bool) (string, error) {
	if (in.Body.TeleconseillerID == "") == (in.Body.CampagneID == "") {
		return "", socle.Problem(http.StatusBadRequest, "AFFECTATION_CIBLE",
			"Indiquez un téléconseiller ou une campagne, pas les deux.")
	}
	if in.Body.TeleconseillerID != "" {
		_, err := s.lotEquipe(ctx, []string{in.Body.TeleconseillerID})
		return in.Body.TeleconseillerID, err
	}
	row, err := s.lot(ctx, in.Body.CampagneID)
	if err != nil {
		return "", err
	}
	if row.PausedAt != nil {
		return "", socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_EN_PAUSE", "Cette campagne est en pause.")
	}
	if lotSurRepresentants(string(row.Cible), row.Projet) != surRepresentants {
		return "", socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_CIBLE", "Cette campagne ne vise pas ce type de fiche.")
	}
	membre, err := s.campagneMembreLeMoinsCharge(ctx, row)
	if err != nil {
		return "", err
	}
	return membre, s.campagneAjouterFiche(ctx, row, fiche, membre)
}

func (s *service) campagneMembreLeMoinsCharge(ctx context.Context, row *db.LotParIdRow) (string, error) {
	equipe, err := lotEquipeRestante(ctx, s.Q, lotLireFiltres(row.Filters).Distribution.TeleconseillerIds)
	if err != nil {
		return "", err
	}
	if len(equipe) == 0 {
		return "", socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_EQUIPE_VIDE", "Cette campagne n’a plus aucun téléconseiller actif.")
	}
	charges, err := s.Q.LotChargeParMembre(ctx, row.ID)
	if err != nil {
		return "", err
	}
	fichesDe := map[string]int32{}
	for _, charge := range charges {
		fichesDe[lotValeurTexte(charge.AssigneeId)] = charge.Fiches
	}
	choisi := equipe[0].id
	for _, membre := range equipe[1:] {
		if fichesDe[membre.id] < fichesDe[choisi] {
			choisi = membre.id
		}
	}
	return choisi, nil
}

func (s *service) campagneAjouterFiche(ctx context.Context, row *db.LotParIdRow, fiche db.LotsActifsDeLaFicheParams, membre string) error {
	auteur := socle.UtilisateurCourant(ctx).ID
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if _, err := lotFiltresVerrouilles(ctx, q, row.ID); err != nil {
			return err
		}
		items, err := q.LotsActifsDeLaFiche(ctx, fiche)
		if err != nil {
			return err
		}
		if slices.ContainsFunc(items, func(item db.LotsActifsDeLaFicheRow) bool { return item.LotId == row.ID }) {
			return nil
		}
		position, err := q.AjouterFicheAuLot(ctx, db.AjouterFicheAuLotParams{
			LotID: row.ID, RepresentantID: fiche.RepresentantID, ProspectID: fiche.ProspectID, AssigneeID: &membre,
		})
		if err != nil {
			return err
		}
		if err := q.IncrementerItemCount(ctx, row.ID); err != nil {
			return err
		}
		return database.Auditer(ctx, q, auteur, "lot_export.affectation", "lot_export", row.ID, nil,
			map[string]any{lotCleVers: membre, "position": position})
	})
}

// Chaque campagne en cours qui tient la fiche la déplace vers le nouveau
// titulaire, par le même geste que la réaffectation d'un lot.
func (s *service) campagneSuivreLaFiche(ctx context.Context, fiche db.LotsActifsDeLaFicheParams, vers string) (int, error) {
	items, err := s.Q.LotsActifsDeLaFiche(ctx, fiche)
	if err != nil {
		return 0, err
	}
	suivies := 0
	for _, item := range items {
		row, err := s.lot(ctx, item.LotId)
		if err != nil {
			return suivies, err
		}
		err = s.lotAppliquerMouvements(ctx, row, vers, "", "lot_export.reaffectation", map[string]any{lotCleVers: vers, "fiche": "affectation"},
			func(q *db.Queries, _ *lotFiltres) ([]lotMouvement, error) {
				return lotMouvementsExiges(lotMouvementsVers(ctx, q, row, []int{int(item.Position)}, vers, true))
			})
		var probleme *socle.ProblemError
		if errors.As(err, &probleme) && probleme.Code == codeReaffectationVide {
			continue
		}
		if err != nil {
			return suivies, err
		}
		suivies++
	}
	return suivies, nil
}

func campagneMonterAffectation(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "affecterProspect", Method: http.MethodPost,
		Path: "/api/v1/prospects/{id}/affecter",
	}, s.campagneAffecterProspect)
	huma.Register(api, huma.Operation{
		OperationID: "affecterRepresentant", Method: http.MethodPost,
		Path: "/api/v1/representants/{id}/affecter",
	}, s.campagneAffecterRepresentant)
}
