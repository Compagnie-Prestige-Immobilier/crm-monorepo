package socle

import (
	"context"
	"cpi-go/db"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Ce que chaque domaine reçoit au montage : requêtes, pool, config, bus SSE.
type Deps struct {
	Q    *db.Queries
	Pool *pgxpool.Pool
	Cfg  *Config
	Live *Live
}

const ChaqueMinute = "*/1 * * * *"

type Tache struct {
	Nom  string
	Cron string
	Run  func(context.Context) error
}
