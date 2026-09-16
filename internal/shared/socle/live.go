package socle

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// Bus « quelque chose a changé » vers les panneaux ouverts, un seul processus.
// Sujets : notifications, imports, db-dump, referentiels. Rien de métier ne
// transite : le panneau relit l'API.
type Live struct {
	mu      sync.Mutex
	abonnes map[chan string]struct{}
	arret   chan struct{}
	uneFois sync.Once
}

func NouveauLive() *Live {
	return &Live{abonnes: map[chan string]struct{}{}, arret: make(chan struct{})}
}

// `Shutdown` attend la fin des requêtes en cours, or un flux reste ouvert
// quatorze minutes : sans ce signal, tout redéploiement avec un onglet ouvert
// atteignait le délai de 30 s et sortait en erreur, rendant illisible le seul
// message qui doit signaler un vrai plantage.
func (l *Live) Fermer() {
	l.uneFois.Do(func() { close(l.arret) })
}

func (l *Live) Emettre(sujet string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for c := range l.abonnes {
		select {
		case c <- sujet:
		default:
		}
	}
}

func (l *Live) abonner() (sujets chan string, quitter func()) {
	c := make(chan string, 16)
	l.mu.Lock()
	l.abonnes[c] = struct{}{}
	l.mu.Unlock()
	return c, func() {
		l.mu.Lock()
		delete(l.abonnes, c)
		l.mu.Unlock()
	}
}

var GardeLive = map[string]Permission{"GET /api/v1/live": PermissionPanneauAcceder}

func (l *Live) diffuser(ctx huma.Context) {
	ctx.SetHeader("Content-Type", "text/event-stream")
	ctx.SetHeader("Cache-Control", "no-store")
	ctx.SetHeader("X-Accel-Buffering", "no")
	w := ctx.BodyWriter()
	controle, _ := w.(http.ResponseWriter)
	ecrire := func(ligne string) bool {
		if _, err := fmt.Fprint(w, ligne); err != nil {
			return false
		}
		if controle != nil {
			_ = http.NewResponseController(controle).Flush()
		}
		return true
	}
	sujets, quitter := l.abonner()
	defer quitter()
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	fin := time.NewTimer(14 * time.Minute)
	defer fin.Stop()
	ecrire(": ouvert\n\n")
	for {
		var ligne string
		select {
		case <-ctx.Context().Done():
			return
		case <-l.arret:
			return
		case <-fin.C:
			return
		case <-ping.C:
			ligne = ": ping\n\n"
		case sujet := <-sujets:
			ligne = "event: " + sujet + "\ndata: {}\n\n"
		}
		if !ecrire(ligne) {
			return
		}
	}
}

func MonterLive(api huma.API, l *Live) {
	huma.Register(api, huma.Operation{OperationID: "live", Method: http.MethodGet, Path: "/api/v1/live"}, func(context.Context, *struct{}) (*huma.StreamResponse, error) {
		return &huma.StreamResponse{Body: l.diffuser}, nil
	})
}
