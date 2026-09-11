package socle

import (
	"context"
	"cpi-go/db"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Ce que chaque domaine reçoit au montage : requêtes, pool, config, bus SSE,
// et les noms de toutes les bases servies pour la page de connexion.
type Deps struct {
	Q     *db.Queries
	Pool  *pgxpool.Pool
	Cfg   *Config
	Live  *Live
	Bases []string
}

const ChaqueMinute = "*/1 * * * *"

type Tache struct {
	Nom  string
	Cron string
	Run  func(context.Context) error
}
