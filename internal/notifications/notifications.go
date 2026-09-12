package notifications

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	notificationBailExpedition = 15 * time.Minute
	notificationDelaiAbandon   = 24 * time.Hour
	notificationTailleVague    = brevoDestinatairesParAppel * brevoAppelsSimultanes

	notificationCleNom            = "name"
	notificationErreurAReessayer  = "EMAIL_RETRY"
	notificationErreurBoiteSeule  = "INBOX_ONLY"
	notificationVerdictRemis      = "sent"
	notificationVerdictAReessayer = "retry"
	notificationVerdictEchoue     = "failed"

	notificationCategorieDefaut = "ANNONCE"
	notificationStatutEnCours   = "SENDING"
	notificationStatutProgramme = "SCHEDULED"

	notificationCleRappelsAPasser        = "due-callbacks"
	notificationCleDossiersEnAttente     = "bank-cases-pending"
	notificationCleDossiersSansMouvement = "bank-cases-stale"
	notificationCleCompteRendu           = "daily-report"
)

var (
	notificationMotifRoute      = regexp.MustCompile(`^/[A-Za-z0-9\-._~/%?&=+:@!$'(),;\[\]*]*$`)
	notificationMotifVariable   = regexp.MustCompile(`\{\{\s*([A-Za-z0-9_.]+)\s*\}\}`)
	notificationMotifHeureCron  = regexp.MustCompile(`^([01]\d|2[0-3]):([0-5]\d)$`)
	notificationRolesEncadrants = []string{string(socle.Admin), string(socle.Superviseur), string(socle.Direction)}
)

type MetaNotifications struct {
	Total     int `json:"total"`
	Page      int `json:"page"`
	PageSize  int `json:"pageSize"`
	PageCount int `json:"pageCount"`
}

type NotificationComptes struct {
	Total     int `json:"total"`
	Pending   int `json:"pending"`
	Sent      int `json:"sent"`
	Delivered int `json:"delivered"`
	Failed    int `json:"failed"`
	Read      int `json:"read"`
}

type Notification struct {
	ID              string              `json:"id"`
	Title           string              `json:"title"`
	Body            string              `json:"body"`
	Category        string              `json:"category" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
	Route           *string             `json:"route"`
	Audience        string              `json:"audience" enum:"ALL,ROLE,DEPARTEMENT,USERS"`
	AudienceRole    *string             `json:"audienceRole"`
	AudienceUserIDs []string            `json:"audienceUserIds"`
	Status          string              `json:"status" enum:"SCHEDULED,SENDING,SENT,CANCELLED"`
	ScheduledFor    *time.Time          `json:"scheduledFor"`
	SentAt          *time.Time          `json:"sentAt"`
	CancelledAt     *time.Time          `json:"cancelledAt"`
	TransportStatus *string             `json:"transportStatus"`
	CreatedByName   *string             `json:"createdByName"`
	CreatedAt       time.Time           `json:"createdAt"`
	Counts          NotificationComptes `json:"counts"`
}

type NotificationDestinataire struct {
	UserID   string     `json:"userId"`
	FullName string     `json:"fullName"`
	Role     string     `json:"role" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	Status   string     `json:"status" enum:"PENDING,SENT,DELIVERED,FAILED,READ"`
	Error    *string    `json:"error"`
	SentAt   *time.Time `json:"sentAt"`
	ReadAt   *time.Time `json:"readAt"`
}

type NotificationRecue struct {
	ID             string     `json:"id"`
	NotificationID string     `json:"notificationId"`
	Title          string     `json:"title"`
	Body           string     `json:"body"`
	Category       string     `json:"category" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
	Route          *string    `json:"route"`
	IsRead         bool       `json:"isRead"`
	ReadAt         *time.Time `json:"readAt"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type GabaritNotification struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Category      string    `json:"category" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
	TitleTemplate string    `json:"titleTemplate"`
	BodyTemplate  string    `json:"bodyTemplate"`
	Route         *string   `json:"route"`
	Variables     []string  `json:"variables"`
	IsActive      bool      `json:"isActive"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type CreationNotification struct {
	Title           string     `json:"title" minLength:"1" maxLength:"120"`
	Body            string     `json:"body" minLength:"1" maxLength:"500"`
	Category        string     `json:"category,omitempty" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
	Route           string     `json:"route,omitempty" maxLength:"300" pattern:"^/[A-Za-z0-9\\-._~/%?&=+:@!$'(),;\\[\\]*]*$"`
	Audience        string     `json:"audience" enum:"ALL,ROLE,DEPARTEMENT,USERS"`
	AudienceRole    string     `json:"audienceRole,omitempty" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	AudienceUserIDs []string   `json:"audienceUserIds,omitempty" maxItems:"1000"`
	ScheduledFor    *time.Time `json:"scheduledFor,omitempty"`
	TemplateID      string     `json:"templateId,omitempty" format:"uuid"`
}

// Les `OperationID` sont ceux de la v1 : la checklist de parité les nomme, et
// une génération automatique produirait `get-api-v1-notifications`.
func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	poste := func(operation, chemin string) huma.Operation {
		return huma.Operation{
			OperationID: operation, Method: http.MethodPost,
			Path: chemin, DefaultStatus: http.StatusCreated,
		}
	}
	lit := func(operation, chemin string) huma.Operation {
		return huma.Operation{OperationID: operation, Method: http.MethodGet, Path: chemin}
	}

	huma.Register(api, poste("createNotification", "/api/v1/notifications"), s.creerNotification)
	huma.Register(api, lit("listNotifications", "/api/v1/notifications"), s.listerNotifications)
	huma.Register(api, lit("listMyNotifications", "/api/v1/notifications/mine"), s.boiteDeReceptionNotifications)
	huma.Register(api, lit("previewNotificationAudience", "/api/v1/notifications/audience-preview"), s.apercuAudienceNotification)
	huma.Register(api, lit("getNotification", "/api/v1/notifications/{id}"), s.detailNotification)
	huma.Register(api, poste("cancelNotification", "/api/v1/notifications/{id}/cancel"), s.annulerNotification)
	huma.Register(api, poste("markNotificationRead", "/api/v1/notifications/{id}/read"), s.marquerNotificationLue)

	huma.Register(api, lit("listNotificationTemplates", "/api/v1/notification-templates"), s.listerGabaritsNotification)
	huma.Register(api, poste("createNotificationTemplate", "/api/v1/notification-templates"), s.creerGabaritNotification)
	huma.Register(api, lit("getNotificationTemplate", "/api/v1/notification-templates/{id}"), s.detailGabaritNotification)
	huma.Register(api, huma.Operation{
		OperationID: "updateNotificationTemplate", Method: http.MethodPatch,
		Path: "/api/v1/notification-templates/{id}",
	}, s.modifierGabaritNotification)
	huma.Register(api, poste("renderNotificationTemplate", "/api/v1/notification-templates/{id}/render"), s.rendreGabaritNotification)
	s.monterCourriels(api)
}

