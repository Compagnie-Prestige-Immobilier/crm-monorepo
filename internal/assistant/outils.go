package assistant

import (
	"context"
	"cpi-go/db"
	"cpi-go/internal/shared/socle"
	"fmt"
	"math"
	"strconv"
	"time"
)

const (
	outilAppels       = "appels"
	outilVentes       = "ventes"
	outilDossiers     = "dossiers_bancaires"
	colonneAppels     = "Appels"
	colonneJoints     = "Joints"
	libelleCanal      = "Canal"
	axeJour           = "jour"
	axeTeleconseiller = "teleconseiller"
	libelleTotal      = "Total"
	periodeParDefaut  = "30_derniers_jours"
	periodeTrimestre  = "90_derniers_jours"
	filtresChiffres   = "chiffres"
	filtresBanque     = "banque"
)

type parametres struct {
	du, au         time.Time
	maintenant     time.Time
	jour           time.Time
	projet         *string
	teleconseiller *string
	axe            string
}

type ecranOutil struct {
	route      string
	permission socle.Permission
	filtres    string
}

// `projet` et `portefeuille` disent si le filtre de projet et la portée du rôle
// s'appliquent : ils suivent l'écran qui montre les mêmes chiffres.
type outil struct {
	libelle      string
	description  string
	permission   socle.Permission
	source       string
	axes         []string
	periode      string
	futur        bool
	projet       bool
	portefeuille bool
	ecran        ecranOutil
	executer     func(context.Context, *db.Queries, *parametres) (Resultat, error)
}

var (
	ecranChiffres            = ecranOutil{"/teleconseil/tableau-de-bord", socle.PermissionAnalyticsSuperviser, filtresChiffres}
	ecranAppelsRepresentants = ecranOutil{"/teleconseil/supervision", socle.PermissionAnalyticsSuperviser, ""}
)

