package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/assistant"
	"cpi-go/internal/campagnes"
	"cpi-go/internal/referentiels"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var rolesChiffres = socle.PermissionChiffresDisposer

// Vocabulaire figé du domaine : clés d'audit, chemins montés deux fois,
// tables purgées sous deux noms, et les valeurs de disposition citées par les
// règles de marque comme par les dispositions d'usine.
const (
	cheminCompte      = "/api/v1/users/{id}"
	cheminDisposition = "/api/v1/tableaux-de-bord/{ecran}/disposition"
	cheminDump        = "/api/v1/admin/database-dump"

	cleRole   = "role"
	cleRoleID = "roleId"
	cleEmail  = "email"

	nomUsers         = "users"
	nomVisites       = "visites"
	nomRepresentants = "representants"
	nomNotifications = "notifications"

	ecranVisites     = "visites"
	ecranChues       = "chues"
	ecranGrandPublic = "grand-public"
	ecranPilotage    = "pilotage"
	sourceCalcul     = "calcul"

	marqueTuile            = "tuile"
	marqueTableau          = "tableau"
	marqueCamembert        = "camembert"
	marqueBarresVerticales = "barres-verticales"
	taillePleine           = "pleine"
	presetEssentiel        = "essentiel"
	sourceFichesOuvertes   = "fiches-ouvertes"
	sourceTauxExploitation = "taux-d-exploitation"
	marqueCourbe           = "courbe"
	champWidgets           = "body.widgets"
)

var Garde = map[string]socle.Permission{
	"GET /api/v1/users":                                           socle.PermissionComptesLister,
	"POST /api/v1/users":                                          socle.PermissionComptesAdministrer,
	"GET /api/v1/users/{id}":                                      socle.PermissionComptesAdministrer,
	"PATCH /api/v1/users/{id}":                                    socle.PermissionComptesAdministrer,
	"PUT /api/v1/users/{id}/active":                               socle.PermissionComptesAdministrer,
	"PUT /api/v1/users/{id}/password":                             socle.PermissionComptesAdministrer,
	"DELETE /api/v1/users/{id}":                                   socle.PermissionComptesAdministrer,
	"GET /api/v1/admin/supervision":                               socle.PermissionAnalyticsSuperviser,
	"GET /api/v1/admin/exploitation":                              socle.PermissionExploitationAdministrer,
	"GET /api/v1/admin/journal":                                   socle.PermissionExploitationAdministrer,
	"GET /api/v1/admin/exploitation/routes":                       socle.PermissionExploitationAdministrer,
	"GET /api/v1/admin/purge":                                     socle.PermissionExploitationAdministrer,
	"POST /api/v1/admin/purge":                                    socle.PermissionExploitationAdministrer,
	"GET /api/v1/admin/database-dump":                             socle.PermissionExploitationAdministrer,
	"POST /api/v1/admin/database-dump":                            socle.PermissionExploitationAdministrer,
	"GET /api/v1/admin/database-dump/download":                    socle.PermissionExploitationAdministrer,
	"GET /api/v1/enrolement/{projet}/inscriptions":                socle.PermissionEnrolementAdministrer,
	"DELETE /api/v1/enrolement/{projet}/inscriptions":             socle.PermissionEnrolementAdministrer,
	"GET /api/v1/enrolement/{projet}/inscriptions/{id}":           socle.PermissionEnrolementAdministrer,
	"DELETE /api/v1/enrolement/{projet}/inscriptions/{id}":        socle.PermissionEnrolementAdministrer,
	"GET /api/v1/enrolement/{projet}/indicateurs":                 socle.PermissionEnrolementAdministrer,
	"GET /api/v1/enrolement/{projet}/reglages":                    socle.PermissionEnrolementAdministrer,
	"PUT /api/v1/enrolement/{projet}/reglages":                    socle.PermissionEnrolementAdministrer,
	"POST /api/v1/enrolement/{projet}/tirage":                     socle.PermissionEnrolementAdministrer,
	"POST /api/v1/webhooks/enrolement/{projet}":                   socle.Publique,
	"GET /api/v1/tableaux-de-bord/{ecran}/disposition":            rolesChiffres,
	"PUT /api/v1/tableaux-de-bord/{ecran}/disposition":            rolesChiffres,
	"DELETE /api/v1/tableaux-de-bord/{ecran}/disposition":         rolesChiffres,
	"PUT /api/v1/tableaux-de-bord/{ecran}/disposition/par-defaut": socle.PermissionParametresAdministrer,
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, huma.Operation{OperationID: "listUsers", Method: http.MethodGet, Path: "/api/v1/users"}, s.listerComptes)
	huma.Register(api, huma.Operation{OperationID: "getUser", Method: http.MethodGet, Path: cheminCompte}, s.lireCompte)
	huma.Register(api, huma.Operation{OperationID: "createUser", Method: http.MethodPost, Path: "/api/v1/users", DefaultStatus: http.StatusCreated}, s.creerCompte)
	huma.Register(api, huma.Operation{OperationID: "updateUser", Method: http.MethodPatch, Path: cheminCompte}, s.modifierCompte)
	huma.Register(api, huma.Operation{OperationID: "setUserActive", Method: http.MethodPut, Path: cheminCompte + "/active"}, s.activerCompte)
	huma.Register(api, huma.Operation{OperationID: "resetUserPassword", Method: http.MethodPut, Path: cheminCompte + "/password"}, s.reinitialiserMotDePasse)
	huma.Register(api, huma.Operation{OperationID: "deleteUser", Method: http.MethodDelete, Path: cheminCompte}, s.supprimerCompte)

	huma.Register(api, huma.Operation{OperationID: "getSupervision", Method: http.MethodGet, Path: CheminSupervision}, s.supervisionDesComptes)
	huma.Register(api, huma.Operation{OperationID: "getPurgeCatalog", Method: http.MethodGet, Path: "/api/v1/admin/purge"}, s.cataloguePurge)
	huma.Register(api, huma.Operation{OperationID: "purgeDatabase", Method: http.MethodPost, Path: "/api/v1/admin/purge"}, s.purgerBase)

	huma.Register(api, huma.Operation{OperationID: "getDashboardLayout", Method: http.MethodGet, Path: cheminDisposition}, s.lireDisposition)
	huma.Register(api, huma.Operation{OperationID: "putDashboardLayout", Method: http.MethodPut, Path: cheminDisposition}, s.ecrireDisposition)
	huma.Register(api, huma.Operation{OperationID: "deleteDashboardLayout", Method: http.MethodDelete, Path: cheminDisposition}, s.effacerDisposition)
	huma.Register(api, huma.Operation{OperationID: "putDashboardDefaultLayout", Method: http.MethodPut, Path: cheminDisposition + "/par-defaut"}, s.ecrireDispositionParDefaut)

	monterRoles(api, s)
	monterDump(api, s)
	monterEnrolement(api, s)
	monterExploitation(api, s)
}

