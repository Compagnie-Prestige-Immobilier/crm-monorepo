package main

import (
	"cpi-go/db"
	"cpi-go/internal/banque"
	"cpi-go/internal/exports"
	"fmt"
)

const (
	seedNomDakar       = "Dakar"
	seedNomDiourbel    = "Diourbel"
	seedNomFatick      = "Fatick"
	seedNomKaffrine    = "Kaffrine"
	seedNomKedougou    = "Kédougou"
	seedNomKolda       = "Kolda"
	seedNomLouga       = "Louga"
	seedNomMatam       = "Matam"
	seedNomSedhiou     = "Sédhiou"
	seedNomTambacounda = "Tambacounda"
	seedNomZiguinchor  = "Ziguinchor"

	seedCodeDakar      = "DK-DAK"
	seedCodePikine     = "DK-PIK"
	seedCodeRufisque   = "DK-RUF"
	seedCodeFatick     = "FK-FAT"
	seedCodeKaolack    = "KL-KAO"
	seedCodePodor      = "SL-POD"
	seedCodeMbour      = "TH-MBO"
	seedCodeBignona    = "ZG-BIG"
	seedCodeSaintLouis = "SL-STL"
	seedCodeThies      = "TH-THI"

	seedLibelleAutre             = "Autre"
	seedSecteurCentraleSyndicale = "Centrale syndicale"
	seedSecteurEducation         = "Éducation"
	seedSecteurSante             = "Santé"
	seedEntrepriseSantargile     = "SANTARGILE"
)

type seedDepartement struct{ code, name string }

type seedRegion struct {
	code, name   string
	departements []seedDepartement
}

var seedRegions = []seedRegion{
	{code: "DK", name: seedNomDakar, departements: []seedDepartement{
		{seedCodeDakar, seedNomDakar},
		{"DK-GUE", "Guédiawaye"},
		{"DK-KMA", "Keur Massar"},
		{seedCodePikine, "Pikine"},
		{seedCodeRufisque, "Rufisque"},
	}},
	{code: "DB", name: seedNomDiourbel, departements: []seedDepartement{
		{"DB-BAM", "Bambey"}, {"DB-DIO", seedNomDiourbel}, {"DB-MBA", "Mbacké"},
	}},
	{code: "FK", name: seedNomFatick, departements: []seedDepartement{
		{seedCodeFatick, seedNomFatick}, {"FK-FOU", "Foundiougne"}, {"FK-GOS", "Gossas"},
	}},
	{code: "KA", name: seedNomKaffrine, departements: []seedDepartement{
		{"KA-BIR", "Birkelane"}, {"KA-KAF", seedNomKaffrine}, {"KA-KOU", "Koungheul"}, {"KA-MAL", "Malem Hodar"},
	}},
	{code: "KL", name: "Kaolack", departements: []seedDepartement{
		{"KL-GUI", "Guinguinéo"}, {seedCodeKaolack, "Kaolack"}, {"KL-NIO", "Nioro du Rip"},
	}},
	{code: "KE", name: seedNomKedougou, departements: []seedDepartement{
		{"KE-KED", seedNomKedougou}, {"KE-SAL", "Salémata"}, {"KE-SAR", "Saraya"},
	}},
	{code: "KD", name: seedNomKolda, departements: []seedDepartement{
		{"KD-KOL", seedNomKolda}, {"KD-MYF", "Médina Yoro Foulah"}, {"KD-VEL", "Vélingara"},
	}},
	{code: "LG", name: seedNomLouga, departements: []seedDepartement{
		{"LG-KEB", "Kébémer"}, {"LG-LIN", "Linguère"}, {"LG-LOU", seedNomLouga},
	}},
	{code: "MT", name: seedNomMatam, departements: []seedDepartement{
		{"MT-KAN", "Kanel"}, {"MT-MAT", seedNomMatam}, {"MT-RAN", "Ranérou Ferlo"},
	}},
	{code: "SL", name: "Saint-Louis", departements: []seedDepartement{
		{"SL-DAG", "Dagana"}, {seedCodePodor, "Podor"}, {seedCodeSaintLouis, "Saint-Louis"},
	}},
	{code: "SE", name: seedNomSedhiou, departements: []seedDepartement{
		{"SE-BOU", "Bounkiling"}, {"SE-GOU", "Goudomp"}, {"SE-SED", seedNomSedhiou},
	}},
	{code: "TC", name: seedNomTambacounda, departements: []seedDepartement{
		{"TC-BAK", "Bakel"}, {"TC-GOU", "Goudiry"}, {"TC-KOU", "Koumpentoum"}, {"TC-TAM", seedNomTambacounda},
	}},
	{code: "TH", name: "Thiès", departements: []seedDepartement{
		{seedCodeMbour, "Mbour"}, {seedCodeThies, "Thiès"}, {"TH-TIV", "Tivaouane"},
	}},
	{code: "ZG", name: seedNomZiguinchor, departements: []seedDepartement{
		{seedCodeBignona, "Bignona"}, {"ZG-OUS", "Oussouye"}, {"ZG-ZIG", seedNomZiguinchor},
	}},
}

func seedDepartementCount() int {
	total := 0
	for _, region := range seedRegions {
		total += len(region.departements)
	}
	return total
}

type seedIef struct{ code, name, departementCode string }

