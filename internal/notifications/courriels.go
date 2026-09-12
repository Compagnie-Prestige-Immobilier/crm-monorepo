package notifications

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"html"
	"log/slog"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	CourrielDossierComplet     = "DOSSIER_COMPLET"
	CourrielDossierEncaisse    = "DOSSIER_ENCAISSE"
	CourrielDossierRejete      = "DOSSIER_REJETE"
	CourrielProspectEnrolement = "PROSPECT_ENROLEMENT"
	CourrielImportLeads        = "IMPORT_LEADS"

	CourrielEnvoye = "ENVOYE"
	CourrielRemis  = "REMIS"
	CourrielOuvert = "OUVERT"
	CourrielEchec  = "ECHEC"

	cleReglagesCourriels = "courriels.destinataires"
	sujetCourriels       = "courriels"
	courrielsPageMax     = 100
)

type Courriel struct {
	Type           string
	Sujet          string
	Destinataires  []string
	Copies         []string
	ObjetType      string
	ObjetID        string
	Titre          string
	Intro          string
	Lignes         [][2]string
	Lien           string
	LibelleLien    string
	NomPieceJointe string
}

// Un courriel se règle en entier : à qui, en copie, et le texte d'introduction.
// L'intro vide envoie le texte d'origine.
type ReglageCourriel struct {
	Destinataires []string `json:"destinataires" maxItems:"20"`
	Copies        []string `json:"copies" maxItems:"20"`
	Intro         string   `json:"intro" maxLength:"1000"`
}

type ReglagesCourriels struct {
	Enrolement   ReglageCourriel `json:"enrolement"`
	Encaissement ReglageCourriel `json:"encaissement"`
	Refus        ReglageCourriel `json:"refus"`
	ImportLeads  ReglageCourriel `json:"importLeads"`
}

// Ce que l'écran montre à côté de chaque texte : les mots remplacés à l'envoi
// et le texte d'origine, pour le rétablir d'un clic.
type AideCourriel struct {
	IntroUsine string   `json:"introUsine"`
	Variables  []string `json:"variables"`
}

type AidesCourriels struct {
	Enrolement   AideCourriel `json:"enrolement"`
	Encaissement AideCourriel `json:"encaissement"`
	Refus        AideCourriel `json:"refus"`
	ImportLeads  AideCourriel `json:"importLeads"`
}

type ReglagesCourrielsDTO struct {
	Enrolement   ReglageCourriel `json:"enrolement"`
	Encaissement ReglageCourriel `json:"encaissement"`
	Refus        ReglageCourriel `json:"refus"`
	ImportLeads  ReglageCourriel `json:"importLeads"`
	Aide         AidesCourriels  `json:"aide"`
}

// Les mots communs aux trois courriels ; chacun ajoute les siens.
const (
	VariableClient         = "client"
	VariableBanque         = "banque"
	VariableTeleconseiller = "teleconseiller"
	VariableProjet         = "projet"
	VariableReference      = "reference"
)

var aidesCourriels = AidesCourriels{
	Enrolement: AideCourriel{
		IntroUsine: "{teleconseiller} a obtenu la méthode d’enrôlement « {methode} » pour {client}. " +
			"Rendez-vous : {rendezVous}. Le prospect est transmis à l’équipe enrôlement.",
		Variables: []string{VariableClient, "telephone", "methode", "rendezVous", VariableTeleconseiller, VariableBanque, VariableProjet},
	},
	Encaissement: AideCourriel{
		IntroUsine: "Le dossier {reference} de {client} a été encaissé par {banque} : {montant}.",
		Variables:  []string{VariableReference, VariableClient, VariableBanque, "montant", VariableTeleconseiller, VariableProjet},
	},
	Refus: AideCourriel{
		IntroUsine: "Le dossier {reference} de {client} a été rejeté par {banque}. Motif : {motif}.",
		Variables:  []string{VariableReference, VariableClient, VariableBanque, "motif", VariableTeleconseiller, VariableProjet},
	},
	ImportLeads: AideCourriel{
		IntroUsine: "Le classeur des leads « {fichier} » a été relevé le {date} : {lues} lignes lues, " +
			"{creees} fiches créées, {refusees} lignes refusées.",
		Variables: []string{"fichier", "date", "lues", "creees", "refusees"},
	},
}

