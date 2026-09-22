package admin

import (
	"context"
	"cpi-go/internal/shared/database"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Le flux `/api/integration/v1` est le contrat que les deux plateformes tiennent
// pour le CRM ; les routes des écrans (`/clients`, `/staff/clients`) suivent
// l'interface et se ferment au compte machine.
const (
	cheminFlux  = "/integration/v1"
	limiteFlux  = 500
	typePurge   = "purge"
	ressourcePC = "/prises-de-contact"
)

func lirePlateforme(ctx context.Context, projet, base, jeton string) ([]inscriptionDistante, error) {
	clients, err := lireFlux(ctx, projet, base+cheminFlux+"/clients", jeton)
	if err != nil {
		return nil, err
	}
	if projet != projetChues {
		return inscriptionsGrandPublic(clients), nil
	}
	prises, err := lireFlux(ctx, projet, base+cheminFlux+ressourcePC, jeton)
	if err != nil {
		return nil, err
	}
	return inscriptionsChues(clients, prises), nil
}

// Chaque page rend le curseur de la suivante, `null` sur la dernière.
func lireFlux(ctx context.Context, projet, adresse, jeton string) ([]json.RawMessage, error) {
	var lignes []json.RawMessage
	curseur := ""
	for range pagesMax {
		requete := adresse + "?limite=" + strconv.Itoa(limiteFlux)
		if curseur != "" {
			requete += "&curseur=" + url.QueryEscape(curseur)
		}
		var reponse struct {
			Data           []json.RawMessage `json:"data"`
			CurseurSuivant *string           `json:"curseur_suivant"`
		}
		if err := appelPlateforme(ctx, projet, requete, jeton, &reponse); err != nil {
			return nil, err
		}
		lignes = append(lignes, reponse.Data...)
		if reponse.CurseurSuivant == nil || *reponse.CurseurSuivant == "" {
			return lignes, nil
		}
		curseur = *reponse.CurseurSuivant
		if err := pause(ctx); err != nil {
			return nil, err
		}
	}
	return lignes, nil
}

func pause(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(pausePage):
		return nil
	}
}

type ficheChues struct {
	ID         idDistant `json:"id"`
	Nom        *string   `json:"nom"`
	Prenom     *string   `json:"prenom"`
	NomFamille *string   `json:"nom_famille"`
	Email      *string   `json:"email"`
	Telephone  *string   `json:"telephone"`
	InscritLe  *string   `json:"inscrit_le"`
	Compte     struct {
		Statut string `json:"statut"`
	} `json:"compte"`
	Dossier *struct {
		Statut   string  `json:"statut"`
		SoumisLe *string `json:"soumis_le"`
		DecideLe *string `json:"decide_le"`
	} `json:"dossier"`
	PriseDeContact *struct {
		DecideeLe *string `json:"decidee_le"`
	} `json:"prise_de_contact"`
}

type priseDeContactChues struct {
	ID          idDistant `json:"id"`
	Nom         *string   `json:"nom"`
	Prenom      *string   `json:"prenom"`
	NomFamille  *string   `json:"nom_famille"`
	Email       *string   `json:"email"`
	Telephone   *string   `json:"telephone"`
	Statut      string    `json:"statut"`
	StatutAppel string    `json:"statut_appel"`
	DecideeLe   *string   `json:"decidee_le"`
	CreeLe      *string   `json:"cree_le"`
	ClientRef   *string   `json:"client_ref"`
}

// Le nom complet sert quand la plateforme n'a pas séparé prénom et nom de famille.
func nomEtPrenom(complet, prenom, nomFamille *string) (nom, pre string) {
	if texteDistant(prenom) == nil && texteDistant(nomFamille) == nil {
		return separerNomDistant(complet)
	}
	return valeurDistante(texteDistant(nomFamille)), valeurDistante(texteDistant(prenom))
}

func inscriptionsChues(clients, prises []json.RawMessage) []inscriptionDistante {
	lignes := make([]inscriptionDistante, 0, len(clients)+len(prises))
	comptes := map[string]bool{}
	for _, brut := range clients {
		var fiche ficheChues
		// Une ligne qui ne tient pas le contrat est ignorée, pas déposée à moitié.
		if json.Unmarshal(brut, &fiche) != nil {
			continue
		}
		lignes = append(lignes, versInscriptionChues(&fiche, brut))
		if courriel := texteDistant(fiche.Email); courriel != nil {
			comptes[strings.ToLower(*courriel)] = true
		}
	}
	for _, brut := range prises {
		var prise priseDeContactChues
		if json.Unmarshal(brut, &prise) != nil || priseRattachee(&prise, comptes) {
			continue
		}
		lignes = append(lignes, versInscriptionPriseDeContact(&prise, brut))
	}
	return lignes
}