var seedIefs = []seedIef{
	{"DK-DAK-ALMA", "Almadies", seedCodeDakar},
	{"DK-DAK-DAKA", "Dakar Plateau", seedCodeDakar},
	{"DK-DAK-GRAN", "Grand Dakar", seedCodeDakar},
	{"DK-DAK-PARC", "Parcelles Assainies", seedCodeDakar},
	{"DK-GUE-GUED", "Guédiawaye", "DK-GUE"},
	{"DK-KMA-KEUR", "Keur Massar", "DK-KMA"},
	{"DK-PIK-PIKI", "Pikine", seedCodePikine},
	{"DK-PIK-THIA", "Thiaroye", seedCodePikine},
	{"DK-RUF-DIAM", "Diamniadio", seedCodeRufisque},
	{"DK-RUF-RUFI", "Rufisque Commune", seedCodeRufisque},
	{"DK-RUF-SANG", "Sangalkam", seedCodeRufisque},
	{"TH-MBO-MBOU", "Mbour 1", seedCodeMbour},
	{"TH-MBO-MBOU2", "Mbour 2", seedCodeMbour},
	{"TH-THI-THIE", "Thiès Commune", seedCodeThies},
	{"TH-THI-THIE2", "Thiès Département", seedCodeThies},
	{"TH-TIV-TIVA", "Tivaouane", "TH-TIV"},
	{"DB-BAM-BAMB", "Bambey", "DB-BAM"},
	{"DB-DIO-DIOU", seedNomDiourbel, "DB-DIO"},
	{"DB-MBA-MBAC", "Mbacké", "DB-MBA"},
	{"FK-FAT-DIOF", "Diofior", seedCodeFatick},
	{"FK-FAT-FATI", seedNomFatick, seedCodeFatick},
	{"FK-FOU-FOUN", "Foundiougne", "FK-FOU"},
	{"FK-GOS-GOSS", "Gossas", "FK-GOS"},
	{"KA-BIR-BIRK", "Birkelane", "KA-BIR"},
	{"KA-KAF-KAFF", seedNomKaffrine, "KA-KAF"},
	{"KA-KOU-KOUN", "Koungheul", "KA-KOU"},
	{"KA-MAL-MALE", "Malem Hoddar", "KA-MAL"},
	{"KL-GUI-GUIN", "Guinguinéo", "KL-GUI"},
	{"KL-KAO-KAOL", "Kaolack Commune", seedCodeKaolack},
	{"KL-KAO-KAOL2", "Kaolack-Département", seedCodeKaolack},
	{"KL-NIO-NIOR", "Nioro", "KL-NIO"},
	{"KE-KED-KEDO", seedNomKedougou, "KE-KED"},
	{"KE-SAL-SALE", "Salémata", "KE-SAL"},
	{"KE-SAR-SARA", "Saraya", "KE-SAR"},
	{"KD-KOL-KOLD", seedNomKolda, "KD-KOL"},
	{"KD-MYF-MEDI", "Médina Yoro Foulah", "KD-MYF"},
	{"KD-VEL-VELI", "Vélingara", "KD-VEL"},
	{"LG-KEB-KEBE", "Kébémer", "LG-KEB"},
	{"LG-LIN-LING", "Linguère", "LG-LIN"},
	{"LG-LOU-LOUG", seedNomLouga, "LG-LOU"},
	{"MT-KAN-KANE", "Kanel", "MT-KAN"},
	{"MT-MAT-MATA", seedNomMatam, "MT-MAT"},
	{"MT-RAN-RANE", "Ranérou", "MT-RAN"},
	{"SL-DAG-DAGA", "Dagana", "SL-DAG"},
	{"SL-POD-PETE", "Pété", seedCodePodor},
	{"SL-POD-PODO", "Podor", seedCodePodor},
	{"SL-STL-SAIN", "Saint-Louis Commune", seedCodeSaintLouis},
	{"SL-STL-SAIN2", "Saint-Louis Département", seedCodeSaintLouis},
	{"SE-BOU-BOUN", "Bounkiling", "SE-BOU"},
	{"SE-GOU-GOUD", "Goudomp", "SE-GOU"},
	{"SE-SED-SEDH", seedNomSedhiou, "SE-SED"},
	{"TC-BAK-BAKE", "Bakel", "TC-BAK"},
	{"TC-GOU-GOUD", "Goudiry", "TC-GOU"},
	{"TC-KOU-KOUM", "Koumpentoum", "TC-KOU"},
	{"TC-TAM-TAMB", seedNomTambacounda, "TC-TAM"},
	{"ZG-BIG-BIGN", "Bignona 1", seedCodeBignona},
	{"ZG-BIG-BIGN2", "Bignona 2", seedCodeBignona},
	{"ZG-OUS-OUSS", "Oussouye", "ZG-OUS"},
	{"ZG-ZIG-ZIGU", seedNomZiguinchor, "ZG-ZIG"},
}

type seedBanque struct {
	name, shortName string
	sortOrder       int32
}

var seedBanques = []seedBanque{
	{"CBAO, Groupe Attijariwafa Bank", exports.ExportCleCbao, 1},
	{"Société Générale Sénégal", "SGS", 2},
	{"Ecobank Sénégal", "Ecobank", 3},
	{"Banque de l'Habitat du Sénégal", "BHS", 4},
	{"Bank of Africa Sénégal", "BOA Sénégal", 10},
	{"Banque Atlantique Sénégal", "Banque Atlantique", 11},
	{"Banque Islamique du Sénégal", "BIS", 12},
	{"La Banque Agricole", "LBA", 13},
	{"United Bank for Africa Sénégal", "UBA Sénégal", 14},
	{"Sunu Bank Sénégal", "Sunu Bank", 15},
	{"Coris Bank International Sénégal", "CBI Sénégal", 16},
	{"Banque Nationale pour le Développement Économique", "BNDE", 17},
	{"Orabank Côte d’Ivoire, succursale du Sénégal", "Orabank", 18},
	{"Orange Bank Africa, succursale du Sénégal", "Orange Bank", 19},
	{"Crédit du Sénégal", "CDS", 20},
	{"Banque des Institutions Mutualistes d'Afrique de l'Ouest", "BIMAO", 30},
	{"Banque Régionale de Marchés", "BRM", 31},
	{"Banque Sahélo-Saharienne pour l'Investissement et le Commerce - Sénégal", "BSIC Sénégal", 32},
	{"Citibank Sénégal", "Citibank", 33},
	{"Crédit International", "CI", 34},
	{"BGFIBank Sénégal", "BGFIBank", 35},
	{"FBNBank Sénégal", "FBNBank", 36},
	{"Afrika Banque Sénégal", "Afrika Banque", 37},
	{"La Banque Ourtade", "LBO", 38},
	{"Algerian Bank of Sénégal", "ABS", 39},
	{"NSIA Banque Bénin, succursale du Sénégal", "NSIA Banque", 40},
	{"Banque pour le Commerce et l'Industrie du Mali, succursale du Sénégal", "BCI Mali", 41},
	{"Bridge Bank Group Côte d’Ivoire, succursale du Sénégal", "Bridge Bank", 42},
	{"Banque de Développement du Mali, succursale du Sénégal", "BDM", 43},
	{"Crédit Mutuel du Sénégal", "CMS", 60},
	{"PAMECAS", "PAMECAS", 61},
	{"ACEP Sénégal", "ACEP", 62},
	{"Baobab Sénégal", "Baobab", 63},
	{"Autre établissement", seedLibelleAutre, 900},
	{"Aucune domiciliation bancaire", "Aucune", 901},
}

type seedSyndicat struct {
	name, sigle, secteur string
	sortOrder            int32
}

