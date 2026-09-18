package socle

import (
	"context"
	"cpi-go/db"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

func CleReglagesEnrolement(projet string) string { return "enrolement." + projet }

// L'adresse et le jeton d'intégration d'une plateforme, lus dans l'environnement.
// Le tirage d'enrôlement et le téléchargement des pièces les lisent tous deux.
func PlateformeConfiguree(projet string) (base, jeton string) {
	if projet == ProjetGrandPublic {
		return strings.TrimSpace(Env("PLATEFORME_GRAND_PUBLIC_URL", "")), strings.TrimSpace(Env("PLATEFORME_GRAND_PUBLIC_TOKEN", ""))
	}
	return strings.TrimSpace(Env("PLATEFORME_CHUES_URL", "")), strings.TrimSpace(Env("PLATEFORME_CHUES_TOKEN", ""))
}

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