// Une prise de contact devenue compte n'est pas redéposée : le compte porte l'avancement.
func priseRattachee(prise *priseDeContactChues, comptes map[string]bool) bool {
	if texteDistant(prise.ClientRef) != nil {
		return true
	}
	courriel := texteDistant(prise.Email)
	return courriel != nil && comptes[strings.ToLower(*courriel)]
}

func versInscriptionChues(fiche *ficheChues, brut json.RawMessage) inscriptionDistante {
	statut := "compte-en-attente"
	if fiche.Compte.Statut == "approved" {
		statut = "compte-valide"
	}
	var soumise, decidee *time.Time
	var motif *string
	if fiche.Dossier != nil {
		statut = fiche.Dossier.Statut
		soumise = dateDistanteTexte(fiche.Dossier.SoumisLe)
		decidee = dateDistanteTexte(fiche.Dossier.DecideLe)
		if statut == "needs_correction" {
			libelle := "Dossier à corriger"
			motif = &libelle
		}
	}
	if decidee == nil && fiche.PriseDeContact != nil {
		decidee = dateDistanteTexte(fiche.PriseDeContact.DecideeLe)
	}
	nom, prenom := nomEtPrenom(fiche.Nom, fiche.Prenom, fiche.NomFamille)
	return inscriptionDistante{
		IdentifiantDistant: string(fiche.ID),
		Nom:                nom,
		Prenom:             prenom,
		PhoneE164:          database.TelephoneOptionnel(fiche.Telephone, "SN"),
		Email:              texteDistant(fiche.Email),
		StatutDistant:      statut,
		InscriteLe:         dateDistanteTexte(fiche.InscritLe),
		SoumiseLe:          soumise,
		DecideeLe:          decidee,
		ChargeUtile:        brut,
		MotifNegatif:       motif,
	}
}

// Le préfixe `adhesion-` date des demandes d'adhésion, dont les prises de
// contact reprennent les identifiants : le retirer doublerait chaque ligne.
func versInscriptionPriseDeContact(prise *priseDeContactChues, brut json.RawMessage) inscriptionDistante {
	nom, prenom := nomEtPrenom(prise.Nom, prise.Prenom, prise.NomFamille)
	return inscriptionDistante{
		IdentifiantDistant: "adhesion-" + string(prise.ID),
		Nom:                nom,
		Prenom:             prenom,
		PhoneE164:          database.TelephoneOptionnel(prise.Telephone, "SN"),
		Email:              texteDistant(prise.Email),
		StatutDistant:      "compte-adhesion-" + prise.Statut,
		InscriteLe:         dateDistanteTexte(prise.CreeLe),
		DecideeLe:          dateDistanteTexte(prise.DecideeLe),
		MotifNegatif:       motifAdhesionChues(prise.Statut, prise.StatutAppel),
		ChargeUtile:        brut,
	}
}

func motifAdhesionChues(statut, statutAppel string) *string {
	var motif string
	switch {
	case statut == "rejected":
		motif = "Refus des deux"
	case statut == "to_public":
		motif = "Orienté Grand Public"
	case statutAppel == "declined":
		motif = "Ne souhaite pas donner suite"
	case statutAppel == "unreachable":
		motif = "Injoignable"
	default:
		return nil
	}
	return &motif
}

type ficheGrandPublic struct {
	ID           idDistant `json:"id"`
	Nom          *string   `json:"nom"`
	Email        *string   `json:"email"`
	Telephone    *string   `json:"telephone"`
	InscritLe    *string   `json:"inscrit_le"`
	EtapeDossier *struct {
		Numero int32 `json:"numero"`
	} `json:"etape_dossier"`
	Compte *struct {
		Statut string `json:"statut"`
	} `json:"compte"`
	Demande *struct {
		SoumiseLe *string `json:"soumise_le"`
	} `json:"demande"`
	Pieces []struct {
		Statut string `json:"statut"`
	} `json:"pieces"`
}

func inscriptionsGrandPublic(clients []json.RawMessage) []inscriptionDistante {
	lignes := make([]inscriptionDistante, 0, len(clients))
	for _, brut := range clients {
		var fiche ficheGrandPublic
		if json.Unmarshal(brut, &fiche) == nil {
			lignes = append(lignes, versInscriptionGrandPublic(&fiche, brut))
		}
	}
	return lignes
}