var Garde = map[string][]socle.Role{
	"POST /api/v1/notifications":                      socle.AdminSeul,
	"GET /api/v1/notifications":                       socle.AdminSeul,
	"GET /api/v1/notifications/mine":                  socle.Tous,
	"GET /api/v1/notifications/audience-preview":      socle.AdminSeul,
	"GET /api/v1/notifications/{id}":                  socle.AdminSeul,
	"POST /api/v1/notifications/{id}/cancel":          socle.AdminSeul,
	"POST /api/v1/notifications/{id}/read":            socle.Tous,
	"GET /api/v1/notification-templates":              socle.AdminSeul,
	"POST /api/v1/notification-templates":             socle.AdminSeul,
	"GET /api/v1/notification-templates/{id}":         socle.AdminSeul,
	"PATCH /api/v1/notification-templates/{id}":       socle.AdminSeul,
	"POST /api/v1/notification-templates/{id}/render": socle.AdminSeul,
}

// L'heure des rappels vient de l'environnement : elle ne peut pas s'écrire
// dans le littéral de `tachesDomaines`.
func cronNotifications(nom, defaut string) string {
	parts := notificationMotifHeureCron.FindStringSubmatch(socle.Env(nom, defaut))
	if parts == nil {
		parts = notificationMotifHeureCron.FindStringSubmatch(defaut)
	}
	return parts[2] + " " + parts[1] + " * * *"
}

// Gabarits

func notificationVariablesGabarit(gabarits ...string) []string {
	noms := []string{}
	for _, gabarit := range gabarits {
		for _, trouve := range notificationMotifVariable.FindAllStringSubmatch(gabarit, -1) {
			if !slices.Contains(noms, trouve[1]) {
				noms = append(noms, trouve[1])
			}
		}
	}
	return noms
}

// Une variable absente n'est pas une erreur : le marqueur reste visible et son
// nom remonte, ce qui laisse l'interface avertir sans interrompre la frappe.
func notificationRendreTexte(gabarit string, variables map[string]string, manquantes *[]string) string {
	return notificationMotifVariable.ReplaceAllStringFunc(gabarit, func(marqueur string) string {
		nom := notificationMotifVariable.FindStringSubmatch(marqueur)[1]
		valeur := variables[nom]
		if valeur == "" {
			if !slices.Contains(*manquantes, nom) {
				*manquantes = append(*manquantes, nom)
			}
			return marqueur
		}
		return valeur
	})
}

func notificationVersGabarit(r *db.NotificationTemplateRow) GabaritNotification {
	variables := r.Variables
	if variables == nil {
		variables = []string{}
	}
	return GabaritNotification{
		ID: r.ID, Name: r.Name, Category: r.Category, TitleTemplate: r.TitleTemplate,
		BodyTemplate: r.BodyTemplate, Route: r.Route, Variables: variables,
		IsActive: r.IsActive, UpdatedAt: r.UpdatedAt,
	}
}

type NotificationGabaritsOutput struct {
	Body struct {
		Items []GabaritNotification `json:"items"`
	}
}

type NotificationGabaritsInput struct {
	IncludeInactive bool `query:"includeInactive"`
}

func (s *service) listerGabaritsNotification(ctx context.Context, in *NotificationGabaritsInput) (*NotificationGabaritsOutput, error) {
	rows, err := s.Q.ListNotificationTemplates(ctx, in.IncludeInactive)
	if err != nil {
		return nil, err
	}
	out := &NotificationGabaritsOutput{}
	out.Body.Items = []GabaritNotification{}
	for i := range rows {
		gabarit := db.NotificationTemplateRow(rows[i])
		out.Body.Items = append(out.Body.Items, notificationVersGabarit(&gabarit))
	}
	return out, nil
}

type NotificationGabaritOutput struct {
	Body GabaritNotification
}

type NotificationGabaritIDInput struct {
	ID string `path:"id" format:"uuid"`
}

func (s *service) gabaritNotificationVisible(ctx context.Context, id string) (db.NotificationTemplateRow, error) {
	row, err := s.Q.NotificationTemplate(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return row, socle.Problem(http.StatusNotFound, "NOTIFICATION_TEMPLATE_NOT_FOUND", "Gabarit introuvable.")
	}
	return row, err
}

