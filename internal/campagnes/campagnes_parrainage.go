package campagnes

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"strings"
	"time"

	"github.com/google/uuid"
)

// EB-19, variante prospects : un parrainage Grand Public devient une fiche au
// LANCEMENT de la campagne, comme une recommandation de représentant.
func (*service) lotOuvrirContactsRecommandesProspects(ctx context.Context, q *db.Queries, createurID string, places int) ([]string, error) {
	suggestions, err := q.TirerSuggestionsProspect(ctx)
	if err != nil {
		return nil, err
	}
	numeros := make([]string, 0, len(suggestions))
	for _, piste := range suggestions {
		numeros = append(numeros, piste.SuggestedPhoneE164)
	}
	deja, err := q.TelephonesProspectsConnus(ctx, numeros)
	if err != nil {
		return nil, err
	}
	connus := map[string]bool{}
	for _, numero := range deja {
		if numero != nil {
			connus[*numero] = true
		}
	}
	maintenant := time.Now()
	fiches := make([]string, 0, min(places, len(suggestions)))
	for _, piste := range suggestions {
		if len(fiches) >= places {
			break
		}
		if connus[piste.SuggestedPhoneE164] {
			continue
		}
		connus[piste.SuggestedPhoneE164] = true
		id, err := lotMaterialiserContactRecommande(ctx, q, createurID, maintenant, &piste)
		if err != nil {
			return nil, err
		}
		fiches = append(fiches, id)
	}
	return fiches, nil
}

func lotMaterialiserContactRecommande(ctx context.Context, q *db.Queries, createurID string, maintenant time.Time, piste *db.TirerSuggestionsProspectRow) (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	nom := strings.TrimSpace(lotValeurTexte(piste.SuggestedName))
	phone := piste.SuggestedPhoneE164
	if err := q.InsertProspect(ctx, db.InsertProspectParams{
		ID: id.String(), Nom: lotSiVide(nom, "Contact recommandé"), Prenom: "",
		PhoneE164: &phone, CreatedById: createurID, ClientCreatedAt: maintenant,
		Statut: db.ProspectStatutNOUVEAU, Projet: db.ProjetGRANDPUBLIC,
		Origin: lotPointeurTexte(socle.ProspectOrigineParrainage), ARevoirAt: &maintenant,
		WhatsappStatus: db.WhatsappStatusNONDEMANDE,
	}); err != nil {
		return "", err
	}
	journeyID, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	if err := q.InsertJourney(ctx, db.InsertJourneyParams{
		ID: journeyID.String(), ProspectId: id.String(), Projet: db.ProjetGRANDPUBLIC,
		Statut: db.ProspectStatutNOUVEAU, Consent: db.GrandPublicConsentNONDEMANDE,
	}); err != nil {
		return "", err
	}
	if err := q.ResoudreSuggestionProspect(ctx, db.ResoudreSuggestionProspectParams{
		ID: piste.ID, ResolvedProspectId: lotPointeurTexte(id.String()),
	}); err != nil {
		return "", err
	}
	return id.String(), nil
}
