package banque

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/notifications"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	objetDossier     = "bank_case"
	objetInscription = "inscription"
	formatDateMail   = "02/01/2006 à 15:04"
)

type InscriptionAOuvrir struct {
	ID                 string     `json:"id"`
	Projet             string     `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
	IdentifiantDistant string     `json:"identifiantDistant"`
	Nom                string     `json:"nom"`
	Prenom             string     `json:"prenom"`
	PhoneE164          *string    `json:"phoneE164"`
	Email              *string    `json:"email"`
	StatutDistant      string     `json:"statutDistant"`
	SoumiseLe          *time.Time `json:"soumiseLe"`
	DecideeLe          *time.Time `json:"decideeLe"`
	ProspectID         *string    `json:"prospectId"`
	BanqueID           *string    `json:"banqueId"`
	BanqueName         *string    `json:"banqueName"`
	SuiviParName       *string    `json:"suiviParName"`
}

type InscriptionsAOuvrirInput struct {
	Projet string `query:"projet" enum:"CHUES,GRAND_PUBLIC" required:"true"`
}

type InscriptionsAOuvrirOutput struct {
	Body struct {
		Items   []InscriptionAOuvrir `json:"items"`
		Tronque bool                 `json:"tronque" doc:"Plus de 2000 inscriptions à ouvrir : seules les plus récentes sont listées."`
	}
}

const inscriptionsCompletesMax = 2000

// Une ligne de plus que le plafond : sa présence dit que la liste est tronquée.
func (s *service) inscriptionsCompletes(ctx context.Context, projet string, aSignaler bool, id *string) ([]db.BankInscriptionsCompletesRow, error) {
	statuts, err := socle.StatutsDossierComplet(ctx, s.Q, projet)
	if err != nil {
		return nil, err
	}
	return s.Q.BankInscriptionsCompletes(ctx, db.BankInscriptionsCompletesParams{
		Projet: db.Projet(projet), Statuts: statuts, ASignaler: aSignaler, ID: id, Prendre: inscriptionsCompletesMax + 1,
	})
}

func (s *service) inscriptionsAOuvrir(ctx context.Context, in *InscriptionsAOuvrirInput) (*InscriptionsAOuvrirOutput, error) {
	lignes, err := s.inscriptionsCompletes(ctx, in.Projet, false, nil)
	if err != nil {
		return nil, err
	}
	out := &InscriptionsAOuvrirOutput{}
	if len(lignes) > inscriptionsCompletesMax {
		lignes, out.Body.Tronque = lignes[:inscriptionsCompletesMax], true
	}
	out.Body.Items = make([]InscriptionAOuvrir, 0, len(lignes))
	for i := range lignes {
		r := &lignes[i]
		out.Body.Items = append(out.Body.Items, InscriptionAOuvrir{
			ID: r.ID, Projet: string(r.Projet), IdentifiantDistant: r.IdentifiantDistant, Nom: r.Nom, Prenom: r.Prenom,
			PhoneE164: r.PhoneE164, Email: r.Email, StatutDistant: r.StatutDistant, SoumiseLe: r.SoumiseLe, DecideeLe: r.DecideeLe,
			ProspectID: r.ProspectId, BanqueID: r.BanqueId, BanqueName: r.BanqueName, SuiviParName: r.SuiviParName,
		})
	}
	return out, nil
}

type CreationDossierInput struct {
	Body struct {
		InscriptionID    string  `json:"inscriptionId" format:"uuid"`
		ProcessingBankID *string `json:"processingBankId,omitempty" format:"uuid"`
	}
}

// Un dossier ne s'ouvre que depuis une inscription validée sur la plateforme et
// rapprochée d'un prospect : la référence est générée, jamais saisie.
func (s *service) inscriptionOuvrable(ctx context.Context, id string) (db.BankInscriptionPourDossierRow, error) {
	insc, err := s.Q.BankInscriptionPourDossier(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return insc, socle.Problem(http.StatusNotFound, "BANK_CASE_INSCRIPTION_NOT_FOUND", "Inscription plateforme introuvable.")
	}
	if err != nil {
		return insc, err
	}
	if existant, err := s.Q.BankCaseParInscription(ctx, &insc.ID); err == nil {
		return insc, problemBanque(http.StatusConflict, "BANK_CASE_INSCRIPTION_ALREADY_OPEN",
			"Un dossier bancaire existe déjà pour cette inscription.", map[string]any{"bankCaseId": existant})
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return insc, err
	}
	completes, err := s.inscriptionsCompletes(ctx, string(insc.Projet), false, &insc.ID)
	if err != nil {
		return insc, err
	}
	if len(completes) == 0 {
		return insc, socle.Problem(http.StatusUnprocessableEntity, "BANK_CASE_INSCRIPTION_INCOMPLETE",
			"Le dossier n’est pas encore validé sur la plateforme : statut « "+insc.StatutDistant+" ».")
	}
	return insc, nil
}

// Sans fiche rapprochée, le dossier porte l'identité de l'inscription : les
// plateformes suivent seules leurs inscrits, le CRM n'a plus de fiche à opposer.
func (s *service) prospectDuDossier(ctx context.Context, insc *db.BankInscriptionPourDossierRow) (db.BankCaseProspectRow, error) {
	identite := db.BankCaseProspectRow{Nom: insc.Nom, Prenom: insc.Prenom, PhoneE164: insc.PhoneE164}
	if insc.ProspectId == nil {
		return identite, nil
	}
	prospect, err := s.Q.BankCaseProspect(ctx, *insc.ProspectId)
	if errors.Is(err, pgx.ErrNoRows) {
		return identite, nil
	}
	return prospect, err
}

func (s *service) creerDossier(ctx context.Context, in *CreationDossierInput) (*DossierOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	insc, err := s.inscriptionOuvrable(ctx, in.Body.InscriptionID)
	if err != nil {
		return nil, err
	}
	prospect, err := s.prospectDuDossier(ctx, &insc)
	if err != nil {
		return nil, err
	}
	banqueID, err := s.banqueTraitement(ctx, prospect.BanqueId, in.Body.ProcessingBankID)
	if err != nil {
		return nil, err
	}
	initiale, err := s.etapeInitiale(ctx)
	if err != nil {
		return nil, err
	}
	reference, err := s.referenceSuivante(ctx, insc.Projet)
	if err != nil {
		return nil, err
	}
	id, err := s.ecrireDossier(ctx, u.ID, banqueID, initiale, &prospect, reference, &insc.ID)
	if err != nil {
		return nil, err
	}
	ref, err := s.chargerReferentielBanque(ctx)
	if err != nil {
		return nil, err
	}
	dossier, err := s.dossier(ctx, id, "", ref)
	return &DossierOutput{Body: dossier}, err
}

var prefixeReference = map[db.Projet]string{db.ProjetCHUES: "CHUES", db.ProjetGRANDPUBLIC: "GP"}

func (s *service) referenceSuivante(ctx context.Context, projet db.Projet) (string, error) {
	annee := time.Now().In(s.Cfg.TimeZone).Year()
	n, err := s.Q.BankReferenceSuivante(ctx, db.BankReferenceSuivanteParams{Projet: projet, Annee: int64(annee)})
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-BF-%d-%06d", prefixeReference[projet], annee, n), nil
}

func coqueDe(projet string) string {
	if projet == socle.ProjetGrandPublic {
		return "grand-public"
	}
	return "chues"
}

func libelleProjet(projet string) string {
	if projet == socle.ProjetGrandPublic {
		return "CPI GRAND PUBLIC"
	}
	return "CPI CHUES"
}

func texteOuTiret(v *string) string {
	if v == nil || strings.TrimSpace(*v) == "" {
		return "non renseigné"
	}
	return *v
}

// Marquée avant d'être signalée, pour qu'une panne ne la resignale pas. Le courriel
// part de la plateforme : ici, seule la notification in-app.
func SignalerDossiersComplets(ctx context.Context, d *socle.Deps, projet string) (int, error) {
	s := &service{d}
	lignes, err := s.inscriptionsCompletes(ctx, projet, true, nil)
	if err != nil || len(lignes) == 0 {
		return 0, err
	}
	maintenant := time.Now()
	for i := range lignes {
		r := &lignes[i]
		if err := s.Q.BankInscriptionSignalee(ctx, db.BankInscriptionSignaleeParams{ID: r.ID, CompleteSignaleeLe: &maintenant}); err != nil {
			return i, err
		}
		s.notifierComplet(ctx, r)
	}
	return len(lignes), nil
}

func (s *service) notifierComplet(ctx context.Context, r *db.BankInscriptionsCompletesRow) {
	client := strings.TrimSpace(r.Prenom + " " + r.Nom)
	chemin := "/" + coqueDe(string(r.Projet)) + "/dossiers?ouvrir=" + r.ID
	_, err := notifications.Composer(ctx, s.Deps, "", &notifications.CreationNotification{
		Title: "Dossier complet sur la plateforme", Category: "DOSSIER", Route: chemin,
		Body:     client + ", banque " + texteOuTiret(r.BanqueName) + ". Le dossier bancaire peut être ouvert.",
		Audience: "ROLE", AudienceRole: string(socle.BanqueFinance),
	})
	if err != nil {
		slog.Warn("dossier complet : notification in-app non créée", "inscription", r.ID, "err", err)
	}
}

// Encaissement ou rejet : courriel aux adresses réglées côté admin, et
// notification au téléconseiller qui a suivi le prospect.
func (s *service) signalerIssue(ctx context.Context, id, typeEtape string) {
	r, err := s.Q.BankCaseSuivi(ctx, id)
	if err != nil {
		slog.Error("issue du dossier : lecture impossible", "dossier", id, "err", err)
		return
	}
	reglages, err := notifications.LireReglagesCourriels(ctx, s.Deps)
	if err != nil {
		slog.Error("issue du dossier : réglages illisibles", "dossier", id, "err", err)
		return
	}
	issue, typeCourriel, detail := "encaissé", notifications.CourrielDossierEncaisse, "Montant encaissé"
	reglage, aide := &reglages.Encaissement, notifications.AideEncaissement()
	valeur := texteOuTiret(banqueMontantChaine(r.AmountXof)) + " XOF"
	valeurs := map[string]string{
		notifications.VariableReference: r.Reference, notifications.VariableClient: r.CustomerName,
		notifications.VariableBanque: r.BanqueName, notifications.VariableTeleconseiller: texteOuTiret(r.SuiviParName),
		notifications.VariableProjet: libelleProjet(r.Projet), "montant": valeur, "motif": "",
	}
	if typeEtape == banqueEtapeRejetee {
		issue, typeCourriel, detail = "rejeté", notifications.CourrielDossierRejete, "Motif du rejet"
		reglage, aide = &reglages.Refus, notifications.AideRefus()
		valeur = texteOuTiret(r.RejectionLabel)
		if r.RejectionDetail != nil {
			valeur += " : " + *r.RejectionDetail
		}
		valeurs["motif"] = valeur
	}
	chemin := "/" + coqueDe(r.Projet) + "/dossiers/" + r.ID
	if r.SuiviParId != nil {
		if _, err := notifications.Composer(ctx, s.Deps, "", &notifications.CreationNotification{
			Title: "Dossier bancaire " + issue + " : " + r.CustomerName, Category: "DOSSIER", Route: chemin,
			Body:     r.Reference + ", " + r.BanqueName + ". " + detail + " : " + valeur + ".",
			Audience: "USERS", AudienceUserIDs: []string{*r.SuiviParId},
		}); err != nil {
			slog.Warn("issue du dossier : notification in-app non créée", "dossier", id, "err", err)
		}
	}
	err = notifications.EnvoyerCourriel(ctx, s.Deps, &notifications.Courriel{
		Type:          typeCourriel,
		Sujet:         "[" + libelleProjet(r.Projet) + "] Dossier bancaire " + issue + " : " + r.Reference,
		Destinataires: reglage.Destinataires, Copies: reglage.Copies,
		ObjetType: objetDossier, ObjetID: r.ID,
		Titre: "Dossier bancaire " + issue,
		Intro: notifications.IntroCourriel(reglage, aide, valeurs),
		Lignes: [][2]string{
			{"Référence", r.Reference},
			{"Client", r.CustomerName},
			{"Téléphone", r.CustomerPhoneE164},
			{"Banque", r.BanqueName},
			{"Étape", r.StageLabel},
			{detail, valeur},
			{"Ouvert le", r.CreatedAt.In(s.Cfg.TimeZone).Format(formatDateMail)},
			{"Délai", fmt.Sprintf("%d jour(s)", int(time.Since(r.CreatedAt).Hours()/24))},
			{"Téléconseiller", texteOuTiret(r.SuiviParName)},
		},
		Lien: socle.Env("PUBLIC_WEB_URL", "") + chemin, LibelleLien: "Voir le dossier dans CPI GO",
		NomPieceJointe: "dossier-" + strings.ToLower(r.Reference) + ".pdf",
	})
	if err != nil {
		slog.Error("issue du dossier : courriel non tracé", "dossier", id, "err", err)
	}
}
