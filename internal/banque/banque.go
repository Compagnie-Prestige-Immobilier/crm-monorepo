package banque

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/database"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

const (
	banqueEtapeOuverte   = "OPEN"
	banqueEtapeEncaissee = "CASHED"
	banqueEtapeRejetee   = "REJECTED"

	banqueCleEtapeCourante = "currentStageId"

	banqueRouteDemandes = "/demandes-clients"
	banqueRouteDossiers = "/dossiers"

	BanqueMotifAutre     = "AUTRE"
	banquePositionMax    = 99
	banqueVerrouPosition = 4271001

	codeDossierIntrouvable       = "BANK_CASE_NOT_FOUND"
	banqueCodeEtapeIntrouvable   = "BANK_STAGE_NOT_FOUND"
	banqueCodeEtapeInactive      = "BANK_STAGE_INACTIVE"
	banqueCodeEtapeNonSuivante   = "BANK_STAGE_NOT_NEXT"
	banqueCodeMontantRequis      = "BANK_CASE_AMOUNT_REQUIRED"
	banqueCodeReferenceConflit   = "BANK_CASE_REFERENCE_CONFLICT"
	banqueCodeRevConflit         = "BANK_CASE_REV_CONFLICT"
	banqueCodeConflitCodeEtape   = "BANK_STAGE_CODE_CONFLICT"
	codeBanqueIntrouvable        = "BANK_CASE_BANK_NOT_FOUND"
	banqueCodeDemandeIntrouvable = "CLIENT_REQUEST_NOT_FOUND"
	banqueCodeDemandeArbitree    = "CLIENT_REQUEST_ALREADY_REVIEWED"
	banqueCodeDemandeProspect    = "CLIENT_REQUEST_PROSPECT_EXISTS"
	banqueCodeDemandeAttente     = "CLIENT_REQUEST_ALREADY_PENDING"
	codeDemandeBanque            = "CLIENT_REQUEST_BANQUE_NOT_FOUND"

	banqueCleEtape     = "stageId"
	banqueCleMontant   = "amountXof"
	banqueCleStatut    = "status"
	banqueCleReference = "reference"
	banqueCleCode      = "code"
	banqueCleLabel     = "label"
	banqueCleCouleur   = "color"
	banqueCleActif     = "isActive"

	banqueFamilleEtapes = "bank-case-stages"
	banqueCleBanque     = "processingBankId"

	banqueMessageDemandeIntrouvable = "Demande de création introuvable."
	messageDossierIntrouvable       = "Dossier bancaire introuvable."
	banqueMessageDemandeArbitree    = "Cette demande a déjà été arbitrée."
)

type EtapeBanque struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Label     string `json:"label"`
	Position  int32  `json:"position"`
	Color     string `json:"color"`
	Type      string `json:"type" enum:"OPEN,CASHED,REJECTED"`
	IsActive  bool   `json:"isActive"`
	IsInitial bool   `json:"isInitial"`
	IsSystem  bool   `json:"isSystem"`
}

type MotifBanque struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Label     string `json:"label"`
	SortOrder int32  `json:"sortOrder"`
	IsActive  bool   `json:"isActive"`
}

type DossierBanque struct {
	ID                 string       `json:"id"`
	Reference          string       `json:"reference"`
	ReferenceKey       string       `json:"referenceKey"`
	ProspectID         string       `json:"prospectId"`
	CustomerName       string       `json:"customerName"`
	CustomerPhoneE164  string       `json:"customerPhoneE164"`
	ProcessingBankID   string       `json:"processingBankId"`
	ProcessingBankName string       `json:"processingBankName"`
	CurrentStage       EtapeBanque  `json:"currentStage"`
	AmountXof          *string      `json:"amountXof"`
	RejectionReason    *MotifBanque `json:"rejectionReason"`
	RejectionDetail    *string      `json:"rejectionDetail"`
	Rev                int32        `json:"rev"`
	IsTerminal         bool         `json:"isTerminal"`
	CreatedByID        string       `json:"createdById"`
	CreatedByName      string       `json:"createdByName"`
	UpdatedByID        *string      `json:"updatedById"`
	UpdatedByName      *string      `json:"updatedByName"`
	CreatedAt          time.Time    `json:"createdAt"`
	UpdatedAt          time.Time    `json:"updatedAt"`
	InscriptionID      *string      `json:"inscriptionId"`
	SuiviParID         *string      `json:"suiviParId"`
	SuiviParName       *string      `json:"suiviParName"`
}

type TransitionBanque struct {
	ID               string       `json:"id"`
	CaseID           string       `json:"caseId"`
	FromStage        *EtapeBanque `json:"fromStage"`
	ToStage          EtapeBanque  `json:"toStage"`
	PerformedByID    string       `json:"performedById"`
	PerformedByName  string       `json:"performedByName"`
	AmountXof        *string      `json:"amountXof"`
	RejectionReason  *MotifBanque `json:"rejectionReason"`
	RejectionDetail  *string      `json:"rejectionDetail"`
	Comment          *string      `json:"comment"`
	CorrectionReason *string      `json:"correctionReason"`
	CreatedAt        time.Time    `json:"createdAt"`
}