func (s *service) detailGabaritNotification(ctx context.Context, in *NotificationGabaritIDInput) (*NotificationGabaritOutput, error) {
	row, err := s.gabaritNotificationVisible(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &NotificationGabaritOutput{Body: notificationVersGabarit(&row)}, nil
}

type NotificationCreerGabaritInput struct {
	Body struct {
		Name          string `json:"name" minLength:"2" maxLength:"80"`
		Category      string `json:"category,omitempty" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
		TitleTemplate string `json:"titleTemplate" minLength:"1" maxLength:"120"`
		BodyTemplate  string `json:"bodyTemplate" minLength:"1" maxLength:"500"`
		Route         string `json:"route,omitempty" maxLength:"300" pattern:"^/[A-Za-z0-9\\-._~/%?&=+:@!$'(),;\\[\\]*]*$"`
	}
}

func notificationNomDejaPris(err error, nom string) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return socle.Problem(http.StatusConflict, "NOTIFICATION_TEMPLATE_NAME_CONFLICT",
			"Un gabarit nommé « "+nom+" » existe déjà.")
	}
	return err
}

// Un gabarit part vers tous les destinataires d'une campagne : le journal garde
// le texte, pas seulement le fait qu'il a changé.
func notificationGabaritJournal(g *db.NotificationTemplateRow) map[string]any {
	return map[string]any{
		notificationCleNom: g.Name, "category": g.Category, "isActive": g.IsActive,
		"titleTemplate": g.TitleTemplate, "bodyTemplate": g.BodyTemplate, "route": g.Route,
	}
}

func (s *service) creerGabaritNotification(ctx context.Context, in *NotificationCreerGabaritInput) (*NotificationGabaritOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	nom := strings.TrimSpace(in.Body.Name)
	var gabarit db.NotificationTemplateRow
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		row, err := q.InsertNotificationTemplate(ctx, db.InsertNotificationTemplateParams{
			ID: id.String(), Name: nom,
			Category:      db.NotificationCategory(notificationSiVide(in.Body.Category, notificationCategorieDefaut)),
			TitleTemplate: in.Body.TitleTemplate, BodyTemplate: in.Body.BodyTemplate,
			Route:       notificationTexteOuNil(in.Body.Route),
			Variables:   notificationVariablesGabarit(in.Body.TitleTemplate, in.Body.BodyTemplate),
			CreatedByID: notificationTexteOuNil(u.ID),
		})
		if err != nil {
			return notificationNomDejaPris(err, nom)
		}
		gabarit = db.NotificationTemplateRow(row)
		return database.Auditer(ctx, q, u.ID, "notification_template.create", "notification_template",
			id.String(), nil, notificationGabaritJournal(&gabarit))
	}); err != nil {
		return nil, err
	}
	return &NotificationGabaritOutput{Body: notificationVersGabarit(&gabarit)}, nil
}

type NotificationModifierGabaritInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Name          *string `json:"name,omitempty" minLength:"2" maxLength:"80"`
		Category      *string `json:"category,omitempty" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
		TitleTemplate *string `json:"titleTemplate,omitempty" minLength:"1" maxLength:"120"`
		BodyTemplate  *string `json:"bodyTemplate,omitempty" minLength:"1" maxLength:"500"`
		Route         *string `json:"route,omitempty" maxLength:"300"`
		IsActive      *bool   `json:"isActive,omitempty"`
	}
}

type NotificationModifierGabaritOutput struct {
	Body GabaritNotification
}

// La chaîne vide EFFACE le lien ; elle ne le remplace pas par une route invalide.
func (s *service) modifierGabaritNotification(ctx context.Context, in *NotificationModifierGabaritInput) (*NotificationModifierGabaritOutput, error) {
	if in.Body.Route != nil && *in.Body.Route != "" && !notificationMotifRoute.MatchString(*in.Body.Route) {
		return nil, huma.Error422UnprocessableEntity("route invalide", &huma.ErrorDetail{
			Location: "body.route", Message: "route doit être une route interne commençant par /",
		})
	}
	courant, err := s.gabaritNotificationVisible(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	params := db.UpdateNotificationTemplateParams{
		ID: in.ID, Name: courant.Name, Category: db.NotificationCategory(courant.Category),
		TitleTemplate: notificationValeurOu(in.Body.TitleTemplate, courant.TitleTemplate),
		BodyTemplate:  notificationValeurOu(in.Body.BodyTemplate, courant.BodyTemplate),
		Route:         courant.Route, IsActive: notificationValeurOu(in.Body.IsActive, courant.IsActive),
	}
	if in.Body.Name != nil {
		params.Name = strings.TrimSpace(*in.Body.Name)
	}
	if in.Body.Category != nil {
		params.Category = db.NotificationCategory(*in.Body.Category)
	}
	if in.Body.Route != nil {
		params.Route = notificationTexteOuNil(*in.Body.Route)
	}
	params.Variables = notificationVariablesGabarit(params.TitleTemplate, params.BodyTemplate)

	avant := courant
	var gabarit db.NotificationTemplateRow
	if err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		row, err := q.UpdateNotificationTemplate(ctx, params)
		if err != nil {
			return notificationNomDejaPris(err, params.Name)
		}
		gabarit = db.NotificationTemplateRow(row)
		return database.Auditer(ctx, q, socle.UtilisateurCourant(ctx).ID, "notification_template.update",
			"notification_template", in.ID, notificationGabaritJournal(&avant), notificationGabaritJournal(&gabarit))
	}); err != nil {
		return nil, err
	}
	return &NotificationModifierGabaritOutput{Body: notificationVersGabarit(&gabarit)}, nil
}

type NotificationRendreGabaritInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Variables map[string]string `json:"variables"`
	}
}

type NotificationRendreGabaritOutput struct {
	Body struct {
		Title   string   `json:"title"`
		Body    string   `json:"body"`
		Missing []string `json:"missing"`
	}
}

