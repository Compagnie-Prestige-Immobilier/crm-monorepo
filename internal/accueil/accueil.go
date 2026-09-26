package accueil

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	referenceMaxRang    = 999999
	referenceTentatives = 5
	statsMaxJours       = 400
	recurrentsLimite    = 10

	listeEntreprises   = "entreprises"
	listeDirections    = "directions"
	listeDestinataires = "destinataires"
	listeObjets        = "objets"

	champDate         = "date"
	champHeure        = "heure"
	champNom          = "nom"
	champTelephone    = "telephone"
	champEntreprise   = "entreprise"
	champDirection    = "direction"
	champDestinataire = "destinataire"
	champObjet        = "objet"
	champCommentaire  = "commentaire"
)

var listesVisiteEcriture = socle.PermissionAccueilListes

var Garde = map[string]socle.Permission{
	"GET /api/v1/visites/referentiels":                     socle.PermissionPanneauAcceder,
	"GET /api/v1/visites/referentiels/{kind}":              socle.PermissionPanneauAcceder,
	"GET /api/v1/visites/referentiels/usage":               listesVisiteEcriture,
	"POST /api/v1/visites/referentiels/{kind}":             listesVisiteEcriture,
	"PATCH /api/v1/visites/referentiels/{kind}/{id}":       listesVisiteEcriture,
	"POST /api/v1/visites/referentiels/{kind}/{id}/active": listesVisiteEcriture,
	"POST /api/v1/visites/referentiels/{kind}/reorder":     listesVisiteEcriture,
	"GET /api/v1/visites/statistiques":                     socle.PermissionAccueilRegistre,
	"GET /api/v1/visites":                                  socle.PermissionAccueilRegistre,
	"POST /api/v1/visites":                                 socle.PermissionAccueilRegistre,
	"GET /api/v1/visites/{id}":                             socle.PermissionAccueilRegistre,
	"PATCH /api/v1/visites/{id}":                           socle.PermissionAccueilRegistre,
	"DELETE /api/v1/visites/{id}":                          socle.PermissionAccueilRegistre,
	"DELETE /api/v1/visites/{id}/definitif":                socle.PermissionVisitesDetruire,
	"POST /api/v1/visites/import":                          socle.PermissionAccueilListes,
	"GET /api/v1/visites/import/{id}":                      socle.PermissionAccueilListes,
	"GET /api/v1/visites/import/{id}/revue":                socle.PermissionAccueilListes,
	"PATCH /api/v1/visites/import/{id}/revue":              socle.PermissionAccueilListes,
	"POST /api/v1/visites/import/{id}/apply":               socle.PermissionAccueilListes,
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	monterArchivageVisites(api, s)
	huma.Register(api, huma.Operation{
		OperationID: "listVisiteReferentiels", Method: http.MethodGet, Path: "/api/v1/visites/referentiels",
		Summary: "Les quatre listes de l’accueil, en un appel.",
	}, s.referentielsVisite)
	huma.Register(api, huma.Operation{
		OperationID: "getVisiteStats", Method: http.MethodGet, Path: "/api/v1/visites/statistiques",
		Summary: "Le registre compté sur une période.",
	}, s.statistiquesVisites)
	huma.Register(api, huma.Operation{
		OperationID: "listVisites", Method: http.MethodGet, Path: "/api/v1/visites",
		Summary: "Le registre, du plus récent au plus ancien.",
	}, s.listerVisites)
	huma.Register(api, huma.Operation{
		OperationID: "createVisite", Method: http.MethodPost, Path: "/api/v1/visites",
		DefaultStatus: http.StatusCreated, Summary: "Inscrit un visiteur au registre.",
	}, s.creerVisite)
	huma.Register(api, huma.Operation{
		OperationID: "getVisite", Method: http.MethodGet, Path: cheminVisite,
		Summary: "Une ligne du registre.",
	}, s.lireVisite)
	huma.Register(api, huma.Operation{
		OperationID: "updateVisite", Method: http.MethodPatch, Path: cheminVisite,
		Summary: "Corrige une ligne du registre.",
	}, s.corrigerVisite)
	monterListesVisite(api, s)
	monterAccueilImport(api, s)
}

type VisiteRef struct {
	ID    string `json:"id"`
	Code  string `json:"code"`
	Label string `json:"label"`
}

type EntreeReferentielVisite struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Label     string `json:"label"`
	IsActive  bool   `json:"isActive"`
	IsSystem  bool   `json:"isSystem"`
	SortOrder int32  `json:"sortOrder"`
	UpdatedAt string `json:"updatedAt"`
}

type Visite struct {
	ID           string     `json:"id"`
	Reference    string     `json:"reference"`
	Date         string     `json:"date"`
	Time         *string    `json:"time"`
	VisitorName  string     `json:"visitorName"`
	Phone        *string    `json:"phone"`
	PhoneE164    *string    `json:"phoneE164"`
	Entreprise   VisiteRef  `json:"entreprise"`
	Objet        VisiteRef  `json:"objet"`
	Direction    *VisiteRef `json:"direction"`
	Destinataire *VisiteRef `json:"destinataire"`
	Comment      *string    `json:"comment"`
	CreatedByID  string     `json:"createdById"`
	CreatedAt    string     `json:"createdAt"`
}

type PageRegistre struct {
	Total     int `json:"total"`
	Page      int `json:"page"`
	PageSize  int `json:"pageSize"`
	PageCount int `json:"pageCount"`
}

