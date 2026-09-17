package referentiels

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/representants"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	referentielsSujet             = "referentiels"
	referentielsIntrouvable       = "REFERENTIEL_NOT_FOUND"
	referentielsConflitUnique     = "UNIQUE_CONSTRAINT_VIOLATION"
	referentielsVisiteIntrouvable = "VISITE_REFERENTIEL_NOT_FOUND"
	referentielsVisiteCodePris    = "VISITE_REFERENTIEL_CODE_CONFLICT"
	referentielsVisiteLabelPris   = "VISITE_REFERENTIEL_LABEL_CONFLICT"
	referentielsVisiteSysteme     = "VISITE_REFERENTIEL_SYSTEM_IMMUTABLE"

	referentielsNomCode    = "code"
	referentielsNomLabel   = "label"
	referentielsNomActif   = "isActive"
	referentielsNomSysteme = "isSystem"

	referentielsNomEffet       = "effect"
	referentielsNomRappel      = "requiresCallback"
	referentielsNomCommentaire = "requiresComment"
	referentielsNomReessai     = "retryAfterMinutes"
	referentielsNomPriorite    = "priorite"
	referentielsNomRelation    = "relationStatus"
	referentielsNomRang        = "sortOrder"
	referentielsNomParent      = "parentId"
	referentielsNomCouleur     = "color"
	referentielsNomJoint       = "countsAsReached"

	referentielsActionCreer    = "referentiel.create"
	referentielsActionModifier = "referentiel.update"
	referentielsActionActiver  = "referentiel.active"

	referentielsFamilleStatuts = "statuts-qualification"
	referentielsFamilleMotifs  = "call-outcome-reasons"

	referentielsSelCode      = `t."code"`
	referentielsSelName      = `t."name"`
	referentielsSelLabel     = `t."label"`
	referentielsTriPosition  = `t."position", t."label"`
	referentielsTriSortLabel = `t."sortOrder", t."label"`
	referentielsTriSortNom   = `t."sortOrder", t."name"`
)

type ReferentielsItem struct {
	ID              string     `json:"id"`
	Code            *string    `json:"code"`
	Name            *string    `json:"name"`
	Label           *string    `json:"label"`
	ShortName       *string    `json:"shortName"`
	Sigle           *string    `json:"sigle"`
	Secteur         *string    `json:"secteur"`
	Type            *string    `json:"type"`
	Indicatif       *string    `json:"indicatif"`
	Description     *string    `json:"description"`
	IsTeaching      *bool      `json:"isTeaching"`
	MinXof          *int32     `json:"minXof"`
	MaxXof          *int32     `json:"maxXof"`
	Position        *int32     `json:"position"`
	SortOrder       *int32     `json:"sortOrder"`
	RegionID        *string    `json:"regionId"`
	RegionName      *string    `json:"regionName"`
	DepartementID   *string    `json:"departementId"`
	DepartementName *string    `json:"departementName"`
	IsActive        *bool      `json:"isActive"`
	IsSystem        *bool      `json:"isSystem"`
	UpdatedAt       *time.Time `json:"updatedAt"`
}

type ReferentielsEntree struct {
	Code        *string `json:"code,omitempty" maxLength:"64"`
	Name        *string `json:"name,omitempty" maxLength:"200"`
	Label       *string `json:"label,omitempty" maxLength:"200"`
	ShortName   *string `json:"shortName,omitempty" maxLength:"32"`
	Sigle       *string `json:"sigle,omitempty" maxLength:"32"`
	Secteur     *string `json:"secteur,omitempty" maxLength:"120"`
	Type        *string `json:"type,omitempty" enum:"MINISTERE,ENTREPRISE,AUTRE"`
	Description *string `json:"description,omitempty" maxLength:"500"`
	IsTeaching  *bool   `json:"isTeaching,omitempty"`
	MinXof      *int32  `json:"minXof,omitempty" minimum:"0"`
	MaxXof      *int32  `json:"maxXof,omitempty" minimum:"0"`
	Position    *int32  `json:"position,omitempty" minimum:"0" maximum:"9999"`
	SortOrder   *int32  `json:"sortOrder,omitempty" minimum:"0" maximum:"9999"`
	RegionID    *string `json:"regionId,omitempty" format:"uuid"`
	IsActive    *bool   `json:"isActive,omitempty"`
}

// Le nom JSON est aussi le nom de colonne pour tout champ écrivable ; `sel`
// porte l'expression de lecture, seule à différer sur les colonnes jointes.
type referentielsChamp struct {
	nom        string
	sel        string
	vers       func(*ReferentielsItem) any
	lit        func(*ReferentielsEntree) any
	motif      *regexp.Regexp
	min        int16
	max        int16
	haut       bool
	fige       bool
	requis     bool
	videEstNul bool
}

type referentielsListe struct {
	table        string
	jointure     string
	champs       []referentielsChamp
	rang         string
	filtre       string
	lecture      socle.Permission
	ecriture     socle.Permission
	conflitCode  string
	conflitLabel string
	introuvable  string
}

func referentielsValeur[T any](p *T) any {
	if p == nil {
		return nil
	}
	return *p
}

func referentielsRegle(c referentielsChamp, basse, haute int16, requis bool) referentielsChamp {
	c.min, c.max, c.requis = basse, haute, requis
	return c
}