// Le texte réglé, ou celui d'origine s'il est vide, avec ses mots remplacés.
func IntroCourriel(reglage *ReglageCourriel, aide *AideCourriel, valeurs map[string]string) string {
	texte := strings.TrimSpace(reglage.Intro)
	if texte == "" {
		texte = aide.IntroUsine
	}
	paires := make([]string, 0, 2*len(valeurs))
	for cle, valeur := range valeurs {
		paires = append(paires, "{"+cle+"}", valeur)
	}
	return strings.NewReplacer(paires...).Replace(texte)
}

func AideEnrolement() *AideCourriel   { return &aidesCourriels.Enrolement }
func AideEncaissement() *AideCourriel { return &aidesCourriels.Encaissement }
func AideRefus() *AideCourriel        { return &aidesCourriels.Refus }
func AideImportLeads() *AideCourriel  { return &aidesCourriels.ImportLeads }

type CourrielDTO struct {
	ID             string     `json:"id"`
	Type           string     `json:"type"`
	Sujet          string     `json:"sujet"`
	Destinataires  []string   `json:"destinataires"`
	Copies         []string   `json:"copies"`
	ObjetType      string     `json:"objetType"`
	ObjetID        string     `json:"objetId"`
	NomPieceJointe *string    `json:"nomPieceJointe"`
	Statut         string     `json:"statut" enum:"ENVOYE,REMIS,OUVERT,ECHEC"`
	Erreur         *string    `json:"erreur"`
	EnvoyeLe       *time.Time `json:"envoyeLe"`
	RemisLe        *time.Time `json:"remisLe"`
	OuvertLe       *time.Time `json:"ouvertLe"`
	CreatedAt      time.Time  `json:"createdAt"`
}

func LireReglagesCourriels(ctx context.Context, d *socle.Deps) (ReglagesCourriels, error) {
	var r ReglagesCourriels
	ligne, err := d.Q.GetSetting(ctx, cleReglagesCourriels)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, nil
	}
	if err != nil {
		return r, err
	}
	_ = json.Unmarshal([]byte(ligne.Value), &r)
	return r, nil
}

// L'envoi est tracé même sans destinataire ni transport : le journal doit
// montrer ce qui n'est pas parti et pourquoi.
func EnvoyerCourriel(ctx context.Context, d *socle.Deps, c *Courriel) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	c.Destinataires, c.Copies = adressesPropres(c.Destinataires), adressesPropres(c.Copies)
	htmlCorps, texte := courrielCorps(c)
	var pdf []byte
	var nomPDF *string
	if c.NomPieceJointe != "" {
		if pdf, err = courrielPDF(c, time.Now(), d.Cfg.TimeZone); err != nil {
			return err
		}
		nomPDF = &c.NomPieceJointe
	}
	statut, messageID, erreur, envoyeLe := expedierCourriel(ctx, &MessageBrevo{
		Destinataires: courrielAdresses(c.Destinataires), Copies: courrielAdresses(c.Copies),
		Sujet: c.Sujet, HTML: htmlCorps, Texte: texte, PieceJointe: courrielPiece(nomPDF, pdf),
	})
	err = d.Q.CourrielInsert(ctx, db.CourrielInsertParams{
		ID: id.String(), Type: c.Type, Sujet: c.Sujet, Destinataires: c.Destinataires, Copies: c.Copies,
		ObjetType: c.ObjetType, ObjetId: c.ObjetID, Html: htmlCorps, Texte: texte,
		NomPieceJointe: nomPDF, PieceJointe: pdf, Statut: statut, MessageId: messageID, Erreur: erreur, EnvoyeLe: envoyeLe,
	})
	d.Live.Emettre(sujetCourriels)
	return err
}

const (
	tentativesCourrielMax = 3
	courrielsParRejeu     = 20
)

