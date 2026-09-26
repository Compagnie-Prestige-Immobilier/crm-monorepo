package support

import (
	"bytes"
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	cheminTickets    = "/api/v1/support/tickets"
	cheminTicket     = cheminTickets + "/{id}"
	cheminReprendre  = cheminTicket + "/reprendre"
	cheminRattacher  = cheminTicket + "/rattacher"
	imagesMax        = 5
	imageMaxOctets   = 8 << 20
	fichiersMax      = 3
	fichierMaxOctets = 10 << 20
	signalementsVus  = 20
	diagnosticMaxLen = 500
)

var Garde = map[string]socle.Permission{
	"POST " + cheminTickets:                       socle.PermissionSupportSignaler,
	"GET " + cheminTickets:                        socle.PermissionSupportSignaler,
	"GET " + cheminTicket:                         socle.PermissionSupportSignaler,
	"POST " + cheminReprendre:                     socle.PermissionSupportSignaler,
	"POST " + cheminRattacher:                     socle.PermissionExploitationAdministrer,
	"GET /api/v1/support/categories":              socle.PermissionSupportSignaler,
	"GET " + cheminKairo:                          socle.PermissionExploitationAdministrer,
	"POST " + cheminKairoPause:                    socle.PermissionExploitationAdministrer,
	"POST " + cheminKairoReprise:                  socle.PermissionExploitationAdministrer,
	"POST " + cheminKairoRelance:                  socle.PermissionExploitationAdministrer,
	"POST " + cheminKairoReparationBaseActiver:    socle.PermissionExploitationAdministrer,
	"POST " + cheminKairoReparationBaseDesactiver: socle.PermissionExploitationAdministrer,
}

type service struct {
	*socle.Deps
	g glpi
}

func Monter(api huma.API, d *socle.Deps) {
	s := &service{d, lireGlpi()}
	huma.Register(api, huma.Operation{
		OperationID: "creerTicketSupport", Method: http.MethodPost, Path: cheminTickets,
		MaxBodyBytes:  40 << 20,
		DefaultStatus: http.StatusAccepted,
		Summary:       "Enregistre durablement un signalement ; GLPI est appelé après la réponse.",
	}, s.recevoir)
	huma.Register(api, huma.Operation{
		OperationID: "signalementsSupport", Method: http.MethodGet, Path: cheminTickets,
		Summary: "Les signalements de l'auteur, du plus récent au plus ancien.",
	}, s.lister)
	huma.Register(api, huma.Operation{
		OperationID: "signalementSupport", Method: http.MethodGet, Path: cheminTicket,
		Summary: "L'état d'un signalement et son numéro GLPI lorsqu'il est connu.",
	}, s.lire)
	huma.Register(api, huma.Operation{
		OperationID: "reprendreSignalementSupport", Method: http.MethodPost, Path: cheminReprendre,
		Summary: "Remet en attente un signalement en échec, sans recréer le ticket.",
	}, s.reprendre)
	huma.Register(api, huma.Operation{
		OperationID: "rattacherSignalementSupport", Method: http.MethodPost, Path: cheminRattacher,
		Summary: "Rattache un numéro GLPI vérifié, ou confirme l'absence de ticket distant.",
	}, s.rattacher)
	huma.Register(api, huma.Operation{
		OperationID: "categoriesSupport", Method: http.MethodGet, Path: "/api/v1/support/categories",
		Summary: "Les catégories GLPI proposées au demandeur.",
	}, s.categories)
	monterKairo(api, s)
}

func Taches(d *socle.Deps) []socle.Tache {
	s := &service{d, lireGlpi()}
	return []socle.Tache{
		{Nom: "cpi.support.transmission", Cron: socle.ChaqueMinute, Run: s.balayerSignalements},
		{Nom: "cpi.support.categories", Cron: "7 * * * *", Run: s.releverCategories},
	}
}

// Le planificateur appelle la tâche ; cette entrée sert aux vérifications qui
// doivent déclencher un balayage sans attendre la minute.
func Balayer(ctx context.Context, d *socle.Deps) error {
	return (&service{d, lireGlpi()}).balayerSignalements(ctx)
}

type TicketInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Cle         string          `form:"cle" required:"true" minLength:"8" maxLength:"64"`
		Description string          `form:"description" required:"true" minLength:"3" maxLength:"5000"`
		Contexte    string          `form:"contexte" required:"false" maxLength:"5000"`
		Images      []huma.FormFile `form:"images" required:"false" contentType:"image/png,image/jpeg,image/webp,image/gif"`
		Fichiers    []huma.FormFile `form:"fichiers" required:"false" contentType:"text/plain,application/json,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`
		Urgence     int32           `form:"urgence" required:"true" enum:"2,3,4"`
		Categorie   int32           `form:"categorie" required:"true" minimum:"1"`
	}]
}

