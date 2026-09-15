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
	dateDansLeNomDeFeuille = regexp.MustCompile(`(?i)(\d{1,2})\s+([a-z]{3,10})\.?(?:\s+(\d{2,4}))?`)
	plieurAccentsFeuille   = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
)

// « DEBUT CAMPAGNE 10 SEPT 26 », « Leads 12 sept » : le jour de l'onglet, à
// minuit UTC. Sans année, celle de `maintenant`. Faux sans date lisible.
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
	annee := maintenant.Year()
	if trouve[3] != "" {
		annee, _ = strconv.Atoi(trouve[3])
	}
	if annee < 100 {
		annee += 2000
	}
	mois := moisDuPrefixe(trouve[2])
	if mois == 0 {
		return time.Time{}, false
	}
	date := time.Date(annee, mois, jour, 0, 0, 0, 0, time.UTC)
	if date.Day() != jour || date.Month() != mois {
		return time.Time{}, false
	}
	return date, true
}

// « septembre » se reconnaît à « sept », « mai » n'a que trois lettres.
func moisDuPrefixe(brut string) time.Month {
	for i, mois := range MoisEnLettres {
		plat, _, err := transform.String(plieurAccentsFeuille, mois)
		if err != nil {
			plat = mois
		}
		if strings.HasPrefix(brut, plat[:min(4, len(plat))]) {
			return time.Month(i + 1)
		}
	}
	return 0
}
