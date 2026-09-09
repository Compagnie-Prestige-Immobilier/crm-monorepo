package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"math"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Mêmes paramètres que apps/api/src/modules/auth/password.ts, et le même
// ordre `m,p,t` que le paquet npm argon2 0.45 écrit : la v1 doit relire les
// hachages posés par la v2 pendant la fenêtre de retour arrière, et la v2
// accepte les deux ordres.
const (
	argonMemoire    = 19456
	argonIterations = 2
	argonThreads    = 1
	argonSel        = 16
	argonCle        = 32
)

func hacherMotDePasse(mdp string) (string, error) {
	sel := make([]byte, argonSel)
	if _, err := rand.Read(sel); err != nil {
		return "", err
	}
	cle := argon2.IDKey([]byte(mdp), sel, argonIterations, argonMemoire, argonThreads, argonCle)
	b64 := base64.RawStdEncoding
	return fmt.Sprintf("$argon2id$v=%d$m=%d,p=%d,t=%d$%s$%s", argon2.Version, argonMemoire, argonThreads, argonIterations, b64.EncodeToString(sel), b64.EncodeToString(cle)), nil
}

func lireParametresArgon(champ string) (memoire, iterations uint32, threads uint8, ok bool) {
	valeurs := map[string]uint64{}
	for _, kv := range strings.Split(champ, ",") {
		k, v, trouve := strings.Cut(kv, "=")
		n, err := strconv.ParseUint(v, 10, 32)
		if !trouve || err != nil {
			return 0, 0, 0, false
		}
		valeurs[k] = n
	}
	m, t, p := valeurs["m"], valeurs["t"], valeurs["p"]
	if m == 0 || t == 0 || p == 0 || m > math.MaxUint32 || t > math.MaxUint32 || p > math.MaxUint8 {
		return 0, 0, 0, false
	}
	return uint32(m), uint32(t), uint8(p), true
}

func verifierMotDePasse(mdp, phc string) bool {
	parts := strings.Split(phc, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	memoire, iterations, threads, ok := lireParametresArgon(parts[3])
	sel, errSel := base64.RawStdEncoding.DecodeString(parts[4])
	attendu, errCle := base64.RawStdEncoding.DecodeString(parts[5])
	longueur := len(attendu)
	if !ok || errSel != nil || errCle != nil || longueur == 0 || longueur > math.MaxUint32 {
		return false
	}
	cle := argon2.IDKey([]byte(mdp), sel, iterations, memoire, threads, uint32(longueur))
	return subtle.ConstantTimeCompare(cle, attendu) == 1
}
