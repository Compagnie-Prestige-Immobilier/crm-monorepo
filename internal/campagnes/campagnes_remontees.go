package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
)

// RangerFichesRemontees place dans la campagne de leur onglet les fiches qu'un
// relevé a créées après son lancement : le marketing complète des lignes
// après coup, et la campagne du jour doit les appeler, pas une campagne à part.
// Le rangement repart de la base à chaque relevé : une fiche laissée de côté
// (campagne en pause, équipe vide) entre au relevé suivant.
func RangerFichesRemontees(ctx context.Context, d *socle.Deps, auteur string) (int, error) {
	return (&service{d}).rangerFichesRemontees(ctx, auteur)
}

func (s *service) rangerFichesRemontees(ctx context.Context, auteur string) (int, error) {
	lignes, err := s.Q.FichesRemonteesARanger(ctx)
	if err != nil {
		return 0, err
	}
	var lots []string
	parLot := map[string][]string{}
	for _, ligne := range lignes {
		if _, vu := parLot[ligne.LotId]; !vu {
			lots = append(lots, ligne.LotId)
		}
		parLot[ligne.LotId] = append(parLot[ligne.LotId], ligne.ProspectId)
	}
	rangees := 0
	for _, lotID := range lots {
		recues, err := s.rangerDansLaCampagne(ctx, auteur, lotID, parLot[lotID])
		if err != nil {
			return rangees, fmt.Errorf("fiches remontées, campagne %s : %w", lotID, err)
		}
		rangees += s.aviserRemontees(ctx, auteur, lotID, recues)
	}
	return rangees, nil
}

// Chaque fiche va au membre le moins chargé de la campagne, comme une
// affectation à la main. Rend les fiches reçues par membre.
func (s *service) rangerDansLaCampagne(ctx context.Context, auteur, lotID string, fiches []string) (map[string]int, error) {
	row, err := s.lot(ctx, lotID)
	if err != nil {
		return nil, err
	}
	equipe, err := lotEquipeRestante(ctx, s.Q, lotLireFiltres(row.Filters).Distribution.TeleconseillerIds)
	if lotEquipeVide(err) {
		slog.Warn("fiches remontées : campagne sans équipe, fiches laissées au sélecteur", "lot", lotID, lotCleFiches, len(fiches))
		return map[string]int{}, nil
	}
	if err != nil {
		return nil, err
	}
	recues := map[string]int{}
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		// Le verrou du tirage : une campagne lancée au même instant ne prend pas les mêmes fiches.
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext('lots_export.tirage'))"); err != nil {
			return err
		}
		q := s.Q.WithTx(tx)
		recues, err = lotRangerFiches(ctx, q, lotID, equipe, fiches)
		if err != nil || len(recues) == 0 {
			return err
		}
		return database.Auditer(ctx, q, auteur, "lot_export.remontees", "lot_export", lotID, nil,
			map[string]any{lotCleFiches: lotTotal(recues), "parMembre": recues})
	})
	return recues, err
}

func lotRangerFiches(ctx context.Context, q *db.Queries, lotID string, equipe []lotTeleconseiller, fiches []string) (map[string]int, error) {
	charges, err := q.LotChargeParMembre(ctx, lotID)
	if err != nil {
		return nil, err
	}
	fichesDe := map[string]int32{}
	for _, charge := range charges {
		fichesDe[lotValeurTexte(charge.AssigneeId)] = charge.Fiches
	}
	recues := map[string]int{}
	for _, prospectID := range fiches {
		membre := lotMoinsCharge(equipe, fichesDe)
		rangee, err := lotRangerFiche(ctx, q, lotID, prospectID, membre)
		if err != nil {
			return nil, err
		}
		if rangee {
			fichesDe[membre]++
			recues[membre]++
		}
	}
	return recues, nil
}

// Une fiche entrée dans une campagne entre la lecture et l'écriture n'est pas rangée.
func lotRangerFiche(ctx context.Context, q *db.Queries, lotID, prospectID, membre string) (bool, error) {
	_, err := q.RangerFicheRemontee(ctx, db.RangerFicheRemonteeParams{LotID: lotID, ProspectID: prospectID, AssigneeID: membre})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := q.IncrementerItemCount(ctx, lotID); err != nil {
		return false, err
	}
	return true, q.PrioriserProspect(ctx, prospectID)
}

func lotEquipeVide(err error) bool {
	var probleme *socle.ProblemError
	return errors.As(err, &probleme) && probleme.Code == "LOT_EXPORT_EQUIPE_VIDE"
}

func lotMoinsCharge(equipe []lotTeleconseiller, fichesDe map[string]int32) string {
	choisi := equipe[0].id
	for _, membre := range equipe[1:] {
		if fichesDe[membre.id] < fichesDe[choisi] {
			choisi = membre.id
		}
	}
	return choisi
}

func lotTotal(recues map[string]int) int {
	total := 0
	for _, n := range recues {
		total += n
	}
	return total
}

// Les fiches sont déjà rangées : un avis manqué se journalise sans les retirer.
// Rend le nombre de fiches rangées.
func (s *service) aviserRemontees(ctx context.Context, auteur, lotID string, recues map[string]int) int {
	total := lotTotal(recues)
	if total == 0 {
		return 0
	}
	row, err := s.lot(ctx, lotID)
	if err != nil {
		slog.Error("fiches remontées, avis non émis", "lot", lotID, "err", err)
		return total
	}
	route := "/teleconseil/campagnes/" + lotID
	if row.Projet != nil && *row.Projet == db.ProjetGRANDPUBLIC {
		route = "/grand-public/campagnes/" + lotID
	}
	avis := []struct {
		pour  string
		texte string
	}{{row.CreatedById, fmt.Sprintf("« %s » : %s du classeur, %s.", row.Name, fichesRemontees(total), reparties(total))}}
	for membre, n := range recues {
		if membre != row.CreatedById {
			confiee := "vous sont confiées"
			if n == 1 {
				confiee = "vous est confiée"
			}
			avis = append(avis, struct{ pour, texte string }{
				membre,
				fmt.Sprintf("« %s » : %s du classeur %s.", row.Name, fichesRemontees(n), confiee),
			})
		}
	}
	for _, a := range avis {
		_, err := notifications.Composer(ctx, s.Deps, auteur, &notifications.CreationNotification{
			Title: "Fiches remontées", Body: a.texte,
			Category: string(db.NotificationCategoryCAMPAGNE), Route: route,
			Audience: string(db.NotificationAudienceUSERS), AudienceUserIDs: []string{a.pour},
		})
		if err != nil {
			slog.Error("fiches remontées, avis non émis", "lot", lotID, "destinataire", a.pour, "err", err)
		}
	}
	return total
}

func fichesRemontees(n int) string {
	if n == 1 {
		return "1 fiche remontée"
	}
	return fmt.Sprintf("%d fiches remontées", n)
}

func reparties(n int) string {
	if n == 1 {
		return "confiée au membre le moins chargé"
	}
	return "réparties sur l'équipe"
}