// Carte figée des seize listes : `kind` ne désigne jamais une table ni une
// colonne venue de l'URL, seulement une entrée d'ici. La table porte le nom du
// kind, tirets bas compris.
func referentielsConstruire() (map[string]*referentielsListe, []referentielsChamp) {
	codeMajuscule := regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
	codeVisite := regexp.MustCompile(`^[A-Z0-9_]+$`)
	codeDept := regexp.MustCompile(`^[A-Z0-9_-]+$`)

	cCode := referentielsChamp{
		nom: referentielsNomCode, sel: referentielsSelCode, motif: codeMajuscule,
		vers: func(i *ReferentielsItem) any { return &i.Code },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Code) },
	}
	cCodeVisite := cCode
	cCodeVisite.motif, cCodeVisite.haut, cCodeVisite.fige = codeVisite, true, true
	cCodeCanal := cCode
	cCodeCanal.motif, cCodeCanal.fige = nil, true
	cCodeDept := cCode
	cCodeDept.motif = codeDept
	cCodeLu := cCode
	cCodeLu.motif, cCodeLu.lit = nil, nil

	cName := referentielsChamp{
		nom: "name", sel: referentielsSelName,
		vers: func(i *ReferentielsItem) any { return &i.Name },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Name) },
	}
	cNameLu := cName
	cNameLu.lit = nil

	cLabel := referentielsChamp{
		nom: referentielsNomLabel, sel: referentielsSelLabel,
		vers: func(i *ReferentielsItem) any { return &i.Label },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Label) },
	}
	cLabelLu := cLabel
	cLabelLu.lit = nil

	cShortName := referentielsChamp{
		nom: "shortName", sel: `t."shortName"`,
		vers: func(i *ReferentielsItem) any { return &i.ShortName },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.ShortName) },
	}
	cSigle := referentielsChamp{
		nom: "sigle", sel: `t."sigle"`,
		vers: func(i *ReferentielsItem) any { return &i.Sigle },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Sigle) },
	}
	// La chaîne vide EFFACE le secteur : l'écran rend « aucun » sur null, pas sur "".
	cSecteur := referentielsChamp{
		nom: "secteur", sel: `t."secteur"`, videEstNul: true,
		vers: func(i *ReferentielsItem) any { return &i.Secteur },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Secteur) },
	}
	cType := referentielsChamp{
		nom: "type", sel: `t."type"::text`,
		vers: func(i *ReferentielsItem) any { return &i.Type },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Type) },
	}
	cIndicatif := referentielsChamp{
		nom: "indicatif", sel: `t."indicatif"`,
		vers: func(i *ReferentielsItem) any { return &i.Indicatif },
	}
	cDescription := referentielsChamp{
		nom: "description", sel: `t."description"`,
		vers: func(i *ReferentielsItem) any { return &i.Description },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Description) },
	}
	cIsTeaching := referentielsChamp{
		nom: "isTeaching", sel: `t."isTeaching"`,
		vers: func(i *ReferentielsItem) any { return &i.IsTeaching },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.IsTeaching) },
	}
	cMinXof := referentielsChamp{
		nom: "minXof", sel: `t."minXof"`,
		vers: func(i *ReferentielsItem) any { return &i.MinXof },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.MinXof) },
	}
	cMaxXof := referentielsChamp{
		nom: "maxXof", sel: `t."maxXof"`,
		vers: func(i *ReferentielsItem) any { return &i.MaxXof },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.MaxXof) },
	}
	cPosition := referentielsChamp{
		nom: "position", sel: `t."position"`,
		vers: func(i *ReferentielsItem) any { return &i.Position },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.Position) },
	}
	cSortOrder := referentielsChamp{
		nom: "sortOrder", sel: `t."sortOrder"`,
		vers: func(i *ReferentielsItem) any { return &i.SortOrder },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.SortOrder) },
	}
	cSortOrderLu := cSortOrder
	cSortOrderLu.lit = nil
	cRegionID := referentielsChamp{
		nom: "regionId", sel: `t."regionId"`,
		vers: func(i *ReferentielsItem) any { return &i.RegionID },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.RegionID) },
	}
	cRegionName := referentielsChamp{
		nom: "regionName", sel: `r."name"`,
		vers: func(i *ReferentielsItem) any { return &i.RegionName },
	}
	cDepartementID := referentielsChamp{
		nom: representants.RepresentantChampDep, sel: `t."departementId"`,
		vers: func(i *ReferentielsItem) any { return &i.DepartementID },
	}
	cDepartementName := referentielsChamp{
		nom: "departementName", sel: exports.ColonneDepartementNom,
		vers: func(i *ReferentielsItem) any { return &i.DepartementName },
	}
	cIsActive := referentielsChamp{
		nom: referentielsNomActif, sel: `t."isActive"`,
		vers: func(i *ReferentielsItem) any { return &i.IsActive },
		lit:  func(e *ReferentielsEntree) any { return referentielsValeur(e.IsActive) },
	}
	cIsSystem := referentielsChamp{
		nom: referentielsNomSysteme, sel: `t."isSystem"`,
		vers: func(i *ReferentielsItem) any { return &i.IsSystem },
	}
	cUpdatedAt := referentielsChamp{
		nom: "updatedAt", sel: `t."updatedAt"`,
		vers: func(i *ReferentielsItem) any { return &i.UpdatedAt },
	}

	visite := func() *referentielsListe {
		return &referentielsListe{
			champs: []referentielsChamp{
				referentielsRegle(cCodeVisite, 2, 48, true), referentielsRegle(cLabel, 2, 120, true),
				cIsActive, cIsSystem, cSortOrder, cUpdatedAt,
			},
			rang:         referentielsTriSortLabel,
			lecture:      socle.PermissionPanneauAcceder,
			ecriture:     socle.PermissionAccueilListes,
			conflitCode:  referentielsVisiteCodePris,
			conflitLabel: referentielsVisiteLabelPris,
			introuvable:  referentielsVisiteIntrouvable,
		}
	}

	listes := map[string]*referentielsListe{
		NomBanques: {
			champs: []referentielsChamp{
				referentielsRegle(cName, 2, 160, true), referentielsRegle(cShortName, 2, 32, true),
				cIsActive, cSortOrder, cUpdatedAt,
			},
			rang: referentielsTriSortNom, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		NomSyndicats: {
			champs: []referentielsChamp{
				referentielsRegle(cName, 2, 200, true), referentielsRegle(cSigle, 2, 32, true),
				referentielsRegle(cSecteur, 0, 120, false), cIsActive, cSortOrder, cUpdatedAt,
			},
			rang: referentielsTriSortNom, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		"canaux-provenance": {
			champs: []referentielsChamp{
				referentielsRegle(cCodeCanal, 2, 40, true), referentielsRegle(cLabel, 2, 80, true),
				cPosition, cIsActive, cUpdatedAt,
			},
			rang: referentielsTriPosition, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		NomProfessions: {
			champs: []referentielsChamp{
				referentielsRegle(cCode, 1, 40, true), referentielsRegle(cLabel, 2, 120, true),
				cIsTeaching, cPosition, cIsActive, cUpdatedAt,
			},
			rang: referentielsTriPosition, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		NomEmployeurs: {
			champs: []referentielsChamp{
				referentielsRegle(cCode, 1, 60, true), referentielsRegle(cLabel, 2, 160, true),
				referentielsRegle(cType, 1, 32, true), cPosition, cIsActive, cUpdatedAt,
			},
			rang: referentielsTriPosition, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		NomPays: {
			champs: []referentielsChamp{cCodeLu, cLabelLu, cIndicatif, cPosition, cIsActive, cUpdatedAt},
			rang:   referentielsTriPosition, lecture: socle.PermissionPanneauAcceder,
		},
		NomIncomeBands: {
			champs: []referentielsChamp{
				referentielsRegle(cCode, 1, 40, true), referentielsRegle(cLabel, 2, 80, true),
				cMinXof, cMaxXof, cPosition, cIsActive, cUpdatedAt,
			},
			rang: `t."position", t."minXof"`, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		NomOffers: {
			champs: []referentielsChamp{
				referentielsRegle(cCode, 1, 40, true), referentielsRegle(cLabel, 2, 120, true),
				referentielsRegle(cDescription, 0, 500, false), cPosition, cIsActive, cUpdatedAt,
			},
			rang: referentielsTriPosition, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		"bank-rejection-reasons": {
			champs: []referentielsChamp{cCodeLu, cLabelLu, cSortOrderLu, cIsActive},
			rang:   referentielsTriSortLabel, lecture: socle.PermissionBanqueDossiers,
		},
		"visite-entreprises":   visite(),
		"visite-directions":    visite(),
		"visite-destinataires": visite(),
		"visite-objets":        visite(),
		NomRegions: {
			champs: []referentielsChamp{cCodeLu, cNameLu},
			rang:   referentielsSelName, lecture: socle.PermissionPanneauAcceder,
		},
		NomDepartements: {
			jointure: `JOIN "regions" r ON r."id" = t."regionId"`,
			champs: []referentielsChamp{
				referentielsRegle(cCodeDept, 2, 16, true), referentielsRegle(cName, 2, 120, true),
				referentielsRegle(cRegionID, 1, 64, true), cRegionName, cIsActive, cUpdatedAt,
			},
			rang: referentielsSelName, lecture: socle.PermissionPanneauAcceder, ecriture: socle.PermissionReferentielsSuperviser,
		},
		NomIefs: {
			jointure: `JOIN "departements" d ON d."id" = t."departementId" JOIN "regions" r ON r."id" = d."regionId"`,
			champs: []referentielsChamp{
				cCodeLu, cNameLu, cDepartementID, cDepartementName, cRegionName, cIsActive, cUpdatedAt,
			},
			rang: `d."name", t."name"`, filtre: "departementId", lecture: socle.PermissionPanneauAcceder,
		},
	}
	for kind, l := range listes {
		l.table = strings.ReplaceAll(kind, "-", "_")
	}

	// Tout champ que le corps sait porter : sert à refuser celui qui
	// n'appartient pas au kind visé, comme la liste blanche des DTO v1.
	return listes, []referentielsChamp{
		cCode, cName, cLabel, cShortName, cSigle, cSecteur, cType, cDescription,
		cIsTeaching, cMinXof, cMaxXof, cPosition, cSortOrder, cRegionID, cIsActive,
	}
}

var referentielsListes, referentielsTousChamps = referentielsConstruire()

func (l *referentielsListe) champParNom(nom string) *referentielsChamp {
	for i := range l.champs {
		if l.champs[i].nom == nom {
			return &l.champs[i]
		}
	}
	return nil
}

func (l *referentielsListe) selection(b *strings.Builder) {
	b.WriteString(`SELECT t."id"`)
	for i := range l.champs {
		b.WriteString(", ")
		b.WriteString(l.champs[i].sel)
	}
	b.WriteString(` FROM "`)
	b.WriteString(l.table)
	b.WriteString(`" t `)
	b.WriteString(l.jointure)
}

func (l *referentielsListe) lire(ctx context.Context, pool interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, requete string, args ...any,
) ([]ReferentielsItem, error) {
	rows, err := pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ReferentielsItem{}
	for rows.Next() {
		var it ReferentielsItem
		dest := make([]any, 0, len(l.champs)+1)
		dest = append(dest, &it.ID)
		for i := range l.champs {
			dest = append(dest, l.champs[i].vers(&it))
		}
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func (l *referentielsListe) introuvableErreur() error {
	code := l.introuvable
	if code == "" {
		code = referentielsIntrouvable
	}
	return socle.Problem(http.StatusNotFound, code, "Entrée de référentiel introuvable.")
}

// Une violation d'unicité vaut 409 : l'index est l'invariant, la relecture
// préalable ne ferait que déplacer la course.
func (l *referentielsListe) erreurEcriture(err error) error {
	var pg *pgconn.PgError
	if !errors.As(err, &pg) || pg.Code != "23505" {
		return err
	}
	fautif := strings.TrimSuffix(strings.TrimPrefix(pg.ConstraintName, l.table+"_"), "_key")
	code := l.conflitCode
	if code == "" {
		code = referentielsConflitUnique
	}
	if fautif == referentielsNomLabel && l.conflitLabel != "" {
		code = l.conflitLabel
	}
	p := socle.Problem(http.StatusConflict, code, "Cette valeur existe déjà dans cette liste.")
	p.Errors = []*huma.ErrorDetail{{Location: "body." + fautif, Message: "Déjà utilisé."}}
	return p
}

func referentielsHors(nom, message string) error {
	return huma.Error422UnprocessableEntity("champ refusé", &huma.ErrorDetail{Location: "body." + nom, Message: message})
}

func (l *referentielsListe) refuserChampsEtrangers(e *ReferentielsEntree, creation bool) error {
	for i := range referentielsTousChamps {
		c := &referentielsTousChamps[i]
		if c.lit(e) == nil {
			continue
		}
		propre := l.champParNom(c.nom)
		if propre == nil || propre.lit == nil {
			return referentielsHors(c.nom, "Ce champ n'existe pas dans cette liste.")
		}
		if !creation && propre.fige {
			return referentielsHors(c.nom, "Ce champ ne se modifie pas : les entrées déjà saisies le désignent.")
		}
	}
	return nil
}

func (c *referentielsChamp) normaliser(brut string) (any, error) {
	s := strings.TrimSpace(brut)
	if c.haut {
		s = strings.ToUpper(s)
	}
	if c.videEstNul && s == "" {
		return (*string)(nil), nil
	}
	if n := utf8.RuneCountInString(s); n < int(c.min) || n > int(c.max) {
		return nil, referentielsHors(c.nom, "Longueur attendue entre "+strconv.Itoa(int(c.min))+" et "+strconv.Itoa(int(c.max))+" caractères.")
	}
	if c.motif != nil && !c.motif.MatchString(s) {
		return nil, referentielsHors(c.nom, "Format refusé : "+c.motif.String()+".")
	}
	return s, nil
}

func (l *referentielsListe) valeurs(e *ReferentielsEntree, creation bool) (cols []string, args []any, err error) {
	for i := range l.champs {
		c := &l.champs[i]
		if c.lit == nil {
			continue
		}
		v := c.lit(e)
		if v == nil {
			if creation && c.requis {
				return nil, nil, referentielsHors(c.nom, "Ce champ est obligatoire.")
			}
			continue
		}
		if brut, ok := v.(string); ok {
			if v, err = c.normaliser(brut); err != nil {
				return nil, nil, err
			}
		}
		cols = append(cols, c.nom)
		args = append(args, v)
	}
	return cols, args, nil
}

// Le panneau v1 nomme deux listes en français ; la table, elle, garde son nom.
var referentielsAlias = map[string]string{
	"tranches-revenu": NomIncomeBands,
	"offres":          NomOffers,
}

func referentielsAutorisee(ctx context.Context, kind string, ecriture bool) (*referentielsListe, error) {
	if nom, alias := referentielsAlias[kind]; alias {
		kind = nom
	}
	l, connue := referentielsListes[kind]
	if !connue {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Référentiel inconnu.")
	}
	permission := l.lecture
	if ecriture {
		permission = l.ecriture
	}
	if permission == "" {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Référentiel inconnu.")
	}
	if u := socle.UtilisateurCourant(ctx); !u.Peut(permission) {
		return nil, socle.Problem(http.StatusForbidden, "FORBIDDEN", "Accès refusé.")
	}
	return l, nil
}

type ReferentielsListeInput struct {
	Kind          string `path:"kind"`
	ActiveOnly    bool   `query:"activeOnly" default:"true"`
	DepartementID string `query:"departementId"`
}

type ReferentielsListeOutput struct {
	Body []ReferentielsItem
}

type ReferentielsItemOutput struct {
	Body ReferentielsItem
}

func (s *service) referentielsLister(ctx context.Context, l *referentielsListe, actifsSeulement bool, filtre string) ([]ReferentielsItem, error) {
	var b strings.Builder
	l.selection(&b)
	args := []any{}
	if actifsSeulement && l.champParNom(referentielsNomActif) != nil {
		b.WriteString(` WHERE t."isActive"`)
	} else {
		b.WriteString(" WHERE true")
	}
	if l.filtre != "" && filtre != "" {
		args = append(args, filtre)
		b.WriteString(` AND t."`)
		b.WriteString(l.filtre)
		b.WriteString(`" = $1`)
	}
	b.WriteString(" ORDER BY ")
	b.WriteString(l.rang)
	return l.lire(ctx, s.Pool, b.String(), args...)
}

func (s *service) referentielsItem(ctx context.Context, l *referentielsListe, id string) (*ReferentielsItemOutput, error) {
	var b strings.Builder
	l.selection(&b)
	b.WriteString(` WHERE t."id" = $1`)
	items, err := l.lire(ctx, s.Pool, b.String(), id)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, l.introuvableErreur()
	}
	return &ReferentielsItemOutput{Body: items[0]}, nil
}

func (s *service) referentielsGet(ctx context.Context, in *ReferentielsListeInput) (*ReferentielsListeOutput, error) {
	l, err := referentielsAutorisee(ctx, in.Kind, false)
	if err != nil {
		return nil, err
	}
	items, err := s.referentielsLister(ctx, l, in.ActiveOnly, in.DepartementID)
	if err != nil {
		return nil, err
	}
	return &ReferentielsListeOutput{Body: items}, nil
}

type ReferentielsCreerInput struct {
	Kind string `path:"kind"`
	Body ReferentielsEntree
}

func (s *service) referentielsCreer(ctx context.Context, in *ReferentielsCreerInput) (*ReferentielsItemOutput, error) {
	l, err := referentielsAutorisee(ctx, in.Kind, true)
	if err != nil {
		return nil, err
	}
	if err := l.refuserChampsEtrangers(&in.Body, true); err != nil {
		return nil, err
	}
	cols, args, err := l.valeurs(&in.Body, true)
	if err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	var b strings.Builder
	b.WriteString(`INSERT INTO "`)
	b.WriteString(l.table)
	b.WriteString(`" ("id"`)
	for _, col := range cols {
		b.WriteString(`, "`)
		b.WriteString(col)
		b.WriteString(`"`)
	}
	b.WriteString(") VALUES ($1")
	for i := range cols {
		b.WriteString(", $")
		b.WriteString(strconv.Itoa(i + 2))
	}
	b.WriteString(")")
	auteur := socle.UtilisateurCourant(ctx).ID
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, b.String(), append([]any{id.String()}, args...)...); err != nil {
			return l.erreurEcriture(err)
		}
		return database.Auditer(ctx, s.Q.WithTx(tx), auteur, referentielsActionCreer, in.Kind, id.String(),
			nil, referentielsValeursJournal(cols, args))
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return s.referentielsItem(ctx, l, id.String())
}

type ReferentielsModifierInput struct {
	Kind string `path:"kind"`
	ID   string `path:"id" format:"uuid"`
	Body ReferentielsEntree
}

// Une entrée système sort des listes de saisie par le code, jamais par
// l'administration : les écrans déjà déployés la proposent encore.
func (s *service) referentielsSystemeFige(ctx context.Context, l *referentielsListe, id string, e *ReferentielsEntree) error {
	if e.IsActive == nil || *e.IsActive || l.champParNom(referentielsNomSysteme) == nil {
		return nil
	}
	var systeme bool
	var b strings.Builder
	b.WriteString(`SELECT t."isSystem" FROM "`)
	b.WriteString(l.table)
	b.WriteString(`" t WHERE t."id" = $1`)
	if err := s.Pool.QueryRow(ctx, b.String(), id).Scan(&systeme); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return l.introuvableErreur()
		}
		return err
	}
	if !systeme {
		return nil
	}
	return socle.Problem(http.StatusConflict, referentielsVisiteSysteme,
		"Cette entrée est une entrée système : elle ne se retire pas des listes.")
}

func (s *service) referentielsModifier(ctx context.Context, in *ReferentielsModifierInput) (*ReferentielsItemOutput, error) {
	l, err := referentielsAutorisee(ctx, in.Kind, true)
	if err != nil {
		return nil, err
	}
	if err := l.refuserChampsEtrangers(&in.Body, false); err != nil {
		return nil, err
	}
	if err := s.referentielsSystemeFige(ctx, l, in.ID, &in.Body); err != nil {
		return nil, err
	}
	cols, args, err := l.valeurs(&in.Body, false)
	if err != nil {
		return nil, err
	}
	if len(cols) == 0 {
		return s.referentielsItem(ctx, l, in.ID)
	}
	var b strings.Builder
	b.WriteString(`UPDATE "`)
	b.WriteString(l.table)
	b.WriteString(`" SET `)
	for i, col := range cols {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(`"`)
		b.WriteString(col)
		b.WriteString(`" = $`)
		b.WriteString(strconv.Itoa(i + 1))
	}
	b.WriteString(` WHERE "id" = $`)
	b.WriteString(strconv.Itoa(len(cols) + 1))
	auteur := socle.UtilisateurCourant(ctx).ID
	// Désactiver une entrée change le sens des données pour tout le monde : la
	// trace porte l'état des seules colonnes écrites, avant et après.
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		avant, err := referentielsEtatJournal(ctx, tx, l, in.ID, cols)
		if err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, b.String(), append(args, in.ID)...)
		if err != nil {
			return l.erreurEcriture(err)
		}
		if tag.RowsAffected() == 0 {
			return l.introuvableErreur()
		}
		return database.Auditer(ctx, s.Q.WithTx(tx), auteur, referentielsActionModifier, in.Kind, in.ID,
			avant, referentielsValeursJournal(cols, args))
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return s.referentielsItem(ctx, l, in.ID)
}

type ReferentielsBundleInput struct {
	ActiveOnly bool `query:"activeOnly" default:"true"`
}

type ReferentielsBundleOutput struct {
	Body struct {
		Banques      []ReferentielsItem `json:"banques"`
		Syndicats    []ReferentielsItem `json:"syndicats"`
		Departements []ReferentielsItem `json:"departements"`
		Regions      []ReferentielsItem `json:"regions"`
		Professions  []ReferentielsItem `json:"professions"`
		IncomeBands  []ReferentielsItem `json:"incomeBands"`
		Offers       []ReferentielsItem `json:"offers"`
		Employeurs   []ReferentielsItem `json:"employeurs"`
		Pays         []ReferentielsItem `json:"pays"`
	}
}

// Les neuf listes que les formulaires chargent d'un bloc à l'ouverture.
func (s *service) referentielsBundle(ctx context.Context, in *ReferentielsBundleInput) (*ReferentielsBundleOutput, error) {
	out := &ReferentielsBundleOutput{}
	cibles := []struct {
		kind string
		vers *[]ReferentielsItem
	}{
		{NomBanques, &out.Body.Banques},
		{NomSyndicats, &out.Body.Syndicats},
		{NomDepartements, &out.Body.Departements},
		{NomRegions, &out.Body.Regions},
		{NomProfessions, &out.Body.Professions},
		{NomIncomeBands, &out.Body.IncomeBands},
		{NomOffers, &out.Body.Offers},
		{NomEmployeurs, &out.Body.Employeurs},
		{NomPays, &out.Body.Pays},
	}
	for _, cible := range cibles {
		items, err := s.referentielsLister(ctx, referentielsListes[cible.kind], in.ActiveOnly, "")
		if err != nil {
			return nil, err
		}
		*cible.vers = items
	}
	return out, nil
}

type ReferentielsStatut struct {
	ID                string    `json:"id"`
	Code              string    `json:"code"`
	Label             string    `json:"label"`
	Effect            string    `json:"effect" enum:"REACHED,REFUSED,SCHEDULE_CALLBACK,UNREACHABLE,WRONG_NUMBER"`
	RequiresCallback  bool      `json:"requiresCallback"`
	RequiresComment   bool      `json:"requiresComment"`
	RetryAfterMinutes *int32    `json:"retryAfterMinutes"`
	Priorite          string    `json:"priorite" enum:"HAUTE,NORMALE,BASSE"`
	RelationStatus    *string   `json:"relationStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	ParentID          *string   `json:"parentId"`
	IsActive          bool      `json:"isActive"`
	IsSystem          bool      `json:"isSystem"`
	MinPayloadVersion int32     `json:"minPayloadVersion"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type ReferentielsStatutsOutput struct {
	Body struct {
		Items []ReferentielsStatut `json:"items"`
	}
}

type ReferentielsStatutOutput struct {
	Body ReferentielsStatut
}

const (
	referentielsVersionStatut = 6
	referentielsVersionMotif  = 2
)

var (
	referentielsEffetsJoints = []string{exports.IssueJointImport, "REFUSED", "SCHEDULE_CALLBACK", "WRONG_NUMBER"}
	referentielsDiacritiques = strings.NewReplacer("à", "a", "â", "a", "ä", "a", "á", "a", "ã", "a", "å", "a", "ç", "c", "é", "e", "è", "e", "ê", "e", "ë", "e", "î", "i", "ï", "i", "í", "i", "ì", "i", "ô", "o", "ö", "o", "ó", "o", "ò", "o", "õ", "o", "ù", "u", "û", "u", "ü", "u", "ú", "u", "ÿ", "y", "ñ", "n", "œ", "oe", "æ", "ae")
	referentielsEspaces      = regexp.MustCompile(`\s+`)
	referentielsCodeValide   = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
)

// La branche du script se DÉDUIT de l'effet : une colonne « joignable »
// divergerait à la première correction.
func referentielsBranche(effet db.StatutQualificationEffect) []string {
	for _, e := range referentielsEffetsJoints {
		if e == string(effet) {
			return referentielsEffetsJoints
		}
	}
	return []string{string(db.CallOutcomeUNREACHABLE)}
}

func referentielsConvertir[S, D any](lignes []S, versDTO func(*S) D) []D {
	out := make([]D, 0, len(lignes))
	for i := range lignes {
		out = append(out, versDTO(&lignes[i]))
	}
	return out
}

func referentielsVersStatut(r *db.StatutsQualification) ReferentielsStatut {
	s := ReferentielsStatut{
		ID: r.ID, Code: r.Code, Label: r.Label, Effect: string(r.Effect),
		RequiresCallback: r.RequiresCallback, RequiresComment: r.RequiresComment,
		RetryAfterMinutes: r.RetryAfterMinutes, Priorite: string(r.Priorite), ParentID: r.ParentId,
		IsActive: r.IsActive, IsSystem: r.IsSystem,
		MinPayloadVersion: r.MinPayloadVersion, UpdatedAt: r.UpdatedAt,
	}
	if r.RelationStatus != nil {
		relation := string(*r.RelationStatus)
		s.RelationStatus = &relation
	}
	return s
}

func (s *service) referentielsStatuts(ctx context.Context, actifsSeulement bool) (*ReferentielsStatutsOutput, error) {
	rows, err := s.Q.ListStatutsQualification(ctx, actifsSeulement)
	if err != nil {
		return nil, err
	}
	out := &ReferentielsStatutsOutput{}
	out.Body.Items = referentielsConvertir(rows, referentielsVersStatut)
	return out, nil
}

// Tous les statuts actifs sont servis : `payloadVersion` filtrait un parc
// mobile qui n'existe plus (plan.md §2.2).
func (s *service) referentielsStatutsSaisie(ctx context.Context, _ *struct{}) (*ReferentielsStatutsOutput, error) {
	return s.referentielsStatuts(ctx, true)
}

func (s *service) referentielsStatutsAdmin(ctx context.Context, _ *struct{}) (*ReferentielsStatutsOutput, error) {
	return s.referentielsStatuts(ctx, false)
}

type ReferentielsCreerStatutInput struct {
	Body struct {
		Label             string  `json:"label" minLength:"2" maxLength:"120"`
		Effect            *string `json:"effect,omitempty" enum:"REACHED,REFUSED,SCHEDULE_CALLBACK,UNREACHABLE,WRONG_NUMBER"`
		ParentID          *string `json:"parentId,omitempty" format:"uuid"`
		RequiresCallback  *bool   `json:"requiresCallback,omitempty"`
		RequiresComment   *bool   `json:"requiresComment,omitempty"`
		RetryAfterMinutes *int32  `json:"retryAfterMinutes,omitempty" minimum:"0" maximum:"10080"`
		Priorite          *string `json:"priorite,omitempty" enum:"HAUTE,NORMALE,BASSE"`
		RelationStatus    *string `json:"relationStatus,omitempty" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	}
}

// Le code se lit dans le libellé puis se fige : l'historique le référence.
func referentielsCodeDepuisLibelle(label string) string {
	return referentielsEspaces.ReplaceAllString(strings.ToUpper(referentielsDiacritiques.Replace(strings.ToLower(label))), "_")
}

func referentielsVaut[T any](p *T, defaut T) T {
	if p == nil {
		return defaut
	}
	return *p
}

func referentielsRappelAutorise(effet, code string, requiresCallback bool) error {
	if !requiresCallback || effet == "SCHEDULE_CALLBACK" || effet == "CLOSE_APPOINTMENT" {
		return nil
	}
	return socle.Problem(http.StatusConflict, code,
		"Seuls un rappel ou un rendez-vous planifient une date : « "+effet+" » ne peut pas en exiger une.")
}

// L'appelant a déjà lu la ligne homonyme : `err` distingue « libre » de
// « occupée », `id` nomme l'occupante pour l'écran d'administration.
func referentielsLibreOuConflit(id, code, message string, err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	p := socle.Problem(http.StatusConflict, code, message)
	p.Errors = []*huma.ErrorDetail{{Location: "body.label", Message: id}}
	return p
}

type referentielsParent struct {
	label   string
	effet   string
	profond bool
}

func referentielsParentStatut(r *db.StatutsQualification) referentielsParent {
	return referentielsParent{label: r.Label, effet: string(r.Effect), profond: r.ParentId != nil}
}

func referentielsParentMotif(r *db.CallOutcomeReason) referentielsParent {
	return referentielsParent{label: r.Label, effet: string(r.Effect), profond: r.ParentId != nil}
}

// Un enfant hérite l'effet de son parent : racine, enfant, jamais plus profond.
func referentielsEffetHerite[T any](ctx context.Context, parentID, effet *string, famille, nom string,
	lire func(context.Context, string) (T, error), vers func(*T) referentielsParent,
) (string, error) {
	if parentID == nil {
		if effet == nil {
			return "", socle.Problem(http.StatusBadRequest, famille+"_EFFECT_REQUIRED",
				"Un "+nom+" sans parent doit dire son effet.")
		}
		return *effet, nil
	}
	ligne, err := lire(ctx, *parentID)
	parent := vers(&ligne)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", socle.Problem(http.StatusBadRequest, famille+"_PARENT_NOT_FOUND", "Le "+nom+" parent est introuvable.")
	}
	if err != nil {
		return "", err
	}
	if parent.profond {
		return "", socle.Problem(http.StatusConflict, famille+"_PARENT_TOO_DEEP",
			"« "+parent.label+" » est déjà un sous-"+nom+" : il ne peut pas en porter un autre.")
	}
	return parent.effet, nil
}

func (s *service) referentielsEffetDuStatut(ctx context.Context, in *ReferentielsCreerStatutInput) (db.StatutQualificationEffect, error) {
	effet, err := referentielsEffetHerite(ctx, in.Body.ParentID, in.Body.Effect, "STATUT_QUALIFICATION", "statut",
		s.Q.StatutQualificationParID, referentielsParentStatut)
	return db.StatutQualificationEffect(effet), err
}

func (s *service) referentielsStatutCreer(ctx context.Context, in *ReferentielsCreerStatutInput) (*ReferentielsStatutOutput, error) {
	label := strings.TrimSpace(in.Body.Label)
	code := referentielsCodeDepuisLibelle(label)
	if !referentielsCodeValide.MatchString(code) {
		return nil, socle.Problem(http.StatusBadRequest, "STATUT_QUALIFICATION_LABEL_UNUSABLE",
			"« "+label+" » ne donne aucun code utilisable : commencez par une lettre et n'employez que des lettres, des chiffres et des espaces.")
	}
	effet, err := s.referentielsEffetDuStatut(ctx, in)
	if err != nil {
		return nil, err
	}
	clashLabel, err := s.Q.StatutQualificationParLabel(ctx, label)
	if err := referentielsLibreOuConflit(clashLabel.ID, "STATUT_QUALIFICATION_LABEL_CONFLICT",
		"Le libellé « "+label+" » est déjà porté par un autre statut.", err); err != nil {
		return nil, err
	}
	clashCode, err := s.Q.StatutQualificationParCode(ctx, code)
	if err := referentielsLibreOuConflit(clashCode.ID, "STATUT_QUALIFICATION_CODE_CONFLICT",
		"« "+label+" » donne le même code que « "+clashCode.Label+" » : distinguez-les autrement que par les accents ou la casse.", err); err != nil {
		return nil, err
	}
	requiresCallback := referentielsVaut(in.Body.RequiresCallback, false)
	if err := referentielsRappelAutorise(string(effet), "STATUT_QUALIFICATION_CALLBACK_NOT_ALLOWED", requiresCallback); err != nil {
		return nil, err
	}
	rang, err := s.Q.RangSuivantStatutQualification(ctx, referentielsBranche(effet))
	if err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	var relation *db.RepresentantRelation
	if in.Body.RelationStatus != nil {
		r := db.RepresentantRelation(*in.Body.RelationStatus)
		relation = &r
	}
	var row db.StatutsQualification
	if err := s.referentielTracer(ctx, referentielsActionCreer, referentielsFamilleStatuts, id.String(),
		func(q *db.Queries) (map[string]any, map[string]any, error) {
			pose, err := q.InsertStatutQualification(ctx, db.InsertStatutQualificationParams{
				ID: id.String(), Code: code, Label: label, Effect: effet,
				RequiresCallback: requiresCallback, RequiresComment: referentielsVaut(in.Body.RequiresComment, false),
				RetryAfterMinutes: referentielsReessai(in.Body.RetryAfterMinutes),
				Priorite:          db.PrioriteTraitement(referentielsVaut(in.Body.Priorite, "NORMALE")),
				RelationStatus:    relation, SortOrder: rang, MinPayloadVersion: referentielsVersionStatut,
				ParentId: in.Body.ParentID,
			})
			if err != nil {
				return nil, nil, err
			}
			row = pose
			return nil, referentielsStatutJournal(&pose), nil
		}); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return &ReferentielsStatutOutput{Body: referentielsVersStatut(&row)}, nil
}

type ReferentielsModifierStatutInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Label             *string `json:"label,omitempty" minLength:"2" maxLength:"120"`
		RequiresCallback  *bool   `json:"requiresCallback,omitempty"`
		RequiresComment   *bool   `json:"requiresComment,omitempty"`
		RetryAfterMinutes *int32  `json:"retryAfterMinutes,omitempty" minimum:"0" maximum:"10080"`
		Priorite          *string `json:"priorite,omitempty" enum:"HAUTE,NORMALE,BASSE"`
		RelationStatus    *string `json:"relationStatus,omitempty" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	}
}

func (s *service) referentielsStatutParID(ctx context.Context, id string) (db.StatutsQualification, error) {
	row, err := s.Q.StatutQualificationParID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return row, socle.Problem(http.StatusNotFound, "STATUT_QUALIFICATION_NOT_FOUND", "Statut de qualification introuvable.")
	}
	return row, err
}

// Le libellé, la priorité et la relation posée se corrigent toujours, système
// compris ; la RÈGLE non : le script s'appuie dessus.
func referentielsRegleStatutIntacte(existant *db.StatutsQualification, in *ReferentielsModifierStatutInput) error {
	if existant.IsSystem && (in.Body.RequiresCallback != nil || in.Body.RequiresComment != nil) {
		return socle.Problem(http.StatusConflict, "STATUT_QUALIFICATION_SYSTEM_IMMUTABLE",
			"« "+existant.Label+" » est un statut système : sa règle est celle du script et ne se reconfigure pas ici.")
	}
	if in.Body.RequiresCallback == nil {
		return nil
	}
	return referentielsRappelAutorise(string(existant.Effect), "STATUT_QUALIFICATION_CALLBACK_NOT_ALLOWED", *in.Body.RequiresCallback)
}

func (s *service) referentielsStatutLabelLibre(ctx context.Context, id, label string) error {
	clash, err := s.Q.StatutQualificationParLabel(ctx, label)
	if clash.ID == id {
		return nil
	}
	return referentielsLibreOuConflit(clash.ID, "STATUT_QUALIFICATION_LABEL_CONFLICT",
		"Le libellé « "+label+" » est déjà porté par un autre statut.", err)
}

func (s *service) referentielsStatutModifier(ctx context.Context, in *ReferentielsModifierStatutInput) (*ReferentielsStatutOutput, error) {
	existant, err := s.referentielsStatutParID(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := referentielsRegleStatutIntacte(&existant, in); err != nil {
		return nil, err
	}
	var label *string
	if in.Body.Label != nil {
		propre := strings.TrimSpace(*in.Body.Label)
		if err := s.referentielsStatutLabelLibre(ctx, in.ID, propre); err != nil {
			return nil, err
		}
		label = &propre
	}
	var relation *db.RepresentantRelation
	if in.Body.RelationStatus != nil {
		r := db.RepresentantRelation(*in.Body.RelationStatus)
		relation = &r
	}
	var priorite *db.PrioriteTraitement
	if in.Body.Priorite != nil {
		p := db.PrioriteTraitement(*in.Body.Priorite)
		priorite = &p
	}
	var row db.StatutsQualification
	if err := s.referentielTracer(ctx, referentielsActionModifier, referentielsFamilleStatuts, in.ID,
		func(q *db.Queries) (map[string]any, map[string]any, error) {
			modifie, err := q.UpdateStatutQualification(ctx, db.UpdateStatutQualificationParams{
				ID: in.ID, Label: label, RequiresCallback: in.Body.RequiresCallback,
				RequiresComment: in.Body.RequiresComment, Priorite: priorite,
				RetryAfterMinutes: referentielsReessai(in.Body.RetryAfterMinutes), RelationStatus: relation,
			})
			if err != nil {
				return nil, nil, err
			}
			row = modifie
			avant, apres := referentielsStatutDiff(&existant, &modifie, in)
			return avant, apres, nil
		}); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return &ReferentielsStatutOutput{Body: referentielsVersStatut(&row)}, nil
}

type ReferentielsActiverInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		IsActive bool `json:"isActive"`
	}
}

// Désactiver est permis, système compris ; vider une branche du script ne
// l'est pas : un écran sans issue proposable ne se rattrape pas du terrain.
func (s *service) referentielsStatutActiver(ctx context.Context, in *ReferentielsActiverInput) (*ReferentielsStatutOutput, error) {
	existant, err := s.referentielsStatutParID(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if !in.Body.IsActive && existant.IsActive {
		restants, err := s.Q.CompterStatutsQualificationActifs(ctx, db.CompterStatutsQualificationActifsParams{
			ID: in.ID, Branche: referentielsBranche(existant.Effect),
		})
		if err != nil {
			return nil, err
		}
		if restants == 0 {
			return nil, socle.Problem(http.StatusConflict, "STATUT_QUALIFICATION_LAST_OF_BRANCH",
				"« "+existant.Label+" » est le dernier statut actif de sa branche : le retirer laisserait le script sans issue possible.")
		}
	}
	var row db.StatutsQualification
	bascule := func(q *db.Queries) (err error) {
		row, err = q.SetStatutQualificationActive(ctx, db.SetStatutQualificationActiveParams{ID: in.ID, IsActive: in.Body.IsActive})
		return err
	}
	if err := s.referentielBasculer(ctx, referentielsFamilleStatuts, in.ID, existant.IsActive, in.Body.IsActive, bascule); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return &ReferentielsStatutOutput{Body: referentielsVersStatut(&row)}, nil
}

type ReferentielsMotif struct {
	ID                string    `json:"id"`
	Code              string    `json:"code"`
	Label             string    `json:"label"`
	Effect            string    `json:"effect" enum:"CLOSE_METHOD,CLOSE_REFUSED,CLOSE_WRONG_NUMBER,CLOSE_LOST,CLOSE_UNREACHABLE,CLOSE_INTERESTED,CLOSE_HESITANT,CLOSE_APPOINTMENT,CLOSE_REACHED,KEEP_OPEN,SCHEDULE_CALLBACK"`
	ParentID          *string   `json:"parentId" doc:"Motif de premier niveau que celui-ci précise ; l'effet est hérité."`
	RequiresComment   bool      `json:"requiresComment"`
	RequiresCallback  bool      `json:"requiresCallback"`
	CountsAsReached   bool      `json:"countsAsReached"`
	IsActive          bool      `json:"isActive"`
	IsSystem          bool      `json:"isSystem"`
	SortOrder         int32     `json:"sortOrder"`
	Color             *string   `json:"color"`
	MinPayloadVersion int32     `json:"minPayloadVersion"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type ReferentielsMotifsOutput struct {
	Body struct {
		Items []ReferentielsMotif `json:"items"`
	}
}

type ReferentielsMotifOutput struct {
	Body ReferentielsMotif
}

func referentielsVersMotif(r *db.CallOutcomeReason) ReferentielsMotif {
	return ReferentielsMotif{
		ID: r.ID, Code: r.Code, Label: r.Label, Effect: string(r.Effect), ParentID: r.ParentId,
		RequiresComment: r.RequiresComment, RequiresCallback: r.RequiresCallback,
		CountsAsReached: r.CountsAsReached, IsActive: r.IsActive, IsSystem: r.IsSystem,
		SortOrder: r.SortOrder, Color: r.Color, MinPayloadVersion: r.MinPayloadVersion,
		UpdatedAt: r.UpdatedAt,
	}
}

func (s *service) referentielsMotifs(ctx context.Context, actifsSeulement bool) (*ReferentielsMotifsOutput, error) {
	rows, err := s.Q.ListCallOutcomeReasons(ctx, actifsSeulement)
	if err != nil {
		return nil, err
	}
	out := &ReferentielsMotifsOutput{}
	out.Body.Items = referentielsConvertir(rows, referentielsVersMotif)
	return out, nil
}

func (s *service) referentielsMotifsSaisie(ctx context.Context, _ *struct{}) (*ReferentielsMotifsOutput, error) {
	return s.referentielsMotifs(ctx, true)
}

func (s *service) referentielsMotifsAdmin(ctx context.Context, _ *struct{}) (*ReferentielsMotifsOutput, error) {
	return s.referentielsMotifs(ctx, false)
}

type ReferentielsCreerMotifInput struct {
	Body struct {
		Code             string  `json:"code" minLength:"2" maxLength:"40"`
		Label            string  `json:"label" minLength:"2" maxLength:"80"`
		Effect           *string `json:"effect,omitempty" enum:"CLOSE_METHOD,CLOSE_REFUSED,CLOSE_WRONG_NUMBER,CLOSE_LOST,CLOSE_UNREACHABLE,CLOSE_INTERESTED,CLOSE_HESITANT,CLOSE_APPOINTMENT,CLOSE_REACHED,KEEP_OPEN,SCHEDULE_CALLBACK"`
		ParentID         *string `json:"parentId,omitempty" format:"uuid" doc:"Motif de premier niveau que celui-ci précise ; l'effet est alors hérité."`
		RequiresComment  *bool   `json:"requiresComment,omitempty"`
		RequiresCallback *bool   `json:"requiresCallback,omitempty"`
		CountsAsReached  *bool   `json:"countsAsReached,omitempty"`
		Color            *string `json:"color,omitempty" minLength:"2" maxLength:"40"`
		SortOrder        *int32  `json:"sortOrder,omitempty" minimum:"0"`
	}
}

func (s *service) referentielsMotifCreer(ctx context.Context, in *ReferentielsCreerMotifInput) (*ReferentielsMotifOutput, error) {
	code := strings.ToUpper(strings.TrimSpace(in.Body.Code))
	if !referentielsCodeValide.MatchString(code) {
		return nil, referentielsHors(referentielsNomCode, "Majuscules, chiffres et tirets bas, à partir d'une lettre.")
	}
	label := strings.TrimSpace(in.Body.Label)
	clashCode, err := s.Q.CallOutcomeReasonParCode(ctx, code)
	if err := referentielsLibreOuConflit(clashCode.ID, "OUTCOME_REASON_CODE_CONFLICT",
		"Le code « "+code+" » est déjà utilisé par le motif « "+clashCode.Label+" ».", err); err != nil {
		return nil, err
	}
	clashLabel, err := s.Q.CallOutcomeReasonParLabel(ctx, label)
	if err := referentielsLibreOuConflit(clashLabel.ID, "OUTCOME_REASON_LABEL_CONFLICT",
		"Le libellé « "+label+" » est déjà porté par le motif « "+clashLabel.Code+" ».", err); err != nil {
		return nil, err
	}
	effet, err := s.referentielsEffetDuMotif(ctx, in)
	if err != nil {
		return nil, err
	}
	requiresCallback := referentielsVaut(in.Body.RequiresCallback, false)
	if err := referentielsRappelAutorise(string(effet), "OUTCOME_REASON_CALLBACK_NOT_ALLOWED", requiresCallback); err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	var couleur *string
	if in.Body.Color != nil {
		c := strings.TrimSpace(*in.Body.Color)
		couleur = &c
	}
	var row db.CallOutcomeReason
	if err := s.referentielTracer(ctx, referentielsActionCreer, referentielsFamilleMotifs, id.String(),
		func(q *db.Queries) (map[string]any, map[string]any, error) {
			pose, err := q.InsertCallOutcomeReason(ctx, db.InsertCallOutcomeReasonParams{
				ID: id.String(), Code: code, Label: label, Effect: effet, ParentId: in.Body.ParentID,
				RequiresComment: referentielsVaut(in.Body.RequiresComment, false), RequiresCallback: requiresCallback,
				CountsAsReached: referentielsVaut(in.Body.CountsAsReached, true), Color: couleur,
				SortOrder: referentielsVaut(in.Body.SortOrder, 100), MinPayloadVersion: referentielsVersionMotif,
			})
			if err != nil {
				return nil, nil, err
			}
			row = pose
			return nil, referentielsMotifJournal(&pose), nil
		}); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return &ReferentielsMotifOutput{Body: referentielsVersMotif(&row)}, nil
}

func (s *service) referentielsEffetDuMotif(ctx context.Context, in *ReferentielsCreerMotifInput) (db.CallOutcomeEffect, error) {
	effet, err := referentielsEffetHerite(ctx, in.Body.ParentID, in.Body.Effect, "OUTCOME_REASON", "motif",
		s.Q.CallOutcomeReasonParID, referentielsParentMotif)
	return db.CallOutcomeEffect(effet), err
}

type ReferentielsModifierMotifInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Label            *string `json:"label,omitempty" minLength:"2" maxLength:"80"`
		Color            *string `json:"color,omitempty" minLength:"2" maxLength:"40"`
		SortOrder        *int32  `json:"sortOrder,omitempty" minimum:"0"`
		RequiresComment  *bool   `json:"requiresComment,omitempty"`
		RequiresCallback *bool   `json:"requiresCallback,omitempty"`
		CountsAsReached  *bool   `json:"countsAsReached,omitempty"`
	}
}

func (s *service) referentielsMotifParID(ctx context.Context, id string) (db.CallOutcomeReason, error) {
	row, err := s.Q.CallOutcomeReasonParID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return row, socle.Problem(http.StatusNotFound, "OUTCOME_REASON_NOT_FOUND", "Motif d'issue introuvable.")
	}
	return row, err
}

// « Aucun » se saisit à 0 : en base, c'est l'absence de délai.
func referentielsReessai(minutes *int32) *int32 {
	if minutes != nil && *minutes == 0 {
		return nil
	}
	return minutes
}

func referentielsRegleMotifIntacte(existant *db.CallOutcomeReason, in *ReferentielsModifierMotifInput) error {
	regleTouchee := in.Body.RequiresComment != nil || in.Body.RequiresCallback != nil || in.Body.CountsAsReached != nil
	if existant.IsSystem && regleTouchee {
		return socle.Problem(http.StatusConflict, "OUTCOME_REASON_SYSTEM_IMMUTABLE",
			"« "+existant.Label+" » est un motif système : sa règle est compilée dans l'écran d'appel et ne se reconfigure pas ici.")
	}
	if in.Body.RequiresCallback == nil {
		return nil
	}
	return referentielsRappelAutorise(string(existant.Effect), "OUTCOME_REASON_CALLBACK_NOT_ALLOWED", *in.Body.RequiresCallback)
}

func (s *service) referentielsMotifLabelLibre(ctx context.Context, id, label string) error {
	clash, err := s.Q.CallOutcomeReasonParLabel(ctx, label)
	if clash.ID == id {
		return nil
	}
	return referentielsLibreOuConflit(clash.ID, "OUTCOME_REASON_LABEL_CONFLICT",
		"Le libellé « "+label+" » est déjà porté par le motif « "+clash.Code+" ».", err)
}

func (s *service) referentielsMotifModifier(ctx context.Context, in *ReferentielsModifierMotifInput) (*ReferentielsMotifOutput, error) {
	existant, err := s.referentielsMotifParID(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := referentielsRegleMotifIntacte(&existant, in); err != nil {
		return nil, err
	}
	var label *string
	if in.Body.Label != nil {
		propre := strings.TrimSpace(*in.Body.Label)
		if err := s.referentielsMotifLabelLibre(ctx, in.ID, propre); err != nil {
			return nil, err
		}
		label = &propre
	}
	var row db.CallOutcomeReason
	if err := s.referentielTracer(ctx, referentielsActionModifier, referentielsFamilleMotifs, in.ID,
		func(q *db.Queries) (map[string]any, map[string]any, error) {
			modifie, err := q.UpdateCallOutcomeReason(ctx, db.UpdateCallOutcomeReasonParams{
				ID: in.ID, Label: label, Color: in.Body.Color, SortOrder: in.Body.SortOrder,
				RequiresComment: in.Body.RequiresComment, RequiresCallback: in.Body.RequiresCallback,
				CountsAsReached: in.Body.CountsAsReached,
			})
			if err != nil {
				return nil, nil, err
			}
			row = modifie
			avant, apres := referentielsMotifDiff(&existant, &modifie, in)
			return avant, apres, nil
		}); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return &ReferentielsMotifOutput{Body: referentielsVersMotif(&row)}, nil
}

// Jamais de suppression : les tentatives déjà remontées désignent le code.
func (s *service) referentielsMotifActiver(ctx context.Context, in *ReferentielsActiverInput) (*ReferentielsMotifOutput, error) {
	existant, err := s.referentielsMotifParID(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if existant.IsSystem {
		return nil, socle.Problem(http.StatusConflict, "OUTCOME_REASON_SYSTEM_IMMUTABLE",
			"« "+existant.Label+" » est un motif système : le retirer mettrait la saisie en échec.")
	}
	var row db.CallOutcomeReason
	bascule := func(q *db.Queries) (err error) {
		row, err = q.SetCallOutcomeReasonActive(ctx, db.SetCallOutcomeReasonActiveParams{ID: in.ID, IsActive: in.Body.IsActive})
		return err
	}
	if err := s.referentielBasculer(ctx, referentielsFamilleMotifs, in.ID, existant.IsActive, in.Body.IsActive, bascule); err != nil {
		return nil, err
	}
	s.Live.Emettre(referentielsSujet)
	return &ReferentielsMotifOutput{Body: referentielsVersMotif(&row)}, nil
}

var Garde = map[string]socle.Permission{
	"GET /api/v1/referentiels":                         socle.PermissionPanneauAcceder,
	"GET /api/v1/referentiels/{kind}":                  socle.PermissionPanneauAcceder,
	"POST /api/v1/referentiels/{kind}":                 socle.PermissionReferentielsSuperviser,
	"PATCH /api/v1/referentiels/{kind}/{id}":           socle.PermissionReferentielsSuperviser,
	"GET /api/v1/statuts-qualification":                socle.PermissionPanneauAcceder,
	"GET /api/v1/statuts-qualification/administration": socle.PermissionReferentielsSuperviser,
	"POST /api/v1/statuts-qualification":               socle.PermissionReferentielsSuperviser,
	"PATCH /api/v1/statuts-qualification/{id}":         socle.PermissionReferentielsSuperviser,
	"POST /api/v1/statuts-qualification/{id}/active":   socle.PermissionReferentielsSuperviser,
	"GET /api/v1/call-outcome-reasons":                 socle.PermissionPanneauAcceder,
	"GET /api/v1/call-outcome-reasons/administration":  socle.PermissionReferentielsSuperviser,
	"POST /api/v1/call-outcome-reasons":                socle.PermissionReferentielsSuperviser,
	"PATCH /api/v1/call-outcome-reasons/{id}":          socle.PermissionReferentielsSuperviser,
	"POST /api/v1/call-outcome-reasons/{id}/active":    socle.PermissionReferentielsSuperviser,
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{OperationID: "referentiels-bundle", Method: http.MethodGet, Path: "/api/v1/referentiels"}, s.referentielsBundle)
	huma.Register(api, huma.Operation{OperationID: "referentiel-liste", Method: http.MethodGet, Path: "/api/v1/referentiels/{kind}"}, s.referentielsGet)
	huma.Register(api, huma.Operation{OperationID: "referentiel-creer", Method: http.MethodPost, Path: "/api/v1/referentiels/{kind}", DefaultStatus: http.StatusCreated}, s.referentielsCreer)
	huma.Register(api, huma.Operation{OperationID: "referentiel-modifier", Method: http.MethodPatch, Path: "/api/v1/referentiels/{kind}/{id}"}, s.referentielsModifier)

	huma.Register(api, huma.Operation{OperationID: "statuts-qualification", Method: http.MethodGet, Path: "/api/v1/statuts-qualification"}, s.referentielsStatutsSaisie)
	huma.Register(api, huma.Operation{OperationID: "statuts-qualification-administration", Method: http.MethodGet, Path: "/api/v1/statuts-qualification/administration"}, s.referentielsStatutsAdmin)
	huma.Register(api, huma.Operation{OperationID: "statut-qualification-creer", Method: http.MethodPost, Path: "/api/v1/statuts-qualification", DefaultStatus: http.StatusCreated}, s.referentielsStatutCreer)
	huma.Register(api, huma.Operation{OperationID: "statut-qualification-modifier", Method: http.MethodPatch, Path: "/api/v1/statuts-qualification/{id}"}, s.referentielsStatutModifier)
	huma.Register(api, huma.Operation{OperationID: "statut-qualification-activer", Method: http.MethodPost, Path: "/api/v1/statuts-qualification/{id}/active"}, s.referentielsStatutActiver)

	huma.Register(api, huma.Operation{OperationID: "call-outcome-reasons", Method: http.MethodGet, Path: "/api/v1/call-outcome-reasons"}, s.referentielsMotifsSaisie)
	huma.Register(api, huma.Operation{OperationID: "call-outcome-reasons-administration", Method: http.MethodGet, Path: "/api/v1/call-outcome-reasons/administration"}, s.referentielsMotifsAdmin)
	huma.Register(api, huma.Operation{OperationID: "call-outcome-reason-creer", Method: http.MethodPost, Path: "/api/v1/call-outcome-reasons", DefaultStatus: http.StatusCreated}, s.referentielsMotifCreer)
	huma.Register(api, huma.Operation{OperationID: "call-outcome-reason-modifier", Method: http.MethodPatch, Path: "/api/v1/call-outcome-reasons/{id}"}, s.referentielsMotifModifier)
	huma.Register(api, huma.Operation{OperationID: "call-outcome-reason-activer", Method: http.MethodPost, Path: "/api/v1/call-outcome-reasons/{id}/active"}, s.referentielsMotifActiver)
}

// Tables de référence, nommées comme en base.
const (
	NomOffers       = "offers"
	NomIncomeBands  = "income-bands"
	NomProfessions  = "professions"
	NomEmployeurs   = "employeurs"
	NomPays         = "pays"
	NomBanques      = "banques"
	NomSyndicats    = "syndicats"
	NomIefs         = "iefs"
	NomDepartements = "departements"
	NomRegions      = "regions"
)
