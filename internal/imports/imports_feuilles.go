package imports

import "strings"

// Un onglet par jour, relu en entier à chaque relevé : sans ce compte par onglet,
// « j'ai donné 900 leads » ne se vérifie pas.
type StatsFeuilleImportDTO struct {
	Feuille  string `json:"feuille"`
	Lignes   int    `json:"lignes"`
	Inedits  int    `json:"inedits"`
	ReLivres int    `json:"reLivres"`
	Doublons int    `json:"doublons"`
	// Part des doublons dont la fiche existait avant ce classeur : un classeur
	// par mois ne voit pas les précédents, la base si.
	DejaEnBase       int                        `json:"dejaEnBase"`
	FichesDejaEnBase []FicheDejaEnBaseImportDTO `json:"fichesDejaEnBase,omitempty"`
	Inexploitables   int                        `json:"inexploitables"`
}

// De quoi répondre au marketing nom par nom : la ligne livrée et la fiche
// qu'elle a retrouvée.
type FicheDejaEnBaseImportDTO struct {
	Ligne      int    `json:"ligne"`
	Nom        string `json:"nom"`
	Telephone  string `json:"telephone"`
	ProspectID string `json:"prospectId"`
	// Vides pour une fiche née hors d'un classeur : formulaire, saisie, banque.
	Fichier string `json:"fichier"`
	Onglet  string `json:"onglet"`
}

// L'ordre des onglets du classeur, que celui d'une map perdrait.
type statsFeuillesImport struct {
	ordre []string
	par   map[string]*StatsFeuilleImportDTO
	// Le classeur relu : ses propres fiches ne sont pas des doublons.
	fichier string
}

func statsFeuillesReprises(deja []StatsFeuilleImportDTO) *statsFeuillesImport {
	stats := &statsFeuillesImport{par: make(map[string]*StatsFeuilleImportDTO, len(deja))}
	for i := range deja {
		ligne := deja[i]
		stats.ordre = append(stats.ordre, ligne.Feuille)
		stats.par[ligne.Feuille] = &ligne
	}
	return stats
}

// Un classeur à un seul onglet ne nomme pas ses feuilles : il n'a rien à
// repartir par jour, et le tableau reste vide.
func (s *statsFeuillesImport) pour(feuille string) *StatsFeuilleImportDTO {
	if s == nil || feuille == "" {
		return nil
	}
	if ligne, deja := s.par[feuille]; deja {
		return ligne
	}
	ligne := &StatsFeuilleImportDTO{Feuille: feuille}
	s.ordre = append(s.ordre, feuille)
	s.par[feuille] = ligne
	return ligne
}

func (s *statsFeuillesImport) liste() []StatsFeuilleImportDTO {
	if s == nil {
		return nil
	}
	liste := make([]StatsFeuilleImportDTO, 0, len(s.ordre))
	for _, feuille := range s.ordre {
		liste = append(liste, *s.par[feuille])
	}
	return liste
}

func compterFeuillesGrandPublicImport(stats *statsFeuillesImport, lues, uniques []any,
	premiere map[string]string, deja map[string]connuImport,
) {
	if stats == nil {
		return
	}
	retenues := make(map[ligneDuClasseurImport]bool, len(uniques))
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		retenues[identiteLigneGrandPublicImport(&ligne)] = true
		if compteur := stats.pour(feuilleLigneGrandPublicImport(&ligne)); compteur != nil {
			stats.compterLigne(compteur, &ligne, premiere, deja)
		}
	}
	for _, valeur := range lues {
		ligne := valeur.(ligneGrandPublicImport)
		if retenues[identiteLigneGrandPublicImport(&ligne)] {
			continue
		}
		if compteur := stats.pour(feuilleLigneGrandPublicImport(&ligne)); compteur != nil {
			compteur.Doublons++
		}
	}
}

func feuilleLigneGrandPublicImport(ligne *ligneGrandPublicImport) string {
	if ligne.feuille == nil {
		return ""
	}
	return *ligne.feuille
}

// Le numero recommence a 1 sur chaque onglet : seul le couple designe la ligne.
type ligneDuClasseurImport struct {
	feuille string
	numero  int
}

func identiteLigneGrandPublicImport(ligne *ligneGrandPublicImport) ligneDuClasseurImport {
	return ligneDuClasseurImport{feuille: feuilleLigneGrandPublicImport(ligne), numero: ligne.numero}
}

func nomConnuImport(prenom, nom string) string {
	return strings.TrimSpace(prenom + " " + nom)
}

func texteImport(valeur *string) string {
	if valeur == nil {
		return ""
	}
	return *valeur
}

func (s *statsFeuillesImport) compterLigne(compteur *StatsFeuilleImportDTO, ligne *ligneGrandPublicImport,
	premiere map[string]string, deja map[string]connuImport,
) {
	telephone := telephoneConnuImport(ligne.telephone)
	anterieure := s.anterieure(deja[telephone])
	switch {
	case ligne.vide:
		compteur.Inexploitables++
	case telephone != "" && anterieure != nil:
		compteur.Doublons++
		compteur.DejaEnBase++
		compteur.FichesDejaEnBase = append(compteur.FichesDejaEnBase, FicheDejaEnBaseImportDTO{
			Ligne: ligne.numero, Nom: anterieure.nom, Telephone: telephone, ProspectID: deja[telephone].id,
			Fichier: anterieure.fichier, Onglet: anterieure.onglet,
		})
	case telephone != "" && premiere[telephone] != "":
		compteur.ReLivres++
	default:
		compteur.Inedits++
		if telephone != "" {
			premiere[telephone] = feuilleLigneGrandPublicImport(ligne)
		}
	}
}

// Une fiche née d'un autre classeur, ou hors de tout classeur, avant cette
// lecture. Celles que ce classeur a créées n'en sont pas : relu toutes les
// heures, un jour livré ne doit pas changer de bilan au relevé suivant.
func (s *statsFeuillesImport) anterieure(connue connuImport) *origineConnueImport {
	if connue.origine == nil || (connue.origine.fichier != "" && connue.origine.fichier == s.fichier) {
		return nil
	}
	return connue.origine
}
