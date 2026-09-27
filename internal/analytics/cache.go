package analytics

import (
	"sync"
	"time"
)

type entreeCache struct {
	valeur any
	expire time.Time
}

// Clé `route:portée:filtres`, la portée valant le rôle quand il lit tout et
// l'identifiant sinon, pour que deux téléconseillers ne partagent pas une réponse.
type cacheMemoire struct {
	mu      sync.RWMutex
	entrees map[string]entreeCache
}

var cacheLectures = &cacheMemoire{entrees: map[string]entreeCache{}}

func (c *cacheMemoire) lire(cle string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entrees[cle]
	if !ok || time.Now().After(e.expire) {
		return nil, false
	}
	return e.valeur, true
}

func (c *cacheMemoire) ecrire(cle string, valeur any, ttl time.Duration) {
	maintenant := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, e := range c.entrees {
		if maintenant.After(e.expire) {
			delete(c.entrees, k)
		}
	}
	c.entrees[cle] = entreeCache{valeur: valeur, expire: maintenant.Add(ttl)}
}

func avecCache[T any](cle string, ttl time.Duration, calcul func() (T, error)) (T, error) {
	if brut, ok := cacheLectures.lire(cle); ok {
		if valeur, ok := brut.(T); ok {
			return valeur, nil
		}
	}
	valeur, err := calcul()
	if err != nil {
		return valeur, err
	}
	cacheLectures.ecrire(cle, valeur, ttl)
	return valeur, nil
}

// Pour les tests : vider le cache, ou faire expirer chaque entrée sans la retirer.
func ViderCache() {
	cacheLectures.mu.Lock()
	defer cacheLectures.mu.Unlock()
	clear(cacheLectures.entrees)
}

func PerimerCache() {
	cacheLectures.mu.Lock()
	defer cacheLectures.mu.Unlock()
	for cle, entree := range cacheLectures.entrees {
		entree.expire = time.Now().Add(-time.Minute)
		cacheLectures.entrees[cle] = entree
	}
}