var seedSyndicats = []seedSyndicat{
	{"Coopérative d'Habitat de l'Union des Enseignants du Sénégal", "CHUES", "Coopérative d'habitat", 1},
	{"Union des Enseignants du Sénégal", "UES", seedSecteurEducation, 2},
	{"Syndicat Autonome des Enseignants du Moyen Secondaire du Sénégal", "SAEMSS", seedSecteurEducation, 10},
	{"Cadre Unitaire Syndical des Enseignants du Moyen Secondaire", "CUSEMS", seedSecteurEducation, 11},
	{"Syndicat des Enseignants Libres du Sénégal", "SELS", seedSecteurEducation, 12},
	{"Syndicat des Enseignants Libres du Sénégal / Authentique", "SELS/A", seedSecteurEducation, 13},
	{"Union Démocratique des Enseignantes et Enseignants du Sénégal", "UDEN", seedSecteurEducation, 14},
	{"Syndicat National des Enseignants en Langue Arabe du Sénégal", "SNELAS/FC", seedSecteurEducation, 15},
	{"Syndicat des Inspectrices et Inspecteurs de l'Éducation Nationale du Sénégal", "SIENS", seedSecteurEducation, 16},
	{"Syndicat Autonome de l'Enseignement Supérieur", "SAES", "Enseignement supérieur", 20},
	{"Syndicat Unique des Travailleurs de la Santé et de l’Action Sociale", "SUTSAS", seedSecteurSante, 30},
	{"Syndicat Autonome des Médecins du Sénégal", "SAMES", seedSecteurSante, 31},
	{"Syndicat Autonome des Travailleurs de la Santé", "SAT-Santé", seedSecteurSante, 32},
	{"Confédération Nationale des Travailleurs du Sénégal", "CNTS", seedSecteurCentraleSyndicale, 40},
	{"Confédération Nationale des Travailleurs du Sénégal / Forces du Changement", "CNTS/FC", seedSecteurCentraleSyndicale, 41},
	{"Union Nationale des Syndicats Autonomes du Sénégal", "UNSAS", seedSecteurCentraleSyndicale, 42},
	{"Confédération des Syndicats Autonomes du Sénégal", "CSA", seedSecteurCentraleSyndicale, 43},
	{"Union Démocratique des Travailleurs du Sénégal", "UDTS", seedSecteurCentraleSyndicale, 44},
	{"Syndicat des Travailleurs de la Justice", "SYTJUST", "Justice", 50},
	{"Syndicat des Professionnels de l'Information et de la Communication du Sénégal", "SYNPICS", "Presse", 51},
	{"Syndicat Unique des Travailleurs de l'Électricité", "SUTELEC", "Énergie", 52},
	{"Autre structure", banque.BanqueMotifAutre, seedLibelleAutre, 900},
	{"Aucune structure", "AUCUNE", seedLibelleAutre, 901},
}

type seedBankStage struct {
	code, label, color  string
	position            int32
	typ                 db.BankStageType
	isInitial, isSystem bool
}

var seedBankStages = []seedBankStage{
	{"A_TRAITER", "À traiter", "info", 1, db.BankStageTypeOPEN, true, true},
	{"EN_TRAITEMENT_BANQUE", "En traitement banque", seedCouleurWarning, 2, db.BankStageTypeOPEN, false, false},
	{"ENCAISSE", "Encaissé", seedCouleurSuccess, 100, db.BankStageTypeCASHED, false, true},
	{"REJETE", "Rejeté", "destructive", 101, db.BankStageTypeREJECTED, false, true},
}

type seedBankRejectionReason struct {
	code, label string
	sortOrder   int32
}

var seedBankRejectionReasons = []seedBankRejectionReason{
	{"SOLDE_INSUFFISANT", "Solde insuffisant", 1},
	{"DOCUMENT_MANQUANT", "Document manquant", 2},
	{"DOCUMENT_NON_CONFORME", "Document non conforme", 3},
	{"CLIENT_INJOIGNABLE", "Client injoignable", 4},
	{"REFUS_CLIENT", "Refus du client", 5},
	{"REFUS_BANQUE", "Refus de la banque", 6},
	{"COMPTE_CLOTURE", "Compte clôturé", 7},
	{"IDENTITE_NON_CONFORME", "Identité non conforme", 8},
	{"DOSSIER_DOUBLON", "Dossier en doublon", 9},
	{banque.BanqueMotifAutre, "Autre motif", 900},
}

type seedCallOutcomeReason struct {
	code, label, color                                 string
	effect                                             db.CallOutcomeEffect
	requiresComment, requiresCallback, countsAsReached bool
	sortOrder, minPayloadVersion                       int32
}

// Ces motifs sont le référentiel actif de qualification des prospects. Les
// anciens motifs restent en base pour préserver l'historique, mais sont désactivés.
const (
	seedCouleurWarning = "warning"
	seedCouleurSuccess = "success"
	seedCouleurDanger  = "danger"
	seedCouleurInfo    = "info"
)

var seedCallOutcomeReasons = []seedCallOutcomeReason{
	{"REFUS_DEJA_ENGAGE", "Déjà engagé", seedCouleurDanger, db.CallOutcomeEffectCLOSEREFUSED, false, false, true, 10, 9},
	{"REFUS_PAS_CONFIANCE", "Pas confiance", seedCouleurDanger, db.CallOutcomeEffectCLOSEREFUSED, false, false, true, 11, 9},
	{"REFUS_MEFIANT", "Méfiant", seedCouleurDanger, db.CallOutcomeEffectCLOSEREFUSED, false, false, true, 12, 9},
	{"REFUS_NE_VEUT_PAS", "Ne veut pas", seedCouleurDanger, db.CallOutcomeEffectCLOSEREFUSED, false, false, true, 13, 9},
	{"REFUS_PAS_POUR_LE_MOMENT", "Pas pour le moment", seedCouleurDanger, db.CallOutcomeEffectCLOSEREFUSED, false, false, true, 14, 9},
	{"DEMANDE_INFORMATION", "Demande d’information", seedCouleurInfo, db.CallOutcomeEffectSCHEDULECALLBACK, true, true, true, 20, 9},
	{"RDV_TELEPHONIQUE", "RDV téléphonique", seedCouleurInfo, db.CallOutcomeEffectSCHEDULECALLBACK, true, true, true, 21, 9},
	{"TRANSFERT_ENROLEMENT", "Transfert enrôlement", seedCouleurSuccess, db.CallOutcomeEffectCLOSEMETHOD, false, false, true, 22, 9},
	{"CONSTRUCTION", "Construction", seedCouleurInfo, db.CallOutcomeEffectSCHEDULECALLBACK, true, true, true, 23, 9},
	{"PARTENARIAT", "Partenariat", seedCouleurInfo, db.CallOutcomeEffectKEEPOPEN, true, false, true, 24, 9},
	{"HORS_CIBLE", "Hors cible", seedCouleurDanger, db.CallOutcomeEffectCLOSEREFUSED, true, false, true, 25, 9},
	{"AUTRES", "Autres", "neutral", db.CallOutcomeEffectKEEPOPEN, true, false, true, 26, 9},
}

type seedCanalProvenance struct {
	code, label string
	position    int32
}

var seedCanauxProvenance = []seedCanalProvenance{
	{"TIKTOK", "TikTok", 10},
	{"FACEBOOK", "Facebook", 20},
	{"GOOGLE", "Google (Search / Ads)", 22},
	{"META", "Meta (Facebook et Instagram)", 25},
	{"INSTAGRAM", "Instagram", 30},
	{"FACEBOOK_INSTAGRAM", "Facebook / Instagram", 35},
	{"MESSENGER", "Messenger", 45},
	{"LINKEDIN", "LinkedIn", 40},
	{"WHATSAPP", "WhatsApp", 50},
	{"SITE_WEB", "Site web", 60},
	{"PARRAINAGE", "Parrainage", 70},
	{"BOUCHE_A_OREILLE", "Bouche à oreille", 80},
	{"SALON", "Salon ou foire", 90},
	{"AFFICHAGE", "Affichage et panneaux", 100},
	{"RADIO_TV", "Radio ou télévision", 110},
	{"APPEL_ENTRANT", "Appel entrant", 120},
	{"VISITE_AGENCE", "Visite en agence", 130},
	{"DIASPORA", "Relais diaspora", 140},
}

type seedProfession struct {
	code, label string
	isTeaching  bool
	position    int32
}

