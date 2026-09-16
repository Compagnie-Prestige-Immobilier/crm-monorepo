package qualification

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	annuaireTailleDefaut = 500
	annuaireTailleMax    = 1000
	annuaireHorodatage   = "2006-01-02T15:04:05.000Z"
)

type AnnuaireInput struct {
	Since string `query:"since" maxLength:"80"`
	Limit int32  `query:"limit" minimum:"1"`
}

type AnnuaireEntree struct {
	ProspectID       string  `json:"prospectId"`
	PhoneE164        string  `json:"phoneE164"`
	Phase2Status     string  `json:"phase2Status" enum:"PENDING,METHOD_OBTAINED,REFUSED,WRONG_NUMBER"`
	EnrollmentMethod *string `json:"enrollmentMethod"`
	Rev              int32   `json:"rev"`
	UpdatedAt        string  `json:"updatedAt"`
}

type AnnuaireOutput struct {
	Body struct {
		Entries    []AnnuaireEntree `json:"entries"`
		NextCursor *string          `json:"nextCursor"`
		HasMore    bool             `json:"hasMore"`
		ServerTime string           `json:"serverTime"`
	}
}

// Curseur keyset sur (updatedAt, id) : une pagination par décalage reverrait ou
// sauterait des fiches dès qu'une seule est modifiée pendant le parcours.
// `AnnuairePhase2` écarte les fiches sans numéro : la valeur lue n'est jamais nulle.
func qualificationNumero(valeur *string) string {
	if valeur == nil {
		return ""
	}
	return *valeur
}

func annuaireCurseur(at time.Time, id string) string {
	return qualificationISO(at) + "|" + id
}

func annuaireDepuis(curseur string) (*time.Time, string, error) {
	if curseur == "" {
		return nil, "", nil
	}
	horodatage, id, coupe := strings.Cut(curseur, "|")
	instant, err := time.Parse(annuaireHorodatage, horodatage)
	if !coupe || id == "" || err != nil {
		return nil, "", socle.Problem(http.StatusBadRequest, "PHASE2_DIRECTORY_CURSOR_INVALID",
			"Curseur illisible. Reprenez celui du dernier appel, ou omettez-le pour repartir du début.")
	}
	return &instant, id, nil
}

func annuaireTaille(demandee int32) int32 {
	if demandee <= 0 {
		return annuaireTailleDefaut
	}
	return min(demandee, annuaireTailleMax)
}

// Même portée que la liste des prospects : l'annuaire ne montre pas les fiches
// qu'un téléconseiller ne peut pas ouvrir.
func (s *service) qualificationAnnuaire(ctx context.Context, in *AnnuaireInput) (*AnnuaireOutput, error) {
	u := socle.UtilisateurCourant(ctx)
	depuisAt, depuisID, err := annuaireDepuis(in.Since)
	if err != nil {
		return nil, err
	}
	taille := annuaireTaille(in.Limit)
	lignes, err := s.Q.AnnuairePhase2(ctx, db.AnnuairePhase2Params{
		ScopeAll:        qualificationVoitTout(&u) || u.Peut(socle.PermissionPlateformeSaisir),
		ScopeUserID:     u.ID,
		ScopeConverti:   u.Peut(socle.PermissionFichesVoirConverties),
		ScopePlateforme: socle.PorteeSaisiePlateforme(&u),
		DepuisAt:        depuisAt,
		DepuisID:        depuisID,
		Taille:          taille + 1,
	})
	if err != nil {
		return nil, err
	}
	out := &AnnuaireOutput{}
	out.Body.HasMore = len(lignes) > int(taille)
	if out.Body.HasMore {
		lignes = lignes[:int(taille)]
	}
	out.Body.Entries = make([]AnnuaireEntree, 0, len(lignes))
	for i := range lignes {
		l := &lignes[i]
		var methode *string
		if l.EnrollmentMethod != nil {
			nom := string(*l.EnrollmentMethod)
			methode = &nom
		}
		out.Body.Entries = append(out.Body.Entries, AnnuaireEntree{
			ProspectID: l.ID, PhoneE164: qualificationNumero(l.PhoneE164), Phase2Status: string(l.Phase2Status),
			EnrollmentMethod: methode, Rev: l.Rev, UpdatedAt: qualificationISO(l.UpdatedAt),
		})
	}
	if len(lignes) > 0 {
		dernier := &lignes[len(lignes)-1]
		curseur := annuaireCurseur(dernier.UpdatedAt, dernier.ID)
		out.Body.NextCursor = &curseur
	}
	out.Body.ServerTime = qualificationISO(time.Now())
	return out, nil
}

func annuaireMonterRoutes(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "pullPhase2Directory", Method: http.MethodGet, Path: "/api/v1/phase2/directory",
		Summary: "Annuaire : téléphone et état de phase 2, page par page.",
	}, s.qualificationAnnuaire)
}