type ReferentielsVisiteOutput struct {
	Body struct {
		Entreprises   []EntreeReferentielVisite `json:"entreprises"`
		Directions    []EntreeReferentielVisite `json:"directions"`
		Destinataires []EntreeReferentielVisite `json:"destinataires"`
		Objets        []EntreeReferentielVisite `json:"objets"`
	}
}

type ReferentielsVisiteInput struct {
	ActiveOnly bool `query:"activeOnly" default:"true"`
}

func (s *service) referentielsVisite(ctx context.Context, in *ReferentielsVisiteInput) (*ReferentielsVisiteOutput, error) {
	rows, err := s.Q.ListerReferentielsVisite(ctx, in.ActiveOnly)
	if err != nil {
		return nil, err
	}
	out := &ReferentielsVisiteOutput{}
	out.Body.Entreprises = []EntreeReferentielVisite{}
	out.Body.Directions = []EntreeReferentielVisite{}
	out.Body.Destinataires = []EntreeReferentielVisite{}
	out.Body.Objets = []EntreeReferentielVisite{}
	for _, row := range rows {
		entree := EntreeReferentielVisite{
			ID: row.ID, Code: row.Code, Label: row.Label, IsActive: row.IsActive,
			IsSystem: row.IsSystem, SortOrder: row.SortOrder, UpdatedAt: instantRegistre(row.UpdatedAt),
		}
		switch row.Kind {
		case listeEntreprises:
			out.Body.Entreprises = append(out.Body.Entreprises, entree)
		case listeDirections:
			out.Body.Directions = append(out.Body.Directions, entree)
		case listeDestinataires:
			out.Body.Destinataires = append(out.Body.Destinataires, entree)
		case listeObjets:
			out.Body.Objets = append(out.Body.Objets, entree)
		}
	}
	return out, nil
}

