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
	"net/url"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

var Garde = map[string]socle.Permission{
	"POST /api/v1/support/tickets":   socle.PermissionSupportSignaler,
	"GET /api/v1/support/categories": socle.PermissionSupportSignaler,
}

const (
	ticketIncident   = 1
	comptePilotage   = "pilotage"
	groupeCommercial = "Commerciaux"
)

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
		Summary:      "Ouvre un ticket GLPI au nom du signalant, avec la page et ses images.",
	}, g.creer)
	huma.Register(api, huma.Operation{
		OperationID: "categoriesSupport", Method: http.MethodGet, Path: "/api/v1/support/categories",
		Summary: "Les catégories GLPI proposées au demandeur.",
	}, g.categories)
}

type TicketInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Description string          `form:"description" required:"true" minLength:"3" maxLength:"5000"`
		Contexte    string          `form:"contexte" required:"false" maxLength:"5000"`
		Images      []huma.FormFile `form:"images" required:"false" contentType:"image/png,image/jpeg,image/webp,image/gif"`
		Urgence     int             `form:"urgence" required:"true" enum:"2,3,4"`
		Categorie   int             `form:"categorie" required:"true" minimum:"1"`
	}]
}

type CategorieDTO struct {
	ID  int    `json:"id"`
	Nom string `json:"nom"`
}

type CategoriesOutput struct {
	Body []CategorieDTO
}

func (g glpi) categories(ctx context.Context, _ *struct{}) (*CategoriesOutput, error) {
	out := &CategoriesOutput{Body: []CategorieDTO{}}
	if !g.configure() {
		return nil, nonConfigure()
	}
	session, err := g.ouvrirSession(ctx)
	if err != nil {
		return nil, glpiInjoignable(err)
	}
	defer g.fermerSession(ctx, session)
	var lues []struct {
		ID       int    `json:"id"`
		Nom      string `json:"completename"`
		Visible  int    `json:"is_helpdeskvisible"`
		Incident int    `json:"is_incident"`
	}
	if err := g.appeler(ctx, session, http.MethodGet, "/ITILCategory?range=0-500", "", nil, &lues); err != nil {
		return nil, glpiInjoignable(err)
	}
	for _, c := range lues {
		if c.Visible == 1 && c.Incident == 1 {
			out.Body = append(out.Body, CategorieDTO{ID: c.ID, Nom: c.Nom})
		}
	}
	return out, nil
}

type TicketOutput struct {
	Body struct {
		Numero int `json:"numero"`
	}
}