var outils = map[string]*outil{
	outilAppels: {
		libelle: colonneAppels, description: "Appels passés aux prospects, appels joints et fiches appelées, jour par jour, sur une période.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les appels consignés aux prospects, datés du jour de l'appel",
		periode: periodeParDefaut, projet: true, portefeuille: true, ecran: ecranChiffres, executer: appels,
	},
	"conversions_par_canal": {
		libelle: "Conversions par canal", description: "Prospects créés sur une période par canal de provenance : joints, convertis, perdus, taux de conversion.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les fiches créées sur la période, par canal de provenance",
		periode: periodeParDefaut, projet: true, portefeuille: true, ecran: ecranChiffres, executer: conversionsParCanal,
	},
	"prevision_conversions": {
		libelle: "Prévision des conversions", description: "Prévision des conversions à venir parmi les fiches ouvertes, par canal et projet, d'après le taux des six derniers mois.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les fiches ouvertes et le taux de conversion des six mois qui précèdent la fin de période",
		periode: periodeParDefaut, projet: true, portefeuille: true, ecran: ecranChiffres, executer: prevision,
	},
	outilVentes: {
		libelle: "Ventes", description: "Ventes saisies sur une période : nombre, lots, montant total et montant encaissé, par site, par téléconseiller, par canal ou par jour.",
		permission: socle.PermissionVentesLire, source: "les ventes saisies et non archivées, datées du jour de souscription",
		axes: []string{"site", axeTeleconseiller, "canal", axeJour}, periode: periodeParDefaut,
		ecran: ecranOutil{"/ventes", socle.PermissionVentesLire, ""}, executer: ventes,
	},
	outilDossiers: {
		libelle: "Dossiers Banque & Finance", description: "Dossiers de financement créés sur une période : nombre, encaissés, rejetés et montant encaissé, par étape ou par banque.",
		permission: socle.PermissionBanqueLire, source: "les dossiers Banque & Finance créés sur la période, classés par leur étape actuelle",
		axes: []string{"etape", "banque"}, periode: periodeParDefaut, projet: true,
		ecran: ecranOutil{"/finance", socle.PermissionBanqueLire, filtresBanque}, executer: dossiersBancaires,
	},
	"visites": {
		libelle: "Visites de l'accueil", description: "Visites enregistrées à l'accueil sur une période, par jour ou par objet de la visite.",
		permission: socle.PermissionAccueilRegistre, source: "le registre des visites, hors visites archivées",
		axes: []string{axeJour, "objet"}, periode: periodeParDefaut,
		ecran: ecranOutil{"/accueil/tableau-de-bord", socle.PermissionAccueilRegistre, filtresChiffres}, executer: visites,
	},
	"rendez_vous": {
		libelle: "Rendez-vous", description: "Rendez-vous obtenus au téléphone dont la date tombe dans la période : obtenus, honorés, non honorés, reportés, par type ou par jour.",
		permission: socle.PermissionRendezVousVoir, source: "les fiches en rendez-vous, datées par leur rappel",
		axes: []string{"type", axeJour}, periode: periodeParDefaut, futur: true, projet: true,
		ecran: ecranOutil{"/accueil/rendez-vous", socle.PermissionRendezVousVoir, ""}, executer: rendezVous,
	},
	"appels_representants": {
		libelle: "Appels aux représentants", description: "Appels passés aux représentants syndicaux (CHUES) sur une période : appels, joints, représentants appelés, par jour ou par téléconseiller.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les appels consignés aux représentants, datés du jour de l'appel",
		axes: []string{axeJour, axeTeleconseiller}, periode: periodeParDefaut, portefeuille: true,
		ecran: ecranAppelsRepresentants, executer: appelsRepresentants,
	},
	"rappels": {
		libelle: "Rappels", description: "Rappels promis aux prospects dont l'échéance tombe dans la période, par téléconseiller : promis, honorés, en retard, à venir, annulés.",
		permission: socle.PermissionAnalyticsSuperviser, source: "les rappels promis, datés par leur échéance",
		periode: periodeTrimestre, futur: true, projet: true, portefeuille: true,
		ecran: ecranOutil{"/teleconseil/rappels", socle.PermissionFichesTenir, ""}, executer: rappels,
	},
	"campagnes": {
		libelle: "Avancement des campagnes", description: "Avancement des campagnes d'appels créées sur la période : fiches confiées, fiches traitées, taux d'exploitation, appelées aujourd'hui, dernier appel.",
		permission: socle.PermissionCampagnesSuperviser, source: "les campagnes créées sur la période, une fiche étant traitée dès son premier appel",
		periode: periodeTrimestre, projet: true, portefeuille: true,
		ecran: ecranOutil{"/teleconseil/campagnes", socle.PermissionCampagnesSuperviser, ""}, executer: campagnes,
	},
}

var libellesAxes = map[string]string{
	axeJour: "Jour", "site": "Site", axeTeleconseiller: "Téléconseiller", "canal": libelleCanal,
	"etape": "Étape", "banque": "Banque", "objet": "Objet", "type": "Type",
}

type outilDecrit struct {
	Description string   `json:"description"`
	Axes        []string `json:"axes,omitempty"`
}

func outilsPermis(u *socle.Utilisateur) map[string]outilDecrit {
	permis := map[string]outilDecrit{}
	for nom, o := range outils {
		if u.Peut(o.permission) {
			permis[nom] = outilDecrit{Description: o.description, Axes: o.axes}
		}
	}
	return permis
}

func taux(part, total int64) float64 {
	if total == 0 {
		return 0
	}
	return math.Round(float64(part)/float64(total)*1000) / 10
}

func pourcent(v float64) string {
	return strconv.FormatFloat(v, 'f', 1, 64) + " %"
}

func entier(v int32) string { return strconv.Itoa(int(v)) }

func fcfa(v int64) string { return parTroisChiffres(strconv.FormatInt(v, 10)) + " FCFA" }

type compte struct {
	groupe  string
	details []string
	valeurs []int64
}

// Les colonnes d'un tableau de comptes : `trace` est la valeur du graphique ;
// `taux`, s'il est nommé, rapporte la valeur `num` à la valeur `den`.
type grille struct {
	entete   string
	details  []string
	noms     []string
	montants map[int]bool
	taux     string
	num, den int
	trace    int
}