// Le `statut` de la fiche est un texte libre décoratif : l'état qui se mesure
// est l'ÉTAPE, et le statut en dérive.
func versInscriptionGrandPublic(fiche *ficheGrandPublic, brut json.RawMessage) inscriptionDistante {
	nom, prenom := separerNomDistant(fiche.Nom)
	statut := "etape-inconnue"
	var etape *int32
	if fiche.EtapeDossier != nil {
		numero := fiche.EtapeDossier.Numero
		etape = &numero
		statut = "etape-" + strconv.Itoa(int(numero))
	}
	var soumise *time.Time
	if fiche.Demande != nil {
		soumise = dateDistanteTexte(fiche.Demande.SoumiseLe)
	}
	return inscriptionDistante{
		IdentifiantDistant: string(fiche.ID),
		Nom:                nom,
		Prenom:             prenom,
		PhoneE164:          database.TelephoneOptionnel(fiche.Telephone, "SN"),
		Email:              texteDistant(fiche.Email),
		StatutDistant:      statut,
		EtapeDistante:      etape,
		InscriteLe:         dateDistanteTexte(fiche.InscritLe),
		SoumiseLe:          soumise,
		ChargeUtile:        brut,
		MotifNegatif:       motifGrandPublic(fiche),
	}
}

func motifGrandPublic(fiche *ficheGrandPublic) *string {
	if fiche.Compte != nil && fiche.Compte.Statut == "rejete" {
		motif := "Compte rejeté"
		return &motif
	}
	refusee, aRemplacer := false, false
	for _, piece := range fiche.Pieces {
		refusee = refusee || piece.Statut == "refuse"
		aRemplacer = aRemplacer || piece.Statut == "a-remplacer"
	}
	switch {
	case refusee:
		motif := "Pièce refusée"
		return &motif
	case aRemplacer:
		motif := "Pièce à remplacer"
		return &motif
	default:
		return nil
	}
}

// Une purge est définitive sur la plateforme, et la politique de
// confidentialité promet au client que le CRM efface aussi sa copie. La liste
// se relit en entier : ses lignes survivent à la purge et restent peu nombreuses.
func purgesPlateforme(ctx context.Context, projet, base, jeton string) ([]string, error) {
	var purges []string
	apres := 0
	for range pagesMax {
		var reponse struct {
			Data []struct {
				ID       int       `json:"id"`
				ClientID idDistant `json:"client_id"`
				Type     string    `json:"type"`
			} `json:"data"`
			ApresSuivant *int `json:"apres_suivant"`
		}
		requete := fmt.Sprintf("%s%s/suppressions?limite=%d&apres=%d", base, cheminFlux, limiteFlux, apres)
		if err := appelPlateforme(ctx, projet, requete, jeton, &reponse); err != nil {
			return nil, err
		}
		for _, ligne := range reponse.Data {
			if ligne.Type == typePurge {
				purges = append(purges, string(ligne.ClientID))
			}
		}
		if reponse.ApresSuivant == nil {
			return purges, nil
		}
		apres = *reponse.ApresSuivant
		if err := pause(ctx); err != nil {
			return nil, err
		}
	}
	return purges, nil
}

// « 2026-09-03 13:43:05 » n'a pas de fuseau : le serveur métier est à Dakar,
// donc UTC. Lue dans le fuseau de la machine, la même inscription changerait de jour.
func dateDistanteTexte(valeur *string) *time.Time {
	if valeur == nil || strings.TrimSpace(*valeur) == "" {
		return nil
	}
	propre := strings.TrimSpace(*valeur)
	for _, forme := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", time.DateOnly} {
		if instant, err := time.ParseInLocation(forme, propre, time.UTC); err == nil {
			return &instant
		}
	}
	return nil
}

func texteDistant(valeur *string) *string {
	if valeur == nil {
		return nil
	}
	propre := strings.TrimSpace(*valeur)
	if propre == "" {
		return nil
	}
	return &propre
}

func valeurDistante(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// L'ordre d'affichage d'un nom complet est « Prénom Nom ».
func separerNomDistant(complet *string) (nom, prenom string) {
	mots := strings.Fields(valeurDistante(complet))
	if len(mots) == 0 {
		return "", ""
	}
	if len(mots) == 1 {
		return mots[0], ""
	}
	return strings.Join(mots[1:], " "), mots[0]
}

func appelPlateforme(ctx context.Context, projet, adresse, jeton string, cible any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, adresse, http.NoBody)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+jeton)
	req.Header.Set("Accept", "application/json")
	resp, err := clientPlateforme.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("jeton refusé par la plateforme %s (401)", projet)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("lecture refusée par la plateforme %s (%d)", projet, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(cible)
}

// Les deux plateformes ont migré leurs identifiants d'un entier vers un UUID.
// Un `json.Number` refuse la chaîne, et le tirage rejetait alors chaque ligne
// en silence : 200 lu, zéro retenu, aucune erreur.
type idDistant string

func (id *idDistant) UnmarshalJSON(brut []byte) error {
	var texte string
	if json.Unmarshal(brut, &texte) == nil {
		*id = idDistant(texte)
		return nil
	}
	var nombre json.Number
	if err := json.Unmarshal(brut, &nombre); err != nil {
		return err
	}
	*id = idDistant(nombre.String())
	return nil
}
