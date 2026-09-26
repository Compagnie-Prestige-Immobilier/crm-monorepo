package ventes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/database"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const cheminEcheancesEnRetard = "/api/v1/ventes/echeances-en-retard"

// DatesEcheances : la première échéance tombe à la date choisie, les suivantes
// au jour de versement, tous les `periodiciteMois` mois.
func DatesEcheances(premier time.Time, periodiciteMois, jourVersement, nombre int32) []time.Time {
	dates := make([]time.Time, 0, max(nombre, 1))
	dates = append(dates, premier)
	for rang := int32(1); rang < nombre; rang++ {
		mois := int(premier.Month()) + int(rang*periodiciteMois)
		dates = append(dates, time.Date(premier.Year(), time.Month(mois), int(jourVersement), 0, 0, 0, 0, time.UTC))
	}
	return dates
}

type EcheanceEnRetardDTO struct {
	VenteID           int64   `json:"venteId"`
	Numero            int32   `json:"numero"`
	Client            string  `json:"client"`
	Site              string  `json:"site"`
	Telephone         string  `json:"telephone"`
	TelephoneE164     *string `json:"telephoneE164" doc:"Nul si le numéro saisi n'est pas valide."`
	MontantDu         int64   `json:"montantDu" doc:"Échéances passées non couvertes par les versements, en FCFA."`
	EcheancesManquees int     `json:"echeancesManquees"`
	PremiereImpayee   string  `json:"premiereImpayee" format:"date"`
	DerniereEcheance  string  `json:"derniereEcheance" format:"date" doc:"Dernière échéance passée."`
	JoursRetard       int     `json:"joursRetard" doc:"Jours depuis la première échéance impayée."`
	MessageWhatsapp   string  `json:"messageWhatsapp"`
}

type EcheancesEnRetardInput struct {
	Page   int `query:"page" minimum:"1" default:"1"`
	Taille int `query:"taille" minimum:"1" maximum:"200" default:"50"`
}

type EcheancesEnRetardOutput struct {
	Body struct {
		Lignes  []EcheanceEnRetardDTO `json:"lignes"`
		Total   int                   `json:"total"`
		Page    int                   `json:"page"`
		Taille  int                   `json:"taille"`
		Tronque bool                  `json:"tronque" doc:"Vrai si plus de 5 000 ventes à crédit : seules les plus anciennes sont examinées."`
	}
}

func monterEcheances(api huma.API, s *service) {
	huma.Register(api, huma.Operation{
		OperationID: "listEcheancesEnRetard", Method: http.MethodGet, Path: cheminEcheancesEnRetard,
		Summary: "Les ventes à crédit dont une échéance passée n'est pas couverte, les plus en retard d'abord.",
	}, s.echeancesEnRetard)
}

func (s *service) echeancesEnRetard(ctx context.Context, in *EcheancesEnRetardInput) (*EcheancesEnRetardOutput, error) {
	ventes, err := s.Q.EcheancesVentesACredit(ctx, db.EcheancesVentesACreditParams{Apres: 0, Taille: plafondVentes + 1})
	if err != nil {
		return nil, err
	}
	out := &EcheancesEnRetardOutput{}
	out.Body.Tronque = len(ventes) > plafondVentes
	ventes = ventes[:min(len(ventes), plafondVentes)]
	local := time.Now().In(s.Cfg.TimeZone)
	aujourdhui := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
	lignes := []EcheanceEnRetardDTO{}
	for i := range ventes {
		if ligne, enRetard := retardVente(&ventes[i], aujourdhui); enRetard {
			ligne.TelephoneE164 = database.TelephoneOptionnel(&ventes[i].Telephone, s.Cfg.PhoneRegion)
			lignes = append(lignes, ligne)
		}
	}
	sort.Slice(lignes, func(i, j int) bool {
		if lignes[i].JoursRetard != lignes[j].JoursRetard {
			return lignes[i].JoursRetard > lignes[j].JoursRetard
		}
		return lignes[i].VenteID < lignes[j].VenteID
	})
	debut := min((in.Page-1)*in.Taille, len(lignes))
	out.Body.Lignes = lignes[debut:min(debut+in.Taille, len(lignes))]
	out.Body.Total, out.Body.Page, out.Body.Taille = len(lignes), in.Page, in.Taille
	return out, nil
}

// Une échéance vaut le reste à payer après acompte divisé par leur nombre,
// arrondi au franc supérieur ; elle est en retard le lendemain de sa date.
func retardVente(v *db.EcheancesVentesACreditRow, aujourdhui time.Time) (EcheanceEnRetardDTO, bool) {
	nombre := int32(1)
	if v.NombreEcheances != nil {
		nombre = max(*v.NombreEcheances, 1)
	}
	reste := v.PrixTotal - v.Acompte
	if reste <= 0 {
		return EcheanceEnRetardDTO{}, false
	}
	montant := (reste + int64(nombre) - 1) / int64(nombre)
	dates := DatesEcheances(v.PremierVersement.Time, v.PeriodiciteMois, *v.JourVersement, nombre)
	echues := 0
	for echues < len(dates) && dates[echues].Before(aujourdhui) {
		echues++
	}
	du := min(int64(echues)*montant, reste) - v.Verse
	if echues == 0 || du <= 0 {
		return EcheanceEnRetardDTO{}, false
	}
	couvertes := int(min(v.Verse/montant, int64(echues-1)))
	premiere := dates[couvertes]
	return EcheanceEnRetardDTO{
		VenteID: v.ID, Numero: v.Numero, Client: v.Client, Site: v.Site, Telephone: v.Telephone,
		MontantDu: du, EcheancesManquees: echues - couvertes,
		PremiereImpayee: premiere.Format(time.DateOnly), DerniereEcheance: dates[echues-1].Format(time.DateOnly),
		JoursRetard: int(aujourdhui.Sub(premiere).Hours() / 24),
		MessageWhatsapp: fmt.Sprintf("Bonjour %s, sauf erreur de notre part, %s FCFA restent à verser pour votre terrain à %s depuis le %s. "+
			"Merci de régulariser votre versement ou de nous appeler. CPI", v.Client, enFcfa(du), v.Site, premiere.Format("02/01/2006")),
	}, true
}

// « 1500000 » devient « 1 500 000 ».
func enFcfa(montant int64) string {
	chiffres := strconv.FormatInt(montant, 10)
	var lisible strings.Builder
	for i, chiffre := range chiffres {
		if i > 0 && (len(chiffres)-i)%3 == 0 {
			lisible.WriteByte(' ')
		}
		lisible.WriteRune(chiffre)
	}
	return lisible.String()
}
