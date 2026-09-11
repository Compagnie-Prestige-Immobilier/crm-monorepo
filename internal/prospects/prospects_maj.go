package prospects

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Une colonne par appel, une valeur par paramètre : la liste des colonnes vient
// du code, jamais de la requête.
type prospectMaj struct {
	colonnes []string
	args     []any
}

func prospectNouvelleMaj() *prospectMaj {
	return &prospectMaj{colonnes: []string{`"rev" = "rev" + 1`}}
}

func (m *prospectMaj) set(colonne string, valeur any) {
	m.args = append(m.args, valeur)
	m.colonnes = append(m.colonnes, `"`+colonne+`" = $`+strconv.Itoa(len(m.args)))
}

func (m *prospectMaj) appliquer(ctx context.Context, pool *pgxpool.Pool, id string) error {
	m.args = append(m.args, id)
	requete := `UPDATE "prospects" SET ` + strings.Join(m.colonnes, ", ") +
		` WHERE "id" = $` + strconv.Itoa(len(m.args))
	_, err := pool.Exec(ctx, requete, m.args...)
	return err
}

func prospectPoser[T any](m *prospectMaj, colonne string, v *T) {
	if v != nil {
		m.set(colonne, *v)
	}
}

// Postgres refuse une chaîne nue sur une colonne d'énumération : la valeur part
// avec son type Go, et un effacement part en NULL non typé.
func prospectPoserEnum[T ~string](m *prospectMaj, colonne string, v *string) {
	if v != nil {
		m.set(colonne, T(*v))
	}
}

func prospectPoserOptionnel(m *prospectMaj, colonne string, v prospectOptionnel[string]) {
	if v.fourni {
		m.set(colonne, v.valeur)
	}
}

func prospectPoserOptionnelEnum[T ~string](m *prospectMaj, colonne string, v prospectOptionnel[string]) {
	if !v.fourni {
		return
	}
	if v.valeur == nil {
		m.set(colonne, nil)
		return
	}
	m.set(colonne, T(*v.valeur))
}
