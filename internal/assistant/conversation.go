package assistant

import (
	"context"
	"cpi-go/internal/shared/socle"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	cheminConversation = "/api/v1/assistant/kairos/conversation"
	cheminLectureKairo = "/api/v1/assistant/kairos/lire"
)

type ConversationInput struct {
	Requete   string `header:"X-Kairos-Request-ID" maxLength:"128"`
	Protocole string `header:"X-Kairos-Protocole" maxLength:"8"`
	Curseur   string `header:"Last-Event-ID" maxLength:"128"`
	Body      map[string]any
	RawBody   []byte
}

type LectureKairoInput struct {
	Identite   string `header:"X-Kairos-Identite"`
	Horodatage string `header:"X-Kairos-Horodatage"`
	Signature  string `header:"X-Kairos-Signature"`
	Question   string `query:"question" maxLength:"500"`
	Chemin     string
}

func (in *LectureKairoInput) Resolve(ctx huma.Context) []error {
	adresse := ctx.URL()
	in.Chemin = adresse.RequestURI()
	return nil
}

func (s *service) lirePourKairo(ctx context.Context, in *LectureKairoInput) (*ReponseOutput, error) {
	if s.Cfg.Base != socle.BasePublique {
		return nil, socle.Problem(http.StatusForbidden, "KAIROS_REFUSE", "Appel non autorisé.")
	}
	ctx, err := s.UtilisateurAppelKairo(ctx, in.Identite, in.Horodatage, in.Signature, http.MethodGet, in.Chemin, nil)
	if err != nil {
		return nil, socle.Problem(http.StatusUnauthorized, "KAIROS_REFUSE", "Appel non autorisé.")
	}
	if len(in.Question) < 3 || len(in.Question) > 500 {
		return nil, socle.Problem(http.StatusBadRequest, "KAIROS_QUESTION_INVALIDE", "Question invalide.")
	}
	sortie, err := s.repondreA(ctx, in.Question, nil)
	if err != nil {
		return nil, err
	}
	return &ReponseOutput{Body: *sortie}, nil
}

func (s *service) relayerKairo(ctx context.Context, in *ConversationInput, methode, chemin string) (*huma.StreamResponse, error) {
	if s.Cfg.Base != socle.BasePublique {
		return nil, socle.Problem(http.StatusForbidden, "KAIROS_BASE_DEMO", "L’assistant Kairos n’est pas activé pour cette base de démonstration.")
	}
	if !socle.KairoConfigure() {
		return nil, socle.Problem(http.StatusServiceUnavailable, "KAIROS_INDISPONIBLE", "Kairos n’est pas configuré.")
	}
	u := socle.UtilisateurCourant(ctx)
	return &huma.StreamResponse{Body: func(h huma.Context) {
		diffuserKairo(ctx, h, &u, in, methode, chemin)
	}}, nil
}

func diffuserKairo(ctx context.Context, h huma.Context, u *socle.Utilisateur, in *ConversationInput, methode, chemin string) {
	ctx, annuler := context.WithTimeout(ctx, 2*time.Minute)
	defer annuler()
	w, ok := h.BodyWriter().(http.ResponseWriter)
	if !ok {
		h.SetStatus(http.StatusInternalServerError)
		return
	}
	controle := http.NewResponseController(w)
	_ = controle.SetWriteDeadline(time.Now().Add(2 * time.Minute))
	entetes := make(http.Header)
	entetes.Set("X-Kairos-Request-ID", in.Requete)
	entetes.Set("X-Kairos-Protocole", in.Protocole)
	entetes.Set("Last-Event-ID", in.Curseur)
	reponse, err := socle.OuvrirKairo(ctx, u, methode, chemin, in.RawBody, entetes)
	if err != nil {
		http.Error(w, "Kairos est indisponible. Réessayez.", http.StatusServiceUnavailable)
		return
	}
	defer func() { _ = reponse.Body.Close() }()
	h.SetHeader("Content-Type", typeReponseKairo(chemin, reponse.StatusCode))
	h.SetHeader("X-Content-Type-Options", "nosniff")
	h.SetHeader("Cache-Control", "no-store")
	h.SetHeader("X-Accel-Buffering", "no")
	h.SetHeader("X-Kairos-Trace", reponse.Header.Get("X-Kairos-Trace"))
	h.SetStatus(reponse.StatusCode)
	copierFluxKairo(w, reponse.Body, controle)
}

