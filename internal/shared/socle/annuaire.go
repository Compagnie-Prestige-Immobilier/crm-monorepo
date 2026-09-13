package socle

import (
	"slices"
	"sync"
)

// La liste des bases servies change en cours de vie du processus : une base de
// démonstration se crée et se supprime depuis le panneau. Le sélecteur de
// connexion la lit à chaque requête, d'où le verrou.
type Annuaire struct {
	mu   sync.RWMutex
	noms []string
}

func NouvelAnnuaire(noms ...string) *Annuaire {
	a := &Annuaire{noms: slices.Clone(noms)}
	slices.Sort(a.noms)
	return a
}

func (a *Annuaire) Noms() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return slices.Clone(a.noms)
}

func (a *Annuaire) Ajouter(nom string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !slices.Contains(a.noms, nom) {
		a.noms = append(a.noms, nom)
		slices.Sort(a.noms)
	}
}

func (a *Annuaire) Retirer(nom string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.noms = slices.DeleteFunc(a.noms, func(n string) bool { return n == nom })
}
