package imports

import (
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"fmt"
	"strings"
	"time"
)

// Le classeur des leads du marketing (docs/decisions/import-leads.md) : le canal
// décide du projet et de la marque plateforme, l'onglet de la date.

// Le canal décide du projet et de la marque plateforme, l'onglet de la date :
// ce qui a dû être deviné ou corrigé se signale sans refuser la ligne.
func provenanceEtDateGrandPublicImport(ligne *ligneGrandPublicImport, cellules map[string]string, etat *etatGrandPublicImport) {
	canal := cellules[enteteGrandPublicImport(8)]
	provenance := provenanceGrandPublicImport(canal, cellules[enteteGrandPublicImport(23)], etat)
	ligne.canalID, ligne.projet = provenance.canalID, provenance.projet
	if !provenance.sure {
		ligne.avertissements = append(ligne.avertissements, *refusImport(ligne.numero, enteteGrandPublicImport(8), codeCanalAVerifierImport,
			fmt.Sprintf("Canal « %s » non reconnu : la fiche reste Grand Public, vérifiez le projet.", canal)))
	}
	var correction *erreurLigneImport
	ligne.creeLe, correction = dateLeadImport(cellules[enteteGrandPublicImport(21)], cellules[feuilleImport], ligne.numero, time.Now())
	if correction != nil {
		ligne.avertissements = append(ligne.avertissements, *correction)
	}
	ligne.plateforme = plateformeGrandPublicImport(canal)
}

// Le canal nomme le réseau, la règle nomme la campagne : elle seule sait à quel
// projet le prospect répondait, et passe avant le libellé exact d'un canal.
// Sans l'une ni l'autre, le canal est deviné et le projet reste à vérifier.
func provenanceGrandPublicImport(canal, provenance string, etat *etatGrandPublicImport) provenanceImport {
	cle := cleImport(canal)
	if cle != "" {
		for i := range etat.regles {
			if etat.regles[i].motif != "" && strings.Contains(cle, etat.regles[i].motif) {
				return provenanceImport{canalID: &etat.regles[i].canalID, projet: etat.regles[i].projet, sure: true}
			}
		}
		if identifiant, connu := etat.canaux[cle]; connu {
			return provenanceImport{canalID: &identifiant, projet: db.ProjetGRANDPUBLIC, sure: true}
		}
	}
	for _, candidate := range []string{cle, cleImport(provenance)} {
		if identifiant := canalDevineGrandPublic(candidate, etat); identifiant != nil {
			return provenanceImport{canalID: identifiant, projet: db.ProjetGRANDPUBLIC}
		}
	}
	return provenanceImport{projet: db.ProjetGRANDPUBLIC}
}

func canalDevineGrandPublic(cle string, etat *etatGrandPublicImport) *string {
	if cle == "" {
		return nil
	}
	if identifiant := canalParKeywordGrandPublic(cle, etat); identifiant != nil {
		return identifiant
	}
	return canalParFamilleGrandPublic(cle, etat)
}

func plateformeGrandPublicImport(canal string) bool {
	return contientUnDe(cleImport(canal), hotesPlateformeImport)
}

func canalParKeywordGrandPublic(cle string, etat *etatGrandPublicImport) *string {
	for _, cCle := range etat.clesCanaux {
		if strings.Contains(cle, cCle) || strings.Contains(cCle, cle) {
			identifiant := etat.canaux[cCle]
			return &identifiant
		}
	}
	return nil
}

func canalContenantGrandPublic(mot string, etat *etatGrandPublicImport) *string {
	for _, cCle := range etat.clesCanaux {
		if strings.Contains(cCle, mot) {
			identifiant := etat.canaux[cCle]
			return &identifiant
		}
	}
	return nil
}

const (
	familleGoogleImport = "google"
	familleMetaImport   = "meta"
	familleSiteImport   = "site"
)

func contientUnDe(cle string, mots []string) bool {
	for _, m := range mots {
		if strings.Contains(cle, m) {
			return true
		}
	}
	return false
}

func cibleFamilleGrandPublic(cle string) string {
	if contientUnDe(cle, []string{familleGoogleImport, "goog", "gads", "search"}) {
		return familleGoogleImport
	}
	if contientUnDe(cle, []string{"fb", "facebook", "ig", "instagram", familleMetaImport, "pay", "ad", "pub", "sponsor"}) {
		return familleMetaImport
	}
	if contientUnDe(cle, []string{"organique", familleSiteImport, "web", "page", "adhesion", "direct", "inconnu"}) {
		return familleSiteImport
	}
	return ""
}

