package banque

import (
	"bytes"
	"context"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	neturl "net/url"
	"path"
	"strings"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	piecesTailleMax      = 64 << 20
	piecesDelaiLecture   = 60 * time.Second
	piecesTypeMimeZip    = "application/zip"
	piecesTypeMimeDefaut = "application/octet-stream"
	piecesMessageIndispo = "Les pièces de ce dossier ne sont pas disponibles sur la plateforme."
)

var clientPieces = &http.Client{Timeout: piecesDelaiLecture, Transport: transportPieces()}

// L'URL d'une pièce vient de la plateforme : elle ne doit pas atteindre le réseau interne.
func transportPieces() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = (&net.Dialer{Timeout: piecesDelaiLecture, Control: adressePublique}).DialContext
	return transport
}

func adressePublique(_, adresse string, _ syscall.RawConn) error {
	hote, _, err := net.SplitHostPort(adresse)
	if err != nil {
		return err
	}
	ip := net.ParseIP(hote)
	if ip == nil || !ip.IsGlobalUnicast() || ip.IsPrivate() {
		return fmt.Errorf("pièce plateforme : adresse %s refusée", hote)
	}
	return nil
}

type PieceDeposee struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Type   string `json:"type"`
	Taille string `json:"taille"`
	Statut string `json:"statut"`
}

type piecesInput struct {
	ID string `path:"id"`
}

type pieceInput struct {
	ID   string `path:"id"`
	Code string `query:"code"`
}

type PiecesOutput struct {
	Body struct {
		Pieces []PieceDeposee `json:"pieces"`
	}
}

func piecesIndisponibles(raison string) error {
	slog.Warn("pièces de plateforme indisponibles", "raison", raison)
	return huma.Error404NotFound(piecesMessageIndispo)
}

// Où lire les pièces d'une inscription. L'inscription, et non le dossier
// bancaire : la banque doit pouvoir lire les justificatifs pour décider
// d'ouvrir, pas seulement après avoir ouvert.
type sourceDesPieces struct {
	projet  string
	base    string
	jeton   string
	distant string
	charge  []byte
}

func (s *sourceDesPieces) grandPublic() bool { return s.projet == socle.ProjetGrandPublic }

func (s *service) sourcePieces(ctx context.Context, id string) (sourceDesPieces, error) {
	ligne, err := s.Q.BankInscriptionPourPieces(ctx, id)
	if err != nil {
		return sourceDesPieces{}, piecesIndisponibles("inscription de plateforme inconnue")
	}
	projet := string(ligne.Projet)
	base, jeton := socle.PlateformeConfiguree(projet)
	if base == "" || jeton == "" {
		return sourceDesPieces{}, piecesIndisponibles("plateforme " + projet + " non configurée")
	}
	return sourceDesPieces{
		projet: projet, base: base, jeton: jeton,
		distant: ligne.IdentifiantDistant, charge: ligne.ChargeUtile,
	}, nil
}

func (s *service) listerPieces(ctx context.Context, in *piecesInput) (*PiecesOutput, error) {
	source, err := s.sourcePieces(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	pieces, err := inventaire(ctx, &source)
	if err != nil {
		return nil, piecesIndisponibles(err.Error())
	}
	out := &PiecesOutput{}
	out.Body.Pieces = pieces
	return out, nil
}

func inventaire(ctx context.Context, source *sourceDesPieces) ([]PieceDeposee, error) {
	if source.grandPublic() {
		docs, err := docsGrandPublic(ctx, source.base, source.jeton, source.distant)
		if err != nil {
			return nil, err
		}
		return piecesDuGrandPublic(docs), nil
	}
	archive, err := archiveChues(ctx, source.base, source.jeton, source.charge)
	if err != nil {
		return nil, err
	}
	return piecesDeLArchive(archive)
}

// Une pièce se rend telle quelle, avec son type : le panneau l'affiche dans sa
// visionneuse plutôt que de la faire enregistrer pour être lue.
func (s *service) lirePiece(ctx context.Context, in *pieceInput) (*huma.StreamResponse, error) {
	source, err := s.sourcePieces(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if source.grandPublic() {
		return pieceDuGrandPublic(ctx, &source, in.Code)
	}
	return pieceDeLArchive(ctx, &source, in.Code)
}

func (s *service) archiveDesPieces(ctx context.Context, in *piecesInput) (*huma.StreamResponse, error) {
	source, err := s.sourcePieces(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	corps, err := toutesLesPieces(ctx, &source)
	if err != nil {
		return nil, piecesIndisponibles(err.Error())
	}
	nom := "pieces-" + strings.ToLower(source.distant) + ".zip"
	return reponseFichier(corps, nom, piecesTypeMimeZip, true), nil
}

func toutesLesPieces(ctx context.Context, source *sourceDesPieces) (io.ReadCloser, error) {
	if !source.grandPublic() {
		paquet, err := archiveChues(ctx, source.base, source.jeton, source.charge)
		if err != nil {
			return nil, err
		}
		return io.NopCloser(bytes.NewReader(paquet)), nil
	}
	docs, err := docsGrandPublic(ctx, source.base, source.jeton, source.distant)
	if err != nil {
		return nil, err
	}
	paquet, err := empaqueter(ctx, docs)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(paquet)), nil
}

func monterPieces(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "bank-inscription-pieces", Method: http.MethodGet,
		Path: "/api/v1/bank-inscriptions/{id}/pieces",
	}, s.listerPieces)
	huma.Register(api, huma.Operation{
		OperationID: "bank-inscription-piece", Method: http.MethodGet,
		Path: "/api/v1/bank-inscriptions/{id}/piece",
	}, s.lirePiece)
	huma.Register(api, huma.Operation{
		OperationID: "bank-inscription-pieces-zip", Method: http.MethodGet,
		Path: "/api/v1/bank-inscriptions/{id}/pieces.zip",
	}, s.archiveDesPieces)
}

