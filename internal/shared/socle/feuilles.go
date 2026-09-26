package socle

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var MoisEnLettres = [...]string{
	"janvier", "février", "mars", "avril", "mai", "juin",
	"juillet", "août", "septembre", "octobre", "novembre", "décembre",
}

var (
	dateDansLeNomDeFeuille = regexp.MustCompile(`(?i)(\d{1,2})(?:er)?\s+([a-z]{3,10})\.?(?:\s+(\d{2,4}))?`)
	plieurAccentsFeuille   = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
)

// Abréviations à trois lettres, sans accent. Juin et juillet ne se distinguent
// qu'à la quatrième lettre : leurs deux entrées à quatre lettres sont
// vérifiées avant celle à trois qui les confondrait.
var abreviationsMoisFeuille = []struct {
	prefixe string
	mois    time.Month
}{
	{"juin", time.June},
	{"juil", time.July},
	{"jan", time.January},
	{"fev", time.February},
	{"mar", time.March},
	{"avr", time.April},
	{"mai", time.May},
	{"jui", time.July},
	{"aou", time.August},
	{"sep", time.September},
	{"oct", time.October},
	{"nov", time.November},
	{"dec", time.December},
}

// « DEBUT CAMPAGNE 10 SEPT 26 », « Leads 12 sept », « Leads 1er oct 2026 » : le
// jour de l'onglet, à minuit UTC. Sans année, celle de `maintenant`, reculée
// d'un an si la date tombe dans le futur (l'onglet ne porte pas l'année).
// Faux sans date lisible.
func DateDuNomDeFeuille(nom string, maintenant time.Time) (time.Time, bool) {
	plat, _, err := transform.String(plieurAccentsFeuille, strings.ToLower(strings.TrimSpace(nom)))
	if err != nil {
		return time.Time{}, false
	}
	trouve := dateDansLeNomDeFeuille.FindStringSubmatch(plat)
	if trouve == nil {
		return time.Time{}, false
	}
	jour, _ := strconv.Atoi(trouve[1])
	mois := moisDuPrefixe(trouve[2])
	if mois == 0 {
		return time.Time{}, false
	}
	avecAnnee := trouve[3] != ""
	annee := maintenant.Year()
	if avecAnnee {
		annee, _ = strconv.Atoi(trouve[3])
		if annee < 100 {
			annee += 2000
		}
	}
	date := time.Date(annee, mois, jour, 0, 0, 0, 0, time.UTC)
	if date.Day() != jour || date.Month() != mois {
		return time.Time{}, false
	}
	if !avecAnnee && date.After(maintenant) {
		date = date.AddDate(-1, 0, 0)
	}
	return date, true
}

// « septembre » se reconnaît à « sept », « juin » et « juillet » à leurs
// abréviations propres.
func moisDuPrefixe(brut string) time.Month {
	for _, a := range abreviationsMoisFeuille {
		if strings.HasPrefix(brut, a.prefixe) {
			return a.mois
		}
	}
	return 0
}
