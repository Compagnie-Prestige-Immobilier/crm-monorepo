package support

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	ticketIncident   = 1
	comptePilotage   = "pilotage"
	groupeCommercial = "Commerciaux"
	// Numéro de l'option de recherche « contenu » d'un ticket GLPI : la
	// réconciliation retrouve la référence CRM que la création y a inscrite.
	champContenuTicket = 21
	plageGlpi          = "range"
)

var clientGlpi = &http.Client{Timeout: 60 * time.Second}

var extensionsImages = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

type glpi struct{ url, appToken, userToken string }

func lireGlpi() glpi {
	return glpi{
		url:       strings.TrimRight(strings.TrimSpace(socle.Env("GLPI_URL", "")), "/"),
		appToken:  strings.TrimSpace(socle.Env("GLPI_APP_TOKEN", "")),
		userToken: strings.TrimSpace(socle.Env("GLPI_USER_TOKEN", "")),
	}
}

var errSansNumero = errors.New("GLPI a répondu sans numéro de ticket")

type appelGlpiError struct {
	statut  int
	methode string
	chemin  string
	corps   string
}

func (e *appelGlpiError) Error() string {
	return fmt.Sprintf("GLPI %s %s : %d %s", e.methode, e.chemin, e.statut, e.corps)
}

// Un refus du serveur distant (droits, catégorie inconnue, jeton invalide) ne
// s'arrange pas en réessayant ; 408 et 429 sont les deux exceptions.
func (e *appelGlpiError) definitif() bool {
	return e.statut >= 400 && e.statut < 500 && e.statut != http.StatusRequestTimeout && e.statut != http.StatusTooManyRequests
}

type demande struct {
	login, nom, email, roleLibelle string
	pilotage, groupe               bool
	description, contexte, origine string
	urgence, categorie             int32
	reference                      string
}

func (g glpi) creerTicket(ctx context.Context, session string, d *demande) (int, error) {
	compte, err := g.demandeur(ctx, session, d)
	if err != nil {
		return 0, err
	}
	groupe := 0
	if d.groupe {
		if groupe, err = g.rattacherAuGroupe(ctx, session, compte); err != nil {
			return 0, err
		}
	}
	var nouveau struct {
		Input struct {
			Name      string `json:"name"`
			Content   string `json:"content"`
			Type      int    `json:"type"`
			Urgence   int32  `json:"urgency"`
			Categorie int32  `json:"itilcategories_id"`
			Demandeur int    `json:"_users_id_requester"`
			Groupe    int    `json:"_groups_id_requester,omitempty"`
		} `json:"input"`
	}
	nouveau.Input.Name, nouveau.Input.Content, nouveau.Input.Type = titre(d.description), contenuTicket(d), ticketIncident
	nouveau.Input.Urgence, nouveau.Input.Categorie, nouveau.Input.Demandeur = d.urgence, d.categorie, compte
	nouveau.Input.Groupe = groupe
	corps, err := json.Marshal(nouveau)
	if err != nil {
		return 0, err
	}
	var ticket struct {
		ID int `json:"id"`
	}
	if err := g.appeler(ctx, session, http.MethodPost, "/Ticket", "application/json", bytes.NewReader(corps), &ticket); err != nil {
		return 0, err
	}
	if ticket.ID <= 0 {
		return 0, errSansNumero
	}
	return ticket.ID, nil
}

func contenuTicket(d *demande) string {
	return paragraphe(d.description) +
		paragraphe(fmt.Sprintf("Signalé par %s (%s, %s)", d.nom, d.roleLibelle, d.email)) +
		paragraphe(d.contexte) +
		paragraphe("Texte d'origine :\n"+d.origine) +
		paragraphe("Référence CRM : "+d.reference)
}

// Un seul ticket portant la référence CRM autorise à reprendre son numéro. Zéro
// ne prouve pas l'absence de création : l'indexation peut retarder, et le doute
// remonte à l'appelant plutôt que de repartir en création aveugle.
func (g glpi) ticketDeLaReference(ctx context.Context, session, reference string) (int, error) {
	requete := url.Values{
		"criteria[0][field]":      {strconv.Itoa(champContenuTicket)},
		"criteria[0][searchtype]": {"contains"},
		"criteria[0][value]":      {reference},
		"forcedisplay[0]":         {"2"},
		plageGlpi:                 {"0-4"},
	}
	var trouve struct {
		Total int              `json:"totalcount"`
		Data  []map[string]any `json:"data"`
	}
	if err := g.appeler(ctx, session, http.MethodGet, "/search/Ticket?"+requete.Encode(), "", nil, &trouve); err != nil {
		return 0, err
	}
	if trouve.Total != 1 || len(trouve.Data) != 1 {
		return 0, nil
	}
	switch numero := trouve.Data[0]["2"].(type) {
	case float64:
		return int(numero), nil
	case string:
		return strconv.Atoi(numero)
	}
	return 0, nil
}