type SignalementDTO struct {
	ID               string     `json:"id"`
	Etat             string     `json:"etat" enum:"en_attente,en_cours,reessai_planifie,a_verifier,echec,termine"`
	NumeroGlpi       *int32     `json:"numeroGlpi"`
	Description      string     `json:"description"`
	Auteur           string     `json:"auteur"`
	Images           int32      `json:"images"`
	ImagesTransmises int32      `json:"imagesTransmises"`
	Reprenable       bool       `json:"reprenable"`
	Erreur           *string    `json:"erreur"`
	CreeLe           time.Time  `json:"creeLe"`
	FiniLe           *time.Time `json:"finiLe"`
}

type SignalementOutput struct {
	Location string `header:"Location"`
	Body     SignalementDTO
}

type SignalementsOutput struct {
	Body []SignalementDTO
}

type CategorieDTO struct {
	ID  int    `json:"id"`
	Nom string `json:"nom"`
}

type CategoriesOutput struct {
	Body []CategorieDTO
}

// Ce que le signalant lit : le diagnostic GLPI reste en base et en journal.
var messagesErreur = map[string]string{
	codeInjoignable: "GLPI n'a pas répondu. La transmission reprend toute seule.",
	codeRefuse:      "GLPI a refusé le signalement. L'administrateur doit intervenir.",
	codeAVerifier:   "Le ticket est peut-être déjà créé chez GLPI. L'administrateur doit vérifier.",
	codeEpuise:      "La transmission a échoué après plusieurs tentatives.",
	codeNonRelie:    "Le support n'est pas encore relié à GLPI. Prévenez l'administrateur.",
}

