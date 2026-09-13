package representants

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	representantTriAsc          = "asc"
	representantTriDesc         = "desc"
	representantTriDefaut       = "clientCreatedAt"
	RepresentantChampDep        = "departementId"
	RepresentantChampIef        = "iefId"
	RepresentantChampNom        = "fullName"
	RepresentantChampTel        = "phoneE164"
	RepresentantChampConnaitUES = "connaitUES"
	RepresentantChampNotes      = "notes"
	RepresentantChampContacte   = "contacte"
	RepresentantChampSyndicat   = "syndicat"
	representantActionWEB       = "representant.fiche.WEB"
	representantEntite          = "representant"
	representantMsgAbsente      = "Représentant introuvable."
)

type RepresentantDto struct {
	ID                        string  `json:"id"`
	FullName                  string  `json:"fullName"`
	PhoneE164                 string  `json:"phoneE164"`
	Notes                     *string `json:"notes"`
	Rev                       int32   `json:"rev"`
	DepartementID             string  `json:"departementId"`
	DepartementName           string  `json:"departementName"`
	IefID                     *string `json:"iefId"`
	IefName                   *string `json:"iefName"`
	CreatedByID               string  `json:"createdById"`
	CreatedByName             string  `json:"createdByName"`
	ClientCreatedAt           string  `json:"clientCreatedAt"`
	CreatedAt                 string  `json:"createdAt"`
	UpdatedAt                 string  `json:"updatedAt"`
	ProspectCount             int32   `json:"prospectCount"`
	RelationStatus            string  `json:"relationStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	StatutQualificationID     *string `json:"statutQualificationId"`
	StatutQualificationLabel  *string `json:"statutQualificationLabel"`
	StatutQualificationEffect *string `json:"statutQualificationEffect" enum:"REACHED,REFUSED,SCHEDULE_CALLBACK,UNREACHABLE,WRONG_NUMBER"`
	WhatsappStatus            string  `json:"whatsappStatus" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	WhatsappE164              *string `json:"whatsappE164"`
	WhatsappNumber            *string `json:"whatsappNumber"`
	Profession                *string `json:"profession"`
	Prenom                    *string `json:"prenom"`
	Etablissement             *string `json:"etablissement"`
	Syndicat                  *string `json:"syndicat"`
	ConnaitUES                *bool   `json:"connaitUES"`
	Contacte                  *bool   `json:"contacte"`
	LastCallOutcome           *string `json:"lastCallOutcome" enum:"REACHED,PROSPECTS_PROMISED,UNREACHABLE,CALLBACK,REFUSED,WRONG_NUMBER,OTHER"`
	LastCallAt                *string `json:"lastCallAt"`
	CallAttemptCount          int32   `json:"callAttemptCount"`
	LastCallByID              *string `json:"lastCallById"`
	LastCallByName            *string `json:"lastCallByName"`
	NextCallbackAt            *string `json:"nextCallbackAt"`
	NextCallbackOrigine       *string `json:"nextCallbackOrigine" enum:"PROMIS,AUTOMATIQUE"`
}

type RepresentantPageMeta struct {
	Total     int32 `json:"total"`
	Page      int   `json:"page"`
	PageSize  int   `json:"pageSize"`
	PageCount int   `json:"pageCount"`
}

type RepresentantCommentDto struct {
	ID              string `json:"id"`
	RepresentantID  string `json:"representantId"`
	AuthorID        string `json:"authorId"`
	AuthorName      string `json:"authorName"`
	Body            string `json:"body"`
	ClientCreatedAt string `json:"clientCreatedAt"`
	CreatedAt       string `json:"createdAt"`
}

type RepresentantRelationChangeDto struct {
	ID             string  `json:"id"`
	RepresentantID string  `json:"representantId"`
	FromStatus     string  `json:"fromStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	ToStatus       string  `json:"toStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	Reason         *string `json:"reason"`
	ChangedByID    string  `json:"changedById"`
	ChangedByName  string  `json:"changedByName"`
	Source         string  `json:"source" enum:"WEB,MOBILE"`
	ChangedAt      string  `json:"changedAt"`
}

type RepresentantCallAttemptDto struct {
	ID                                 string  `json:"id"`
	Outcome                            string  `json:"outcome" enum:"REACHED,PROSPECTS_PROMISED,UNREACHABLE,CALLBACK,REFUSED,WRONG_NUMBER,OTHER"`
	StatutQualificationID              *string `json:"statutQualificationId"`
	StatutQualificationLabel           *string `json:"statutQualificationLabel"`
	StatutQualificationRequiresComment bool    `json:"statutQualificationRequiresComment"`
	Comment                            *string `json:"comment"`
	CallbackAt                         *string `json:"callbackAt"`
	PromisedProspects                  *int32  `json:"promisedProspects"`
	EtablissementConfirme              *bool   `json:"etablissementConfirme"`
	NumeroConfirme                     *bool   `json:"numeroConfirme"`
	Contacte                           *bool   `json:"contacte"`
	ConnaitUES                         *bool   `json:"connaitUES"`
	Syndicat                           *string `json:"syndicat"`
	SuggestedName                      *string `json:"suggestedName"`
	SuggestedPhoneE164                 *string `json:"suggestedPhoneE164"`
	SuggestedNote                      *string `json:"suggestedNote"`
	DeviceCallType                     *string `json:"deviceCallType"`
	DeviceCallDurationSeconds          *int32  `json:"deviceCallDurationSeconds"`
	DeviceCallAt                       *string `json:"deviceCallAt"`
	PerformedByID                      string  `json:"performedById"`
	PerformedByName                    string  `json:"performedByName"`
	ClientCreatedAt                    string  `json:"clientCreatedAt"`
	DureeTraitementSecondes            *int32  `json:"dureeTraitementSecondes"`
}

type RepresentantFicheChampDto struct {
	Champ string  `json:"champ"`
	Avant *string `json:"avant"`
	Apres *string `json:"apres"`
}

type RepresentantFicheChangeDto struct {
	ID             string                      `json:"id"`
	RepresentantID string                      `json:"representantId"`
	Source         string                      `json:"source" enum:"WEB,MOBILE,APPEL,IMPORT"`
	ChangedByID    *string                     `json:"changedById"`
	ChangedByName  string                      `json:"changedByName"`
	ChangedAt      string                      `json:"changedAt"`
	Champs         []RepresentantFicheChampDto `json:"champs"`
}

func representantISO(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func representantISOPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := representantISO(*t)
	return &s
}

func representantTexte(s string) *string { return &s }

func representantEnumPtr[T ~string](p *T) *string {
	if p == nil {
		return nil
	}
	s := string(*p)
	return &s
}

func representantValeur[T any](p *T) any {
	if p == nil {
		return nil
	}
	return *p
}

