package imports

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

// RATTRAPAGE PONCTUEL, À RETIRER APRÈS USAGE, avec ses deux requêtes dans
// `sql/queries/imports.sql` et le bouton du panneau. Les fiches importées avant
// le 13 septembre 2026 n'ont pas d'onglet : leur classeur est relu et l'onglet
// posé en rapprochant par téléphone, exactement comme l'import l'avait lu.
const cheminRattrapageFeuilles = "POST /api/v1/imports/rattraper-feuilles"

type RattrapageClasseur struct {
	FileName string `json:"fileName"`
	Fiches   int    `json:"fiches"`
	Motif    string `json:"motif,omitempty"`
}

type RattrapageOutput struct {
	Body struct {
		Classeurs []RattrapageClasseur `json:"classeurs"`
		Fiches    int                  `json:"fiches"`
	}
}

func rattrapageMonterRoute(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "rattraperFeuillesImport", Method: http.MethodPost,
		Path:    "/api/v1/imports/rattraper-feuilles",
		Summary: "Nomme les lots déjà importés d’après l’onglet de leur classeur.",
	}, s.rattraperFeuilles)
}

func (s *service) rattraperFeuilles(ctx context.Context, _ *struct{}) (*RattrapageOutput, error) {
	travaux, err := s.Q.ImportsSansFeuille(ctx)
	if err != nil {
		return nil, err
	}
	// L'échéance efface le classeur du disque : les travaux les plus anciens
	// n'ont plus rien à relire. Le même document vit toujours sur SharePoint, et
	// le rapprochement se fait par téléphone, pas par fichier.
	recours := classeurDepuisSharePoint(ctx)
	if recours != "" {
		defer func() { _ = os.Remove(recours) }()
	}

	out := &RattrapageOutput{}
	out.Body.Classeurs = make([]RattrapageClasseur, 0, len(travaux))
	for i := range travaux {
		chemin := travaux[i].StoragePath
		if _, err := os.Stat(chemin); err != nil {
			chemin = recours
		}
		bilan := s.rattraperUnClasseur(ctx, travaux[i].ID, chemin)
		bilan.FileName = travaux[i].FileName
		out.Body.Fiches += bilan.Fiches
		out.Body.Classeurs = append(out.Body.Classeurs, bilan)
	}
	return out, nil
}

func classeurDepuisSharePoint(ctx context.Context) string {
	lien := strings.TrimSpace(os.Getenv("IMPORT_LEADS_URL"))
	if lien == "" {
		return ""
	}
	classeur, _, err := telechargerLeads(ctx, lien, reglagesImports().maxOctets)
	if err != nil {
		slog.Warn("rattrapage des onglets, relevé SharePoint", "err", err)
		return ""
	}
	fichier, err := os.CreateTemp("", "rattrapage-*.xlsx")
	if err != nil {
		return ""
	}
	defer func() { _ = fichier.Close() }()
	if _, err := fichier.Write(classeur); err != nil {
		return ""
	}
	return fichier.Name()
}

// Un classeur effacé par l'expiration se signale sans faire échouer les autres.
func (s *service) rattraperUnClasseur(ctx context.Context, jobID, chemin string) RattrapageClasseur {
	if chemin == "" {
		return RattrapageClasseur{Motif: "classeur échu et relevé SharePoint indisponible"}
	}
	feuilles, err := s.feuillesParTelephone(chemin)
	if err != nil {
		return RattrapageClasseur{Motif: err.Error()}
	}
	bilan := RattrapageClasseur{}
	for telephone, feuille := range feuilles {
		rangs, err := s.Q.RattraperFeuilleProspect(ctx, db.RattraperFeuilleProspectParams{
			ImportJobID: &jobID, PhoneE164: telephone, Feuille: &feuille,
		})
		if err != nil {
			slog.Warn("rattrapage des onglets", "job", jobID, "err", err)
			return RattrapageClasseur{Fiches: bilan.Fiches, Motif: err.Error()}
		}
		bilan.Fiches += int(rangs)
	}
	return bilan
}

// Un numéro illisible n'est pas une erreur : la ligne n'a pas donné de fiche,
// il n'y a donc rien à rattraper pour elle.
func telephoneLisibleImport(brut, region string) string {
	numero, err := database.NormaliserTelephone(strings.TrimSpace(brut), region)
	if err != nil {
		return ""
	}
	return numero
}

// Le premier onglet l'emporte : l'import dédoublonne dans l'ordre de lecture,
// et une fiche présente deux fois appartient donc à l'onglet rencontré d'abord.
func (s *service) feuillesParTelephone(chemin string) (map[string]string, error) {
	adaptateur := adaptateursImport[db.ImportKindPROSPECTSGRANDPUBLIC]
	classeur, err := ouvrirClasseurImport(chemin, adaptateur)
	if err != nil {
		return nil, err
	}
	defer func() { _ = classeur.fermer() }()

	feuilles := map[string]string{}
	err = classeur.parcourir(func(_ int, cellules map[string]string) error {
		feuille := strings.TrimSpace(cellules[feuilleImport])
		if feuille == "" {
			return nil
		}
		telephone := telephoneLisibleImport(cellules[enteteGrandPublicImport(2)], s.Cfg.PhoneRegion)
		if telephone == "" {
			return nil
		}
		if _, vu := feuilles[telephone]; !vu {
			feuilles[telephone] = tronquerImport(feuille, 200)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return feuilles, nil
}
