package assistant

import (
	"context"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"database/sql/driver"
	_ "embed"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	lignesMax       = 200
	delaiRequeteMax = 5 * time.Second
	essaisSQL       = 3
)

// Les directives se lisent dans un fichier : les affiner ne demande pas de
// relire le code qui les envoie.
//
//go:embed directives.md
var consigneSQL string

// Un ADMIN lit déjà toute la base par les écrans et les exports : la requête
// libre ne lui ouvre rien de plus, mais elle doit rester une lecture.
var (
	motsInterdits    = regexp.MustCompile(`(?i)\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|call|do|merge|refresh|reindex|listen|notify|lock|set|reset|begin|commit|rollback|pg_read_file|pg_read_binary_file|pg_ls_dir|dblink|pg_sleep|lo_import|lo_export)\b`)
	debutAutorise    = regexp.MustCompile(`(?is)^\s*(select|with)\b`)
	tablesInterdites = regexp.MustCompile(`(?i)"?(refresh_tokens|support_signalement_images)"?`)
)

type requeteLibre struct {
	SQL   string `json:"sql"`
	Refus string `json:"refus"`
}

func sqlRefusee(sql string) error {
	if strings.Contains(strings.TrimSuffix(strings.TrimSpace(sql), ";"), ";") {
		return errors.New("une seule requête à la fois")
	}
	if !debutAutorise.MatchString(sql) {
		return errors.New("seules les lectures SELECT sont exécutées")
	}
	if mot := motsInterdits.FindString(sql); mot != "" {
		return fmt.Errorf("mot interdit dans une lecture : %s", mot)
	}
	if table := tablesInterdites.FindString(sql); table != "" {
		return fmt.Errorf("table hors de portée : %s", table)
	}
	return nil
}

// La transaction est déclarée en lecture seule et bornée dans le temps : même
// une requête acceptée par le filtre ne peut ni écrire ni occuper la base.
func lireEnLectureSeule(ctx context.Context, pool *pgxpool.Pool, sql string) (Tableau, error) {
	tableau := Tableau{Colonnes: []string{}, Lignes: [][]string{}}
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly, IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return tableau, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL statement_timeout = %d", delaiRequeteMax.Milliseconds())); err != nil {
		return tableau, err
	}
	rows, err := tx.Query(ctx, fmt.Sprintf("SELECT * FROM (%s) AS reponse LIMIT %d", sql, lignesMax))
	if err != nil {
		return tableau, err
	}
	defer rows.Close()
	for _, champ := range rows.FieldDescriptions() {
		tableau.Colonnes = append(tableau.Colonnes, champ.Name)
	}
	for rows.Next() {
		valeurs, err := rows.Values()
		if err != nil {
			return tableau, err
		}
		ligne := make([]string, 0, len(valeurs))
		for _, valeur := range valeurs {
			ligne = append(ligne, cellule(valeur))
		}
		tableau.Lignes = append(tableau.Lignes, ligne)
	}
	return tableau, rows.Err()
}

// `rows.Values` rend les montants et les dates en types pgtype : sans leur
// `Value`, une colonne numeric s'affiche « {67 6 false finite true} ».
func cellule(valeur any) string {
	switch v := valeur.(type) {
	case nil:
		return ""
	case time.Time:
		return v.Format("2006-01-02 15:04")
	case string:
		return v
	case []byte:
		return string(v)
	case driver.Valuer:
		brut, err := v.Value()
		if err != nil || brut == nil {
			return ""
		}
		return cellule(brut)
	default:
		return fmt.Sprint(v)
	}
}

// Le schéma se relit à chaque démarrage seulement : il ne bouge qu'avec une migration.
func (s *service) schema(ctx context.Context) (string, error) {
	s.schemaUneFois.Do(func() {
		rows, err := s.Pool.Query(ctx, `
			SELECT c.table_name, string_agg(c.column_name || ' ' || c.data_type, ', ' ORDER BY c.ordinal_position)
			FROM information_schema.columns c
			JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
			WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
			  AND c.table_name NOT IN ('refresh_tokens', 'goose_db_version', 'support_signalement_images')
			  AND c.column_name <> 'passwordHash'
			GROUP BY c.table_name ORDER BY c.table_name`)
		if err != nil {
			s.schemaErreur = err
			return
		}
		defer rows.Close()
		var lignes []string
		for rows.Next() {
			var table, colonnes string
			if err := rows.Scan(&table, &colonnes); err != nil {
				s.schemaErreur = err
				return
			}
			lignes = append(lignes, table+" ("+colonnes+")")
		}
		if s.schemaErreur = rows.Err(); s.schemaErreur != nil {
			return
		}
		s.schemaLu = strings.Join(lignes, "\n")
		s.liens, s.schemaErreur = s.clesEtrangeres(ctx)
	})
	return s.schemaLu, s.schemaErreur
}

// Sans les clés étrangères, le modèle devine les jointures et rend un nom faux.
func (s *service) clesEtrangeres(ctx context.Context) (string, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT format('%s.%s -> %s.%s', tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name)
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
		JOIN information_schema.constraint_column_usage ccu
		  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
		ORDER BY 1`)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var liens []string
	for rows.Next() {
		var lien string
		if err := rows.Scan(&lien); err != nil {
			return "", err
		}
		liens = append(liens, lien)
	}
	return strings.Join(liens, "\n"), rows.Err()
}

// Une colonne mal citée ou une jointure absente se corrige : l'erreur de
// PostgreSQL retourne au modèle, qui reprend sa requête.
func (s *service) requeteLibre(ctx context.Context, question string, aujourdhui time.Time) (*Reponse, error) {
	schema, err := s.schema(ctx)
	if err != nil {
		return nil, err
	}
	entree := map[string]any{
		champQuestion: question, "aujourdhui": aujourdhui.Format(formatJour),
		"schema": schema, "liens": s.liens,
	}
	var auteur, requete string
	var tableau Tableau
	var refus error
	for essai := range essaisSQL {
		var demande requeteLibre
		auteur, err = demander(ctx, consigneSQL, entree, &demande)
		if err != nil {
			return nil, err
		}
		requete = strings.TrimSpace(demande.SQL)
		if requete == "" {
			return &Reponse{Texte: texteParDefaut(demande.Refus), ReponduPar: auteur}, nil
		}
		if refus = sqlRefusee(requete); refus == nil {
			if tableau, refus = lireEnLectureSeule(ctx, s.Pool, requete); refus == nil {
				break
			}
		}
		slog.Warn("requête de l'assistant reprise", "essai", essai+1, "err", refus)
		entree["echec"] = map[string]string{"sql": requete, "erreur": refus.Error()}
	}
	if refus != nil {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "ASSISTANT_REQUETE_REFUSEE",
			"L'assistant n'a pas réussi à lire cette donnée : "+refus.Error()+".")
	}
	demande := requeteLibre{SQL: requete}
	acteur := socle.UtilisateurCourant(ctx).ID
	if err := database.Auditer(ctx, s.Q, acteur, "assistant.lire", "assistant", acteur,
		map[string]any{champQuestion: question, "requete": demande.SQL, "lignes": len(tableau.Lignes)}, nil); err != nil {
		return nil, err
	}
	return &Reponse{
		Outil: "requete_libre", Requete: demande.SQL, ReponduPar: auteur,
		Resultat: &Resultat{Tableau: tableau, Serie: []Point{}, Mesure: ""},
	}, nil
}
