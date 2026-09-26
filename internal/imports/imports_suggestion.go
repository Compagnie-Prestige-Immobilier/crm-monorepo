package imports

import "fmt"

// La valeur du référentiel la plus proche, comparée sans accents ni casse : un
// quart des lettres au plus peut différer, une inversion de deux lettres compte pour une.
func suggestionImport(brut string, libelles []string) string {
	cible := []rune(cleImport(brut))
	meilleur, ecartMax := "", max(1, len(cible)/4)
	for _, libelle := range libelles {
		if ecart := distanceImport(cible, []rune(cleImport(libelle))); ecart <= ecartMax {
			meilleur, ecartMax = libelle, ecart-1
		}
	}
	if meilleur == "" {
		return ""
	}
	return fmt.Sprintf(" Vouliez-vous dire « %s » ?", meilleur)
}

// Distance de Damerau-Levenshtein restreinte, sur deux lignes glissantes et la précédente.
func distanceImport(a, b []rune) int {
	avant, precedente, courante := make([]int, len(b)+1), make([]int, len(b)+1), make([]int, len(b)+1)
	for j := range precedente {
		precedente[j] = j
	}
	for i := 1; i <= len(a); i++ {
		courante[0] = i
		for j := 1; j <= len(b); j++ {
			cout := 1
			if a[i-1] == b[j-1] {
				cout = 0
			}
			courante[j] = min(precedente[j]+1, courante[j-1]+1, precedente[j-1]+cout)
			if i > 1 && j > 1 && a[i-1] == b[j-2] && a[i-2] == b[j-1] {
				courante[j] = min(courante[j], avant[j-2]+1)
			}
		}
		avant, precedente, courante = precedente, courante, avant
	}
	return precedente[len(b)]
}
