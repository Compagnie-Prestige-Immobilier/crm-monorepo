package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type CampagneMajInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Name      *string            `json:"name,omitempty" minLength:"3" maxLength:"120"`
		Objectifs []CampagneObjectif `json:"objectifs,omitempty"`
		EnPause   *bool              `json:"enPause,omitempty"`
	}
}

// En pause, les fiches du lot sortent des consoles de ses téléconseillers ;
// la reprise les y ramène telles quelles.
func lotPauser(ctx context.Context, q *db.Queries, id string, enPause bool) error {
	var at *time.Time
	if enPause {
		maintenant := time.Now().UTC()
		at = &maintenant
	}
	return q.PauserLot(ctx, db.PauserLotParams{ID: id, At: at})
}

// Le nom, les objectifs et la pause : ce que la trace doit permettre de
// retrouver, sans recopier les filtres du lot.
func lotChangements(row *db.LotParIdRow, in *CampagneMajInput) (avant, apres map[string]any) {
	avant = map[string]any{
		lotCleNom: row.Name, "objectifs": lotLireFiltres(row.Filters).Distribution.Objectifs,
		"enPause": row.PausedAt != nil,
	}
	apres = maps.Clone(avant)
	if in.Body.Name != nil {
		apres[lotCleNom] = strings.TrimSpace(*in.Body.Name)
	}
	if in.Body.Objectifs != nil {
		apres["objectifs"] = lotObjectifsDe(in.Body.Objectifs)
	}
	if in.Body.EnPause != nil {
		apres["enPause"] = *in.Body.EnPause
	}
	return avant, apres
}

// Ni le nom ni les objectifs ne redistribuent : les fiches sont déjà dans les
// mains, et un objectif est le dénominateur du taux de contact.
func (s *service) campagneMaj(ctx context.Context, in *CampagneMajInput) (*CampagneOutput, error) {
	row, err := s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	avant, apres := lotChangements(row, in)
	auteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := s.lotEcrireChangements(ctx, q, in); err != nil {
			return err
		}
		return database.Auditer(ctx, q, auteur, "lot_export.update", "lot_export", in.ID, avant, apres)
	}); err != nil {
		return nil, err
	}
	row, err = s.lot(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	resume, err := s.lotResume(ctx, row)
	if err != nil {
		return nil, err
	}
	return &CampagneOutput{Body: resume}, nil
}

func (s *service) lotEcrireChangements(ctx context.Context, q *db.Queries, in *CampagneMajInput) error {
	if in.Body.Name != nil {
		if err := q.RenommerLot(ctx, db.RenommerLotParams{ID: in.ID, Name: strings.TrimSpace(*in.Body.Name)}); err != nil {
			return err
		}
	}
	if in.Body.Objectifs != nil {
		filtres, err := lotFiltresVerrouilles(ctx, q, in.ID)
		if err != nil {
			return err
		}
		filtres.Distribution.Objectifs = lotObjectifsDe(in.Body.Objectifs)
		if err := s.lotEcrireFiltres(ctx, q, in.ID, filtres); err != nil {
			return err
		}
	}
	if in.Body.EnPause == nil {
		return nil
	}
	return lotPauser(ctx, q, in.ID, *in.Body.EnPause)
}

// Relus sous verrou dans la transaction qui les réécrit : deux gestes simultanés
// sur l'équipe partiraient sinon de la même lecture et le second effacerait le premier.
func lotFiltresVerrouilles(ctx context.Context, q *db.Queries, id string) (*lotFiltres, error) {
	brut, err := q.VerrouillerLot(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "LOT_EXPORT_NOT_FOUND", campagneIntrouvable)
	}
	if err != nil {
		return nil, err
	}
	return lotLireFiltres(brut), nil
}

func (s *service) lotRecomposerEquipe(ctx context.Context, q *db.Queries, id, entrant, sortant string) error {
	filtres, err := lotFiltresVerrouilles(ctx, q, id)
	if err != nil {
		return err
	}
	equipe := slices.DeleteFunc(filtres.Distribution.TeleconseillerIds, func(membre string) bool { return membre == sortant })
	if entrant != "" && !slices.Contains(equipe, entrant) {
		equipe = append(equipe, entrant)
	}
	if len(equipe) == 0 {
		return socle.Problem(http.StatusUnprocessableEntity, "LOT_EXPORT_EQUIPE_VIDE",
			"Une campagne garde au moins un téléconseiller.")
	}
	filtres.Distribution.TeleconseillerIds = equipe
	maps.DeleteFunc(filtres.Distribution.Objectifs, func(membre string, _ int) bool { return !slices.Contains(equipe, membre) })
	return s.lotEcrireFiltres(ctx, q, id, filtres)
}

func (*service) lotEcrireFiltres(ctx context.Context, q *db.Queries, id string, filtres *lotFiltres) error {
	brut, err := json.Marshal(filtres)
	if err != nil {
		return err
	}
	return q.EcrireFiltresLot(ctx, db.EcrireFiltresLotParams{ID: id, Filters: brut})
}