// Un refus de Brevo perdait le courriel : le statut passait à ECHEC et personne
// ne le reprenait. Trois tentatives, puis la ligne reste en échec pour l'alerte.
func (s *service) rejouerCourrielsEnEchec(ctx context.Context) error {
	lignes, err := s.Q.CourrielsARejouer(ctx, db.CourrielsARejouerParams{
		TentativesMax: tentativesCourrielMax, Prendre: courrielsParRejeu,
	})
	if err != nil || len(lignes) == 0 {
		return err
	}
	var echecs []error
	for i := range lignes {
		l := &lignes[i]
		statut, messageID, erreur, envoyeLe := expedierCourriel(ctx, &MessageBrevo{
			Destinataires: courrielAdresses(l.Destinataires), Copies: courrielAdresses(l.Copies),
			Sujet: l.Sujet, HTML: l.Html, Texte: l.Texte, PieceJointe: courrielPiece(l.NomPieceJointe, l.PieceJointe),
		})
		if err := s.Q.CourrielRejeuEnregistre(ctx, db.CourrielRejeuEnregistreParams{
			ID: l.ID, Statut: statut, MessageId: messageID, Erreur: erreur, EnvoyeLe: envoyeLe,
		}); err != nil {
			echecs = append(echecs, err)
		}
	}
	s.Live.Emettre(sujetCourriels)
	return errors.Join(echecs...)
}

// Un envoi refusé ne se lisait que dans la colonne `erreur` du journal, écran
// Exploitation ouvert. C'est ainsi qu'une clé Brevo invalide a pu refuser tous
// les courriels d'une journée sans qu'une ligne le dise.
func expedierCourriel(ctx context.Context, message *MessageBrevo) (statut string, messageID, erreur *string, envoyeLe *time.Time) {
	if len(message.Destinataires) == 0 {
		detail := "Aucun destinataire configuré dans les réglages des courriels."
		slog.Error("courriel non expédié", "sujet", message.Sujet, "cause", detail)
		return CourrielEchec, nil, &detail, nil
	}
	transport := ConfigurerBrevo()
	envoi := transport.Envoyer(ctx, []MessageBrevo{*message})
	if envoi.Statut != BrevoEnvoye {
		detail := envoi.detail
		if detail == "" {
			detail = envoi.Statut
		}
		slog.Error("courriel non expédié", "sujet", message.Sujet,
			"destinataires", len(message.Destinataires), "copies", len(message.Copies),
			"statut", envoi.Statut, "cause", detail)
		return CourrielEchec, nil, &detail, nil
	}
	maintenant := time.Now()
	var id *string
	if envoi.MessageID != "" {
		id = &envoi.MessageID
	}
	slog.Info("courriel expédié", "sujet", message.Sujet,
		"destinataires", len(message.Destinataires), "copies", len(message.Copies),
		"messageId", envoi.MessageID)
	return CourrielEnvoye, id, nil, &maintenant
}

func courrielPiece(nom *string, contenu []byte) *PieceJointeBrevo {
	if nom == nil || len(contenu) == 0 {
		return nil
	}
	return &PieceJointeBrevo{Nom: *nom, Contenu: contenu}
}

func courrielAdresses(liste []string) []DestinataireBrevo {
	adresses := make([]DestinataireBrevo, 0, len(liste))
	for _, email := range liste {
		adresses = append(adresses, DestinataireBrevo{Email: email})
	}
	return adresses
}

func courrielCorps(c *Courriel) (htmlCorps, texte string) {
	var h, t strings.Builder
	h.WriteString("<p>Bonjour,</p><p>" + html.EscapeString(c.Intro) + "</p><table cellpadding=\"4\">")
	t.WriteString("Bonjour,\n\n" + c.Intro + "\n\n")
	for _, ligne := range c.Lignes {
		h.WriteString("<tr><td><strong>" + html.EscapeString(ligne[0]) + "</strong></td><td>" + html.EscapeString(ligne[1]) + "</td></tr>")
		t.WriteString(ligne[0] + " : " + ligne[1] + "\n")
	}
	h.WriteString("</table>")
	if c.Lien != "" {
		h.WriteString("<p><a href=\"" + html.EscapeString(c.Lien) + "\">" + html.EscapeString(c.LibelleLien) + "</a></p>")
		t.WriteString("\n" + c.LibelleLien + " : " + c.Lien + "\n")
	}
	pied := "Message envoyé automatiquement par CPI GO."
	if c.NomPieceJointe != "" {
		pied += " La fiche détaillée est jointe en PDF."
	}
	h.WriteString("<p>" + pied + "</p>")
	t.WriteString("\n" + pied + "\n")
	return h.String(), t.String()
}

