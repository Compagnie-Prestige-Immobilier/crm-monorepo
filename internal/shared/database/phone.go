package database

import (
	"cpi-go/internal/shared/socle"
	"net/http"
	"regexp"
	"strings"

	"github.com/nyaruka/phonenumbers"
)

// Clé de déduplication de Representant et Prospect, adossée à un index unique
// partiel : même canonisation que common/phone.ts, sinon la base existante
// devient incohérente.
var (
	separateursTelephone = regexp.MustCompile(`[\s.\-()‐‑‒–—―/]`)
	indicatifsRegion     = map[string]string{"SN": "221", "ML": "223", "CI": "225", "GN": "224", "MR": "222", "GM": "220", "BF": "226", "FR": "33"}
)

func canoniserPrefixe(brut, region string) string {
	compact := separateursTelephone.ReplaceAllString(brut, "")
	if strings.HasPrefix(compact, "+") {
		return compact
	}
	if strings.HasPrefix(compact, "00") {
		return "+" + compact[2:]
	}
	if indicatif := indicatifsRegion[region]; indicatif != "" && strings.HasPrefix(compact, indicatif) && len(compact)-len(indicatif) >= 8 {
		return "+" + compact
	}
	return compact
}

func telephoneInvalide(brut string) *socle.ProblemError {
	if strings.TrimSpace(brut) == "" {
		return socle.Problem(http.StatusBadRequest, "PHONE_INVALID", "Le numéro de téléphone est obligatoire.")
	}
	return socle.Problem(http.StatusBadRequest, "PHONE_INVALID", "Numéro de téléphone invalide : "+brut)
}

func NormaliserTelephone(brut, region string) (string, error) {
	if strings.TrimSpace(brut) == "" {
		return "", telephoneInvalide(brut)
	}
	num, err := phonenumbers.Parse(canoniserPrefixe(brut, region), region)
	if err != nil || !phonenumbers.IsValidNumber(num) {
		return "", telephoneInvalide(brut)
	}
	return phonenumbers.Format(num, phonenumbers.E164), nil
}

func TelephoneOptionnel(brut *string, region string) *string {
	if brut == nil {
		return nil
	}
	e164, err := NormaliserTelephone(*brut, region)
	if err != nil {
		return nil
	}
	return &e164
}
