package notifications

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	brevoDestinatairesParAppel = 99
	brevoAppelsSimultanes      = 8
	brevoUrlDefaut             = "https://api.brevo.com/v3/smtp/email"
	brevoNomExpediteurDefaut   = "CPI GO"
	brevoDelaiDefaut           = 15_000

	BrevoEnvoye       = "SENT"
	brevoNonConfigure = "NOT_CONFIGURED"
	brevoEnPanne      = "TRANSPORT_ERROR"
)

type DestinataireBrevo struct {
	Email string
	Nom   string
}

type MessageBrevo struct {
	Destinataires []DestinataireBrevo
	Sujet         string
	HTML          string
	Texte         string
}

type issueBrevo struct {
	email       string
	ok          bool
	code        string
	transitoire bool
}

type envoiBrevo struct {
	Statut string
	issues []issueBrevo
	detail string
}

type brevo struct {
	cle        string
	expediteur string
	nom        string
	url        string
	delai      time.Duration
	raison     string
}

func ConfigurerBrevo() brevo {
	b := brevo{
		cle:        strings.TrimSpace(os.Getenv("BREVO_API_KEY")),
		expediteur: strings.TrimSpace(os.Getenv("BREVO_SENDER_EMAIL")),
		nom:        socle.Env("BREVO_SENDER_NAME", brevoNomExpediteurDefaut),
		url:        socle.Env("BREVO_ENDPOINT", brevoUrlDefaut),
	}
	millisecondes, err := socle.EnvInt("BREVO_REQUEST_TIMEOUT_MS", brevoDelaiDefaut)
	if err != nil {
		millisecondes = brevoDelaiDefaut
	}
	b.delai = time.Duration(millisecondes) * time.Millisecond
	switch {
	case b.cle == "":
		b.raison = "BREVO_API_KEY est absent : aucun transport e-mail configuré."
	case b.expediteur == "":
		b.raison = "BREVO_SENDER_EMAIL est absent : Brevo refuse un envoi sans adresse d'expédition."
	}
	return b
}

func (b *brevo) configure() bool { return b.raison == "" }

type corpsBrevo struct {
	Sender      map[string]string   `json:"sender"`
	To          []map[string]string `json:"to"`
	Subject     string              `json:"subject"`
	HTMLContent string              `json:"htmlContent"`
	TextContent string              `json:"textContent"`
}

type trancheBrevo struct {
	destinataires []DestinataireBrevo
	ok            bool
	code          string
	transitoire   bool
}

// Un refus de tranche n'emporte pas le lot : chaque tranche rend son propre
// sort, et `TRANSPORT_ERROR` ne se dit que si aucune n'est passée.
func (b *brevo) Envoyer(ctx context.Context, messages []MessageBrevo) envoiBrevo {
	if len(messages) == 0 {
		return envoiBrevo{Statut: BrevoEnvoye}
	}
	if !b.configure() {
		return envoiBrevo{Statut: brevoNonConfigure, detail: b.raison}
	}

	var issues []issueBrevo
	var premiereErreur string
	tentees, remises := 0, 0
	for _, message := range messages {
		for _, tranche := range b.envoyerMessage(ctx, message) {
			tentees++
			if tranche.ok {
				remises++
			} else if premiereErreur == "" {
				premiereErreur = tranche.code
			}
			for _, destinataire := range tranche.destinataires {
				issues = append(issues, issueBrevo{
					email: destinataire.Email, ok: tranche.ok,
					code: tranche.code, transitoire: tranche.transitoire,
				})
			}
		}
	}
	if tentees > 0 && remises == 0 {
		return envoiBrevo{Statut: brevoEnPanne, issues: issues, detail: premiereErreur}
	}
	return envoiBrevo{Statut: BrevoEnvoye, issues: issues}
}

func (b *brevo) envoyerMessage(ctx context.Context, message MessageBrevo) []trancheBrevo {
	tranches := brevoDecouper(message.Destinataires, brevoDestinatairesParAppel)
	sorts := make([]trancheBrevo, len(tranches))
	jetons := make(chan struct{}, brevoAppelsSimultanes)
	var attente sync.WaitGroup
	for i, tranche := range tranches {
		attente.Add(1)
		go func() {
			defer attente.Done()
			jetons <- struct{}{}
			defer func() { <-jetons }()
			sorts[i] = b.envoyerTranche(ctx, message, tranche)
		}()
	}
	attente.Wait()
	return sorts
}

func (b *brevo) envoyerTranche(ctx context.Context, message MessageBrevo, tranche []DestinataireBrevo) trancheBrevo {
	sort := trancheBrevo{destinataires: tranche}
	to := make([]map[string]string, 0, len(tranche))
	for _, destinataire := range tranche {
		entree := map[string]string{"email": destinataire.Email}
		if destinataire.Nom != "" {
			entree["name"] = destinataire.Nom
		}
		to = append(to, entree)
	}
	corps, err := json.Marshal(corpsBrevo{
		Sender:      map[string]string{"email": b.expediteur, "name": b.nom},
		To:          to,
		Subject:     message.Sujet,
		HTMLContent: message.HTML,
		TextContent: message.Texte,
	})
	if err != nil {
		return brevoErreurReseau(sort, err)
	}

	appel, annuler := context.WithTimeout(ctx, b.delai)
	defer annuler()
	requete, err := http.NewRequestWithContext(appel, http.MethodPost, b.url, bytes.NewReader(corps))
	if err != nil {
		return brevoErreurReseau(sort, err)
	}
	requete.Header.Set("api-key", b.cle)
	requete.Header.Set("Content-Type", "application/json")
	requete.Header.Set("Accept", "application/json")

	reponse, err := http.DefaultClient.Do(requete)
	if err != nil {
		return brevoErreurReseau(sort, err)
	}
	defer func() { _ = reponse.Body.Close() }()
	if reponse.StatusCode < http.StatusMultipleChoices {
		sort.ok = true
		return sort
	}
	sort.code = brevoCodeErreur(reponse)
	sort.transitoire = reponse.StatusCode == http.StatusTooManyRequests ||
		reponse.StatusCode >= http.StatusInternalServerError
	return sort
}

func brevoErreurReseau(sort trancheBrevo, err error) trancheBrevo {
	slog.Warn("envoi Brevo échoué", "err", err)
	sort.code = "NETWORK_ERROR"
	sort.transitoire = true
	return sort
}

func brevoCodeErreur(reponse *http.Response) string {
	var charge struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(reponse.Body).Decode(&charge); err == nil && charge.Code != "" {
		return charge.Code
	}
	return "HTTP_" + strconv.Itoa(reponse.StatusCode)
}

func brevoDecouper[T any](items []T, taille int) [][]T {
	if len(items) == 0 {
		return nil
	}
	tranches := make([][]T, 0, (len(items)+taille-1)/taille)
	for debut := 0; debut < len(items); debut += taille {
		tranches = append(tranches, items[debut:min(debut+taille, len(items))])
	}
	return tranches
}