func typeReponseKairo(chemin string, statut int) string {
	if statut >= http.StatusBadRequest {
		return "application/problem+json"
	}
	chemin, _, _ = strings.Cut(chemin, "?")
	switch chemin {
	case "/kairos-client.js", "/kairos-browser.js":
		return "text/javascript; charset=utf-8"
	case "/v1/conversation":
		return "text/event-stream"
	default:
		return "application/json"
	}
}

func copierFluxKairo(w io.Writer, corps io.Reader, controle *http.ResponseController) {
	tampon := make([]byte, 16<<10)
	for {
		n, err := corps.Read(tampon)
		if n > 0 {
			if _, ecrireErr := w.Write(tampon[:n]); ecrireErr != nil {
				return
			}
			if controle.Flush() != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}

func (s *service) monterConversation(api huma.API) {
	for suffixe, cible := range map[string]string{
		"conversation":         "/v1/conversation",
		"conversation/retour":  "/v1/conversation/retour",
		"conversation/annuler": "/v1/conversation/annuler",
		"sdk/traitements":      "/v1/sdk/traitements",
		"transmission":         "/v1/transmission",
		"actions/confirmer":    "/v1/actions/confirmer",
		"actions/refuser":      "/v1/actions/refuser",
		"actions/annuler":      "/v1/actions/annuler",
	} {
		huma.Register(api, huma.Operation{OperationID: "kairos-" + suffixe, Method: http.MethodPost, Path: "/api/v1/assistant/kairos/" + suffixe, MaxBodyBytes: 3 << 20}, func(ctx context.Context, in *ConversationInput) (*huma.StreamResponse, error) {
			return s.relayerKairo(ctx, in, http.MethodPost, cible)
		})
	}
	for suffixe, cible := range map[string]string{"client.js": "/kairos-client.js", "browser.js": "/kairos-browser.js", "assistant": "/v1/assistant", "sdk/regles": "/v1/sdk/regles", "sdk/traitements": "/v1/sdk/traitements", "conversations": "/v1/conversations"} {
		huma.Register(api, huma.Operation{OperationID: "kairos-lire-" + suffixe, Method: http.MethodGet, Path: "/api/v1/assistant/kairos/" + suffixe}, func(ctx context.Context, in *PageKairosInput) (*huma.StreamResponse, error) {
			chemin := cible
			if in.Avant != "" {
				chemin += "?avant=" + url.QueryEscape(in.Avant)
			}
			return s.relayerKairo(ctx, &ConversationInput{}, http.MethodGet, chemin)
		})
	}
	for _, methode := range []string{http.MethodGet, http.MethodDelete} {
		huma.Register(api, huma.Operation{OperationID: "kairos-conversation-" + methode, Method: methode, Path: "/api/v1/assistant/kairos/conversations/{conversation}"}, func(ctx context.Context, in *HistoriqueKairosInput) (*huma.StreamResponse, error) {
			chemin := "/v1/conversations/" + url.PathEscape(in.Conversation)
			if in.Avant != "" {
				chemin += "?avant=" + url.QueryEscape(in.Avant)
			}
			return s.relayerKairo(ctx, &ConversationInput{}, methode, chemin)
		})
	}
	huma.Register(api, huma.Operation{OperationID: "kairos-regle", Method: http.MethodPut, Path: "/api/v1/assistant/kairos/sdk/regles", MaxBodyBytes: 1 << 20}, func(ctx context.Context, in *ConversationInput) (*huma.StreamResponse, error) {
		return s.relayerKairo(ctx, in, http.MethodPut, "/v1/sdk/regles")
	})
	for suffixe, methode := range map[string]string{"": http.MethodDelete, "/executions": http.MethodGet} {
		huma.Register(api, huma.Operation{OperationID: "kairos-traitement-" + methode, Method: methode, Path: "/api/v1/assistant/kairos/sdk/traitements/{id}" + suffixe}, func(ctx context.Context, in *TraitementKairosInput) (*huma.StreamResponse, error) {
			return s.relayerKairo(ctx, &ConversationInput{}, methode, "/v1/sdk/traitements/"+strconv.FormatInt(in.ID, 10)+suffixe)
		})
	}

	huma.Register(api, huma.Operation{OperationID: "lirePourKairos", Method: http.MethodGet, Path: cheminLectureKairo, MaxBodyBytes: 4096}, s.lirePourKairo)
}

type PageKairosInput struct {
	Avant string `query:"avant" maxLength:"128"`
}
type HistoriqueKairosInput struct {
	Conversation string `path:"conversation" minLength:"1" maxLength:"64" pattern:"^[a-zA-Z0-9_-]+$"`
	Avant        string `query:"avant" maxLength:"128"`
}
type TraitementKairosInput struct {
	ID int64 `path:"id" minimum:"1"`
}
