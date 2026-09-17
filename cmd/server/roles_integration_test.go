//go:build integration

package main

import (
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Routes ajoutées après le gel du 16 septembre : l'écran des rôles.
var routesDesRoles = map[string][]socle.Role{
	"GET /api/v1/roles":                  {socle.Admin},
	"POST /api/v1/roles":                 {socle.Admin},
	"PATCH /api/v1/roles/{id}":           {socle.Admin},
	"DELETE /api/v1/roles/{id}":          {socle.Admin},
	"PUT /api/v1/roles/{id}/permissions": {socle.Admin},
}

func TestMatriceRolesInchangee(t *testing.T) {
	var attendu map[string][]socle.Role
	contenu, err := os.ReadFile("testdata/matrice-roles-2026-09-16.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(contenu, &attendu); err != nil {
		t.Fatal(err)
	}
	for route, roles := range routesDesRoles {
		attendu[route] = roles
	}

	cfg, err := socle.LireConfig()
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := serveur(cfg, nil); err != nil {
		t.Fatal(err)
	}

	obtenu := map[string][]socle.Role{}
	for route, permission := range socle.Garde {
		roles := socle.RolesAutorises(permission)
		slices.Sort(roles)
		obtenu[route] = roles
	}

	if len(obtenu) != len(attendu) {
		t.Fatalf("nombre de routes: obtenu %d, attendu %d", len(obtenu), len(attendu))
	}
	for route, rolesAttendus := range attendu {
		rolesObtenus, ok := obtenu[route]
		if !ok {
			t.Fatalf("route absente: %s", route)
		}
		slices.Sort(rolesAttendus)
		if !slices.Equal(rolesObtenus, rolesAttendus) {
			t.Fatalf("%s: obtenu %v, attendu %v", route, rolesObtenus, rolesAttendus)
		}
	}
}

func TestCatalogueSansPermissionMorte(t *testing.T) {
	cfg, err := socle.LireConfig()
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := serveur(cfg, nil); err != nil {
		t.Fatal(err)
	}
}

// Le panneau tape ses permissions sur une liste recopiée : elle ne doit ni manquer ni inventer.
func TestPermissionsDuPanneauEgalesAuCatalogue(t *testing.T) {
	source, err := os.ReadFile("../../web/src/lib/types.ts")
	if err != nil {
		t.Fatal(err)
	}
	bloc := strings.SplitN(strings.SplitN(string(source), "export const PERMISSIONS = [", 2)[1], "] as const", 2)[0]
	panneau := []string{}
	for _, ligne := range strings.Split(bloc, "\n") {
		if p := strings.Trim(strings.TrimSpace(ligne), "',"); p != "" {
			panneau = append(panneau, p)
		}
	}
	catalogue := make([]string, 0, len(socle.Catalogue))
	for p := range socle.Catalogue {
		catalogue = append(catalogue, string(p))
	}
	slices.Sort(catalogue)
	slices.Sort(panneau)
	if !slices.Equal(panneau, catalogue) {
		t.Fatalf("panneau %v\ncatalogue %v", panneau, catalogue)
	}
}

func permissionsEnBase(b *banc, roleID string) []string {
	b.t.Helper()
	rows, err := b.pool.Query(b.ctx, `SELECT "permission" FROM "role_permissions" WHERE "roleId" = $1 ORDER BY "permission"`, roleID)
	if err != nil {
		b.t.Fatal(err)
	}
	defer rows.Close()
	permissions := []string{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			b.t.Fatal(err)
		}
		permissions = append(permissions, p)
	}
	return permissions
}

func permissionsParDefaut(role socle.Role) []string {
	permissions := make([]string, 0, len(socle.AttributionsParDefaut()[role]))
	for p := range socle.AttributionsParDefaut()[role] {
		permissions = append(permissions, string(p))
	}
	slices.Sort(permissions)
	return permissions
}

func sans(permissions []string, retiree socle.Permission) []string {
	return slices.DeleteFunc(slices.Clone(permissions), func(p string) bool { return p == string(retiree) })
}