func canalParFamilleGrandPublic(cle string, etat *etatGrandPublicImport) *string {
	cible := cibleFamilleGrandPublic(cle)
	if cible == "" {
		return nil
	}
	if identifiant := canalContenantGrandPublic(cible, etat); identifiant != nil {
		return identifiant
	}
	if cible != familleGoogleImport {
		return nil
	}
	for _, famille := range []string{familleMetaImport, familleSiteImport} {
		if identifiant := canalContenantGrandPublic(famille, etat); identifiant != nil {
			return identifiant
		}
	}
	return nil
}

type dateLueImport struct {
	brut    string
	lue     time.Time
	lisible bool
}

// Les exports Meta datent au rang Excel ou en américain 12 heures, les autres
// en jour/mois/année : les parseurs se relaient sur la même colonne, sans juger.
func lireDateBruteLeadImport(brut string) dateLueImport {
	texte := strings.TrimSpace(brut)
	if date, ok := dateRangExcelImport(texte); ok {
		return dateLueImport{brut: texte, lue: date, lisible: true}
	}
	if date, ok := lireJourMoisAnImport(texte); ok {
		return dateLueImport{brut: texte, lue: date, lisible: true}
	}
	for _, format := range formatsCreeLeImport {
		if quand, err := time.ParseInLocation(format, texte, time.UTC); err == nil {
			return dateLueImport{brut: texte, lue: quand, lisible: true}
		}
	}
	return dateLueImport{brut: texte}
}

func jourDeLaFeuilleImport(feuille string, maintenant time.Time) (time.Time, bool) {
	jour, ok := socle.DateDuNomDeFeuille(feuille, maintenant)
	if !ok {
		return time.Time{}, false
	}
	return jour, true
}

func echangerJourMoisImport(t time.Time) time.Time {
	if t.Day() > 12 {
		return t
	}
	return time.Date(t.Year(), time.Month(t.Day()), int(t.Month()), t.Hour(), t.Minute(), t.Second(), 0, time.UTC)
}

func memeJourImport(a, b time.Time) bool { return a.Year() == b.Year() && a.YearDay() == b.YearDay() }

// Le jour de l'onglet fait foi, même à venir : Excel a rangé « 11/09/2026 » au
// 9 novembre, et l'onglet peut être relevé avant le jour qu'il annonce.
func dateLeadImport(brut, feuille string, numero int, maintenant time.Time) (time.Time, *erreurLigneImport) {
	date := lireDateBruteLeadImport(brut)
	if jour, ok := jourDeLaFeuilleImport(feuille, maintenant); ok {
		return dateAvecJourFeuilleImport(date, jour, numero)
	}
	return dateSansJourFeuilleImport(date, maintenant, numero)
}

func dateAvecJourFeuilleImport(date dateLueImport, jour time.Time, numero int) (time.Time, *erreurLigneImport) {
	inversee := echangerJourMoisImport(date.lue)
	switch {
	case date.lisible && memeJourImport(date.lue, jour):
		return date.lue, nil
	case date.lisible && memeJourImport(inversee, jour):
		return inversee, refusImport(numero, enteteCreeLeImport, codeDateCorrigeeImport,
			fmt.Sprintf("« %s » lu jour et mois inversés : la fiche prend le %s.", date.brut, jour.Format("02/01/2006")))
	case date.lisible && !date.lue.After(jour):
		return date.lue, nil
	case date.brut == "":
		return jour, nil
	}
	return jour, refusImport(numero, enteteCreeLeImport, codeDateCorrigeeImport,
		fmt.Sprintf("« %s » est à venir ou illisible : la fiche prend la date de l’onglet, %s.", date.brut, jour.Format("02/01/2006")))
}

func dateSansJourFeuilleImport(date dateLueImport, maintenant time.Time, numero int) (time.Time, *erreurLigneImport) {
	switch {
	case date.lisible && !date.lue.After(maintenant):
		return date.lue, nil
	case date.brut == "":
		return maintenant, nil
	}
	return maintenant, refusImport(numero, enteteCreeLeImport, codeDateCorrigeeImport,
		fmt.Sprintf("« %s » est à venir ou illisible : la fiche prend l’heure du relevé.", date.brut))
}
