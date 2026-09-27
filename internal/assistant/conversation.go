package assistant

import (
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	cheminConversation = "/api/v1/assistant/kairos/conversation"
	cheminLectureKairo = "/api/v1/assistant/kairos/lire"
)

type ConversationInput struct {
	Requete string `header:"X-Kairos-Request-ID" maxLength:"100"`
	Body    map[string]any
	RawBody []byte
}

type LectureKairoInput struct {
	Identite   string `header:"X-Kairos-Identite"`
	Horodatage string `header:"X-Kairos-Horodatage"`
	Signature  string `header:"X-Kairos-Signature"`
	Body       map[string]any
	RawBody    []byte
}

func (s *service) lirePourKairo(ctx context.Context, in *LectureKairoInput) (*ReponseOutput, error) {
	if s.Cfg.Base != socle.BasePublique {
		return nil, socle.Problem(http.StatusForbidden, "KAIROS_REFUSE", "Appel non autorisé.")
	}
	ctx, err := s.UtilisateurAppelKairo(ctx, in.Identite, in.Horodatage, in.Signature, cheminLectureKairo, in.RawBody)
	if err != nil {
		return nil, socle.Problem(http.StatusUnauthorized, "KAIROS_REFUSE", "Appel non autorisé.")
	}
	var question struct {
		Question string `json:"question"`
	}
	if json.Unmarshal(in.RawBody, &question) != nil || len(question.Question) < 3 || len(question.Question) > 500 {
		return nil, socle.Problem(http.StatusBadRequest, "KAIROS_QUESTION_INVALIDE", "Question invalide.")
	}
	sortie, err := s.repondreA(ctx, question.Question, nil)
	if err != nil {
		return nil, err
	}
	return &ReponseOutput{Body: *sortie}, nil
}

func (s *service) relayerKairo(ctx context.Context, in *ConversationInput, chemin string) (*huma.StreamResponse, error) {
	if s.Cfg.Base != socle.BasePublique {
		return nil, socle.Problem(http.StatusForbidden, "KAIROS_BASE_DEMO", "L’assistant Kairos n’est pas activé pour cette base de démonstration.")
	}
	if !socle.KairoConfigure() {
		return nil, socle.Problem(http.StatusServiceUnavailable, "KAIROS_INDISPONIBLE", "Kairos n’est pas configuré.")
	}
	u := socle.UtilisateurCourant(ctx)
	return &huma.StreamResponse{Body: func(h huma.Context) {
		diffuserKairo(ctx, h, &u, in, chemin)
	}}, nil
}

func diffuserKairo(ctx context.Context, h huma.Context, u *socle.Utilisateur, in *ConversationInput, chemin string) {
	ctx, annuler := context.WithTimeout(ctx, 2*time.Minute)
	defer annuler()
	w, ok := h.BodyWriter().(http.ResponseWriter)
	if !ok {
		h.SetStatus(http.StatusInternalServerError)
		return
	}
	controle := http.NewResponseController(w)
	_ = controle.SetWriteDeadline(time.Now().Add(2 * time.Minute))
	methode := http.MethodPost
	if chemin == "/kairos-client.js" {
		methode = http.MethodGet
	}
	reponse, err := socle.OuvrirKairo(ctx, u, methode, chemin, in.RawBody, in.Requete)
	if err != nil {
		http.Error(w, "Kairos est indisponible. Réessayez.", http.StatusServiceUnavailable)
		return
	}
	defer func() { _ = reponse.Body.Close() }()
	h.SetHeader("Content-Type", reponse.Header.Get("Content-Type"))
	h.SetHeader("Cache-Control", "no-store")
	h.SetHeader("X-Accel-Buffering", "no")
	h.SetHeader("X-Kairos-Trace", reponse.Header.Get("X-Kairos-Trace"))
	h.SetStatus(reponse.StatusCode)
	copierFluxKairo(w, reponse.Body, controle)
}

func copierFluxKairo(w http.ResponseWriter, corps io.Reader, controle *http.ResponseController) {
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
		"conversation":        "/v1/conversation",
		"conversation/retour": "/v1/conversation/retour",
		"transmission":        "/v1/transmission",
		"actions/confirmer":   "/v1/actions/confirmer",
		"actions/refuser":     "/v1/actions/refuser",
		"actions/annuler":     "/v1/actions/annuler",
	} {
		huma.Register(api, huma.Operation{OperationID: "kairos-" + suffixe, Method: http.MethodPost, Path: "/api/v1/assistant/kairos/" + suffixe, MaxBodyBytes: 1 << 20}, func(ctx context.Context, in *ConversationInput) (*huma.StreamResponse, error) {
			return s.relayerKairo(ctx, in, cible)
		})
	}
	huma.Register(api, huma.Operation{OperationID: "clientKairos", Method: http.MethodGet, Path: "/api/v1/assistant/kairos/client.js"}, func(ctx context.Context, _ *struct{}) (*huma.StreamResponse, error) {
		return s.relayerKairo(ctx, &ConversationInput{}, "/kairos-client.js")
	})
	huma.Register(api, huma.Operation{OperationID: "lirePourKairos", Method: http.MethodPost, Path: cheminLectureKairo, MaxBodyBytes: 4096}, s.lirePourKairo)
}
