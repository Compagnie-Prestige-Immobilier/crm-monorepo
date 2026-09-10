package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
)

const (
	maxApercusImport = 50
	// Une requête synchrone doit rendre : au-delà, le classeur passe par le
	// travail d'import, qui reprend où il s'est arrêté.
	plafondLignesRapportImport = 5_000
)

type RapportRepresentantsInput struct {
	DryRun   bool `query:"dryRun" default:"true"`
	Enrichir bool `query:"enrichir" default:"false"`
	RawBody  huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file"`
	}]
}

type ErreurRapportImport struct {
	Line    int     `json:"line"`
	Code    string  `json:"code"`
	Message string  `json:"message"`
	Value   *string `json:"value"`
}

type ApercuRapportImport struct {
	Line            int     `json:"line"`
	FullName        string  `json:"fullName"`
	PhoneE164       string  `json:"phoneE164"`
	DepartementName string  `json:"departementName"`
	IefName         *string `json:"iefName"`
	Notes           *string `json:"notes"`
	Etablissement   *string `json:"etablissement"`
	RelationStatus  string  `json:"relationStatus" enum:"INCONNU,CONTACTE,AMBASSADEUR,REFUS"`
	WhatsappStatus  string  `json:"whatsappStatus" enum:"NON_DEMANDE,MEME_NUMERO,AUTRE_NUMERO,AUCUN"`
	CalledAt        *string `json:"calledAt"`
}

type RapportRepresentantsOutput struct {
	Body struct {
		DryRun     bool                  `json:"dryRun"`
		TotalRows  int                   `json:"totalRows"`
		Valid      int                   `json:"valid"`
		Enrichable int                   `json:"enrichable"`
		Enriched   int                   `json:"enriched"`
		Rejected   int                   `json:"rejected"`
		Duplicates int                   `json:"duplicates"`
		Created    int                   `json:"created"`
		Errors     []ErreurRapportImport `json:"errors"`
		Preview    []ApercuRapportImport `json:"preview"`
	}
}

// Le classeur est relu et validé par le MÊME adaptateur que le travail d'import :
// une seconde lecture finirait par accepter des lignes que l'autre refuse.
func (s *service) rapporterImportRepresentants(ctx context.Context, in *RapportRepresentantsInput) (*RapportRepresentantsOutput, error) {
	fichier := in.RawBody.Data().File
	if !fichier.IsSet {
		return nil, socle.Problem(http.StatusBadRequest, "IMPORT_FILE_MISSING", "Aucun fichier reçu. Envoyez le classeur dans un champ `file`.")
	}
	defer func() { _ = fichier.Close() }()
	dossier, err := os.MkdirTemp("", "cpi-import-")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(dossier) }()
	chemin := filepath.Join(dossier, "classeur.xlsx")
	if _, err := ecrireClasseurImport(chemin, fichier, reglagesImports().maxOctets); err != nil {
		return nil, err
	}
	lecture, err := s.lireClasseurRepresentants(ctx, chemin)
	if err != nil {
		return nil, err
	}
	bilan, err := s.ecrireRapportRepresentants(ctx, lecture, !in.DryRun)
	if err != nil {
		return nil, err
	}
	return rapportRepresentants(in.DryRun, lecture, bilan), nil
}

type lectureRepresentantsImport struct {
	etat       *etatRepresentantsImport
	contexte   contexteImport
	lignes     []any
	erreurs    []erreurLigneImport
	vues       int
	adaptateur adaptateurImport
}

func (s *service) lireClasseurRepresentants(ctx context.Context, chemin string) (*lectureRepresentantsImport, error) {
	adaptateur := adaptateursImport[db.ImportKindREPRESENTANTS]
	classeur, err := ouvrirClasseurImport(chemin, adaptateur)
	if err != nil {
		return nil, problemeClasseurImport(err)
	}
	defer func() { _ = classeur.fermer() }()
	if classeur.declarees != nil && int(*classeur.declarees) > plafondLignesRapportImport {
		return nil, problemePlafondImport()
	}
	lecture := &lectureRepresentantsImport{
		adaptateur: adaptateur,
		contexte: contexteImport{
			demandeur: socle.UtilisateurCourant(ctx).ID, region: s.Cfg.PhoneRegion,
		},
	}
	brut, err := adaptateur.preparer(ctx, s.Q, lecture.contexte)
	if err != nil {
		return nil, err
	}
	lecture.etat = brut.(*etatRepresentantsImport)
	err = classeur.parcourir(func(numero int, cellules map[string]string) error {
		lecture.vues++
		if lecture.vues > plafondLignesRapportImport {
			return problemePlafondImport()
		}
		valeur, refus := adaptateur.lire(cellules, numero, lecture.etat)
		if refus != nil {
			lecture.erreurs = append(lecture.erreurs, *refus)
			return nil
		}
		lecture.lignes = append(lecture.lignes, valeur)
		return nil
	})
	if err != nil {
		return nil, problemeClasseurImport(err)
	}
	return lecture, nil
}

func problemePlafondImport() error {
	return socle.Problem(http.StatusBadRequest, "IMPORT_TOO_MANY_ROWS",
		fmt.Sprintf("Le fichier dépasse le plafond de %d lignes. Découpez-le, ou passez par un travail d’import.", plafondLignesRapportImport))
}

func problemeClasseurImport(err error) error {
	var illisible classeurImportError
	if errors.As(err, &illisible) {
		return socle.Problem(http.StatusBadRequest, "IMPORT_FILE_UNREADABLE", illisible.motif)
	}
	return err
}