func courrielVersDTO(r *db.CourrielsParObjetRow) CourrielDTO {
	return CourrielDTO{
		ID: r.ID, Type: r.Type, Sujet: r.Sujet, Destinataires: r.Destinataires, Copies: r.Copies,
		ObjetType: r.ObjetType, ObjetID: r.ObjetId, NomPieceJointe: r.NomPieceJointe, Statut: r.Statut,
		Erreur: r.Erreur, EnvoyeLe: r.EnvoyeLe, RemisLe: r.RemisLe, OuvertLe: r.OuvertLe, CreatedAt: r.CreatedAt,
	}
}

type CourrielsObjetInput struct {
	ObjetType string `path:"objetType" enum:"bank_case,inscription,prospect"`
	ObjetID   string `path:"objetId" maxLength:"64"`
}

type CourrielsOutput struct {
	Body struct {
		Items []CourrielDTO     `json:"items"`
		Meta  MetaNotifications `json:"meta"`
	}
}

func (s *service) courrielsParObjet(ctx context.Context, in *CourrielsObjetInput) (*CourrielsOutput, error) {
	lignes, err := s.Q.CourrielsParObjet(ctx, db.CourrielsParObjetParams{ObjetType: in.ObjetType, ObjetId: in.ObjetID})
	if err != nil {
		return nil, err
	}
	out := &CourrielsOutput{}
	out.Body.Items = make([]CourrielDTO, 0, len(lignes))
	for i := range lignes {
		out.Body.Items = append(out.Body.Items, courrielVersDTO(&lignes[i]))
	}
	out.Body.Meta = notificationPagination(len(lignes), 1, max(len(lignes), 1))
	return out, nil
}

type CourrielsJournalInput struct {
	Type     string `query:"type" enum:"DOSSIER_COMPLET,DOSSIER_ENCAISSE,DOSSIER_REJETE,PROSPECT_ENROLEMENT,IMPORT_LEADS"`
	Statut   string `query:"statut" enum:"ENVOYE,REMIS,OUVERT,ECHEC"`
	Page     int    `query:"page" minimum:"1" default:"1"`
	PageSize int    `query:"pageSize" minimum:"1" maximum:"100" default:"25"`
}

func (s *service) courrielsJournal(ctx context.Context, in *CourrielsJournalInput) (*CourrielsOutput, error) {
	typeFiltre, statutFiltre := notificationTexteOuNil(in.Type), notificationTexteOuNil(in.Statut)
	total, err := s.Q.CourrielsJournalCount(ctx, db.CourrielsJournalCountParams{Type: typeFiltre, Statut: statutFiltre})
	if err != nil {
		return nil, err
	}
	taille := min(in.PageSize, courrielsPageMax)
	lignes, err := s.Q.CourrielsJournal(ctx, db.CourrielsJournalParams{
		Type: typeFiltre, Statut: statutFiltre, PageSize: int64(taille), PageOffset: int64((in.Page - 1) * taille),
	})
	if err != nil {
		return nil, err
	}
	out := &CourrielsOutput{}
	out.Body.Items = make([]CourrielDTO, 0, len(lignes))
	for i := range lignes {
		out.Body.Items = append(out.Body.Items, courrielVersDTO((*db.CourrielsParObjetRow)(&lignes[i])))
	}
	out.Body.Meta = notificationPagination(int(total), in.Page, taille)
	return out, nil
}

type CourrielIDInput struct {
	ID string `path:"id" format:"uuid"`
}

