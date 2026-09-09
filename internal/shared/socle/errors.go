package socle

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Le panneau lit `code` et `message` ; `errors[]` porte le champ fautif (RFC 9457).
type ProblemError struct {
	Status    int                 `json:"status"`
	Code      string              `json:"code"`
	Message   string              `json:"message"`
	Detail    string              `json:"detail,omitempty"`
	Errors    []*huma.ErrorDetail `json:"errors,omitempty"`
	RequestID string              `json:"requestId,omitempty"`
}

func (p *ProblemError) Error() string  { return p.Message }
func (p *ProblemError) GetStatus() int { return p.Status }
func (*ProblemError) ContentType(string) string {
	return "application/problem+json"
}

func Problem(status int, code, message string) *ProblemError {
	return &ProblemError{Status: status, Code: code, Message: message}
}

var messagesParStatut = map[int][2]string{
	http.StatusBadRequest:          {"BAD_REQUEST", "Requête invalide."},
	http.StatusUnauthorized:        {"UNAUTHENTICATED", "Connexion requise."},
	http.StatusForbidden:           {"FORBIDDEN", "Accès refusé."},
	http.StatusNotFound:            {"NOT_FOUND", "Ressource introuvable."},
	http.StatusUnprocessableEntity: {"VALIDATION_FAILED", "Certains champs sont invalides."},
	http.StatusTooManyRequests:     {"RATE_LIMITED", "Trop de tentatives. Réessayez dans une minute."},
	http.StatusServiceUnavailable:  {"UNAVAILABLE", "Service momentanément indisponible."},
}

func nouveauProblem(status int, detail string, errs ...error) *ProblemError {
	p := &ProblemError{Status: status, Detail: detail, Code: "INTERNAL_ERROR", Message: "Une erreur interne est survenue."}
	if cm, ok := messagesParStatut[status]; ok {
		p.Code, p.Message = cm[0], cm[1]
	}
	for _, e := range errs {
		var d huma.ErrorDetailer
		if errors.As(e, &d) {
			p.Errors = append(p.Errors, d.ErrorDetail())
			continue
		}
		p.Errors = append(p.Errors, &huma.ErrorDetail{Message: e.Error()})
	}
	return p
}

func InstallerErreurs() {
	huma.NewError = func(status int, detail string, errs ...error) huma.StatusError {
		return nouveauProblem(status, detail, errs...)
	}
	huma.NewErrorWithContext = func(ctx huma.Context, status int, detail string, errs ...error) huma.StatusError {
		p := nouveauProblem(status, detail, errs...)
		p.RequestID, _ = ctx.Context().Value(cleRequete{}).(string)
		if status >= http.StatusInternalServerError {
			slog.Error("erreur serveur", "requestId", p.RequestID, "status", status, "detail", detail, "errs", errors.Join(errs...))
		}
		return p
	}
}