func (g *grille) ligne(c *compte) []string {
	ligne := append([]string{c.groupe}, c.details...)
	for i, v := range c.valeurs {
		if g.montants[i] {
			ligne = append(ligne, fcfa(v))
			continue
		}
		ligne = append(ligne, strconv.FormatInt(v, 10))
	}
	if g.taux != "" {
		ligne = append(ligne, pourcent(taux(c.valeurs[g.num], c.valeurs[g.den])))
	}
	return ligne
}

// Plusieurs lignes reçoivent un total : c'est lui que lit une question « combien ».
func (g *grille) resultat(comptes []compte) Resultat {
	colonnes := append(append([]string{g.entete}, g.details...), g.noms...)
	if g.taux != "" {
		colonnes = append(colonnes, g.taux)
	}
	r := Resultat{Tableau: Tableau{Colonnes: colonnes, Lignes: [][]string{}}, Serie: []Point{}, Mesure: g.noms[g.trace]}
	total := compte{groupe: libelleTotal, details: make([]string, len(g.details)), valeurs: make([]int64, len(g.noms))}
	for i := range comptes {
		r.Tableau.Lignes = append(r.Tableau.Lignes, g.ligne(&comptes[i]))
		r.Serie = append(r.Serie, Point{Libelle: comptes[i].groupe, Valeur: float64(comptes[i].valeurs[g.trace])})
		for j, v := range comptes[i].valeurs {
			total.valeurs[j] += v
		}
	}
	if len(comptes) > 1 {
		r.Tableau.Lignes = append(r.Tableau.Lignes, g.ligne(&total))
	}
	return r
}

func enteteAxe(axe string) string {
	if libelle, ok := libellesAxes[axe]; ok {
		return libelle
	}
	return libelleTotal
}

func appels(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantAppels(ctx, db.AssistantAppelsParams{Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: []string{"Jour", colonneAppels, colonneJoints, "Taux joints", "Fiches appelées"}, Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: colonneAppels,
	}
	var total, joints int32
	for _, l := range lignes {
		total, joints = total+l.Appels, joints+l.Joints
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{l.Jour, entier(l.Appels), entier(l.Joints), pourcent(taux(int64(l.Joints), int64(l.Appels))), entier(l.Fiches)})
		r.Serie = append(r.Serie, Point{Libelle: l.Jour, Valeur: float64(l.Appels)})
	}
	r.Tableau.Lignes = append(r.Tableau.Lignes, []string{libelleTotal, entier(total), entier(joints), pourcent(taux(int64(joints), int64(total))), ""})
	return r, nil
}

func conversionsParCanal(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantConversionsParCanal(ctx, db.AssistantConversionsParCanalParams{Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: []string{libelleCanal, "Prospects", colonneJoints, "Convertis", "Perdus", "Taux de conversion"}, Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: "Taux de conversion",
	}
	for _, l := range lignes {
		t := taux(int64(l.Convertis), int64(l.Prospects))
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{l.Canal, entier(l.Prospects), entier(l.Joints), entier(l.Convertis), entier(l.Perdus), pourcent(t)})
		r.Serie = append(r.Serie, Point{Libelle: l.Canal, Valeur: t})
	}
	return r, nil
}

// Le taux d'un groupe est celui de ses fiches tranchées (converties ou perdues)
// depuis six mois ; sous dix fiches tranchées il ne dit rien et n'est pas appliqué.
func prevision(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	depuis := p.au.AddDate(0, 0, -historiqueJours)
	lignes, err := q.AssistantPrevision(ctx, db.AssistantPrevisionParams{Depuis: depuis, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	r := Resultat{
		Tableau: Tableau{Colonnes: []string{libelleCanal, "Projet", "Fiches ouvertes", "Tranchées sur 6 mois", "Taux historique", "Conversions attendues"}, Lignes: [][]string{}},
		Serie:   []Point{}, Mesure: "Conversions attendues",
	}
	attenduesTotal := 0.0
	for _, l := range lignes {
		tranchees := l.Convertis + l.Perdus
		tauxLu, attendues := "Historique insuffisant", "Non estimé"
		if tranchees >= trancheesMinimum {
			t := taux(int64(l.Convertis), int64(tranchees))
			estime := float64(l.Ouverts) * t / 100
			attenduesTotal += estime
			tauxLu, attendues = pourcent(t), strconv.FormatFloat(estime, 'f', 0, 64)
			r.Serie = append(r.Serie, Point{Libelle: fmt.Sprintf("%s %s", l.Canal, l.Projet), Valeur: float64(int(estime + 0.5))})
		}
		r.Tableau.Lignes = append(r.Tableau.Lignes, []string{l.Canal, l.Projet, entier(l.Ouverts), entier(tranchees), tauxLu, attendues})
	}
	r.Tableau.Lignes = append(r.Tableau.Lignes, []string{libelleTotal, "", "", "", "", strconv.FormatFloat(attenduesTotal, 'f', 0, 64)})
	return r, nil
}

func ventes(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantVentes(ctx, db.AssistantVentesParams{Axe: p.axe, Du: p.du, Au: p.au})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Ventes), int64(l.Lots), l.Montant, l.Encaisse}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: []string{"Ventes", "Lots", "Montant", "Encaissé"}, montants: map[int]bool{2: true, 3: true}, trace: 2}
	return g.resultat(comptes), nil
}