type DemandeClientBanque struct {
	ID                string     `json:"id"`
	Nom               string     `json:"nom"`
	Prenom            string     `json:"prenom"`
	PhoneE164         string     `json:"phoneE164"`
	Note              *string    `json:"note"`
	BanqueID          string     `json:"banqueId"`
	BanqueName        string     `json:"banqueName"`
	RequestedByID     string     `json:"requestedById"`
	RequestedByName   string     `json:"requestedByName"`
	Status            string     `json:"status" enum:"PENDING,APPROVED,REJECTED"`
	ReviewedByID      *string    `json:"reviewedById"`
	ReviewedByName    *string    `json:"reviewedByName"`
	ReviewedAt        *time.Time `json:"reviewedAt"`
	RejectionNote     *string    `json:"rejectionNote"`
	CreatedProspectID *string    `json:"createdProspectId"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type MetaBanque struct {
	Total     int32 `json:"total"`
	Page      int32 `json:"page"`
	PageSize  int32 `json:"pageSize"`
	PageCount int32 `json:"pageCount"`
}

func metaBanque(total, page, taille int32) MetaBanque {
	pages := (total + taille - 1) / taille
	if pages < 1 {
		pages = 1
	}
	return MetaBanque{Total: total, Page: page, PageSize: taille, PageCount: pages}
}

// La charge utile v1 (`existing`, `currentRev`, `stageId`…) voyage dans
// `errors[0].value` : le panneau la lit là, la RFC 9457 n'a pas d'autre place.
func problemBanque(status int, code, message string, charge any) *socle.ProblemError {
	p := socle.Problem(status, code, message)
	if charge != nil {
		p.Errors = []*huma.ErrorDetail{{Message: message, Value: charge}}
	}
	return p
}

var (
	banqueEspaces     = regexp.MustCompile(`\s+`)
	banqueNonChiffres = regexp.MustCompile(`\D`)
	dateSeuleBanque   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

func banqueReferenceAffichee(valeur string) string {
	return banqueEspaces.ReplaceAllString(strings.TrimSpace(valeur), " ")
}

func banqueReferenceCle(valeur string) string {
	return strings.ToUpper(banqueReferenceAffichee(valeur))
}

func banqueTexteNettoye(valeur *string) *string {
	if valeur == nil {
		return nil
	}
	net := strings.TrimSpace(*valeur)
	if net == "" {
		return nil
	}
	return &net
}

// XOF n'a pas de décimales : le montant voyage en chaîne, un nombre JSON
// perdrait la précision au-delà de 2^53.
func banqueMontantChaine(valeur pgtype.Numeric) *string {
	brut, err := valeur.Value()
	if err != nil || brut == nil {
		return nil
	}
	texte, ok := brut.(string)
	if !ok {
		return nil
	}
	texte, _, _ = strings.Cut(texte, ".")
	return &texte
}

func banqueMontantNumeric(valeur *string) (pgtype.Numeric, error) {
	var montant pgtype.Numeric
	if valeur == nil {
		return montant, nil
	}
	err := montant.Scan(*valeur)
	return montant, err
}

func banqueConflitUnicite(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func banqueEtapeDTO(row *db.BankCaseStage) EtapeBanque {
	return EtapeBanque{
		ID: row.ID, Code: row.Code, Label: row.Label, Position: row.Position, Color: row.Color,
		Type: string(row.Type), IsActive: row.IsActive, IsInitial: row.IsInitial, IsSystem: row.IsSystem,
	}
}

func banqueMotifDTO(row *db.BankRejectionReason) MotifBanque {
	return MotifBanque{ID: row.ID, Code: row.Code, Label: row.Label, SortOrder: row.SortOrder, IsActive: row.IsActive}
}

// Étapes et motifs tiennent en quelques dizaines de lignes : les charger une
// fois par requête évite de rejoindre deux tables sur chaque dossier lu.
type referentielBanque struct {
	etapes []EtapeBanque
	parID  map[string]EtapeBanque
	motifs map[string]MotifBanque
}

func (s *service) chargerReferentielBanque(ctx context.Context) (*referentielBanque, error) {
	etapes, err := s.Q.BankStages(ctx, true)
	if err != nil {
		return nil, err
	}
	motifs, err := s.Q.BankRejectionReasons(ctx, true)
	if err != nil {
		return nil, err
	}
	ref := &referentielBanque{
		etapes: make([]EtapeBanque, 0, len(etapes)),
		parID:  make(map[string]EtapeBanque, len(etapes)),
		motifs: make(map[string]MotifBanque, len(motifs)),
	}
	for i := range etapes {
		etape := banqueEtapeDTO(&etapes[i])
		ref.etapes = append(ref.etapes, etape)
		ref.parID[etape.ID] = etape
	}
	for i := range motifs {
		ref.motifs[motifs[i].ID] = banqueMotifDTO(&motifs[i])
	}
	return ref, nil
}

func (r *referentielBanque) motif(id *string) *MotifBanque {
	if id == nil {
		return nil
	}
	if trouve, ok := r.motifs[*id]; ok {
		return &trouve
	}
	return nil
}

type DossierInput struct {
	ID     string `path:"id" format:"uuid"`
	Projet string `query:"projet" enum:"CHUES,GRAND_PUBLIC"`
}

type DossierOutput struct {
	Body DossierBanque
}

type DetailDossierOutput struct {
	Body struct {
		BankCase DossierBanque      `json:"bankCase"`
		History  []TransitionBanque `json:"history"`
	}
}

func (s *service) detailDossier(ctx context.Context, id, projet string) (*DetailDossierOutput, error) {
	ref, err := s.chargerReferentielBanque(ctx)
	if err != nil {
		return nil, err
	}
	dossier, err := s.dossier(ctx, id, projet, ref)
	if err != nil {
		return nil, err
	}
	// Lecture GLOBALE de l'historique : le cloisonnement s'est joué sur le
	// dossier ci-dessus, le rejouer ici rendrait une fiche sans son historique.
	rows, err := s.Q.BankCaseHistory(ctx, id)
	if err != nil {
		return nil, err
	}
	out := &DetailDossierOutput{}
	out.Body.BankCase = dossier
	out.Body.History = make([]TransitionBanque, 0, len(rows))
	for i := range rows {
		out.Body.History = append(out.Body.History, banqueTransitionDTO(&rows[i], ref))
	}
	return out, nil
}

func banqueTransitionDTO(row *db.BankCaseHistoryRow, ref *referentielBanque) TransitionBanque {
	transition := TransitionBanque{
		ID: row.ID, CaseID: row.CaseId, ToStage: ref.parID[row.ToStageId],
		PerformedByID: row.PerformedById, PerformedByName: row.PerformedByName,
		AmountXof: banqueMontantChaine(row.AmountXof), RejectionReason: ref.motif(row.RejectionReasonId),
		RejectionDetail: row.RejectionDetail, Comment: row.Comment,
		CorrectionReason: row.CorrectionReason, CreatedAt: row.CreatedAt,
	}
	if row.FromStageId != nil {
		if depart, ok := ref.parID[*row.FromStageId]; ok {
			transition.FromStage = &depart
		}
	}
	return transition
}

func (s *service) lireDossierComplet(ctx context.Context, in *DossierInput) (*DetailDossierOutput, error) {
	return s.detailDossier(ctx, in.ID, in.Projet)
}

func (s *service) transactionBanque(ctx context.Context, geste func(*db.Queries) error) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error { return geste(s.Q.WithTx(tx)) })
}

// Pré-contrôle pour l'ergonomie, contrainte pour la vérité : deux créations
// simultanées le franchissent toutes les deux, d'où le rattrapage sur 23505.
func (s *service) banqueConflitReference(ctx context.Context, cle string) error {
	rival, err := s.Q.BankCaseByReference(ctx, cle)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return problemBanque(http.StatusConflict, banqueCodeReferenceConflit,
		"La référence « "+rival.Reference+" » est déjà portée par un autre dossier.",
		map[string]any{"existing": map[string]any{
			"id": rival.ID, banqueCleReference: rival.Reference, "referenceKey": rival.ReferenceKey,
			"customerName": rival.CustomerName, socle.ChampCreeLe: rival.CreatedAt,
		}})
}

// Rattrapage de la course sur `bank_cases_referenceKey_key` : entre la lecture
// et l'écriture, une autre requête a pu prendre la référence.
func (s *service) banqueReferenceDejaPrise(ctx context.Context, cle string) error {
	if conflit := s.banqueConflitReference(ctx, cle); conflit != nil {
		return conflit
	}
	return socle.Problem(http.StatusConflict, banqueCodeReferenceConflit, "Cette référence bancaire est déjà utilisée.")
}

func (s *service) banqueTraitement(ctx context.Context, heritee, choisie *string) (string, error) {
	banqueID := heritee
	if choisie != nil {
		banqueID = choisie
	}
	if banqueID == nil {
		return "", socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_BANK_REQUIRED",
			"Ce prospect n’a pas de banque renseignée : choisissez la banque de traitement du dossier.")
	}
	if _, err := s.Q.BankBanqueExists(ctx, *banqueID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", problemBanque(http.StatusUnprocessableEntity, codeBanqueIntrouvable,
				"Banque de traitement inconnue.", map[string]any{"banqueId": *banqueID})
		}
		return "", err
	}
	return *banqueID, nil
}

// `isActive` : une étape initiale désactivée ne doit plus rien recevoir.
func (s *service) etapeInitiale(ctx context.Context) (string, error) {
	initiale, err := s.Q.BankStageInitial(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", socle.Problem(http.StatusConflict, "BANK_WORKFLOW_NO_INITIAL_STAGE",
			"Le workflow bancaire n’a pas d’étape initiale ACTIVE : configuration incomplète.")
	}
	return initiale, err
}

// L'identité du client est COPIÉE ici et plus jamais réécrite : le dossier doit
// refléter ce qui a été transmis à la banque ce jour-là.
func (s *service) ecrireDossier(ctx context.Context, agentID, banqueID, initiale string, prospect *db.BankCaseProspectRow, reference string, inscriptionID *string) (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	transitionID, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	if prospect.PhoneE164 == nil {
		return "", socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_PHONE_REQUIRED",
			"Ce prospect n’a pas de numéro : la banque ne pourrait pas le joindre. Renseignez son téléphone.")
	}
	nom := banqueEspaces.ReplaceAllString(strings.TrimSpace(prospect.Prenom+" "+prospect.Nom), " ")
	instant := time.Now()
	err = s.transactionBanque(ctx, func(q *db.Queries) error {
		if err := q.BankCaseInsert(ctx, db.BankCaseInsertParams{
			ID: id.String(), Reference: banqueReferenceAffichee(reference), ReferenceKey: banqueReferenceCle(reference),
			ProspectId: prospect.ID, CustomerName: nom, CustomerPhoneE164: *prospect.PhoneE164,
			ProcessingBankId: banqueID, CurrentStageId: initiale, CreatedById: agentID, InscriptionId: inscriptionID,
		}); err != nil {
			return err
		}
		// L'ouverture est elle-même une transition, sans quoi la timeline ne dirait
		// pas qui a ouvert le dossier ni quand.
		if err := q.BankTransitionInsert(ctx, db.BankTransitionInsertParams{
			ID: transitionID.String(), CaseId: id.String(), ToStageId: initiale, PerformedById: agentID,
			ClientAt: &instant,
		}); err != nil {
			return err
		}
		return database.Auditer(ctx, q, agentID, "bank_case.create", "bank_case", id.String(), nil,
			map[string]any{
				banqueCleReference: banqueReferenceAffichee(reference), "prospectId": prospect.ID,
				banqueCleBanque: banqueID, "inscriptionId": inscriptionID,
			})
	})
	if banqueConflitUnicite(err) {
		return "", s.banqueReferenceDejaPrise(ctx, banqueReferenceCle(reference))
	}
	return id.String(), err
}

type ModificationDossierInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		ExpectedRev      int32   `json:"expectedRev" minimum:"1"`
		ProcessingBankID *string `json:"processingBankId,omitempty" format:"uuid"`
	}
}

func (s *service) banqueRevConflit(ctx context.Context, id string, ref *referentielBanque) error {
	courant, err := s.dossier(ctx, id, "", ref)
	if err != nil {
		return err
	}
	return problemBanque(http.StatusConflict, banqueCodeRevConflit,
		"Le dossier a été modifié entre-temps par un autre utilisateur. Vérifiez l’état courant avant de réessayer.",
		map[string]any{"currentRev": courant.Rev, "current": courant})
}

// La référence est générée à l'ouverture et ne se modifie plus : seule la
// banque de traitement peut changer.
func (s *service) banqueChampsModifies(ctx context.Context, in *ModificationDossierInput) (db.BankCaseEditParams, error) {
	params := db.BankCaseEditParams{ID: in.ID, Expectedrev: in.Body.ExpectedRev}
	if in.Body.ProcessingBankID == nil {
		return params, nil
	}
	banqueID, err := s.banqueTraitement(ctx, nil, in.Body.ProcessingBankID)
	if err != nil {
		return params, err
	}
	params.ProcessingBankId = &banqueID
	return params, nil
}

// Ni l'étape, ni le montant, ni le motif : ceux-là ne changent que par une
// transition, qui laisse une trace.
func (s *service) modifierDossier(ctx context.Context, in *ModificationDossierInput) (*DossierOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	ref, err := s.chargerReferentielBanque(ctx)
	if err != nil {
		return nil, err
	}
	existant, err := s.dossier(ctx, in.ID, "", ref)
	if err != nil {
		return nil, err
	}
	if existant.IsTerminal {
		return nil, terminalBanque(existant.CurrentStage.Label)
	}
	params, err := s.banqueChampsModifies(ctx, in)
	if err != nil {
		return nil, err
	}
	params.Updatedbyid = &u.ID
	banqueCible := existant.ProcessingBankID
	if params.ProcessingBankId != nil {
		banqueCible = *params.ProcessingBankId
	}
	if err := s.transactionBanque(ctx, func(q *db.Queries) error {
		lignes, err := q.BankCaseEdit(ctx, params)
		if err != nil {
			return err
		}
		if lignes == 0 {
			return s.banqueRevConflit(ctx, in.ID, ref)
		}
		return database.Auditer(ctx, q, u.ID, "bank_case.update", "bank_case", in.ID,
			map[string]any{banqueCleReference: existant.Reference, banqueCleBanque: existant.ProcessingBankID},
			map[string]any{banqueCleReference: existant.Reference, banqueCleBanque: banqueCible})
	}); err != nil {
		return nil, err
	}
	dossier, err := s.dossier(ctx, in.ID, "", ref)
	return &DossierOutput{Body: dossier}, err
}

func terminalBanque(libelle string) error {
	return problemBanque(http.StatusConflict, "BANK_CASE_TERMINAL",
		"Ce dossier est en étape terminale ("+libelle+"). Seul un administrateur peut le corriger, avec justification.",
		map[string]any{"stageLabel": libelle})
}

type CorpsTransitionBanque struct {
	TargetStageID     string  `json:"targetStageId" format:"uuid"`
	ExpectedRev       int32   `json:"expectedRev" minimum:"1"`
	AmountXof         *string `json:"amountXof,omitempty" pattern:"^\\d{1,18}$"`
	RejectionReasonID *string `json:"rejectionReasonId,omitempty" format:"uuid"`
	RejectionDetail   *string `json:"rejectionDetail,omitempty" maxLength:"2000"`
	Comment           *string `json:"comment,omitempty" maxLength:"2000"`
}

type TransitionBanqueInput struct {
	ID   string `path:"id" format:"uuid"`
	Body CorpsTransitionBanque
}

type CorrectionBanqueInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		CorpsTransitionBanque
		Reason string `json:"reason" minLength:"3" maxLength:"2000"`
	}
}

type effetTransitionBanque struct {
	montant *string
	motifID *string
	detail  *string
}

func banquePlanEncaissement(corps *CorpsTransitionBanque) (effetTransitionBanque, error) {
	if corps.AmountXof == nil {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, banqueCodeMontantRequis, "Un encaissement exige un montant.")
	}
	if !strings.ContainsAny(*corps.AmountXof, "123456789") {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, banqueCodeMontantRequis, "Le montant encaissé doit être strictement positif.")
	}
	if corps.RejectionReasonID != nil {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_REJECTION_REASON_NOT_ALLOWED",
			"Un encaissement ne porte pas de motif de rejet.")
	}
	return effetTransitionBanque{montant: corps.AmountXof}, nil
}

func banquePlanRejet(corps *CorpsTransitionBanque, codeMotif string) (effetTransitionBanque, error) {
	if corps.RejectionReasonID == nil {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_REJECTION_REASON_REQUIRED", "Un rejet exige un motif.")
	}
	detail := banqueTexteNettoye(corps.RejectionDetail)
	if codeMotif == BanqueMotifAutre && detail == nil {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_REJECTION_DETAIL_REQUIRED",
			"Le motif « Autre » exige une précision : sans elle, la statistique est aveugle.")
	}
	// Zéro, et non le montant reçu : « rejeté, 1 200 000 » entrerait sinon dans
	// la somme encaissée du tableau de bord.
	zero := "0"
	return effetTransitionBanque{montant: &zero, motifID: corps.RejectionReasonID, detail: detail}, nil
}

func banquePlanOuverture(corps *CorpsTransitionBanque) (effetTransitionBanque, error) {
	if corps.AmountXof != nil {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_AMOUNT_NOT_ALLOWED",
			"Un dossier en cours d’instruction ne porte pas de montant.")
	}
	if corps.RejectionReasonID != nil {
		return effetTransitionBanque{}, socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_REJECTION_REASON_NOT_ALLOWED",
			"Un dossier en cours d’instruction ne porte pas de motif de rejet.")
	}
	return effetTransitionBanque{}, nil
}

func banquePlanTransition(cible *EtapeBanque, corps *CorpsTransitionBanque, codeMotif string) (effetTransitionBanque, error) {
	if cible.Type == banqueEtapeEncaissee {
		return banquePlanEncaissement(corps)
	}
	if cible.Type == banqueEtapeRejetee {
		return banquePlanRejet(corps, codeMotif)
	}
	return banquePlanOuverture(corps)
}

// Depuis une étape ouverte, toute étape active se rejoint dans les deux sens :
// l'ordre du flux guide, il n'enferme pas. Seul le rejet exige une prise en
// traitement préalable ; l'encaissement et le rejet se confirment par leur
// montant ou leur motif (banquePlanTransition).
func banqueAtteignable(courante, cible *EtapeBanque) error {
	if !cible.IsActive {
		return banqueEtapeInactive(cible)
	}
	if cible.ID == courante.ID {
		return problemBanque(http.StatusUnprocessableEntity, banqueCodeEtapeNonSuivante,
			"Le dossier est déjà sur cette étape.", map[string]any{banqueCleEtapeCourante: courante.ID})
	}
	if cible.Type == banqueEtapeRejetee && courante.IsInitial {
		return problemBanque(http.StatusUnprocessableEntity, "BANK_CASE_REJECT_BEFORE_PROCESSING",
			"Un dossier encore à traiter ne se rejette pas : prenez-le d’abord en traitement.",
			map[string]any{banqueCleEtapeCourante: courante.ID})
	}
	return nil
}

func banqueEtapeInactive(cible *EtapeBanque) error {
	return problemBanque(http.StatusConflict, banqueCodeEtapeInactive,
		"L’étape « "+cible.Label+" » est désactivée : aucun dossier ne peut y être placé.",
		map[string]any{banqueCleEtape: cible.ID})
}

func (r *referentielBanque) motifActif(id *string) (string, error) {
	if id == nil {
		return "", nil
	}
	motif, connu := r.motifs[*id]
	if !connu {
		return "", problemBanque(http.StatusBadRequest, "BANK_CASE_REJECTION_REASON_NOT_FOUND",
			"Motif de rejet inconnu.", map[string]any{"rejectionReasonId": *id})
	}
	if !motif.IsActive {
		return "", problemBanque(http.StatusBadRequest, "BANK_CASE_REJECTION_REASON_NOT_FOUND",
			"Le motif « "+motif.Label+" » est désactivé.", map[string]any{"rejectionReasonId": *id})
	}
	return motif.Code, nil
}

// Contourne l'atteignabilité et le verrou terminal, RIEN d'autre : les règles
// financières s'appliquent à l'identique et l'historique reste append-only.
func (s *service) banqueAppliquerTransition(ctx context.Context, id string, corps *CorpsTransitionBanque, justification *string) (*DetailDossierOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	ref, err := s.chargerReferentielBanque(ctx)
	if err != nil {
		return nil, err
	}
	existant, err := s.dossier(ctx, id, "", ref)
	if err != nil {
		return nil, err
	}
	if justification == nil && existant.IsTerminal {
		return nil, terminalBanque(existant.CurrentStage.Label)
	}
	cible, connue := ref.parID[corps.TargetStageID]
	if !connue {
		return nil, socle.Problem(http.StatusNotFound, banqueCodeEtapeIntrouvable, "Étape introuvable.")
	}
	if err := banqueVerifierCible(&existant, &cible, justification != nil); err != nil {
		return nil, err
	}
	codeMotif, err := ref.motifActif(corps.RejectionReasonID)
	if err != nil {
		return nil, err
	}
	effet, err := banquePlanTransition(&cible, corps, codeMotif)
	if err != nil {
		return nil, err
	}
	if err := s.banqueEcrireTransition(ctx, &u, &existant, &cible, effet, corps, justification); err != nil {
		return nil, err
	}
	if cible.Type != banqueEtapeOuverte && justification == nil {
		s.signalerIssue(ctx, id, cible.Type)
	}
	return s.detailDossier(ctx, id, "")
}

func banqueVerifierCible(existant *DossierBanque, cible *EtapeBanque, correction bool) error {
	if !correction {
		return banqueAtteignable(&existant.CurrentStage, cible)
	}
	if !cible.IsActive {
		return banqueEtapeInactive(cible)
	}
	return nil
}

func (s *service) banqueEcrireTransition(ctx context.Context, u *socle.Utilisateur, existant *DossierBanque, cible *EtapeBanque, effet effetTransitionBanque, corps *CorpsTransitionBanque, justification *string) error {
	transitionID, err := uuid.NewV7()
	if err != nil {
		return err
	}
	montant, err := banqueMontantNumeric(effet.montant)
	if err != nil {
		return err
	}
	instant := time.Now()
	return s.transactionBanque(ctx, func(q *db.Queries) error {
		// Le garde de révision est DANS la mise à jour : lire puis écrire
		// laisserait une fenêtre où deux agents passent tous les deux le contrôle.
		lignes, err := q.BankCaseAdvance(ctx, db.BankCaseAdvanceParams{
			ID: existant.ID, Rev: corps.ExpectedRev, CurrentStageId: cible.ID, AmountXof: montant,
			RejectionReasonId: effet.motifID, RejectionDetail: effet.detail, UpdatedById: &u.ID,
		})
		if err != nil {
			return err
		}
		if lignes == 0 {
			ref, err := s.chargerReferentielBanque(ctx)
			if err != nil {
				return err
			}
			return s.banqueRevConflit(ctx, existant.ID, ref)
		}
		// Même transaction : un dossier n'avance pas sans trace, ni ne laisse de
		// trace sans avoir avancé.
		if err := q.BankTransitionInsert(ctx, db.BankTransitionInsertParams{
			ID: transitionID.String(), CaseId: existant.ID, FromStageId: &existant.CurrentStage.ID,
			ToStageId: cible.ID, PerformedById: u.ID, AmountXof: montant,
			RejectionReasonId: effet.motifID, RejectionDetail: effet.detail,
			Comment: banqueTexteNettoye(corps.Comment), CorrectionReason: justification, ClientAt: &instant,
		}); err != nil {
			return err
		}
		if justification == nil {
			return nil
		}
		return database.Auditer(ctx, q, u.ID, "bank_case.correction", "bank_case", existant.ID,
			map[string]any{banqueCleEtape: existant.CurrentStage.ID, banqueCleMontant: existant.AmountXof},
			map[string]any{banqueCleEtape: cible.ID, banqueCleMontant: effet.montant, "reason": *justification})
	})
}

func (s *service) avancerDossier(ctx context.Context, in *TransitionBanqueInput) (*DetailDossierOutput, error) {
	return s.banqueAppliquerTransition(ctx, in.ID, &in.Body, nil)
}

func (s *service) corrigerDossier(ctx context.Context, in *CorrectionBanqueInput) (*DetailDossierOutput, error) {
	justification := strings.TrimSpace(in.Body.Reason)
	return s.banqueAppliquerTransition(ctx, in.ID, &in.Body.CorpsTransitionBanque, &justification)
}

type InclureInactifsBanqueInput struct {
	IncludeInactive bool `query:"includeInactive" default:"false"`
}

type MotifsBanqueOutput struct {
	Body struct {
		Items []MotifBanque `json:"items"`
	}
}

func (s *service) banqueListerMotifsRejet(ctx context.Context, in *InclureInactifsBanqueInput) (*MotifsBanqueOutput, error) {
	rows, err := s.Q.BankRejectionReasons(ctx, in.IncludeInactive)
	if err != nil {
		return nil, err
	}
	out := &MotifsBanqueOutput{}
	out.Body.Items = make([]MotifBanque, 0, len(rows))
	for i := range rows {
		out.Body.Items = append(out.Body.Items, banqueMotifDTO(&rows[i]))
	}
	return out, nil
}

type EtapesBanqueOutput struct {
	Body struct {
		Items []EtapeBanque `json:"items"`
	}
}

type EtapeBanqueOutput struct {
	Body EtapeBanque
}

func (s *service) banqueListerEtapes(ctx context.Context, in *InclureInactifsBanqueInput) (*EtapesBanqueOutput, error) {
	return s.banqueEtapesTriees(ctx, in.IncludeInactive)
}

func (s *service) banqueEtapesTriees(ctx context.Context, inactives bool) (*EtapesBanqueOutput, error) {
	rows, err := s.Q.BankStages(ctx, inactives)
	if err != nil {
		return nil, err
	}
	out := &EtapesBanqueOutput{}
	out.Body.Items = make([]EtapeBanque, 0, len(rows))
	for i := range rows {
		out.Body.Items = append(out.Body.Items, banqueEtapeDTO(&rows[i]))
	}
	return out, nil
}

type CreationEtapeBanqueInput struct {
	Body struct {
		Code     string `json:"code" minLength:"2" maxLength:"40" pattern:"^[A-Z][A-Z0-9_]*$"`
		Label    string `json:"label" minLength:"2" maxLength:"80"`
		Color    string `json:"color" minLength:"2" maxLength:"40"`
		Position *int32 `json:"position,omitempty" minimum:"1" maximum:"99"`
	}
}

func banqueConflitCodeEtape(code, libelle, existant string) error {
	if libelle == "" {
		return socle.Problem(http.StatusConflict, banqueCodeConflitCodeEtape, "Le code « "+code+" » est déjà utilisé.")
	}
	return problemBanque(http.StatusConflict, banqueCodeConflitCodeEtape,
		"Le code « "+code+" » est déjà utilisé par l’étape « "+libelle+" ».",
		map[string]any{socle.CleIdentifiantExistant: existant})
}

// Le type n'est pas un paramètre : une seconde étape d'encaissement ou de rejet
// rendrait la règle financière ambiguë.
func (s *service) banqueCreerEtape(ctx context.Context, in *CreationEtapeBanqueInput) (*EtapeBanqueOutput, error) {
	code := strings.ToUpper(strings.TrimSpace(in.Body.Code))
	rival, err := s.Q.BankStageByCode(ctx, code)
	if err == nil {
		return nil, banqueConflitCodeEtape(code, rival.Label, rival.ID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	var creee db.BankCaseStage
	err = s.transactionBanque(ctx, func(q *db.Queries) error {
		// `position` ne porte aucune unicité en base : sans ce verrou, deux
		// créations simultanées lisent le même rang et l'écrivent toutes les deux.
		if err := q.LockStagePosition(ctx, banqueVerrouPosition); err != nil {
			return err
		}
		position, err := banquePositionInseree(ctx, q, in.Body.Position)
		if err != nil {
			return err
		}
		creee, err = q.BankStageInsert(ctx, db.BankStageInsertParams{
			ID: id.String(), Code: code, Label: strings.TrimSpace(in.Body.Label),
			Color: strings.TrimSpace(in.Body.Color), Position: position,
		})
		if err != nil {
			return err
		}
		return database.Auditer(ctx, q, socle.UtilisateurCourant(ctx).ID, "referentiel.create",
			banqueFamilleEtapes, id.String(), nil, map[string]any{
				banqueCleCode: creee.Code, banqueCleLabel: creee.Label,
				banqueCleCouleur: creee.Color, "position": creee.Position,
			})
	})
	if banqueConflitUnicite(err) {
		return nil, banqueConflitCodeEtape(code, "", "")
	}
	if err != nil {
		return nil, err
	}
	return &EtapeBanqueOutput{Body: banqueEtapeDTO(&creee)}, nil
}

func banquePositionInseree(ctx context.Context, q *db.Queries, demandee *int32) (int32, error) {
	ouvertes, err := q.BankStagesOpen(ctx)
	if err != nil {
		return 0, err
	}
	position := int32(1)
	if len(ouvertes) > 0 {
		position = ouvertes[len(ouvertes)-1].Position + 1
	}
	if demandee != nil {
		position = *demandee
	}
	position = min(max(position, 1), banquePositionMax)
	for _, etape := range ouvertes {
		if etape.Position < position {
			continue
		}
		if err := q.BankStageShift(ctx, etape.ID); err != nil {
			return 0, err
		}
	}
	return position, nil
}

type ModificationEtapeBanqueInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Label *string `json:"label,omitempty" minLength:"2" maxLength:"80"`
		Color *string `json:"color,omitempty" minLength:"2" maxLength:"40"`
	}
}

// Ni le code, ni le type, ni le drapeau initial : une étape déjà inscrite dans
// l'historique d'un dossier clos ne change pas de nature rétroactivement.
func (s *service) banqueModifierEtape(ctx context.Context, in *ModificationEtapeBanqueInput) (*EtapeBanqueOutput, error) {
	etape, err := s.Q.BankStageByID(ctx, in.ID)
	if err != nil {
		return nil, banqueEtapeIntrouvable(err)
	}
	auteur := socle.UtilisateurCourant(ctx).ID
	var modifiee db.BankCaseStage
	if err := s.transactionBanque(ctx, func(q *db.Queries) error {
		ecrite, err := q.BankStageRename(ctx, db.BankStageRenameParams{
			ID: in.ID, Label: banqueTexteNettoye(in.Body.Label), Color: banqueTexteNettoye(in.Body.Color),
		})
		if err != nil {
			return err
		}
		modifiee = ecrite
		avant, apres := map[string]any{}, map[string]any{}
		if in.Body.Label != nil {
			avant[banqueCleLabel], apres[banqueCleLabel] = etape.Label, ecrite.Label
		}
		if in.Body.Color != nil {
			avant[banqueCleCouleur], apres[banqueCleCouleur] = etape.Color, ecrite.Color
		}
		return database.Auditer(ctx, q, auteur, "referentiel.update", banqueFamilleEtapes, in.ID, avant, apres)
	}); err != nil {
		return nil, err
	}
	return &EtapeBanqueOutput{Body: banqueEtapeDTO(&modifiee)}, nil
}

func banqueEtapeIntrouvable(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return socle.Problem(http.StatusNotFound, banqueCodeEtapeIntrouvable, "Étape introuvable.")
	}
	return err
}

type ReordonnancementBanqueInput struct {
	Body struct {
		StageIDs []string `json:"stageIds" minItems:"1" maxItems:"50" uniqueItems:"true"`
	}
}

// La liste doit être EXHAUSTIVE et commencer par l'étape initiale. Le
// réordonnancement n'affecte que les transitions FUTURES.
func (s *service) banqueReordonnerEtapes(ctx context.Context, in *ReordonnancementBanqueInput) (*EtapesBanqueOutput, error) {
	ouvertes, err := s.Q.BankStagesOpen(ctx)
	if err != nil {
		return nil, err
	}
	if err := banqueListeExhaustive(ouvertes, in.Body.StageIDs); err != nil {
		return nil, err
	}
	err = s.transactionBanque(ctx, func(q *db.Queries) error {
		if err := q.LockStagePosition(ctx, banqueVerrouPosition); err != nil {
			return err
		}
		var rang int32
		for _, id := range in.Body.StageIDs {
			rang++
			if err := q.BankStageSetPosition(ctx, db.BankStageSetPositionParams{ID: id, Position: rang}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.banqueEtapesTriees(ctx, true)
}

func banqueListeExhaustive(ouvertes []db.BankStagesOpenRow, recues []string) error {
	connues := make(map[string]bool, len(ouvertes))
	for _, etape := range ouvertes {
		connues[etape.ID] = true
	}
	inconnues := make([]string, 0, len(recues))
	for _, id := range recues {
		if !connues[id] {
			inconnues = append(inconnues, id)
		}
	}
	manquantes := make([]string, 0, len(ouvertes))
	for _, etape := range ouvertes {
		if !slices.Contains(recues, etape.ID) {
			manquantes = append(manquantes, etape.ID)
		}
	}
	if len(inconnues) > 0 || len(manquantes) > 0 {
		return problemBanque(http.StatusBadRequest, "BANK_STAGE_REORDER_INCOMPLETE",
			"La liste doit contenir exactement toutes les étapes ouvertes, chacune une seule fois.",
			map[string]any{"unknown": inconnues, "missing": manquantes})
	}
	for _, etape := range ouvertes {
		if etape.IsInitial && recues[0] != etape.ID {
			return problemBanque(http.StatusBadRequest, "BANK_STAGE_INITIAL_MUST_BE_FIRST",
				"L’étape initiale « "+etape.Label+" » doit rester en première position.",
				map[string]any{"initialStageId": etape.ID})
		}
	}
	return nil
}

type ActivationEtapeBanqueInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		IsActive bool `json:"isActive"`
	}
}

// Refusé sur une étape système, et refusé tant que des dossiers stationnent sur
// l'étape : ils deviendraient invisibles du flux sans que personne ne le sache.
func (s *service) banqueActiverEtape(ctx context.Context, in *ActivationEtapeBanqueInput) (*EtapeBanqueOutput, error) {
	etape, err := s.Q.BankStageByID(ctx, in.ID)
	if err != nil {
		return nil, banqueEtapeIntrouvable(err)
	}
	if etape.IsSystem {
		return nil, problemBanque(http.StatusConflict, "BANK_STAGE_SYSTEM_IMMUTABLE",
			"« "+etape.Label+" » est une étape système : son activation ne se configure pas.",
			map[string]any{banqueCleEtape: etape.ID})
	}
	if !in.Body.IsActive {
		if err := s.banqueEtapeLiberee(ctx, &etape); err != nil {
			return nil, err
		}
	}
	auteur := socle.UtilisateurCourant(ctx).ID
	var modifiee db.BankCaseStage
	// Désactiver une étape change le sens de tous les dossiers qui l'ont
	// traversée : la bascule et sa trace tiennent ou tombent ensemble.
	if err := s.transactionBanque(ctx, func(q *db.Queries) error {
		ecrite, err := q.BankStageSetActive(ctx, db.BankStageSetActiveParams{ID: in.ID, IsActive: in.Body.IsActive})
		if err != nil {
			return err
		}
		modifiee = ecrite
		return database.Auditer(ctx, q, auteur, "referentiel.active", banqueFamilleEtapes, in.ID,
			map[string]any{banqueCleActif: etape.IsActive}, map[string]any{banqueCleActif: ecrite.IsActive})
	}); err != nil {
		return nil, err
	}
	return &EtapeBanqueOutput{Body: banqueEtapeDTO(&modifiee)}, nil
}

func (s *service) banqueEtapeLiberee(ctx context.Context, etape *db.BankCaseStage) error {
	retenus, err := s.Q.BankStageCaseCount(ctx, etape.ID)
	if err != nil {
		return err
	}
	if retenus == 0 {
		return nil
	}
	return problemBanque(http.StatusConflict, "BANK_STAGE_HAS_OPEN_CASES",
		fmt.Sprintf("%d dossier(s) stationnent sur « %s ». Faites-les avancer avant de désactiver l’étape.", retenus, etape.Label),
		map[string]any{banqueCleEtape: etape.ID, "caseCount": retenus})
}

type DemandeBanqueOutput struct {
	Body DemandeClientBanque
}

func banqueDemandeDTO(row *db.ClientRequestListRow) DemandeClientBanque {
	return DemandeClientBanque{
		ID: row.ID, Nom: row.Nom, Prenom: row.Prenom, PhoneE164: row.PhoneE164, Note: row.Note,
		BanqueID: row.BanqueId, BanqueName: row.BanqueName, RequestedByID: row.RequestedById,
		RequestedByName: row.RequestedByName, Status: string(row.Status), ReviewedByID: row.ReviewedById,
		ReviewedByName: row.ReviewedByName, ReviewedAt: row.ReviewedAt, RejectionNote: row.RejectionNote,
		CreatedProspectID: row.CreatedProspectId, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

// Un agent bancaire ne voit que ses propres demandes : les autres révéleraient à
// une banque les clients qu'une concurrente cherche à faire créer.
func banquePortefeuilleDemandes(u *socle.Utilisateur) *string {
	if u.Role == socle.Admin {
		return nil
	}
	return &u.ID
}

func (s *service) banqueDemande(ctx context.Context, id string, portefeuille *string) (DemandeClientBanque, error) {
	rows, err := s.Q.ClientRequestList(ctx, db.ClientRequestListParams{ID: &id, RequestedById: portefeuille, Lignes: 1})
	if err != nil {
		return DemandeClientBanque{}, err
	}
	if len(rows) == 0 {
		return DemandeClientBanque{}, socle.Problem(http.StatusNotFound, banqueCodeDemandeIntrouvable, banqueMessageDemandeIntrouvable)
	}
	return banqueDemandeDTO(&rows[0]), nil
}

type CreationDemandeBanqueInput struct {
	Body struct {
		Nom      string  `json:"nom" minLength:"1" maxLength:"120"`
		Prenom   string  `json:"prenom" minLength:"1" maxLength:"120"`
		Phone    string  `json:"phone" minLength:"6" maxLength:"40"`
		BanqueID string  `json:"banqueId" format:"uuid"`
		Note     *string `json:"note,omitempty" maxLength:"2000"`
	}
}

// Le téléphone est normalisé AVANT tout contrôle : un client déjà en base sous
// une autre écriture du même numéro est reconnu, pas dupliqué.
func (s *service) banqueCreerDemande(ctx context.Context, in *CreationDemandeBanqueInput) (*DemandeBanqueOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	phone, err := database.NormaliserTelephone(in.Body.Phone, s.Cfg.PhoneRegion)
	if err != nil {
		return nil, err
	}
	if _, err := s.Q.ClientRequestBanqueExists(ctx, in.Body.BanqueID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, socle.Problem(http.StatusUnprocessableEntity, codeDemandeBanque, "La banque demandeuse est introuvable.")
		}
		return nil, err
	}
	if err := s.banqueNumeroDisponible(ctx, phone); err != nil {
		return nil, err
	}
	id, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	err = s.Q.ClientRequestInsert(ctx, db.ClientRequestInsertParams{
		ID: id.String(), Nom: strings.TrimSpace(in.Body.Nom), Prenom: strings.TrimSpace(in.Body.Prenom),
		PhoneE164: phone, Note: banqueTexteNettoye(in.Body.Note), BanqueId: in.Body.BanqueID, RequestedById: u.ID,
	})
	// L'index partiel `client_creation_requests_pending_phone_key` tranche deux
	// dépôts simultanés que le pré-contrôle laisse passer tous les deux.
	if banqueConflitUnicite(err) {
		return nil, s.banqueDemandeEnAttente(ctx, phone)
	}
	if err != nil {
		return nil, err
	}
	demande, err := s.banqueDemande(ctx, id.String(), nil)
	if err != nil {
		return nil, err
	}
	s.banqueAviser(ctx, "dépôt", u.ID, &notifications.CreationNotification{
		Title: "Demande de création de client",
		Body: fmt.Sprintf("%s demande la création de %s %s (%s).",
			demande.BanqueName, demande.Prenom, demande.Nom, demande.PhoneE164),
		Category: string(db.NotificationCategorySYSTEME), Route: banqueRouteDemandes, Audience: string(db.NotificationAudienceROLE), AudienceRole: string(socle.Admin),
	})
	return &DemandeBanqueOutput{Body: demande}, nil
}

func (s *service) banqueNumeroDisponible(ctx context.Context, phone string) error {
	_, err := s.Q.ClientRequestProspectByPhone(ctx, &phone)
	if err == nil {
		return problemBanque(http.StatusConflict, banqueCodeDemandeProspect,
			"Un prospect porte déjà ce numéro. Recherchez-le par son téléphone.", map[string]any{socle.ProspectChampPhone: phone})
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	return s.banqueDemandeEnAttente(ctx, phone)
}

func (s *service) banqueDemandeEnAttente(ctx context.Context, phone string) error {
	rival, err := s.Q.ClientRequestPendingByPhone(ctx, phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return problemBanque(http.StatusConflict, banqueCodeDemandeAttente,
		"Une demande est déjà en attente pour ce numéro.", map[string]any{"existingId": rival})
}

type ListeDemandesBanqueInput struct {
	Status   string `query:"status" enum:"PENDING,APPROVED,REJECTED"`
	Search   string `query:"search" maxLength:"120"`
	BanqueID string `query:"banqueId" format:"uuid"`
	Page     int32  `query:"page" minimum:"1" default:"1"`
	PageSize int32  `query:"pageSize" minimum:"1" maximum:"200" default:"25"`
}

type ListeDemandesBanqueOutput struct {
	Body struct {
		Items []DemandeClientBanque `json:"items"`
		Meta  MetaBanque            `json:"meta"`
		// Demandes encore en attente, TOUS filtres confondus : c'est ce nombre que
		// porte la pastille du menu.
		PendingCount int32 `json:"pendingCount"`
	}
}

func (s *service) banqueListerDemandes(ctx context.Context, in *ListeDemandesBanqueInput) (*ListeDemandesBanqueOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	portee := banquePortefeuilleDemandes(&u)
	params := db.ClientRequestListParams{
		RequestedById: portee, Lignes: in.PageSize, Saut: (in.Page - 1) * in.PageSize,
	}
	if in.Status != "" {
		statut := db.ClientRequestStatus(in.Status)
		params.Status = &statut
	}
	if in.BanqueID != "" {
		params.BanqueId = &in.BanqueID
	}
	if terme := strings.TrimSpace(in.Search); terme != "" {
		params.Search = &terme
		if chiffres := banqueNonChiffres.ReplaceAllString(terme, ""); len(chiffres) >= 4 {
			params.Digits = &chiffres
		}
	}
	rows, err := s.Q.ClientRequestList(ctx, params)
	if err != nil {
		return nil, err
	}
	attente, err := s.Q.ClientRequestPendingCount(ctx, portee)
	if err != nil {
		return nil, err
	}
	out := &ListeDemandesBanqueOutput{}
	out.Body.Items = make([]DemandeClientBanque, 0, len(rows))
	var total int32
	for i := range rows {
		total = rows[i].Total
		out.Body.Items = append(out.Body.Items, banqueDemandeDTO(&rows[i]))
	}
	out.Body.Meta, out.Body.PendingCount = metaBanque(total, in.Page, in.PageSize), attente
	return out, nil
}

type ApprobationBanqueInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		RepresentantID  string  `json:"representantId" format:"uuid"`
		SyndicatID      string  `json:"syndicatId" format:"uuid"`
		BanqueID        *string `json:"banqueId,omitempty" format:"uuid"`
		ClientCreatedAt *string `json:"clientCreatedAt,omitempty" format:"date-time"`
	}
}

func (s *service) banqueDemandePendante(ctx context.Context, id string) (DemandeClientBanque, error) {
	demande, err := s.banqueDemande(ctx, id, nil)
	if err != nil {
		return demande, err
	}
	if demande.Status != string(db.ClientRequestStatusPENDING) {
		return demande, problemBanque(http.StatusConflict, banqueCodeDemandeArbitree, banqueMessageDemandeArbitree,
			map[string]any{banqueCleStatut: demande.Status})
	}
	return demande, nil
}

func (s *service) banqueRattachement(ctx context.Context, in *ApprobationBanqueInput) error {
	if _, err := s.Q.ClientRequestRepresentantExists(ctx, in.Body.RepresentantID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusUnprocessableEntity, "CLIENT_REQUEST_REPRESENTANT_NOT_FOUND",
				"Le représentant de rattachement est introuvable.")
		}
		return err
	}
	if _, err := s.Q.ClientRequestSyndicatExists(ctx, in.Body.SyndicatID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusUnprocessableEntity, "CLIENT_REQUEST_SYNDICAT_NOT_FOUND",
				"Le syndicat choisi est introuvable.")
		}
		return err
	}
	if in.Body.BanqueID == nil {
		return nil
	}
	if _, err := s.Q.ClientRequestBanqueExists(ctx, *in.Body.BanqueID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return socle.Problem(http.StatusUnprocessableEntity, codeDemandeBanque, "La banque demandeuse est introuvable.")
		}
		return err
	}
	return nil
}

// Le prospect naît avec sa provenance : origin=BANQUE, libellé = nom de la
// banque demandeuse, recopié pour survivre à un renommage du référentiel.
func (s *service) banqueApprouverDemande(ctx context.Context, in *ApprobationBanqueInput) (*DemandeBanqueOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	demande, err := s.banqueDemandePendante(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := s.banqueRattachement(ctx, in); err != nil {
		return nil, err
	}
	// LECTURE GLOBALE : l'unicité du téléphone est portée par un index partiel
	// global ; filtrée, elle laisserait créer un prospect que la base refuse.
	if _, err := s.Q.ClientRequestProspectByPhone(ctx, &demande.PhoneE164); err == nil {
		return nil, problemBanque(http.StatusConflict, banqueCodeDemandeProspect,
			"Un prospect porte déjà ce numéro. Recherchez-le par son téléphone.",
			map[string]any{"phoneE164": demande.PhoneE164})
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err := s.banqueEcrireApprobation(ctx, &u, &demande, in); err != nil {
		return nil, err
	}
	arbitree, err := s.banqueDemande(ctx, in.ID, nil)
	if err != nil {
		return nil, err
	}
	s.banqueAviserDemandeur(ctx, u.ID, &arbitree, true)
	return &DemandeBanqueOutput{Body: arbitree}, nil
}

func (s *service) banqueEcrireApprobation(ctx context.Context, u *socle.Utilisateur, demande *DemandeClientBanque, in *ApprobationBanqueInput) error {
	prospectID, err := uuid.NewV7()
	if err != nil {
		return err
	}
	banqueID := &demande.BanqueID
	if in.Body.BanqueID != nil {
		banqueID = in.Body.BanqueID
	}
	saisie := demande.CreatedAt
	if in.Body.ClientCreatedAt != nil {
		if saisie, err = time.Parse(time.RFC3339, *in.Body.ClientCreatedAt); err != nil {
			return socle.Problem(http.StatusUnprocessableEntity, "VALIDATION_FAILED", "clientCreatedAt doit être une date ISO 8601.")
		}
	}
	maintenant := time.Now()
	return s.transactionBanque(ctx, func(q *db.Queries) error {
		if err := q.ClientRequestProspectInsert(ctx, db.ClientRequestProspectInsertParams{
			ID: prospectID.String(), Nom: demande.Nom, Prenom: demande.Prenom, PhoneE164: &demande.PhoneE164,
			BanqueId: banqueID, SyndicatId: &in.Body.SyndicatID, RepresentantId: &in.Body.RepresentantID,
			CreatedById: u.ID, OriginLabel: &demande.BanqueName, ClientCreatedAt: saisie,
		}); err != nil {
			return err
		}
		// L'arbitrage se gagne par cette écriture CONDITIONNELLE : sur
		// `status = PENDING`, le second arbitre ne met rien à jour et sa
		// transaction avorte, ce qui défait le prospect qu'il venait de créer.
		nouveau := prospectID.String()
		lignes, err := q.ClientRequestApprove(ctx, db.ClientRequestApproveParams{
			ID: demande.ID, ReviewedById: &u.ID, ReviewedAt: &maintenant, CreatedProspectId: &nouveau,
		})
		if err != nil {
			return err
		}
		if lignes == 0 {
			return problemBanque(http.StatusConflict, banqueCodeDemandeArbitree, banqueMessageDemandeArbitree,
				map[string]any{banqueCleStatut: string(db.ClientRequestStatusAPPROVED)})
		}
		return database.Auditer(ctx, q, u.ID, "client_request.approve", "client_request", demande.ID,
			map[string]any{banqueCleStatut: string(db.ClientRequestStatusPENDING), "phoneE164": demande.PhoneE164},
			map[string]any{
				banqueCleStatut: string(db.ClientRequestStatusAPPROVED), "prospectId": nouveau,
				"banqueId": *banqueID, "syndicatId": in.Body.SyndicatID, "representantId": in.Body.RepresentantID,
			})
	})
}

type RefusBanqueInput struct {
	ID   string `path:"id" format:"uuid"`
	Body struct {
		Reason string `json:"reason" minLength:"3" maxLength:"2000"`
	}
}

// Le motif est obligatoire : un refus muet renverrait le demandeur à l'impasse
// que ce module existe pour lever.
func (s *service) banqueRefuserDemande(ctx context.Context, in *RefusBanqueInput) (*DemandeBanqueOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if _, err := s.banqueDemandePendante(ctx, in.ID); err != nil {
		return nil, err
	}
	motif := strings.TrimSpace(in.Body.Reason)
	maintenant := time.Now()
	if err := s.transactionBanque(ctx, func(q *db.Queries) error {
		lignes, err := q.ClientRequestReject(ctx, db.ClientRequestRejectParams{
			ID: in.ID, ReviewedById: &u.ID, ReviewedAt: &maintenant, RejectionNote: &motif,
		})
		if err != nil {
			return err
		}
		if lignes == 0 {
			return problemBanque(http.StatusConflict, banqueCodeDemandeArbitree, banqueMessageDemandeArbitree,
				map[string]any{banqueCleStatut: string(db.ClientRequestStatusREJECTED)})
		}
		return database.Auditer(ctx, q, u.ID, "client_request.reject", "client_request", in.ID,
			map[string]any{banqueCleStatut: string(db.ClientRequestStatusPENDING)},
			map[string]any{banqueCleStatut: string(db.ClientRequestStatusREJECTED), "motif": motif})
	}); err != nil {
		return nil, err
	}
	arbitree, err := s.banqueDemande(ctx, in.ID, nil)
	if err != nil {
		return nil, err
	}
	s.banqueAviserDemandeur(ctx, u.ID, &arbitree, false)
	return &DemandeBanqueOutput{Body: arbitree}, nil
}

var Garde = map[string]socle.Permission{
	"GET /api/v1/bank-cases":                        socle.PermissionBanqueDossiers,
	"POST /api/v1/bank-cases":                       socle.PermissionBanqueDossiers,
	"GET /api/v1/bank-cases/a-ouvrir":               socle.PermissionBanqueDossiers,
	"GET /api/v1/bank-cases/analytics":              socle.PermissionBanqueLire,
	"GET /api/v1/bank-cases/prospect-search":        socle.PermissionBanqueDossiers,
	"GET /api/v1/bank-cases/rejection-reasons":      socle.PermissionBanqueLire,
	"GET /api/v1/bank-cases/{id}":                   socle.PermissionBanqueDossiers,
	"GET /api/v1/bank-inscriptions/{id}/pieces":     socle.PermissionBanqueDossiers,
	"GET /api/v1/bank-inscriptions/{id}/piece":      socle.PermissionBanqueDossiers,
	"GET /api/v1/bank-inscriptions/{id}/pieces.zip": socle.PermissionBanqueDossiers,
	"PATCH /api/v1/bank-cases/{id}":                 socle.PermissionBanqueDossiers,
	"POST /api/v1/bank-cases/{id}/transitions":      socle.PermissionBanqueDossiers,
	"POST /api/v1/bank-cases/{id}/corrections":      socle.PermissionBanqueAdministrer,
	"GET /api/v1/bank-case-stages":                  socle.PermissionBanqueLire,
	"POST /api/v1/bank-case-stages":                 socle.PermissionBanqueAdministrer,
	"POST /api/v1/bank-case-stages/reorder":         socle.PermissionBanqueAdministrer,
	"PATCH /api/v1/bank-case-stages/{id}":           socle.PermissionBanqueAdministrer,
	"POST /api/v1/bank-case-stages/{id}/active":     socle.PermissionBanqueAdministrer,
	"POST /api/v1/client-requests":                  socle.PermissionBanqueDossiers,
	"GET /api/v1/client-requests":                   socle.PermissionBanqueDossiers,
	"GET /api/v1/client-requests/{id}":              socle.PermissionBanqueDossiers,
	"POST /api/v1/client-requests/{id}/approve":     socle.PermissionBanqueAdministrer,
	"POST /api/v1/client-requests/{id}/reject":      socle.PermissionBanqueAdministrer,
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d}
	huma.Get(api, "/api/v1/bank-cases", s.listerDossiers)
	monterPieces(api, s)
	posterBanque(api, "creer-dossier-bancaire", "/api/v1/bank-cases", s.creerDossier)
	huma.Get(api, "/api/v1/bank-cases/a-ouvrir", s.inscriptionsAOuvrir)
	huma.Get(api, "/api/v1/bank-cases/analytics", s.indicateursBanque)
	huma.Get(api, "/api/v1/bank-cases/prospect-search", s.banqueRechercherProspects)
	huma.Get(api, "/api/v1/bank-cases/rejection-reasons", s.banqueListerMotifsRejet)
	huma.Get(api, "/api/v1/bank-cases/{id}", s.lireDossierComplet)
	huma.Patch(api, "/api/v1/bank-cases/{id}", s.modifierDossier)
	posterBanque(api, "avancer-dossier-bancaire", "/api/v1/bank-cases/{id}/transitions", s.avancerDossier)
	posterBanque(api, "corriger-dossier-bancaire", "/api/v1/bank-cases/{id}/corrections", s.corrigerDossier)

	huma.Get(api, "/api/v1/bank-case-stages", s.banqueListerEtapes)
	posterBanque(api, "creer-etape-bancaire", "/api/v1/bank-case-stages", s.banqueCreerEtape)
	posterBanque(api, "reordonner-etapes-bancaires", "/api/v1/bank-case-stages/reorder", s.banqueReordonnerEtapes)
	huma.Patch(api, "/api/v1/bank-case-stages/{id}", s.banqueModifierEtape)
	posterBanque(api, "activer-etape-bancaire", "/api/v1/bank-case-stages/{id}/active", s.banqueActiverEtape)

	posterBanque(api, "creer-demande-client", "/api/v1/client-requests", s.banqueCreerDemande)
	huma.Get(api, "/api/v1/client-requests", s.banqueListerDemandes)
	huma.Get(api, "/api/v1/client-requests/{id}", s.banqueLireDemande)
	huma.Register(api, huma.Operation{
		OperationID: "approuver-demande-client", Method: http.MethodPost,
		Path: "/api/v1/client-requests/{id}/approve",
	}, s.banqueApprouverDemande)
	huma.Register(api, huma.Operation{
		OperationID: "refuser-demande-client", Method: http.MethodPost,
		Path: "/api/v1/client-requests/{id}/reject",
	}, s.banqueRefuserDemande)
}

func posterBanque[E, S any](api huma.API, id, chemin string, gestionnaire func(context.Context, *E) (*S, error)) {
	huma.Register(api, huma.Operation{
		OperationID: id, Method: http.MethodPost, Path: chemin, DefaultStatus: http.StatusCreated,
	}, gestionnaire)
}