func (s *service) rendreGabaritNotification(ctx context.Context, in *NotificationRendreGabaritInput) (*NotificationRendreGabaritOutput, error) {
	row, err := s.gabaritNotificationVisible(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	manquantes := []string{}
	out := &NotificationRendreGabaritOutput{}
	out.Body.Title = notificationRendreTexte(row.TitleTemplate, in.Body.Variables, &manquantes)
	out.Body.Body = notificationRendreTexte(row.BodyTemplate, in.Body.Variables, &manquantes)
	out.Body.Missing = manquantes
	return out, nil
}

// Composition

func (s *service) destinatairesNotification(ctx context.Context, audience, role string, ids []string) ([]string, error) {
	switch audience {
	case "ROLE":
		if role == "" {
			return nil, socle.Problem(http.StatusUnprocessableEntity, "NOTIFICATION_AUDIENCE_ROLE_REQUIRED",
				"Un public « par rôle » exige `audienceRole`.")
		}
	case "DEPARTEMENT":
		return nil, socle.Problem(http.StatusUnprocessableEntity, "NOTIFICATION_AUDIENCE_DEPARTEMENT_RETIRED",
			"Le public « par département » n’existe plus : les comptes n’ont pas de département.")
	case string(db.NotificationAudienceUSERS):
		if ids = notificationDedoublonner(ids); len(ids) == 0 {
			return nil, socle.Problem(http.StatusUnprocessableEntity, "NOTIFICATION_AUDIENCE_USERS_REQUIRED",
				"Un public « comptes choisis » exige au moins un identifiant.")
		}
	}
	return s.Q.AudienceUserIDs(ctx, db.AudienceUserIDsParams{
		Audience: audience, AudienceRole: role, AudienceUserIds: notificationDedoublonner(ids),
	})
}

// L'ORDRE COMPTE : le public est résolu et les lignes de livraison écrites dans
// la même transaction que l'envoi, AVANT toute remise. Envoyer d'abord et
// tracer ensuite laisse un redémarrage produire des e-mails que la base ignore.
func (s *service) composerNotification(ctx context.Context, auteur string, in *CreationNotification) (string, error) {
	maintenant := time.Now()
	if in.ScheduledFor != nil && !in.ScheduledFor.After(maintenant) {
		return "", socle.Problem(http.StatusUnprocessableEntity, "NOTIFICATION_SCHEDULE_IN_PAST",
			"La date de programmation est déjà passée.")
	}
	cibles, err := s.destinatairesNotification(ctx, in.Audience, in.AudienceRole, in.AudienceUserIDs)
	if err != nil {
		return "", err
	}
	if len(cibles) == 0 {
		return "", socle.Problem(http.StatusUnprocessableEntity, "NOTIFICATION_AUDIENCE_EMPTY",
			"Ce public ne correspond à aucun compte actif. Rien n’a été envoyé.")
	}
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	statut := notificationStatutEnCours
	var programme *time.Time
	if in.ScheduledFor != nil {
		statut, programme = notificationStatutProgramme, in.ScheduledFor
	}
	choisis := []string{}
	if in.Audience == "USERS" {
		choisis = notificationDedoublonner(in.AudienceUserIDs)
	}

	if err := s.enregistrerNotification(ctx, &db.InsertNotificationParams{
		ID: id.String(), Title: in.Title, Body: in.Body,
		Category: db.NotificationCategory(notificationSiVide(in.Category, notificationCategorieDefaut)),
		Route:    notificationTexteOuNil(in.Route), Audience: db.NotificationAudience(in.Audience),
		AudienceRole: notificationRoleOuNil(in.AudienceRole), AudienceUserIds: choisis,
		Status: db.NotificationStatus(statut), ScheduledFor: programme,
		TemplateID: notificationTexteOuNil(in.TemplateID), CreatedByID: notificationTexteOuNil(auteur),
	}, cibles); err != nil {
		return "", err
	}
	s.Live.Emettre("notifications")

	if programme != nil {
		return id.String(), nil
	}
	_, err = s.expedierNotifications(ctx, []string{id.String()}, maintenant)
	return id.String(), err
}

func (s *service) enregistrerNotification(ctx context.Context, params *db.InsertNotificationParams, cibles []string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)
	if _, err := q.InsertNotification(ctx, *params); err != nil {
		return err
	}
	if err := notificationEcrireLivraisons(ctx, q, []string{params.ID}, cibles, "", ""); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func notificationEcrireLivraisons(ctx context.Context, q *db.Queries, notifications, utilisateurs []string, cle, periode string) error {
	ids := make([]string, 0, len(notifications)*len(utilisateurs))
	appartenance := make([]string, 0, cap(ids))
	comptes := make([]string, 0, cap(ids))
	for _, notification := range notifications {
		for _, utilisateur := range utilisateurs {
			id, err := uuid.NewV7()
			if err != nil {
				return err
			}
			ids = append(ids, id.String())
			appartenance = append(appartenance, notification)
			comptes = append(comptes, utilisateur)
		}
	}
	return q.InsertNotificationDeliveries(ctx, db.InsertNotificationDeliveriesParams{
		Ids: ids, NotificationIds: appartenance, UserIds: comptes,
		ReminderKey: notificationTexteOuNil(cle), Period: notificationTexteOuNil(periode),
	})
}

type CreerNotificationInput struct {
	Body CreationNotification
}

type NotificationOutput struct {
	Body Notification
}

func (s *service) creerNotification(ctx context.Context, in *CreerNotificationInput) (*NotificationOutput, error) {
	id, err := s.composerNotification(ctx, socle.UtilisateurCourant(ctx).ID, &in.Body)
	if err != nil {
		return nil, err
	}
	notification, _, err := s.lireNotification(ctx, id)
	if err != nil {
		return nil, err
	}
	return &NotificationOutput{Body: notification}, nil
}

// Lectures d'administration

func versNotification(r *db.NotificationsRow, comptes NotificationComptes) Notification {
	ids := r.AudienceUserIds
	if ids == nil {
		ids = []string{}
	}
	return Notification{
		ID: r.ID, Title: r.Title, Body: r.Body, Category: r.Category, Route: r.Route,
		Audience: r.Audience, AudienceRole: notificationTexteOuNil(r.AudienceRole), AudienceUserIDs: ids,
		Status: r.Status, ScheduledFor: r.ScheduledFor, SentAt: r.SentAt, CancelledAt: r.CancelledAt,
		TransportStatus: r.TransportStatus, CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt,
		Counts: comptes,
	}
}

func (s *service) compteursNotifications(ctx context.Context, ids []string) (map[string]NotificationComptes, error) {
	comptes := map[string]NotificationComptes{}
	if len(ids) == 0 {
		return comptes, nil
	}
	rows, err := s.Q.NotificationCounts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		comptes[row.NotificationId] = NotificationComptes{
			Total: int(row.Total), Pending: int(row.Pending), Sent: int(row.Sent),
			Delivered: int(row.Delivered), Failed: int(row.Failed), Read: int(row.Read),
		}
	}
	return comptes, nil
}

type ListerNotificationsInput struct {
	Status   string `query:"status" enum:"SCHEDULED,SENDING,SENT,CANCELLED"`
	Category string `query:"category" enum:"ANNONCE,RAPPEL,CAMPAGNE,DOSSIER,SYSTEME"`
	Page     int    `query:"page" minimum:"1" default:"1"`
	PageSize int    `query:"pageSize" minimum:"1" maximum:"100" default:"25"`
}

type ListerNotificationsOutput struct {
	Body struct {
		Items []Notification    `json:"items"`
		Meta  MetaNotifications `json:"meta"`
	}
}

func (s *service) listerNotifications(ctx context.Context, in *ListerNotificationsInput) (*ListerNotificationsOutput, error) {
	total, err := s.Q.CountNotifications(ctx, db.CountNotificationsParams{Status: in.Status, Category: in.Category})
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.Notifications(ctx, db.NotificationsParams{
		Status: in.Status, Category: in.Category,
		Lim: int64(in.PageSize), Off: int64((in.Page - 1) * in.PageSize),
	})
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].ID)
	}
	comptes, err := s.compteursNotifications(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := &ListerNotificationsOutput{}
	out.Body.Items = []Notification{}
	for i := range rows {
		out.Body.Items = append(out.Body.Items, versNotification(&rows[i], comptes[rows[i].ID]))
	}
	out.Body.Meta = notificationPagination(int(total), in.Page, in.PageSize)
	return out, nil
}

func notificationPagination(total, page, taille int) MetaNotifications {
	pages := (total + taille - 1) / taille
	return MetaNotifications{Total: total, Page: page, PageSize: taille, PageCount: max(1, pages)}
}

func (s *service) lireNotification(ctx context.Context, id string) (Notification, []NotificationDestinataire, error) {
	row, err := s.Q.NotificationByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Notification{}, nil, socle.Problem(http.StatusNotFound, "NOTIFICATION_NOT_FOUND", "Notification introuvable.")
	}
	if err != nil {
		return Notification{}, nil, err
	}
	lignes, err := s.Q.NotificationRecipients(ctx, id)
	if err != nil {
		return Notification{}, nil, err
	}
	comptes := NotificationComptes{Total: len(lignes)}
	destinataires := make([]NotificationDestinataire, 0, len(lignes))
	for _, ligne := range lignes {
		comptes.ajouter(ligne.Status)
		destinataires = append(destinataires, NotificationDestinataire{
			UserID: ligne.UserId, FullName: ligne.FullName, Role: ligne.Role, Status: ligne.Status,
			Error: ligne.Error, SentAt: ligne.SentAt, ReadAt: ligne.ReadAt,
		})
	}
	converti := db.NotificationsRow(row)
	return versNotification(&converti, comptes), destinataires, nil
}