type seedGroupeProfession struct {
	enseignement bool
	libelles     []string
}

func seedGroupesProfessions() []seedGroupeProfession {
	return []seedGroupeProfession{
		{false, []string{
			"Directeur général", "Directeur administratif", "Directeur financier", "Directeur des ressources humaines",
			"Directeur des opérations", "Directeur de programme", "Gérant d’entreprise", "Responsable d’agence",
			"Chef de service", "Chef de projet", "Entrepreneur", "Consultant en management",
		}},
		{true, []string{
			"Enseignant du préscolaire", "Instituteur", "Professeur des collèges", "Professeur de lycée",
			"Professeur d’université", "Maître de conférences", "Assistant universitaire", "Formateur professionnel",
			"Éducateur spécialisé", "Conseiller pédagogique", "Inspecteur de l’éducation", "Proviseur",
			"Principal de collège", "Directeur d’école", "Surveillant scolaire", "Bibliothécaire",
			"Documentaliste", "Chercheur", "Moniteur d’alphabétisation", "Maître coranique",
		}},
		{false, []string{
			"Médecin généraliste", "Médecin spécialiste", "Chirurgien", "Dentiste", "Pharmacien", "Sage-femme",
			"Infirmier", "Aide-soignant", "Technicien de laboratoire", "Technicien en imagerie médicale",
			"Kinésithérapeute", "Psychologue", "Nutritionniste", "Opticien", "Vétérinaire",
			"Agent de santé communautaire", "Secrétaire médical", "Ambulancier", "Préparateur en pharmacie", "Hygiéniste",
		}},
		{false, []string{
			"Administrateur civil", "Secrétaire administratif", "Assistant de direction", "Secrétaire",
			"Agent d’accueil", "Archiviste", "Comptable", "Aide-comptable", "Auditeur", "Contrôleur de gestion",
			"Fiscaliste", "Trésorier", "Caissier", "Agent de recouvrement", "Gestionnaire de paie",
			"Chargé des ressources humaines", "Juriste", "Avocat", "Notaire", "Huissier de justice", "Greffier",
			"Magistrat", "Agent des impôts", "Agent du trésor", "Agent de collectivité territoriale", "Diplomate",
		}},
		{false, []string{
			"Banquier", "Conseiller clientèle bancaire", "Analyste financier", "Chargé de crédit",
			"Gestionnaire de portefeuille", "Courtier en assurance", "Agent d’assurance", "Actuaire",
			"Agent de microfinance", "Cambiste", "Contrôleur bancaire", "Opérateur de transfert d’argent",
		}},
		{false, []string{
			"Développeur web", "Développeur mobile", "Ingénieur logiciel", "Administrateur systèmes",
			"Administrateur réseaux", "Technicien informatique", "Technicien télécoms", "Analyste de données",
			"Data scientist", "Ingénieur cybersécurité", "Chef de produit numérique", "Designer graphique",
			"Designer UX/UI", "Community manager", "Spécialiste marketing numérique", "Opérateur de saisie",
			"Réparateur de téléphones", "Technicien fibre optique",
		}},
		{false, []string{
			"Ingénieur civil", "Ingénieur électromécanicien", "Ingénieur électricien", "Ingénieur industriel",
			"Ingénieur agronome", "Ingénieur hydraulicien", "Ingénieur environnement", "Architecte", "Urbaniste",
			"Géomètre", "Topographe", "Dessinateur en bâtiment", "Technicien génie civil",
			"Technicien supérieur industriel", "Électricien bâtiment", "Électromécanicien", "Frigoriste", "Plombier",
			"Maçon", "Carreleur", "Peintre en bâtiment", "Menuisier bois", "Menuisier aluminium", "Soudeur",
			"Ferrailleur", "Charpentier", "Vitrier",
		}},
		{false, []string{
			"Responsable commercial", "Vendeur en magasin", "Vendeur ambulant", "Commerçant", "Grossiste",
			"Détaillant", "Agent immobilier", "Courtier", "Télévendeur", "Chargé de clientèle", "Agent marketing",
			"Marchandiseur", "Acheteur", "Approvisionneur", "Magasinier", "Gestionnaire de stock",
			"Agent logistique", "Transitaire", "Déclarant en douane", "Agent de fret", "Gérant de boutique",
			"Gérant de quincaillerie",
		}},
		{false, []string{
			"Hôtelier", "Réceptionniste d’hôtel", "Cuisinier", "Pâtissier", "Boulanger", "Serveur de restaurant",
			"Traiteur", "Restaurateur", "Guide touristique", "Agent de voyage", "Coiffeur", "Esthéticien",
			"Tailleur", "Couturier", "Blanchisseur", "Pressing", "Photographe", "Vidéaste", "Musicien",
			"Artiste plasticien", "Décorateur", "Organisateur d’événements", "Agent d’entretien",
			"Employé de maison", "Gardien",
		}},
		{false, []string{
			"Chauffeur de taxi", "Chauffeur de bus", "Chauffeur poids lourd", "Conducteur de car rapide",
			"Conducteur de moto-taxi", "Livreur", "Mécanicien automobile", "Mécanicien moto",
			"Électricien automobile", "Tôlier automobile", "Peintre automobile", "Vulcanisateur",
			"Laveur de véhicules", "Agent de transport", "Contrôleur de transport", "Marin", "Docker", "Pilote",
			"Personnel navigant commercial", "Agent aéroportuaire",
		}},
		{false, []string{
			"Agriculteur", "Maraîcher", "Horticulteur", "Arboriculteur", "Éleveur bovin", "Éleveur ovin",
			"Aviculteur", "Apiculteur", "Pêcheur artisanal", "Mareyeur", "Aquaculteur", "Ouvrier agricole",
			"Technicien agricole", "Conseiller agricole", "Exploitant forestier", "Pépiniériste",
			"Transformateur de produits agricoles", "Meunier", "Boucher", "Poissonnier",
		}},
		{false, []string{
			"Opérateur de production", "Conducteur de machine", "Chef d’atelier", "Technicien de maintenance",
			"Responsable qualité", "Laborantin industriel", "Ouvrier agroalimentaire", "Ouvrier textile",
			"Imprimeur", "Sérigraphe", "Ébéniste", "Bijoutier", "Cordonnier", "Potier", "Tisserand", "Savonnier",
			"Transformateur de céréales", "Emballeur", "Manutentionnaire", "Mineur",
		}},
		{false, []string{
			"Militaire", "Gendarme", "Policier", "Sapeur-pompier", "Agent de sécurité", "Douanier",
			"Agent des eaux et forêts", "Agent pénitentiaire", "Maître-nageur", "Secouriste",
		}},
		{false, []string{
			"Journaliste", "Reporter", "Présentateur radio", "Présentateur télévision", "Animateur radio",
			"Chargé de communication", "Attaché de presse", "Rédacteur", "Traducteur", "Interprète", "Éditeur",
			"Libraire", "Technicien audiovisuel", "Ingénieur du son",
		}},
		{false, []string{
			"Assistant social", "Animateur communautaire", "Agent de développement local", "Conseiller en emploi",
			"Responsable associatif", "Agent d’ONG", "Médiateur", "Sociologue", "Économiste", "Statisticien",
			"Démographe", "Enquêteur", "Agent recenseur", "Religieux",
		}},
	}
}