func (g glpi) creer(ctx context.Context, in *TicketInput) (*TicketOutput, error) {
	if !g.configure() {
		return nil, nonConfigure()
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
	demandeur, err := g.demandeur(ctx, session, &u)
	groupe := 0
	if err == nil && commercial(u.Role) {
		groupe, err = g.rattacherAuGroupe(ctx, session, demandeur)
	}
	if err != nil {
		g.fermerSession(ctx, session)
		return nil, glpiInjoignable(err)
	}
	var ticket struct {
		ID int `json:"id"`
	}
	var nouveau struct {
		Input struct {
			Name      string `json:"name"`
			Content   string `json:"content"`
			Type      int    `json:"type"`
			Urgence   int    `json:"urgency"`
			Categorie int    `json:"itilcategories_id"`
			Demandeur int    `json:"_users_id_requester"`
			Groupe    int    `json:"_groups_id_requester,omitempty"`
		} `json:"input"`
	}
	nouveau.Input.Name, nouveau.Input.Content, nouveau.Input.Type = titre(form.Description), contenu, ticketIncident
	nouveau.Input.Urgence, nouveau.Input.Categorie, nouveau.Input.Demandeur = form.Urgence, form.Categorie, demandeur
	nouveau.Input.Groupe = groupe
	corps, err := json.Marshal(nouveau)
	if err != nil {
		return nil, err
	}
	if err := g.appeler(ctx, session, http.MethodPost, "/Ticket", "application/json", bytes.NewReader(corps), &ticket); err != nil {
		g.fermerSession(ctx, session)
		return nil, glpiInjoignable(err)
	}
	images, err := lireImages(form.Images)
	if err != nil {
		slog.Warn("images illisibles pour le ticket GLPI", "ticket", ticket.ID, "err", err)
	}
	// Le signalant attend le numéro, pas les pièces jointes : elles partent après la réponse.
	go g.terminer(context.WithoutCancel(ctx), session, ticket.ID, images)
	out := &TicketOutput{}
	out.Body.Numero = ticket.ID
	return out, nil
}

type image struct {
	nom     string
	contenu []byte
}

func lireImages(fichiers []huma.FormFile) ([]image, error) {
	images := make([]image, 0, len(fichiers))
	for i, f := range fichiers {
		contenu, err := io.ReadAll(f)
		if err != nil {
			return images, err
		}
		images = append(images, image{fmt.Sprintf("image-%d%s", i+1, extensionsImages[f.ContentType]), contenu})
	}
	return images, nil
}

func (g glpi) terminer(ctx context.Context, session string, ticketID int, images []image) {
	ctx, annuler := context.WithTimeout(ctx, 2*time.Minute)
	defer annuler()
	defer g.fermerSession(ctx, session)
	for _, im := range images {
		if err := g.joindreImage(ctx, session, ticketID, im); err != nil {
			slog.Warn("image non jointe au ticket GLPI", "ticket", ticketID, "err", err)
		}
	}
}

// Un administrateur signale au nom du pilotage ; les autres sous leur compte, créé au besoin avec
// l'identifiant du panneau, que la connexion unique à GLPI retrouve ensuite.
func (g glpi) demandeur(ctx context.Context, session string, u *socle.Utilisateur) (int, error) {
	if u.Role == socle.Admin {
		id, err := g.idCompte(ctx, session, comptePilotage)
		if err == nil && id == 0 {
			err = fmt.Errorf("compte GLPI %q introuvable", comptePilotage)
		}
		return id, err
	}
	id, err := g.idCompte(ctx, session, u.Username)
	if err != nil || id != 0 {
		return id, err
	}
	var compte struct {
		Input struct {
			Name     string   `json:"name"`
			Realname string   `json:"realname"`
			Emails   []string `json:"_useremails"`
		} `json:"input"`
	}
	compte.Input.Name, compte.Input.Realname, compte.Input.Emails = u.Username, u.FullName, []string{u.Email}
	corps, err := json.Marshal(compte)
	if err != nil {
		return 0, err
	}
	var cree struct {
		ID int `json:"id"`
	}
	err = g.appeler(ctx, session, http.MethodPost, "/User", "application/json", bytes.NewReader(corps), &cree)
	return cree.ID, err
}

func commercial(role socle.Role) bool {
	return role == socle.Superviseur || role == socle.Direction
}

// Le groupe est créé dans GLPI par l'administrateur ; son absence laisse partir le ticket sans groupe.
func (g glpi) rattacherAuGroupe(ctx context.Context, session string, compte int) (int, error) {
	var groupes []struct {
		ID  int    `json:"id"`
		Nom string `json:"name"`
	}
	chemin := "/Group?" + url.Values{"searchText[name]": {"^" + groupeCommercial + "$"}, "range": {"0-5"}}.Encode()
	if err := g.appeler(ctx, session, http.MethodGet, chemin, "", nil, &groupes); err != nil || len(groupes) == 0 {
		return 0, err
	}
	var membres []struct {
		Groupe int `json:"groups_id"`
	}
	if err := g.appeler(ctx, session, http.MethodGet, fmt.Sprintf("/User/%d/Group_User", compte), "", nil, &membres); err != nil {
		return 0, err
	}
	for _, m := range membres {
		if m.Groupe == groupes[0].ID {
			return m.Groupe, nil
		}
	}
	corps := fmt.Sprintf(`{"input":{"users_id":%d,"groups_id":%d}}`, compte, groupes[0].ID)
	return groupes[0].ID, g.appeler(ctx, session, http.MethodPost, "/Group_User", "application/json", strings.NewReader(corps), nil)
}

func (g glpi) idCompte(ctx context.Context, session, login string) (int, error) {
	var comptes []struct {
		ID  int    `json:"id"`
		Nom string `json:"name"`
	}
	chemin := "/User?" + url.Values{"searchText[name]": {"^" + login + "$"}, "range": {"0-5"}}.Encode()
	if err := g.appeler(ctx, session, http.MethodGet, chemin, "", nil, &comptes); err != nil {
		return 0, err
	}
	for _, c := range comptes {
		if strings.EqualFold(c.Nom, login) {
			return c.ID, nil
		}
	}
	return 0, nil
}

func (g glpi) joindreImage(ctx context.Context, session string, ticketID int, im image) error {
	nom := im.nom
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
	if _, err := partie.Write(im.contenu); err != nil {
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

func (g glpi) configure() bool {
	return g.url != "" && g.appToken != "" && g.userToken != ""
}

func nonConfigure() error {
	return socle.Problem(http.StatusServiceUnavailable, "SUPPORT_NON_CONFIGURE", "Le support n'est pas encore relié à GLPI. Prévenez l'administrateur.")
}

func glpiInjoignable(err error) error {
	slog.Error("appel GLPI en échec", "err", err)
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
