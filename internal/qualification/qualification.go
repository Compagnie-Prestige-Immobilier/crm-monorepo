package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/exports"
	"cpi-go/internal/representants"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	qualificationAmbassadeur = "AMBASSADEUR"
	qualificationRefus       = "REFUS"
	qualificationAutreNumero = "AUTRE_NUMERO"
	qualificationCallback    = "CALLBACK"
	qualificationRefusee     = "REFUSED"
	qualificationFauxNumero  = "WRONG_NUMBER"
)

var Garde = map[string][]socle.Role{
	"POST /api/v1/rep-campaigns/attempts":       socle.Parcours,
	"POST /api/v1/phase2/call-attempts":         socle.Parcours,
	"GET /api/v1/phase2/callbacks":              socle.Parcours,
	"GET /api/v1/phase2/directory":              socle.Parcours,
	"POST /api/v1/phase2/callbacks/{id}/cancel": {socle.Admin, socle.Commercial, socle.ChargeClientele},
	"POST /api/v1/phase2/callbacks/{id}/snooze": {socle.Admin, socle.Commercial, socle.ChargeClientele},
	"POST /api/v1/ouvertures":                   socle.Parcours,
	"GET /api/v1/ouvertures/courante":           socle.Parcours,
	"PUT /api/v1/ouvertures/{id}/brouillon":     socle.Parcours,
	"GET /api/v1/ouvertures/comptage":           socle.Parcours,
	"GET /api/v1/suggestions":                   socle.Parcours,
	"PATCH /api/v1/suggestions/{id}":            socle.Parcours,
	"POST /api/v1/sync/push":                    socle.Parcours,
	"POST /api/v1/presence/beat":                socle.Tous,
}

func qualificationRoute(id, methode, chemin string) huma.Operation {
	return huma.Operation{OperationID: id, Method: methode, Path: chemin}
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Register(api, qualificationRoute("recordRepCallAttempt", http.MethodPost, "/api/v1/rep-campaigns/attempts"), s.qualificationRepAppel)
	huma.Register(api, qualificationRoute("recordCallAttempt", http.MethodPost, "/api/v1/phase2/call-attempts"), s.qualificationTentativeProspect)
	huma.Register(api, qualificationRoute("listScheduledCallbacks", http.MethodGet, "/api/v1/phase2/callbacks"), s.qualificationListerRappels)
	huma.Register(api, qualificationRoute("cancelScheduledCallback", http.MethodPost, "/api/v1/phase2/callbacks/{id}/cancel"), s.qualificationAnnulerRappel)
	huma.Register(api, qualificationRoute("snoozeScheduledCallback", http.MethodPost, "/api/v1/phase2/callbacks/{id}/snooze"), s.qualificationReporterRappel)
	huma.Register(api, qualificationRoute("ouvrirFiche", http.MethodPost, "/api/v1/ouvertures"), s.qualificationOuvrirFiche)
	huma.Register(api, qualificationRoute("ouvertureCourante", http.MethodGet, "/api/v1/ouvertures/courante"), s.qualificationOuvertureCourante)
	huma.Register(api, qualificationRoute("enregistrerBrouillonOuverture", http.MethodPut, "/api/v1/ouvertures/{id}/brouillon"), s.qualificationEnregistrerBrouillon)
	huma.Register(api, qualificationRoute("compterOuvertures", http.MethodGet, "/api/v1/ouvertures/comptage"), s.qualificationComptage)
	huma.Register(api, qualificationRoute("listSuggestions", http.MethodGet, "/api/v1/suggestions"), s.qualificationListerSuggestions)
	huma.Register(api, qualificationRoute("updateSuggestionStatus", http.MethodPatch, "/api/v1/suggestions/{id}"), s.qualificationBasculerSuggestion)
	presenceMonterRoutes(api, s)
	annuaireMonterRoutes(api, s)
	syncMonterRoutes(api, s)
}

