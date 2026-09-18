package admin

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	cheminRoles = "/api/v1/roles"
	cheminRole  = "/api/v1/roles/{id}"
	entiteRole  = "role"
)

var GardeRoles = map[string]socle.Permission{
	"GET " + cheminRoles:                 socle.PermissionComptesAdministrer,
	"POST " + cheminRoles:                socle.PermissionRolesAdministrer,
	"PATCH " + cheminRole:                socle.PermissionRolesAdministrer,
	"DELETE " + cheminRole:               socle.PermissionRolesAdministrer,
	"PUT " + cheminRole + "/permissions": socle.PermissionRolesAdministrer,
}

// Retirer l'une ou l'autre à ADMIN couperait l'accès à l'écran qui répare.
var permissionsVerrouilleesAdmin = []string{string(socle.PermissionComptesAdministrer), string(socle.PermissionRolesAdministrer)}

func monterRoles(api huma.API, s *service) {
	huma.Register(api, huma.Operation{OperationID: "listRoles", Method: http.MethodGet, Path: cheminRoles}, s.listerRoles)
	huma.Register(api, huma.Operation{OperationID: "createRole", Method: http.MethodPost, Path: cheminRoles, DefaultStatus: http.StatusCreated}, s.creerRole)
	huma.Register(api, huma.Operation{OperationID: "updateRole", Method: http.MethodPatch, Path: cheminRole}, s.modifierRole)
	huma.Register(api, huma.Operation{OperationID: "deleteRole", Method: http.MethodDelete, Path: cheminRole}, s.supprimerRole)
	huma.Register(api, huma.Operation{OperationID: "replaceRolePermissions", Method: http.MethodPut, Path: cheminRole + "/permissions"}, s.remplacerPermissions)
}