type CourrielOutput struct {
	Body CourrielDTO
}

func (s *service) renvoyerCourriel(ctx context.Context, in *CourrielIDInput) (*CourrielOutput, error) {
	ligne, err := s.Q.CourrielByID(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "COURRIEL_NOT_FOUND", "Courriel introuvable.")
	}
	if err != nil {
		return nil, err
	}
	statut, messageID, erreur, envoyeLe := expedierCourriel(ctx, &MessageBrevo{
		Destinataires: courrielAdresses(ligne.Destinataires), Copies: courrielAdresses(ligne.Copies),
		Sujet: ligne.Sujet, HTML: ligne.Html, Texte: ligne.Texte, PieceJointe: courrielPiece(ligne.NomPieceJointe, ligne.PieceJointe),
	})
	if err := s.Q.CourrielRenvoye(ctx, db.CourrielRenvoyeParams{
		ID: ligne.ID, Statut: statut, MessageId: messageID, Erreur: erreur, EnvoyeLe: envoyeLe,
	}); err != nil {
		return nil, err
	}
	s.Live.Emettre(sujetCourriels)
	relu, err := s.Q.CourrielsParObjet(ctx, db.CourrielsParObjetParams{ObjetType: ligne.ObjetType, ObjetId: ligne.ObjetId})
	if err != nil {
		return nil, err
	}
	for i := range relu {
		if relu[i].ID == ligne.ID {
			return &CourrielOutput{Body: courrielVersDTO(&relu[i])}, nil
		}
	}
	return nil, socle.Problem(http.StatusNotFound, "COURRIEL_NOT_FOUND", "Courriel introuvable.")
}

type ReglagesCourrielsOutput struct {
	Body ReglagesCourrielsDTO
}

type ReglagesCourrielsInput struct {
	Body ReglagesCourriels
}

func courrielsReglagesDTO(r *ReglagesCourriels) ReglagesCourrielsDTO {
	return ReglagesCourrielsDTO{
		Enrolement: r.Enrolement, Encaissement: r.Encaissement, Refus: r.Refus, ImportLeads: r.ImportLeads,
		Aide: aidesCourriels,
	}
}

func (s *service) lireReglagesCourriels(ctx context.Context, _ *struct{}) (*ReglagesCourrielsOutput, error) {
	r, err := LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		return nil, err
	}
	propres := courrielsReglagesPropres(&r)
	return &ReglagesCourrielsOutput{Body: courrielsReglagesDTO(&propres)}, nil
}

func (s *service) ecrireReglagesCourriels(ctx context.Context, in *ReglagesCourrielsInput) (*ReglagesCourrielsOutput, error) {
	r := courrielsReglagesPropres(&in.Body)
	for _, reglage := range []ReglageCourriel{r.Enrolement, r.Encaissement, r.Refus, r.ImportLeads} {
		for _, adresse := range append(append([]string{}, reglage.Destinataires...), reglage.Copies...) {
			if _, err := mail.ParseAddress(adresse); err != nil {
				return nil, socle.Problem(http.StatusUnprocessableEntity, "COURRIEL_ADRESSE_INVALIDE",
					"Adresse invalide : "+adresse)
			}
		}
	}
	valeur, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	u := socle.UtilisateurCourant(ctx)
	avant, err := LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		return nil, err
	}
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if _, err := q.UpsertSetting(ctx, db.UpsertSettingParams{Key: cleReglagesCourriels, Value: string(valeur), UpdatedById: &u.ID}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, u.ID, "courriels.reglages", "courriels", cleReglagesCourriels, avant, r)
	}); err != nil {
		return nil, err
	}
	return &ReglagesCourrielsOutput{Body: courrielsReglagesDTO(&r)}, nil
}

func adressesPropres(liste []string) []string {
	propres := make([]string, 0, len(liste))
	for _, adresse := range liste {
		if a := strings.ToLower(strings.TrimSpace(adresse)); a != "" {
			propres = append(propres, a)
		}
	}
	return propres
}