type FiltresVisites struct {
	From           string `query:"from" pattern:"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"`
	To             string `query:"to" pattern:"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"`
	EntrepriseID   string `query:"entrepriseId" format:"uuid"`
	DirectionID    string `query:"directionId" format:"uuid"`
	DestinataireID string `query:"destinataireId" format:"uuid"`
	ObjetID        string `query:"objetId" format:"uuid"`
	Search         string `query:"search" maxLength:"120"`
	Archivees      bool   `query:"archivees"`
	Page           int    `query:"page" minimum:"1" default:"1"`
	PageSize       int    `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
	SortBy         string `query:"sortBy" enum:"visitedAt,visitorName,entreprise,direction,destinataire,objet" default:"visitedAt"`
	SortOrder      string `query:"sortOrder" enum:"asc,desc" default:"desc"`
}

type ListeVisitesOutput struct {
	Body struct {
		Items []Visite     `json:"items"`
		Meta  PageRegistre `json:"meta"`
	}
}

// La référence départage : deux visites de la même minute gardent un ordre stable.
var triVisites = map[string]string{
	"visitedAt":       `v."visitedAt"`,
	"visitorName":     `v."visitorName"`,
	champEntreprise:   `e."label"`,
	champDirection:    `d."label"`,
	champDestinataire: `s."label"`,
	champObjet:        `o."label"`,
}

const colonnesVisite = `v."id", v."reference", v."visitedAt", v."timeKnown", v."visitorName", v."phone", v."phoneE164",
       v."comment", v."createdById", v."createdAt",
       e."id", e."code", e."label", o."id", o."code", o."label",
       d."id", d."code", d."label", s."id", s."code", s."label"`

const jointuresVisite = `FROM "visites" v
JOIN "visite_entreprises" e ON e."id" = v."entrepriseId"
JOIN "visite_objets" o ON o."id" = v."objetId"
LEFT JOIN "visite_directions" d ON d."id" = v."directionId"
LEFT JOIN "visite_destinataires" s ON s."id" = v."destinataireId"`

// Tri sur six colonnes et sept filtres facultatifs : le SQL est assemblé plutôt
// que copié en douze requêtes sqlc (audits/go-donnees.md §10, cas D3).
func (f *FiltresVisites) where() (clause string, args []any) {
	// Seul filtre des visites archivées (registre, statistiques, impression) ; la direction seule
	// demande à voir les archives, pour les détruire.
	etat := `v."deletedAt" IS NULL`
	if f.Archivees {
		etat = `v."deletedAt" IS NOT NULL`
	}
	conditions := []string{etat}
	args = []any{}
	ajouter := func(fragment string, valeur any) {
		args = append(args, valeur)
		conditions = append(conditions, fragment+"$"+strconv.Itoa(len(args)))
	}
	if f.From != "" {
		ajouter(`v."visitedAt" >= `, jourDakar(f.From, "00:00:00.000"))
	}
	if f.To != "" {
		ajouter(`v."visitedAt" <= `, jourDakar(f.To, "23:59:59.999"))
	}
	if f.EntrepriseID != "" {
		ajouter(`v."entrepriseId" = `, f.EntrepriseID)
	}
	if f.DirectionID != "" {
		ajouter(`v."directionId" = `, f.DirectionID)
	}
	if f.DestinataireID != "" {
		ajouter(`v."destinataireId" = `, f.DestinataireID)
	}
	if f.ObjetID != "" {
		ajouter(`v."objetId" = `, f.ObjetID)
	}
	if recherche := strings.TrimSpace(f.Search); recherche != "" {
		args = append(args, "%"+recherche+"%", "%"+strings.ToUpper(recherche)+"%")
		conditions = append(conditions, `(v."visitorName" ILIKE $`+strconv.Itoa(len(args)-1)+
			` OR v."reference" LIKE $`+strconv.Itoa(len(args))+`)`)
	}
	return "WHERE " + strings.Join(conditions, " AND "), args
}

func (s *service) listerVisites(ctx context.Context, in *FiltresVisites) (*ListeVisitesOutput, error) {
	// L'accueil ne voit pas les archives : lui rendre ce qu'il vient de retirer
	// annulerait le geste à ses yeux.
	u := socle.UtilisateurCourant(ctx)
	if in.Archivees && !u.Peut(socle.PermissionVisitesVoirArchivees) {
		return nil, socle.Problem(http.StatusForbidden, "FORBIDDEN",
			"Seule la direction consulte les visites archivées.")
	}
	filtre, args := in.where()
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT count(*)::int `+jointuresVisite+" "+filtre, args...).Scan(&total); err != nil {
		return nil, err
	}

	colonne := triVisites[in.SortBy]
	sens := "DESC"
	if in.SortOrder == "asc" {
		sens = "ASC"
	}
	requete := fmt.Sprintf(`SELECT %s %s %s ORDER BY %s %s, v."reference" DESC LIMIT $%d OFFSET $%d`,
		colonnesVisite, jointuresVisite, filtre, colonne, sens, len(args)+1, len(args)+2)
	rows, err := s.Pool.Query(ctx, requete, append(args, in.PageSize, (in.Page-1)*in.PageSize)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := &ListeVisitesOutput{}
	out.Body.Items = []Visite{}
	for rows.Next() {
		var r db.VisiteParIdRow
		if err := rows.Scan(&r.ID, &r.Reference, &r.VisitedAt, &r.TimeKnown, &r.VisitorName, &r.Phone, &r.PhoneE164,
			&r.Comment, &r.CreatedById, &r.CreatedAt,
			&r.EntrepriseId, &r.EntrepriseCode, &r.EntrepriseLabel, &r.ObjetId, &r.ObjetCode, &r.ObjetLabel,
			&r.DirectionId, &r.DirectionCode, &r.DirectionLabel,
			&r.DestinataireId, &r.DestinataireCode, &r.DestinataireLabel); err != nil {
			return nil, err
		}
		out.Body.Items = append(out.Body.Items, s.versVisite(&r))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out.Body.Meta = PageRegistre{Total: total, Page: in.Page, PageSize: in.PageSize, PageCount: max(1, (total+in.PageSize-1)/in.PageSize)}
	return out, nil
}

type IDVisiteInput struct {
	ID string `path:"id" format:"uuid"`
}

type VisiteOutput struct {
	Body Visite
}

func (s *service) lireVisite(ctx context.Context, in *IDVisiteInput) (*VisiteOutput, error) {
	row, err := s.visite(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &VisiteOutput{Body: s.versVisite(&row)}, nil
}

type CreerVisiteInput struct {
	Body struct {
		Date           string  `json:"date" pattern:"^\\d{4}-\\d{2}-\\d{2}$"`
		Time           *string `json:"time,omitempty" pattern:"^([01]\\d|2[0-3]):[0-5]\\d$"`
		VisitorName    string  `json:"visitorName" minLength:"2" maxLength:"160"`
		Phone          *string `json:"phone,omitempty" maxLength:"40"`
		EntrepriseID   string  `json:"entrepriseId" format:"uuid"`
		ObjetID        string  `json:"objetId" format:"uuid"`
		DirectionID    *string `json:"directionId,omitempty" format:"uuid"`
		DestinataireID *string `json:"destinataireId,omitempty" format:"uuid"`
		Comment        *string `json:"comment,omitempty" maxLength:"2000"`
	}
}

func (s *service) creerVisite(ctx context.Context, in *CreerVisiteInput) (*VisiteOutput, error) {
	corps := in.Body
	if err := s.verifierReferentiels(ctx, &corps.EntrepriseID, &corps.ObjetID, corps.DirectionID, corps.DestinataireID); err != nil {
		return nil, err
	}
	if _, err := jourValide(corps.Date); err != nil {
		return nil, err
	}
	instant, err := s.instantVisite(corps.Date, corps.Time)
	if err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	params := db.InsererVisiteParams{
		ID: id.String(), VisitedAt: instant, TimeKnown: corps.Time != nil,
		VisitorName: strings.TrimSpace(corps.VisitorName),
		Phone:       texteRegistre(corps.Phone), PhoneE164: database.TelephoneOptionnel(corps.Phone, s.Cfg.PhoneRegion),
		EntrepriseId: corps.EntrepriseID, ObjetId: corps.ObjetID,
		DirectionId: corps.DirectionID, DestinataireId: corps.DestinataireID,
		Comment: texteRegistre(corps.Comment), CreatedById: socle.UtilisateurCourant(ctx).ID,
	}

	// Une collision de référence n'arrive qu'entre deux saisies simultanées.
	for range referenceTentatives {
		params.Reference, err = s.prochaineReference(ctx, instant)
		if err != nil {
			return nil, err
		}
		err = s.Q.InsererVisite(ctx, params)
		if err == nil {
			row, err := s.visite(ctx, params.ID)
			if err != nil {
				return nil, err
			}
			return &VisiteOutput{Body: s.versVisite(&row)}, nil
		}
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
			return nil, err
		}
	}
	return nil, socle.Problem(http.StatusBadRequest, "VISITE_REFERENCE_EXHAUSTED", "La référence de visite n’a pas pu être attribuée. Réessayez.")
}

// ABSENT laisse en place, NUL efface : sans la distinction, une heure relevée
// par erreur ou un destinataire faux ne se corrigent jamais.
type CorrigerVisiteInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Time           champFourni `json:"time,omitempty" pattern:"^([01]\\d|2[0-3]):[0-5]\\d$" required:"false"`
		VisitorName    champFourni `json:"visitorName,omitempty" minLength:"2" maxLength:"160" required:"false"`
		Phone          champFourni `json:"phone,omitempty" maxLength:"40" required:"false"`
		EntrepriseID   champFourni `json:"entrepriseId,omitempty" format:"uuid" required:"false"`
		ObjetID        champFourni `json:"objetId,omitempty" format:"uuid" required:"false"`
		DirectionID    champFourni `json:"directionId,omitempty" format:"uuid" required:"false"`
		DestinataireID champFourni `json:"destinataireId,omitempty" format:"uuid" required:"false"`
		Comment        champFourni `json:"comment,omitempty" maxLength:"2000" required:"false"`
	}
}