func (c *NotificationComptes) ajouter(statut string) {
	switch statut {
	case "PENDING":
		c.Pending++
	case "SENT":
		c.Sent++
	case "DELIVERED":
		c.Delivered++
	case "FAILED":
		c.Failed++
	case "READ":
		c.Read++
	}
}

type DetailNotificationOutput struct {
	Body struct {
		Notification Notification               `json:"notification"`
		Recipients   []NotificationDestinataire `json:"recipients"`
	}
}

type NotificationIDInput struct {
	ID string `path:"id" format:"uuid"`
}

func (s *service) detailNotification(ctx context.Context, in *NotificationIDInput) (*DetailNotificationOutput, error) {
	notification, destinataires, err := s.lireNotification(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &DetailNotificationOutput{}
	out.Body.Notification, out.Body.Recipients = notification, destinataires
	return out, nil
}

// Le `where` porte le statut attendu : si le tick a démarré l'envoi entre la
// lecture et l'écriture, l'appelant reçoit un refus au lieu de voir « annulée »
// une notification déjà partie.
func (s *service) annulerNotification(ctx context.Context, in *NotificationIDInput) (*NotificationOutput, error) {
	maintenant := time.Now()
	lignes, err := s.Q.CancelNotification(ctx, db.CancelNotificationParams{ID: in.ID, Now: &maintenant})
	if err != nil {
		return nil, err
	}
	if lignes == 0 {
		if _, _, err := s.lireNotification(ctx, in.ID); err != nil {
			return nil, err
		}
		return nil, socle.Problem(http.StatusConflict, "NOTIFICATION_NOT_SCHEDULED",
			"Seule une notification encore programmée peut être annulée.")
	}
	notification, _, err := s.lireNotification(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	s.Live.Emettre("notifications")
	return &NotificationOutput{Body: notification}, nil
}

// Boîte de réception

type NotificationBoiteInput struct {
	UnreadOnly bool `query:"unreadOnly"`
	Page       int  `query:"page" minimum:"1" default:"1"`
	PageSize   int  `query:"pageSize" minimum:"1" maximum:"100" default:"50"`
}

type NotificationBoiteOutput struct {
	Body struct {
		Items       []NotificationRecue `json:"items"`
		UnreadCount int                 `json:"unreadCount"`
		Meta        MetaNotifications   `json:"meta"`
	}
}

func (s *service) boiteDeReceptionNotifications(ctx context.Context, in *NotificationBoiteInput) (*NotificationBoiteOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	comptes, err := s.Q.InboxCounts(ctx, db.InboxCountsParams{UserID: u.ID, UnreadOnly: in.UnreadOnly})
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.Inbox(ctx, db.InboxParams{
		UserID: u.ID, UnreadOnly: in.UnreadOnly,
		Lim: int64(in.PageSize), Off: int64((in.Page - 1) * in.PageSize),
	})
	if err != nil {
		return nil, err
	}
	out := &NotificationBoiteOutput{}
	out.Body.Items = []NotificationRecue{}
	for _, row := range rows {
		out.Body.Items = append(out.Body.Items, NotificationRecue{
			ID: row.ID, NotificationID: row.NotificationId, Title: row.Title, Body: row.Body,
			Category: row.Category, Route: row.Route, IsRead: row.ReadAt != nil,
			ReadAt: row.ReadAt, CreatedAt: row.CreatedAt,
		})
	}
	out.Body.UnreadCount = int(comptes.Unread)
	out.Body.Meta = notificationPagination(int(comptes.Total), in.Page, in.PageSize)
	return out, nil
}

type NotificationLectureOutput struct {
	Body struct {
		OK bool `json:"ok"`
	}
}

// `readAt` dit ce que l'utilisateur a fait, `status` ce que la plateforme a
// fait de l'envoi : une livraison FAILED ou en attente de rejeu est horodatée
// sans changer d'état, faute de quoi son échec ou son rejeu disparaîtrait.
func (s *service) marquerNotificationLue(ctx context.Context, in *NotificationIDInput) (*NotificationLectureOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	maintenant := time.Now()
	avancees, err := s.Q.MarkDeliveryRead(ctx, db.MarkDeliveryReadParams{
		NotificationID: in.ID, UserID: u.ID, Now: &maintenant,
	})
	if err != nil {
		return nil, err
	}
	horodatees, err := s.Q.StampDeliveryRead(ctx, db.StampDeliveryReadParams{
		NotificationID: in.ID, UserID: u.ID, Now: &maintenant,
	})
	if err != nil {
		return nil, err
	}
	if avancees+horodatees > 0 {
		s.Live.Emettre("notifications")
	} else {
		total, err := s.Q.DeliveryExists(ctx, db.DeliveryExistsParams{NotificationID: in.ID, UserID: u.ID})
		if err != nil {
			return nil, err
		}
		if total == 0 {
			return nil, socle.Problem(http.StatusNotFound, "NOTIFICATION_NOT_FOUND", "Notification introuvable.")
		}
	}
	out := &NotificationLectureOutput{}
	out.Body.OK = true
	return out, nil
}

type NotificationApercuInput struct {
	Audience        string `query:"audience" required:"true" enum:"ALL,ROLE,DEPARTEMENT,USERS"`
	AudienceRole    string `query:"audienceRole" enum:"ADMIN,COMMERCIAL,BANQUE_FINANCE,SUPERVISEUR,DIRECTION,ACCUEIL,CHARGE_CLIENTELE"`
	AudienceUserIDs string `query:"audienceUserIds" maxLength:"40000"`
}

type NotificationApercuOutput struct {
	Body struct {
		RecipientCount int `json:"recipientCount"`
	}
}

func (s *service) apercuAudienceNotification(ctx context.Context, in *NotificationApercuInput) (*NotificationApercuOutput, error) {
	var ids []string
	for _, brut := range strings.Split(in.AudienceUserIDs, ",") {
		if valeur := strings.TrimSpace(brut); valeur != "" {
			ids = append(ids, valeur)
		}
	}
	cibles, err := s.destinatairesNotification(ctx, in.Audience, in.AudienceRole, ids)
	if err != nil {
		return nil, err
	}
	out := &NotificationApercuOutput{}
	out.Body.RecipientCount = len(cibles)
	return out, nil
}

// Expédition

type notificationVerdict struct {
	sort   string
	erreur string
}

type notificationCibleEmail struct {
	db.PendingDeliveriesRow
	email string
	nom   string
}

type notificationResultatEmail struct {
	statut    string
	verdicts  map[string]notificationVerdict
	joignable map[string]bool
	connu     bool
	acceptees map[string]bool
}

// LA PRISE EN CHARGE EST FAITE ICI, ET NON CHEZ L'APPELANT : il n'existe aucun
// moyen d'expédier sans passer par cette fonction, donc aucun moyen d'envoyer
// sans détenir le bail. Une notification absente du résultat n'existe pas ;
// une notification à `false` n'a rien tenté.
func (s *service) expedierNotifications(ctx context.Context, ids []string, maintenant time.Time) (map[string]bool, error) {
	pris := map[string]bool{}
	if len(ids) == 0 {
		return pris, nil
	}
	jeton := uuid.NewString()
	if err := s.Q.ClaimNotifications(ctx, db.ClaimNotificationsParams{
		Claim: &jeton, Ids: ids, Now: &maintenant, LeaseExpired: maintenant.Add(-notificationBailExpedition),
	}); err != nil {
		return pris, err
	}
	rows, err := s.Q.NotificationsForDispatch(ctx, ids)
	if err != nil {
		return pris, err
	}
	var tenues []db.NotificationsForDispatchRow
	for i := range rows {
		tenue := rows[i].Status == notificationStatutEnCours &&
			rows[i].DispatchClaim != nil && *rows[i].DispatchClaim == jeton
		pris[rows[i].ID] = tenue
		if tenue {
			tenues = append(tenues, rows[i])
		}
	}
	if len(tenues) == 0 {
		return pris, nil
	}
	livraisons, err := s.Q.PendingDeliveries(ctx, notificationIdentifiants(tenues))
	if err != nil {
		return pris, err
	}
	vivantes, err := s.abandonnerNotificationsExpirees(ctx, jeton, tenues, livraisons, maintenant)
	if err != nil || len(vivantes) == 0 {
		return pris, err
	}
	return pris, s.servirNotifications(ctx, jeton, vivantes, livraisons, maintenant)
}

func (s *service) servirNotifications(ctx context.Context, jeton string, vivantes []db.NotificationsForDispatchRow, livraisons []db.PendingDeliveriesRow, maintenant time.Time) error {
	ids := notificationIdentifiants(vivantes)
	parID := map[string]db.NotificationsForDispatchRow{}
	for i := range vivantes {
		parID[vivantes[i].ID] = vivantes[i]
	}
	var servies []db.PendingDeliveriesRow
	for _, livraison := range livraisons {
		if _, ok := parID[livraison.NotificationId]; ok {
			servies = append(servies, livraison)
		}
	}

	email := s.brancheEmailNotifications(ctx, jeton, ids, parID, servies)

	enAttente := 0
	var boiteSeule []string
	for _, livraison := range servies {
		v, juge := email.verdicts[livraison.ID]
		switch {
		case !juge:
			enAttente++
			if email.connu && !email.joignable[livraison.UserId] {
				boiteSeule = append(boiteSeule, livraison.ID)
			}
		case v.sort == notificationVerdictAReessayer:
			enAttente++
		}
	}
	// Le marqueur décrit le DESTINATAIRE, pas l'état du transport, et il est
	// écrit avant la clôture, qui le relit pour savoir ce qui attend encore.
	if len(boiteSeule) > 0 {
		if err := s.Q.MarkDeliveriesInboxOnly(ctx, boiteSeule); err != nil {
			return err
		}
	}
	return s.cloreNotifications(ctx, jeton, ids, email.statut, enAttente, maintenant)
}

// L'abandon se décide AVANT d'envoyer : passé le délai, une tentative de plus
// serait exactement la boucle sans fin que cette borne ferme.
func (s *service) abandonnerNotificationsExpirees(ctx context.Context, jeton string, tenues []db.NotificationsForDispatchRow, livraisons []db.PendingDeliveriesRow, maintenant time.Time) ([]db.NotificationsForDispatchRow, error) {
	vivantes, expirees := notificationTrierExpirees(tenues, maintenant)
	if len(expirees) == 0 {
		return vivantes, nil
	}
	perdues, compte := notificationLivraisonsPerdues(expirees, livraisons)
	if len(perdues) > 0 {
		if err := s.Q.AbandonDeliveries(ctx, db.AbandonDeliveriesParams{Ids: perdues, Now: &maintenant}); err != nil {
			return vivantes, err
		}
	}
	for i := range expirees {
		transport := notificationTexteOuVide(expirees[i].TransportStatus)
		slog.Error("notification abandonnée", "id", expirees[i].ID, "titre", expirees[i].Title,
			"heures", int(notificationDelaiAbandon.Hours()), "perdus", compte[expirees[i].ID],
			"transport", transport)
		if err := s.cloreNotifications(ctx, jeton, []string{expirees[i].ID}, transport, 0, maintenant); err != nil {
			return vivantes, err
		}
	}
	return vivantes, nil
}

// `scheduledFor` d'abord : un envoi prévu pour dans trois jours n'est pas en
// retard parce qu'il a été COMPOSÉ il y a trois jours.
func notificationTrierExpirees(tenues []db.NotificationsForDispatchRow, maintenant time.Time) (vivantes, expirees []db.NotificationsForDispatchRow) {
	for i := range tenues {
		origine := tenues[i].CreatedAt
		if tenues[i].ScheduledFor != nil {
			origine = *tenues[i].ScheduledFor
		}
		if maintenant.Sub(origine) > notificationDelaiAbandon {
			expirees = append(expirees, tenues[i])
			continue
		}
		vivantes = append(vivantes, tenues[i])
	}
	return vivantes, expirees
}

// Les lignes marquées `INBOX_ONLY` n'attendent rien : elles ne comptent pas
// dans ce qui vient d'être perdu.
func notificationLivraisonsPerdues(expirees []db.NotificationsForDispatchRow, livraisons []db.PendingDeliveriesRow) (perdues []string, compte map[string]int) {
	condamnees := map[string]bool{}
	for i := range expirees {
		condamnees[expirees[i].ID] = true
	}
	compte = map[string]int{}
	for _, livraison := range livraisons {
		if !condamnees[livraison.NotificationId] ||
			(livraison.Error != nil && *livraison.Error == notificationErreurBoiteSeule) {
			continue
		}
		perdues = append(perdues, livraison.ID)
		compte[livraison.NotificationId]++
	}
	return perdues, compte
}

// La notification RESTE `SENDING` tant qu'une livraison attend : c'est le bail
// qui la fera reprendre. La clôture se décide dans l'écriture, sous le verrou
// de la ligne, et jamais sur un compteur lu à part.
func (s *service) cloreNotifications(ctx context.Context, jeton string, ids []string, statut string, enAttente int, maintenant time.Time) error {
	fermees, err := s.Q.CloseNotifications(ctx, db.CloseNotificationsParams{
		Ids: ids, Claim: &jeton, TransportStatus: notificationTexteOuNil(statut), Now: &maintenant,
	})
	if err != nil {
		return err
	}
	if fermees > 0 {
		s.Live.Emettre("notifications")
	}
	if fermees == int64(len(ids)) {
		return nil
	}
	tenues, err := s.Q.HoldNotifications(ctx, db.HoldNotificationsParams{
		Ids: ids, Claim: &jeton, TransportStatus: notificationTexteOuNil(statut),
	})
	if err != nil || tenues == 0 {
		return err
	}
	slog.Warn("envois toujours en cours", "envois", tenues, "livraisons", enAttente,
		"transport", statut, "reprise_min", int(notificationBailExpedition.Minutes()),
		"abandon_h", int(notificationDelaiAbandon.Hours()))
	return nil
}

// SANS CLÉ, RIEN N'EST JUGÉ : les téléconseillers restent en file sans marqueur
// et le bail les fera reprendre. Les autres sont bel et bien tranchés, parce
// que `joignable` vient de la base et non de la configuration du transport.
func (s *service) brancheEmailNotifications(ctx context.Context, jeton string, ids []string, parID map[string]db.NotificationsForDispatchRow, livraisons []db.PendingDeliveriesRow) notificationResultatEmail {
	res := notificationResultatEmail{
		statut: BrevoEnvoye, connu: true,
		verdicts: map[string]notificationVerdict{}, joignable: map[string]bool{}, acceptees: map[string]bool{},
	}
	if len(livraisons) == 0 {
		return res
	}
	cibles, err := s.ciblesEmailNotifications(ctx, livraisons, res.joignable)
	if err != nil {
		slog.Warn("branche e-mail interrompue, les livraisons restent en file", "err", err)
		res.connu, res.statut = false, brevoEnPanne
		s.ecrireVerdictsNotifications(ctx, ids, notificationToutAReessayer(livraisons), res.verdicts)
		return res
	}
	transport := ConfigurerBrevo()
	if !transport.configure() {
		res.statut = brevoNonConfigure
		return res
	}
	if len(cibles) == 0 {
		return res
	}
	if s.envoyerVaguesNotifications(ctx, &transport, jeton, ids, cibles, parID, &res) && len(res.acceptees) == 0 {
		res.statut = brevoEnPanne
	}
	return res
}

// La nature du destinataire se lit AVANT l'état du transport : sans cette
// lecture, une plateforme sans clé estampillerait « boîte de réception seule »
// des téléconseillers dont l'e-mail n'existerait plus pour personne.
func (s *service) ciblesEmailNotifications(ctx context.Context, livraisons []db.PendingDeliveriesRow, joignable map[string]bool) ([]notificationCibleEmail, error) {
	comptes := notificationDedoublonner(notificationIdentifiantsComptes(livraisons))
	rows, err := s.Q.EmailTargets(ctx, comptes)
	if err != nil {
		return nil, err
	}
	adresses := map[string]db.EmailTargetsRow{}
	for _, row := range rows {
		adresses[row.ID] = row
		joignable[row.ID] = true
	}
	var cibles []notificationCibleEmail
	for _, livraison := range livraisons {
		if compte, ok := adresses[livraison.UserId]; ok {
			cibles = append(cibles, notificationCibleEmail{
				PendingDeliveriesRow: livraison, email: compte.Email, nom: compte.FullName,
			})
		}
	}
	return cibles, nil
}

// UNE VAGUE, PUIS SON ÉCRITURE, PUIS LA SUIVANTE : ce que Brevo a accepté est
// acquis en base avant que la suite ne parte, faute de quoi une reprise
// renverrait le message à des gens qui l'ont déjà reçu.
func (s *service) envoyerVaguesNotifications(ctx context.Context, transport *brevo, jeton string, ids []string, cibles []notificationCibleEmail, parID map[string]db.NotificationsForDispatchRow, res *notificationResultatEmail) bool {
	refuse := false
	for _, vague := range notificationVagues(cibles, parID) {
		messages := make([]MessageBrevo, 0, len(vague))
		for i := range vague {
			messages = append(messages, vague[i].message)
		}
		envoi := transport.Envoyer(ctx, messages)
		if envoi.Statut == brevoEnPanne {
			refuse = true
			slog.Warn("e-mail non parti, sort décidé par issue", "detail", envoi.detail)
		}
		s.ecrireVerdictsNotifications(ctx, ids, notificationVerdictsVague(envoi, vague, res.acceptees), res.verdicts)
		renouvele, err := s.Q.RenewDispatchClaim(ctx, db.RenewDispatchClaimParams{Ids: ids, Claim: &jeton})
		if err == nil && renouvele == int64(len(ids)) {
			continue
		}
		slog.Warn("bail perdu en cours d'expédition, vagues restantes laissées au détenteur suivant", "err", err)
		break
	}
	return refuse
}

type notificationLotEmail struct {
	message MessageBrevo
	lignes  []notificationCibleEmail
}

// LE REGROUPEMENT SE FAIT PAR CONTENU RENDU, jamais par notification : deux
// rappels qui portent des chiffres différents ne peuvent pas partager un envoi,
// alors que trois cents comptes rendus identiques tiennent dans un seul.
func notificationVagues(cibles []notificationCibleEmail, parID map[string]db.NotificationsForDispatchRow) [][]notificationLotEmail {
	ordre := []string{}
	groupes := map[string][]notificationCibleEmail{}
	for _, cible := range cibles {
		envoi, ok := parID[cible.NotificationId]
		if !ok {
			continue
		}
		cle := envoi.Title + "\x00" + envoi.Body + "\x00" + envoi.Route
		if _, vu := groupes[cle]; !vu {
			ordre = append(ordre, cle)
		}
		groupes[cle] = append(groupes[cle], cible)
	}

	var lots []notificationLotEmail
	for _, cle := range ordre {
		parties := strings.SplitN(cle, "\x00", 3)
		titre, corps := parties[0], parties[1]
		html, texte := notificationContenuEmail(titre, corps, parties[2])
		for _, tranche := range brevoDecouper(groupes[cle], notificationTailleVague) {
			destinataires := make([]DestinataireBrevo, 0, len(tranche))
			for _, ligne := range tranche {
				destinataires = append(destinataires, DestinataireBrevo{Email: ligne.email, Nom: ligne.nom})
			}
			lots = append(lots, notificationLotEmail{
				message: MessageBrevo{Destinataires: destinataires, Sujet: titre, HTML: html, Texte: texte},
				lignes:  tranche,
			})
		}
	}

	var ensemble [][]notificationLotEmail
	var courante []notificationLotEmail
	taille := 0
	for i := range lots {
		courante = append(courante, lots[i])
		taille += len(lots[i].lignes)
		if taille < notificationTailleVague {
			continue
		}
		ensemble = append(ensemble, courante)
		courante, taille = nil, 0
	}
	if len(courante) > 0 {
		ensemble = append(ensemble, courante)
	}
	return ensemble
}

func notificationVerdictsVague(envoi envoiBrevo, vague []notificationLotEmail, acceptees map[string]bool) map[string]notificationVerdict {
	parEmail := map[string]issueBrevo{}
	for _, issue := range envoi.issues {
		parEmail[issue.email] = issue
	}
	refuse := envoi.Statut == brevoEnPanne
	verdicts := map[string]notificationVerdict{}
	for i := range vague {
		for _, ligne := range vague[i].lignes {
			issue, connue := parEmail[ligne.email]
			if issue.ok {
				acceptees[ligne.ID] = true
			}
			verdicts[ligne.ID] = notificationVerdictPour(issue, connue, refuse)
		}
	}
	return verdicts
}

func notificationVerdictPour(issue issueBrevo, connue, refuse bool) notificationVerdict {
	switch {
	case !connue && refuse:
		return notificationVerdict{sort: notificationVerdictAReessayer, erreur: notificationErreurAReessayer}
	case !connue, issue.ok:
		return notificationVerdict{sort: notificationVerdictRemis}
	case issue.transitoire:
		return notificationVerdict{sort: notificationVerdictAReessayer, erreur: notificationErreurAReessayer}
	default:
		return notificationVerdict{sort: notificationVerdictEchoue, erreur: notificationSiVide(issue.code, "UNKNOWN")}
	}
}

func notificationToutAReessayer(livraisons []db.PendingDeliveriesRow) map[string]notificationVerdict {
	verdicts := map[string]notificationVerdict{}
	for _, livraison := range livraisons {
		verdicts[livraison.ID] = notificationVerdict{sort: notificationVerdictAReessayer, erreur: notificationErreurAReessayer}
	}
	return verdicts
}

// L'ACCEPTATION D'ABORD : c'est la seule des trois écritures qu'une
// interruption ne pardonne pas, puisque son absence fait renvoyer un e-mail
// déjà remis. `status = PENDING` dans chaque `where` empêche une écriture
// tardive de ramener en arrière une ligne qu'un autre passage a fait avancer.
func (s *service) ecrireVerdictsNotifications(ctx context.Context, ids []string, courants, cumul map[string]notificationVerdict) {
	defer func() {
		for id, v := range courants {
			cumul[id] = v
		}
	}()
	if len(courants) == 0 {
		return
	}
	maintenant := time.Now()
	var remises []string
	rejeux, echecs := map[string][]string{}, map[string][]string{}
	for id, v := range courants {
		switch v.sort {
		case notificationVerdictRemis:
			remises = append(remises, id)
		case notificationVerdictAReessayer:
			rejeux[v.erreur] = append(rejeux[v.erreur], id)
		default:
			echecs[v.erreur] = append(echecs[v.erreur], id)
		}
	}
	if len(remises) > 0 {
		if err := s.Q.MarkDeliveriesSent(ctx, db.MarkDeliveriesSentParams{
			NotificationIds: ids, Ids: remises, Now: &maintenant,
		}); err != nil {
			slog.Error("verdicts non écrits", "err", err)
		}
	}
	for erreur, lot := range rejeux {
		if err := s.Q.MarkDeliveriesRetry(ctx, db.MarkDeliveriesRetryParams{
			NotificationIds: ids, Ids: lot, Error: notificationTexteOuNil(erreur),
		}); err != nil {
			slog.Error("rejeux non écrits", "err", err)
		}
	}
	for erreur, lot := range echecs {
		if err := s.Q.MarkDeliveriesFailed(ctx, db.MarkDeliveriesFailedParams{
			NotificationIds: ids, Ids: lot, Error: notificationTexteOuNil(erreur), Now: &maintenant,
		}); err != nil {
			slog.Error("échecs non écrits", "err", err)
		}
	}
}

const notificationGabaritEmailHTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">` +
	`<h2 style="font-size:17px;margin:0 0 12px">{{titre}}</h2>` +
	`<p style="margin:0 0 16px">{{corps}}</p>{{lien}}` +
	`<p style="font-size:12px;color:#666;margin:0">Message automatique de CPI GO. Ne pas répondre.</p>` +
	`</div>`

// Le titre et le corps sont saisis par un administrateur : sans échappement,
// une balise collée ferait de l'e-mail portant notre nom un support
// d'hameçonnage que le lecteur ne peut pas inspecter.
func notificationContenuEmail(titre, corps, route string) (html, texte string) {
	echapper := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&#39;")
	var manquantes []string
	base := socle.Env("PUBLIC_WEB_URL", "")
	lien, ligneTexte := "", ""
	if base != "" && strings.HasPrefix(route, "/") {
		adresse := strings.TrimSuffix(base, "/") + route
		lien = `<p style="margin:0 0 16px"><a href="` + echapper.Replace(adresse) + `">Ouvrir dans CPI GO</a></p>`
		ligneTexte = "\n\n" + adresse
	}
	variables := map[string]string{
		"titre": echapper.Replace(titre),
		"corps": strings.ReplaceAll(echapper.Replace(corps), "\n", "<br />"),
	}
	gabarit := strings.Replace(notificationGabaritEmailHTML, "{{lien}}", lien, 1)
	return notificationRendreTexte(gabarit, variables, &manquantes), titre + "\n\n" + corps + ligneTexte
}

// Petites conversions

func notificationTexteOuNil(valeur string) *string {
	if valeur == "" {
		return nil
	}
	return &valeur
}

func notificationTexteOuVide(valeur *string) string {
	if valeur == nil {
		return ""
	}
	return *valeur
}

func notificationRoleOuNil(valeur string) *db.Role {
	if valeur == "" {
		return nil
	}
	role := db.Role(valeur)
	return &role
}

func notificationSiVide(valeur, defaut string) string {
	if valeur == "" {
		return defaut
	}
	return valeur
}

func notificationValeurOu[T any](pointeur *T, defaut T) T {
	if pointeur == nil {
		return defaut
	}
	return *pointeur
}

func notificationDedoublonner(valeurs []string) []string {
	vus := map[string]bool{}
	uniques := make([]string, 0, len(valeurs))
	for _, valeur := range valeurs {
		if vus[valeur] {
			continue
		}
		vus[valeur] = true
		uniques = append(uniques, valeur)
	}
	return uniques
}

func notificationIdentifiants(rows []db.NotificationsForDispatchRow) []string {
	ids := make([]string, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].ID)
	}
	return ids
}

func notificationIdentifiantsComptes(rows []db.PendingDeliveriesRow) []string {
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.UserId)
	}
	return ids
}