func seedProfessionsListe() []seedProfession {
	var professions []seedProfession
	position := 0
	for _, groupe := range seedGroupesProfessions() {
		for _, libelle := range groupe.libelles {
			position++
			professions = append(professions, seedProfession{
				code:       fmt.Sprintf("PROF_%03d", position),
				label:      libelle,
				isTeaching: groupe.enseignement,
				position:   int32(position),
			})
		}
	}
	return professions
}

type seedIncomeBand struct {
	code, label    string
	minXof, maxXof *int32
	position       int32
}

func seedXof(v int32) *int32 { return &v }

var seedIncomeBands = []seedIncomeBand{
	{"LT_50K", "Moins de 50 000 F CFA", nil, seedXof(49_999), 1},
	{"50K_100K", "50 000 à 100 000 F CFA", seedXof(50_000), seedXof(100_000), 2},
	{"100K_200K", "100 000 à 200 000 F CFA", seedXof(100_001), seedXof(200_000), 3},
	{"200K_300K", "200 000 à 300 000 F CFA", seedXof(200_001), seedXof(300_000), 4},
	{"300K_500K", "300 000 à 500 000 F CFA", seedXof(300_001), seedXof(500_000), 5},
	{"500K_750K", "500 000 à 750 000 F CFA", seedXof(500_001), seedXof(750_000), 6},
	{"750K_1M", "750 000 à 1 000 000 F CFA", seedXof(750_001), seedXof(1_000_000), 7},
	{"GT_1M", "Plus de 1 000 000 F CFA", seedXof(1_000_001), nil, 8},
}

type seedOffer struct {
	code, label string
	position    int32
}

var seedOffers = []seedOffer{
	{"ADHESION", "Adhésion", 10},
	{"VENTE", "Vente", 20},
}

type seedEmployeur struct {
	code, label string
	typ         db.EmployeurType
	position    int32
}

func seedEmployeursListe() []seedEmployeur {
	ministeres := [][2]string{
		{"MIN_FORCES_ARMEES", "Ministère des Forces armées"},
		{"MIN_INTERIEUR", "Ministère de l’Intérieur et de la Sécurité publique"},
		{"MIN_JUSTICE", "Ministère de la Justice"},
		{"MIN_AFFAIRES_ETRANGERES", "Ministère des Affaires étrangères et de l’Intégration africaine"},
		{"MIN_FINANCES_BUDGET", "Ministère des Finances et du Budget"},
		{"MIN_ECONOMIE_PLAN", "Ministère de l’Économie, du Plan et de la Coopération"},
		{"MIN_EDUCATION_NATIONALE", "Ministère de l’Éducation nationale"},
		{"MIN_ENSEIGNEMENT_SUPERIEUR", "Ministère de l’Enseignement supérieur, de la Recherche et de l’Innovation"},
		{"MIN_FORMATION_PROFESSIONNELLE", "Ministère de la Formation professionnelle et technique"},
		{"MIN_SANTE", "Ministère de la Santé et de l’Action sociale"},
		{"MIN_AGRICULTURE", "Ministère de l’Agriculture, de la Souveraineté alimentaire et de l’Élevage"},
		{"MIN_PECHES", "Ministère des Pêches, des Infrastructures maritimes et portuaires"},
		{"MIN_INFRASTRUCTURES", "Ministère des Infrastructures et des Transports terrestres et aériens"},
		{"MIN_HYDRAULIQUE", "Ministère de l’Hydraulique et de l’Assainissement"},
		{"MIN_ENERGIE_PETROLE_MINES", "Ministère de l’Énergie, du Pétrole et des Mines"},
		{"MIN_ENVIRONNEMENT", "Ministère de l’Environnement et de la Transition écologique"},
		{"MIN_URBANISME_COLLECTIVITES", "Ministère de l’Urbanisme, des Collectivités territoriales et de l’Aménagement des territoires"},
		{"MIN_COMMUNICATION_NUMERIQUE", "Ministère de la Communication, des Télécommunications et du Numérique"},
		{"MIN_INDUSTRIE_COMMERCE", "Ministère de l’Industrie et du Commerce"},
		{"MIN_TRAVAIL_EMPLOI", "Ministère du Travail, de l’Emploi et des Relations avec les institutions"},
		{"MIN_FONCTION_PUBLIQUE", "Ministère de la Fonction publique et de la Réforme du service public"},
		{"MIN_MICROFINANCE", "Ministère de la Microfinance et de l’Économie sociale et solidaire"},
		{"MIN_TOURISME_ARTISANAT", "Ministère du Tourisme et de l’Artisanat"},
		{"MIN_CULTURE", "Ministère de la Culture et du Patrimoine historique"},
		{"MIN_JEUNESSE_SPORTS", "Ministère de la Jeunesse et des Sports"},
		{"MIN_FAMILLE_SOLIDARITES", "Ministère de la Famille et des Solidarités"},
	}
	entreprises := [][2]string{
		{"EMP_SONATEL", "Sonatel (Orange Sénégal)"},
		{"EMP_FREE", "Free Sénégal"},
		{"EMP_EXPRESSO", "Expresso Sénégal"},
		{"EMP_SENELEC", "SENELEC"},
		{"EMP_SEN_EAU", "Sen’Eau"},
		{"EMP_SONES", "SONES"},
		{"EMP_PORT_AUTONOME_DAKAR", "Port autonome de Dakar"},
		{"EMP_AIR_SENEGAL", "Air Sénégal"},
		{"EMP_LA_POSTE", "La Poste"},
		{"EMP_DAKAR_DEM_DIKK", "Dakar Dem Dikk"},
		{"EMP_PETROSEN", "Petrosen"},
		{"EMP_ICS", "Industries chimiques du Sénégal"},
		{"EMP_SOCOCIM", "Sococim Industries"},
		{"EMP_EIFFAGE", "Eiffage Sénégal"},
		{"EMP_CBAO", "CBAO Attijariwafa Bank"},
		{"EMP_ECOBANK", "Ecobank Sénégal"},
		{"EMP_SGBS", "Société Générale Sénégal"},
		{"EMP_BICIS", "BICIS"},
	}
	employeurs := make([]seedEmployeur, 0, len(ministeres)+len(entreprises))
	var position int32
	for _, m := range ministeres {
		position++
		employeurs = append(employeurs, seedEmployeur{code: m[0], label: m[1], typ: db.EmployeurTypeMINISTERE, position: position})
	}
	for _, e := range entreprises {
		position++
		employeurs = append(employeurs, seedEmployeur{code: e[0], label: e[1], typ: db.EmployeurTypeENTREPRISE, position: position})
	}
	return employeurs
}

type seedPaysEntree struct {
	code, label, indicatif string
	position               int32
}

