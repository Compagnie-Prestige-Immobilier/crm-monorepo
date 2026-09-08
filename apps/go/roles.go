package main

type Role string

const (
	RoleAdmin         Role = "ADMIN"
	RoleDirection     Role = "DIRECTION"
	RoleSuperviseur   Role = "SUPERVISEUR"
	RoleTeleconseiller Role = "TELECONSEILLER"
	RoleChargeClient   Role = "CHARGE_CLIENTELE"
	RoleBanqueFinance Role = "BANQUE_FINANCE"
	RoleAccueil       Role = "ACCUEIL"
)

var RouteRoles = map[string][]Role{
	"/api/v1/auth/me":               {RoleAdmin, RoleDirection, RoleSuperviseur, RoleTeleconseiller, RoleChargeClient, RoleBanqueFinance, RoleAccueil},
	"/api/v1/admin/users":           {RoleAdmin},
	"/api/v1/bank-cases/{id}/corrections": {RoleBanqueFinance, RoleAdmin},
	"/api/v1/notification-templates/{id}/render": {RoleAdmin, RoleSuperviseur},
}

func HasAccess(role Role, path string) bool {
	allowed, ok := RouteRoles[path]
	if !ok {
		return false
	}
	for _, r := range allowed {
		if r == role {
			return true
		}
	}
	return false
}