type RoleDTO struct {
	ID            string     `json:"id"`
	Libelle       string     `json:"libelle"`
	RoleDeBase    socle.Role `json:"roleDeBase" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	Systeme       bool       `json:"systeme"`
	Comptes       int        `json:"comptes"`
	ComptesActifs int        `json:"comptesActifs"`
	Permissions   []string   `json:"permissions"`
}

type PermissionDTO struct {
	Permission string       `json:"permission"`
	Domaine    string       `json:"domaine"`
	Libelle    string       `json:"libelle"`
	ParDefaut  []socle.Role `json:"parDefaut"`
}

type RolesOutput struct {
	Body struct {
		Roles     []RoleDTO       `json:"roles"`
		Catalogue []PermissionDTO `json:"catalogue"`
	}
}

type RoleOutput struct {
	Body RoleDTO
}

func (s *service) listerRoles(ctx context.Context, _ *struct{}) (*RolesOutput, error) {
	lignes, err := s.Q.ListRoles(ctx)
	if err != nil {
		return nil, err
	}
	out := &RolesOutput{}
	out.Body.Roles = make([]RoleDTO, 0, len(lignes))
	for i := range lignes {
		dto, err := roleDTO(ctx, s.Q, lignes[i].ID)
		if err != nil {
			return nil, err
		}
		out.Body.Roles = append(out.Body.Roles, dto)
	}
	out.Body.Catalogue = catalogueDTO()
	return out, nil
}

func catalogueDTO() []PermissionDTO {
	catalogue := make([]PermissionDTO, 0, len(socle.Catalogue))
	for p, definition := range socle.Catalogue {
		parDefaut := slices.Clone(definition.Defaut)
		slices.Sort(parDefaut)
		catalogue = append(catalogue, PermissionDTO{Permission: string(p), Domaine: definition.Domaine, Libelle: definition.Libelle, ParDefaut: parDefaut})
	}
	slices.SortFunc(catalogue, func(a, b PermissionDTO) int {
		return strings.Compare(a.Domaine+" "+a.Libelle, b.Domaine+" "+b.Libelle)
	})
	return catalogue
}

func roleDTO(ctx context.Context, q *db.Queries, id string) (RoleDTO, error) {
	lignes, err := q.ListRoles(ctx)
	if err != nil {
		return RoleDTO{}, err
	}
	i := slices.IndexFunc(lignes, func(l db.ListRolesRow) bool { return l.ID == id })
	if i < 0 {
		return RoleDTO{}, roleIntrouvable()
	}
	permissions, err := q.RolePermissions(ctx, id)
	if err != nil {
		return RoleDTO{}, err
	}
	l := lignes[i]
	return RoleDTO{
		ID: l.ID, Libelle: l.Libelle, RoleDeBase: socle.Role(l.RoleDeBase), Systeme: l.Systeme,
		Comptes: int(l.Comptes), ComptesActifs: int(l.ComptesActifs), Permissions: permissions,
	}, nil
}

func traceDuRole(libelle string, base db.Role) map[string]any {
	return map[string]any{"libelle": libelle, "roleDeBase": base}
}

func roleIntrouvable() error {
	return socle.Problem(http.StatusNotFound, "ROLE_NOT_FOUND", "Rôle introuvable.")
}

func libellePris() error {
	message := "Un rôle porte déjà ce nom."
	return &socle.ProblemError{
		Status: http.StatusConflict, Code: "ROLE_LIBELLE_PRIS", Message: message,
		Errors: []*huma.ErrorDetail{{Location: "body.libelle", Message: message}},
	}
}

// L'index unique fait foi : deux créations simultanées passeraient la relecture.
func conflitLibelle(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" && pg.ConstraintName == "roles_libelle_key" {
		return libellePris()
	}
	return err
}

func permissionsValides(demandees []string) ([]string, error) {
	for _, p := range demandees {
		if !socle.PermissionConnue(socle.Permission(p)) {
			return nil, &socle.ProblemError{
				Status: http.StatusUnprocessableEntity, Code: "PERMISSION_INCONNUE", Message: "Une permission n’existe plus. Rechargez la page.",
				Errors: []*huma.ErrorDetail{{Location: "body.permissions", Message: "Permission inconnue.", Value: p}},
			}
		}
	}
	valides := slices.Clone(demandees)
	slices.Sort(valides)
	return slices.Compact(valides), nil
}

// Au moins un compte actif garde l'administration des rôles, quel que soit
// le geste qui la retire : permissions d'un rôle, rôle d'un compte, désactivation.
func administrationDesRolesSurvit(ctx context.Context, q *db.Queries) error {
	restants, err := q.CountAdministrateursDesRoles(ctx)
	if err != nil {
		return err
	}
	if restants == 0 {
		return socle.Problem(http.StatusConflict, "DERNIER_ADMINISTRATEUR_DES_ROLES", "Ce compte est le dernier à pouvoir administrer les rôles.")
	}
	return nil
}

func (s *service) ecrireRoles(ctx context.Context, geste func(*db.Queries) error) error {
	if err := s.txAdmin(ctx, func(_ pgx.Tx, q *db.Queries) error {
		if err := q.VerrouAdministrationDesRoles(ctx); err != nil {
			return err
		}
		if err := geste(q); err != nil {
			return err
		}
		return administrationDesRolesSurvit(ctx, q)
	}); err != nil {
		return err
	}
	return s.Attributions.Charger(ctx, s.Q)
}

type CreerRoleInput struct {
	Body struct {
		Libelle     string     `json:"libelle" minLength:"2" maxLength:"60"`
		RoleDeBase  socle.Role `json:"roleDeBase" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
		Permissions *[]string  `json:"permissions,omitempty"`
	}
}

func (s *service) creerRole(ctx context.Context, in *CreerRoleInput) (*RoleOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	libelle := strings.TrimSpace(in.Body.Libelle)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	var cree RoleDTO
	err = s.ecrireRoles(ctx, func(q *db.Queries) error {
		permissions, err := permissionsDuNouveauRole(ctx, q, in.Body.RoleDeBase, in.Body.Permissions)
		if err != nil {
			return err
		}
		if err := q.InsertRole(ctx, db.InsertRoleParams{ID: id.String(), Libelle: libelle, RoleDeBase: db.Role(in.Body.RoleDeBase)}); err != nil {
			return conflitLibelle(err)
		}
		if err := q.InsertRolePermissions(ctx, db.InsertRolePermissionsParams{RoleID: id.String(), Permissions: permissions}); err != nil {
			return err
		}
		if cree, err = roleDTO(ctx, q, id.String()); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "role.create", entiteRole, id.String(), nil, cree)
	})
	if err != nil {
		return nil, err
	}
	return &RoleOutput{Body: cree}, nil
}