// Les quinze premiers sont les pays de forte diaspora sénégalaise, le reste
// suit par ordre alphabétique, comme dans le seed de la v1.
func seedPaysListe() []seedPaysEntree {
	ordonnes := [][3]string{
		{"FR", "France", "33"},
		{"IT", "Italie", "39"},
		{"ES", "Espagne", "34"},
		{"US", "États-Unis", "1"},
		{"GM", "Gambie", "220"},
		{"MR", "Mauritanie", "222"},
		{"ML", "Mali", "223"},
		{"CI", "Côte d’Ivoire", "225"},
		{"MA", "Maroc", "212"},
		{"GA", "Gabon", "241"},
		{"DE", "Allemagne", "49"},
		{"BE", "Belgique", "32"},
		{"CA", "Canada", "1"},
		{"PT", "Portugal", "351"},
		{"SA", "Arabie saoudite", "966"},
		{"AF", "Afghanistan", "93"},
		{"ZA", "Afrique du Sud", "27"},
		{"AX", "Åland", "358"},
		{"AL", "Albanie", "355"},
		{"DZ", "Algérie", "213"},
		{"AD", "Andorre", "376"},
		{"AO", "Angola", "244"},
		{"AI", "Anguilla", "1"},
		{"AG", "Antigua-et-Barbuda", "1"},
		{"AR", "Argentine", "54"},
		{"AM", "Arménie", "374"},
		{"AW", "Aruba", "297"},
		{"AU", "Australie", "61"},
		{"AT", "Autriche", "43"},
		{"AZ", "Azerbaïdjan", "994"},
		{"BS", "Bahamas", "1"},
		{"BH", "Bahreïn", "973"},
		{"BD", "Bangladesh", "880"},
		{"BB", "Barbade", "1"},
		{"BZ", "Belize", "501"},
		{"BJ", "Bénin", "229"},
		{"BM", "Bermudes", "1"},
		{"BT", "Bhoutan", "975"},
		{"BY", "Biélorussie", "375"},
		{"BO", "Bolivie", "591"},
		{"BQ", "Bonaire, Saint-Eustache et Saba", "599"},
		{"BA", "Bosnie-Herzégovine", "387"},
		{"BW", "Botswana", "267"},
		{"BR", "Brésil", "55"},
		{"BN", "Brunei Darussalam", "673"},
		{"BG", "Bulgarie", "359"},
		{"BF", "Burkina Faso", "226"},
		{"BI", "Burundi", "257"},
		{"KH", "Cambodge", "855"},
		{"CM", "Cameroun", "237"},
		{"CV", "Cap-Vert", "238"},
		{"CL", "Chili", "56"},
		{"CN", "Chine", "86"},
		{"CY", "Chypre", "357"},
		{"CO", "Colombie", "57"},
		{"KM", "Comores", "269"},
		{"KP", "Corée du Nord", "850"},
		{"KR", "Corée du Sud", "82"},
		{"CR", "Costa Rica", "506"},
		{"HR", "Croatie", "385"},
		{"CU", "Cuba", "53"},
		{"CW", "Curaçao", "599"},
		{"DK", "Danemark", "45"},
		{"DJ", "Djibouti", "253"},
		{"DM", "Dominique", "1"},
		{"EG", "Égypte", "20"},
		{"SV", "El Salvador", "503"},
		{"AE", "Émirats arabes unis", "971"},
		{"EC", "Équateur", "593"},
		{"ER", "Érythrée", "291"},
		{"EE", "Estonie", "372"},
		{"SZ", "Eswatini", "268"},
		{"ET", "Éthiopie", "251"},
		{"FJ", "Fidji", "679"},
		{"FI", "Finlande", "358"},
		{"GE", "Géorgie", "995"},
		{"GH", "Ghana", "233"},
		{"GI", "Gibraltar", "350"},
		{"GR", "Grèce", "30"},
		{"GD", "Grenade", "1"},
		{"GL", "Groenland", "299"},
		{"GP", "Guadeloupe", "590"},
		{"GU", "Guam", "1"},
		{"GT", "Guatemala", "502"},
		{"GG", "Guernesey", "44"},
		{"GN", "Guinée", "224"},
		{"GQ", "Guinée équatoriale", "240"},
		{"GW", "Guinée-Bissau", "245"},
		{"GY", "Guyana", "592"},
		{"GF", "Guyane française", "594"},
		{"HT", "Haïti", "509"},
		{"HN", "Honduras", "504"},
		{"HK", "Hong Kong", "852"},
		{"HU", "Hongrie", "36"},
		{"CX", "Île Christmas", "61"},
		{"IM", "Île de Man", "44"},
		{"NF", "Île Norfolk", "672"},
		{"KY", "Îles Caïmans", "1"},
		{"CC", "Îles Cocos", "61"},
		{"CK", "Îles Cook", "682"},
		{"FO", "Îles Féroé", "298"},
		{"FK", "Îles Malouines", "500"},
		{"MP", "Îles Mariannes du Nord", "1"},
		{"MH", "Îles Marshall", "692"},
		{"SB", "Îles Salomon", "677"},
		{"TC", "Îles Turques-et-Caïques", "1"},
		{"VI", "Îles Vierges américaines", "1"},
		{"VG", "Îles Vierges britanniques", "1"},
		{"IN", "Inde", "91"},
		{"ID", "Indonésie", "62"},
		{"IQ", "Irak", "964"},
		{"IR", "Iran", "98"},
		{"IE", "Irlande", "353"},
		{"IS", "Islande", "354"},
		{"IL", "Israël", "972"},
		{"JM", "Jamaïque", "1"},
		{"JP", "Japon", "81"},
		{"JE", "Jersey", "44"},
		{"JO", "Jordanie", "962"},
		{"KZ", "Kazakhstan", "7"},
		{"KE", "Kenya", "254"},
		{"KG", "Kirghizistan", "996"},
		{"KI", "Kiribati", "686"},
		{"XK", "Kosovo", "383"},
		{"KW", "Koweït", "965"},
		{"LA", "Laos", "856"},
		{"LS", "Lesotho", "266"},
		{"LV", "Lettonie", "371"},
		{"LB", "Liban", "961"},
		{"LR", "Libéria", "231"},
		{"LY", "Libye", "218"},
		{"LI", "Liechtenstein", "423"},
		{"LT", "Lituanie", "370"},
		{"LU", "Luxembourg", "352"},
		{"MO", "Macao", "853"},
		{"MK", "Macédoine du Nord", "389"},
		{"MG", "Madagascar", "261"},
		{"MY", "Malaisie", "60"},
		{"MW", "Malawi", "265"},
		{"MV", "Maldives", "960"},
		{"MT", "Malte", "356"},
		{"MQ", "Martinique", "596"},
		{"MU", "Maurice", "230"},
		{"YT", "Mayotte", "262"},
		{"MX", "Mexique", "52"},
		{"FM", "Micronésie", "691"},
		{"MD", "Moldavie", "373"},
		{"MC", "Monaco", "377"},
		{"MN", "Mongolie", "976"},
		{"ME", "Monténégro", "382"},
		{"MS", "Montserrat", "1"},
		{"MZ", "Mozambique", "258"},
		{"MM", "Myanmar", "95"},
		{"NA", "Namibie", "264"},
		{"NR", "Nauru", "674"},
		{"NP", "Népal", "977"},
		{"NI", "Nicaragua", "505"},
		{"NE", "Niger", "227"},
		{"NG", "Nigéria", "234"},
		{"NU", "Niué", "683"},
		{"NO", "Norvège", "47"},
		{"NC", "Nouvelle-Calédonie", "687"},
		{"NZ", "Nouvelle-Zélande", "64"},
		{"IO", "Océan Indien britannique", "246"},
		{"OM", "Oman", "968"},
		{"UG", "Ouganda", "256"},
		{"UZ", "Ouzbékistan", "998"},
		{"PK", "Pakistan", "92"},
		{"PW", "Palaos", "680"},
		{"PS", "Palestine", "970"},
		{"PA", "Panama", "507"},
		{"PG", "Papouasie-Nouvelle-Guinée", "675"},
		{"PY", "Paraguay", "595"},
		{"NL", "Pays-Bas", "31"},
		{"PE", "Pérou", "51"},
		{"PH", "Philippines", "63"},
		{"PL", "Pologne", "48"},
		{"PF", "Polynésie française", "689"},
		{"PR", "Porto Rico", "1"},
		{"QA", "Qatar", "974"},
		{"CF", "République centrafricaine", "236"},
		{"CD", "République démocratique du Congo", "243"},
		{"DO", "République dominicaine", "1"},
		{"CG", "République du Congo", "242"},
		{"TZ", "République unie de Tanzanie", "255"},
		{"RE", "Réunion", "262"},
		{"RO", "Roumanie", "40"},
		{"GB", "Royaume-Uni", "44"},
		{"RU", "Russie", "7"},
		{"RW", "Rwanda", "250"},
		{"EH", "Sahara occidental", "212"},
		{"BL", "Saint-Barthélemy", "590"},
		{"KN", "Saint-Christophe-et-Niévès", "1"},
		{"SM", "Saint-Marin", "378"},
		{"MF", "Saint-Martin (partie française)", "590"},
		{"SX", "Saint-Martin (partie néerlandaise)", "1"},
		{"PM", "Saint-Pierre-et-Miquelon", "508"},
		{"VA", "Saint-Siège (Vatican)", "39"},
		{"VC", "Saint-Vincent-et-les-Grenadines", "1"},
		{"SH", "Sainte-Hélène", "290"},
		{"LC", "Sainte-Lucie", "1"},
		{"WS", "Samoa", "685"},
		{"AS", "Samoa américaines", "1"},
		{"ST", "São Tomé-et-Principe", "239"},
		{"SN", "Sénégal", "221"},
		{"RS", "Serbie", "381"},
		{"SC", "Seychelles", "248"},
		{"SL", "Sierra Leone", "232"},
		{"SG", "Singapour", "65"},
		{"SK", "Slovaquie", "421"},
		{"SI", "Slovénie", "386"},
		{"SO", "Somalie", "252"},
		{"SD", "Soudan", "249"},
		{"SS", "Soudan du Sud", "211"},
		{"LK", "Sri Lanka", "94"},
		{"SE", "Suède", "46"},
		{"CH", "Suisse", "41"},
		{"SR", "Suriname", "597"},
		{"SJ", "Svalbard et Île Jan Mayen", "47"},
		{"SY", "Syrie", "963"},
		{"TJ", "Tadjikistan", "992"},
		{"TW", "Taïwan", "886"},
		{"TD", "Tchad", "235"},
		{"CZ", "Tchéquie", "420"},
		{"TH", "Thaïlande", "66"},
		{"TL", "Timor-Leste", "670"},
		{"TG", "Togo", "228"},
		{"TK", "Tokelau", "690"},
		{"TO", "Tonga", "676"},
		{"TT", "Trinité-et-Tobago", "1"},
		{"TN", "Tunisie", "216"},
		{"TM", "Turkménistan", "993"},
		{"TR", "Turquie", "90"},
		{"TV", "Tuvalu", "688"},
		{"UA", "Ukraine", "380"},
		{"UY", "Uruguay", "598"},
		{"VU", "Vanuatu", "678"},
		{"VE", "Venezuela", "58"},
		{"VN", "Vietnam", "84"},
		{"WF", "Wallis-et-Futuna", "681"},
		{"YE", "Yémen", "967"},
		{"ZM", "Zambie", "260"},
		{"ZW", "Zimbabwe", "263"},
	}
	pays := make([]seedPaysEntree, 0, len(ordonnes))
	for i, p := range ordonnes {
		pays = append(pays, seedPaysEntree{code: p[0], label: p[1], indicatif: p[2], position: int32(i + 1)})
	}
	return pays
}