func qualificationTx(ctx context.Context, s *service, geste func(*db.Queries) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := geste(s.Q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func qualificationISO(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func qualificationISOPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := qualificationISO(*t)
	return &s
}

func qualificationRogne(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func qualificationTexte(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func qualificationValeur[T any](p *T) any {
	if p == nil {
		return nil
	}
	return *p
}

func qualificationInstant(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	utc := t.UTC()
	return &utc
}

func qualificationVoitTout(role socle.Role) bool {
	return role == socle.Admin || role == socle.Superviseur || role == socle.Direction
}

var qualificationTransitionsRelation = map[string][]string{
	"INCONNU":                {"CONTACTE", qualificationAmbassadeur, qualificationRefus},
	"CONTACTE":               {qualificationAmbassadeur, qualificationRefus},
	qualificationAmbassadeur: {qualificationRefus},
	qualificationRefus:       {qualificationAmbassadeur},
}

func qualificationTransitionLegale(t map[string][]string, de, vers string) bool {
	return de == vers || slices.Contains(t[de], vers)
}

type QualificationRepAttemptBody struct {
	ID                    string     `json:"id" format:"uuid"`
	RepresentantID        string     `json:"representantId" format:"uuid"`
	Outcome               string     `json:"outcome" enum:"REACHED,PROSPECTS_PROMISED,UNREACHABLE,CALLBACK,REFUSED,WRONG_NUMBER,OTHER"`
	ClientCreatedAt       time.Time  `json:"clientCreatedAt" format:"date-time"`
	StatutQualificationID *string    `json:"statutQualificationId,omitempty" format:"uuid"`
	OuvertureID           *string    `json:"ouvertureId,omitempty" format:"uuid"`
	PromisedProspects     *int32     `json:"promisedProspects,omitempty" minimum:"0" maximum:"10000"`
	Comment               *string    `json:"comment,omitempty" maxLength:"2000"`
	RelationStatus        *string    `json:"relationStatus,omitempty" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	SuggestedPhone        *string    `json:"suggestedPhone,omitempty" minLength:"6" maxLength:"40"`
	SuggestedName         *string    `json:"suggestedName,omitempty" maxLength:"120"`
	SuggestedNote         *string    `json:"suggestedNote,omitempty" maxLength:"2000"`
	WhatsappStatus        *string    `json:"whatsappStatus,omitempty" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	WhatsappE164          *string    `json:"whatsappE164,omitempty" minLength:"6" maxLength:"40"`
	Profession            *string    `json:"profession,omitempty" maxLength:"120"`
	EtablissementConfirme *bool      `json:"etablissementConfirme,omitempty"`
	Etablissement         *string    `json:"etablissement,omitempty" maxLength:"200"`
	NumeroConfirme        *bool      `json:"numeroConfirme,omitempty"`
	Phone                 *string    `json:"phone,omitempty" minLength:"6" maxLength:"40"`
	Contacte              *bool      `json:"contacte,omitempty"`
	ConnaitUES            *bool      `json:"connaitUES,omitempty"`
	Syndicat              *string    `json:"syndicat,omitempty" maxLength:"200"`
	CallbackAt            *time.Time `json:"callbackAt,omitempty" format:"date-time"`
}

type QualificationRepAttemptInput struct{ Body QualificationRepAttemptBody }

type QualificationRepAttemptOutput struct {
	Body struct {
		Status     string                      `json:"status" enum:"applied,duplicate"`
		AttemptID  string                      `json:"attemptId" format:"uuid"`
		Suggestion *QualificationSuggestionDTO `json:"suggestion"`
	}
}

func qualificationRepResultat(statut, id string) *QualificationRepAttemptOutput {
	out := &QualificationRepAttemptOutput{}
	out.Body.Status, out.Body.AttemptID = statut, id
	return out
}

var qualificationOutcomeParEffet = map[db.StatutQualificationEffect]string{
	db.StatutQualificationEffectREACHED:          exports.IssueJointImport,
	db.StatutQualificationEffectREFUSED:          qualificationRefusee,
	db.StatutQualificationEffectSCHEDULECALLBACK: qualificationCallback,
	db.StatutQualificationEffectUNREACHABLE:      string(db.CallOutcomeUNREACHABLE),
	db.StatutQualificationEffectWRONGNUMBER:      qualificationFauxNumero,
}

var qualificationReponsesRattachement = []string{qualificationAmbassadeur, qualificationRefus}

func qualificationReglesRepIssue(b *QualificationRepAttemptBody) error {
	if b.PromisedProspects != nil && b.Outcome != "PROSPECTS_PROMISED" {
		return socle.Problem(http.StatusBadRequest, "REP_CAMPAIGN_PROMISED_NOT_ALLOWED",
			"Un nombre de fiches promises n’est admis que pour l’issue PROSPECTS_PROMISED.")
	}
	if b.Outcome == qualificationCallback && b.CallbackAt == nil {
		return socle.Problem(http.StatusBadRequest, "REP_CAMPAIGN_CALLBACK_AT_REQUIRED",
			"L’issue « À rappeler » exige une date de rappel.")
	}
	return nil
}

type qualificationPatchWhatsapp struct {
	statut        *string
	majNumero     bool
	numero        *string
	majProfession bool
	profession    *string
}

// EB-23 : le CHECK refuse un numéro distinct hors AUTRE_NUMERO, et AUTRE_NUMERO
// sans numéro. Le recueil échoue seulement sur ces deux contradictions.
func qualificationWhatsappRepresentant(b *QualificationRepAttemptBody, rep *db.RepresentantAQualifierRow, region string) (qualificationPatchWhatsapp, error) {
	p := qualificationPatchWhatsapp{}
	if b.Profession != nil {
		p.majProfession, p.profession = true, qualificationRogne(b.Profession)
	}
	if b.WhatsappStatus == nil && b.WhatsappE164 == nil {
		return p, nil
	}
	var numero *string
	if b.WhatsappE164 != nil {
		e164, err := database.NormaliserTelephone(*b.WhatsappE164, region)
		if err != nil {
			return p, err
		}
		numero = &e164
	}
	statut := string(rep.WhatsappStatus)
	if b.WhatsappStatus != nil {
		statut = *b.WhatsappStatus
		p.statut = b.WhatsappStatus
	}
	if numero != nil && statut != qualificationAutreNumero {
		return p, socle.Problem(http.StatusBadRequest, "WHATSAPP_NUMBER_NOT_ALLOWED",
			"Un numéro WhatsApp distinct n’a de sens qu’avec le statut AUTRE_NUMERO.")
	}
	if statut == qualificationAutreNumero {
		if numero == nil && rep.WhatsappE164 == nil {
			return p, socle.Problem(http.StatusBadRequest, "WHATSAPP_NUMBER_REQUIRED",
				"Le statut AUTRE_NUMERO exige le numéro WhatsApp.")
		}
		p.majNumero, p.numero = numero != nil, numero
		return p, nil
	}
	p.majNumero = rep.WhatsappE164 != nil
	return p, nil
}

// Chaîne vide : le numéro en fiche ne bouge pas.
func qualificationNumeroCorrige(b *QualificationRepAttemptBody, rep *db.RepresentantAQualifierRow, region string) (string, error) {
	if b.NumeroConfirme == nil || *b.NumeroConfirme || b.Phone == nil {
		return "", nil
	}
	e164, err := database.NormaliserTelephone(*b.Phone, region)
	if err != nil {
		return "", err
	}
	if e164 == rep.PhoneE164 {
		return "", nil
	}
	return e164, nil
}

func qualificationContreditRattachement(repondue *string, posee *db.RepresentantRelation) bool {
	if repondue == nil || posee == nil {
		return false
	}
	if !slices.Contains(qualificationReponsesRattachement, *repondue) {
		return false
	}
	if !slices.Contains(qualificationReponsesRattachement, string(*posee)) {
		return false
	}
	return *repondue != string(*posee)
}

// Le client garde le dernier mot ; le statut comble son silence. Une relation
// venue du statut que la transition refuse est laissée de côté, pas levée.
func qualificationRelationAPoser(b *QualificationRepAttemptBody, statut *db.StatutQualificationParIdRow, courante string) *string {
	if b.RelationStatus != nil {
		return b.RelationStatus
	}
	if statut == nil || statut.RelationStatus == nil {
		return nil
	}
	posee := string(*statut.RelationStatus)
	if !qualificationTransitionLegale(qualificationTransitionsRelation, courante, posee) {
		return nil
	}
	return &posee
}

// L'échéance et son origine s'écrivent ensemble, un CHECK refuse l'une sans
// l'autre. Un délai nul dit « ne revient jamais ».
func qualificationProchainRappel(callbackAt *time.Time, at time.Time, statut *db.StatutQualificationParIdRow) (quand *time.Time, origine *string) {
	if callbackAt != nil {
		promis := "PROMIS"
		return qualificationInstant(*callbackAt), &promis
	}
	if statut == nil || statut.RetryAfterMinutes == nil {
		return nil, nil
	}
	automatique := "AUTOMATIQUE"
	return qualificationInstant(at.Add(time.Duration(*statut.RetryAfterMinutes) * time.Minute)), &automatique
}

type qualificationSuggestionRecue struct {
	id        string
	phoneE164 string
	resolu    *string
}

type qualificationAppelRep struct {
	u          *socle.Utilisateur
	b          *QualificationRepAttemptBody
	comment    *string
	rep        *db.RepresentantAQualifierRow
	whatsapp   qualificationPatchWhatsapp
	numero     *string
	statut     *db.StatutQualificationParIdRow
	relation   *string
	suggestion *qualificationSuggestionRecue
}

func (s *service) qualificationStatutCoherent(ctx context.Context, b *QualificationRepAttemptBody, comment *string) (db.StatutQualificationParIdRow, error) {
	statut, err := s.Q.StatutQualificationParId(ctx, *b.StatutQualificationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return statut, socle.Problem(http.StatusBadRequest, "REP_STATUT_QUALIFICATION_UNKNOWN",
			"Ce statut de qualification n’existe pas.")
	}
	if err != nil {
		return statut, err
	}
	if !statut.IsActive {
		return statut, socle.Problem(http.StatusBadRequest, "REP_STATUT_QUALIFICATION_INACTIVE",
			"Le statut « "+statut.Label+" » a été retiré : choisissez-en un autre.")
	}
	attendue := qualificationOutcomeParEffet[statut.Effect]
	if b.Outcome != attendue {
		return statut, socle.Problem(http.StatusBadRequest, "REP_OUTCOME_STATUT_MISMATCH",
			"Le statut choisi impose l’issue « "+attendue+" », or « "+b.Outcome+" » a été envoyée.")
	}
	if qualificationContreditRattachement(b.RelationStatus, statut.RelationStatus) {
		return statut, socle.Problem(http.StatusBadRequest, "REP_RELATION_STATUT_MISMATCH",
			"Le statut « "+statut.Label+" » contredit la réponse au rattachement comme représentant.")
	}
	if statut.RequiresComment && comment == nil {
		return statut, socle.Problem(http.StatusBadRequest, "REP_STATUT_MOTIF_REQUIRED",
			"Le statut « "+statut.Label+" » exige un motif : sans lui, la case ne dit rien.")
	}
	return statut, nil
}

func (s *service) qualificationSuggestionDuRefus(ctx context.Context, brut, region string) (qualificationSuggestionRecue, error) {
	recue := qualificationSuggestionRecue{}
	e164, err := database.NormaliserTelephone(brut, region)
	if err != nil {
		return recue, err
	}
	recue.phoneE164 = e164
	id, err := s.Q.RepresentantParNumeroExact(ctx, e164)
	if err == nil {
		recue.resolu = &id
		return recue, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return recue, nil
	}
	return recue, err
}

// « Pas à vous » ne se confond pas avec « n'existe pas ».
func (s *service) qualificationRepAbsent(ctx context.Context, id string) error {
	ailleurs, err := s.Q.RepresentantExisteAilleurs(ctx, id)
	if err != nil {
		return err
	}
	if ailleurs {
		return socle.Problem(http.StatusForbidden, "REP_CAMPAIGN_NOT_ASSIGNED", "Ce représentant n’est pas dans vos campagnes.")
	}
	return socle.Problem(http.StatusNotFound, "REPRESENTANT_NOT_FOUND", "Représentant introuvable.")
}

func (s *service) qualificationPreparerAppelRep(ctx context.Context, u *socle.Utilisateur, b *QualificationRepAttemptBody, appel *qualificationAppelRep) error {
	var err error
	if appel.whatsapp, err = qualificationWhatsappRepresentant(b, appel.rep, s.Cfg.PhoneRegion); err != nil {
		return err
	}
	numero, err := qualificationNumeroCorrige(b, appel.rep, s.Cfg.PhoneRegion)
	if err != nil {
		return err
	}
	if numero != "" {
		appel.numero = &numero
	}
	if b.StatutQualificationID != nil {
		statut, erreur := s.qualificationStatutCoherent(ctx, b, appel.comment)
		if erreur != nil {
			return erreur
		}
		appel.statut = &statut
	}
	if b.SuggestedPhone != nil {
		recue, erreur := s.qualificationSuggestionDuRefus(ctx, *b.SuggestedPhone, s.Cfg.PhoneRegion)
		if erreur != nil {
			return erreur
		}
		appel.suggestion = &recue
	}
	appel.u, appel.b = u, b
	appel.relation = qualificationRelationAPoser(b, appel.statut, string(appel.rep.RelationStatus))
	return nil
}

func (s *service) qualificationRepAppel(ctx context.Context, in *QualificationRepAttemptInput) (*QualificationRepAttemptOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	b := &in.Body
	comment := qualificationRogne(b.Comment)
	if err := qualificationReglesRepIssue(b); err != nil {
		return nil, err
	}
	deja, err := s.Q.RepAttemptExiste(ctx, b.ID)
	if err != nil {
		return nil, err
	}
	if deja {
		return qualificationRepResultat("duplicate", b.ID), nil
	}
	rep, err := s.Q.RepresentantAQualifier(ctx, db.RepresentantAQualifierParams{
		ID: b.RepresentantID, Tous: qualificationVoitTout(u.Role), Agent: u.ID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, s.qualificationRepAbsent(ctx, b.RepresentantID)
	}
	if err != nil {
		return nil, err
	}
	appel := qualificationAppelRep{comment: comment, rep: &rep}
	if err := s.qualificationPreparerAppelRep(ctx, &u, b, &appel); err != nil {
		return nil, err
	}
	applique := false
	err = qualificationTx(ctx, s, func(q *db.Queries) error {
		var e error
		applique, e = s.qualificationAppliquerRepAppel(ctx, q, &appel)
		return e
	})
	if err != nil {
		return nil, err
	}
	if !applique {
		return qualificationRepResultat("duplicate", b.ID), nil
	}
	out := qualificationRepResultat(tentativeAppliquee, b.ID)
	if err := s.qualificationJoindreSuggestion(ctx, &appel, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Le code court du représentant source et le nom du téléconseiller ne sont
// assemblés que par la requête de liste : la piste écrite est relue par son id.
func (s *service) qualificationJoindreSuggestion(ctx context.Context, a *qualificationAppelRep, out *QualificationRepAttemptOutput) error {
	if a.suggestion == nil {
		return nil
	}
	rows, err := s.Q.ListerSuggestions(ctx, db.ListerSuggestionsParams{
		Tous: true, Agent: a.u.ID, ID: &a.suggestion.id, Lim: 1,
	})
	if err != nil || len(rows) == 0 {
		return err
	}
	dto := qualificationSuggestionDTO(&rows[0])
	out.Body.Suggestion = &dto
	return nil
}

func (s *service) qualificationAppliquerRepAppel(ctx context.Context, q *db.Queries, a *qualificationAppelRep) (bool, error) {
	n, err := q.InsererRepAttempt(ctx, db.InsererRepAttemptParams{
		ID: a.b.ID, RepresentantID: a.b.RepresentantID, PerformedByID: a.u.ID,
		Outcome: a.b.Outcome, PromisedProspects: a.b.PromisedProspects, Comment: a.comment,
		CallbackAt: a.b.CallbackAt, EtablissementConfirme: a.b.EtablissementConfirme,
		NumeroConfirme: a.b.NumeroConfirme, Contacte: a.b.Contacte, ConnaitUes: a.b.ConnaitUES,
		Syndicat: qualificationRogne(a.b.Syndicat), StatutQualificationID: a.b.StatutQualificationID,
		ClientCreatedAt: a.b.ClientCreatedAt.UTC(),
	})
	if err != nil || n == 0 {
		return false, err
	}
	if err := s.qualificationEcrireSuggestion(ctx, q, a); err != nil {
		return false, err
	}
	if err := s.qualificationNumeroDisponible(ctx, q, a); err != nil {
		return false, err
	}
	if err := s.qualificationMajRepresentant(ctx, q, a); err != nil {
		return false, err
	}
	if err := s.qualificationFermerOuverture(ctx, q, a); err != nil {
		return false, err
	}
	return true, s.qualificationBasculerRelation(ctx, q, a)
}

func (*service) qualificationEcrireSuggestion(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	if a.suggestion == nil {
		return nil
	}
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	a.suggestion.id = id.String()
	return q.InsererSuggestion(ctx, db.InsererSuggestionParams{
		ID: id.String(), SourceRepresentantID: a.b.RepresentantID,
		SuggestedName: qualificationRogne(a.b.SuggestedName), SuggestedPhoneE164: a.suggestion.phoneE164,
		Note: qualificationRogne(a.b.SuggestedNote), SuggestedByID: a.u.ID,
		ResolvedRepresentantID: a.suggestion.resolu, SourceAttemptID: a.b.ID,
		ClientCreatedAt: a.b.ClientCreatedAt.UTC(),
	})
}

// Même garde d'unicité que le module representants : lecture explicite sur
// l'index partiel, jamais une contrainte SQL brute laissée lever.
func (*service) qualificationNumeroDisponible(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	if a.numero == nil {
		return nil
	}
	nom, err := q.ProprietaireDuNumeroRepresentant(ctx, db.ProprietaireDuNumeroRepresentantParams{
		Phone: *a.numero, ID: a.b.RepresentantID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return socle.Problem(http.StatusConflict, "REPRESENTANT_PHONE_CONFLICT",
		"Ce numéro est déjà celui d’un représentant enregistré par "+nom+".")
}

var qualificationChampsFiche = []string{
	representants.RepresentantChampNom, socle.ProspectChampPrenom, representants.RepresentantChampTel, socle.ProspectChampEtablissement, representants.RepresentantChampNotes, representants.RepresentantChampDep,
	representants.RepresentantChampIef, socle.ProspectChampWhatsappStatut, socle.ProspectChampWhatsappNumero, socle.ProspectChampProfession, representants.RepresentantChampSyndicat, representants.RepresentantChampConnaitUES, representants.RepresentantChampContacte,
}

func qualificationFiche(valeurs ...any) map[string]any {
	fiche := make(map[string]any, len(qualificationChampsFiche))
	for i, nom := range qualificationChampsFiche {
		fiche[nom] = valeurs[i]
	}
	return fiche
}

func qualificationPatchRepresentant(a *qualificationAppelRep) db.MajRepresentantApresAppelParams {
	p := db.MajRepresentantApresAppelParams{ID: a.b.RepresentantID}
	p.WhatsappStatus = a.whatsapp.statut
	p.MajWhatsappE164, p.WhatsappE164 = a.whatsapp.majNumero, a.whatsapp.numero
	p.MajProfession, p.Profession = a.whatsapp.majProfession, a.whatsapp.profession
	if a.b.Syndicat != nil {
		p.MajSyndicat, p.Syndicat = true, qualificationRogne(a.b.Syndicat)
	}
	if a.b.EtablissementConfirme != nil && !*a.b.EtablissementConfirme && a.b.Etablissement != nil {
		p.MajEtablissement, p.Etablissement = true, qualificationRogne(a.b.Etablissement)
	}
	p.ConnaitUes, p.Contacte = a.b.ConnaitUES, a.b.Contacte
	p.StatutQualificationID = a.b.StatutQualificationID
	p.PhoneE164 = a.numero
	// Une tentative plus ancienne que le dernier appel connu ne réécrit pas la fiche.
	p.MajDernierAppel = a.rep.LastCallAt == nil || !a.b.ClientCreatedAt.Before(*a.rep.LastCallAt)
	if !p.MajDernierAppel {
		return p
	}
	at := a.b.ClientCreatedAt.UTC()
	outcome := a.b.Outcome
	p.LastCallOutcome, p.LastCallAt, p.LastCallByID = &outcome, &at, &a.u.ID
	p.NextCallbackAt, p.NextCallbackOrigine = qualificationProchainRappel(a.b.CallbackAt, at, a.statut)
	return p
}

func qualificationPatchVide(p *db.MajRepresentantApresAppelParams) bool {
	return p.WhatsappStatus == nil && !p.MajWhatsappE164 && !p.MajProfession && !p.MajSyndicat &&
		!p.MajEtablissement && p.ConnaitUes == nil && p.Contacte == nil &&
		p.StatutQualificationID == nil && p.PhoneE164 == nil && !p.MajDernierAppel
}

func qualificationFicheAvant(r *db.RepresentantAQualifierRow) map[string]any {
	return qualificationFiche(r.FullName, qualificationValeur(r.Prenom), r.PhoneE164,
		qualificationValeur(r.Etablissement), qualificationValeur(r.Notes), r.DepartementId,
		qualificationValeur(r.IefId), string(r.WhatsappStatus), qualificationValeur(r.WhatsappE164),
		qualificationValeur(r.Profession), qualificationValeur(r.Syndicat),
		qualificationValeur(r.ConnaitUES), qualificationValeur(r.Contacte))
}

func qualificationFicheApres(r *db.MajRepresentantApresAppelRow) map[string]any {
	return qualificationFiche(r.FullName, qualificationValeur(r.Prenom), r.PhoneE164,
		qualificationValeur(r.Etablissement), qualificationValeur(r.Notes), r.DepartementId,
		qualificationValeur(r.IefId), string(r.WhatsappStatus), qualificationValeur(r.WhatsappE164),
		qualificationValeur(r.Profession), qualificationValeur(r.Syndicat),
		qualificationValeur(r.ConnaitUES), qualificationValeur(r.Contacte))
}

func (*service) qualificationMajRepresentant(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	p := qualificationPatchRepresentant(a)
	if qualificationPatchVide(&p) {
		return nil
	}
	row, err := q.MajRepresentantApresAppel(ctx, p)
	if err != nil {
		return err
	}
	avant, apres := qualificationFicheAvant(a.rep), qualificationFicheApres(&row)
	deA, deP := map[string]any{}, map[string]any{}
	for _, nom := range qualificationChampsFiche {
		if avant[nom] == apres[nom] {
			continue
		}
		deA[nom], deP[nom] = avant[nom], apres[nom]
	}
	if len(deP) == 0 {
		return nil
	}
	return database.Auditer(ctx, q, a.u.ID, "representant.fiche.APPEL", "representant", a.b.RepresentantID, deA, deP)
}

// La qualification lève le verrou dans SA transaction : une ouverture inconnue,
// déjà fermée ou ouverte par un autre ne fait rien et ne la fait pas échouer.
func (*service) qualificationFermerOuverture(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	if a.b.OuvertureID == nil {
		return nil
	}
	at := a.b.ClientCreatedAt.UTC()
	return q.FermerOuverture(ctx, db.FermerOuvertureParams{
		At: &at, AttemptID: &a.b.ID, ID: *a.b.OuvertureID, OpenedByID: a.u.ID,
	})
}

func (*service) qualificationBasculerRelation(ctx context.Context, q *db.Queries, a *qualificationAppelRep) error {
	depuis := string(a.rep.RelationStatus)
	if a.relation == nil || *a.relation == depuis {
		return nil
	}
	if !qualificationTransitionLegale(qualificationTransitionsRelation, depuis, *a.relation) {
		return socle.Problem(http.StatusForbidden, "REPRESENTANT_RELATION_TRANSITION_REFUSED",
			"Relation du représentant : le passage de « "+depuis+" » à « "+*a.relation+" » n’est pas permis.")
	}
	n, err := q.BasculerRelation(ctx, db.BasculerRelationParams{Vers: *a.relation, ID: a.b.RepresentantID, Depuis: depuis})
	if err != nil || n != 1 {
		return err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return q.InsererRelationChange(ctx, db.InsererRelationChangeParams{
		ID: id.String(), RepresentantID: a.b.RepresentantID, Depuis: depuis,
		Vers: *a.relation, ChangedByID: a.u.ID,
	})
}

const qualificationToleranceHorloge = 5 * time.Minute

var qualificationCourriel = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`)

type qualificationRegleIssue struct {
	clot              bool
	phase2Status      string
	exigeMethode      bool
	accepteCallbackAt bool
}

var qualificationReglesEffet = map[db.CallOutcomeEffect]qualificationRegleIssue{
	db.CallOutcomeEffectCLOSEMETHOD:      {clot: true, phase2Status: exports.ExportCleMethodeObtenue, exigeMethode: true},
	db.CallOutcomeEffectCLOSEREFUSED:     {clot: true, phase2Status: qualificationRefusee},
	db.CallOutcomeEffectCLOSEWRONGNUMBER: {clot: true, phase2Status: qualificationFauxNumero},
	db.CallOutcomeEffectKEEPOPEN:         {},
	db.CallOutcomeEffectSCHEDULECALLBACK: {accepteCallbackAt: true},
}

type qualificationMotifIssue struct {
	id               *string
	label            string
	effet            db.CallOutcomeEffect
	exigeCommentaire bool
	exigeRappel      bool
}

// Les six motifs compilés portent les codes de `CallOutcome` à l'identique.
// CALLBACK n'exige pas de date : seul un motif du référentiel peut le durcir.
var qualificationMotifsSysteme = map[string]qualificationMotifIssue{
	exports.ExportCleMethodeObtenue:   {label: exports.ExportLibelleMethodeObtenue, effet: db.CallOutcomeEffectCLOSEMETHOD},
	qualificationCallback:             {label: exports.ExportLibelleARappeler, effet: db.CallOutcomeEffectSCHEDULECALLBACK},
	string(db.CallOutcomeUNREACHABLE): {label: exports.ExportLibelleInjoignable, effet: db.CallOutcomeEffectKEEPOPEN},
	qualificationRefusee:              {label: exports.ExportLibelleRefus, effet: db.CallOutcomeEffectCLOSEREFUSED},
	qualificationFauxNumero:           {label: exports.ExportLibelleFauxNumero, effet: db.CallOutcomeEffectCLOSEWRONGNUMBER},
	string(db.CallOutcomeOTHER):       {label: exports.ExportLibelleAutre, effet: db.CallOutcomeEffectKEEPOPEN},
}

type QualificationCallAttemptBody struct {
	// L'identifiant vient du corps sur la route directe, de `entityId` sur
	// /sync/push : il est donc contrôlé par la logique, pas par le schéma.
	ID                     string            `json:"id,omitempty" format:"uuid"`
	ProspectID             string            `json:"prospectId" format:"uuid"`
	Outcome                string            `json:"outcome" enum:"METHOD_OBTAINED,UNREACHABLE,CALLBACK,REFUSED,WRONG_NUMBER,OTHER"`
	ClientCreatedAt        time.Time         `json:"clientCreatedAt" format:"date-time"`
	ReasonCode             *string           `json:"reasonCode,omitempty" maxLength:"40"`
	Method                 *string           `json:"method,omitempty" enum:"PLATFORM,PHYSICAL,VOICE_OR_ELECTRONIC_MESSAGING,APPOINTMENT,WHATSAPP,RDV_CPI,PLATEFORME_EN_LIGNE,MAIL"`
	Comment                *string           `json:"comment,omitempty" maxLength:"2000"`
	CallbackAt             *time.Time        `json:"callbackAt,omitempty" format:"date-time"`
	ExpectedRev            *int32            `json:"expectedRev,omitempty" minimum:"1"`
	OuvertureID            *string           `json:"ouvertureId,omitempty" format:"uuid"`
	Email                  *string           `json:"email,omitempty" maxLength:"160"`
	Fonctionnaire          *bool             `json:"fonctionnaire,omitempty"`
	EngagementEnCours      *bool             `json:"engagementEnCours,omitempty"`
	DureeEtablissementMois *int32            `json:"dureeEtablissementMois,omitempty" minimum:"0" maximum:"600"`
	RendezVousAt           *time.Time        `json:"rendezVousAt,omitempty" format:"date-time"`
	Nom                    *string           `json:"nom,omitempty" minLength:"1" maxLength:"120"`
	Prenom                 *string           `json:"prenom,omitempty" maxLength:"120"`
	Profession             *string           `json:"profession,omitempty" maxLength:"120"`
	WhatsappStatus         *string           `json:"whatsappStatus,omitempty" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	WhatsappE164           *string           `json:"whatsappE164,omitempty" minLength:"6" maxLength:"40"`
	BanqueID               *string           `json:"banqueId,omitempty" format:"uuid"`
	SyndicatID             *string           `json:"syndicatId,omitempty" format:"uuid"`
	Type                   *string           `json:"type,omitempty" enum:"FONCTIONNAIRE,SECTEUR_PRIVE,INFORMEL,DIASPORA"`
	IncomeBandID           *string           `json:"incomeBandId,omitempty" format:"uuid"`
	PaymentMode            *string           `json:"paymentMode,omitempty" enum:"COMPTANT,ECHELONNE,CREDIT_IMMOBILIER"`
	DureeSystemeMois       *int32            `json:"dureeSystemeMois,omitempty" minimum:"1" maximum:"300"`
	ChampsLibres           map[string]string `json:"champsLibres,omitempty"`
}

type QualificationCallAttemptInput struct{ Body QualificationCallAttemptBody }

type QualificationProspectPhase2StateDTO struct {
	ProspectID       string  `json:"prospectId" format:"uuid"`
	Phase2Status     string  `json:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER"`
	EnrollmentMethod *string `json:"enrollmentMethod"`
	Rev              int32   `json:"rev"`
	UpdatedAt        string  `json:"updatedAt" format:"date-time"`
	CapturedByID     *string `json:"capturedById"`
	CapturedAt       *string `json:"capturedAt"`
}

type QualificationCallAttemptOutput struct {
	Body struct {
		Status    string                              `json:"status" enum:"applied,duplicate"`
		AttemptID string                              `json:"attemptId" format:"uuid"`
		State     QualificationProspectPhase2StateDTO `json:"state"`
	}
}

type qualificationTentative struct {
	motif        qualificationMotifIssue
	regle        qualificationRegleIssue
	comment      *string
	callbackAt   *time.Time
	email        *string
	rendezVousAt *time.Time
}

func (s *service) qualificationMotifDeLIssue(ctx context.Context, b *QualificationCallAttemptBody) (qualificationMotifIssue, error) {
	systeme := qualificationMotifsSysteme[b.Outcome]
	code := strings.ToUpper(strings.TrimSpace(qualificationTexte(b.ReasonCode)))
	demande := code != ""
	if !demande {
		code = b.Outcome
	}
	row, err := s.Q.MotifIssueParCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		if !demande {
			return systeme, nil
		}
		return systeme, socle.Problem(http.StatusBadRequest, "PHASE2_REASON_UNKNOWN", "Motif d’issue inconnu : "+code+".")
	}
	if err != nil {
		return systeme, err
	}
	if demande && !row.IsActive {
		return systeme, socle.Problem(http.StatusBadRequest, "PHASE2_REASON_INACTIVE",
			"Le motif « "+row.Label+" » a été retiré du référentiel.")
	}
	if demande && row.Effect != systeme.effet {
		return systeme, socle.Problem(http.StatusBadRequest, "PHASE2_REASON_OUTCOME_MISMATCH",
			"Le motif « "+row.Label+" » ne produit pas l’issue "+b.Outcome+".")
	}
	return qualificationMotifIssue{
		id: &row.ID, label: row.Label, effet: row.Effect,
		exigeCommentaire: row.RequiresComment, exigeRappel: row.RequiresCallback,
	}, nil
}

func qualificationNormaliserTentative(b *QualificationCallAttemptBody, motif *qualificationMotifIssue) (qualificationTentative, error) {
	t := qualificationTentative{
		motif: *motif, regle: qualificationReglesEffet[motif.effet], comment: qualificationRogne(b.Comment),
	}
	if t.regle.exigeMethode && b.Method == nil {
		return t, socle.Problem(http.StatusBadRequest, "PHASE2_METHOD_REQUIRED",
			"Une méthode d’enrôlement est obligatoire quand la méthode a été obtenue.")
	}
	if !t.regle.exigeMethode && b.Method != nil {
		return t, socle.Problem(http.StatusBadRequest, "PHASE2_METHOD_NOT_ALLOWED",
			"Une méthode d’enrôlement n’est admise que pour une issue qui clôt sur la méthode obtenue.")
	}
	if motif.exigeCommentaire && t.comment == nil {
		return t, socle.Problem(http.StatusBadRequest, "PHASE2_COMMENT_REQUIRED",
			"L’issue « "+motif.label+" » exige un commentaire : sans lui, la case ne dit rien.")
	}
	rappel, err := qualificationRappelPromis(b, motif, &t.regle)
	if err != nil {
		return t, err
	}
	courriel, err := qualificationCourrielRecueilli(b)
	if err != nil {
		return t, err
	}
	rendezVous, err := qualificationRendezVousFixe(b)
	t.callbackAt, t.rendezVousAt = qualificationInstant(rappel), qualificationInstant(rendezVous)
	if courriel != "" {
		t.email = &courriel
	}
	return t, err
}

// Le futur se juge sur l'horodatage TERRAIN, jamais sur l'heure du serveur.
func qualificationRappelPromis(b *QualificationCallAttemptBody, motif *qualificationMotifIssue, regle *qualificationRegleIssue) (time.Time, error) {
	var absent time.Time
	if b.CallbackAt == nil {
		if motif.exigeRappel {
			return absent, socle.Problem(http.StatusBadRequest, "PHASE2_CALLBACK_AT_REQUIRED",
				"L’issue « "+motif.label+" » exige la date du rappel promis.")
		}
		return absent, nil
	}
	if !regle.accepteCallbackAt {
		return absent, socle.Problem(http.StatusBadRequest, "PHASE2_CALLBACK_AT_NOT_ALLOWED",
			"Une date de rappel n’est admise que pour une issue qui planifie un rappel.")
	}
	quand := b.CallbackAt.UTC()
	if quand.Before(b.ClientCreatedAt.Add(-qualificationToleranceHorloge)) {
		return absent, socle.Problem(http.StatusBadRequest, "PHASE2_CALLBACK_AT_PAST",
			"La date de rappel précède l’appel qui l’a promise.")
	}
	return quand, nil
}

func qualificationCourrielRecueilli(b *QualificationCallAttemptBody) (string, error) {
	brut := qualificationRogne(b.Email)
	if brut == nil {
		return "", nil
	}
	if !qualificationCourriel.MatchString(*brut) {
		return "", socle.Problem(http.StatusBadRequest, "PHASE2_EMAIL_INVALID",
			"L’adresse électronique saisie n’est pas une adresse.")
	}
	return *brut, nil
}

func qualificationRendezVousFixe(b *QualificationCallAttemptBody) (time.Time, error) {
	var absent time.Time
	pris := b.Method != nil && *b.Method == string(db.EnrollmentMethodAPPOINTMENT)
	if b.RendezVousAt == nil {
		if pris {
			return absent, socle.Problem(http.StatusBadRequest, "PHASE2_RENDEZ_VOUS_REQUIRED",
				"Le RDV CPI exige la date et l’heure du rendez-vous.")
		}
		return absent, nil
	}
	if !pris {
		return absent, socle.Problem(http.StatusBadRequest, "PHASE2_RENDEZ_VOUS_NOT_ALLOWED",
			"Une date de rendez-vous n’est admise que pour la méthode « RDV CPI ».")
	}
	quand := b.RendezVousAt.UTC()
	if quand.Before(b.ClientCreatedAt.Add(-qualificationToleranceHorloge)) {
		return absent, socle.Problem(http.StatusBadRequest, "PHASE2_RENDEZ_VOUS_PAST",
			"La date du rendez-vous précède l’appel qui l’a fixé.")
	}
	return quand, nil
}

func qualificationConversionChues(b *QualificationCallAttemptBody, projet db.Projet, revenu *string) error {
	if projet != db.ProjetCHUES || b.Method == nil {
		return nil
	}
	if *b.Method == "PHYSICAL" {
		return socle.Problem(http.StatusBadRequest, "PHASE2_METHOD_RETIREE",
			"La méthode « Physique » est remplacée par « RDV CPI », qui exige la date du rendez-vous.")
	}
	if revenu == nil {
		return socle.Problem(http.StatusBadRequest, "PHASE2_REVENU_REQUIRED",
			"La conversion CHUES exige la tranche de revenu mensuel du prospect.")
	}
	if b.DureeEtablissementMois == nil {
		return socle.Problem(http.StatusBadRequest, "PHASE2_DUREE_FONCTION_REQUIRED",
			"La conversion CHUES exige la durée dans la fonction, en mois.")
	}
	return nil
}

func qualificationEtatPhase2(id string, rev int32, updatedAt time.Time, j *db.ParcoursDuProspectRow) QualificationProspectPhase2StateDTO {
	etat := QualificationProspectPhase2StateDTO{
		ProspectID: id, Phase2Status: string(j.Phase2Status), Rev: rev,
		UpdatedAt: qualificationISO(updatedAt), CapturedByID: j.EnrollmentCapturedById,
		CapturedAt: qualificationISOPtr(j.EnrollmentCapturedAt),
	}
	if j.EnrollmentMethod != nil {
		methode := string(*j.EnrollmentMethod)
		etat.EnrollmentMethod = &methode
	}
	return etat
}

func (s *service) qualificationTentativeProspect(ctx context.Context, in *QualificationCallAttemptInput) (*QualificationCallAttemptOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	statut, etat, err := s.qualificationConsignerTentative(ctx, &u, &in.Body)
	if err != nil {
		return nil, err
	}
	out := &QualificationCallAttemptOutput{}
	out.Body.Status, out.Body.AttemptID, out.Body.State = statut, in.Body.ID, etat
	return out, nil
}

const tentativeAppliquee = "applied"

// Seul chemin d'écriture d'une tentative de phase 2 : la route directe et
// /sync/push y passent tous deux.
func (s *service) qualificationConsignerTentative(ctx context.Context, u *socle.Utilisateur, b *QualificationCallAttemptBody) (string, QualificationProspectPhase2StateDTO, error) {
	var vide QualificationProspectPhase2StateDTO
	if b.ID == "" {
		return "", vide, socle.Problem(http.StatusUnprocessableEntity, "VALIDATION_FAILED",
			"L’identifiant de la tentative est obligatoire.")
	}
	motif, err := s.qualificationMotifDeLIssue(ctx, b)
	if err != nil {
		return "", vide, err
	}
	tentative, err := qualificationNormaliserTentative(b, &motif)
	if err != nil {
		return "", vide, err
	}
	if err := s.qualificationProspectAttribue(ctx, u, b.ProspectID); err != nil {
		return "", vide, err
	}
	var statut string
	var etat QualificationProspectPhase2StateDTO
	err = qualificationTx(ctx, s, func(q *db.Queries) error {
		var e error
		statut, etat, e = s.qualificationAppliquerTentative(ctx, q, u, b, &tentative)
		return e
	})
	if err != nil {
		return "", vide, err
	}
	if statut == tentativeAppliquee && tentative.regle.phase2Status == exports.ExportCleMethodeObtenue {
		s.signalerEnrolement(ctx, u, b.ProspectID)
	}
	return statut, etat, nil
}

// Un téléconseiller n'appelle que ses campagnes ; l'encadrement n'est pas borné.
func (s *service) qualificationProspectAttribue(ctx context.Context, u *socle.Utilisateur, prospectID string) error {
	if qualificationVoitTout(u.Role) {
		return nil
	}
	mien, err := s.Q.ProspectAttribue(ctx, db.ProspectAttribueParams{ID: prospectID, Agent: u.ID})
	if err != nil {
		return err
	}
	if !mien {
		return socle.Problem(http.StatusForbidden, "PHASE2_NOT_ASSIGNED", "Ce prospect n’est pas dans vos campagnes.")
	}
	return nil
}

// Tout ce qui refuse la tentative avant la moindre écriture. Le rejeu n'est PAS
// revérifié : le verdict d'une tentative déjà admise se redemande sans que
// l'état du prospect puisse le retirer.
func qualificationPreVol(ctx context.Context, q *db.Queries, b *QualificationCallAttemptBody) (prospect db.ProspectPourTentativeRow, parcours db.ParcoursDuProspectRow, duplicate bool, err error) {
	if prospect, err = q.ProspectPourTentative(ctx, b.ProspectID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			err = socle.Problem(http.StatusNotFound, "PHASE2_PROSPECT_NOT_FOUND", "Prospect introuvable ou supprimé.")
		}
		return prospect, parcours, false, err
	}
	if parcours, err = qualificationOuvrirParcours(ctx, q, b.ProspectID, prospect.Projet); err != nil {
		return prospect, parcours, false, err
	}
	if duplicate, err = q.CallAttemptExiste(ctx, b.ID); err != nil || duplicate {
		return prospect, parcours, duplicate, err
	}
	if b.ExpectedRev != nil && *b.ExpectedRev != prospect.Rev {
		return prospect, parcours, false, socle.Problem(http.StatusConflict, "REV_CONFLICT",
			"Cette fiche a changé depuis votre dernière lecture. Rechargez-la avant de réessayer.")
	}
	revenu := b.IncomeBandID
	if revenu == nil {
		revenu = prospect.IncomeBandId
	}
	return prospect, parcours, false, qualificationConversionChues(b, prospect.Projet, revenu)
}

func (s *service) qualificationAppliquerTentative(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody, t *qualificationTentative) (string, QualificationProspectPhase2StateDTO, error) {
	var vide QualificationProspectPhase2StateDTO
	prospect, parcours, duplicate, err := qualificationPreVol(ctx, q, b)
	if err != nil {
		return "", vide, err
	}
	if duplicate {
		return "duplicate", qualificationEtatPhase2(prospect.ID, prospect.Rev, prospect.UpdatedAt, &parcours), nil
	}
	if err := qualificationInsererTentative(ctx, q, u, b, t); err != nil {
		return "", vide, err
	}
	if err := qualificationMarquerContacte(ctx, q, b.ProspectID, parcours.ID); err != nil {
		return "", vide, err
	}
	corrige, err := s.qualificationCorrigerProspect(ctx, q, u, b, &prospect)
	if err != nil {
		return "", vide, err
	}
	if err := qualificationPlanifierRappel(ctx, q, u, b, t); err != nil {
		return "", vide, err
	}
	if err := qualificationFermerOuvertureProspect(ctx, q, u, b); err != nil {
		return "", vide, err
	}
	if !t.regle.clot {
		return tentativeAppliquee, qualificationEtatPhase2(corrige.ID, corrige.Rev, corrige.UpdatedAt, &parcours), nil
	}
	return qualificationCloturerParcours(ctx, q, u, b, t, &corrige, &parcours)
}

// Le parcours est ouvert à la volée : une fiche importée sans parcours doit
// rester appelable.
func qualificationOuvrirParcours(ctx context.Context, q *db.Queries, prospectID string, projet db.Projet) (db.ParcoursDuProspectRow, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return db.ParcoursDuProspectRow{}, err
	}
	row, err := q.OuvrirParcours(ctx, db.OuvrirParcoursParams{
		ID: id.String(), ProspectID: prospectID, Projet: string(projet),
	})
	return db.ParcoursDuProspectRow(row), err
}

func qualificationInsererTentative(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody, t *qualificationTentative) error {
	n, err := q.InsererCallAttempt(ctx, db.InsererCallAttemptParams{
		ID: b.ID, ProspectID: b.ProspectID, PerformedByID: u.ID, Outcome: b.Outcome,
		ReasonID: t.motif.id, Method: b.Method, Comment: t.comment, Email: t.email,
		Fonctionnaire: b.Fonctionnaire, EngagementEnCours: b.EngagementEnCours,
		DureeEtablissementMois: b.DureeEtablissementMois, RendezVousAt: t.rendezVousAt,
		ClientCreatedAt: b.ClientCreatedAt.UTC(),
	})
	if err == nil && n == 0 {
		return socle.Problem(http.StatusConflict, "PHASE2_ATTEMPT_RACE", "Cette tentative vient d’être enregistrée. Réessayez.")
	}
	return err
}

// Un premier appel sort la fiche et son parcours de « Nouveau » : c'est
// l'appel qui fait progresser le statut, pas une saisie manuelle.
func qualificationMarquerContacte(ctx context.Context, q *db.Queries, prospectID, journeyID string) error {
	if err := q.MarquerProspectContacte(ctx, prospectID); err != nil {
		return err
	}
	return q.MarquerParcoursContacte(ctx, journeyID)
}

func qualificationFicheModifiee(p *db.CorrigerProspectParTentativeParams) bool {
	textes := []*string{
		p.Nom, p.Prenom, p.Profession, p.BanqueID, p.SyndicatID,
		p.Type, p.IncomeBandID, p.PaymentMode, p.WhatsappStatus,
	}
	if slices.ContainsFunc(textes, func(v *string) bool { return v != nil }) {
		return true
	}
	return p.DureeSystemeMois != nil || p.MajChampsLibres
}

// Un champ absent laisse la valeur en place : le formulaire omet ce qu'il n'a
// pas demandé, et lire ce silence comme un vidage effacerait des saisies.
func (s *service) qualificationCorrigerProspect(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody, courant *db.ProspectPourTentativeRow) (db.CorrigerProspectParTentativeRow, error) {
	p := db.CorrigerProspectParTentativeParams{
		ID: courant.ID, Nom: qualificationRogne(b.Nom), Prenom: qualificationRogne(b.Prenom),
		Profession: qualificationRogne(b.Profession), BanqueID: b.BanqueID, SyndicatID: b.SyndicatID,
		Type: b.Type, IncomeBandID: b.IncomeBandID, PaymentMode: b.PaymentMode,
		DureeSystemeMois: b.DureeSystemeMois,
	}
	var err error
	p.WhatsappStatus, p.MajWhatsappE164, p.WhatsappE164, err = qualificationWhatsappProspect(b, courant, s.Cfg.PhoneRegion)
	if err != nil {
		return db.CorrigerProspectParTentativeRow{}, err
	}
	if len(b.ChampsLibres) > 0 {
		brut, erreur := json.Marshal(b.ChampsLibres)
		if erreur != nil {
			return db.CorrigerProspectParTentativeRow{}, erreur
		}
		p.MajChampsLibres, p.ChampsLibres = true, brut
	}
	p.MajFiche = qualificationFicheModifiee(&p)
	p.MajDernierAppel = courant.LastCallAt == nil || !b.ClientCreatedAt.Before(*courant.LastCallAt)
	if p.MajDernierAppel {
		at := b.ClientCreatedAt.UTC()
		outcome := b.Outcome
		p.LastCallOutcome, p.LastCallAt, p.LastCallByID = &outcome, &at, &u.ID
	}
	return q.CorrigerProspectParTentative(ctx, p)
}

// EB-23 côté prospect : la contradiction ne lève pas. AUTRE_NUMERO sans numéro
// retombe sur AUCUN, ce que dit la réponse « non » quand aucun second numéro ne
// suit. Seul un numéro illisible refuse la tentative.
func qualificationWhatsappProspect(b *QualificationCallAttemptBody, courant *db.ProspectPourTentativeRow, region string) (statut *string, majNumero bool, numero *string, err error) {
	if b.WhatsappStatus == nil && b.WhatsappE164 == nil {
		return nil, false, nil, nil
	}
	var saisi *string
	if b.WhatsappE164 != nil {
		e164, erreur := database.NormaliserTelephone(*b.WhatsappE164, region)
		if erreur != nil {
			return nil, false, nil, erreur
		}
		saisi = &e164
	}
	pose := qualificationDeduireWhatsapp(b.WhatsappStatus, saisi, courant.PhoneE164)
	if pose != qualificationAutreNumero {
		return &pose, true, nil, nil
	}
	if saisi == nil {
		saisi = courant.WhatsappE164
	}
	if saisi == nil {
		aucun := string(db.WhatsappStatusAUCUN)
		return &aucun, true, nil, nil
	}
	return &pose, true, saisi, nil
}

func qualificationDeduireWhatsapp(statut, numero, phoneE164 *string) string {
	if statut != nil {
		return *statut
	}
	if numero == nil {
		return "NON_DEMANDE"
	}
	if phoneE164 != nil && *numero == *phoneE164 {
		return "MEME_NUMERO"
	}
	return qualificationAutreNumero
}

func qualificationPlanifierRappel(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody, t *qualificationTentative) error {
	if t.callbackAt == nil {
		return nil
	}
	if err := q.SupplanterRappels(ctx, b.ProspectID); err != nil {
		return err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	return q.InsererRappel(ctx, db.InsererRappelParams{
		ID: id.String(), ProspectID: b.ProspectID, AssignedToID: u.ID,
		ScheduledAt: *t.callbackAt, Comment: t.comment, SourceAttemptID: b.ID,
	})
}

func qualificationFermerOuvertureProspect(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody) error {
	if b.OuvertureID == nil {
		return nil
	}
	at := b.ClientCreatedAt.UTC()
	return q.FermerOuverture(ctx, db.FermerOuvertureParams{
		At: &at, AttemptID: &b.ID, ID: *b.OuvertureID, OpenedByID: u.ID,
	})
}

// Une fiche déjà classée se reclasse : la dernière issue l'emporte.
func qualificationCloturerParcours(ctx context.Context, q *db.Queries, u *socle.Utilisateur, b *QualificationCallAttemptBody, t *qualificationTentative, prospect *db.CorrigerProspectParTentativeRow, parcours *db.ParcoursDuProspectRow) (string, QualificationProspectPhase2StateDTO, error) {
	var vide QualificationProspectPhase2StateDTO
	at := time.Now().UTC()
	if err := q.CloreParcours(ctx, db.CloreParcoursParams{
		Phase2Status: t.regle.phase2Status, Method: b.Method, At: &at, By: &u.ID, ID: parcours.ID,
	}); err != nil {
		return "", vide, err
	}
	if err := q.CloreProspectParTentative(ctx, db.CloreProspectParTentativeParams{
		Phase2Status: t.regle.phase2Status, Method: b.Method, At: &at, By: &u.ID, ID: prospect.ID,
	}); err != nil {
		return "", vide, err
	}
	if err := q.CloreRappels(ctx, db.CloreRappelsParams{AttemptID: &b.ID, ProspectID: b.ProspectID}); err != nil {
		return "", vide, err
	}
	final, err := q.ProspectPourTentative(ctx, b.ProspectID)
	if err != nil {
		return "", vide, err
	}
	relu, err := q.ParcoursDuProspect(ctx, db.ParcoursDuProspectParams{ProspectID: b.ProspectID, Projet: string(final.Projet)})
	if err != nil {
		return "", vide, err
	}
	return tentativeAppliquee, qualificationEtatPhase2(final.ID, final.Rev, final.UpdatedAt, &relu), nil
}
