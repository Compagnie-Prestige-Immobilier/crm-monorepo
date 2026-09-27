package admin

import (
	"context"
	"cpi-go/internal/shared/socle"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const webhookTirageDelai = 5 * time.Minute

type EnrolementWebhookInput struct {
	Secret string `query:"secret"`
	Projet string `path:"projet"`
}

// La plateforme prévient dès qu'un dossier est complet, plutôt que d'attendre
// le prochain tirage. Elle n'envoie rien d'utile dans son corps : le tirage
// relit la source, seule autorité sur l'état des inscriptions.
//
// Le secret voyage en paramètre de requête et non dans le chemin : le journal
// des requêtes consigne `r.URL.Path`, donc un secret placé dans le chemin
// s'écrivait en clair dans chaque ligne de journal.
// Sans PLATEFORME_WEBHOOK_SECRET, la route n'existe pas.
func (s *service) tirageDemandeParPlateforme(ctx context.Context, in *EnrolementWebhookInput) (*struct{}, error) {
	secret := socle.Env("PLATEFORME_WEBHOOK_SECRET", "")
	if secret == "" || subtle.ConstantTimeCompare([]byte(in.Secret), []byte(secret)) != 1 {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Route inconnue.")
	}
	projet := projetChues
	if in.Projet == "grand-public" {
		projet = socle.ProjetGrandPublic
	}
	if base, jeton := socle.PlateformeConfiguree(projet); base == "" || jeton == "" {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Route inconnue.")
	}
	// Rendre la main tout de suite : un tirage lit la plateforme page par page,
	// et la faire attendre son propre tirage la ferait expirer.
	go s.tirerEnArrierePlan(context.WithoutCancel(ctx), projet)
	return &struct{}{}, nil
}

func (s *service) tirerEnArrierePlan(parent context.Context, projet string) {
	defer func() { socle.JournaliserPanique("tirage plateforme", recover()) }()
	ctx, arreter := context.WithTimeout(parent, webhookTirageDelai)
	defer arreter()
	bilan := s.tirer(ctx, projet)
	if bilan.Erreur != nil {
		slog.Warn("tirage demandé par la plateforme", "projet", projet, "err", *bilan.Erreur)
	}
}

func monterWebhookEnrolement(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "enrolementWebhook", Method: http.MethodPost,
		Path:          "/api/v1/webhooks/enrolement/{projet}",
		DefaultStatus: http.StatusAccepted,
	}, s.tirageDemandeParPlateforme)
}
