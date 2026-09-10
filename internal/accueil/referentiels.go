package accueil

import (
	"context"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	codeListeVisiteIntrouvable = "VISITE_REFERENTIEL_NOT_FOUND"
	codeListeVisiteCodePris    = "VISITE_REFERENTIEL_CODE_CONFLICT"
	codeListeVisiteLabelPris   = "VISITE_REFERENTIEL_LABEL_CONFLICT"
	codeListeVisiteSysteme     = "VISITE_REFERENTIEL_SYSTEM_IMMUTABLE"

	colonnesListeVisite = `"id", "code", "label", "isActive", "isSystem", "sortOrder", "updatedAt"`
	cheminListeVisite   = "/api/v1/visites/referentiels/{kind}"
	cheminEntreeVisite  = "/api/v1/visites/referentiels/{kind}/{id}"
)

// Le `kind` de l'URL n'est qu'une clé d'ici : aucun nom de table ne vient du
// client.
var tablesListeVisite = map[string]string{
	listeEntreprises:   "visite_entreprises",
	listeDirections:    "visite_directions",
	listeDestinataires: "visite_destinataires",
	listeObjets:        "visite_objets",
}

var codeListeVisite = regexp.MustCompile(`^[A-Z0-9_]+$`)

func monterListesVisite(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "listVisiteReferentiel", Method: http.MethodGet, Path: cheminListeVisite,
		Summary: "Une des quatre listes de l’accueil.",
	}, s.listerListeVisite)
	huma.Register(api, huma.Operation{
		OperationID: "getVisiteReferentielUsage", Method: http.MethodGet,
		Path: "/api/v1/visites/referentiels/usage", Summary: "Le nombre de visites par entrée.",
	}, s.usageListesVisite)
	huma.Register(api, huma.Operation{
		OperationID: "createVisiteReferentiel", Method: http.MethodPost, Path: cheminListeVisite,
		DefaultStatus: http.StatusCreated, Summary: "Ajoute une entrée à une liste.",
	}, s.creerEntreeVisite)
	huma.Register(api, huma.Operation{
		OperationID: "updateVisiteReferentiel", Method: http.MethodPatch, Path: cheminEntreeVisite,
		Summary: "Renomme ou déplace une entrée.",
	}, s.modifierEntreeVisite)
	huma.Register(api, huma.Operation{
		OperationID: "setVisiteReferentielActive", Method: http.MethodPost,
		Path: cheminEntreeVisite + "/active", DefaultStatus: http.StatusCreated,
		Summary: "Retire une entrée des listes de saisie, ou la remet.",
	}, s.activerEntreeVisite)
	huma.Register(api, huma.Operation{
		OperationID: "reorderVisiteReferentiel", Method: http.MethodPost,
		Path: cheminListeVisite + "/reorder", DefaultStatus: http.StatusCreated,
		Summary: "Réécrit l’ordre d’affichage d’une liste.",
	}, s.reordonnerListeVisite)
}

func tableListeVisite(kind string) (string, error) {
	table, connue := tablesListeVisite[kind]
	if !connue {
		return "", socle.Problem(http.StatusNotFound, "NOT_FOUND", "Liste inconnue.")
	}
	return table, nil
}

func selectionListeVisite(table, suite string) string {
	return `SELECT ` + colonnesListeVisite + ` FROM "` + table + `" ` + suite
}

func (s *service) entreesListeVisite(ctx context.Context, requete string, args ...any) ([]EntreeReferentielVisite, error) {
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entrees := []EntreeReferentielVisite{}
	for rows.Next() {
		var e EntreeReferentielVisite
		var maj time.Time
		if err := rows.Scan(&e.ID, &e.Code, &e.Label, &e.IsActive, &e.IsSystem, &e.SortOrder, &maj); err != nil {
			return nil, err
		}
		e.UpdatedAt = instantRegistre(maj)
		entrees = append(entrees, e)
	}
	return entrees, rows.Err()
}

