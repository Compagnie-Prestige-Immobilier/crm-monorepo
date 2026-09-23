package prospects

import "cpi-go/db"

// « TOUT » régroupe les onglets Intéressés, Hésitants et Rendez-vous : ce
// n'est pas une valeur de l'énumération stockée, la requête la traite à part.
const prospectPhase2StatusTout = "TOUT"

func prospectPhase2StatusFiltre(v string) *db.Phase2Status {
	if v == "" || v == prospectPhase2StatusTout {
		return nil
	}
	return prospectPtr(db.Phase2Status(v))
}