func representantNarg(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// Recomposé à la lecture : sur MEME_NUMERO la colonne dédiée reste nulle, une
// copie pointerait sur un autre abonné dès la première correction du téléphone.
func representantWhatsappNumber(statut db.WhatsappStatus, phone string, autre *string) *string {
	switch statut {
	case db.WhatsappStatusMEMENUMERO:
		return &phone
	case db.WhatsappStatusAUTRENUMERO:
		return autre
	case db.WhatsappStatusNONDEMANDE, db.WhatsappStatusAUCUN:
		return nil
	}
	return nil
}

func representantDto(r *db.ListRepresentantsRow) RepresentantDto {
	return RepresentantDto{
		ID: r.ID, FullName: r.FullName, PhoneE164: r.PhoneE164, Notes: r.Notes, Rev: r.Rev,
		DepartementID: r.DepartementId, DepartementName: r.DepartementName,
		IefID: r.IefId, IefName: r.IefName,
		CreatedByID: r.CreatedById, CreatedByName: r.CreatedByName,
		ClientCreatedAt: representantISO(r.ClientCreatedAt), CreatedAt: representantISO(r.CreatedAt), UpdatedAt: representantISO(r.UpdatedAt),
		ProspectCount: r.ProspectCount, RelationStatus: string(r.RelationStatus),
		StatutQualificationID:    r.StatutQualificationId,
		StatutQualificationLabel: r.StatutQualificationLabel,

		StatutQualificationEffect: representantEnumPtr(r.StatutQualificationEffect),
		WhatsappStatus:            string(r.WhatsappStatus),
		WhatsappE164:              r.WhatsappE164,
		WhatsappNumber:            representantWhatsappNumber(r.WhatsappStatus, r.PhoneE164, r.WhatsappE164),
		Profession:                r.Profession, Prenom: r.Prenom, Etablissement: r.Etablissement,
		Syndicat: r.Syndicat, ConnaitUES: r.ConnaitUES, Contacte: r.Contacte,
		LastCallOutcome: representantEnumPtr(r.LastCallOutcome), LastCallAt: representantISOPtr(r.LastCallAt),
		CallAttemptCount: r.CallAttemptCount, LastCallByID: r.LastCallById, LastCallByName: r.LastCallByName,
		NextCallbackAt: representantISOPtr(r.NextCallbackAt), NextCallbackOrigine: representantEnumPtr(r.NextCallbackOrigine),
	}
}

func representantIntrouvable() error {
	return socle.Problem(http.StatusNotFound, "REPRESENTANT_NOT_FOUND", representantMsgAbsente)
}

// Qui lit le travail de tous. `mesFiches` borne aussi l'encadrement : sur
// l'écran d'appel, un superviseur ne compose que les numéros qui lui reviennent.
func representantLitTout(role socle.Role, mesFiches bool) bool {
	if mesFiches {
		return false
	}
	return role == socle.Admin || role == socle.Superviseur || role == socle.Direction
}

type RepresentantListInput struct {
	Search                string   `query:"search" maxLength:"120"`
	DepartementID         string   `query:"departementId" format:"uuid"`
	IefID                 string   `query:"iefId" format:"uuid"`
	CommercialID          string   `query:"commercialId" format:"uuid"`
	DateFrom              string   `query:"dateFrom" format:"date-time"`
	DateTo                string   `query:"dateTo" format:"date-time"`
	HasProspects          string   `query:"hasProspects" enum:"true,false"`
	StatutQualificationID string   `query:"statutQualificationId" format:"uuid"`
	WhatsappStatus        string   `query:"whatsappStatus" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	HasWhatsapp           string   `query:"hasWhatsapp" enum:"true,false"`
	Suivi                 string   `query:"suivi" enum:"A_RAPPELER,INJOIGNABLE"`
	LastCallByID          string   `query:"lastCallById" maxLength:"64"`
	RelationStatus        []string `query:"relationStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	MesFiches             bool     `query:"mesFiches"`
	SortBy                string   `query:"sortBy" enum:"clientCreatedAt,createdAt,fullName,prospects,lastCallAt,nextCallbackAt,priorite"`
	SortOrder             string   `query:"sortOrder" enum:"asc,desc"`
	Page                  int      `query:"page" minimum:"1" default:"1"`
	PageSize              int      `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
}

func representantBooleen(valeur string) *bool {
	if valeur == "" {
		return nil
	}
	actif := valeur == socle.Vrai
	return &actif
}

// Les bornes voyagent en instant, jamais en heure locale : la colonne est un
// `timestamp` sans fuseau et une saisie décalée décalerait le filtre.
func representantBornes(depuis, jusqua string) (debut, fin *time.Time, err error) {
	bornes := []struct {
		brut  string
		champ string
		cible **time.Time
	}{{depuis, "dateFrom", &debut}, {jusqua, "dateTo", &fin}}
	for _, borne := range bornes {
		if borne.brut == "" {
			continue
		}
		instant, erreur := time.Parse(time.RFC3339, borne.brut)
		if erreur != nil {
			return nil, nil, huma.Error422UnprocessableEntity("borne de date invalide",
				&huma.ErrorDetail{Location: "query." + borne.champ, Message: "Date attendue au format ISO 8601.", Value: borne.brut})
		}
		utc := instant.UTC()
		*borne.cible = &utc
	}
	return debut, fin, nil
}

type RepresentantListOutput struct {
	Body struct {
		Items []RepresentantDto    `json:"items"`
		Meta  RepresentantPageMeta `json:"meta"`
	}
}

// Le rappel le plus proche d'abord et la priorité HAUTE d'abord ; le reste du
// plus récent au plus ancien.
var representantSensParDefaut = map[string]string{
	representantTriDefaut: representantTriDesc,
	socle.ChampCreeLe:     representantTriDesc,
	RepresentantChampNom:  representantTriDesc,
	socle.NomProspects:    representantTriDesc,
	"lastCallAt":          representantTriDesc,
	"nextCallbackAt":      representantTriAsc,
	"priorite":            representantTriAsc,
}

var representantTriDuSuivi = map[string]string{exports.LotEtatARappeler: "nextCallbackAt", "INJOIGNABLE": "lastCallAt"}

func representantTri(sortBy, sortOrder, suivi string) (champ, sens string) {
	champ = sortBy
	if champ == "" {
		champ = representantTriDuSuivi[suivi]
	}
	if champ == "" {
		champ = representantTriDefaut
	}
	sens = sortOrder
	if sens == "" {
		sens = representantSensParDefaut[champ]
	}
	return champ, sens
}

// Les deux filtres WhatsApp se composent par INTERSECTION : envoyer les deux et
// n'en voir appliquer qu'un rendrait une liste dont personne ne peut dire ce
// qu'elle montre.
func representantWhatsappFiltre(statut string, joignable *bool) []string {
	if statut == "" && joignable == nil {
		return nil
	}
	tous := []db.WhatsappStatus{
		db.WhatsappStatusNONDEMANDE, db.WhatsappStatusMEMENUMERO,
		db.WhatsappStatusAUTRENUMERO, db.WhatsappStatusAUCUN,
	}
	admis := make([]string, 0, len(tous))
	for _, s := range tous {
		joint := s == db.WhatsappStatusMEMENUMERO || s == db.WhatsappStatusAUTRENUMERO
		if joignable != nil && joint != *joignable {
			continue
		}
		if statut != "" && string(s) != statut {
			continue
		}
		admis = append(admis, string(s))
	}
	return admis
}

// Sans chiffres, un `LIKE '%%'` sur le téléphone rendrait tout l'annuaire.
func representantChiffres(recherche string) *string {
	var b strings.Builder
	compte := 0
	for _, r := range recherche {
		if r >= '0' && r <= '9' {
			compte++
		}
		if (r >= '0' && r <= '9') || r == '+' {
			b.WriteRune(r)
		}
	}
	if compte < 3 {
		return nil
	}
	s := b.String()
	return &s
}

// La page est bornée : au-delà, le décalage déborderait l'entier 32 bits du
// paramètre SQL.
func representantTranche(page, pageSize int) (limite, decalage int32) {
	debut := (page - 1) * pageSize
	if debut < 0 || debut > math.MaxInt32 {
		debut = 0
	}
	if pageSize < 0 || pageSize > math.MaxInt32 {
		pageSize = 0
	}
	return int32(pageSize), int32(debut)
}

func representantFiltres(u *socle.Utilisateur, in *RepresentantListInput) (db.ListRepresentantsParams, error) {
	champ, sens := representantTri(in.SortBy, in.SortOrder, in.Suivi)
	recherche := strings.TrimSpace(in.Search)
	limite, decalage := representantTranche(in.Page, in.PageSize)
	debut, fin, err := representantBornes(in.DateFrom, in.DateTo)
	if err != nil {
		return db.ListRepresentantsParams{}, err
	}
	p := db.ListRepresentantsParams{
		ReadsEveryone:         representantLitTout(u.Role, in.MesFiches),
		OwnerID:               u.ID,
		CommercialID:          representantNarg(in.CommercialID),
		DepartementID:         representantNarg(in.DepartementID),
		IefID:                 representantNarg(in.IefID),
		StatutQualificationID: representantNarg(in.StatutQualificationID),
		LastCallByID:          representantNarg(in.LastCallByID),
		RelationStatus:        in.RelationStatus,
		WhatsappStatuses:      representantWhatsappFiltre(in.WhatsappStatus, representantBooleen(in.HasWhatsapp)),
		DateFrom:              debut,
		DateTo:                fin,
		Suivi:                 representantNarg(in.Suivi),
		HasProspects:          representantBooleen(in.HasProspects),
		Search:                representantNarg(recherche),
		SortBy:                champ,
		SortDir:               sens,
		Lim:                   limite,
		Off:                   decalage,
	}
	if p.Search != nil {
		p.SearchDigits = representantChiffres(recherche)
	}
	return p, nil
}

func representantCompteFiltres(p *db.ListRepresentantsParams) db.CountRepresentantsParams {
	return db.CountRepresentantsParams{
		ReadsEveryone: p.ReadsEveryone, OwnerID: p.OwnerID,
		CommercialID: p.CommercialID, DepartementID: p.DepartementID, IefID: p.IefID,
		StatutQualificationID: p.StatutQualificationID, LastCallByID: p.LastCallByID,
		RelationStatus: p.RelationStatus, WhatsappStatuses: p.WhatsappStatuses,
		DateFrom: p.DateFrom, DateTo: p.DateTo, Suivi: p.Suivi, HasProspects: p.HasProspects,
		Search: p.Search, SearchDigits: p.SearchDigits,
	}
}

func representantMeta(total int32, page, pageSize int) RepresentantPageMeta {
	pages := (int(total) + pageSize - 1) / pageSize
	if pages < 1 {
		pages = 1
	}
	return RepresentantPageMeta{Total: total, Page: page, PageSize: pageSize, PageCount: pages}
}

func (s *service) listerRepresentants(ctx context.Context, in *RepresentantListInput) (*RepresentantListOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	filtres, err := representantFiltres(&u, in)
	if err != nil {
		return nil, err
	}
	total, err := s.Q.CountRepresentants(ctx, representantCompteFiltres(&filtres))
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListRepresentants(ctx, filtres)
	if err != nil {
		return nil, err
	}
	out := &RepresentantListOutput{}
	out.Body.Items = make([]RepresentantDto, 0, len(rows))
	for i := range rows {
		out.Body.Items = append(out.Body.Items, representantDto(&rows[i]))
	}
	out.Body.Meta = representantMeta(total, in.Page, in.PageSize)
	return out, nil
}

type RepresentantIDInput struct {
	ID string `path:"id" format:"uuid"`
}

type RepresentantOutput struct {
	Body RepresentantDto
}

// Hors périmètre, la fiche est introuvable : le 404 ne dit pas qu'elle existe.
func representantFicheLue(ctx context.Context, q *db.Queries, id string, litTout bool, ownerID string) (*RepresentantDto, error) {
	rows, err := q.ListRepresentants(ctx, db.ListRepresentantsParams{
		ID: &id, ReadsEveryone: litTout, OwnerID: ownerID,
		SortBy: representantTriDefaut, SortDir: representantTriDesc, Lim: 1,
	})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, representantIntrouvable()
	}
	dto := representantDto(&rows[0])
	return &dto, nil
}

func (s *service) lireRepresentant(ctx context.Context, in *RepresentantIDInput) (*RepresentantOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	dto, err := representantFicheLue(ctx, s.Q, in.ID, representantLitTout(u.Role, false), u.ID)
	if err != nil {
		return nil, err
	}
	return &RepresentantOutput{Body: *dto}, nil
}

type RepresentantLookupInput struct {
	Phone string `query:"phone" required:"true" minLength:"6" maxLength:"40"`
}

type RepresentantLookupOutput struct {
	Body struct {
		Found                 bool             `json:"found"`
		PhoneE164             string           `json:"phoneE164"`
		Representant          *RepresentantDto `json:"representant"`
		OwnedByCommercialName *string          `json:"ownedByCommercialName"`
		OwnedByCommercialID   *string          `json:"ownedByCommercialId"`
	}
}

// Rend la fiche entière quel qu'en soit le créateur : l'annuaire est commun, et
// c'est ainsi qu'on qualifie un représentant trouvé au numéro sans le ressaisir
// en double. Le propriétaire reste nommé, pour savoir vers qui se tourner.
func (s *service) chercherRepresentant(ctx context.Context, in *RepresentantLookupInput) (*RepresentantLookupOutput, error) {
	phone, err := database.NormaliserTelephone(in.Phone, s.Cfg.PhoneRegion)
	if err != nil {
		return nil, err
	}
	out := &RepresentantLookupOutput{}
	out.Body.PhoneE164 = phone
	rows, err := s.Q.ListRepresentants(ctx, db.ListRepresentantsParams{
		PhoneE164: &phone, ReadsEveryone: true, OwnerID: socle.UtilisateurCourant(ctx).ID,
		SortBy: representantTriDefaut, SortDir: representantTriDesc, Lim: 1,
	})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return out, nil
	}
	dto := representantDto(&rows[0])
	out.Body.Found = true
	out.Body.OwnedByCommercialID = &dto.CreatedByID
	out.Body.OwnedByCommercialName = &dto.CreatedByName
	// La recherche reste globale, sinon le doublon d'un collègue échappe au
	// contrôle. La fiche elle-même ne part qu'à qui a le droit de la lire : le
	// nom du propriétaire suffit à dire « ce numéro est déjà pris ».
	if u := socle.UtilisateurCourant(ctx); representantLitTout(u.Role, false) || dto.CreatedByID == u.ID {
		out.Body.Representant = &dto
	}
	return out, nil
}

type RepresentantCreateInput struct {
	Body struct {
		ID              *string    `json:"id,omitempty" format:"uuid"`
		FullName        string     `json:"fullName" minLength:"2" maxLength:"160"`
		Prenom          *string    `json:"prenom,omitempty" maxLength:"160"`
		Etablissement   *string    `json:"etablissement,omitempty" maxLength:"200"`
		Phone           string     `json:"phone" minLength:"6" maxLength:"40"`
		DepartementID   string     `json:"departementId" format:"uuid"`
		IefID           *string    `json:"iefId,omitempty" format:"uuid"`
		Notes           *string    `json:"notes,omitempty" maxLength:"2000"`
		ClientCreatedAt *time.Time `json:"clientCreatedAt,omitempty"`
	}
}

func representantNonVide(s *string) *string {
	if s == nil {
		return nil
	}
	if net := strings.TrimSpace(*s); net != "" {
		return &net
	}
	return nil
}

// Un identifiant déjà pris doit appartenir au même commercial : renvoyer 404 ou
// écraser laisserait un client réécrire la fiche d'un autre en devinant un UUID.
func (s *service) verifierIdentifiantRepresentantLibre(ctx context.Context, u *socle.Utilisateur, id string) error {
	proprietaire, err := s.Q.ProprietaireDeLIdentifiant(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if u.Role != socle.Admin && proprietaire != u.ID {
		return socle.Problem(http.StatusForbidden, "ENTITY_ID_OWNED_BY_ANOTHER_USER", "Cet identifiant appartient à un autre téléconseiller.")
	}
	p := socle.Problem(http.StatusConflict, "REPRESENTANT_ALREADY_EXISTS", "Un représentant porte déjà cet identifiant.")
	p.Errors = []*huma.ErrorDetail{{Location: "body.id", Message: p.Message, Value: id}}
	return p
}

func (s *service) verifierTelephoneRepresentantLibre(ctx context.Context, u *socle.Utilisateur, phone string) error {
	clash, err := s.Q.RepresentantParTelephone(ctx, phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	existante := map[string]any{RepresentantChampTel: clash.PhoneE164, "ownedByCommercialName": clash.CreatedByName}
	if u.Role == socle.Admin || clash.CreatedById == u.ID {
		existante = map[string]any{
			"id": clash.ID, RepresentantChampNom: clash.FullName, RepresentantChampTel: clash.PhoneE164,
			"ownedByCommercialId": clash.CreatedById, "ownedByCommercialName": clash.CreatedByName,
			"createdAt": representantISO(clash.CreatedAt),
		}
	}
	p := socle.Problem(http.StatusConflict, "REPRESENTANT_PHONE_CONFLICT", "Ce numéro est déjà enregistré pour un représentant.")
	p.Errors = []*huma.ErrorDetail{{Location: "body." + RepresentantChampTel, Message: p.Message, Value: existante}}
	return p
}

// L'index partiel unique est le filet de la lecture préalable : deux créations
// simultanées du même numéro la passent toutes les deux.
func (s *service) conflitInsertionRepresentant(ctx context.Context, u *socle.Utilisateur, id, phone string, err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return err
	}
	if conflit := s.verifierIdentifiantRepresentantLibre(ctx, u, id); conflit != nil {
		return conflit
	}
	if conflit := s.verifierTelephoneRepresentantLibre(ctx, u, phone); conflit != nil {
		return conflit
	}
	return err
}

func (s *service) creerRepresentant(ctx context.Context, in *RepresentantCreateInput) (*RepresentantOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	phone, err := database.NormaliserTelephone(in.Body.Phone, s.Cfg.PhoneRegion)
	if err != nil {
		return nil, err
	}
	id, err := representantIdentifiant(in.Body.ID)
	if err != nil {
		return nil, err
	}
	if conflit := s.verifierIdentifiantRepresentantLibre(ctx, &u, id); conflit != nil {
		return nil, conflit
	}
	if conflit := s.verifierTelephoneRepresentantLibre(ctx, &u, phone); conflit != nil {
		return nil, conflit
	}

	saisie := representantSaisie(in.Body.ClientCreatedAt)
	ligne := db.Representant{
		ID: id, FullName: strings.TrimSpace(in.Body.FullName), PhoneE164: phone,
		Notes: in.Body.Notes, Prenom: representantNonVide(in.Body.Prenom), Etablissement: representantNonVide(in.Body.Etablissement),
		DepartementId: in.Body.DepartementID, IefId: in.Body.IefID, CreatedById: u.ID,
		ClientCreatedAt: saisie, WhatsappStatus: db.WhatsappStatusNONDEMANDE,
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)
	if err := q.InsertRepresentant(ctx, db.InsertRepresentantParams{
		ID: ligne.ID, FullName: ligne.FullName, PhoneE164: ligne.PhoneE164, Notes: ligne.Notes,
		Prenom: ligne.Prenom, Etablissement: ligne.Etablissement, DepartementId: ligne.DepartementId,
		IefId: ligne.IefId, CreatedById: ligne.CreatedById, ClientCreatedAt: ligne.ClientCreatedAt,
	}); err != nil {
		return nil, s.conflitInsertionRepresentant(ctx, &u, id, phone, err)
	}
	if err := representantJournalFiche(ctx, q, u.ID, id, nil, representantSnapshot(&ligne)); err != nil {
		return nil, err
	}
	dto, err := representantFicheLue(ctx, q, id, true, u.ID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &RepresentantOutput{Body: *dto}, nil
}

// Horodatage de la saisie sur le terrain, distinct de `createdAt` qui est
// l'arrivée en base.
func representantSaisie(fourni *time.Time) time.Time {
	if fourni == nil {
		return time.Now().UTC()
	}
	return fourni.UTC()
}

func representantIdentifiant(fourni *string) (string, error) {
	if fourni != nil && *fourni != "" {
		return *fourni, nil
	}
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

type RepresentantUpdateInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Rev             int32      `json:"rev" minimum:"1"`
		FullName        *string    `json:"fullName,omitempty" minLength:"2" maxLength:"160"`
		Prenom          *string    `json:"prenom,omitempty" maxLength:"160"`
		Etablissement   *string    `json:"etablissement,omitempty" maxLength:"200"`
		Phone           *string    `json:"phone,omitempty" minLength:"6" maxLength:"40"`
		DepartementID   *string    `json:"departementId,omitempty" format:"uuid"`
		IefID           *string    `json:"iefId,omitempty" format:"uuid"`
		Notes           *string    `json:"notes,omitempty" maxLength:"2000"`
		ClientCreatedAt *time.Time `json:"clientCreatedAt,omitempty"`
		RelationStatus  *string    `json:"relationStatus,omitempty" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
		RelationReason  *string    `json:"relationReason,omitempty" maxLength:"500"`
		WhatsappStatus  *string    `json:"whatsappStatus,omitempty" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
		WhatsappE164    *string    `json:"whatsappE164,omitempty" minLength:"6" maxLength:"40"`
		Profession      *string    `json:"profession,omitempty" maxLength:"120"`
		Syndicat        *string    `json:"syndicat,omitempty" maxLength:"200"`
		ConnaitUES      *bool      `json:"connaitUES,omitempty"`
		Contacte        *bool      `json:"contacte,omitempty"`
	}
}

type representantPatch = RepresentantUpdateInput

func representantPatchIdentite(cible *db.Representant, in *representantPatch) {
	if in.Body.FullName != nil && strings.TrimSpace(*in.Body.FullName) != "" {
		cible.FullName = strings.TrimSpace(*in.Body.FullName)
	}
	if in.Body.Notes != nil {
		cible.Notes = representantNonVide(in.Body.Notes)
	}
	if in.Body.Prenom != nil {
		cible.Prenom = representantNonVide(in.Body.Prenom)
	}
	if in.Body.Etablissement != nil {
		cible.Etablissement = representantNonVide(in.Body.Etablissement)
	}
}

func representantPatchContexte(cible *db.Representant, in *representantPatch) {
	if in.Body.Syndicat != nil {
		cible.Syndicat = representantNonVide(in.Body.Syndicat)
	}
	if in.Body.ConnaitUES != nil {
		cible.ConnaitUES = in.Body.ConnaitUES
	}
	if in.Body.Contacte != nil {
		cible.Contacte = in.Body.Contacte
	}
	if in.Body.DepartementID != nil && *in.Body.DepartementID != "" {
		cible.DepartementId = *in.Body.DepartementID
	}
	if in.Body.IefID != nil {
		cible.IefId = in.Body.IefID
	}
	if in.Body.ClientCreatedAt != nil {
		cible.ClientCreatedAt = in.Body.ClientCreatedAt.UTC()
	}
}

func representantVerifierWhatsapp(statut db.WhatsappStatus, numero, actuel *string) error {
	if numero != nil && statut != db.WhatsappStatusAUTRENUMERO {
		return socle.Problem(http.StatusBadRequest, "WHATSAPP_NUMBER_NOT_ALLOWED", "Un numéro WhatsApp distinct n’a de sens qu’avec le statut AUTRE_NUMERO.")
	}
	if statut == db.WhatsappStatusAUTRENUMERO && numero == nil && actuel == nil {
		return socle.Problem(http.StatusBadRequest, "WHATSAPP_NUMBER_REQUIRED", "Le statut AUTRE_NUMERO exige le numéro WhatsApp.")
	}
	return nil
}

// CHAQUE CHAMP EST INDÉPENDAMMENT FACULTATIF : un appel interrompu ne doit rien
// perdre de ce qui a été dit avant. Seule une incohérence que le CHECK refuse
// aussi fait échouer le recueil.
func representantPatchWhatsapp(cible *db.Representant, in *representantPatch, region string) error {
	if in.Body.Profession != nil {
		cible.Profession = representantNonVide(in.Body.Profession)
	}
	if in.Body.WhatsappStatus == nil && in.Body.WhatsappE164 == nil {
		return nil
	}
	var numero *string
	if in.Body.WhatsappE164 != nil {
		e164, err := database.NormaliserTelephone(*in.Body.WhatsappE164, region)
		if err != nil {
			return err
		}
		numero = &e164
	}
	statut := cible.WhatsappStatus
	if in.Body.WhatsappStatus != nil {
		statut = db.WhatsappStatus(*in.Body.WhatsappStatus)
	}
	if err := representantVerifierWhatsapp(statut, numero, cible.WhatsappE164); err != nil {
		return err
	}
	cible.WhatsappStatus = statut
	if statut != db.WhatsappStatusAUTRENUMERO {
		cible.WhatsappE164 = nil
	} else if numero != nil {
		cible.WhatsappE164 = numero
	}
	return nil
}

// `AMBASSADEUR` et `REFUS` sont terminaux dans un sens : le rang ne baisse
// jamais, mais rien n'est figé à rang égal.
var representantTransitions = map[db.RepresentantRelation][]db.RepresentantRelation{
	db.RepresentantRelationINCONNU:     {db.RepresentantRelationCONTACTE, db.RepresentantRelationAMBASSADEUR, db.RepresentantRelationREFUS},
	db.RepresentantRelationCONTACTE:    {db.RepresentantRelationAMBASSADEUR, db.RepresentantRelationREFUS},
	db.RepresentantRelationAMBASSADEUR: {db.RepresentantRelationREFUS},
	db.RepresentantRelationREFUS:       {db.RepresentantRelationAMBASSADEUR},
}

// La garde porte sur le statut de DÉPART et vit dans la mise à jour elle-même :
// deux appels concurrents la passeraient tous les deux sur une lecture
// préalable, et le second écrirait une transition partant d'un statut déjà
// quitté. Un geste qui ne change rien n'écrit rien.
func representantBasculerRelation(ctx context.Context, q *db.Queries, id, userID string, de, vers db.RepresentantRelation, motif *string) error {
	if de == vers {
		return nil
	}
	if !representantTransitionPermise(de, vers) {
		return socle.Problem(http.StatusForbidden, "REPRESENTANT_RELATION_TRANSITION_REFUSED",
			fmt.Sprintf("Relation du représentant : le passage de « %s » à « %s » n’est pas permis.", de, vers))
	}
	bascules, err := q.UpdateRelationStatus(ctx, db.UpdateRelationStatusParams{ID: id, FromStatus: de, ToStatus: vers})
	if err != nil || bascules != 1 {
		return err
	}
	trace, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return q.InsertRelationChange(ctx, db.InsertRelationChangeParams{
		ID: trace.String(), RepresentantId: id, FromStatus: de, ToStatus: vers,
		Reason: representantNonVide(motif), ChangedById: userID, Source: db.ChangeSourceWEB,
	})
}

func representantTransitionPermise(de, vers db.RepresentantRelation) bool {
	for _, permis := range representantTransitions[de] {
		if permis == vers {
			return true
		}
	}
	return false
}

func (s *service) modifierRepresentant(ctx context.Context, in *RepresentantUpdateInput) (*RepresentantOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	existant, err := s.Q.RepresentantPourEcriture(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, representantIntrouvable()
	}
	if err != nil {
		return nil, err
	}
	if u.Role != socle.Admin && existant.CreatedById != u.ID {
		return nil, socle.Problem(http.StatusForbidden, "NOT_OWNER", "Cette fiche appartient à un autre téléconseiller.")
	}
	modifie := existant
	if err := representantAppliquerPatch(&modifie, in, s.Cfg.PhoneRegion); err != nil {
		return nil, err
	}
	if modifie.PhoneE164 != existant.PhoneE164 {
		if conflit := s.verifierTelephoneRepresentantLibre(ctx, &u, modifie.PhoneE164); conflit != nil {
			return nil, conflit
		}
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)
	if err := representantEcrireModification(ctx, q, u.ID, &existant, &modifie, in); err != nil {
		return nil, err
	}
	dto, err := representantFicheLue(ctx, q, in.ID, true, u.ID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &RepresentantOutput{Body: *dto}, nil
}

func representantAppliquerPatch(cible *db.Representant, in *representantPatch, region string) error {
	if in.Body.Phone != nil {
		phone, err := database.NormaliserTelephone(*in.Body.Phone, region)
		if err != nil {
			return err
		}
		cible.PhoneE164 = phone
	}
	representantPatchIdentite(cible, in)
	representantPatchContexte(cible, in)
	return representantPatchWhatsapp(cible, in, region)
}

// La bascule de relation part APRÈS la mise à jour ordinaire : elle porte sa
// propre garde sur le statut de départ, et le trigger
// `representants_ambassadeur_vaut_accepte` ne doit s'armer que sur elle.
func representantEcrireModification(ctx context.Context, q *db.Queries, userID string, existant, modifie *db.Representant, in *representantPatch) error {
	ecrites, err := q.UpdateRepresentant(ctx, db.UpdateRepresentantParams{
		ID: existant.ID, Rev: in.Body.Rev,
		FullName: modifie.FullName, PhoneE164: modifie.PhoneE164, Notes: modifie.Notes,
		Prenom: modifie.Prenom, Etablissement: modifie.Etablissement,
		DepartementID: modifie.DepartementId, IefID: modifie.IefId,
		ClientCreatedAt: modifie.ClientCreatedAt, WhatsappStatus: modifie.WhatsappStatus,
		WhatsappE164: modifie.WhatsappE164, Profession: modifie.Profession,
		Syndicat: modifie.Syndicat, ConnaitUes: modifie.ConnaitUES, Contacte: modifie.Contacte,
	})
	if err != nil {
		return err
	}
	if ecrites != 1 {
		p := socle.Problem(http.StatusConflict, "REV_CONFLICT", "La fiche a été modifiée entre-temps par un autre utilisateur. Rechargez-la avant de réessayer.")
		p.Errors = []*huma.ErrorDetail{{Location: "body.rev", Message: p.Message, Value: existant.Rev}}
		return p
	}
	if in.Body.RelationStatus != nil {
		vers := db.RepresentantRelation(*in.Body.RelationStatus)
		if err := representantBasculerRelation(ctx, q, existant.ID, userID, existant.RelationStatus, vers, in.Body.RelationReason); err != nil {
			return err
		}
	}
	return representantJournalFiche(ctx, q, userID, existant.ID, representantSnapshot(existant), representantSnapshot(modifie))
}

// Le journal du FORMULAIRE de la fiche : ce que chaque écran a écrit, champ par
// champ. Il vit dans `audit_logs` sous une action par canal.
var representantChampsFiche = []string{
	RepresentantChampNom, socle.ProspectChampPrenom, RepresentantChampTel, socle.ProspectChampEtablissement, RepresentantChampNotes, RepresentantChampDep, RepresentantChampIef,
	socle.ProspectChampWhatsappStatut, socle.ProspectChampWhatsappNumero, socle.ProspectChampProfession, RepresentantChampSyndicat, RepresentantChampConnaitUES, RepresentantChampContacte,
}

func representantSnapshot(r *db.Representant) map[string]any {
	return map[string]any{
		RepresentantChampNom: r.FullName, "prenom": representantValeur(r.Prenom), RepresentantChampTel: r.PhoneE164,
		"etablissement": representantValeur(r.Etablissement), "notes": representantValeur(r.Notes),
		RepresentantChampDep: r.DepartementId, RepresentantChampIef: representantValeur(r.IefId),
		"whatsappStatus": string(r.WhatsappStatus), "whatsappE164": representantValeur(r.WhatsappE164),
		"profession": representantValeur(r.Profession), "syndicat": representantValeur(r.Syndicat),
		"connaitUES": representantValeur(r.ConnaitUES), "contacte": representantValeur(r.Contacte),
	}
}

func representantJournalFiche(ctx context.Context, q *db.Queries, userID, id string, avant, apres map[string]any) error {
	change, initial := map[string]any{}, map[string]any{}
	for _, champ := range representantChampsFiche {
		if avant[champ] == apres[champ] {
			continue
		}
		initial[champ], change[champ] = avant[champ], apres[champ]
	}
	if len(change) == 0 {
		return nil
	}
	return database.Auditer(ctx, q, userID, representantActionWEB, representantEntite, id, initial, change)
}

type RepresentantRelationHistoryOutput struct {
	Body struct {
		Items []RepresentantRelationChangeDto `json:"items"`
	}
}

// Vérifier la seule existence donnait à tout téléconseiller l'accès aux
// sous-ressources d'un représentant d'un collègue, dont `fiche-history` qui rend
// le nom et le téléphone de la fiche. La portée du lecteur s'applique ici.
func (s *service) exigerRepresentant(ctx context.Context, id string) error {
	u := socle.UtilisateurCourant(ctx)
	_, err := representantFicheLue(ctx, s.Q, id, representantLitTout(u.Role, false), u.ID)
	return err
}

// Lecture GLOBALE délibérée : une trace suit toujours la fiche, déjà résolue
// ci-dessus. Rejouer le filtre ici priverait une fiche de son histoire, ce qui
// se lit à l'écran comme une relation jamais entamée.
func (s *service) historiqueRelationRepresentant(ctx context.Context, in *RepresentantIDInput) (*RepresentantRelationHistoryOutput, error) {
	if err := s.exigerRepresentant(ctx, in.ID); err != nil {
		return nil, err
	}
	rows, err := s.Q.ListRelationChanges(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &RepresentantRelationHistoryOutput{}
	out.Body.Items = make([]RepresentantRelationChangeDto, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		out.Body.Items = append(out.Body.Items, RepresentantRelationChangeDto{
			ID: r.ID, RepresentantID: r.RepresentantId,
			FromStatus: string(r.FromStatus), ToStatus: string(r.ToStatus), Reason: r.Reason,
			ChangedByID: r.ChangedById, ChangedByName: r.ChangedByName,
			Source: string(r.Source), ChangedAt: representantISO(r.ChangedAt),
		})
	}
	return out, nil
}

type RepresentantCallAttemptsOutput struct {
	Body struct {
		Items []RepresentantCallAttemptDto `json:"items"`
	}
}

// Le chronomètre court de la première saisie à la qualification. Nul tant
// qu'une borne manque, jamais zéro : une fiche seulement consultée tirerait la
// durée moyenne de traitement vers le bas.
func (s *service) dureesTraitementRepresentant(ctx context.Context, id string) (map[string]int32, error) {
	rows, err := s.Q.DureesDeTraitement(ctx, &id)
	if err != nil {
		return nil, err
	}
	durees := make(map[string]int32, len(rows))
	for _, r := range rows {
		if r.ClosingAttemptId == nil || r.FirstInputAt == nil || r.ClosedAt == nil {
			continue
		}
		durees[*r.ClosingAttemptId] = int32(r.ClosedAt.Sub(*r.FirstInputAt).Round(time.Second).Seconds())
	}
	return durees, nil
}

func (s *service) historiqueAppelsRepresentant(ctx context.Context, in *RepresentantIDInput) (*RepresentantCallAttemptsOutput, error) {
	if err := s.exigerRepresentant(ctx, in.ID); err != nil {
		return nil, err
	}
	rows, err := s.Q.ListRepCallAttempts(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	durees, err := s.dureesTraitementRepresentant(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	out := &RepresentantCallAttemptsOutput{}
	out.Body.Items = make([]RepresentantCallAttemptDto, 0, len(rows))
	for i := range rows {
		item := representantCallAttemptDto(&rows[i])
		if duree, ok := durees[rows[i].ID]; ok {
			item.DureeTraitementSecondes = &duree
		}
		out.Body.Items = append(out.Body.Items, item)
	}
	return out, nil
}

func representantCallAttemptDto(r *db.ListRepCallAttemptsRow) RepresentantCallAttemptDto {
	return RepresentantCallAttemptDto{
		ID: r.ID, Outcome: string(r.Outcome),
		StatutQualificationID:              r.StatutQualificationId,
		StatutQualificationLabel:           r.StatutQualificationLabel,
		StatutQualificationRequiresComment: r.StatutQualificationRequiresComment,
		Comment:                            r.Comment,
		CallbackAt:                         representantISOPtr(r.CallbackAt),
		PromisedProspects:                  r.PromisedProspects,
		EtablissementConfirme:              r.EtablissementConfirme,
		NumeroConfirme:                     r.NumeroConfirme,
		Contacte:                           r.Contacte,
		ConnaitUES:                         r.ConnaitUES,
		Syndicat:                           r.Syndicat,
		SuggestedName:                      r.SuggestedName,
		SuggestedPhoneE164:                 r.SuggestedPhoneE164,
		SuggestedNote:                      r.SuggestedNote,
		DeviceCallType:                     r.DeviceCallType,
		DeviceCallDurationSeconds:          r.DeviceCallDurationSeconds,
		DeviceCallAt:                       representantISOPtr(r.DeviceCallAt),
		PerformedByID:                      r.PerformedById,
		PerformedByName:                    r.PerformedByName,
		ClientCreatedAt:                    representantISO(r.ClientCreatedAt),
	}
}

type RepresentantFicheHistoryOutput struct {
	Body struct {
		Items []RepresentantFicheChangeDto `json:"items"`
	}
}

var representantSourcesFiche = map[string]bool{"WEB": true, "MOBILE": true, "APPEL": true, "IMPORT": true}

func representantSourceFiche(action string) string {
	suffixe := strings.TrimPrefix(action, "representant.fiche.")
	if representantSourcesFiche[suffixe] {
		return suffixe
	}
	return "WEB"
}

func representantValeurLisible(champ string, valeur any, noms map[string]string) *string {
	switch v := valeur.(type) {
	case nil:
		return nil
	case bool:
		if v {
			return representantTexte("true")
		}
		return representantTexte("false")
	case string:
		if champ == RepresentantChampDep || champ == RepresentantChampIef {
			if nom, ok := noms[v]; ok {
				return representantTexte(nom)
			}
		}
		return representantTexte(v)
	default:
		brut, err := json.Marshal(valeur)
		if err != nil {
			return nil
		}
		return representantTexte(string(brut))
	}
}

func representantObjetJSON(brut []byte) map[string]any {
	if len(brut) == 0 {
		return map[string]any{}
	}
	objet := map[string]any{}
	if err := json.Unmarshal(brut, &objet); err != nil {
		return map[string]any{}
	}
	return objet
}

// Les identifiants de département et d'IEF se lisent par leur nom.
func (s *service) nomsReferencesRepresentant(ctx context.Context, versions []map[string]any) (map[string]string, error) {
	vus := map[string]bool{}
	ids := []string{}
	for _, version := range versions {
		for _, champ := range []string{RepresentantChampDep, RepresentantChampIef} {
			id, ok := version[champ].(string)
			if !ok || vus[id] {
				continue
			}
			vus[id] = true
			ids = append(ids, id)
		}
	}
	noms := map[string]string{}
	if len(ids) == 0 {
		return noms, nil
	}
	rows, err := s.Q.NomsDesReferences(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		noms[r.ID] = r.Name
	}
	return noms, nil
}

func (s *service) historiqueFicheRepresentant(ctx context.Context, in *RepresentantIDInput) (*RepresentantFicheHistoryOutput, error) {
	if err := s.exigerRepresentant(ctx, in.ID); err != nil {
		return nil, err
	}
	rows, err := s.Q.ListFicheChanges(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	versions := make([]map[string]any, 0, 2*len(rows))
	for _, r := range rows {
		versions = append(versions, representantObjetJSON(r.Before), representantObjetJSON(r.After))
	}
	noms, err := s.nomsReferencesRepresentant(ctx, versions)
	if err != nil {
		return nil, err
	}
	out := &RepresentantFicheHistoryOutput{}
	out.Body.Items = make([]RepresentantFicheChangeDto, 0, len(rows))
	for i, r := range rows {
		nom := "Compte supprimé"
		if r.ChangedByName != nil {
			nom = *r.ChangedByName
		}
		out.Body.Items = append(out.Body.Items, RepresentantFicheChangeDto{
			ID: r.ID, RepresentantID: in.ID, Source: representantSourceFiche(r.Action),
			ChangedByID: r.UserId, ChangedByName: nom, ChangedAt: representantISO(r.At),
			Champs: representantChamps(versions[2*i], versions[2*i+1], noms),
		})
	}
	return out, nil
}

func representantChamps(avant, apres map[string]any, noms map[string]string) []RepresentantFicheChampDto {
	champs := make([]RepresentantFicheChampDto, 0, len(apres))
	for _, champ := range representantChampsFiche {
		if _, present := apres[champ]; !present {
			continue
		}
		champs = append(champs, RepresentantFicheChampDto{
			Champ: champ,
			Avant: representantValeurLisible(champ, avant[champ], noms),
			Apres: representantValeurLisible(champ, apres[champ], noms),
		})
	}
	return champs
}

type RepresentantCommentsInput struct {
	ID       string `path:"id" format:"uuid"`
	Page     int    `query:"page" minimum:"1" default:"1"`
	PageSize int    `query:"pageSize" minimum:"1" maximum:"200" default:"50"`
}

type RepresentantCommentsOutput struct {
	Body struct {
		Items []RepresentantCommentDto `json:"items"`
		Meta  RepresentantPageMeta     `json:"meta"`
	}
}

func (s *service) listerCommentairesRepresentant(ctx context.Context, in *RepresentantCommentsInput) (*RepresentantCommentsOutput, error) {
	if err := s.exigerRepresentant(ctx, in.ID); err != nil {
		return nil, err
	}
	total, err := s.Q.CountRepresentantComments(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	limite, decalage := representantTranche(in.Page, in.PageSize)
	rows, err := s.Q.ListRepresentantComments(ctx, db.ListRepresentantCommentsParams{
		RepresentantId: in.ID, Lim: limite, Off: decalage,
	})
	if err != nil {
		return nil, err
	}
	out := &RepresentantCommentsOutput{}
	out.Body.Items = make([]RepresentantCommentDto, 0, len(rows))
	for i := range rows {
		r := &rows[i]
		out.Body.Items = append(out.Body.Items, RepresentantCommentDto{
			ID: r.ID, RepresentantID: r.RepresentantId, AuthorID: r.AuthorId, AuthorName: r.AuthorName,
			Body: r.Body, ClientCreatedAt: representantISO(r.ClientCreatedAt), CreatedAt: representantISO(r.CreatedAt),
		})
	}
	out.Body.Meta = representantMeta(total, in.Page, in.PageSize)
	return out, nil
}

type RepresentantCommentInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		ID              string     `json:"id" format:"uuid"`
		Body            string     `json:"body" minLength:"1" maxLength:"2000"`
		ClientCreatedAt *time.Time `json:"clientCreatedAt,omitempty"`
	}
}

type RepresentantCommentOutput struct {
	Body RepresentantCommentDto
}

// Le fil est en AJOUT SEUL et suit l'ANNUAIRE : commenter n'importe quelle fiche
// vivante est permis, modifier la fiche elle-même ne l'est pas. `ON CONFLICT DO
// NOTHING` plutôt qu'une lecture préalable : le rejeu et la course se traitent
// du même geste, c'est PostgreSQL qui arbitre la clé primaire.
func (s *service) ajouterCommentaireRepresentant(ctx context.Context, in *RepresentantCommentInput) (*RepresentantCommentOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if err := s.exigerRepresentant(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.Q.InsertRepresentantComment(ctx, db.InsertRepresentantCommentParams{
		ID: in.Body.ID, RepresentantId: in.ID, AuthorId: u.ID,
		Body: strings.TrimSpace(in.Body.Body), ClientCreatedAt: representantSaisie(in.Body.ClientCreatedAt),
	}); err != nil {
		return nil, err
	}
	pose, err := s.Q.RepresentantCommentParId(ctx, in.Body.ID)
	if err != nil {
		return nil, err
	}
	if pose.RepresentantId != in.ID || pose.AuthorId != u.ID {
		return nil, socle.Problem(http.StatusForbidden, "ENTITY_ID_OWNED_BY_ANOTHER_USER", "Cet identifiant appartient à un autre commentaire.")
	}
	out := &RepresentantCommentOutput{Body: RepresentantCommentDto{
		ID: pose.ID, RepresentantID: pose.RepresentantId, AuthorID: pose.AuthorId, AuthorName: pose.AuthorName,
		Body: pose.Body, ClientCreatedAt: representantISO(pose.ClientCreatedAt), CreatedAt: representantISO(pose.CreatedAt),
	}}
	return out, nil
}

type RepresentantCommentDeleteInput struct {
	ID        string `path:"id" format:"uuid"`
	CommentID string `path:"commentId" format:"uuid"`
}

type RepresentantOkOutput struct {
	Body struct {
		OK bool `json:"ok"`
	}
}

// Suppression douce, réservée à l'ADMIN : l'auteur ne se dédit pas.
func (s *service) supprimerCommentaireRepresentant(ctx context.Context, in *RepresentantCommentDeleteInput) (*RepresentantOkOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	commentaire, err := s.Q.RepresentantCommentParId(ctx, in.CommentID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	// Le texte effacé part dans la trace : sans lui, le journal dirait qu'un
	// commentaire a disparu sans dire lequel.
	avant := map[string]any{
		"commentaireId": in.CommentID, "auteurId": commentaire.AuthorId,
		"texte": commentaire.Body, "saisiLe": commentaire.ClientCreatedAt,
	}
	err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		supprimes, err := q.SoftDeleteRepresentantComment(ctx, db.SoftDeleteRepresentantCommentParams{
			ID: in.CommentID, RepresentantID: in.ID,
		})
		if err != nil {
			return err
		}
		if supprimes != 1 {
			return socle.Problem(http.StatusNotFound, "REPRESENTANT_COMMENT_NOT_FOUND", "Commentaire introuvable.")
		}
		return database.Auditer(ctx, q, u.ID, "representant.comment_delete", representantEntite, in.ID, avant, nil)
	})
	if err != nil {
		return nil, err
	}
	out := &RepresentantOkOutput{}
	out.Body.OK = true
	return out, nil
}

type RepresentantDeleteInput struct {
	ID      string `path:"id" format:"uuid"`
	Cascade bool   `query:"cascade"`
}

// Refus explicite plutôt que cascade implicite : supprimer un représentant
// emporte tous ses prospects, ce qui doit être une décision consciente et non
// l'effet de bord d'un clic.
func (s *service) supprimerRepresentant(ctx context.Context, in *RepresentantDeleteInput) (*RepresentantOkOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	existant, err := s.Q.RepresentantPourEcriture(ctx, in.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, representantIntrouvable()
	}
	if err != nil {
		return nil, err
	}
	if u.Role != socle.Admin && existant.CreatedById != u.ID {
		return nil, socle.Problem(http.StatusForbidden, "NOT_OWNER", "Cette fiche appartient à un autre téléconseiller.")
	}
	prospects, err := s.Q.CompterProspectsVivants(ctx, &in.ID)
	if err != nil {
		return nil, err
	}
	if prospects > 0 && !in.Cascade {
		p := socle.Problem(http.StatusConflict, "REPRESENTANT_HAS_PROSPECTS",
			fmt.Sprintf("Ce représentant porte %d prospect(s). Relancez avec cascade=true pour tout supprimer.", prospects))
		p.Errors = []*huma.ErrorDetail{{Location: "query.cascade", Message: p.Message, Value: prospects}}
		return nil, p
	}

	if err := s.representantEffacer(ctx, u.ID, in.ID, &existant, prospects); err != nil {
		return nil, err
	}
	out := &RepresentantOkOutput{}
	out.Body.OK = true
	return out, nil
}

// La fiche, ses prospects et la trace dans la même transaction : l'état
// supprimé n'est plus lisible ailleurs qu'au journal.
func (s *service) representantEffacer(ctx context.Context, auteur, id string, existant *db.Representant, prospects int32) error {
	avant := representantSnapshot(existant)
	avant["prospectsSupprimes"] = prospects
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		if err := q.SoftDeleteProspectsDuRepresentant(ctx, &id); err != nil {
			return err
		}
		if _, err := q.SoftDeleteRepresentant(ctx, id); err != nil {
			return err
		}
		return database.Auditer(ctx, q, auteur, "representant.delete", representantEntite, id, avant, nil)
	})
}