// La table est remise à l'état semé, que le test ait fini ou non.
func retablirPermissions(b *banc, role socle.Role) {
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "role_permissions" WHERE "roleId" = $1`, string(role))
		_, _ = b.pool.Exec(b.ctx, `INSERT INTO "role_permissions" ("roleId","permission") SELECT $1, unnest($2::text[])`,
			string(role), permissionsParDefaut(role))
	})
}

func creerRolePersonnalise(b *banc, libelle string, base socle.Role, permissions []string) string {
	b.t.Helper()
	statut, body := adminAppel(b, http.MethodPost, "/api/v1/roles",
		map[string]any{"libelle": libelle, "roleDeBase": base, "permissions": permissions})
	b.attend(statut, http.StatusCreated, "création du rôle "+libelle, body)
	id := texteDe(body["id"])
	b.t.Cleanup(func() {
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "roleId" = $1`, id)
		_, _ = b.pool.Exec(b.ctx, `DELETE FROM "roles" WHERE "id" = $1`, id)
	})
	return id
}

func compteDuRole(b *banc, roleID string) (id, email string) {
	b.t.Helper()
	suffixe := uuid.NewString()[:8]
	email = "role-" + suffixe + "@cpi.sn"
	statut, body := adminAppel(b, http.MethodPost, "/api/v1/users", map[string]any{
		"email": email, "username": "role-" + suffixe, "fullName": "Compte " + suffixe,
		"password": "motdepasse", "roleId": roleID,
	})
	b.attend(statut, http.StatusCreated, "compte au rôle "+roleID, body)
	id = texteDe(body["id"])
	b.t.Cleanup(func() { _, _ = b.pool.Exec(b.ctx, `DELETE FROM "users" WHERE "id" = $1`, id) })
	return id, email
}

func compterAuditsDuRole(b *banc, roleID string) int {
	b.t.Helper()
	var n int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "audit_logs" WHERE "entity" = 'role' AND "entityId" = $1`, roleID).Scan(&n); err != nil {
		b.t.Fatal(err)
	}
	return n
}

func TestPermissionsSemeesIdentiquesAuCatalogue(t *testing.T) {
	b := nouveauBanc(t, "ADMIN")
	for role := range socle.AttributionsParDefaut() {
		if semees, attendues := permissionsEnBase(b, string(role)), permissionsParDefaut(role); !slices.Equal(semees, attendues) {
			t.Fatalf("%s : semé %v, catalogue %v", role, semees, attendues)
		}
	}
	var roles int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "roles" WHERE "systeme"`).Scan(&roles); err != nil {
		t.Fatal(err)
	}
	if roles != len(socle.AttributionsParDefaut()) {
		t.Fatalf("%d rôles système en base", roles)
	}
}

func TestRoleAdminVerrouilleEtPermissionInconnue(t *testing.T) {
	b := adminConnecte(t)
	avant, audits := permissionsEnBase(b, "ADMIN"), compterAuditsDuRole(b, "ADMIN")

	statut, body := adminAppel(b, http.MethodPut, "/api/v1/roles/ADMIN/permissions",
		map[string]any{"permissions": sans(avant, socle.PermissionRolesAdministrer)})
	b.attend(statut, http.StatusConflict, "ADMIN sans administration des rôles", body)
	if body["code"] != "ROLE_ADMIN_VERROUILLE" {
		t.Fatalf("code : %v", body["code"])
	}
	statut, body = adminAppel(b, http.MethodPut, "/api/v1/roles/SUPERVISEUR/permissions",
		map[string]any{"permissions": []string{"panneau.acceder", "inconnue.permission"}})
	b.attend(statut, http.StatusUnprocessableEntity, "permission hors catalogue", body)
	if body["code"] != "PERMISSION_INCONNUE" {
		t.Fatalf("code : %v", body["code"])
	}
	if !slices.Equal(permissionsEnBase(b, "ADMIN"), avant) || !slices.Equal(permissionsEnBase(b, "SUPERVISEUR"), permissionsParDefaut(socle.Superviseur)) {
		t.Fatal("un refus ne doit rien écrire")
	}
	if compterAuditsDuRole(b, "ADMIN") != audits {
		t.Fatal("un refus ne laisse pas de trace")
	}
}