// Sans liste, le rôle part des permissions actuelles du rôle système de sa base.
func permissionsDuNouveauRole(ctx context.Context, q *db.Queries, base socle.Role, demandees *[]string) ([]string, error) {
	if demandees != nil {
		return permissionsValides(*demandees)
	}
	return q.RolePermissions(ctx, string(base))
}

type ModifierRoleInput struct {
	ID   string `path:"id"`
	Body struct {
		Libelle    *string     `json:"libelle,omitempty" minLength:"2" maxLength:"60"`
		RoleDeBase *socle.Role `json:"roleDeBase,omitempty" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	}
}

func roleModifiable(ctx context.Context, q *db.Queries, id string) (db.RoleForUpdateRow, error) {
	role, err := q.RoleForUpdate(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return role, roleIntrouvable()
	}
	if err != nil {
		return role, err
	}
	if role.Systeme {
		return role, socle.Problem(http.StatusConflict, "ROLE_SYSTEME", "Un rôle système ne se renomme ni ne se supprime.")
	}
	return role, nil
}

func (s *service) modifierRole(ctx context.Context, in *ModifierRoleInput) (*RoleOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	var modifie RoleDTO
	err := s.ecrireRoles(ctx, func(q *db.Queries) error {
		avant, err := roleModifiable(ctx, q, in.ID)
		if err != nil {
			return err
		}
		if in.Body.RoleDeBase != nil && db.Role(*in.Body.RoleDeBase) != avant.RoleDeBase && avant.Comptes > 0 {
			return socle.Problem(http.StatusConflict, "ROLE_DE_BASE_FIGE", fmt.Sprintf(
				"Ce rôle porte %d compte(s) : son rôle de base ne change plus. Créez un autre rôle et passez-y les comptes.", avant.Comptes))
		}
		var libelle *string
		if in.Body.Libelle != nil {
			propre := strings.TrimSpace(*in.Body.Libelle)
			libelle = &propre
		}
		if err := q.UpdateRole(ctx, db.UpdateRoleParams{ID: in.ID, Libelle: libelle, RoleDeBase: (*db.Role)(in.Body.RoleDeBase)}); err != nil {
			return conflitLibelle(err)
		}
		if modifie, err = roleDTO(ctx, q, in.ID); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "role.update", entiteRole, in.ID,
			traceDuRole(avant.Libelle, avant.RoleDeBase), traceDuRole(modifie.Libelle, db.Role(modifie.RoleDeBase)))
	})
	if err != nil {
		return nil, err
	}
	return &RoleOutput{Body: modifie}, nil
}

type SupprimerRoleInput struct {
	ID string `path:"id"`
}

func (s *service) supprimerRole(ctx context.Context, in *SupprimerRoleInput) (*OkAdminOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	err := s.ecrireRoles(ctx, func(q *db.Queries) error {
		avant, err := roleModifiable(ctx, q, in.ID)
		if err != nil {
			return err
		}
		if avant.Comptes > 0 {
			return socle.Problem(http.StatusConflict, "ROLE_UTILISE", fmt.Sprintf("Retirez d’abord les %d compte(s) de ce rôle.", avant.Comptes))
		}
		if err := q.DeleteRole(ctx, in.ID); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "role.delete", entiteRole, in.ID,
			traceDuRole(avant.Libelle, avant.RoleDeBase), nil)
	})
	if err != nil {
		return nil, err
	}
	return &OkAdminOutput{Body: OkAdmin{Ok: true}}, nil
}

type RemplacerPermissionsInput struct {
	ID   string `path:"id"`
	Body struct {
		Permissions []string `json:"permissions"`
	}
}

func (s *service) remplacerPermissions(ctx context.Context, in *RemplacerPermissionsInput) (*RoleOutput, error) {
	acteur := socle.UtilisateurCourant(ctx)
	permissions, err := permissionsValides(in.Body.Permissions)
	if err != nil {
		return nil, err
	}
	if in.ID == string(socle.Admin) && !contientTout(permissions, permissionsVerrouilleesAdmin) {
		return nil, socle.Problem(http.StatusConflict, "ROLE_ADMIN_VERROUILLE", "Le rôle ADMIN garde l’administration des comptes et des rôles.")
	}
	var apres RoleDTO
	err = s.ecrireRoles(ctx, func(q *db.Queries) error {
		if _, err := q.RoleForUpdate(ctx, in.ID); errors.Is(err, pgx.ErrNoRows) {
			return roleIntrouvable()
		} else if err != nil {
			return err
		}
		avant, err := q.RolePermissions(ctx, in.ID)
		if err != nil {
			return err
		}
		if err := q.DeleteRolePermissions(ctx, in.ID); err != nil {
			return err
		}
		if err := q.InsertRolePermissions(ctx, db.InsertRolePermissionsParams{RoleID: in.ID, Permissions: permissions}); err != nil {
			return err
		}
		if apres, err = roleDTO(ctx, q, in.ID); err != nil {
			return err
		}
		return database.Auditer(ctx, q, acteur.ID, "role.permissions_change", entiteRole, in.ID,
			map[string]any{"permissions": avant}, map[string]any{"permissions": apres.Permissions})
	})
	if err != nil {
		return nil, err
	}
	return &RoleOutput{Body: apres}, nil
}

func contientTout(liste, exigees []string) bool {
	for _, p := range exigees {
		if !slices.Contains(liste, p) {
			return false
		}
	}
	return true
}

// Sans l'administration des rôles, on ne donne ni ne touche un compte dont le
// rôle dépasse ses propres permissions : sinon gérer les comptes suffit à se faire ADMIN.
func (s *service) compteDansSesDroits(ctx context.Context, compteID string, nouveauRole *string) error {
	acteur := socle.UtilisateurCourant(ctx)
	if acteur.Peut(socle.PermissionRolesAdministrer) {
		return nil
	}
	roles := []string{}
	if nouveauRole != nil {
		roles = append(roles, *nouveauRole)
	}
	if compteID != "" {
		existant, err := s.Q.UserRoleForUpdate(ctx, compteID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if err == nil {
			roles = append(roles, existant.RoleId)
		}
	}
	for _, roleID := range roles {
		for p := range s.Attributions.PermissionsDuRole(roleID) {
			if !acteur.Peut(p) {
				return socle.Problem(http.StatusForbidden, "ROLE_HORS_DROITS", "Ce rôle donne des accès que vous n’avez pas.")
			}
		}
	}
	return nil
}

func (s *service) compteSupprimable(ctx context.Context, id string) (db.UserRoleForUpdateRow, error) {
	if err := s.compteDansSesDroits(ctx, id, nil); err != nil {
		return db.UserRoleForUpdateRow{}, err
	}
	return s.Q.UserRoleForUpdate(ctx, id)
}

// Sans rôle demandé, un compte naît téléconseiller.
func (s *service) roleDeCreation(ctx context.Context, roleID *string, role *socle.Role) (base socle.Role, id string, err error) {
	demande, baseDemandee, err := roleDuCompte(ctx, s.Q, roleID, role)
	if err != nil {
		return "", "", err
	}
	base, id = socle.Commercial, string(socle.Commercial)
	if baseDemandee != nil {
		base, id = *baseDemandee, *demande
	}
	if err := s.compteDansSesDroits(ctx, "", &id); err != nil {
		return "", "", err
	}
	return base, id, nil
}

// Un rôle système se lit déjà dans `role` : la trace ne nomme `roleId` que pour un rôle personnalisé.
func traceRole(trace map[string]any, base socle.Role, roleID string) map[string]any {
	if roleID != string(base) {
		trace[cleRoleID] = roleID
	}
	return trace
}

// Le rôle d'un compte se désigne par `roleId` ; `role` seul reste compris et
// vaut le rôle système du même code (contrat v1).
func roleDuCompte(ctx context.Context, q *db.Queries, roleID *string, role *socle.Role) (id *string, base *socle.Role, err error) {
	if roleID == nil && role == nil {
		return nil, nil, nil
	}
	var cible string
	if roleID != nil {
		cible = *roleID
	} else {
		cible = string(*role)
	}
	ligne, err := q.RoleParId(ctx, cible)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, &socle.ProblemError{
			Status: http.StatusUnprocessableEntity, Code: "ROLE_INCONNU", Message: "Ce rôle n’existe pas.",
			Errors: []*huma.ErrorDetail{{Location: "body.roleId", Message: "Rôle inconnu.", Value: cible}},
		}
	}
	if err != nil {
		return nil, nil, err
	}
	roleDeBase := socle.Role(ligne.RoleDeBase)
	return &ligne.ID, &roleDeBase, nil
}