func (s *service) txAdmin(ctx context.Context, geste func(pgx.Tx, *db.Queries) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := geste(tx, s.Q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Une clé absente d'`app_settings` n'est pas une erreur : l'état du dump comme
// les réglages de tirage n'existent qu'une fois écrits.
func (s *service) reglage(ctx context.Context, cle string) (db.GetSettingRow, bool, error) {
	ligne, err := s.Q.GetSetting(ctx, cle)
	switch {
	case err == nil:
		return ligne, true, nil
	case errors.Is(err, pgx.ErrNoRows):
		return ligne, false, nil
	default:
		return ligne, false, err
	}
}

func texteAdmin(v string) *string {
	propre := strings.TrimSpace(v)
	if propre == "" {
		return nil
	}
	return &propre
}

type OkAdmin struct {
	Ok bool `json:"ok"`
}

type OkAdminOutput struct {
	Body OkAdmin
}

type PageAdmin struct {
	Total     int `json:"total"`
	Page      int `json:"page"`
	PageSize  int `json:"pageSize"`
	PageCount int `json:"pageCount"`
}

type Compte struct {
	ID            string     `json:"id" format:"uuid"`
	Email         string     `json:"email"`
	Username      string     `json:"username"`
	FullName      string     `json:"fullName"`
	Role          socle.Role `json:"role" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	RoleID        string     `json:"roleId"`
	RoleLibelle   string     `json:"roleLibelle"`
	IsActive      bool       `json:"isActive"`
	PhoneE164     *string    `json:"phoneE164"`
	LastLoginAt   *time.Time `json:"lastLoginAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	ProspectCount int        `json:"prospectCount"`
	// Compte aussi dans la reprise de portefeuille : un compte sans prospect
	// mais avec des représentants gèlerait ses fiches.
	RepresentantCount int `json:"representantCount"`
}

type CompteOutput struct {
	Body Compte
}

func versCompte(r *db.UserDetailRow) Compte {
	return Compte{
		ID: r.ID, Email: r.Email, Username: r.Username, FullName: r.FullName,
		Role: socle.Role(r.Role), RoleID: r.RoleId, RoleLibelle: r.RoleLibelle, IsActive: r.IsActive, PhoneE164: r.PhoneE164,
		LastLoginAt: r.LastLoginAt, CreatedAt: r.CreatedAt, ProspectCount: int(r.ProspectCount),
		RepresentantCount: int(r.RepresentantCount),
	}
}

func compteAdmin(ctx context.Context, q *db.Queries, id string) (Compte, error) {
	row, err := q.UserDetail(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Compte{}, socle.Problem(http.StatusNotFound, "USER_NOT_FOUND", "Compte introuvable.")
	}
	if err != nil {
		return Compte{}, err
	}
	return versCompte(&row), nil
}

type ListerComptesInput struct {
	Search   string `query:"search" maxLength:"120"`
	Role     string `query:"role" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	IsActive string `query:"isActive" enum:"true,false"`
	Page     int32  `query:"page" minimum:"1" default:"1"`
	PageSize int32  `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
}

type ListerComptesOutput struct {
	Body struct {
		Items []Compte  `json:"items"`
		Meta  PageAdmin `json:"meta"`
	}
}

// Une chaîne vide vaut « paramètre absent » : huma ne sait pas distinguer un
// booléen non transmis d'un `false`.
func booleenAdmin(v string) *bool {
	if v == "" {
		return nil
	}
	oui := v == socle.Vrai
	return &oui
}

func (s *service) listerComptes(ctx context.Context, in *ListerComptesInput) (*ListerComptesOutput, error) {
	var role *db.Role
	if in.Role != "" {
		r := db.Role(in.Role)
		role = &r
	}
	filtres := db.CountUsersParams{Role: role, IsActive: booleenAdmin(in.IsActive), Search: texteAdmin(in.Search)}
	total, err := s.Q.CountUsers(ctx, filtres)
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListUsers(ctx, db.ListUsersParams{
		Role: filtres.Role, IsActive: filtres.IsActive, Search: filtres.Search,
		PageSize: in.PageSize, PageOffset: (in.Page - 1) * in.PageSize,
	})
	if err != nil {
		return nil, err
	}
	out := &ListerComptesOutput{}
	out.Body.Items = make([]Compte, 0, len(rows))
	for i := range rows {
		ligne := db.UserDetailRow(rows[i])
		out.Body.Items = append(out.Body.Items, versCompte(&ligne))
	}
	taille := int(in.PageSize)
	out.Body.Meta = PageAdmin{
		Total: int(total), Page: int(in.Page), PageSize: taille,
		PageCount: max(1, (int(total)+taille-1)/taille),
	}
	return out, nil
}

type CompteInput struct {
	ID string `path:"id" format:"uuid"`
}

func (s *service) lireCompte(ctx context.Context, in *CompteInput) (*CompteOutput, error) {
	c, err := compteAdmin(ctx, s.Q, in.ID)
	if err != nil {
		return nil, err
	}
	return &CompteOutput{Body: c}, nil
}

type CreerCompteInput struct {
	Body struct {
		Email    string      `json:"email" format:"email" maxLength:"254"`
		Username string      `json:"username" minLength:"3" maxLength:"40" pattern:"^[a-zA-Z0-9._-]+$"`
		FullName string      `json:"fullName" minLength:"2" maxLength:"160"`
		Password string      `json:"password" minLength:"1" maxLength:"1024"`
		Role     *socle.Role `json:"role,omitempty" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
		RoleID   *string     `json:"roleId,omitempty" maxLength:"64"`
		Phone    *string     `json:"phone,omitempty" maxLength:"40"`
	}
}

func (s *service) bornesMotDePasse(mdp string) error {
	if n := len(mdp); n < s.Cfg.PasswordMin || n > s.Cfg.PasswordMax {
		message := fmt.Sprintf("Le mot de passe doit faire entre %d et %d caractères.", s.Cfg.PasswordMin, s.Cfg.PasswordMax)
		return huma.Error422UnprocessableEntity("mot de passe hors bornes", &huma.ErrorDetail{Location: "body.password", Message: message})
	}
	return nil
}

func (s *service) identifiantsLibres(ctx context.Context, email, username *string) error {
	if email == nil && username == nil {
		return nil
	}
	clash, err := s.Q.UserIdentifierTaken(ctx, db.UserIdentifierTakenParams{Email: email, Username: username})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	champ, message := "body.username", "Ce nom d’utilisateur est déjà utilisé."
	if email != nil && (strings.EqualFold(clash.Email, *email) || strings.EqualFold(clash.Username, *email)) {
		champ, message = "body.email", "Cette adresse e-mail est déjà utilisée."
	}
	return &socle.ProblemError{
		Status: http.StatusConflict, Code: "USER_IDENTIFIER_TAKEN", Message: message,
		Errors: []*huma.ErrorDetail{{Location: champ, Message: message}},
	}
}

// Chaîne vide : aucun numéro. La v1 efface le numéro sur `phone: ""`.
func (s *service) telephoneCompte(brut *string) (string, error) {
	if brut == nil || strings.TrimSpace(*brut) == "" {
		return "", nil
	}
	return database.NormaliserTelephone(*brut, s.Cfg.PhoneRegion)
}

func (s *service) creerCompte(ctx context.Context, in *CreerCompteInput) (*CompteOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	if err := s.bornesMotDePasse(in.Body.Password); err != nil {
		return nil, err
	}
	email := strings.ToLower(strings.TrimSpace(in.Body.Email))
	username := strings.ToLower(strings.TrimSpace(in.Body.Username))
	if err := s.identifiantsLibres(ctx, &email, &username); err != nil {
		return nil, err
	}
	phone, err := s.telephoneCompte(in.Body.Phone)
	if err != nil {
		return nil, err
	}
	condensat, err := database.HacherMotDePasse(in.Body.Password)
	if err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	role, idDuRole, err := s.roleDeCreation(ctx, in.Body.RoleID, in.Body.Role)
	if err != nil {
		return nil, err
	}

	var cree Compte
	err = s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		if err := q.VerrouAdministrationDesRoles(ctx); err != nil {
			return err
		}
		if err := q.InsertUser(ctx, db.InsertUserParams{
			ID: id.String(), Email: email, Username: username, FullName: strings.TrimSpace(in.Body.FullName),
			PasswordHash: condensat, Role: db.Role(role), PhoneE164: texteAdmin(phone), RoleId: idDuRole,
		}); err != nil {
			return err
		}
		if err := database.Auditer(ctx, q, acteur.ID, "user.create", "user", id.String(), nil,
			traceRole(map[string]any{cleEmail: email, "username": username, cleRole: role}, role, idDuRole)); err != nil {
			return err
		}
		var err error
		cree, err = compteAdmin(ctx, q, id.String())
		return err
	})
	if err != nil {
		return nil, err
	}
	return &CompteOutput{Body: cree}, nil
}

type ModifierCompteInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Email    *string     `json:"email,omitempty" format:"email" maxLength:"254"`
		Username *string     `json:"username,omitempty" minLength:"3" maxLength:"40" pattern:"^[a-zA-Z0-9._-]+$"`
		FullName *string     `json:"fullName,omitempty" minLength:"2" maxLength:"160"`
		Role     *socle.Role `json:"role,omitempty" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
		RoleID   *string     `json:"roleId,omitempty" maxLength:"64"`
		Phone    *string     `json:"phone,omitempty" maxLength:"40"`
	}
}

type changementCompte struct {
	email, username, fullName *string
	role                      *socle.Role
	roleID                    *string
	actif                     *bool
	phone                     *string
	phoneTouche               bool
}

// Le verrou porte sur TOUTES les lignes ADMIN actives, pas seulement les
// autres : deux rétrogradations croisées se liraient sinon l'une l'autre et
// laisseraient la plateforme sans administrateur.
func adminSurvit(ctx context.Context, q *db.Queries, existant *db.UserRoleForUpdateRow, acteurID string, role *socle.Role, actif *bool) error {
	perd := socle.Role(existant.Role) == socle.Admin && ((role != nil && *role != socle.Admin) || (actif != nil && !*actif))
	if !perd {
		return nil
	}
	if existant.ID == acteurID && role != nil && *role != socle.Admin {
		return socle.Problem(http.StatusBadRequest, "CANNOT_DEMOTE_SELF", "Un administrateur ne peut pas retirer son propre rôle.")
	}
	admins, err := q.LockActiveAdmins(ctx)
	if err != nil {
		return err
	}
	for _, id := range admins {
		if id != existant.ID {
			return nil
		}
	}
	return socle.Problem(http.StatusBadRequest, "LAST_ADMIN", "C’est le dernier administrateur actif : nommez-en un autre d’abord.")
}

func identifiantChange(suivant *string, courant string) *string {
	if suivant == nil || strings.EqualFold(*suivant, courant) {
		return nil
	}
	return suivant
}

func (s *service) appliquerChangement(ctx context.Context, id string, chg changementCompte, acteurID string) (Compte, error) {
	existant, err := s.Q.UserRoleForUpdate(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Compte{}, socle.Problem(http.StatusNotFound, "USER_NOT_FOUND", "Compte introuvable.")
	}
	if err != nil {
		return Compte{}, err
	}
	if err := s.identifiantsLibres(ctx, identifiantChange(chg.email, existant.Email), identifiantChange(chg.username, existant.Username)); err != nil {
		return Compte{}, err
	}
	roleChange := chg.roleID != nil && existant.RoleId != *chg.roleID
	if err := s.quitterLesEquipes(ctx, roleChange, chg.role, chg.actif, id); err != nil {
		return Compte{}, err
	}

	var modifie Compte
	err = s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		var err error
		modifie, err = ecrireChangement(ctx, q, id, chg, &existant, acteurID)
		return err
	})
	if err != nil {
		return Compte{}, err
	}
	// Le rôle est relu à chaque requête ; la session ouverte, elle, survivrait.
	if roleChange || (chg.actif != nil && !*chg.actif) {
		if err := s.Q.RevokeUserSessions(ctx, id); err != nil {
			return Compte{}, err
		}
	}
	return modifie, nil
}