func (s *service) entreeListeVisite(ctx context.Context, requete string, args ...any) (*EntreeVisiteOutput, error) {
	entrees, err := s.entreesListeVisite(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	if len(entrees) == 0 {
		return nil, socle.Problem(http.StatusNotFound, codeListeVisiteIntrouvable, "Cette entrée n’existe pas dans cette liste.")
	}
	return &EntreeVisiteOutput{Body: entrees[0]}, nil
}

// L'index unique est l'invariant : une relecture préalable ne ferait que
// déplacer la course.
func conflitListeVisite(err error) error {
	var pg *pgconn.PgError
	if !errors.As(err, &pg) || pg.Code != "23505" {
		return err
	}
	code, champ := codeListeVisiteCodePris, "code"
	if strings.HasSuffix(pg.ConstraintName, "_label_key") {
		code, champ = codeListeVisiteLabelPris, "label"
	}
	p := socle.Problem(http.StatusConflict, code, "Cette valeur existe déjà dans cette liste.")
	p.Errors = []*huma.ErrorDetail{{Location: "body." + champ, Message: "Déjà utilisé."}}
	return p
}

func libelleListeVisite(brut string) (string, error) {
	label := strings.TrimSpace(brut)
	if n := utf8.RuneCountInString(label); n < 2 || n > 120 {
		return "", huma.Error422UnprocessableEntity("champ refusé",
			&huma.ErrorDetail{Location: "body.label", Message: "Longueur attendue entre 2 et 120 caractères."})
	}
	return label, nil
}

type ListeVisiteInput struct {
	Kind       string `path:"kind" enum:"entreprises,directions,destinataires,objets"`
	ActiveOnly bool   `query:"activeOnly" default:"true"`
}

type ListeVisiteOutput struct {
	Body struct {
		Items []EntreeReferentielVisite `json:"items"`
	}
}

type EntreeVisiteOutput struct {
	Body EntreeReferentielVisite
}

func (s *service) listeVisiteOrdonnee(ctx context.Context, table string, actifsSeulement bool) (*ListeVisiteOutput, error) {
	entrees, err := s.entreesListeVisite(ctx,
		selectionListeVisite(table, `WHERE NOT $1::boolean OR "isActive" ORDER BY "sortOrder", "label"`), actifsSeulement)
	if err != nil {
		return nil, err
	}
	out := &ListeVisiteOutput{}
	out.Body.Items = entrees
	return out, nil
}

func (s *service) listerListeVisite(ctx context.Context, in *ListeVisiteInput) (*ListeVisiteOutput, error) {
	table, err := tableListeVisite(in.Kind)
	if err != nil {
		return nil, err
	}
	return s.listeVisiteOrdonnee(ctx, table, in.ActiveOnly)
}

type CreationEntreeVisiteInput struct {
	Kind string `path:"kind" enum:"entreprises,directions,destinataires,objets"`
	Body struct {
		Code      string `json:"code" maxLength:"48"`
		Label     string `json:"label" maxLength:"120"`
		SortOrder *int32 `json:"sortOrder,omitempty" minimum:"0" maximum:"9999"`
	}
}

func (s *service) creerEntreeVisite(ctx context.Context, in *CreationEntreeVisiteInput) (*EntreeVisiteOutput, error) {
	table, err := tableListeVisite(in.Kind)
	if err != nil {
		return nil, err
	}
	code := strings.ToUpper(strings.TrimSpace(in.Body.Code))
	if n := utf8.RuneCountInString(code); n < 2 || n > 48 || !codeListeVisite.MatchString(code) {
		return nil, huma.Error422UnprocessableEntity("champ refusé",
			&huma.ErrorDetail{Location: "body.code", Message: "Deux à quarante-huit majuscules, chiffres ou tirets bas."})
	}
	label, err := libelleListeVisite(in.Body.Label)
	if err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	out, err := s.entreeListeVisite(ctx, `INSERT INTO "`+table+
		`" ("id","code","label","sortOrder") VALUES ($1,$2,$3,COALESCE($4::int,100)) RETURNING `+colonnesListeVisite,
		id.String(), code, label, in.Body.SortOrder)
	if err != nil {
		return nil, conflitListeVisite(err)
	}
	return out, nil
}

type ModificationEntreeVisiteInput struct {
	Kind string `path:"kind" enum:"entreprises,directions,destinataires,objets"`
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Label     *string `json:"label,omitempty" maxLength:"120"`
		SortOrder *int32  `json:"sortOrder,omitempty" minimum:"0" maximum:"9999"`
	}
}

