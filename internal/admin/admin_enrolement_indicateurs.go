package admin

import (
	"context"
	"cpi-go/db"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

type SerieJour struct {
	Jour         string `json:"jour"`
	Inscriptions int    `json:"inscriptions"`
}

type RepartitionEnrolement struct {
	ID           string `json:"id"`
	Label        string `json:"label"`
	Inscriptions int    `json:"inscriptions"`
}

type DelaiMedian struct {
	Leg         string   `json:"leg"`
	Label       string   `json:"label"`
	MedianDays  *float64 `json:"medianDays"`
	MoyenneDays *float64 `json:"moyenneDays"`
	Sample      int      `json:"sample"`
}

type IndicateursOutput struct {
	Body struct {
		Projet             string                  `json:"projet" enum:"CHUES,GRAND_PUBLIC"`
		Inscriptions       int                     `json:"inscriptions"`
		Rapprochees        int                     `json:"rapprochees"`
		TauxConversion     *float64                `json:"tauxConversion"`
		TauxRapprochement  *float64                `json:"tauxRapprochement"`
		ParJour            []SerieJour             `json:"parJour"`
		ParEtape           []RepartitionEnrolement `json:"parEtape"`
		Delais             []DelaiMedian           `json:"delais"`
		ParTeleconseiller  []RepartitionEnrolement `json:"parTeleconseiller"`
		ParCampagne        []RepartitionEnrolement `json:"parCampagne"`
		ParMethode         []RepartitionEnrolement `json:"parMethode"`
		Entonnoir          EntonnoirEnrolement     `json:"entonnoir"`
		ParAgentPlateforme []RepartitionEnrolement `json:"parAgentPlateforme"`
		ParPiece           []RepartitionEnrolement `json:"parPiece"`
	}
}

// Ce qui avance, en quatre nombres. Les deux plateformes nomment leurs etats
// autrement : un compte sans dossier se reconnait au prefixe `compte-` cote
// CHUES, a l'etape zero cote Grand Public.
type EntonnoirEnrolement struct {
	Inscriptions    int `json:"inscriptions"`
	DossiersOuverts int `json:"dossiersOuverts"`
	DossiersSoumis  int `json:"dossiersSoumis"`
	DossiersDecides int `json:"dossiersDecides"`
	Negatifs        int `json:"negatifs"`
}

const dossierOuvert = `(COALESCE(i."etapeDistante", 0) > 0` +
	` OR (i."etapeDistante" IS NULL AND i."statutDistant" NOT LIKE 'compte-%'))`

type IndicateursInput struct {
	Projet   string `path:"projet" enum:"CHUES,GRAND_PUBLIC"`
	DateFrom string `query:"dateFrom" maxLength:"40"`
	DateTo   string `query:"dateTo" maxLength:"40"`
}

func tauxEnrolement(valeur, total int) *float64 {
	if total == 0 {
		return nil
	}
	arrondi := math.Round(float64(valeur)/float64(total)*1000) / 10
	return &arrondi
}

func joursArrondis(valeur *float64) *float64 {
	if valeur == nil {
		return nil
	}
	arrondi := math.Round(*valeur*10) / 10
	return &arrondi
}

// Une inscription disparue de la plateforme ne compte plus dans aucun chiffre.
func filtresEnrolement(debut, fin *time.Time) (clause string, args []any) {
	clauses := []string{`i."disparueLe" IS NULL`}
	args = []any{}
	if debut != nil {
		args = append(args, *debut)
		clauses = append(clauses, fmt.Sprintf(`i."inscriteLe" >= $%d`, len(args)+1))
	}
	if fin != nil {
		args = append(args, *fin)
		clauses = append(clauses, fmt.Sprintf(`i."inscriteLe" <= $%d`, len(args)+1))
	}
	return strings.Join(clauses, " AND "), args
}

func (s *service) repartitionEnrolement(ctx context.Context, requete string, args []any) ([]RepartitionEnrolement, error) {
	rows, err := s.Pool.Query(ctx, requete, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lignes := []RepartitionEnrolement{}
	for rows.Next() {
		var l RepartitionEnrolement
		if err := rows.Scan(&l.ID, &l.Label, &l.Inscriptions); err != nil {
			return nil, err
		}
		lignes = append(lignes, l)
	}
	return lignes, rows.Err()
}

const etapesGrandPublic = "Étape 0 · Inscription,Étape 1 · Dossier constitué,Étape 2 · Dépôt en banque,Étape 3 · Accord bancaire,Étape 4 · Signature,Étape 5 · Terminé"

// Les statuts que CHUES rend sont ceux de son moteur. La cellule de pilotage
// lit du francais, pas le vocabulaire de la plateforme.
var statutsChues = map[string]string{
	"compte-en-attente":         "Compte en attente",
	"compte-valide":             "Compte validé",
	"draft":                     "Dossier en préparation",
	"submitted":                 "Dossier soumis",
	"needs_correction":          "Dossier à corriger",
	"approved":                  "Dossier accepté",
	"rejected":                  "Dossier refusé",
	"compte-adhesion-pending":   "Demande à rappeler",
	"compte-adhesion-resolved":  "Demande résolue",
	"compte-adhesion-to_public": "Orientée grand public",
	"compte-adhesion-rejected":  "Demande refusée",
	"compte-adhesion-released":  "Inscription ouverte",
}

func libelleEtapeEnrolement(etape *int32, statut string) string {
	if etape == nil {
		if libelle, connu := statutsChues[statut]; connu {
			return libelle
		}
		return statut
	}
	libelles := strings.Split(etapesGrandPublic, ",")
	if int(*etape) < len(libelles) && *etape >= 0 {
		return libelles[*etape]
	}
	return "Étape " + strconv.FormatInt(int64(*etape), 10)
}

func (s *service) lireIndicateurs(ctx context.Context, in *IndicateursInput) (*IndicateursOutput, error) {
	debut, fin, err := s.bornesEnrolement(in.DateFrom, in.DateTo)
	if err != nil {
		return nil, err
	}
	filtres, bornes := filtresEnrolement(debut, fin)
	args := append([]any{db.Projet(in.Projet)}, bornes...)
	depuis := ` FROM "inscriptions_plateforme" i WHERE i."projet" = $1::"Projet" AND ` + filtres

	out := &IndicateursOutput{}
	out.Body.Projet = in.Projet
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE i."prospectId" IS NOT NULL)::int,`+
		` COUNT(*) FILTER (WHERE `+dossierOuvert+`)::int,`+
		` COUNT(*) FILTER (WHERE i."soumiseLe" IS NOT NULL)::int,`+
		` COUNT(*) FILTER (WHERE i."decideeLe" IS NOT NULL)::int,`+
		` COUNT(*) FILTER (WHERE i."motifNegatif" IS NOT NULL)::int`+depuis, args...).
		Scan(&out.Body.Inscriptions, &out.Body.Rapprochees, &out.Body.Entonnoir.DossiersOuverts,
			&out.Body.Entonnoir.DossiersSoumis, &out.Body.Entonnoir.DossiersDecides, &out.Body.Entonnoir.Negatifs); err != nil {
		return nil, err
	}
	out.Body.Entonnoir.Inscriptions = out.Body.Inscriptions
	out.Body.TauxRapprochement = tauxEnrolement(out.Body.Rapprochees, out.Body.Inscriptions)

	var p *db.Projet
	if in.Projet != "" {
		v := db.Projet(in.Projet)
		p = &v
	}
	conversion, err := s.Q.ConversionEnrolement(ctx, p)
	if err != nil {
		return nil, err
	}
	out.Body.TauxConversion = tauxEnrolement(int(conversion.Convertis), int(conversion.Inscrits))

	if out.Body.ParJour, err = s.serieJoursEnrolement(ctx, depuis, args); err != nil {
		return nil, err
	}
	if out.Body.ParEtape, err = s.parEtapeEnrolement(ctx, depuis, args); err != nil {
		return nil, err
	}
	if out.Body.Delais, err = s.delaisEnrolement(ctx, depuis, args); err != nil {
		return nil, err
	}
	if out.Body.ParTeleconseiller, err = s.repartitionEnrolement(ctx, `SELECT u."id", u."fullName", COUNT(*)::int`+
		` FROM "inscriptions_plateforme" i`+
		` INNER JOIN "prospects" p ON p."id" = i."prospectId"`+
		` INNER JOIN "users" u ON u."id" = COALESCE(p."enrollmentCapturedById", p."createdById")`+
		` WHERE i."projet" = $1::"Projet" AND u."role" = 'COMMERCIAL'::"Role" AND `+filtres+` GROUP BY 1, 2 ORDER BY 3 DESC, 2 ASC`, args); err != nil {
		return nil, err
	}
	if out.Body.ParCampagne, err = s.repartitionEnrolement(ctx, `SELECT l."id", l."name", COUNT(DISTINCT i."id")::int`+
		` FROM "inscriptions_plateforme" i`+
		` INNER JOIN "lot_export_items" li ON li."prospectId" = i."prospectId"`+
		` INNER JOIN "lots_export" l ON l."id" = li."lotId"`+
		` WHERE i."projet" = $1::"Projet" AND l."projet" = $1::"Projet" AND `+filtres+` GROUP BY 1, 2 ORDER BY 3 DESC, 2 ASC`, args); err != nil {
		return nil, err
	}
	if out.Body.ParAgentPlateforme, err = s.repartitionEnrolement(ctx, `SELECT `+agentPlateforme+`, `+agentPlateforme+
		`, COUNT(*)::int`+depuis+` AND `+agentPlateforme+` IS NOT NULL GROUP BY 1 ORDER BY 3 DESC, 1 ASC`, args); err != nil {
		return nil, err
	}
	if out.Body.ParPiece, err = s.repartitionEnrolement(ctx, requetePieces+filtres+
		` AND jsonb_typeof(i."chargeUtile"->'requisDocs') = 'array' GROUP BY 1, 2 ORDER BY 3 DESC, 2 ASC`, args); err != nil {
		return nil, err
	}
	out.Body.ParMethode, err = s.parMethodeEnrolement(ctx, filtres, args)
	return out, err
}

// L'agent qui a saisi l'inscription n'a pas de colonne : les deux plateformes
// le rendent, sous deux noms, et le tirage garde leur reponse telle quelle.
const agentPlateforme = `COALESCE(i."chargeUtile"->'agent'->>'name', i."chargeUtile"->>'conseiller')`

// Une piece par ligne, avec son etat : c'est ce qui dit sur quoi un dossier bloque.
const requetePieces = `SELECT (piece->>'docId') || ':' || (piece->>'status'),` +
	` COALESCE(piece->>'label', piece->>'docId') || ' · ' ||` +
	` CASE piece->>'status' WHEN 'accepte' THEN 'acceptée' WHEN 'en-attente' THEN 'en attente'` +
	` WHEN 'refuse' THEN 'refusée' ELSE piece->>'status' END, COUNT(*)::int` +
	` FROM "inscriptions_plateforme" i, jsonb_array_elements(i."chargeUtile"->'requisDocs') AS piece` +
	` WHERE i."projet" = $1::"Projet" AND `

func (s *service) serieJoursEnrolement(ctx context.Context, depuis string, args []any) ([]SerieJour, error) {
	rows, err := s.Pool.Query(ctx, `SELECT date_trunc('day', i."inscriteLe") AS jour, COUNT(*)::int`+depuis+
		` AND i."inscriteLe" IS NOT NULL GROUP BY 1 ORDER BY 1`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	serie := []SerieJour{}
	for rows.Next() {
		var jour time.Time
		var total int
		if err := rows.Scan(&jour, &total); err != nil {
			return nil, err
		}
		serie = append(serie, SerieJour{Jour: jour.Format(time.DateOnly), Inscriptions: total})
	}
	return serie, rows.Err()
}

func (s *service) parEtapeEnrolement(ctx context.Context, depuis string, args []any) ([]RepartitionEnrolement, error) {
	rows, err := s.Pool.Query(ctx, `SELECT i."etapeDistante", i."statutDistant", COUNT(*)::int`+depuis+
		` GROUP BY 1, 2 ORDER BY 1 NULLS FIRST, 3 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lignes := []RepartitionEnrolement{}
	for rows.Next() {
		var etape *int32
		var statut string
		var total int
		if err := rows.Scan(&etape, &statut, &total); err != nil {
			return nil, err
		}
		// L'identifiant sert de valeur au filtre de la liste, qui compare
		// `statutDistant` : un numéro d'étape n'y correspondrait jamais.
		lignes = append(lignes, RepartitionEnrolement{ID: statut, Label: libelleEtapeEnrolement(etape, statut), Inscriptions: total})
	}
	return lignes, rows.Err()
}

// Médiane et non moyenne : un dossier oublié six mois déplacerait la moyenne de
// plusieurs semaines.
// Médiane et moyenne du même écart : la médiane résiste à un dossier oublié
// six mois, la moyenne dit ce que le dispositif coûte en jours cumulés.
func delaiEnrolement(de, a string) string {
	utilisable := de + " IS NOT NULL AND " + a + " IS NOT NULL AND " + a + " >= " + de
	ecart := `EXTRACT(EPOCH FROM (` + a + ` - ` + de + `)) / 86400.0`
	return `percentile_cont(0.5) WITHIN GROUP (ORDER BY ` + ecart + `)` +
		` FILTER (WHERE ` + utilisable + `)::float8,` +
		` AVG(` + ecart + `) FILTER (WHERE ` + utilisable + `)::float8,` +
		` COUNT(*) FILTER (WHERE ` + utilisable + `)::int`
}

func (s *service) delaisEnrolement(ctx context.Context, depuis string, args []any) ([]DelaiMedian, error) {
	var m1, a1, m2, a2 *float64
	var n1, n2 int
	requete := "SELECT " + delaiEnrolement(`i."inscriteLe"`, `i."soumiseLe"`) + ", " +
		delaiEnrolement(`i."soumiseLe"`, `i."decideeLe"`) + depuis
	if err := s.Pool.QueryRow(ctx, requete, args...).Scan(&m1, &a1, &n1, &m2, &a2, &n2); err != nil {
		return nil, err
	}
	delais := []DelaiMedian{
		{Leg: "INSCRIPTION_TO_SOUMISSION", Label: "Inscription vers dossier soumis", Sample: n1},
		{Leg: "SOUMISSION_TO_DECISION", Label: "Dossier soumis vers décision", Sample: n2},
	}
	if n1 > 0 {
		delais[0].MedianDays, delais[0].MoyenneDays = joursArrondis(m1), joursArrondis(a1)
	}
	if n2 > 0 {
		delais[1].MedianDays, delais[1].MoyenneDays = joursArrondis(m2), joursArrondis(a2)
	}
	return delais, nil
}

const methodesEnrolement = "APPOINTMENT:RDV CPI,PHYSICAL:RDV CPI,PLATFORM:Plateforme en ligne,PLATEFORME_EN_LIGNE:Plateforme en ligne," +
	"VOICE_OR_ELECTRONIC_MESSAGING:Mail,MAIL:Mail,WHATSAPP:WhatsApp,RDV_CPI:RDV CPI"

func libelleMethodeEnrolement(methode string) string {
	for _, paire := range strings.Split(methodesEnrolement, ",") {
		if code, libelle, _ := strings.Cut(paire, ":"); code == methode {
			return libelle
		}
	}
	return methode
}

func (s *service) parMethodeEnrolement(ctx context.Context, filtres string, args []any) ([]RepartitionEnrolement, error) {
	rows, err := s.Pool.Query(ctx, `SELECT p."enrollmentMethod"::text, COUNT(*)::int`+
		` FROM "inscriptions_plateforme" i INNER JOIN "prospects" p ON p."id" = i."prospectId"`+
		` WHERE i."projet" = $1::"Projet" AND p."enrollmentMethod" IS NOT NULL AND `+filtres+
		` GROUP BY 1 ORDER BY 2 DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lignes := []RepartitionEnrolement{}
	for rows.Next() {
		var methode string
		var total int
		if err := rows.Scan(&methode, &total); err != nil {
			return nil, err
		}
		lignes = append(lignes, RepartitionEnrolement{ID: methode, Label: libelleMethodeEnrolement(methode), Inscriptions: total})
	}
	return lignes, rows.Err()
}