// Un rôle qui ne siège plus dans une équipe de campagne en sort avant d'être écrit.
func (s *service) quitterLesEquipes(ctx context.Context, roleChange bool, role *socle.Role, actif *bool, id string) error {
	quitteParRole := roleChange && !slices.Contains(campagnes.RolesEquipe, *role)
	quitteParInactivation := actif != nil && !*actif
	if !quitteParRole && !quitteParInactivation {
		return nil
	}
	return campagnes.RetirerDesEquipes(ctx, s.Deps, id)
}

func ecrireChangement(ctx context.Context, q *db.Queries, id string, chg changementCompte, existant *db.UserRoleForUpdateRow, acteurID string) (Compte, error) {
	if err := q.VerrouAdministrationDesRoles(ctx); err != nil {
		return Compte{}, err
	}
	if err := adminSurvit(ctx, q, existant, acteurID, chg.role, chg.actif); err != nil {
		return Compte{}, err
	}
	if err := q.UpdateUser(ctx, db.UpdateUserParams{
		ID: id, Email: chg.email, Username: chg.username, FullName: chg.fullName,
		RoleID: chg.roleID, IsActive: chg.actif, PhoneTouched: chg.phoneTouche, Phone: chg.phone,
	}); err != nil {
		return Compte{}, err
	}
	if err := administrationDesRolesSurvit(ctx, q); err != nil {
		return Compte{}, err
	}
	modifie, err := compteAdmin(ctx, q, id)
	if err != nil {
		return Compte{}, err
	}
	action := "user.update"
	if modifie.RoleID != existant.RoleId {
		action = "user.role_change"
	}
	return modifie, database.Auditer(ctx, q, acteurID, action, "user", id,
		traceRole(map[string]any{cleRole: existant.Role, "isActive": existant.IsActive, cleEmail: existant.Email}, socle.Role(existant.Role), existant.RoleId),
		traceRole(map[string]any{cleRole: modifie.Role, "isActive": modifie.IsActive, cleEmail: modifie.Email}, modifie.Role, modifie.RoleID))
}

func (s *service) modifierCompte(ctx context.Context, in *ModifierCompteInput) (*CompteOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	roleID, base, err := roleDuCompte(ctx, s.Q, in.Body.RoleID, in.Body.Role)
	if err != nil {
		return nil, err
	}
	if err := s.compteDansSesDroits(ctx, in.ID, roleID); err != nil {
		return nil, err
	}
	chg := changementCompte{role: base, roleID: roleID, phoneTouche: in.Body.Phone != nil}
	if in.Body.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*in.Body.Email))
		chg.email = &email
	}
	if in.Body.Username != nil {
		username := strings.ToLower(strings.TrimSpace(*in.Body.Username))
		chg.username = &username
	}
	if in.Body.FullName != nil {
		nom := strings.TrimSpace(*in.Body.FullName)
		chg.fullName = &nom
	}
	phone, err := s.telephoneCompte(in.Body.Phone)
	if err != nil {
		return nil, err
	}
	chg.phone = texteAdmin(phone)
	modifie, err := s.appliquerChangement(ctx, in.ID, chg, acteur.ID)
	if err != nil {
		return nil, err
	}
	return &CompteOutput{Body: modifie}, nil
}

type ActiverCompteInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		IsActive     bool    `json:"isActive"`
		HandoverToID *string `json:"handoverToId,omitempty" format:"uuid"`
	}
}

func (s *service) activerCompte(ctx context.Context, in *ActiverCompteInput) (*CompteOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	if in.ID == acteur.ID && !in.Body.IsActive {
		return nil, socle.Problem(http.StatusBadRequest, "CANNOT_DEACTIVATE_SELF", "Un administrateur ne peut pas désactiver son propre compte.")
	}
	if err := s.compteDansSesDroits(ctx, in.ID, nil); err != nil {
		return nil, err
	}
	if !in.Body.IsActive {
		if err := s.reprisePortefeuille(ctx, in.ID, in.Body.HandoverToID, acteur.ID); err != nil {
			return nil, err
		}
	}
	modifie, err := s.appliquerChangement(ctx, in.ID, changementCompte{actif: &in.Body.IsActive}, acteur.ID)
	if err != nil {
		return nil, err
	}
	return &CompteOutput{Body: modifie}, nil
}

// Sans reprise, le portefeuille du compte qui part gèle : plus aucun
// téléconseiller actif ne lit ses fiches et ses tâches de campagne les
// bloquent hors de tout tirage.
func (s *service) reprisePortefeuille(ctx context.Context, id string, repreneurID *string, acteurID string) error {
	compteurs, err := s.Q.CountPortfolio(ctx, id)
	if err != nil {
		return err
	}
	if compteurs.Prospects == 0 && compteurs.Representants == 0 {
		return nil
	}
	if repreneurID == nil {
		return socle.Problem(http.StatusBadRequest, "HANDOVER_REQUIRED", fmt.Sprintf(
			"Ce compte détient %d prospect(s) et %d représentant(s) : désignez le téléconseiller qui les reprend.",
			compteurs.Prospects, compteurs.Representants))
	}
	if *repreneurID == id {
		return socle.Problem(http.StatusBadRequest, "HANDOVER_TO_SELF", "Le repreneur doit être un autre compte.")
	}
	repreneur, err := s.Q.HandoverTarget(ctx, *repreneurID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && socle.Role(repreneur.Role) != socle.Commercial) {
		return socle.Problem(http.StatusBadRequest, "HANDOVER_TARGET_INVALID", "Le repreneur doit être un téléconseiller actif.")
	}
	if err != nil {
		return err
	}
	return s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		if _, err := q.HandoverProspects(ctx, db.HandoverProspectsParams{Sortant: id, Repreneur: *repreneurID}); err != nil {
			return err
		}
		if _, err := q.HandoverRepresentants(ctx, db.HandoverRepresentantsParams{Sortant: id, Repreneur: *repreneurID}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteurID, "portfolio.handover", "user", id,
			map[string]any{socle.NomProspects: compteurs.Prospects, nomRepresentants: compteurs.Representants},
			map[string]any{"handoverToId": *repreneurID, "handoverToName": repreneur.FullName})
	})
}

type MotDePasseCompteInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Password string `json:"password" minLength:"1" maxLength:"1024"`
	}
}

func (s *service) reinitialiserMotDePasse(ctx context.Context, in *MotDePasseCompteInput) (*OkAdminOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	if err := s.bornesMotDePasse(in.Body.Password); err != nil {
		return nil, err
	}
	if err := s.compteDansSesDroits(ctx, in.ID, nil); err != nil {
		return nil, err
	}
	if _, err := s.Q.UserRoleForUpdate(ctx, in.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, socle.Problem(http.StatusNotFound, "USER_NOT_FOUND", "Compte introuvable.")
		}
		return nil, err
	}
	condensat, err := database.HacherMotDePasse(in.Body.Password)
	if err != nil {
		return nil, err
	}
	err = s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		if err := q.UpdatePassword(ctx, db.UpdatePasswordParams{ID: in.ID, PasswordHash: condensat}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "user.reset_password", "user", in.ID, nil, nil)
	})
	if err != nil {
		return nil, err
	}
	if err := s.Q.RevokeUserSessions(ctx, in.ID); err != nil {
		return nil, err
	}
	return &OkAdminOutput{Body: OkAdmin{Ok: true}}, nil
}

type SupprimerCompteInput struct {
	ID           string `path:"id" format:"uuid"`
	HandoverToID string `query:"handoverToId" format:"uuid"`
}

func (s *service) supprimerCompte(ctx context.Context, in *SupprimerCompteInput) (*OkAdminOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	if in.ID == acteur.ID {
		return nil, socle.Problem(http.StatusBadRequest, "CANNOT_DELETE_SELF", "Un administrateur ne peut pas supprimer son propre compte.")
	}
	existant, err := s.compteSupprimable(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "USER_NOT_FOUND", "Compte introuvable.")
	}
	if err != nil {
		return nil, err
	}
	if err := campagnes.RetirerDesEquipes(ctx, s.Deps, in.ID); err != nil {
		return nil, err
	}
	if err := s.reprisePortefeuille(ctx, in.ID, texteAdmin(in.HandoverToID), acteur.ID); err != nil {
		return nil, err
	}
	inactif := false
	err = s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		if err := q.VerrouAdministrationDesRoles(ctx); err != nil {
			return err
		}
		if err := adminSurvit(ctx, q, &existant, acteur.ID, nil, &inactif); err != nil {
			return err
		}
		if err := q.SoftDeleteUser(ctx, in.ID); err != nil {
			return err
		}
		if err := administrationDesRolesSurvit(ctx, q); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "user.delete", "user", in.ID,
			map[string]any{cleEmail: existant.Email, cleRole: existant.Role}, nil)
	})
	if err != nil {
		return nil, err
	}
	if err := s.Q.RevokeUserSessions(ctx, in.ID); err != nil {
		return nil, err
	}
	return &OkAdminOutput{Body: OkAdmin{Ok: true}}, nil
}

type etapePurge struct {
	cle   string
	table string
	role  socle.Role
}

// Ordre global, enfants avant parents ; toute purge en est un sous-mot.
// `syncOperations`, `syncBatches` et `deviceCallDetections` partent avec le
// mobile (plan.md 2.2).
var etapesPurge = []etapePurge{
	{cle: "bankCaseTransitions", table: "bank_case_transitions"},
	{cle: "bankCases", table: "bank_cases"},
	{cle: "ouverturesFiche", table: "ouvertures_fiche"},
	{cle: "callAttempts", table: "call_attempts"},
	{cle: "lotExportReaffectations", table: "lot_export_reaffectations"},
	{cle: "lotExportItems", table: "lot_export_items"},
	{cle: "lotsExport", table: "lots_export"},
	{cle: "scheduledCallbacks", table: "scheduled_callbacks"},
	{cle: "repSuggestions", table: "representant_suggestions"},
	{cle: "repCallAttempts", table: "rep_call_attempts"},
	{cle: "clientRequests", table: "client_creation_requests"},
	{cle: nomVisites, table: nomVisites},
	{cle: "prospectConversions", table: "prospect_conversions"},
	{cle: "prospectJourneys", table: "prospect_journeys"},
	{cle: socle.NomProspects, table: socle.NomProspects},
	{cle: nomRepresentants, table: nomRepresentants},
	{cle: "notificationDeliveries", table: "notification_deliveries"},
	{cle: nomNotifications, table: nomNotifications},
	{cle: "notificationTemplates", table: "notification_templates"},
	{cle: "auditLogs", table: "audit_logs"},
	{cle: "commercialAccounts", table: nomUsers, role: socle.Commercial},
	{cle: "chargeClienteleAccounts", table: nomUsers, role: socle.ChargeClientele},
	{cle: "financeAccounts", table: nomUsers, role: socle.BanqueFinance},
	{cle: "supervisionAccounts", table: nomUsers, role: socle.Superviseur},
	{cle: "directionAccounts", table: nomUsers, role: socle.Direction},
	{cle: "accueilAccounts", table: nomUsers, role: socle.Accueil},
	{cle: "bankCaseStages", table: "bank_case_stages"},
	{cle: "bankRejectionReasons", table: "bank_rejection_reasons"},
	{cle: "callOutcomeReasons", table: "call_outcome_reasons"},
	{cle: "visiteEntreprises", table: "visite_entreprises"},
	{cle: "visiteDirections", table: "visite_directions"},
	{cle: "visiteDestinataires", table: "visite_destinataires"},
	{cle: "visiteObjets", table: "visite_objets"},
	{cle: "canauxProvenance", table: "canaux_provenance"},
	{cle: "offres", table: referentiels.NomOffers},
	{cle: "tranchesRevenu", table: "income_bands"},
	{cle: referentiels.NomProfessions, table: referentiels.NomProfessions},
	{cle: referentiels.NomEmployeurs, table: referentiels.NomEmployeurs},
	{cle: referentiels.NomPays, table: referentiels.NomPays},
	{cle: referentiels.NomBanques, table: referentiels.NomBanques},
	{cle: referentiels.NomSyndicats, table: referentiels.NomSyndicats},
	{cle: referentiels.NomIefs, table: referentiels.NomIefs},
	{cle: referentiels.NomDepartements, table: referentiels.NomDepartements},
	{cle: referentiels.NomRegions, table: referentiels.NomRegions},
}

type domainePurge struct {
	cle, label, hint string
	// Clés d'étapes et de domaines séparées par des virgules.
	etapes string
	// Seulement les arêtes `onDelete: Restrict` : l'élargir supprimerait des
	// données que l'administrateur n'a pas cochées.
	requiert string
}

const (
	clesPurge         = "teleconseillers,chargesClientele,finances,supervision,directionAccueil,representants,prospects,lotsExport,demandesClients,visites,fileAppels,tentatives,dossiers,notifications,journal,referentiels"
	comptesRequierent = "dossiers,tentatives,fileAppels,lotsExport,prospects,representants"
)