func reglageCourrielPropre(r *ReglageCourriel) ReglageCourriel {
	return ReglageCourriel{
		Destinataires: adressesPropres(r.Destinataires), Copies: adressesPropres(r.Copies),
		Intro: strings.TrimSpace(r.Intro),
	}
}

func courrielsReglagesPropres(r *ReglagesCourriels) ReglagesCourriels {
	return ReglagesCourriels{
		Enrolement:   reglageCourrielPropre(&r.Enrolement),
		Encaissement: reglageCourrielPropre(&r.Encaissement),
		Refus:        reglageCourrielPropre(&r.Refus),
		ImportLeads:  reglageCourrielPropre(&r.ImportLeads),
	}
}

type EvenementBrevoInput struct {
	Secret string `query:"secret" maxLength:"200"`
	Body   struct {
		Event     string `json:"event"`
		MessageID string `json:"message-id"`
		Reason    string `json:"reason,omitempty"`
	}
}

var evenementsBrevo = map[string]string{
	"delivered": CourrielRemis, "opened": CourrielOuvert, "unique_opened": CourrielOuvert, "click": CourrielOuvert,
	"hard_bounce": CourrielEchec, "soft_bounce": CourrielEchec, "blocked": CourrielEchec, "spam": CourrielEchec,
	"invalid_email": CourrielEchec, "error": CourrielEchec,
}

// Brevo ne signe pas ses webhooks : le secret voyage dans l'URL configurée
// chez Brevo et se compare ici. Sans BREVO_WEBHOOK_SECRET, la route n'existe pas.
func (s *service) evenementBrevo(ctx context.Context, in *EvenementBrevoInput) (*struct{}, error) {
	secret := socle.Env("BREVO_WEBHOOK_SECRET", "")
	if secret == "" || in.Secret != secret {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Route inconnue.")
	}
	statut, connu := evenementsBrevo[in.Body.Event]
	if !connu || in.Body.MessageID == "" {
		return &struct{}{}, nil
	}
	n, err := s.Q.CourrielEvenementBrevo(ctx, db.CourrielEvenementBrevoParams{
		Statut: statut, Quand: time.Now(), Erreur: in.Body.Event + " " + in.Body.Reason, MessageID: in.Body.MessageID,
	})
	if err != nil {
		return nil, err
	}
	if n > 0 {
		s.Live.Emettre(sujetCourriels)
	}
	return &struct{}{}, nil
}

func (s *service) monterCourriels(api huma.API) {
	huma.Register(api, huma.Operation{OperationID: "listCourriels", Method: http.MethodGet, Path: "/api/v1/courriels"}, s.courrielsJournal)
	huma.Register(api, huma.Operation{OperationID: "getCourrielsReglages", Method: http.MethodGet, Path: "/api/v1/courriels/reglages"}, s.lireReglagesCourriels)
	huma.Register(api, huma.Operation{OperationID: "putCourrielsReglages", Method: http.MethodPut, Path: "/api/v1/courriels/reglages"}, s.ecrireReglagesCourriels)
	huma.Register(api, huma.Operation{OperationID: "listCourrielsObjet", Method: http.MethodGet, Path: "/api/v1/courriels/objet/{objetType}/{objetId}"}, s.courrielsParObjet)
	huma.Register(api, huma.Operation{OperationID: "resendCourriel", Method: http.MethodPost, Path: "/api/v1/courriels/{id}/renvoyer"}, s.renvoyerCourriel)
	huma.Register(api, huma.Operation{OperationID: "brevoWebhook", Method: http.MethodPost, Path: "/api/v1/webhooks/brevo"}, s.evenementBrevo)
}

var GardeCourriels = map[string][]socle.Role{
	"GET /api/v1/courriels":                             socle.AdminSeul,
	"GET /api/v1/courriels/reglages":                    socle.AdminSeul,
	"PUT /api/v1/courriels/reglages":                    socle.AdminSeul,
	"GET /api/v1/courriels/objet/{objetType}/{objetId}": socle.Banque,
	"POST /api/v1/courriels/{id}/renvoyer":              socle.Banque,
	"POST /api/v1/webhooks/brevo":                       {socle.Public},
}