func TestChangementDePermissionImmediatEtAudite(t *testing.T) {
	b := adminConnecte(t)
	_, email := adminCompte(b, "SUPERVISEUR")
	superviseur := adminSession(b, email)
	retablirPermissions(b, socle.Superviseur)
	defauts := permissionsParDefaut(socle.Superviseur)

	statut, body := adminAppel(superviseur, http.MethodPost, "/api/v1/lots-export", map[string]any{})
	if statut == http.StatusForbidden {
		t.Fatalf("le superviseur crée des campagnes avant le changement : %v", body)
	}
	statut, body = adminAppel(b, http.MethodPut, "/api/v1/roles/SUPERVISEUR/permissions",
		map[string]any{"permissions": sans(defauts, socle.PermissionCampagnesGerer)})
	b.attend(statut, http.StatusOK, "retrait de campagnes.gerer", body)

	statut, body = adminAppel(superviseur, http.MethodPost, "/api/v1/lots-export", map[string]any{})
	superviseur.attend(statut, http.StatusForbidden, "création de campagne sans la permission, même session", body)
	statut, body = adminAppel(superviseur, http.MethodGet, "/api/v1/lots-export", nil)
	superviseur.attend(statut, http.StatusOK, "lecture des campagnes gardée", body)

	var avant, apres []string
	var brutAvant, brutApres []byte
	if err := b.pool.QueryRow(b.ctx, `SELECT "before", "after" FROM "audit_logs" WHERE "action" = 'role.permissions_change'
		AND "entityId" = 'SUPERVISEUR' AND "userId" = $1 ORDER BY "at" DESC LIMIT 1`, b.userID).Scan(&brutAvant, &brutApres); err != nil {
		t.Fatal(err)
	}
	var traceAvant, traceApres map[string][]string
	if json.Unmarshal(brutAvant, &traceAvant) != nil || json.Unmarshal(brutApres, &traceApres) != nil {
		t.Fatalf("trace illisible : %s / %s", brutAvant, brutApres)
	}
	avant, apres = traceAvant["permissions"], traceApres["permissions"]
	if !slices.Equal(avant, defauts) || !slices.Equal(apres, sans(defauts, socle.PermissionCampagnesGerer)) {
		t.Fatalf("trace : avant %v, après %v", avant, apres)
	}

	statut, body = adminAppel(b, http.MethodPut, "/api/v1/roles/SUPERVISEUR/permissions", map[string]any{"permissions": defauts})
	b.attend(statut, http.StatusOK, "rétablissement", body)
	statut, body = adminAppel(superviseur, http.MethodPost, "/api/v1/lots-export", map[string]any{})
	if statut == http.StatusForbidden {
		t.Fatalf("la permission rétablie vaut dès la requête suivante : %v", body)
	}
}

func TestRolePersonnaliseSuitSaBasePourLesDonnees(t *testing.T) {
	b := adminConnecte(t)
	libelle := "Chef d'équipe " + uuid.NewString()[:8]
	roleID := creerRolePersonnalise(b, libelle, socle.Superviseur, sans(permissionsParDefaut(socle.Superviseur), socle.PermissionCampagnesGerer))
	compteID, email := compteDuRole(b, roleID)
	chef := adminSession(b, email)

	statut, body := adminAppel(chef, http.MethodGet, "/api/v1/auth/me", nil)
	chef.attend(statut, http.StatusOK, "session du chef d'équipe", body)
	permissions, _ := body["permissions"].([]any)
	if body["role"] != "SUPERVISEUR" || body["roleId"] != roleID || body["roleLibelle"] != libelle ||
		slices.Contains(permissions, any(string(socle.PermissionCampagnesGerer))) || !slices.Contains(permissions, any(string(socle.PermissionCampagnesSuperviser))) {
		t.Fatalf("session : %v", body)
	}
	statut, body = adminAppel(chef, http.MethodPost, "/api/v1/lots-export", map[string]any{})
	chef.attend(statut, http.StatusForbidden, "la permission suit le rôle", body)
	statut, body = adminAppel(chef, http.MethodGet, "/api/v1/lots-export", nil)
	chef.attend(statut, http.StatusOK, "lecture des campagnes", body)

	var superviseur bool
	if err := b.pool.QueryRow(b.ctx, `SELECT EXISTS (SELECT 1 FROM "users" WHERE "id" = $1 AND "role" = 'SUPERVISEUR' AND "isActive")`, compteID).Scan(&superviseur); err != nil {
		t.Fatal(err)
	}
	if !superviseur {
		t.Fatal("la donnée suit la base : le compte compte parmi les superviseurs actifs")
	}
	statut, body = adminAppel(b, http.MethodGet, "/api/v1/users/"+compteID, nil)
	b.attend(statut, http.StatusOK, "fiche du compte", body)
	if body["roleId"] != roleID || body["roleLibelle"] != libelle || body["role"] != "SUPERVISEUR" {
		t.Fatalf("compte : %v", body)
	}
}