type champFourni struct {
	fourni bool
	valeur *string
}

func (c *champFourni) UnmarshalJSON(brut []byte) error {
	c.fourni = true
	if string(brut) == "null" {
		return nil
	}
	return json.Unmarshal(brut, &c.valeur)
}

func (champFourni) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Nullable: true}
}

func (c champFourni) ou(actuel *string) *string {
	if !c.fourni {
		return actuel
	}
	return texteRegistre(c.valeur)
}

func (c champFourni) poserTexte(cible *string) {
	if valeur := c.ou(nil); c.fourni && valeur != nil {
		*cible = *valeur
	}
}

func (c champFourni) poserOption(cible **string) {
	if c.fourni {
		*cible = c.valeur
	}
}

func (s *service) corrigerVisite(ctx context.Context, in *CorrigerVisiteInput) (*VisiteOutput, error) {
	existante, err := s.visite(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	corps := in.Body
	if err := s.verifierReferentiels(ctx, corps.EntrepriseID.valeur, corps.ObjetID.valeur, corps.DirectionID.valeur, corps.DestinataireID.valeur); err != nil {
		return nil, err
	}

	params := db.MettreAJourVisiteParams{
		ID: in.ID, VisitedAt: existante.VisitedAt, TimeKnown: existante.TimeKnown,
		VisitorName: existante.VisitorName, Phone: existante.Phone, PhoneE164: existante.PhoneE164,
		EntrepriseId: existante.EntrepriseId, ObjetId: existante.ObjetId,
		DirectionId: existante.DirectionId, DestinataireId: existante.DestinataireId,
		Comment: existante.Comment,
	}
	avant := params
	params.Comment = corps.Comment.ou(existante.Comment)
	if corps.Time.fourni {
		params.TimeKnown = corps.Time.valeur != nil
		if params.VisitedAt, err = s.instantVisite(s.jourDe(existante.VisitedAt), corps.Time.valeur); err != nil {
			return nil, err
		}
	}
	if corps.Phone.fourni {
		params.Phone = texteRegistre(corps.Phone.valeur)
		params.PhoneE164 = database.TelephoneOptionnel(params.Phone, s.Cfg.PhoneRegion)
	}
	corps.VisitorName.poserTexte(&params.VisitorName)
	corps.EntrepriseID.poserTexte(&params.EntrepriseId)
	corps.ObjetID.poserTexte(&params.ObjetId)
	corps.DirectionID.poserOption(&params.DirectionId)
	corps.DestinataireID.poserOption(&params.DestinataireId)

	// Même transaction : une ligne du registre ne se corrige pas sans trace, et
	// une trace ne se pose pas sur une correction annulée.
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.MettreAJourVisite(ctx, params); err != nil {
			return err
		}
		return database.Auditer(ctx, q, socle.UtilisateurCourant(ctx).ID, "visite.correction", "visite", in.ID,
			champsVisiteJournal(&avant), champsVisiteJournal(&params))
	}); err != nil {
		return nil, err
	}
	row, err := s.visite(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &VisiteOutput{Body: s.versVisite(&row)}, nil
}

func champsVisiteJournal(p *db.MettreAJourVisiteParams) map[string]any {
	return map[string]any{
		"visitedAt": p.VisitedAt, "timeKnown": p.TimeKnown, "visitorName": p.VisitorName,
		"phone": p.Phone, "entrepriseId": p.EntrepriseId, "objetId": p.ObjetId,
		"directionId": p.DirectionId, "destinataireId": p.DestinataireId, "comment": p.Comment,
	}
}

func (s *service) visite(ctx context.Context, id string) (db.VisiteParIdRow, error) {
	row, err := s.Q.VisiteParId(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return row, socle.Problem(http.StatusNotFound, "VISITE_NOT_FOUND", "Visite introuvable.")
	}
	return row, err
}

// L'accueil ne doit pas pouvoir ranger une visite sous une entrée retirée des
// listes : le référentiel se désactive précisément pour cesser d'être proposé.
func (s *service) verifierReferentiels(ctx context.Context, entreprise, objet, direction, destinataire *string) error {
	if entreprise == nil && objet == nil && direction == nil && destinataire == nil {
		return nil
	}
	rows, err := s.Q.ReferentielsVisiteChoisis(ctx, db.ReferentielsVisiteChoisisParams{
		EntrepriseID: entreprise, ObjetID: objet, DirectionID: direction, DestinataireID: destinataire,
	})
	if err != nil {
		return err
	}
	actifs := map[string]bool{}
	for _, row := range rows {
		actifs[row.Kind] = row.IsActive
	}
	for _, choix := range []struct {
		kind, libelle string
		id            *string
	}{
		{champEntreprise, champEntreprise, entreprise},
		{champObjet, "objet de visite", objet},
		{champDirection, champDirection, direction},
		{champDestinataire, champDestinataire, destinataire},
	} {
		if choix.id == nil || actifs[choix.kind] {
			continue
		}
		return socle.Problem(http.StatusBadRequest, "VISITE_REFERENTIEL_UNAVAILABLE",
			"L’entrée choisie pour « "+choix.libelle+" » n’est plus proposée à l’accueil.")
	}
	return nil
}