// Le support non relié à GLPI n'est plus un refus : le signalement est conservé,
// la transmission échouera et l'administrateur la reprendra après correction.
func (s *service) recevoir(ctx context.Context, in *TicketInput) (*SignalementOutput, error) {
	form := in.RawBody.Data()
	if len(form.Images) > imagesMax {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_TROP_D_IMAGES", fmt.Sprintf("%d images au plus par signalement.", imagesMax))
	}
	if len(form.Fichiers) > fichiersMax {
		return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_TROP_DE_FICHIERS", fmt.Sprintf("%d fichiers au plus par signalement.", fichiersMax))
	}
	images, err := lireImages(form.Images)
	if err != nil {
		return nil, err
	}
	fichiers, err := lireFichiersJoints(form.Fichiers)
	if err != nil {
		return nil, err
	}
	images = append(images, fichiers...)
	u := socle.UtilisateurCourant(ctx)
	empreinte := empreinteSoumission(form.Description, form.Contexte, form.Urgence, form.Categorie, images)
	if deja, err := s.Q.SupportSignalementParCle(ctx, db.SupportSignalementParCleParams{AuteurId: u.ID, Cle: form.Cle}); err == nil {
		return s.reponseExistante(ctx, &deja, empreinte)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	identifiant, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	sig, err := s.enregistrer(ctx, identifiant.String(), form.Cle, empreinte, &u, form.Description, form.Contexte, form.Urgence, form.Categorie, images)
	var conflit *pgconn.PgError
	if errors.As(err, &conflit) && conflit.Code == "23505" {
		deja, relu := s.Q.SupportSignalementParCle(ctx, db.SupportSignalementParCleParams{AuteurId: u.ID, Cle: form.Cle})
		if relu != nil {
			return nil, relu
		}
		return s.reponseExistante(ctx, &deja, empreinte)
	}
	if err != nil {
		return nil, err
	}
	// Le cron reprend de toute façon : ce réveil ne sert qu'à ne pas attendre la minute.
	go s.transmettre(context.WithoutCancel(ctx), sig.ID)
	return &SignalementOutput{Location: cheminTickets + "/" + sig.ID, Body: SignalementDTO{
		ID: sig.ID, Etat: sig.Etat, Description: sig.Description, Auteur: u.FullName,
		Images: entier32(len(images)), CreeLe: sig.CreatedAt,
	}}, nil
}

func (s *service) reponseExistante(ctx context.Context, deja *db.SupportSignalement, empreinte string) (*SignalementOutput, error) {
	if deja.Empreinte != empreinte {
		return nil, socle.Problem(http.StatusConflict, "SUPPORT_CLE_REUTILISEE",
			"Cette clé de soumission porte déjà un autre signalement.")
	}
	lu, err := s.Q.SupportSignalement(ctx, deja.ID)
	if err != nil {
		return nil, err
	}
	return &SignalementOutput{Location: cheminTickets + "/" + lu.ID, Body: versDTO(&lu)}, nil
}

func (s *service) enregistrer(ctx context.Context, id, cle, empreinte string, u *socle.Utilisateur,
	description, contexte string, urgence, categorie int32, images []image,
) (db.SupportSignalement, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return db.SupportSignalement{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.Q.WithTx(tx)
	sig, err := q.InsertSupportSignalement(ctx, db.InsertSupportSignalementParams{
		ID: id, AuteurID: u.ID, Cle: cle, Empreinte: empreinte,
		Description: description, Contexte: contexte, Urgence: urgence, Categorie: categorie,
		AuteurLogin: u.Username, AuteurNom: u.FullName, AuteurEmail: u.Email,
		AuteurRoleLibelle: u.RoleLibelle, AuteurPilotage: u.Role == socle.Admin,
		AuteurGroupe: commercial(u.Role),
	})
	if err != nil {
		return db.SupportSignalement{}, err
	}
	for i := range images {
		if err := q.InsertSupportImage(ctx, db.InsertSupportImageParams{
			ID: uuid.NewString(), SignalementId: id, Position: entier32(i),
			Nom: images[i].nom, TypeMime: images[i].typeMime,
			Octets: entier32(len(images[i].contenu)), Empreinte: images[i].empreinte, Contenu: images[i].contenu,
		}); err != nil {
			return db.SupportSignalement{}, err
		}
	}
	return sig, tx.Commit(ctx)
}

type ListeInput struct {
	Tous bool `query:"tous"`
}

func (s *service) lister(ctx context.Context, in *ListeInput) (*SignalementsOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	if in.Tous && !u.Peut(socle.PermissionExploitationAdministrer) {
		return nil, socle.Problem(http.StatusForbidden, "FORBIDDEN", "Accès refusé.")
	}
	lignes, err := s.Q.SupportSignalements(ctx, db.SupportSignalementsParams{
		Tous: in.Tous, AuteurID: u.ID, Prendre: signalementsVus,
	})
	if err != nil {
		return nil, err
	}
	out := &SignalementsOutput{Body: make([]SignalementDTO, 0, len(lignes))}
	for i := range lignes {
		ligne := db.SupportSignalementRow(lignes[i])
		out.Body = append(out.Body, versDTO(&ligne))
	}
	return out, nil
}

type IDInput struct {
	ID string `path:"id" maxLength:"64"`
}

func (s *service) lire(ctx context.Context, in *IDInput) (*SignalementOutput, error) {
	lu, err := s.signalementDeLAuteur(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return &SignalementOutput{Location: cheminTickets + "/" + lu.ID, Body: versDTO(lu)}, nil
}

// Un signalement qui n'est pas le sien est introuvable : le refus ne dit pas
// qu'il existe, et n'en laisse rien filtrer.
func (s *service) signalementDeLAuteur(ctx context.Context, id string) (*db.SupportSignalementRow, error) {
	lu, err := s.Q.SupportSignalement(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Ce signalement est introuvable.")
	}
	if err != nil {
		return nil, err
	}
	u := socle.UtilisateurCourant(ctx)
	if lu.AuteurId != u.ID && !u.Peut(socle.PermissionExploitationAdministrer) {
		return nil, socle.Problem(http.StatusNotFound, "NOT_FOUND", "Ce signalement est introuvable.")
	}
	return &lu, nil
}

func (s *service) reprendre(ctx context.Context, in *IDInput) (*SignalementOutput, error) {
	lu, err := s.signalementDeLAuteur(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if lu.Etat != etatEchec {
		return nil, socle.Problem(http.StatusConflict, "SUPPORT_REPRISE_IMPOSSIBLE",
			"Ce signalement ne peut pas être repris en l'état.")
	}
	if _, err := s.Q.SupportRepris(ctx, db.SupportReprisParams{ID: in.ID, Now: time.Now()}); err != nil {
		return nil, err
	}
	go s.transmettre(context.WithoutCancel(ctx), in.ID)
	return s.lire(ctx, in)
}

type RattacherInput struct {
	ID   string `path:"id" maxLength:"64"`
	Body struct {
		NumeroGlpi *int32 `json:"numeroGlpi" minimum:"1" required:"false"`
		Absent     *bool  `json:"absent" required:"false"`
	}
}

// Quand la réconciliation automatique n'a rien pu établir, l'exploitation
// tranche : soit elle apporte le numéro qu'elle a vérifié dans GLPI, soit elle
// atteste l'absence de ticket et autorise une nouvelle création.
func (s *service) rattacher(ctx context.Context, in *RattacherInput) (*SignalementOutput, error) {
	suite := IDInput{ID: in.ID}
	lu, err := s.signalementDeLAuteur(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	maintenant := time.Now()
	absent := in.Body.Absent != nil && *in.Body.Absent
	switch {
	case in.Body.NumeroGlpi != nil && absent:
		return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_RATTACHEMENT_AMBIGU",
			"Indiquez un numéro GLPI ou l'absence de ticket, pas les deux.")
	case in.Body.NumeroGlpi != nil:
		_, err = s.Q.SupportNumeroRattache(ctx, db.SupportNumeroRattacheParams{ID: in.ID, Numero: *in.Body.NumeroGlpi, Now: maintenant})
	case absent:
		if lu.Etat != etatAVerifier {
			return nil, socle.Problem(http.StatusConflict, "SUPPORT_RATTACHEMENT_IMPOSSIBLE",
				"Seul un signalement à vérifier peut être déclaré sans ticket.")
		}
		_, err = s.Q.SupportCreationAbsenteConfirmee(ctx, db.SupportCreationAbsenteConfirmeeParams{ID: in.ID, Now: maintenant})
	default:
		return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_RATTACHEMENT_VIDE",
			"Indiquez le numéro GLPI vérifié ou l'absence de ticket.")
	}
	if err != nil {
		return nil, err
	}
	go s.transmettre(context.WithoutCancel(ctx), in.ID)
	return s.lire(ctx, &suite)
}

func (s *service) categories(ctx context.Context, _ *struct{}) (*CategoriesOutput, error) {
	catalogue, err := s.Q.SupportCategories(ctx)
	if err != nil {
		return nil, err
	}
	if len(catalogue) == 0 {
		if !s.g.configure() {
			return nil, nonConfigure()
		}
		if err := s.releverCategories(ctx); err != nil {
			return nil, glpiInjoignable(err)
		}
		if catalogue, err = s.Q.SupportCategories(ctx); err != nil {
			return nil, err
		}
	}
	out := &CategoriesOutput{Body: make([]CategorieDTO, 0, len(catalogue))}
	for i := range catalogue {
		out.Body = append(out.Body, CategorieDTO{ID: int(catalogue[i].ID), Nom: catalogue[i].Nom})
	}
	return out, nil
}

type image struct {
	nom       string
	typeMime  string
	empreinte string
	contenu   []byte
}

// Le type est établi par le CONTENU : un `Content-Type` déclaré ne prouve rien.
func lireImages(fichiers []huma.FormFile) ([]image, error) {
	images := make([]image, 0, len(fichiers))
	for i := range fichiers {
		if fichiers[i].Size > imageMaxOctets {
			return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_IMAGE_TROP_LOURDE",
				fmt.Sprintf("Chaque image doit peser moins de %d Mio.", imageMaxOctets>>20))
		}
		contenu, err := io.ReadAll(io.LimitReader(fichiers[i], imageMaxOctets+1))
		if err != nil {
			return nil, socle.Problem(http.StatusBadRequest, "SUPPORT_IMAGE_ILLISIBLE", "Une image n'a pas pu être lue.")
		}
		typeMime := http.DetectContentType(contenu)
		extension, connu := extensionsImages[typeMime]
		if !connu {
			return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_IMAGE_REFUSEE",
				"Seules les images PNG, JPEG, WebP et GIF sont acceptées.")
		}
		condensat := sha256.Sum256(contenu)
		images = append(images, image{
			nom:       fmt.Sprintf("image-%d%s", i+1, extension),
			typeMime:  typeMime,
			empreinte: hex.EncodeToString(condensat[:]),
			contenu:   contenu,
		})
	}
	return images, nil
}

// Extension déclarée requise pour lever l'ambiguïté d'un conteneur générique
// (ZIP pour le format Office moderne, OLE pour l'ancien) : la signature seule
// ne distingue pas un .docx d'un .xlsx.
var extensionsDocuments = map[string]string{
	".pdf":  "application/pdf",
	".doc":  "application/msword",
	".xls":  "application/vnd.ms-excel",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

var (
	signaturePDF = []byte("%PDF-")
	signatureZIP = []byte{'P', 'K', 0x03, 0x04}
	signatureOLE = []byte{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1}
)

func typeDocumentJoint(contenu []byte, nomDeclare string) (typeMime string, ok bool) {
	extension := strings.ToLower(filepath.Ext(nomDeclare))
	switch {
	case bytes.HasPrefix(contenu, signaturePDF) && extension == ".pdf":
		return extensionsDocuments[extension], true
	case bytes.HasPrefix(contenu, signatureZIP) && (extension == ".docx" || extension == ".xlsx"):
		return extensionsDocuments[extension], true
	case bytes.HasPrefix(contenu, signatureOLE) && (extension == ".doc" || extension == ".xls"):
		return extensionsDocuments[extension], true
	default:
		return "", false
	}
}

// Les journaux, fichiers texte et documents (PDF, Word, Excel) joints suivent
// le même chemin que les images (stockage, transmission GLPI) : seule la
// validation d'entrée change. Le contenu, jamais le Content-Type déclaré,
// décide du type ; l'extension ne sert qu'à lever l'ambiguïté d'un ZIP ou
// d'un OLE générique entre Word et Excel.
func lireFichiersJoints(fichiers []huma.FormFile) ([]image, error) {
	joints := make([]image, 0, len(fichiers))
	for i := range fichiers {
		if fichiers[i].Size > fichierMaxOctets {
			return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_FICHIER_TROP_LOURD",
				fmt.Sprintf("Chaque fichier doit peser moins de %d Mio.", fichierMaxOctets>>20))
		}
		contenu, err := io.ReadAll(io.LimitReader(fichiers[i], fichierMaxOctets+1))
		if err != nil {
			return nil, socle.Problem(http.StatusBadRequest, "SUPPORT_FICHIER_ILLISIBLE", "Un fichier n'a pas pu être lu.")
		}
		nom := filepath.Base(fichiers[i].Filename)
		typeMime := http.DetectContentType(contenu)
		switch {
		case strings.HasPrefix(typeMime, "text/"):
			typeMime = "text/plain"
			if nom == "" || nom == "." || nom == string(filepath.Separator) {
				nom = fmt.Sprintf("fichier-%d.txt", i+1)
			}
		default:
			detecte, connu := typeDocumentJoint(contenu, nom)
			if !connu {
				return nil, socle.Problem(http.StatusUnprocessableEntity, "SUPPORT_FICHIER_REFUSE",
					"Seuls les fichiers texte (journal, .txt, .json...), PDF, Word (.doc/.docx) et Excel (.xls/.xlsx) sont acceptés.")
			}
			typeMime = detecte
		}
		condensat := sha256.Sum256(contenu)
		joints = append(joints, image{
			nom:       nom,
			typeMime:  typeMime,
			empreinte: hex.EncodeToString(condensat[:]),
			contenu:   contenu,
		})
	}
	return joints, nil
}

// L'empreinte porte sur les champs et les images, jamais sur l'encodage
// multipart : deux envois identiques n'ont pas la même frontière MIME.
func empreinteSoumission(description, contexte string, urgence, categorie int32, images []image) string {
	h := sha256.New()
	_, _ = fmt.Fprintf(h, "%q|%q|%d|%d", description, contexte, urgence, categorie)
	for i := range images {
		_, _ = fmt.Fprintf(h, "|%s", images[i].empreinte)
	}
	return hex.EncodeToString(h.Sum(nil))
}

func versDTO(ligne *db.SupportSignalementRow) SignalementDTO {
	dto := SignalementDTO{
		ID: ligne.ID, Etat: ligne.Etat, NumeroGlpi: ligne.NumeroGlpi, Description: ligne.Description,
		Auteur: ligne.AuteurCompte, Images: ligne.Images, ImagesTransmises: ligne.ImagesTransmises,
		Reprenable: ligne.Etat == etatEchec, CreeLe: ligne.CreatedAt, FiniLe: ligne.FinAt,
	}
	if ligne.CodeErreur != nil {
		message := messagesErreur[*ligne.CodeErreur]
		if message == "" {
			message = "La transmission a échoué."
		}
		dto.Erreur = &message
	}
	return dto
}

// Les tailles manipulées ici tiennent largement dans un int32 ; la borne
// explicite évite une conversion silencieuse sur une entrée inattendue.
func entier32(n int) int32 {
	if n > math.MaxInt32 {
		return math.MaxInt32
	}
	if n < math.MinInt32 {
		return math.MinInt32
	}
	return int32(n)
}

func nonConfigure() error {
	return socle.Problem(http.StatusServiceUnavailable, "SUPPORT_NON_CONFIGURE", "Le support n'est pas encore relié à GLPI. Prévenez l'administrateur.")
}

func glpiInjoignable(err error) error {
	slog.Error("appel GLPI en échec", "err", err)
	return socle.Problem(http.StatusBadGateway, "SUPPORT_GLPI_INJOIGNABLE", "GLPI ne répond pas. Réessayez dans un instant.")
}
