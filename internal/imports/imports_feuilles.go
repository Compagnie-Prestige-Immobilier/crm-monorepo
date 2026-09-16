package imports

// Le classeur des leads porte un onglet par jour, et le relevé le relit en
// entier : le bilan global dit combien de lignes sont arrivées, jamais quel
// jour a livré quoi. Sans ce compte, « j'ai donné 900 leads » ne se vérifie
// pas.
type StatsFeuilleImportDTO struct {
	Feuille        string `json:"feuille"`
	Lignes         int    `json:"lignes"`
	Inedits        int    `json:"inedits"`
	ReLivres       int    `json:"reLivres"`
	Doublons       int    `json:"doublons"`
	Inexploitables int    `json:"inexploitables"`
}

// L'ordre des onglets du classeur, que celui d'une map perdrait.
type statsFeuillesImport struct {
	ordre []string
	par   map[string]*StatsFeuilleImportDTO
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

// Ce qu'un onglet a livre : un numero inedit, un numero deja livre un jour
// precedent, un doublon du meme onglet, une ligne inexploitable. Le compte se
// fait sur le classeur seul, jamais sur ce que la base sait deja : le releve
// relit le classeur entier toutes les heures, et un jour livre ne doit pas
// changer de bilan au releve suivant.
func compterFeuillesGrandPublicImport(stats *statsFeuillesImport, lues, uniques []any,
	premiere map[string]string,
) {
	if stats == nil {
		return
	}
	retenues := make(map[ligneDuClasseurImport]bool, len(uniques))
	for _, valeur := range uniques {
		ligne := valeur.(ligneGrandPublicImport)
		retenues[identiteLigneGrandPublicImport(&ligne)] = true
		compteur := stats.pour(feuilleLigneGrandPublicImport(&ligne))
		if compteur == nil {
			continue
		}
		telephone := telephoneConnuImport(ligne.telephone)
		switch {
		case ligne.vide:
			compteur.Inexploitables++
		case telephone != "" && premiere[telephone] != "":
			compteur.ReLivres++
		default:
			compteur.Inedits++
			if telephone != "" {
				premiere[telephone] = feuilleLigneGrandPublicImport(&ligne)
			}
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
