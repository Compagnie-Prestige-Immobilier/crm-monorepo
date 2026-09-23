package socle

import (
	"context"
	"cpi-go/db"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Ce que chaque domaine reçoit au montage : requêtes, pool, config, bus SSE,
// et les noms de toutes les bases servies pour la page de connexion.
type Deps struct {
	Q        *db.Queries
	Pool     *pgxpool.Pool
	Cfg      *Config
	Live     *Live
	Annuaire *Annuaire
	// Nil sans base (drapeaux -roles, -openapi) : les permissions par défaut valent.
	Attributions *Attributions
	// Nom de tâche vers expression cron, rempli au démarrage par le
	// planificateur : le retard d'un cron se juge sur la cadence déclarée.
	Planifications map[string]string
}

const ChaqueMinute = "*/1 * * * *"

type Tache struct {
	Nom  string
	Cron string
	Run  func(context.Context) error
}

// Un jour saisi par un écran vaut du premier instant local au premier instant
// du lendemain : une borne posée à minuit perdrait la journée même.
func BornesDuJour(du, au string, zone *time.Location) (debut, fin *time.Time, err error) {
	premier, posePremier, err := borneDuJour(du, zone, 0)
	if err != nil {
		return nil, nil, err
	}
	dernier, poseDernier, err := borneDuJour(au, zone, 1)
	if err != nil {
		return nil, nil, err
	}
	if posePremier {
		debut = &premier
	}
	if poseDernier {
		fin = &dernier
	}
	return debut, fin, nil
}

// `pose` distingue la borne absente, qui ne filtre rien, de la borne fautive.
func borneDuJour(jour string, zone *time.Location, joursEnPlus int) (borne time.Time, pose bool, err error) {
	jour = strings.TrimSpace(jour)
	if jour == "" {
		return time.Time{}, false, nil
	}
	lu, err := time.ParseInLocation("2006-01-02", jour, zone)
	if err != nil {
		return time.Time{}, false, Problem(http.StatusBadRequest, "JOUR_INVALIDE",
			"Les dates s'écrivent AAAA-MM-JJ.")
	}
	return lu.AddDate(0, 0, joursEnPlus).UTC(), true, nil
}
