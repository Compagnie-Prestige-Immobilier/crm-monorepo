//go:build integration

package main

import (
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"os"
	"slices"
	"testing"
)

func TestMatriceRolesInchangee(t *testing.T) {
	var attendu map[string][]socle.Role
	contenu, err := os.ReadFile("testdata/matrice-roles-2026-09-16.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(contenu, &attendu); err != nil {
		t.Fatal(err)
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
	for route := range obtenu {
		if _, ok := attendu[route]; !ok {
			t.Fatalf("route en trop: %s", route)
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
