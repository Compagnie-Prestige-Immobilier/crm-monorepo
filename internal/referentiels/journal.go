package referentiels

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"

	"github.com/jackc/pgx/v5"
)

// L'écriture et sa trace dans la même transaction : une entrée désactivée sans
// trace est exactement ce qu'on cherchera à expliquer trois semaines plus tard.
func (s *service) referentielTracer(ctx context.Context, action, famille, id string,
	geste func(*db.Queries) (avant, apres map[string]any, err error),
) error {
	auteur := socle.UtilisateurCourant(ctx).ID
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		avant, apres, err := geste(q)
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, auteur, action, famille, id, avant, apres)
	})
}

// Les deux familles basculent de la même façon : seule la requête change.
func (s *service) referentielBasculer(ctx context.Context, famille, id string, actif, cible bool,
	ecrire func(*db.Queries) error,
) error {
	return s.referentielTracer(ctx, referentielsActionActiver, famille, id,
		func(q *db.Queries) (map[string]any, map[string]any, error) {
			if err := ecrire(q); err != nil {
				return nil, nil, err
			}
			return map[string]any{referentielsNomActif: actif}, map[string]any{referentielsNomActif: cible}, nil
		})
}

func referentielsValeursJournal(cols []string, args []any) map[string]any {
	valeurs := make(map[string]any, len(cols))
	for i, col := range cols {
		valeurs[col] = args[i]
	}
	return valeurs
}

func referentielsEtatJournal(ctx context.Context, tx pgx.Tx, l *referentielsListe, id string, cols []string) (map[string]any, error) {
	var ligne map[string]any
	err := tx.QueryRow(ctx, `SELECT to_jsonb(t) FROM "`+l.table+`" t WHERE t."id" = $1`, id).Scan(&ligne)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, l.introuvableErreur()
	}
	if err != nil {
		return nil, err
	}
	avant := make(map[string]any, len(cols))
	for _, col := range cols {
		avant[col] = ligne[col]
	}
	return avant, nil
}

func referentielsStatutJournal(r *db.StatutsQualification) map[string]any {
	return map[string]any{
		referentielsNomCode: r.Code, referentielsNomLabel: r.Label, referentielsNomEffet: string(r.Effect),
		referentielsNomRappel: r.RequiresCallback, referentielsNomCommentaire: r.RequiresComment,
		referentielsNomReessai: r.RetryAfterMinutes, referentielsNomPriorite: string(r.Priorite),
		referentielsNomRelation: r.RelationStatus, referentielsNomRang: r.SortOrder,
		referentielsNomParent: r.ParentId,
	}
}

// Seules les colonnes que le corps a fournies entrent au journal : un PATCH
// partiel ne doit pas laisser croire qu'il a touché le reste.
func referentielsStatutDiff(de, vers *db.StatutsQualification,
	in *ReferentielsModifierStatutInput,
) (avant, apres map[string]any) {
	avant, apres = map[string]any{}, map[string]any{}
	if in.Body.Label != nil {
		avant[referentielsNomLabel], apres[referentielsNomLabel] = de.Label, vers.Label
	}
	if in.Body.RequiresCallback != nil {
		avant[referentielsNomRappel], apres[referentielsNomRappel] = de.RequiresCallback, vers.RequiresCallback
	}
	if in.Body.RequiresComment != nil {
		avant[referentielsNomCommentaire], apres[referentielsNomCommentaire] = de.RequiresComment, vers.RequiresComment
	}
	if in.Body.RetryAfterMinutes != nil {
		avant[referentielsNomReessai], apres[referentielsNomReessai] = de.RetryAfterMinutes, vers.RetryAfterMinutes
	}
	if in.Body.Priorite != nil {
		avant[referentielsNomPriorite], apres[referentielsNomPriorite] = string(de.Priorite), string(vers.Priorite)
	}
	if in.Body.RelationStatus != nil {
		avant[referentielsNomRelation], apres[referentielsNomRelation] = de.RelationStatus, vers.RelationStatus
	}
	return avant, apres
}

func referentielsMotifJournal(r *db.CallOutcomeReason) map[string]any {
	return map[string]any{
		referentielsNomCode: r.Code, referentielsNomLabel: r.Label, referentielsNomEffet: string(r.Effect),
		referentielsNomCommentaire: r.RequiresComment, referentielsNomRappel: r.RequiresCallback,
		referentielsNomJoint: r.CountsAsReached, referentielsNomCouleur: r.Color,
		referentielsNomRang: r.SortOrder,
	}
}

func referentielsMotifDiff(de, vers *db.CallOutcomeReason,
	in *ReferentielsModifierMotifInput,
) (avant, apres map[string]any) {
	avant, apres = map[string]any{}, map[string]any{}
	if in.Body.Label != nil {
		avant[referentielsNomLabel], apres[referentielsNomLabel] = de.Label, vers.Label
	}
	if in.Body.Color != nil {
		avant[referentielsNomCouleur], apres[referentielsNomCouleur] = de.Color, vers.Color
	}
	if in.Body.SortOrder != nil {
		avant[referentielsNomRang], apres[referentielsNomRang] = de.SortOrder, vers.SortOrder
	}
	if in.Body.RequiresComment != nil {
		avant[referentielsNomCommentaire], apres[referentielsNomCommentaire] = de.RequiresComment, vers.RequiresComment
	}
	if in.Body.RequiresCallback != nil {
		avant[referentielsNomRappel], apres[referentielsNomRappel] = de.RequiresCallback, vers.RequiresCallback
	}
	if in.Body.CountsAsReached != nil {
		avant[referentielsNomJoint], apres[referentielsNomJoint] = de.CountsAsReached, vers.CountsAsReached
	}
	return avant, apres
}