func TestRoleEtRoleDeBaseNeDivergentJamais(t *testing.T) {
	b := adminConnecte(t)
	roleID := creerRolePersonnalise(b, "Accueil étendu "+uuid.NewString()[:8], socle.Accueil, nil)
	compteID, _ := compteDuRole(b, roleID)

	statut, body := adminAppel(b, http.MethodPatch, "/api/v1/users/"+compteID, map[string]any{"role": "DIRECTION"})
	b.attend(statut, http.StatusOK, "rôle système par l'ancien champ", body)
	if body["roleId"] != "DIRECTION" || body["role"] != "DIRECTION" {
		t.Fatalf("role seul vaut le rôle système du même code : %v", body)
	}
	statut, body = adminAppel(b, http.MethodPatch, "/api/v1/users/"+compteID, map[string]any{"roleId": roleID})
	b.attend(statut, http.StatusOK, "retour au rôle personnalisé", body)
	if body["role"] != "ACCUEIL" {
		t.Fatalf("role suit la base : %v", body)
	}
	adminExec(b, `UPDATE "users" SET "role" = 'COMMERCIAL' WHERE "id" = $1`, compteID)
	statut, body = adminAppel(b, http.MethodPatch, "/api/v1/users/"+compteID, map[string]any{"roleId": "inexistant"})
	b.attend(statut, http.StatusUnprocessableEntity, "rôle inconnu", body)

	var ecarts int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "users" u JOIN "roles" r ON r."id" = u."roleId" WHERE u."role" <> r."roleDeBase"`).Scan(&ecarts); err != nil {
		t.Fatal(err)
	}
	if ecarts != 0 {
		t.Fatalf("%d comptes dont role diverge du rôle de base", ecarts)
	}
}

func TestGererLesComptesNeFaitPasDADMIN(t *testing.T) {
	b := adminConnecte(t)
	roleID := creerRolePersonnalise(b, "Gestion des comptes "+uuid.NewString()[:8], socle.Admin,
		[]string{string(socle.PermissionPanneauAcceder), string(socle.PermissionComptesAdministrer)})
	gestionnaireID, email := compteDuRole(b, roleID)
	gestionnaire := adminSession(b, email)
	suffixe := uuid.NewString()[:8]
	nouveauAdmin := map[string]any{
		"email": "escalade-" + suffixe + "@cpi.sn", "username": "escalade-" + suffixe,
		"fullName": "Escalade", "password": "motdepasse", "role": "ADMIN",
	}

	refus := []struct {
		methode, chemin string
		corps           any
	}{
		{http.MethodPatch, "/api/v1/users/" + gestionnaireID, map[string]any{"roleId": "ADMIN"}},
		{http.MethodPost, "/api/v1/users", nouveauAdmin},
		{http.MethodPut, "/api/v1/users/" + b.userID + "/password", map[string]any{"password": "motdepasse2"}},
		{http.MethodDelete, "/api/v1/users/" + b.userID, nil},
	}
	for _, r := range refus {
		statut, body := adminAppel(gestionnaire, r.methode, r.chemin, r.corps)
		gestionnaire.attend(statut, http.StatusForbidden, r.methode+" "+r.chemin, body)
		if body["code"] != "ROLE_HORS_DROITS" {
			t.Fatalf("%s %s : code %v", r.methode, r.chemin, body["code"])
		}
	}
	var role string
	if err := b.pool.QueryRow(b.ctx, `SELECT "roleId" FROM "users" WHERE "id" = $1`, gestionnaireID).Scan(&role); err != nil {
		t.Fatal(err)
	}
	if role != roleID {
		t.Fatalf("le gestionnaire s'est donné le rôle %s", role)
	}
}

func TestRoleUtiliseSystemeEtLibelle(t *testing.T) {
	b := adminConnecte(t)
	libelle := "Chef de plateau " + uuid.NewString()[:8]
	roleID := creerRolePersonnalise(b, libelle, socle.Superviseur, nil)
	if !slices.Equal(permissionsEnBase(b, roleID), permissionsEnBase(b, "SUPERVISEUR")) {
		t.Fatal("sans liste, le rôle part des permissions de sa base")
	}
	compteDuRole(b, roleID)
	audits := compterAuditsDuRole(b, roleID)

	refus := []struct {
		methode, chemin string
		corps           any
		code            string
	}{
		{http.MethodDelete, "/api/v1/roles/" + roleID, nil, "ROLE_UTILISE"},
		{http.MethodPatch, "/api/v1/roles/" + roleID, map[string]any{"roleDeBase": "COMMERCIAL"}, "ROLE_DE_BASE_FIGE"},
		{http.MethodPatch, "/api/v1/roles/SUPERVISEUR", map[string]any{"libelle": "Autre"}, "ROLE_SYSTEME"},
		{http.MethodDelete, "/api/v1/roles/SUPERVISEUR", nil, "ROLE_SYSTEME"},
		{http.MethodPost, "/api/v1/roles", map[string]any{"libelle": "  " + strings.ToLower(libelle), "roleDeBase": "ACCUEIL"}, "ROLE_LIBELLE_PRIS"},
	}
	for _, r := range refus {
		statut, body := adminAppel(b, r.methode, r.chemin, r.corps)
		b.attend(statut, http.StatusConflict, r.methode+" "+r.chemin, body)
		if body["code"] != r.code {
			t.Fatalf("%s %s : code %v, attendu %s", r.methode, r.chemin, body["code"], r.code)
		}
	}
	var base string
	if err := b.pool.QueryRow(b.ctx, `SELECT "roleDeBase"::text FROM "roles" WHERE "id" = $1`, roleID).Scan(&base); err != nil {
		t.Fatal(err)
	}
	if base != "SUPERVISEUR" || compterAuditsDuRole(b, roleID) != audits {
		t.Fatalf("un refus n'écrit rien : base %s", base)
	}

	statut, body := adminAppel(b, http.MethodPatch, "/api/v1/roles/"+roleID, map[string]any{"libelle": libelle + " renommé"})
	b.attend(statut, http.StatusOK, "renommage", body)
}

// Deux comptes seuls à administrer les rôles. Une écriture concurrente, qui
// suit le même verrou, retire la permission au premier sans avoir validé ; le
// second la retire à son propre rôle : il doit attendre, relire, et être refusé.
func TestDernierAdministrateurDesRoles(t *testing.T) {
	b := adminConnecte(t)
	complet := permissionsParDefaut(socle.Admin)
	roleUn := creerRolePersonnalise(b, "Admin un "+uuid.NewString()[:8], socle.Admin, complet)
	roleDeux := creerRolePersonnalise(b, "Admin deux "+uuid.NewString()[:8], socle.Admin, complet)
	unID, _ := compteDuRole(b, roleUn)
	deuxID, deuxEmail := compteDuRole(b, roleDeux)
	deux := adminSession(b, deuxEmail)
	adminIsolerAdmins(b, unID, deuxID)

	concurrente, err := b.pool.Begin(b.ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = concurrente.Rollback(b.ctx) }()
	for _, requete := range []string{
		`SELECT pg_advisory_xact_lock(hashtext('roles.administrer'))`,
		`DELETE FROM "role_permissions" WHERE "roleId" = '` + roleUn + `' AND "permission" = 'roles.administrer'`,
	} {
		if _, err := concurrente.Exec(b.ctx, requete); err != nil {
			t.Fatal(err)
		}
	}

	statut := make(chan int, 1)
	go func() {
		s, _ := adminAppel(deux, http.MethodPut, "/api/v1/roles/"+roleDeux+"/permissions",
			map[string]any{"permissions": sans(complet, socle.PermissionRolesAdministrer)})
		statut <- s
	}()
	select {
	case s := <-statut:
		t.Fatalf("le retrait n'attend pas l'écriture concurrente : %d", s)
	case <-time.After(300 * time.Millisecond):
	}
	if err := concurrente.Commit(b.ctx); err != nil {
		t.Fatal(err)
	}
	if s := <-statut; s != http.StatusConflict {
		t.Fatalf("second retrait : %d, 409 attendu", s)
	}
	var restants int
	if err := b.pool.QueryRow(b.ctx, `SELECT count(*)::int FROM "users" u JOIN "role_permissions" rp ON rp."roleId" = u."roleId"
		AND rp."permission" = 'roles.administrer' WHERE u."isActive" AND u."deletedAt" IS NULL`).Scan(&restants); err != nil {
		t.Fatal(err)
	}
	if restants != 1 {
		t.Fatalf("%d administrateurs des rôles restants, 1 attendu", restants)
	}
}