var domainesPurge = []domainePurge{
	{cle: "teleconseillers", label: "Comptes téléconseillers", hint: "Comptes et tout ce qu’ils ont saisi.", etapes: "commercialAccounts", requiert: comptesRequierent},
	{cle: "chargesClientele", label: "Comptes chargés de clientèle", hint: "Comptes du closing et tout ce qu’ils ont saisi.", etapes: "chargeClienteleAccounts", requiert: comptesRequierent},
	{cle: "finances", label: "Comptes Finances générales", hint: "Comptes du pôle, dossiers qu’ils ont ouverts et demandes qu’ils ont déposées.", etapes: "financeAccounts", requiert: "dossiers,demandesClients"},
	{cle: "supervision", label: "Comptes supervision", hint: "Comptes qui suivent le travail des téléconseillers.", etapes: "supervisionAccounts"},
	{cle: "directionAccueil", label: "Comptes direction et accueil", hint: "Comptes du comptoir et de la direction, et le registre qu’ils ont tenu.", etapes: "directionAccounts,accueilAccounts", requiert: nomVisites},
	{cle: nomRepresentants, label: "Représentants", hint: "Fiches représentants.", etapes: nomRepresentants, requiert: socle.NomProspects},
	{cle: socle.NomProspects, label: "Prospects", hint: "Fiches prospects.", etapes: "prospectConversions,prospectJourneys,prospects", requiert: "dossiers,tentatives,fileAppels,demandesClients"},
	{cle: "lotsExport", label: "Campagnes", hint: "Campagnes de fiches réparties pour le terrain.", etapes: "lotExportReaffectations,lotExportItems,lotsExport"},
	{cle: "demandesClients", label: "Demandes de création de client", hint: "Demandes déposées par les banques, arbitrées ou non.", etapes: "clientRequests"},
	{cle: nomVisites, label: "Registre des visites", hint: "Lignes du registre d’accueil.", etapes: nomVisites},
	{cle: "fileAppels", label: "File d’appels", hint: "Numéros attribués, appelés ou non, et les rappels planifiés.", etapes: "scheduledCallbacks"},
	{cle: "tentatives", label: "Tentatives d’appel", hint: "Appels consignés et ouvertures de fiche.", etapes: "repSuggestions,repCallAttempts,callAttempts,ouverturesFiche"},
	{cle: "dossiers", label: "Dossiers bancaires", hint: "Dossiers et leur historique d’étapes.", etapes: "bankCaseTransitions,bankCases"},
	{cle: nomNotifications, label: "Notifications", hint: "Envois, accusés de lecture et gabarits.", etapes: "notificationDeliveries,notifications,notificationTemplates"},
	{cle: "journal", label: "Journal d’audit", hint: "Traces des actions administratives.", etapes: "auditLogs"},
	{cle: "referentiels", label: "Référentiels", hint: "Régions, départements, IEF, banques, syndicats, étapes, motifs de rejet, issues d’appel et listes de l’accueil.", etapes: "bankCaseStages,bankRejectionReasons,callOutcomeReasons,visiteEntreprises,visiteDirections,visiteDestinataires,visiteObjets,canauxProvenance,offres,tranchesRevenu,professions,employeurs,pays,banques,syndicats,iefs,departements,regions", requiert: "dossiers,prospects,representants,demandesClients,visites"},
}

func decouper(liste string) []string {
	if liste == "" {
		return []string{}
	}
	return strings.Split(liste, ",")
}

func domaineParCle(cle string) *domainePurge {
	for i := range domainesPurge {
		if domainesPurge[i].cle == cle {
			return &domainesPurge[i]
		}
	}
	return nil
}

func etendreSelection(selection []string) []string {
	resolus := map[string]bool{}
	attente := append([]string{}, selection...)
	for len(attente) > 0 {
		cle := attente[len(attente)-1]
		attente = attente[:len(attente)-1]
		d := domaineParCle(cle)
		if resolus[cle] || d == nil {
			continue
		}
		resolus[cle] = true
		attente = append(attente, decouper(d.requiert)...)
	}
	ordonnes := make([]string, 0, len(resolus))
	for _, cle := range strings.Split(clesPurge, ",") {
		if resolus[cle] {
			ordonnes = append(ordonnes, cle)
		}
	}
	return ordonnes
}

func etapesDeSelection(selection []string) []etapePurge {
	voulues := map[string]bool{}
	for _, cle := range etendreSelection(selection) {
		for _, etape := range decouper(domaineParCle(cle).etapes) {
			voulues[etape] = true
		}
	}
	retenues := make([]etapePurge, 0, len(voulues))
	for _, etape := range etapesPurge {
		if voulues[etape.cle] {
			retenues = append(retenues, etape)
		}
	}
	return retenues
}

// Le compte qui purge n'est JAMAIS supprimé : exclusion explicite, pas déduite du rôle.
func (e etapePurge) clause() string {
	if e.role == "" {
		return ""
	}
	return ` WHERE "role" = '` + string(e.role) + `' AND "id" <> $1`
}

type DomainePurge struct {
	Key      string   `json:"key" enum:"teleconseillers,chargesClientele,finances,supervision,directionAccueil,representants,prospects,lotsExport,demandesClients,visites,fileAppels,tentatives,dossiers,notifications,journal,referentiels"`
	Label    string   `json:"label"`
	Hint     string   `json:"hint"`
	Requires []string `json:"requires"`
	Rows     int64    `json:"rows"`
}

type CataloguePurgeOutput struct {
	Body struct {
		Allowed          bool           `json:"allowed"`
		ConfirmationHint string         `json:"confirmationHint"`
		Domains          []DomainePurge `json:"domains"`
	}
}

func (s *service) compterEtapes(ctx context.Context, acteurID string) (map[string]int64, error) {
	colonnes := make([]string, 0, len(etapesPurge))
	for _, e := range etapesPurge {
		colonnes = append(colonnes, `(SELECT count(*) FROM "`+e.table+`"`+e.clause()+`)`)
	}
	valeurs := make([]int64, len(etapesPurge))
	cibles := make([]any, len(etapesPurge))
	for i := range valeurs {
		cibles[i] = &valeurs[i]
	}
	requete := "SELECT " + strings.Join(colonnes, ", ")
	if err := s.Pool.QueryRow(ctx, requete, acteurID).Scan(cibles...); err != nil {
		return nil, err
	}
	lignes := make(map[string]int64, len(etapesPurge))
	for i, e := range etapesPurge {
		lignes[e.cle] = valeurs[i]
	}
	return lignes, nil
}

func (s *service) cataloguePurge(ctx context.Context, _ *struct{}) (*CataloguePurgeOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	premier, err := s.Q.FirstAdmin(ctx)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	autorise := err == nil && premier.ID == acteur.ID
	lignes, err := s.compterEtapes(ctx, acteur.ID)
	if err != nil {
		return nil, err
	}
	out := &CataloguePurgeOutput{}
	out.Body.Allowed = autorise
	if autorise {
		out.Body.ConfirmationHint = premier.Username
	}
	out.Body.Domains = make([]DomainePurge, 0, len(domainesPurge))
	for _, d := range domainesPurge {
		var total int64
		for _, etape := range decouper(d.etapes) {
			total += lignes[etape]
		}
		out.Body.Domains = append(out.Body.Domains, DomainePurge{
			Key: d.cle, Label: d.label, Hint: d.hint, Requires: decouper(d.requiert), Rows: total,
		})
	}
	return out, nil
}

type PurgerInput struct {
	Body struct {
		Domains      []string `json:"domains" minItems:"1" maxItems:"16" enum:"teleconseillers,chargesClientele,finances,supervision,directionAccueil,representants,prospects,lotsExport,demandesClients,visites,fileAppels,tentatives,dossiers,notifications,journal,referentiels"`
		Confirmation string   `json:"confirmation" maxLength:"254"`
	}
}

type LignePurgee struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Rows  int64  `json:"rows"`
}

type PurgerOutput struct {
	Body struct {
		Deleted  []LignePurgee `json:"deleted"`
		Total    int64         `json:"total"`
		PurgedAt time.Time     `json:"purgedAt"`
	}
}

func (s *service) premierAdmin(ctx context.Context, acteurID string) (db.FirstAdminRow, error) {
	premier, err := s.Q.FirstAdmin(ctx)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && premier.ID != acteurID) {
		return premier, socle.Problem(http.StatusForbidden, "PURGE_NOT_FIRST_ADMIN", "Purge réservée au premier compte administrateur.")
	}
	return premier, err
}

func (s *service) purgerBase(ctx context.Context, in *PurgerInput) (*PurgerOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	premier, err := s.premierAdmin(ctx, acteur.ID)
	if err != nil {
		return nil, err
	}
	saisi := strings.TrimSpace(in.Body.Confirmation)
	if saisi == "" || (!strings.EqualFold(saisi, premier.Email) && !strings.EqualFold(saisi, premier.Username)) {
		return nil, socle.Problem(http.StatusUnauthorized, "PURGE_CONFIRMATION_MISMATCH", "Identifiant incorrect. Saisissez celui de votre connexion.")
	}

	domaines := etendreSelection(in.Body.Domains)
	supprimees := map[string]int64{}
	// Une seule transaction, enfants avant parents : découpée, elle laisserait
	// des clés étrangères en l'air. Le défaut de 5 s ne tient pas 500 000 lignes.
	err = s.txAdmin(ctx, func(tx pgx.Tx, q *db.Queries) error {
		if _, err := tx.Exec(ctx, "SET LOCAL statement_timeout = '300s'"); err != nil {
			return err
		}
		for _, etape := range etapesDeSelection(in.Body.Domains) {
			lignes, err := supprimerTablePurge(ctx, tx, etape, acteur.ID)
			if err != nil {
				return err
			}
			supprimees[etape.cle] = lignes
		}
		// APRÈS les suppressions : l'étape `auditLogs` effacerait une trace écrite avant.
		return database.Auditer(ctx, q, acteur.ID, "DATABASE_PURGE", "database", acteur.ID, nil, bilanPurge(domaines, supprimees))
	})
	if err != nil {
		return nil, err
	}
	return resumePurge(domaines, supprimees), nil
}