func dossiersBancaires(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantDossiersBancaires(ctx, db.AssistantDossiersBancairesParams{Axe: p.axe, Du: p.du, Au: p.au, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Dossiers), int64(l.Encaisses), int64(l.Rejetes), l.MontantEncaisse}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: []string{"Dossiers", "Encaissés", "Rejetés", "Montant encaissé"}, montants: map[int]bool{3: true}}
	return g.resultat(comptes), nil
}

func visites(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantVisites(ctx, db.AssistantVisitesParams{Axe: p.axe, Du: p.du, Au: p.au})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Visites)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: []string{"Visites"}}
	return g.resultat(comptes), nil
}

func rendezVous(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantRendezVous(ctx, db.AssistantRendezVousParams{Axe: p.axe, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Obtenus), int64(l.Honores), int64(l.NonHonores), int64(l.Reportes)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: []string{"Obtenus", "Honorés", "Non honorés", "Reportés"}, taux: "Taux honorés", num: 1}
	return g.resultat(comptes), nil
}

func appelsRepresentants(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantAppelsRepresentants(ctx, db.AssistantAppelsRepresentantsParams{Axe: p.axe, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Groupe, valeurs: []int64{int64(l.Appels), int64(l.Joints), int64(l.Representants)}})
	}
	g := grille{entete: enteteAxe(p.axe), noms: []string{colonneAppels, colonneJoints, "Représentants appelés"}, taux: "Taux joints", num: 1}
	return g.resultat(comptes), nil
}

func rappels(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AssistantRappels(ctx, db.AssistantRappelsParams{
		Maintenant: p.maintenant, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet,
	})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		comptes = append(comptes, compte{groupe: l.Teleconseiller, valeurs: []int64{int64(l.Promis), int64(l.Honores), int64(l.EnRetard), int64(l.AVenir), int64(l.Annules)}})
	}
	g := grille{entete: "Téléconseiller", noms: []string{"Promis", "Honorés", "En retard", "À venir", "Annulés"}, trace: 2}
	return g.resultat(comptes), nil
}

func campagnes(ctx context.Context, q *db.Queries, p *parametres) (Resultat, error) {
	lignes, err := q.AvancementCampagnes(ctx, db.AvancementCampagnesParams{
		Depuis: p.jour, Du: p.du, Au: p.au, Teleconseiller: p.teleconseiller, Projet: p.projet,
	})
	if err != nil {
		return Resultat{}, err
	}
	comptes := make([]compte, 0, len(lignes))
	for _, l := range lignes {
		etat := "Active"
		if l.EnPause {
			etat = "En pause"
		}
		comptes = append(comptes, compte{
			groupe: l.Name, details: []string{libelleProjet(l.Projet), etat, l.DernierAppel},
			valeurs: []int64{int64(l.Fiches), int64(l.Traitees), int64(l.AppeleesDepuis)},
		})
	}
	g := grille{
		entete: "Campagne", details: []string{"Projet", "État", "Dernier appel"},
		noms: []string{"Fiches confiées", "Fiches traitées", "Appelées aujourd'hui"}, taux: "Taux d'exploitation", num: 1, trace: 1,
	}
	return g.resultat(comptes), nil
}