// Tout ou rien : les lignes retenues partent dans UNE transaction, par tranches
// de la même taille que le travail d'import.
func (s *service) ecrireRapportRepresentants(ctx context.Context, lecture *lectureRepresentantsImport, appliquer bool) (bilanTrancheImport, error) {
	lecture.contexte.appliquer = appliquer
	if !appliquer {
		return lecture.ecrireTranches(ctx, s.Q)
	}
	var bilan bilanTrancheImport
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return bilan, err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	if _, err := tx.Exec(ctx, "SET LOCAL statement_timeout = '60s'"); err != nil {
		return bilan, err
	}
	if bilan, err = lecture.ecrireTranches(ctx, s.Q.WithTx(tx)); err != nil {
		return bilan, err
	}
	return bilan, tx.Commit(ctx)
}

func (l *lectureRepresentantsImport) ecrireTranches(ctx context.Context, q *db.Queries) (bilanTrancheImport, error) {
	var total bilanTrancheImport
	taille := reglagesImports().tranche
	for debut := 0; debut < len(l.lignes); debut += taille {
		bilan, err := l.adaptateur.ecrire(ctx, q, l.contexte, l.lignes[debut:min(debut+taille, len(l.lignes))], l.etat)
		if err != nil {
			return total, err
		}
		total.crees += bilan.crees
		total.misAJour += bilan.misAJour
		total.ignorees += bilan.ignorees
		total.erreurs = append(total.erreurs, bilan.erreurs...)
	}
	return total, nil
}

func rapportRepresentants(dryRun bool, lecture *lectureRepresentantsImport, bilan bilanTrancheImport) *RapportRepresentantsOutput {
	erreurs := make([]erreurLigneImport, 0, len(lecture.erreurs)+len(bilan.erreurs))
	erreurs = append(erreurs, lecture.erreurs...)
	erreurs = append(erreurs, bilan.erreurs...)
	fautives := make(map[int]bool, len(erreurs))
	doublons := 0
	for _, erreur := range erreurs {
		fautives[erreur.RowNumber] = true
		if erreur.Code == "DUPLICATE_IN_FILE" || erreur.Code == "DUPLICATE_IN_DATABASE" {
			doublons++
		}
	}
	out := &RapportRepresentantsOutput{}
	out.Body.DryRun = dryRun
	out.Body.TotalRows = lecture.vues
	out.Body.Valid = len(lecture.lignes) - doublons
	out.Body.Rejected = len(erreurs)
	out.Body.Duplicates = doublons
	if !dryRun {
		out.Body.Created = bilan.crees
	}
	out.Body.Errors = erreursRapportImport(erreurs)
	out.Body.Preview = apercusRapportImport(lecture, fautives)
	return out
}

func erreursRapportImport(erreurs []erreurLigneImport) []ErreurRapportImport {
	if len(erreurs) > maxErreursImport {
		erreurs = erreurs[:maxErreursImport]
	}
	rendues := make([]ErreurRapportImport, 0, len(erreurs))
	for _, erreur := range erreurs {
		rendues = append(rendues, ErreurRapportImport{Line: erreur.RowNumber, Code: erreur.Code, Message: erreur.Message})
	}
	return rendues
}

func apercusRapportImport(lecture *lectureRepresentantsImport, fautives map[int]bool) []ApercuRapportImport {
	departements := libellesParIdentifiantImport(lecture.etat)
	apercus := make([]ApercuRapportImport, 0, min(len(lecture.lignes), maxApercusImport))
	for _, valeur := range lecture.lignes {
		if len(apercus) >= maxApercusImport {
			break
		}
		ligne := valeur.(ligneRepresentantImport)
		if fautives[ligne.numero] {
			continue
		}
		apercu := ApercuRapportImport{
			Line: ligne.numero, FullName: ligne.nom, PhoneE164: ligne.telephone,
			DepartementName: departements.departements[ligne.departementID],
			Notes:           ligne.notes, Etablissement: ligne.etablissement,
			RelationStatus: string(ligne.relation), WhatsappStatus: string(ligne.whatsapp),
		}
		if ligne.iefID != nil {
			nom := departements.iefs[*ligne.iefID]
			apercu.IefName = &nom
		}
		if ligne.appel != nil {
			date := ligne.appel.date.UTC().Format("2006-01-02T15:04:05.000Z")
			apercu.CalledAt = &date
		}
		apercus = append(apercus, apercu)
	}
	return apercus
}

type libellesImport struct {
	departements, iefs map[string]string
}

// Les référentiels sont indexés par leur clé normalisée : l'aperçu a besoin du
// chemin inverse, de l'identifiant vers le libellé affiché.
func libellesParIdentifiantImport(etat *etatRepresentantsImport) libellesImport {
	libelles := libellesImport{departements: map[string]string{}, iefs: map[string]string{}}
	for _, entree := range etat.departements {
		libelles.departements[entree.id] = entree.libelle
	}
	for _, ief := range etat.iefs {
		libelles.iefs[ief.id] = ief.nom
	}
	return libelles
}

func representantsMonterRoutes(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "importRepresentants",
		Method:      http.MethodPost,
		Path:        "/api/v1/representants/import",
		Summary:     "Import d’un classeur de représentants, en simulation puis en écriture.",
		Description: "`dryRun=true`, la valeur par défaut, ne rien écrire et rend le rapport. " +
			"`enrichir` est accepté pour compatibilité mais reste sans effet : cet import crée des fiches, " +
			"il ne complète pas celles qui existent, et `enrichable` comme `enriched` valent toujours 0.",
		MaxBodyBytes: reglagesImports().maxOctets,
		Middlewares:  huma.Middlewares{bornerDepotImport},
	}, s.rapporterImportRepresentants)
}