func (s *service) prochaineReference(ctx context.Context, instant time.Time) (string, error) {
	annee := instant.In(s.Cfg.TimeZone).Year()
	prefixe := "V-" + strconv.Itoa(annee) + "-"
	derniere, err := s.Q.DerniereReferenceVisite(ctx, prefixe)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	rang := 1
	if strings.HasPrefix(derniere, prefixe) && len(derniere) == len(prefixe)+6 {
		if n, convErr := strconv.Atoi(derniere[len(prefixe):]); convErr == nil {
			rang = n + 1
		}
	}
	if rang > referenceMaxRang {
		return "", socle.Problem(http.StatusBadRequest, "VISITE_REFERENCE_EXHAUSTED", "La référence de visite n’a pas pu être attribuée. Réessayez.")
	}
	return fmt.Sprintf("%s%06d", prefixe, rang), nil
}

func (s *service) versVisite(r *db.VisiteParIdRow) Visite {
	mural := r.VisitedAt.In(s.Cfg.TimeZone)
	v := Visite{
		ID: r.ID, Reference: r.Reference, Date: mural.Format("2006-01-02"),
		VisitorName: r.VisitorName, Phone: r.Phone, PhoneE164: r.PhoneE164,
		Entreprise: VisiteRef{ID: r.EntrepriseId, Code: r.EntrepriseCode, Label: r.EntrepriseLabel},
		Objet:      VisiteRef{ID: r.ObjetId, Code: r.ObjetCode, Label: r.ObjetLabel},
		Comment:    r.Comment, CreatedByID: r.CreatedById, CreatedAt: instantRegistre(r.CreatedAt),
	}
	if r.TimeKnown {
		heure := mural.Format("15:04")
		v.Time = &heure
	}
	if r.DirectionId != nil {
		v.Direction = &VisiteRef{ID: *r.DirectionId, Code: derefTexte(r.DirectionCode), Label: derefTexte(r.DirectionLabel)}
	}
	if r.DestinataireId != nil {
		v.Destinataire = &VisiteRef{ID: *r.DestinataireId, Code: derefTexte(r.DestinataireCode), Label: derefTexte(r.DestinataireLabel)}
	}
	return v
}

// Africa/Dakar ne change pas d'heure : l'offset tient sur toute la journée.
func (s *service) instantVisite(jour string, heure *string) (time.Time, error) {
	hhmm := "00:00"
	if heure != nil {
		hhmm = *heure
	}
	instant, err := time.ParseInLocation("2006-01-02 15:04", jour+" "+hhmm, s.Cfg.TimeZone)
	if err != nil {
		return time.Time{}, huma.Error422UnprocessableEntity("date ou heure invalide",
			&huma.ErrorDetail{Location: "body.time", Message: "« " + jour + " " + hhmm + " » n’est pas un instant valide."})
	}
	return instant, nil
}

func (s *service) jourDe(instant time.Time) string {
	return instant.In(s.Cfg.TimeZone).Format("2006-01-02")
}

func jourDakar(jour, borne string) time.Time {
	instant, err := time.Parse("2006-01-02 15:04:05.000", jour+" "+borne)
	if err != nil {
		return time.Time{}
	}
	return instant
}

func jourValide(jour string) (time.Time, error) {
	instant, err := time.Parse("2006-01-02", jour)
	if err != nil {
		return instant, huma.Error422UnprocessableEntity("date invalide", &huma.ErrorDetail{Location: "body.date", Message: "Cette date n’existe pas."})
	}
	return instant, nil
}