func resumePurge(domaines []string, supprimees map[string]int64) *PurgerOutput {
	out := &PurgerOutput{}
	out.Body.Deleted = []LignePurgee{}
	out.Body.PurgedAt = time.Now()
	for _, cle := range domaines {
		var lignes int64
		for _, etape := range decouper(domaineParCle(cle).etapes) {
			lignes += supprimees[etape]
		}
		if lignes == 0 {
			continue
		}
		out.Body.Deleted = append(out.Body.Deleted, LignePurgee{Key: cle, Label: domaineParCle(cle).label, Rows: lignes})
		out.Body.Total += lignes
	}
	return out
}

func supprimerTablePurge(ctx context.Context, tx pgx.Tx, etape etapePurge, acteurID string) (int64, error) {
	requete := `DELETE FROM "` + etape.table + `"` + etape.clause()
	args := []any{}
	if etape.role != "" {
		args = append(args, acteurID)
	}
	marque, err := tx.Exec(ctx, requete, args...)
	if err != nil {
		return 0, err
	}
	return marque.RowsAffected(), nil
}

var (
	sourcesVisites       = strings.Split("total-visites,moyenne-journaliere,jour-le-plus-charge,par-entreprise,par-objet,par-direction,par-destinataire,par-jour,par-mois,par-heure,par-jour-semaine,par-heure-jour-semaine,par-agent,par-entreprise-objet,par-destinataire-direction,par-objet-mois,visiteurs-recurrents,avec-telephone,qualite-de-saisie", ",")
	sourcesQualification = strings.Split("taux-de-contact,taux-de-joignabilite-representants,taux-d-acceptation,taux-de-rappel,repartition-statuts-qualification,joints-non-joints,statuts-par-famille,joignabilite-par-creneau,taux-d-exploitation,representants-par-departement,representants-par-ief,representants-jamais-appeles,representants-injoignables", ",")
	sourcesProspects     = strings.Split("taux-de-joignabilite,prospects-notes,adhesions,reste-a-appeler,fiches-ouvertes,taux-de-qualification,taux-de-reiteration,duree-moyenne-sur-la-fiche,duree-moyenne-de-communication,appels-par-jour,par-teleconseiller,couverture-derniere-campagne,hors-attribution-derniere-campagne,encaisse,de-l-appel-a-l-encaissement,methodes-d-adhesion,par-banque,delais-medians,rendement-par-departement", ",")
	sourcesEnrolement    = strings.Split("enrolement-inscriptions,enrolement-taux-rapprochement,enrolement-taux-conversion,enrolement-par-jour,enrolement-par-etape,enrolement-par-teleconseiller", ",")

	sourcesParEcran = map[string][]string{
		ecranVisites:     sourcesVisites,
		ecranChues:       slices.Concat(sourcesQualification, sourcesProspects, sourcesEnrolement),
		ecranGrandPublic: slices.Concat(sourcesProspects, sourcesEnrolement),
		ecranPilotage:    slices.Concat(sourcesQualification, sourcesProspects, sourcesEnrolement),
	}

	marquesCategorie   = strings.Split("barres-horizontales,barres-verticales,camembert,anneau,tableau", ",")
	marquesChiffre     = strings.Split(marqueTuile, ",")
	marquesTemporelles = strings.Split("courbe,aire,escalier,barres-verticales", ",")
	marquesComposition = strings.Split("barres-100,barres-empilees,camembert,anneau,tableau", ",")
	marquesMatrice     = strings.Split("carte-de-chaleur,tableau", ",")
	marquesTableau     = strings.Split(marqueTableau, ",")
)

type regleMarque struct {
	defaut      string
	compatibles []string
}

var (
	regleChiffre    = regleMarque{marqueTuile, marquesChiffre}
	regleClassement = regleMarque{"barres-horizontales", marquesCategorie}
	regleMatrice    = regleMarque{"carte-de-chaleur", marquesMatrice}
	regleTemporelle = regleMarque{marqueCourbe, marquesTemporelles}
	regleAnneau     = regleMarque{"anneau", marquesComposition}
	regleTableau    = regleMarque{marqueTableau, marquesTableau}
	regleCamembert  = regleMarque{marqueCamembert, marquesComposition}
)

// Les marques d'un calcul suivent la forme de ses données, comme la table
// COMPATIBLES du panneau.
var reglesParForme = map[string]regleMarque{
	assistant.FormeScalaire:    regleChiffre,
	assistant.FormeClassement:  regleClassement,
	assistant.FormeSerie:       {marqueCourbe, strings.Split("courbe,aire,escalier,barres-verticales,mixte,tableau", ",")},
	assistant.FormeComposition: {"barres-empilees", marquesComposition},
}

// Marque par défaut de chaque source et marques compatibles avec sa forme de
// données ; une marque devenue incompatible retombe sur le défaut plutôt que
// de faire disparaître l'élément de l'écran qui l'a choisi.
var reglesParSource = map[string]regleMarque{
	"total-visites": regleChiffre, "moyenne-journaliere": regleChiffre,
	"jour-le-plus-charge": regleChiffre,
	"par-entreprise":      regleClassement, "par-objet": regleClassement,
	"par-direction": regleClassement, "par-destinataire": regleClassement,
	"par-agent": regleClassement, "par-jour": regleTemporelle,
	"par-mois":               {marqueCourbe, append(slices.Clone(marquesTemporelles), "barres-groupees")},
	"par-heure":              {marqueBarresVerticales, strings.Split("barres-verticales,courbe,aire,radar,aire-polaire", ",")},
	"par-jour-semaine":       {marqueBarresVerticales, strings.Split("barres-verticales,radar,aire-polaire,camembert", ",")},
	"par-heure-jour-semaine": regleMatrice, "par-entreprise-objet": regleMatrice,
	"par-destinataire-direction": regleMatrice, "par-objet-mois": regleMatrice,
	"visiteurs-recurrents": {marqueTableau, strings.Split("tableau,barres-horizontales", ",")},
	"avec-telephone":       regleAnneau,
	"qualite-de-saisie":    {"barres-100", strings.Split("barres-100,camembert,anneau,tableau", ",")},

	"taux-de-contact": regleChiffre, "taux-de-joignabilite-representants": regleChiffre,
	"taux-d-acceptation": regleChiffre, "taux-de-rappel": regleChiffre,
	"repartition-statuts-qualification": regleClassement,
	"joints-non-joints":                 {marqueBarresVerticales, marquesCategorie},
	"statuts-par-famille":               {"barres-empilees", marquesComposition},
	"joignabilite-par-creneau":          regleMatrice,
	sourceTauxExploitation:              regleCamembert,
	"representants-par-departement":     regleClassement, "representants-par-ief": regleClassement,
	"representants-jamais-appeles": regleChiffre, "representants-injoignables": regleChiffre,
	"taux-de-joignabilite": regleChiffre, "prospects-notes": regleChiffre,
	"adhesions": regleChiffre, "reste-a-appeler": regleChiffre,
	sourceFichesOuvertes: regleMatrice, "taux-de-qualification": regleChiffre,
	"taux-de-reiteration":        regleChiffre,
	"duree-moyenne-sur-la-fiche": regleChiffre, "duree-moyenne-de-communication": regleChiffre,
	"appels-par-jour":                    regleTemporelle,
	"par-teleconseiller":                 regleTableau,
	"couverture-derniere-campagne":       {"barres-100", strings.Split("barres-100,barres-empilees,tableau", ",")},
	"hors-attribution-derniere-campagne": regleClassement,
	"encaisse":                           regleChiffre,
	"de-l-appel-a-l-encaissement":        regleClassement,
	"methodes-d-adhesion":                regleAnneau, "par-banque": regleAnneau,
	"delais-medians": regleClassement, "rendement-par-departement": regleClassement,

	"enrolement-inscriptions": regleChiffre, "enrolement-taux-rapprochement": regleChiffre,
	"enrolement-taux-conversion": regleChiffre, "enrolement-par-jour": regleTemporelle,
	"enrolement-par-etape":          regleCamembert,
	"enrolement-par-teleconseiller": regleClassement,
}

