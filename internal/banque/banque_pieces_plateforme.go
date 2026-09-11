package banque

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"path"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

// Ce que Grand Public rend pour une pièce : une URL signée de courte durée,
// jamais un chemin de stockage.
type pieceDistante struct {
	DocID   string  `json:"docId"`
	Label   string  `json:"label"`
	Status  string  `json:"status"`
	Taille  *string `json:"taille"`
	FileURL string  `json:"fileUrl"`
}

func docsGrandPublic(ctx context.Context, base, jeton, clientID string) ([]pieceDistante, error) {
	corps, _, err := lirePlateformeBrut(ctx, base+"/staff/clients/"+clientID+"/docs", jeton)
	if err != nil {
		return nil, err
	}
	var reponse struct {
		Data []pieceDistante `json:"data"`
	}
	if json.Unmarshal(corps, &reponse) != nil {
		return nil, errors.New("liste de pièces illisible")
	}
	return reponse.Data, nil
}

func piecesDuGrandPublic(docs []pieceDistante) []PieceDeposee {
	pieces := make([]PieceDeposee, 0, len(docs))
	for _, doc := range docs {
		if doc.FileURL == "" {
			continue
		}
		taille := ""
		if doc.Taille != nil {
			taille = *doc.Taille
		}
		pieces = append(pieces, PieceDeposee{
			Code: doc.DocID, Label: doc.Label, Type: piecesTypeMimeDefaut,
			Taille: taille, Statut: doc.Status,
		})
	}
	return pieces
}

func pieceDuGrandPublic(ctx context.Context, source *sourceDesPieces, code string) (*huma.StreamResponse, error) {
	docs, err := docsGrandPublic(ctx, source.base, source.jeton, source.distant)
	if err != nil {
		return nil, piecesIndisponibles(err.Error())
	}
	for _, doc := range docs {
		if doc.DocID != code || doc.FileURL == "" {
			continue
		}
		corps, typeMime, errLecture := lirePlateformeBrut(ctx, doc.FileURL, "")
		if errLecture != nil {
			return nil, piecesIndisponibles(errLecture.Error())
		}
		nom := nomDePiece(doc.Label, doc.DocID) + extensionDe(typeMime)
		return reponseFichier(corps, nom, typeDeContenu(typeMime), false), nil
	}
	return nil, piecesIndisponibles("pièce inconnue")
}

// CHUES refuse le téléchargement pièce par pièce au compte machine, mais lui
// ouvre l'archive du dossier : on l'ouvre ici plutôt que de demander un droit
// de plus à la plateforme.
func archiveChues(ctx context.Context, base, jeton string, charge []byte) ([]byte, error) {
	var distant struct {
		Dossier *struct {
			ID json.Number `json:"id"`
		} `json:"dossier"`
	}
	if json.Unmarshal(charge, &distant) != nil || distant.Dossier == nil {
		return nil, errors.New("aucun dossier ouvert sur la plateforme CHUES")
	}
	corps, _, err := lirePlateformeBrut(ctx, base+"/dossiers/"+distant.Dossier.ID.String()+"/archive", jeton)
	return corps, err
}

func piecesDeLArchive(archive []byte) ([]PieceDeposee, error) {
	lecteur, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, errors.New("archive de la plateforme illisible")
	}
	pieces := make([]PieceDeposee, 0, len(lecteur.File))
	for _, entree := range lecteur.File {
		if entree.FileInfo().IsDir() {
			continue
		}
		pieces = append(pieces, PieceDeposee{
			Code:   entree.Name,
			Label:  strings.TrimSuffix(path.Base(entree.Name), path.Ext(entree.Name)),
			Type:   typeDeNom(entree.Name),
			Taille: tailleLisible(entree.UncompressedSize64),
		})
	}
	return pieces, nil
}

func pieceDeLArchive(ctx context.Context, source *sourceDesPieces, code string) (*huma.StreamResponse, error) {
	archive, err := archiveChues(ctx, source.base, source.jeton, source.charge)
	if err != nil {
		return nil, piecesIndisponibles(err.Error())
	}
	lecteur, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, piecesIndisponibles("archive de la plateforme illisible")
	}
	for _, entree := range lecteur.File {
		if entree.Name != code {
			continue
		}
		corps, errLecture := contenuDeLEntree(entree)
		if errLecture != nil {
			return nil, piecesIndisponibles(errLecture.Error())
		}
		return reponseFichier(corps, path.Base(entree.Name), typeDeNom(entree.Name), false), nil
	}
	return nil, piecesIndisponibles("pièce inconnue")
}

func contenuDeLEntree(entree *zip.File) ([]byte, error) {
	ouvert, err := entree.Open()
	if err != nil {
		return nil, err
	}
	defer func() { _ = ouvert.Close() }()
	return io.ReadAll(io.LimitReader(ouvert, piecesTailleMax))
}

func empaqueter(ctx context.Context, docs []pieceDistante) ([]byte, error) {
	var tampon bytes.Buffer
	zipper := zip.NewWriter(&tampon)
	ajoutees := 0
	for _, doc := range docs {
		if doc.FileURL == "" {
			continue
		}
		contenu, typeMime, err := lirePlateformeBrut(ctx, doc.FileURL, "")
		if err != nil {
			slog.Warn("pièce non téléchargée", "docId", doc.DocID, "err", err)
			continue
		}
		fichier, err := zipper.Create(nomDePiece(doc.Label, doc.DocID) + extensionDe(typeMime))
		if err != nil {
			return nil, err
		}
		if _, err := fichier.Write(contenu); err != nil {
			return nil, err
		}
		ajoutees++
	}
	if err := zipper.Close(); err != nil {
		return nil, err
	}
	if ajoutees == 0 {
		return nil, errors.New("aucune pièce déposée")
	}
	return tampon.Bytes(), nil
}

func nomDePiece(label, code string) string {
	nom := strings.TrimSpace(label)
	if nom == "" {
		nom = code
	}
	return strings.NewReplacer("/", "-", `\`, "-", `"`, "").Replace(nom)
}
