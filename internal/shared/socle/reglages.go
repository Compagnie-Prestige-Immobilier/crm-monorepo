package socle

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

func CleReglagesEnrolement(projet string) string { return "enrolement." + projet }

// Liste vide : un dossier est complet dès que la plateforme a daté sa décision.
// Sinon, seuls les statuts distants listés par l'administrateur comptent.
func StatutsDossierComplet(ctx context.Context, q *db.Queries, projet string) ([]string, error) {
	ligne, err := q.GetSetting(ctx, CleReglagesEnrolement(projet))
	if errors.Is(err, pgx.ErrNoRows) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	var valeurs struct {
		StatutsComplets []string `json:"statutsComplets"`
	}
	_ = json.Unmarshal([]byte(ligne.Value), &valeurs)
	if valeurs.StatutsComplets == nil {
		return []string{}, nil
	}
	return valeurs.StatutsComplets, nil
}