// Un administrateur signale au nom du pilotage ; les autres sous leur compte, créé au besoin avec
// l'identifiant du panneau, que la connexion unique à GLPI retrouve ensuite.
func (g glpi) demandeur(ctx context.Context, session string, d *demande) (int, error) {
	if d.pilotage {
		id, err := g.idCompte(ctx, session, comptePilotage)
		if err == nil && id == 0 {
			err = fmt.Errorf("compte GLPI %q introuvable", comptePilotage)
		}
		return id, err
	}
	id, err := g.idCompte(ctx, session, d.login)
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
	compte.Input.Name, compte.Input.Realname, compte.Input.Emails = d.login, d.nom, []string{d.email}
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
	type groupe struct {
		ID  int    `json:"id"`
		Nom string `json:"name"`
	}
	groupes := make(chan []groupe, 1)
	erreurs := make(chan error, 2)
	go func() {
		var lues []groupe
		chemin := "/Group?" + url.Values{"searchText[name]": {"^" + groupeCommercial + "$"}, plageGlpi: {"0-5"}}.Encode()
		if err := g.appeler(ctx, session, http.MethodGet, chemin, "", nil, &lues); err != nil {
			erreurs <- err
			return
		}
		groupes <- lues
	}()
	membres := make(chan []struct {
		Groupe int `json:"groups_id"`
	}, 1)
	go func() {
		var lues []struct {
			Groupe int `json:"groups_id"`
		}
		if err := g.appeler(ctx, session, http.MethodGet, fmt.Sprintf("/User/%d/Group_User", compte), "", nil, &lues); err != nil {
			erreurs <- err
			return
		}
		membres <- lues
	}()
	var luesGroupes []groupe
	var luesMembres []struct {
		Groupe int `json:"groups_id"`
	}
	for range 2 {
		select {
		case lues := <-groupes:
			luesGroupes = lues
		case lues := <-membres:
			luesMembres = lues
		case err := <-erreurs:
			return 0, err
		}
	}
	if len(luesGroupes) == 0 {
		return 0, nil
	}
	idGroupe := luesGroupes[0].ID
	for _, m := range luesMembres {
		if m.Groupe == idGroupe {
			return idGroupe, nil
		}
	}
	corps := fmt.Sprintf(`{"input":{"users_id":%d,"groups_id":%d}}`, compte, idGroupe)
	return idGroupe, g.appeler(ctx, session, http.MethodPost, "/Group_User", "application/json", strings.NewReader(corps), nil)
}

func (g glpi) idCompte(ctx context.Context, session, login string) (int, error) {
	var comptes []struct {
		ID  int    `json:"id"`
		Nom string `json:"name"`
	}
	chemin := "/User?" + url.Values{"searchText[name]": {"^" + login + "$"}, plageGlpi: {"0-5"}}.Encode()
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

// Les documents déjà liés au ticket sont relus avant l'envoi : une réponse
// perdue laisserait sinon repartir le même fichier une seconde fois.
func (g glpi) documentDejaJoint(ctx context.Context, session string, ticketID int, nom string) (int, error) {
	var lies []struct {
		Document int    `json:"documents_id"`
		Nom      string `json:"name"`
	}
	if err := g.appeler(ctx, session, http.MethodGet, fmt.Sprintf("/Ticket/%d/Document_Item", ticketID), "", nil, &lies); err != nil {
		return 0, err
	}
	for _, l := range lies {
		if l.Nom == nom {
			return l.Document, nil
		}
	}
	return 0, nil
}

func (g glpi) joindreImage(ctx context.Context, session string, ticketID int, nom string, contenu []byte) (int, error) {
	if dejaLa, err := g.documentDejaJoint(ctx, session, ticketID, nom); err != nil || dejaLa != 0 {
		return dejaLa, err
	}
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
		return 0, err
	}
	if err := w.WriteField("uploadManifest", string(manifeste)); err != nil {
		return 0, err
	}
	partie, err := w.CreateFormFile("filename[0]", nom)
	if err != nil {
		return 0, err
	}
	if _, err := partie.Write(contenu); err != nil {
		return 0, err
	}
	if err := w.Close(); err != nil {
		return 0, err
	}
	var cree struct {
		ID int `json:"id"`
	}
	if err := g.appeler(ctx, session, http.MethodPost, "/Document", w.FormDataContentType(), &corps, &cree); err != nil {
		return 0, err
	}
	return cree.ID, nil
}

func (g glpi) categories(ctx context.Context, session string) ([]CategorieDTO, error) {
	var lues []struct {
		ID       int    `json:"id"`
		Nom      string `json:"completename"`
		Visible  int    `json:"is_helpdeskvisible"`
		Incident int    `json:"is_incident"`
	}
	if err := g.appeler(ctx, session, http.MethodGet, "/ITILCategory?range=0-500", "", nil, &lues); err != nil {
		return nil, err
	}
	catalogue := make([]CategorieDTO, 0, len(lues))
	for _, c := range lues {
		if c.Visible == 1 && c.Incident == 1 {
			catalogue = append(catalogue, CategorieDTO{ID: c.ID, Nom: c.Nom})
		}
	}
	return catalogue, nil
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
		return &appelGlpiError{statut: rep.StatusCode, methode: req.Method, chemin: req.URL.Path, corps: string(lu)}
	}
	if cible == nil {
		return nil
	}
	return json.Unmarshal(lu, cible)
}

func (g glpi) configure() bool {
	return g.url != "" && g.appToken != "" && g.userToken != ""
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