var Garde = map[string][]socle.Role{
	"GET /api/v1/representants":                              socle.Parcours,
	"GET /api/v1/representants/lookup":                       socle.Parcours,
	"POST /api/v1/representants":                             socle.Parcours,
	"GET /api/v1/representants/{id}":                         socle.Parcours,
	"PATCH /api/v1/representants/{id}":                       socle.Parcours,
	"DELETE /api/v1/representants/{id}":                      socle.Parcours,
	"GET /api/v1/representants/{id}/relation-history":        socle.Parcours,
	"GET /api/v1/representants/{id}/call-attempts":           socle.Parcours,
	"GET /api/v1/representants/{id}/fiche-history":           socle.Parcours,
	"GET /api/v1/representants/{id}/comments":                socle.Parcours,
	"POST /api/v1/representants/{id}/comments":               socle.Parcours,
	"DELETE /api/v1/representants/{id}/comments/{commentId}": socle.AdminSeul,
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	const base = "/api/v1/representants"
	huma.Register(api, huma.Operation{OperationID: "listRepresentants", Method: http.MethodGet, Path: base}, s.listerRepresentants)
	huma.Register(api, huma.Operation{OperationID: "lookupRepresentantByPhone", Method: http.MethodGet, Path: base + "/lookup"}, s.chercherRepresentant)
	huma.Register(api, huma.Operation{OperationID: "createRepresentant", Method: http.MethodPost, Path: base, DefaultStatus: http.StatusCreated}, s.creerRepresentant)
	huma.Register(api, huma.Operation{OperationID: "getRepresentant", Method: http.MethodGet, Path: base + "/{id}"}, s.lireRepresentant)
	huma.Register(api, huma.Operation{OperationID: "updateRepresentant", Method: http.MethodPatch, Path: base + "/{id}"}, s.modifierRepresentant)
	huma.Register(api, huma.Operation{OperationID: "deleteRepresentant", Method: http.MethodDelete, Path: base + "/{id}"}, s.supprimerRepresentant)
	huma.Register(api, huma.Operation{OperationID: "listRepresentantRelationChanges", Method: http.MethodGet, Path: base + "/{id}/relation-history"}, s.historiqueRelationRepresentant)
	huma.Register(api, huma.Operation{OperationID: "listRepresentantCallAttempts", Method: http.MethodGet, Path: base + "/{id}/call-attempts"}, s.historiqueAppelsRepresentant)
	huma.Register(api, huma.Operation{OperationID: "listRepresentantFicheChanges", Method: http.MethodGet, Path: base + "/{id}/fiche-history"}, s.historiqueFicheRepresentant)
	huma.Register(api, huma.Operation{OperationID: "listRepresentantComments", Method: http.MethodGet, Path: base + "/{id}/comments"}, s.listerCommentairesRepresentant)
	huma.Register(api, huma.Operation{OperationID: "addRepresentantComment", Method: http.MethodPost, Path: base + "/{id}/comments", DefaultStatus: http.StatusCreated}, s.ajouterCommentaireRepresentant)
	huma.Register(api, huma.Operation{OperationID: "deleteRepresentantComment", Method: http.MethodDelete, Path: base + "/{id}/comments/{commentId}"}, s.supprimerCommentaireRepresentant)
}