type seedStatutQualification struct {
	code, label       string
	effect            db.StatutQualificationEffect
	requiresCallback  bool
	requiresComment   bool
	retryAfterMinutes *int32
	priorite          db.PrioriteTraitement
	relationStatus    *db.RepresentantRelation
	sortOrder         int32
	minPayloadVersion int32
}

func seedRelation(r db.RepresentantRelation) *db.RepresentantRelation { return &r }
func seedMinutes(m int32) *int32                                      { return &m }

// Les quinze statuts du Lot 1. Les sept statuts d'avant (INTERESSE,
// TRES_INTERESSE, RDV_OBTENU, DEMANDE_INFOS, NON_INTERESSE, NON_ELIGIBLE,
// NUMERO_INVALIDE) ne sont plus semés mais restent en base, désactivés :
// l'historique les désigne.
var seedStatutsQualification = []seedStatutQualification{
	{"ACCEPTE", exports.ExportLibelleAccepte, db.StatutQualificationEffectREACHED, false, false, nil, db.PrioriteTraitementHAUTE, seedRelation(db.RepresentantRelationAMBASSADEUR), 10, 6},
	{"REFUSE", "Refusé", db.StatutQualificationEffectREFUSED, false, false, nil, db.PrioriteTraitementBASSE, seedRelation(db.RepresentantRelationREFUS), 20, 6},
	{exports.LotEtatARappeler, "À rappeler", db.StatutQualificationEffectSCHEDULECALLBACK, true, false, nil, db.PrioriteTraitementHAUTE, nil, 30, 6},
	{"DECEDE", "Décédé", db.StatutQualificationEffectREFUSED, false, false, nil, db.PrioriteTraitementBASSE, nil, 40, 6},
	{"RETRAITE", "Retraité", db.StatutQualificationEffectREFUSED, false, false, nil, db.PrioriteTraitementBASSE, nil, 50, 6},
	{"HORS_CIBLE", "Hors cible", db.StatutQualificationEffectREFUSED, false, false, nil, db.PrioriteTraitementBASSE, nil, 60, 6},
	{"AFFECTE_AILLEURS", "Affecté ailleurs", db.StatutQualificationEffectREFUSED, false, false, nil, db.PrioriteTraitementBASSE, nil, 70, 6},
	{"FAUX_NUMERO", "Faux numéro", db.StatutQualificationEffectWRONGNUMBER, false, false, nil, db.PrioriteTraitementBASSE, nil, 80, 6},
	{"AUTRE_JOINT", "Autre joint", db.StatutQualificationEffectREACHED, false, true, nil, db.PrioriteTraitementNORMALE, nil, 90, 7},
	{"PAS_DE_REPONSE", "Pas de réponse", db.StatutQualificationEffectUNREACHABLE, false, false, seedMinutes(120), db.PrioriteTraitementNORMALE, nil, 110, 6},
	{"NUMERO_OCCUPE", "Occupé", db.StatutQualificationEffectUNREACHABLE, false, false, seedMinutes(30), db.PrioriteTraitementNORMALE, nil, 120, 6},
	{"MESSAGERIE", "Messagerie", db.StatutQualificationEffectUNREACHABLE, false, false, seedMinutes(240), db.PrioriteTraitementNORMALE, nil, 130, 6},
	{"TELEPHONE_INDISPONIBLE", "Téléphone indisponible", db.StatutQualificationEffectUNREACHABLE, false, false, seedMinutes(1440), db.PrioriteTraitementNORMALE, nil, 140, 6},
	{"INJOIGNABLE_DEFINITIF", "Injoignable définitif", db.StatutQualificationEffectUNREACHABLE, false, false, nil, db.PrioriteTraitementBASSE, nil, 150, 6},
	{"AUTRE_NON_JOINT", "Autre non joint", db.StatutQualificationEffectUNREACHABLE, false, true, seedMinutes(1440), db.PrioriteTraitementNORMALE, nil, 160, 7},
}