// Version 1 : ces trois clés mesuraient autre chose sous le même nom.
var renommagesV1 = map[string]string{
	"taux-de-contact":       "taux-de-joignabilite-representants",
	"taux-de-qualification": "taux-d-acceptation",
	"a-rappeler":            "taux-de-rappel",
}

func widgetsDe(liste ...string) []DispositionWidget {
	widgets := make([]DispositionWidget, 0, len(liste))
	for _, source := range liste {
		widgets = append(widgets, DispositionWidget{Source: source})
	}
	return widgets
}

func widgetCalcul(titre, outil, axe, mesure, periode, taille string) DispositionWidget {
	c := &assistant.Calcul{Outil: outil, Axe: axe, Periode: periode}
	if mesure != "" {
		c.Mesures = []string{mesure}
	}
	return DispositionWidget{Source: sourceCalcul, Calcul: c, Titre: titre, Taille: taille}
}

var dispositionsUsine = map[string][]DispositionWidget{
	ecranVisites: widgetsDe("total-visites", "moyenne-journaliere", "jour-le-plus-charge", "par-jour", "par-entreprise", "par-objet", "par-direction", "par-destinataire", "par-mois", "par-heure", "qualite-de-saisie"),
	// Les prospects d'abord : c'est le travail de chaque jour. Les représentants
	// viennent après, sinon l'écran ouvre sur des zéros les semaines sans campagne
	// de représentants.
	ecranChues: slices.Concat(
		widgetsDe("taux-de-joignabilite", "adhesions", "taux-de-contact", "taux-de-qualification", "taux-de-reiteration"),
		[]DispositionWidget{
			{Source: "appels-par-jour", Taille: taillePleine},
			{Source: sourceTauxExploitation, Marque: marqueCamembert, Taille: taillePleine},
			{Source: "par-teleconseiller", Marque: marqueTableau},
			{Source: sourceFichesOuvertes, Taille: taillePleine},
		},
		widgetsDe("couverture-derniere-campagne", "hors-attribution-derniere-campagne", "methodes-d-adhesion", "prospects-notes"),
		widgetsDe("taux-de-joignabilite-representants", "taux-d-acceptation"),
		[]DispositionWidget{
			{Source: "repartition-statuts-qualification", Marque: marqueCamembert, Taille: taillePleine},
		},
		widgetsDe("rendement-par-departement", "enrolement-par-jour"),
	),
	ecranGrandPublic: slices.Concat(
		widgetsDe("taux-de-joignabilite", "taux-de-qualification", "prospects-notes", "adhesions"),
		[]DispositionWidget{{Source: sourceFichesOuvertes, Taille: taillePleine}},
		widgetsDe("couverture-derniere-campagne", "hors-attribution-derniere-campagne", "methodes-d-adhesion", "par-banque", "enrolement-par-jour", "enrolement-par-etape"),
	),
	// Ce qu'un PMO lit d'abord : l'argent et les objectifs, puis la chaîne de
	// conversion, Banque & Finance, l'exploitation et les risques.
	ecranPilotage: {
		widgetCalcul("Ventes du mois", "ventes", "", "Montant", "ce-mois", ""),
		widgetCalcul("Encaissé ce mois", "ventes", "", "Encaissé", "ce-mois", ""),
		widgetCalcul("Objectifs : avancement", "objectifs", "objectif", "Avancement", "ecran", taillePleine),
		{Source: "de-l-appel-a-l-encaissement", Titre: "Entonnoir du portefeuille", Taille: taillePleine},
		widgetCalcul("Reliquat des ventes de l'année", "ventes", "", "Reliquat", "cette-annee", ""),
		widgetCalcul("Échéances en retard", "echeances_en_retard", "", "Montant dû", "ecran", ""),
		widgetCalcul("Dossiers Banque & Finance par étape", "dossiers_bancaires", "etape", "Dossiers", "90-derniers-jours", ""),
		{Source: "delais-medians"},
		widgetCalcul("Dossiers bloqués plus de 7 jours", "dossiers_bancaires", "", "Bloqués plus de 7 jours", "90-derniers-jours", ""),
		{Source: "taux-de-joignabilite"},
		widgetCalcul("Rappels en retard", "rappels", "", "En retard", "90-derniers-jours", ""),
		{Source: sourceTauxExploitation, Marque: marqueCamembert},
		widgetCalcul("Rendez-vous honorés", "rendez_vous", "", "Taux honorés", "ce-mois", ""),
		widgetCalcul("Visites du mois", "visites", "jour", "", "ce-mois", ""),
		widgetCalcul("Risques de la semaine", "risques", "risque", "Nombre", "7-derniers-jours", ""),
	},
}

// Ce que la direction voit en plus : les montants.
var dispositionsUsineDirection = map[string][]DispositionWidget{
	ecranVisites:  {},
	ecranPilotage: {},
	ecranChues:    widgetsDe("encaisse", "duree-moyenne-de-communication", "duree-moyenne-sur-la-fiche", "de-l-appel-a-l-encaissement"),
	ecranGrandPublic: slices.Concat(
		[]DispositionWidget{{Source: "encaisse", Taille: "demi"}},
		widgetsDe("duree-moyenne-de-communication", "duree-moyenne-sur-la-fiche", "de-l-appel-a-l-encaissement", "methodes-d-adhesion"),
	),
}

type DispositionPresentation struct {
	Palette     string `json:"palette,omitempty" enum:"neutre,serie,categorielle"`
	Valeurs     *bool  `json:"valeurs,omitempty"`
	Legende     *bool  `json:"legende,omitempty"`
	Tri         string `json:"tri,omitempty" enum:"valeur-desc,valeur-asc,alphabetique"`
	AutresApres *int   `json:"autresApres,omitempty" minimum:"1" maximum:"50"`
}

type DispositionWidget struct {
	Source       string                   `json:"source" maxLength:"60" doc:"« calcul » pour un calcul de l'assistant."`
	Calcul       *assistant.Calcul        `json:"calcul,omitempty" doc:"Seulement quand la source vaut « calcul »."`
	Titre        string                   `json:"titre,omitempty" maxLength:"80"`
	Marque       string                   `json:"marque,omitempty" enum:"barres-verticales,barres-horizontales,barres-empilees,barres-100,barres-groupees,courbe,aire,escalier,anneau,camembert,aire-polaire,radar,nuage,bulles,mixte,jauge,carte-de-chaleur,tableau,tuile,tuile-courbe"`
	Taille       string                   `json:"taille,omitempty" enum:"demi,pleine"`
	Presentation *DispositionPresentation `json:"presentation,omitempty"`
}

type Disposition struct {
	Version int                 `json:"version"`
	Preset  string              `json:"preset"`
	Widgets []DispositionWidget `json:"widgets"`
}

type DispositionOutput struct {
	Body struct {
		Widgets   []DispositionWidget `json:"widgets"`
		Preset    string              `json:"preset" enum:"essentiel,affluence,organisation,complet"`
		Source    string              `json:"source" enum:"utilisateur,defaut,usine"`
		UpdatedAt *time.Time          `json:"updatedAt"`
	}
}

type DispositionInput struct {
	Ecran string `path:"ecran" enum:"visites,chues,grand-public,pilotage"`
}

type EcrireDispositionInput struct {
	Ecran string `path:"ecran" enum:"visites,chues,grand-public,pilotage"`
	Body  struct {
		Preset  string              `json:"preset,omitempty" enum:"essentiel,affluence,organisation,complet"`
		Widgets []DispositionWidget `json:"widgets" maxItems:"40"`
	}
}

func CleDispositionDefaut(ecran string) string {
	return "tableau-de-bord." + ecran + ".disposition-par-defaut"
}

