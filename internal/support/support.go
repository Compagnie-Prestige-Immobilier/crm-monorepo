package support

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

var Garde = map[string]socle.Permission{
	"POST /api/v1/support/tickets": socle.PermissionSupportSignaler,
}

var clientGlpi = &http.Client{Timeout: 60 * time.Second}

const imagesMax = 5

var extensionsImages = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

type glpi struct{ url, appToken, userToken string }

func Monter(api huma.API, _ *socle.Deps) {
	g := glpi{
		url:       strings.TrimRight(strings.TrimSpace(socle.Env("GLPI_URL", "")), "/"),
		appToken:  strings.TrimSpace(socle.Env("GLPI_APP_TOKEN", "")),
		userToken: strings.TrimSpace(socle.Env("GLPI_USER_TOKEN", "")),
	}
	huma.Register(api, huma.Operation{
		OperationID: "creerTicketSupport", Method: http.MethodPost, Path: "/api/v1/support/tickets",
		MaxBodyBytes: 40 << 20,
		Summary:      "Ouvre un ticket GLPI au nom du compte de pilotage, avec la page et ses images.",
	}, g.creer)
}

type TicketInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Description string          `form:"description" required:"true" minLength:"3" maxLength:"5000"`
		Contexte    string          `form:"contexte" maxLength:"5000"`
		Images      []huma.FormFile `form:"images" contentType:"image/png,image/jpeg,image/webp,image/gif"`
	}]
}

type TicketOutput struct {
	Body struct {
		Numero int `json:"numero"`
	}
}

func (g glpi) creer(ctx context.Context, in *TicketInput) (*TicketOutput, error) {
	if g.url == "" || g.appToken == "" || g.userToken == "" {
		return nil, socle.Problem(http.StatusServiceUnavailable, "SUPPORT_NON_CONFIGURE", "Le support n'est pas encore relié à GLPI. Prévenez l'administrateur.")
	}
	form := in.RawBody.Data()
	if len(form.Images) > imagesMax {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_TROP_D_IMAGES", fmt.Sprintf("%d images au plus par ticket.", imagesMax))
	}
	u := socle.UtilisateurCourant(ctx)
	contenu := paragraphe(form.Description) +
		paragraphe(fmt.Sprintf("Signalé par %s (%s, %s)", u.FullName, u.RoleLibelle, u.Email)) +
		paragraphe(form.Contexte)

	session, err := g.ouvrirSession(ctx)
	if err != nil {
		return nil, glpiInjoignable(err)
	}
	defer g.fermerSession(ctx, session)

	var ticket struct {
		ID int `json:"id"`
	}
	var nouveau struct {
		Input struct {
			Name    string `json:"name"`
			Content string `json:"content"`
		} `json:"input"`
	}
	nouveau.Input.Name, nouveau.Input.Content = titre(form.Description), contenu
	corps, err := json.Marshal(nouveau)
	if err != nil {
		return nil, err
	}
	if err := g.appeler(ctx, session, http.MethodPost, "/Ticket", "application/json", bytes.NewReader(corps), &ticket); err != nil {
		return nil, glpiInjoignable(err)
	}
	for i, image := range form.Images {
		if err := g.joindreImage(ctx, session, ticket.ID, i, image); err != nil {
			slog.Warn("image non jointe au ticket GLPI", "ticket", ticket.ID, "err", err)
		}
	}
	out := &TicketOutput{}
	out.Body.Numero = ticket.ID
	return out, nil
}

func (g glpi) joindreImage(ctx context.Context, session string, ticketID, rang int, image huma.FormFile) error {
	nom := fmt.Sprintf("image-%d%s", rang+1, extensionsImages[image.ContentType])
	var corps bytes.Buffer
	w := multipart.NewWriter(&corps)
	var document struct {
		Input struct {
			Name     string   `json:"name"`
			Fichiers []string `json:"_filename"`
			Itemtype string   `json:"itemtype"`
			ItemsID  int      `json:"items_id"`
		} `json:"input"`
	}
	document.Input.Name, document.Input.Fichiers = nom, []string{nom}
	document.Input.Itemtype, document.Input.ItemsID = "Ticket", ticketID
	manifeste, err := json.Marshal(document)
	if err != nil {
		return err
	}
	if err := w.WriteField("uploadManifest", string(manifeste)); err != nil {
		return err
	}
	partie, err := w.CreateFormFile("filename[0]", nom)
	if err != nil {
		return err
	}
	if _, err := io.Copy(partie, image); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return g.appeler(ctx, session, http.MethodPost, "/Document", w.FormDataContentType(), &corps, nil)
}

func (g glpi) ouvrirSession(ctx context.Context) (string, error) {
	var reponse struct {
		SessionToken string `json:"session_token"`
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.url+"/api.php/v1/initSession", http.NoBody)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "user_token "+g.userToken)
	if err := g.envoyer(req, &reponse); err != nil {
		return "", err
	}
	return reponse.SessionToken, nil
}

func (g glpi) fermerSession(parent context.Context, session string) {
	ctx, annuler := context.WithTimeout(context.WithoutCancel(parent), 5*time.Second)
	defer annuler()
	_ = g.appeler(ctx, session, http.MethodGet, "/killSession", "", nil, nil)
}

func (g glpi) appeler(ctx context.Context, session, methode, chemin, typeContenu string, corps io.Reader, cible any) error {
	req, err := http.NewRequestWithContext(ctx, methode, g.url+"/api.php/v1"+chemin, corps)
	if err != nil {
		return err
	}
	req.Header.Set("Session-Token", session)
	if typeContenu != "" {
		req.Header.Set("Content-Type", typeContenu)
	}
	return g.envoyer(req, cible)
}

func (g glpi) envoyer(req *http.Request, cible any) error {
	req.Header.Set("App-Token", g.appToken)
	rep, err := clientGlpi.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = rep.Body.Close() }()
	lu, err := io.ReadAll(io.LimitReader(rep.Body, 1<<20))
	if err != nil {
		return err
	}
	if rep.StatusCode >= 300 {
		return fmt.Errorf("GLPI %s %s : %d %s", req.Method, req.URL.Path, rep.StatusCode, lu)
	}
	if cible == nil {
		return nil
	}
	return json.Unmarshal(lu, cible)
}

func glpiInjoignable(err error) error {
	slog.Error("ticket GLPI non créé", "err", err)
	return socle.Problem(http.StatusBadGateway, "SUPPORT_GLPI_INJOIGNABLE", "GLPI ne répond pas. Réessayez dans un instant.")
}

func paragraphe(texte string) string {
	texte = strings.TrimSpace(texte)
	if texte == "" {
		return ""
	}
	return "<p>" + strings.ReplaceAll(html.EscapeString(texte), "\n", "<br>") + "</p>"
}

func titre(description string) string {
	premiere, _, _ := strings.Cut(strings.TrimSpace(description), "\n")
	if runes := []rune(premiere); len(runes) > 80 {
		return string(runes[:79]) + "…"
	}
	return premiere
}