func (s *service) modifierEntreeVisite(ctx context.Context, in *ModificationEntreeVisiteInput) (*EntreeVisiteOutput, error) {
	table, err := tableListeVisite(in.Kind)
	if err != nil {
		return nil, err
	}
	var label *string
	if in.Body.Label != nil {
		propre, err := libelleListeVisite(*in.Body.Label)
		if err != nil {
			return nil, err
		}
		label = &propre
	}
	out, err := s.entreeListeVisite(ctx, `UPDATE "`+table+`" SET "label" = COALESCE($2::text,"label"),
		"sortOrder" = COALESCE($3::int,"sortOrder") WHERE "id" = $1 RETURNING `+colonnesListeVisite,
		in.ID, label, in.Body.SortOrder)
	if err != nil {
		return nil, conflitListeVisite(err)
	}
	return out, nil
}

type ActivationEntreeVisiteInput struct {
	Kind string `path:"kind" enum:"entreprises,directions,destinataires,objets"`
	ID   string `path:"id" format:"uuid"`
	Body struct {
		IsActive bool `json:"isActive"`
	}
}

// Une entrée du classeur d'origine sort des listes de saisie par son code, pas
// par l'administration : les visites déjà inscrites la désignent.
func (s *service) activerEntreeVisite(ctx context.Context, in *ActivationEntreeVisiteInput) (*EntreeVisiteOutput, error) {
	table, err := tableListeVisite(in.Kind)
	if err != nil {
		return nil, err
	}
	actuelle, err := s.entreeListeVisite(ctx, selectionListeVisite(table, `WHERE "id" = $1`), in.ID)
	if err != nil {
		return nil, err
	}
	if actuelle.Body.IsSystem && !in.Body.IsActive {
		return nil, socle.Problem(http.StatusBadRequest, codeListeVisiteSysteme,
			"Cette entrée vient du classeur d’origine : elle ne se retire pas des listes.")
	}
	return s.entreeListeVisite(ctx, `UPDATE "`+table+`" SET "isActive" = $2 WHERE "id" = $1 RETURNING `+colonnesListeVisite,
		in.ID, in.Body.IsActive)
}

type ReordonnancementListeVisiteInput struct {
	Kind string `path:"kind" enum:"entreprises,directions,destinataires,objets"`
	Body struct {
		Ids []string `json:"ids" minItems:"1" maxItems:"500"`
	}
}

func (s *service) reordonnerListeVisite(ctx context.Context, in *ReordonnancementListeVisiteInput) (*ListeVisiteOutput, error) {
	table, err := tableListeVisite(in.Kind)
	if err != nil {
		return nil, err
	}
	if _, err := s.Pool.Exec(ctx, `UPDATE "`+table+`" AS t SET "sortOrder" = rang."ordre" * 10
		FROM (SELECT "id", "ordre"::int FROM unnest($1::text[]) WITH ORDINALITY AS u("id","ordre")) AS rang
		WHERE t."id" = rang."id"`, in.Body.Ids); err != nil {
		return nil, err
	}
	return s.listeVisiteOrdonnee(ctx, table, false)
}

type UsageEntreeVisite struct {
	ID     string `json:"id"`
	Nombre int32  `json:"count"`
}

type UsageListesVisiteOutput struct {
	Body struct {
		Entreprises   []UsageEntreeVisite `json:"entreprises"`
		Directions    []UsageEntreeVisite `json:"directions"`
		Destinataires []UsageEntreeVisite `json:"destinataires"`
		Objets        []UsageEntreeVisite `json:"objets"`
	}
}

func (s *service) usageListesVisite(ctx context.Context, _ *struct{}) (*UsageListesVisiteOutput, error) {
	rows, err := s.Q.UsageReferentielsVisite(ctx)
	if err != nil {
		return nil, err
	}
	out := &UsageListesVisiteOutput{}
	cibles := map[string]*[]UsageEntreeVisite{
		listeEntreprises:   &out.Body.Entreprises,
		listeDirections:    &out.Body.Directions,
		listeDestinataires: &out.Body.Destinataires,
		listeObjets:        &out.Body.Objets,
	}
	for _, cible := range cibles {
		*cible = []UsageEntreeVisite{}
	}
	for _, row := range rows {
		cible, connue := cibles[row.Kind]
		if !connue {
			continue
		}
		*cible = append(*cible, UsageEntreeVisite{ID: row.ID, Nombre: row.Total})
	}
	return out, nil
}