func instantRegistre(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func texteRegistre(brut *string) *string {
	if brut == nil {
		return nil
	}
	coupe := strings.TrimSpace(*brut)
	if coupe == "" {
		return nil
	}
	return &coupe
}

func derefTexte(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

var deplierAccents = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

func sansAccents(valeur string) string {
	sortie, _, err := transform.String(deplierAccents, valeur)
	if err != nil {
		return valeur
	}
	return sortie
}

// Le classeur écrit « SAINT-LOUIS », « Saint Louis » et « saint  louis » pour
// la même entrée : les trois doivent tomber sur la même clé.
func normaliserCle(valeur string) string {
	sortie := make([]rune, 0, len(valeur))
	for _, r := range strings.ToLower(sansAccents(valeur)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sortie = append(sortie, r)
			continue
		}
		if len(sortie) > 0 && sortie[len(sortie)-1] != ' ' {
			sortie = append(sortie, ' ')
		}
	}
	return strings.TrimSpace(string(sortie))
}

func normaliserNomVisiteur(nom string) string {
	return strings.Join(strings.Fields(strings.ToUpper(sansAccents(nom))), " ")
}

type StatsVisitesInput struct {
	From string `query:"from" pattern:"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" required:"true"`
	To   string `query:"to" pattern:"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" required:"true"`
}

type StatBucket struct {
	ID    string `json:"id"`
	Code  string `json:"code"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

type StatMois struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type StatJour struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type StatHeure struct {
	Hour  int `json:"hour"`
	Count int `json:"count"`
}

type StatJourSem struct {
	Weekday int `json:"weekday"`
	Count   int `json:"count"`
}

type StatHeureSem struct {
	Weekday int `json:"weekday"`
	Hour    int `json:"hour"`
	Count   int `json:"count"`
}

type StatAgent struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

type StatCroisement struct {
	LigneID   string `json:"ligneId"`
	ColonneID string `json:"colonneId"`
	Count     int    `json:"count"`
}

type StatRecurrent struct {
	Nom            string `json:"nom"`
	Visites        int    `json:"visites"`
	DerniereVisite string `json:"derniereVisite"`
}

type StatSaisie struct {
	MemeJour          int      `json:"memeJour"`
	Lendemain         int      `json:"lendemain"`
	PlusTard          int      `json:"plusTard"`
	DelaiMedianHeures *float64 `json:"delaiMedianHeures"`
}

type StatsVisitesOutput struct {
	Body struct {
		From                     string           `json:"from"`
		To                       string           `json:"to"`
		Total                    int              `json:"total"`
		ParEntreprise            []StatBucket     `json:"parEntreprise"`
		ParDirection             []StatBucket     `json:"parDirection"`
		ParDestinataire          []StatBucket     `json:"parDestinataire"`
		ParObjet                 []StatBucket     `json:"parObjet"`
		ParMois                  []StatMois       `json:"parMois"`
		ParJour                  []StatJour       `json:"parJour"`
		SansDirection            int              `json:"sansDirection"`
		SansDestinataire         int              `json:"sansDestinataire"`
		ParHeure                 []StatHeure      `json:"parHeure"`
		SansHeure                int              `json:"sansHeure"`
		ParJourSemaine           []StatJourSem    `json:"parJourSemaine"`
		ParHeureJourSemaine      []StatHeureSem   `json:"parHeureJourSemaine"`
		ParAgent                 []StatAgent      `json:"parAgent"`
		ParEntrepriseObjet       []StatCroisement `json:"parEntrepriseObjet"`
		ParDestinataireDirection []StatCroisement `json:"parDestinataireDirection"`
		ParObjetMois             []StatCroisement `json:"parObjetMois"`
		Recurrents               []StatRecurrent  `json:"recurrents"`
		PartRecurrents           float64          `json:"partRecurrents"`
		AvecTelephone            int              `json:"avecTelephone"`
		SaisieDifferee           StatSaisie       `json:"saisieDifferee"`
	}
}

// Le classeur va du mois à l'année ; les vingt tuiles se calculent sur les
// lignes de la période, comme la v1, plutôt qu'en vingt agrégats SQL.
func periodeStats(du, au string) (debut, fin time.Time, err error) {
	if debut, err = jourValide(du); err != nil {
		return debut, fin, err
	}
	if fin, err = jourValide(au); err != nil {
		return debut, fin, err
	}
	if fin.Before(debut) {
		return debut, fin, socle.Problem(http.StatusBadRequest, "VISITE_STATS_RANGE_INVALID", "La date de fin précède la date de début.")
	}
	if fin.Sub(debut) > statsMaxJours*24*time.Hour {
		return debut, fin, socle.Problem(http.StatusBadRequest, "VISITE_STATS_RANGE_TOO_WIDE",
			"La période ne peut pas dépasser "+strconv.Itoa(statsMaxJours)+" jours.")
	}
	return debut, fin, nil
}

// Le classeur va du mois à l'année ; les vingt tuiles se calculent sur les
// lignes de la période, comme la v1, plutôt qu'en vingt agrégats SQL.
func (s *service) statistiquesVisites(ctx context.Context, in *StatsVisitesInput) (*StatsVisitesOutput, error) {
	debut, fin, err := periodeStats(in.From, in.To)
	if err != nil {
		return nil, err
	}

	rows, err := s.Q.VisitesPourStatistiques(ctx, db.VisitesPourStatistiquesParams{
		VisitedAt:   jourDakar(in.From, "00:00:00.000"),
		VisitedAt_2: jourDakar(in.To, "23:59:59.999"),
	})
	if err != nil {
		return nil, err
	}
	entrees, err := s.Q.ListerReferentielsVisite(ctx, false)
	if err != nil {
		return nil, err
	}
	agents, err := s.nomsDesAgents(ctx, rows)
	if err != nil {
		return nil, err
	}

	out := &StatsVisitesOutput{}
	b := &out.Body
	b.From, b.To, b.Total = in.From, in.To, len(rows)
	b.ParEntreprise = bucketsVisite(entrees, listeEntreprises, compter(rows, func(r *db.VisitesPourStatistiquesRow) *string { return &r.EntrepriseId }))
	b.ParDirection = bucketsVisite(entrees, listeDirections, compter(rows, func(r *db.VisitesPourStatistiquesRow) *string { return r.DirectionId }))
	b.ParDestinataire = bucketsVisite(entrees, listeDestinataires, compter(rows, func(r *db.VisitesPourStatistiquesRow) *string { return r.DestinataireId }))
	b.ParObjet = bucketsVisite(entrees, listeObjets, compter(rows, func(r *db.VisitesPourStatistiquesRow) *string { return &r.ObjetId }))
	b.ParMois = s.parMois(rows, debut, fin)
	b.ParJour = s.parJour(rows)
	b.ParHeure = s.parHeure(rows)
	b.ParJourSemaine = s.parJourSemaine(rows)
	b.ParHeureJourSemaine = s.parHeureJourSemaine(rows)
	b.ParAgent = parAgent(rows, agents)
	b.ParEntrepriseObjet = croisement(rows, func(r *db.VisitesPourStatistiquesRow) (*string, *string) { return &r.EntrepriseId, &r.ObjetId })
	b.ParDestinataireDirection = croisement(rows, func(r *db.VisitesPourStatistiquesRow) (*string, *string) { return r.DestinataireId, r.DirectionId })
	b.ParObjetMois = croisement(rows, func(r *db.VisitesPourStatistiquesRow) (*string, *string) {
		mois := r.VisitedAt.In(s.Cfg.TimeZone).Format("2006-01")
		return &r.ObjetId, &mois
	})
	recurrents, visitesRecurrentes := s.recurrents(rows)
	b.Recurrents = recurrents
	if len(rows) > 0 {
		b.PartRecurrents = float64(visitesRecurrentes) / float64(len(rows))
	}
	b.SansDirection, b.SansDestinataire, b.SansHeure, b.AvecTelephone = comptesAbsents(rows)
	b.SaisieDifferee = s.saisieDifferee(rows)
	return out, nil
}

// L'écart entre le total et la somme d'une répartition : direction et
// destinataire sont facultatifs, l'heure n'est pas toujours relevée.
func comptesAbsents(rows []db.VisitesPourStatistiquesRow) (sansDirection, sansDestinataire, sansHeure, avecTelephone int) {
	for index := range rows {
		r := &rows[index]
		if r.DirectionId == nil {
			sansDirection++
		}
		if r.DestinataireId == nil {
			sansDestinataire++
		}
		if !r.TimeKnown {
			sansHeure++
		}
		if r.PhoneE164 != nil {
			avecTelephone++
		}
	}
	return sansDirection, sansDestinataire, sansHeure, avecTelephone
}

func (s *service) nomsDesAgents(ctx context.Context, rows []db.VisitesPourStatistiquesRow) (map[string]string, error) {
	ids := make([]string, 0, len(rows))
	for index := range rows {
		if !slices.Contains(ids, rows[index].CreatedById) {
			ids = append(ids, rows[index].CreatedById)
		}
	}
	noms := map[string]string{}
	if len(ids) == 0 {
		return noms, nil
	}
	agents, err := s.Q.NomsAgentsDuRegistre(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, agent := range agents {
		noms[agent.ID] = agent.FullName
	}
	return noms, nil
}

func compter(rows []db.VisitesPourStatistiquesRow, cle func(*db.VisitesPourStatistiquesRow) *string) map[string]int {
	comptes := map[string]int{}
	for index := range rows {
		if id := cle(&rows[index]); id != nil {
			comptes[*id]++
		}
	}
	return comptes
}

// Toutes les entrées ACTIVES, y compris à zéro, plus celles retirées qui ont
// compté : les taire ferait un total supérieur à la somme de ses parts.
func bucketsVisite(entrees []db.ListerReferentielsVisiteRow, kind string, comptes map[string]int) []StatBucket {
	buckets := []StatBucket{}
	for _, e := range entrees {
		if e.Kind != kind {
			continue
		}
		compte, vue := comptes[e.ID]
		if !e.IsActive && !vue {
			continue
		}
		buckets = append(buckets, StatBucket{ID: e.ID, Code: e.Code, Label: e.Label, Count: compte})
	}
	return buckets
}

// Chaque mois de la période, même vide : un graphique à trous se lit mal.
func (s *service) parMois(rows []db.VisitesPourStatistiquesRow, debut, fin time.Time) []StatMois {
	comptes := compter(rows, func(r *db.VisitesPourStatistiquesRow) *string {
		mois := r.VisitedAt.In(s.Cfg.TimeZone).Format("2006-01")
		return &mois
	})
	sortie := []StatMois{}
	for curseur := debut; !curseur.After(fin); curseur = curseur.AddDate(0, 1, 0) {
		cle := curseur.Format("2006-01")
		sortie = append(sortie, StatMois{Month: cle, Count: comptes[cle]})
		if curseur.Year() == fin.Year() && curseur.Month() == fin.Month() {
			break
		}
	}
	return sortie
}

func (s *service) parJour(rows []db.VisitesPourStatistiquesRow) []StatJour {
	comptes := compter(rows, func(r *db.VisitesPourStatistiquesRow) *string {
		jour := r.VisitedAt.In(s.Cfg.TimeZone).Format("2006-01-02")
		return &jour
	})
	sortie := make([]StatJour, 0, len(comptes))
	for jour, compte := range comptes {
		sortie = append(sortie, StatJour{Date: jour, Count: compte})
	}
	sort.Slice(sortie, func(i, j int) bool { return sortie[i].Date < sortie[j].Date })
	return sortie
}

// `timeKnown: false` stocke minuit : compter ces lignes fabriquerait un pic à 0 h.
func (s *service) parHeure(rows []db.VisitesPourStatistiquesRow) []StatHeure {
	comptes := map[int]int{}
	for index := range rows {
		if rows[index].TimeKnown {
			comptes[rows[index].VisitedAt.In(s.Cfg.TimeZone).Hour()]++
		}
	}
	sortie := make([]StatHeure, 0, 24)
	for heure := range 24 {
		sortie = append(sortie, StatHeure{Hour: heure, Count: comptes[heure]})
	}
	return sortie
}

func jourSemaineISO(t time.Time) int {
	jour := int(t.Weekday())
	if jour == 0 {
		return 7
	}
	return jour
}

func (s *service) parJourSemaine(rows []db.VisitesPourStatistiquesRow) []StatJourSem {
	comptes := map[int]int{}
	for index := range rows {
		comptes[jourSemaineISO(rows[index].VisitedAt.In(s.Cfg.TimeZone))]++
	}
	sortie := make([]StatJourSem, 0, 7)
	for jour := 1; jour <= 7; jour++ {
		sortie = append(sortie, StatJourSem{Weekday: jour, Count: comptes[jour]})
	}
	return sortie
}

func (s *service) parHeureJourSemaine(rows []db.VisitesPourStatistiquesRow) []StatHeureSem {
	comptes := map[[2]int]int{}
	for index := range rows {
		r := &rows[index]
		if !r.TimeKnown {
			continue
		}
		mural := r.VisitedAt.In(s.Cfg.TimeZone)
		comptes[[2]int{jourSemaineISO(mural), mural.Hour()}]++
	}
	sortie := make([]StatHeureSem, 0, len(comptes))
	for cle, compte := range comptes {
		sortie = append(sortie, StatHeureSem{Weekday: cle[0], Hour: cle[1], Count: compte})
	}
	sort.Slice(sortie, func(i, j int) bool {
		if sortie[i].Weekday != sortie[j].Weekday {
			return sortie[i].Weekday < sortie[j].Weekday
		}
		return sortie[i].Hour < sortie[j].Hour
	})
	return sortie
}

func parAgent(rows []db.VisitesPourStatistiquesRow, noms map[string]string) []StatAgent {
	comptes := compter(rows, func(r *db.VisitesPourStatistiquesRow) *string { return &r.CreatedById })
	sortie := make([]StatAgent, 0, len(comptes))
	for id, compte := range comptes {
		label := noms[id]
		if label == "" {
			label = "?"
		}
		sortie = append(sortie, StatAgent{ID: id, Label: label, Count: compte})
	}
	sort.Slice(sortie, func(i, j int) bool { return sortie[i].Count > sortie[j].Count })
	return sortie
}

func croisement(rows []db.VisitesPourStatistiquesRow, cles func(*db.VisitesPourStatistiquesRow) (*string, *string)) []StatCroisement {
	comptes := map[[2]string]int{}
	ordre := [][2]string{}
	for index := range rows {
		ligne, colonne := cles(&rows[index])
		if ligne == nil || colonne == nil {
			continue
		}
		cle := [2]string{*ligne, *colonne}
		if _, vue := comptes[cle]; !vue {
			ordre = append(ordre, cle)
		}
		comptes[cle]++
	}
	sortie := make([]StatCroisement, 0, len(ordre))
	for _, cle := range ordre {
		sortie = append(sortie, StatCroisement{LigneID: cle[0], ColonneID: cle[1], Count: comptes[cle]})
	}
	return sortie
}

// Regroupe par téléphone quand il existe, sinon par nom normalisé : le seul
// lien fiable sans exposer le numéro.
func (s *service) recurrents(rows []db.VisitesPourStatistiquesRow) (entrees []StatRecurrent, visites int) {
	groupes := map[string][]*db.VisitesPourStatistiquesRow{}
	ordre := []string{}
	for index := range rows {
		r := &rows[index]
		cle := "nom:" + normaliserNomVisiteur(r.VisitorName)
		if r.PhoneE164 != nil {
			cle = *r.PhoneE164
		}
		if _, vu := groupes[cle]; !vu {
			ordre = append(ordre, cle)
		}
		groupes[cle] = append(groupes[cle], r)
	}
	sortie := []StatRecurrent{}
	for _, cle := range ordre {
		groupe := groupes[cle]
		if len(groupe) < 2 {
			continue
		}
		visites += len(groupe)
		recente := groupe[0]
		for _, r := range groupe {
			if r.VisitedAt.After(recente.VisitedAt) {
				recente = r
			}
		}
		sortie = append(sortie, StatRecurrent{
			Nom: recente.VisitorName, Visites: len(groupe),
			DerniereVisite: recente.VisitedAt.In(s.Cfg.TimeZone).Format("2006-01-02"),
		})
	}
	sort.SliceStable(sortie, func(i, j int) bool { return sortie[i].Visites > sortie[j].Visites })
	if len(sortie) > recurrentsLimite {
		sortie = sortie[:recurrentsLimite]
	}
	return sortie, visites
}

func (s *service) saisieDifferee(rows []db.VisitesPourStatistiquesRow) StatSaisie {
	saisie := StatSaisie{}
	delais := make([]float64, 0, len(rows))
	for index := range rows {
		r := &rows[index]
		jourVisite, _ := time.Parse("2006-01-02", s.jourDe(r.VisitedAt))
		jourSaisie, _ := time.Parse("2006-01-02", s.jourDe(r.CreatedAt))
		switch ecart := int(math.Round(jourSaisie.Sub(jourVisite).Hours() / 24)); {
		case ecart <= 0:
			saisie.MemeJour++
		case ecart == 1:
			saisie.Lendemain++
		default:
			saisie.PlusTard++
		}
		delais = append(delais, r.CreatedAt.Sub(r.VisitedAt).Hours())
	}
	if len(delais) == 0 {
		return saisie
	}
	sort.Float64s(delais)
	milieu := len(delais) / 2
	mediane := delais[milieu]
	if len(delais)%2 == 0 {
		mediane = (delais[milieu-1] + delais[milieu]) / 2
	}
	saisie.DelaiMedianHeures = &mediane
	return saisie
}