// La clé d'un calcul est son paramétrage : deux calculs du même outil cohabitent.
func identiteWidget(ecran string, w *DispositionWidget) (cle string, regle regleMarque, admis bool) {
	if w.Source != sourceCalcul {
		w.Calcul = nil
		return w.Source, reglesParSource[w.Source], slices.Contains(sourcesParEcran[ecran], w.Source)
	}
	if w.Calcul == nil {
		return "", regle, false
	}
	c := *w.Calcul
	forme, admis := assistant.NettoyerCalcul(&c)
	w.Calcul = &c
	return sourceCalcul + ":" + assistant.CleCalcul(&c), reglesParForme[forme], admis
}

// Retire les sources étrangères à l'écran, déduplique, plafonne, et remet une
// marque cohérente avec la forme des données.
func nettoyerWidgets(ecran string, widgets []DispositionWidget) []DispositionWidget {
	vues := map[string]bool{}
	propres := make([]DispositionWidget, 0, len(widgets))
	for _, w := range widgets {
		cle, regle, admis := identiteWidget(ecran, &w)
		if !admis || vues[cle] {
			continue
		}
		vues[cle] = true
		w.Titre = strings.TrimSpace(w.Titre)
		if w.Marque == "" || !slices.Contains(regle.compatibles, w.Marque) {
			w.Marque = regle.defaut
		}
		propres = append(propres, w)
		if len(propres) >= 40 {
			break
		}
	}
	return propres
}

func lireDispositionStockee(ecran string, brut []byte, videAutorise bool) (Disposition, bool) {
	var stockee Disposition
	if err := json.Unmarshal(brut, &stockee); err != nil {
		return Disposition{}, false
	}
	if stockee.Version != 1 && stockee.Version != 2 {
		return Disposition{}, false
	}
	if stockee.Version == 1 {
		for i, w := range stockee.Widgets {
			if nouveau, renomme := renommagesV1[w.Source]; renomme {
				stockee.Widgets[i].Source = nouveau
			}
		}
	}
	widgets := nettoyerWidgets(ecran, stockee.Widgets)
	if len(widgets) == 0 && !videAutorise {
		return Disposition{}, false
	}
	preset := stockee.Preset
	if !slices.Contains(strings.Split("essentiel,affluence,organisation,complet", ","), preset) {
		preset = presetEssentiel
	}
	return Disposition{Version: 2, Preset: preset, Widgets: widgets}, true
}

func dispositionUsine(ecran string, voitLesMontants bool) Disposition {
	widgets := dispositionsUsine[ecran]
	if voitLesMontants {
		widgets = slices.Concat(widgets, dispositionsUsineDirection[ecran])
	}
	return Disposition{Version: 2, Preset: presetEssentiel, Widgets: nettoyerWidgets(ecran, widgets)}
}

func reponseDisposition(d Disposition, source string, updatedAt *time.Time) *DispositionOutput {
	out := &DispositionOutput{}
	out.Body.Widgets = d.Widgets
	out.Body.Preset = d.Preset
	out.Body.Source = source
	out.Body.UpdatedAt = updatedAt
	return out
}

func (s *service) lireDisposition(ctx context.Context, in *DispositionInput) (*DispositionOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	rendre := func(d Disposition, source string, updatedAt *time.Time) *DispositionOutput {
		return reponseDisposition(visiblePour(&u, d), source, updatedAt)
	}
	sienne, err := s.Q.GetDashboardLayout(ctx, db.GetDashboardLayoutParams{UserId: u.ID, Ecran: in.Ecran})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		if d, ok := lireDispositionStockee(in.Ecran, sienne.Layout, true); ok {
			return rendre(d, "utilisateur", &sienne.UpdatedAt), nil
		}
	}
	defaut, err := s.Q.GetSetting(ctx, CleDispositionDefaut(in.Ecran))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		if d, ok := lireDispositionStockee(in.Ecran, []byte(defaut.Value), false); ok {
			return rendre(d, "defaut", &defaut.UpdatedAt), nil
		}
	}
	montants := u.Peut(socle.PermissionChiffresVoirMontants)
	return rendre(dispositionUsine(in.Ecran, montants), "usine", nil), nil
}

// L'enrôlement ne sort pas de la cellule pilotage et un calcul ne se montre
// qu'à qui a l'outil : sinon la carte resterait vide, sans moyen de la retirer.
func visiblePour(u *socle.Utilisateur, d Disposition) Disposition {
	enrolement := u.Peut(socle.PermissionEnrolementAdministrer)
	d.Widgets = slices.DeleteFunc(slices.Clone(d.Widgets), func(w DispositionWidget) bool {
		if w.Calcul != nil {
			return !assistant.CalculPermis(u, w.Calcul)
		}
		return !enrolement && slices.Contains(sourcesEnrolement, w.Source)
	})
	return d
}

func dispositionAEcrire(ecran, preset string, widgets []DispositionWidget) (Disposition, []byte, error) {
	vues := map[string]bool{}
	for _, w := range widgets {
		cle, _, admis := identiteWidget(ecran, &w)
		if vues[cle] {
			return Disposition{}, nil, huma.Error422UnprocessableEntity("source en double",
				&huma.ErrorDetail{Location: champWidgets, Message: "Chaque source ou calcul ne peut apparaître qu’une seule fois dans la disposition.", Value: w.Source})
		}
		vues[cle] = true
		if !admis && w.Source == sourceCalcul {
			return Disposition{}, nil, huma.Error422UnprocessableEntity("calcul inconnu",
				&huma.ErrorDetail{Location: champWidgets, Message: "Ce calcul n’existe pas : outil, axe, mesure ou période inconnus.", Value: w.Calcul})
		}
		if !admis {
			return Disposition{}, nil, huma.Error422UnprocessableEntity("source inconnue de cet écran",
				&huma.ErrorDetail{Location: champWidgets, Message: "Cette source n’appartient pas à l’écran " + ecran + ".", Value: w.Source})
		}
	}
	if preset == "" {
		preset = presetEssentiel
	}
	d := Disposition{Version: 2, Preset: preset, Widgets: nettoyerWidgets(ecran, widgets)}
	brut, err := json.Marshal(d)
	return d, brut, err
}

func (s *service) ecrireDisposition(ctx context.Context, in *EcrireDispositionInput) (*DispositionOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	d, brut, err := dispositionAEcrire(in.Ecran, in.Body.Preset, in.Body.Widgets)
	if err != nil {
		return nil, err
	}
	ecrite, err := s.Q.UpsertDashboardLayout(ctx, db.UpsertDashboardLayoutParams{UserId: u.ID, Ecran: in.Ecran, Layout: brut})
	if err != nil {
		return nil, err
	}
	return reponseDisposition(visiblePour(&u, d), "utilisateur", &ecrite), nil
}

func (s *service) effacerDisposition(ctx context.Context, in *DispositionInput) (*OkAdminOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if err := s.Q.DeleteDashboardLayout(ctx, db.DeleteDashboardLayoutParams{UserId: u.ID, Ecran: in.Ecran}); err != nil {
		return nil, err
	}
	return &OkAdminOutput{Body: OkAdmin{Ok: true}}, nil
}

func (s *service) ecrireDispositionParDefaut(ctx context.Context, in *EcrireDispositionInput) (*DispositionOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	d, brut, err := dispositionAEcrire(in.Ecran, in.Body.Preset, in.Body.Widgets)
	if err != nil {
		return nil, err
	}
	var ecrite time.Time
	// La disposition par défaut s'impose à tous ceux qui n'en ont pas posé une :
	// elle part avec sa trace, dans la même transaction.
	if err := s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		quand, err := q.UpsertSetting(ctx, db.UpsertSettingParams{
			Key: CleDispositionDefaut(in.Ecran), Value: string(brut), UpdatedById: &u.ID,
		})
		if err != nil {
			return err
		}
		ecrite = quand
		return database.Auditer(ctx, q, u.ID, "dashboard.default_layout", "dashboard", in.Ecran, nil,
			json.RawMessage(brut))
	}); err != nil {
		return nil, err
	}
	return reponseDisposition(d, "defaut", &ecrite), nil
}

func bilanPurge(domaines []string, supprimees map[string]int64) map[string]any {
	parTable := map[string]int64{}
	var total int64
	for _, etape := range etapesPurge {
		lignes := supprimees[etape.cle]
		if lignes == 0 {
			continue
		}
		parTable[etape.table] += lignes
		total += lignes
	}
	return map[string]any{"domains": domaines, "deleted": parTable, "total": total}
}
