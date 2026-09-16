package prospects

import (
	"cpi-go/internal/shared/socle"
	"net/http"
)

func prospectReaffecterOwnerAutorise(commercialID *string, portee bool) error {
	if commercialID != nil && !portee {
		return socle.Problem(http.StatusForbidden, "REASSIGN_OWNER_FORBIDDEN", "Seul un administrateur ou un superviseur peut changer le commercial propriétaire.")
	}
	return nil
}