type seedVisiteReferentiel struct {
	code, label string
	sortOrder   int32
}

var seedVisiteEntreprises = []seedVisiteReferentiel{
	{"CPI", "CPI", 1},
	{seedEntrepriseSantargile, seedEntrepriseSantargile, 2},
	{"MAKE_UP_ADDICTION", "MAKE-UP ADDICTION", 3},
}

var seedVisiteDirections = []seedVisiteReferentiel{
	{"COMMERCIALE", "COMMERCIALE", 1},
	{"FINANCE_COMPTABILITE", "FINANCE & COMPTABILITE", 2},
	{"FONCIERE", "FONCIERE", 3},
	{"GENERALE", "GENERALE", 4},
	{"INFORMATIQUE", "INFORMATIQUE", 5},
	{"MARKETING_COMMUNICATION", "MARKETING COMMUNICATION", 6},
	{"RESSOURCES_HUMAINES", "RESSOURCES HUMAINES", 7},
	{seedEntrepriseSantargile, seedEntrepriseSantargile, 8},
	{"MAKE_UP_ADDICTION", "MAKE-UP ADDICTION", 9},
	{"RDC_CPI", "RDC CPI", 10},
	{"ETAGE_1_CPI", "1ER. ETAGE CPI", 11},
	{"ETAGE_2_CPI", "2EME. ETAGE CPI", 12},
	{"TERRASSE_CPI", "TERRASSE CPI", 13},
	{"RDC_VILLA", "RDC VILLA", 14},
	{"ETAGE_1_VILLA", "1ER. ETAGE VILLA", 15},
	{"ETAGE_2_VILLA", "2EME. ETAGE VILLA", 16},
	{"TERRASSE_VILLA", "TERRASSE VILLA", 17},
}

var seedVisiteDestinataires = []seedVisiteReferentiel{
	{"NDOYE", "MME. NDOYE (RESP. COMM.)", 1},
	{"LY_SEYNABOU", "MME. LY SEYNABOU (CAISSIERE)", 2},
	{"FALL", "M. FALL (COMMERCIAL)", 3},
	{"SY", "MME. SY (AG)", 4},
	{"SAMB", "M. SAMB (DG)", 5},
	{"GUEYE_KHADY", "MME. GUEYE KHADY (SECRETAIRE)", 6},
	{"SALANE_DIAMA", "MME. SALANE DIAMA (SECRETAIRE)", 7},
	{"FAYE_SIDI", "M. FAYE SIDI (JURISTE)", 8},
	{"SANE_ANSOUMANA", "M. SANE ANSOUMANA (FONCIER)", 9},
	{"BA_DOUDOU", "M. BA DOUDOU (ASSISTANT)", 10},
	{"SARR_IBRAHIMA", "M. SARR IBRAHIMA (TRESORIER)", 11},
	{"NDONGO_OUSMANE", "M. NDONGO OUSMANE (COMPTABLE)", 12},
	{"SAMB_RAMATA", "MME. SAMB RAMATA (RESP. RH)", 13},
	{"DIOUM_YAMA", "MME. DIOUM YAMA (Ass Rh et Commerciale Argile)", 14},
	{"DIEDHIOU_YORO", "M. DIEDHIOU YORO (HELPDESK)", 15},
	{"AUTRE", "AUTRE", 900},
}

var seedVisiteObjets = []seedVisiteReferentiel{
	{"ACHAT_TERRAIN", "ACHAT TERRAIN", 1},
	{"VERSEMENT_ECHEANCE", "VERSEMENT ECHEANCE", 2},
	{"DEMANDE_INFORMATIONS", "DEMANDE D’INFORMATIONS", 3},
	{"ACHAT_PRODUITS", "ACHAT PRODUITS SANTARGILE ET/OU MAKE-UP", 4},
	{"APPORTEUR_AFFAIRES", "APPORTEUR D’AFFAIRES", 5},
	{"CONSEIL_DOMANIAL", "CONSEIL DOMANIAL", 6},
	{"CONSULTANTS", "CONSULTANTS", 7},
	{"ENTRETIENS_RECRUTEMENT", "ENTRETIENS DE RECRUTEMENT", 8},
	{"ENTRETIENS_TRAVAUX", "ENTRETIENS OU TRAVAUX", 9},
	{"LOCATION_VERSEMENT_LOYER", "LOCATION ET VERSEMENT LOYER", 10},
	{"PARTENARIAT", "PARTENARIAT", 11},
	{"PERSONNEL", "PERSONNEL", 12},
	{"PROPRIETAIRE_BAILLEUR", "PROPRIETAIRE SITES ET/OU BAILLEUR", 13},
	{"RECLAMATIONS", "RECLAMATIONS", 14},
	{"SUIVI_DOSSIER", "SUIVI DE DOSSIER", 15},
	{"VISITE_TERRAIN", "VISITE DE TERRAIN", 16},
}

type seedFixtureUser struct {
	email, username, fullName string
	role                      db.Role
}

var seedFixtureUsers = []seedFixtureUser{
	{"fixture.awa@cpi.sn", "fixture.awa", "Awa Fixture", db.RoleCOMMERCIAL},
	{"fixture.fatou@cpi.sn", "fixture.fatou", "Fatou Fixture", db.RoleCOMMERCIAL},
	{"fixture.banque@cpi.sn", "fixture.banque", "Moussa Fixture", db.RoleBANQUEFINANCE},
	{"fixture.superviseur@cpi.sn", "fixture.superviseur", "Superviseur Fixture", db.RoleSUPERVISEUR},
	{"fixture.direction@cpi.sn", "fixture.direction", "Direction Fixture", db.RoleDIRECTION},
	{"fixture.accueil@cpi.sn", "fixture.accueil", "Accueil Fixture", db.RoleACCUEIL},
	{"fixture.clientele@cpi.sn", "fixture.clientele", "Clientèle Fixture", db.RoleCHARGECLIENTELE},
}