func reponseFichier(corps io.ReadCloser, nom, typeMime string, telecharger bool) *huma.StreamResponse {
	disposition := "inline"
	if telecharger || typeMime == piecesTypeMimeDefaut {
		disposition = "attachment"
	}
	return &huma.StreamResponse{Body: func(ctx huma.Context) {
		defer func() { _ = corps.Close() }()
		ctx.SetHeader("Content-Type", typeMime)
		ctx.SetHeader("Content-Disposition", disposition+`; filename="`+strings.ReplaceAll(nom, `"`, "")+`"`)
		ctx.SetHeader("Cache-Control", "no-store")
		ecrits, err := io.Copy(ctx.BodyWriter(), io.LimitReader(corps, piecesTailleMax))
		if err != nil {
			slog.Error("écriture d’une pièce", "fichier", nom, "err", err)
		} else if ecrits == piecesTailleMax {
			slog.Error("pièce tronquée à la taille maximale", "fichier", nom)
		}
	}}
}

// Une URL signée n'accepte pas l'en-tête d'autorisation : un jeton vide la laisse passer.
func ouvrirPlateforme(ctx context.Context, brute, jeton string) (corps io.ReadCloser, typeMime string, err error) {
	url, err := neturl.Parse(brute)
	if err != nil || url.Scheme != "https" {
		return nil, "", errors.New("pièce plateforme : URL refusée")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url.String(), http.NoBody)
	if err != nil {
		return nil, "", err
	}
	if jeton != "" {
		req.Header.Set("Authorization", "Bearer "+jeton)
	}
	resp, err := clientPieces.Do(req)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, "", fmt.Errorf("plateforme %d sur %s", resp.StatusCode, url.Host+url.Path)
	}
	if resp.ContentLength > piecesTailleMax {
		_ = resp.Body.Close()
		return nil, "", errPieceTropLourde
	}
	return resp.Body, resp.Header.Get("Content-Type"), nil
}

var errPieceTropLourde = fmt.Errorf("pièce plateforme : plus de %d Mo", piecesTailleMax>>20)

func lirePlateformeBrut(ctx context.Context, url, jeton string) (lu []byte, typeMime string, err error) {
	corps, typeMime, err := ouvrirPlateforme(ctx, url, jeton)
	if err != nil {
		return nil, "", err
	}
	defer func() { _ = corps.Close() }()
	lu, err = io.ReadAll(io.LimitReader(corps, piecesTailleMax+1))
	if err == nil && len(lu) > piecesTailleMax {
		return nil, "", errPieceTropLourde
	}
	return lu, typeMime, err
}

// La plateforme est une source distante : réémettre son `Content-Type` tel quel
// afficherait un `text/html` qu'elle rendrait dans l'origine du panneau. Seuls
// les types que la visionneuse sait afficher passent, le reste est téléchargé.
var typesPieceAffichables = map[string]bool{
	"application/pdf": true, "image/jpeg": true, "image/png": true, "image/webp": true,
}

// Le type rendu par la plateforme fait foi ; à défaut, l'extension le dit.
func typeDeContenu(entete string) string {
	propre := strings.TrimSpace(strings.Split(entete, ";")[0])
	if propre == "" || !typesPieceAffichables[strings.ToLower(propre)] {
		return piecesTypeMimeDefaut
	}
	return propre
}

func typeDeNom(nom string) string {
	if trouve := mime.TypeByExtension(path.Ext(nom)); trouve != "" {
		return typeDeContenu(trouve)
	}
	return piecesTypeMimeDefaut
}

func extensionDe(entete string) string {
	extensions, err := mime.ExtensionsByType(typeDeContenu(entete))
	if err != nil || len(extensions) == 0 {
		return ".bin"
	}
	return extensions[0]
}

// La plateforme Grand Public rend déjà une taille en toutes lettres ; pour une
// entrée d'archive, on la compose de la même façon.
func tailleLisible(octets uint64) string {
	switch {
	case octets == 0:
		return ""
	case octets < 1024:
		return fmt.Sprintf("%d o", octets)
	case octets < 1024*1024:
		return fmt.Sprintf("%.0f ko", float64(octets)/1024)
	default:
		return fmt.Sprintf("%.1f Mo", float64(octets)/(1024*1024))
	}
}
