package main

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

type volumesFactory struct {
	jours, joursFuturs, representants, prospects, convertis, rappel, rendezVous, visites, ventes int
}

// Les bases de démonstration montrent un gros volume ; chaque test d'intégration
// en monte une et passe au volume d'essai, sinon la suite dépasse le délai de la CI.
var (
	volumesDemo = volumesFactory{
		jours: 600, joursFuturs: 600, representants: 24000, prospects: 48000, convertis: 24000,
		rappel: 36000, rendezVous: 6000, visites: 18000, ventes: 12000,
	}
	volumesEssai = volumesFactory{
		jours: 60, joursFuturs: 600, representants: 240, prospects: 600, convertis: 240,
		rappel: 360, rendezVous: 120, visites: 180, ventes: 120,
	}
	factoryVolumes = volumesDemo
)

func (v volumesFactory) jetons() *strings.Replacer {
	return strings.NewReplacer(
		"{J}", strconv.Itoa(v.jours),
		"{J2}", strconv.Itoa(2*v.jours),
		"{FUTUR}", strconv.Itoa(v.joursFuturs),
		"{REP}", strconv.Itoa(v.representants),
		"{REPBLOC}", strconv.Itoa(v.representants/4),
		"{PROS}", strconv.Itoa(v.prospects),
		"{CONV}", strconv.Itoa(v.convertis),
		"{CONVH}", strconv.Itoa(v.convertis/2),
		"{RAPPEL}", strconv.Itoa(v.rappel),
		"{RDVDEBUT}", strconv.Itoa(v.prospects-v.rendezVous),
		"{VIS}", strconv.Itoa(v.visites),
		"{VENTES}", strconv.Itoa(v.ventes),
	)
}

// Les identifiants fixes réactualisent les fixtures autour d’aujourd’hui : 600 jours de passé, rappels sur 600 jours à venir.
func seedFactory(ctx context.Context, tx pgx.Tx) error {
	statements := []string{
		`DELETE FROM "lot_export_reaffectations" WHERE "lotId"='dev-lot-001'`,
		`DELETE FROM "lot_export_items" WHERE "lotId"='dev-lot-001'`,
		`DELETE FROM "lots_export" WHERE "id"='dev-lot-001'`,
		`INSERT INTO "representants" ("id","fullName","phoneE164","departementId","createdById","clientCreatedAt","createdAt","updatedAt","relationStatus","prenom","etablissement","contacte","lastCallAt","lastCallById","statutQualificationId")
		SELECT '0199f100-0000-7000-8000-'||lpad(g::text,12,'0'),
		  prenoms.p||' '||(ARRAY['Diop','Fall','Ndiaye','Sow','Diallo','Sarr','Ba','Gueye','Faye','Thiam','Kane'])[1+(g-1)%11],
		  '+2217'||(ARRAY['7','8','6','0'])[1+(g-1)%4]||((g*7919)%9000000+1000000)::text,d.id,u.id,jour+ecoule*.2,jour+ecoule*.2,now(),
		  COALESCE(sq."relationStatus",'CONTACTE'),prenoms.p,
		  'École de '||d.name,sq.effect <> 'UNREACHABLE',jour+ecoule*.3,u.id,sq.id
		FROM generate_series(1,{REP}) g
		CROSS JOIN LATERAL (SELECT (ARRAY['Aminata','Moussa','Fatou','Ibrahima','Awa','Cheikh','Mariama','Ousmane','Khady','Abdou','Ndèye','Pape'])[1+(g-1)%12] AS p) prenoms
		CROSS JOIN LATERAL (SELECT date_trunc('day',now())-make_interval(days=>(g-1)%{J}) AS jour,now()-date_trunc('day',now()) AS ecoule) dates
		JOIN "users" u ON u.email=CASE WHEN ((g-1)/{J}+(g-1)%{J})%2=0 THEN 'fixture.awa@cpi.sn' ELSE 'fixture.fatou@cpi.sn' END
		JOIN (SELECT id,name,row_number() OVER (ORDER BY code) AS rang FROM "departements" WHERE code IN ('DK-DAK','TH-THI','SL-STL','TH-MBO')) d ON d.rang=1+(g-1)%4
		JOIN "statuts_qualification" sq ON sq.code=(ARRAY['ACCEPTE','REFUSE','A_RAPPELER','PAS_DE_REPONSE'])[1+(g-1)/{REPBLOC}]
		ON CONFLICT (id) DO UPDATE SET "phoneE164"=EXCLUDED."phoneE164","fullName"=EXCLUDED."fullName","prenom"=EXCLUDED."prenom","clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt",
		  "lastCallAt"=EXCLUDED."lastCallAt","lastCallById"=EXCLUDED."lastCallById",
		  "statutQualificationId"=EXCLUDED."statutQualificationId","relationStatus"=EXCLUDED."relationStatus","departementId"=EXCLUDED."departementId"`,
		`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","banqueId","syndicatId","representantId","createdById","clientCreatedAt","createdAt","updatedAt","projet","statut","type","professionId","incomeBandId","employeurId","canalProvenanceId","paysResidenceId","villeResidence","email","phase2Status","enrollmentMethod","enrollmentCapturedAt","enrollmentCapturedById","lastCallAt","lastCallById","lastReasonId")
		SELECT '0199f100-0000-7001-8000-'||lpad(g::text,12,'0'),
		  (ARRAY['Diop','Ndiaye','Fall','Sow','Diallo','Sarr','Ba','Gueye','Faye','Thiam','Kane','Mbaye','Cissé'])[1+(g-1)%13],
		  (ARRAY['Aminata','Mamadou','Fatou','Ibrahima','Awa','Cheikh','Mariama','Ousmane','Khady','Abdou','Ndèye','Pape'])[1+(g-1)%12],
		  dates.tel,b.id,sy.id,'0199f100-0000-7000-8000-'||lpad((1+(g-1)%{REP})::text,12,'0'),
		  u.id,jour+ecoule*.4,jour+ecoule*.4,now(),CASE WHEN ((g-1)/{J})%2=0 THEN 'CHUES'::"Projet" ELSE 'GRAND_PUBLIC'::"Projet" END,
		  CASE WHEN g<={CONV} THEN 'CONVERTI'::"ProspectStatut" ELSE 'CONTACTE'::"ProspectStatut" END,'FONCTIONNAIRE'::"ProspectType",
		  (SELECT id FROM "professions" WHERE "isTeaching" ORDER BY code LIMIT 1),(SELECT id FROM "income_bands" ORDER BY "position" LIMIT 1),
		  (SELECT id FROM "employeurs" ORDER BY code LIMIT 1),c.id,(SELECT id FROM "pays" WHERE code='SN'),'Dakar','dev'||g||'@example.test',
		  CASE WHEN g<={CONV} THEN 'METHOD_OBTAINED'::"Phase2Status" WHEN g>{RDVDEBUT} THEN 'APPOINTMENT'::"Phase2Status" ELSE 'PENDING'::"Phase2Status" END,
		  CASE WHEN g<={CONV} THEN (ARRAY['PLATFORM','WHATSAPP','VOICE_OR_ELECTRONIC_MESSAGING']::"EnrollmentMethod"[])[1+((g-1)/{J}+(g-1)%{J})%3] END,
		  CASE WHEN g<={CONV} THEN jour+ecoule*.6 END,CASE WHEN g<={CONV} THEN u.id END,jour+ecoule*.6,u.id,cr.id
		FROM generate_series(1,{PROS}) g
		CROSS JOIN LATERAL (SELECT date_trunc('day',now())-make_interval(days=>(g-1)%{J}) AS jour,now()-date_trunc('day',now()) AS ecoule,
		  '+2217'||(ARRAY['7','8','6','0'])[1+(g-1)%4]||((g::bigint*104729+51)%9000000+1000000)::text AS tel) dates
		JOIN "users" u ON u.email=CASE WHEN ((g-1)/{J2}+(g-1)%{J})%2=0 THEN 'fixture.awa@cpi.sn' ELSE 'fixture.fatou@cpi.sn' END
		JOIN "call_outcome_reasons" cr ON cr.code=CASE WHEN g<={CONV} THEN 'INTERESSE' WHEN g<={RAPPEL} THEN 'CALLBACK' WHEN g>{RDVDEBUT} THEN 'RV_CPI' ELSE 'PAS_DE_REPONSE' END
		JOIN (SELECT id,row_number() OVER (ORDER BY "shortName") AS rang FROM "banques" WHERE "isActive") b ON b.rang=1+((g-1)/{J}+(g-1)%{J})%4
		JOIN (SELECT id,row_number() OVER (ORDER BY sigle) AS rang FROM "syndicats" WHERE "isActive") sy ON sy.rang=1+(g-1)%3
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "canaux_provenance" WHERE "isActive") c ON c.rang=1+((g-1)/{J}+(g-1)%{J})%4
		WHERE NOT EXISTS (SELECT 1 FROM "prospects" x WHERE x."phoneE164"=dates.tel AND x."deletedAt" IS NULL AND x.id NOT LIKE '0199f100-0000-7001-%')
		ON CONFLICT (id) DO UPDATE SET "phoneE164"=EXCLUDED."phoneE164",nom=EXCLUDED.nom,prenom=EXCLUDED.prenom,"createdById"=EXCLUDED."createdById","clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt",
		  "projet"=EXCLUDED."projet","statut"=EXCLUDED."statut","phase2Status"=EXCLUDED."phase2Status","enrollmentMethod"=EXCLUDED."enrollmentMethod",
		  "enrollmentCapturedAt"=EXCLUDED."enrollmentCapturedAt","enrollmentCapturedById"=EXCLUDED."enrollmentCapturedById",
		  "lastCallAt"=EXCLUDED."lastCallAt","lastCallById"=EXCLUDED."lastCallById","lastReasonId"=EXCLUDED."lastReasonId",
		  "banqueId"=EXCLUDED."banqueId","syndicatId"=EXCLUDED."syndicatId","representantId"=EXCLUDED."representantId","canalProvenanceId"=EXCLUDED."canalProvenanceId"`,
		`INSERT INTO "prospect_journeys" ("id","prospectId","projet","statut","createdAt","updatedAt","phase2Status","enrollmentMethod","enrollmentCapturedAt","enrollmentCapturedById","convertedAt","convertedById")
		SELECT gen_random_uuid()::text,p.id,p.projet,p.statut,p."createdAt",now(),p."phase2Status",p."enrollmentMethod",p."enrollmentCapturedAt",p."enrollmentCapturedById",
		  p."enrollmentCapturedAt",p."enrollmentCapturedById" FROM "prospects" p WHERE p.id LIKE '0199f100-0000-7001-8000-%'
		ON CONFLICT ("prospectId",projet) DO UPDATE SET statut=EXCLUDED.statut,"createdAt"=EXCLUDED."createdAt","phase2Status"=EXCLUDED."phase2Status",
		  "enrollmentMethod"=EXCLUDED."enrollmentMethod","enrollmentCapturedAt"=EXCLUDED."enrollmentCapturedAt","enrollmentCapturedById"=EXCLUDED."enrollmentCapturedById",
		  "convertedAt"=EXCLUDED."convertedAt","convertedById"=EXCLUDED."convertedById"`,
		`INSERT INTO "call_attempts" ("id","prospectId","performedById","method","reasonId","clientCreatedAt","createdAt","fonctionnaire","engagementEnCours","deviceCallType","deviceCallDurationSeconds","deviceCallAt")
		SELECT replace(p.id,'-7001-','-7003-'),p.id,p."lastCallById",p."enrollmentMethod",r.id,p."lastCallAt",p."lastCallAt",true,true,
		  'sortant',CASE WHEN NOT r."countsAsReached" THEN 0 ELSE 120+(right(p.id,3)::int%5)*30 END,p."lastCallAt"
		FROM "prospects" p JOIN "call_outcome_reasons" r ON r.id=p."lastReasonId" WHERE p.id LIKE '0199f100-0000-7001-8000-%'
		ON CONFLICT (id) DO UPDATE SET "prospectId"=EXCLUDED."prospectId","performedById"=EXCLUDED."performedById",method=EXCLUDED.method,"reasonId"=EXCLUDED."reasonId",
		  "clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt","deviceCallType"=EXCLUDED."deviceCallType",
		  "deviceCallDurationSeconds"=EXCLUDED."deviceCallDurationSeconds","deviceCallAt"=EXCLUDED."deviceCallAt"`,
		`INSERT INTO "rep_call_attempts" ("id","representantId","performedById","statutQualificationId","clientCreatedAt","createdAt","deviceCallType","deviceCallDurationSeconds","deviceCallAt")
		SELECT replace(r.id,'-7000-','-7004-'),r.id,r."lastCallById",
		  r."statutQualificationId",r."lastCallAt",r."lastCallAt",'sortant',CASE WHEN sq.effect='UNREACHABLE' THEN 0 ELSE 180 END,r."lastCallAt"
		FROM "representants" r JOIN "statuts_qualification" sq ON sq.id=r."statutQualificationId" WHERE r.id LIKE '0199f100-0000-7000-8000-%'
		ON CONFLICT (id) DO UPDATE SET "representantId"=EXCLUDED."representantId","performedById"=EXCLUDED."performedById",
		  "statutQualificationId"=EXCLUDED."statutQualificationId","clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt",
		  "deviceCallType"=EXCLUDED."deviceCallType","deviceCallDurationSeconds"=EXCLUDED."deviceCallDurationSeconds","deviceCallAt"=EXCLUDED."deviceCallAt"`,
		`INSERT INTO "bank_cases" ("id","reference","referenceKey","prospectId","customerName","customerPhoneE164","processingBankId","currentStageId","createdById","updatedAt") SELECT '0199f100-0000-7005-8000-000000000001','DEV-BANK-001','DEV-BANK-001',p."id",p."prenom"||' '||p."nom",p."phoneE164",(SELECT "id" FROM "banques" LIMIT 1),(SELECT "id" FROM "bank_case_stages" WHERE "code"='A_TRAITER' LIMIT 1),(SELECT "id" FROM "users" WHERE "email"='fixture.banque@cpi.sn'),now() FROM "prospects" p ORDER BY p."id" LIMIT 1 ON CONFLICT DO NOTHING`,
		`INSERT INTO "bank_case_transitions" ("id","caseId","toStageId","performedById","createdAt") SELECT '0199f100-0000-7006-8000-000000000001','0199f100-0000-7005-8000-000000000001',"currentStageId",(SELECT "id" FROM "users" WHERE "email"='fixture.banque@cpi.sn'),now() FROM "bank_cases" WHERE "id"='0199f100-0000-7005-8000-000000000001' ON CONFLICT DO NOTHING`,
		`INSERT INTO "visites" ("id","reference","visitedAt","visitorName","phoneE164","entrepriseId","objetId","directionId","destinataireId","createdById","updatedAt")
		SELECT '0199f100-0000-7007-8000-'||lpad(g::text,12,'0'),'FACTORY-VISITE-'||lpad(g::text,5,'0'),
		  date_trunc('day',now())-make_interval(days=>(g-1)%{J})+(now()-date_trunc('day',now()))*.5,
		  (ARRAY['Aminata Diop','Mamadou Fall','Fatou Sarr'])[1+(g-1)%3],'+22177'||lpad(g::text,7,'0'),e.id,o.id,d.id,dest.id,u.id,now()
		FROM generate_series(1,{VIS}) g JOIN "users" u ON u.email='fixture.accueil@cpi.sn'
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_entreprises") e ON e.rang=1+(g-1)%2
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_objets") o ON o.rang=1+(g-1)%4
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_directions") d ON d.rang=1+(g-1)%4
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_destinataires") dest ON dest.rang=1+(g-1)%4
		ON CONFLICT (id) DO UPDATE SET reference=EXCLUDED.reference,"visitedAt"=EXCLUDED."visitedAt","entrepriseId"=EXCLUDED."entrepriseId","objetId"=EXCLUDED."objetId","directionId"=EXCLUDED."directionId","destinataireId"=EXCLUDED."destinataireId"`,
		`INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","statutDistant","prospectId","chargeUtile","dernierTirageAt","updatedAt") SELECT '0199f100-0000-7008-8000-000000000001','CHUES'::"Projet",'DEV-001','Diallo','Mariama','soumis',p."id",'{}'::jsonb,now(),now() FROM "prospects" p ORDER BY p."id" LIMIT 1 ON CONFLICT DO NOTHING`,
		`INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","phoneE164","email","statutDistant","etapeDistante","inscriteLe","soumiseLe","decideeLe","prospectId","chargeUtile","premierTirageAt","dernierTirageAt","updatedAt")
		SELECT replace(p.id,'-7001-','-7020-'),p.projet,'FACTORY-PLATEFORME-'||lpad(right(p.id,12)::int::text,5,'0'),p.nom,p.prenom,p."phoneE164",p.email,
		  CASE WHEN right(p.id,12)::int%5=0 THEN 'soumis' ELSE 'validated' END,CASE WHEN right(p.id,12)::int%5=0 THEN 2 ELSE 4 END,
		  p."enrollmentCapturedAt",p."enrollmentCapturedAt",CASE WHEN right(p.id,12)::int%5<>0 THEN p."enrollmentCapturedAt" END,p.id,
		  jsonb_build_object('source','factory','revenu','250000','ville','Dakar',
		    'demande',jsonb_build_object('submitted',true),
		    'requisDocs',jsonb_build_array(jsonb_build_object('status',CASE WHEN right(p.id,12)::int%5=0 THEN 'en-attente' ELSE 'accepte' END))),
		  p."enrollmentCapturedAt",now(),now()
		FROM "prospects" p WHERE p.id LIKE '0199f100-0000-7001-8000-%' AND p."phase2Status"='METHOD_OBTAINED'
		ON CONFLICT (id) DO UPDATE SET "identifiantDistant"=EXCLUDED."identifiantDistant","statutDistant"=EXCLUDED."statutDistant","chargeUtile"=EXCLUDED."chargeUtile",projet=EXCLUDED.projet,"inscriteLe"=EXCLUDED."inscriteLe","soumiseLe"=EXCLUDED."soumiseLe","decideeLe"=EXCLUDED."decideeLe","premierTirageAt"=EXCLUDED."premierTirageAt",
		  -- Le releve de la plateforme les marque disparues : elles n'y figurent pas.
		  "disparueLe"=NULL`,
		// Une base semee par une version anterieure a un dossier sur CHAQUE rang.
		`DELETE FROM "bank_cases" WHERE id LIKE '0199f100-0000-7030-8000-%' AND right(id,12)::int%6=0`,
		// Un rang sur six n'a PAS de dossier : ces inscriptions alimentent « A ouvrir
		// (plateforme) », qui ne liste qu'une inscription validee sans dossier. Un
		// pas de six, et non les derniers rangs, pour couvrir les deux projets.
		`INSERT INTO "bank_cases" ("id","reference","referenceKey","prospectId","customerName","customerPhoneE164","processingBankId","currentStageId","amountXof","rejectionReasonId","createdById","createdAt","updatedAt","inscriptionId")
		SELECT replace(p.id,'-7001-','-7030-'),'FACTORY-BF-'||lpad(g::text,5,'0'),'FACTORY-BF-'||lpad(g::text,5,'0'),p.id,p.prenom||' '||p.nom,p."phoneE164",p."banqueId",st.id,
		  CASE WHEN st.type='CASHED' THEN 150000+g*1000 END,CASE WHEN st.type='REJECTED' THEN (SELECT id FROM "bank_rejection_reasons" WHERE code='DOCUMENT_MANQUANT') END,
		  u.id,p."lastCallAt"+(p."lastCallAt"-p."clientCreatedAt")*.25,now(),replace(p.id,'-7001-','-7020-')
		FROM generate_series(1,{CONV}) g JOIN "prospects" p ON p.id='0199f100-0000-7001-8000-'||lpad(g::text,12,'0') AND g%6<>0
		JOIN "users" u ON u.email='fixture.banque@cpi.sn'
		JOIN "bank_case_stages" st ON st.code=CASE WHEN g<={CONVH} THEN 'ENCAISSE' WHEN g%3=0 THEN 'REJETE' ELSE 'EN_TRAITEMENT_BANQUE' END
		ON CONFLICT (id) DO UPDATE SET reference=EXCLUDED.reference,"referenceKey"=EXCLUDED."referenceKey","currentStageId"=EXCLUDED."currentStageId","amountXof"=EXCLUDED."amountXof","rejectionReasonId"=EXCLUDED."rejectionReasonId","createdAt"=EXCLUDED."createdAt","processingBankId"=EXCLUDED."processingBankId"`,
		`INSERT INTO "bank_case_transitions" ("id","caseId","toStageId","performedById","amountXof","rejectionReasonId","comment","createdAt")
		SELECT replace(bc.id,'-7030-','-7040-'),bc.id,bc."currentStageId",bc."createdById",bc."amountXof",bc."rejectionReasonId",'Traitement de démonstration',
		  bc."createdAt"+(bc."createdAt"-p."lastCallAt")
		FROM "bank_cases" bc JOIN "prospects" p ON p.id=bc."prospectId" WHERE bc.id LIKE '0199f100-0000-7030-8000-%'
		ON CONFLICT (id) DO UPDATE SET "toStageId"=EXCLUDED."toStageId","amountXof"=EXCLUDED."amountXof","rejectionReasonId"=EXCLUDED."rejectionReasonId","createdAt"=EXCLUDED."createdAt"`,
		`INSERT INTO "scheduled_callbacks" ("id","prospectId","assignedToId","scheduledAt","comment","sourceAttemptId","updatedAt")
		SELECT replace(p.id,'-7001-','-7009-'),p.id,p."lastCallById",CASE WHEN right(p.id,12)::int%2=0 THEN p."lastCallAt"+interval '2 days' ELSE date_trunc('day',now())+make_interval(days=>1+(right(p.id,12)::int*7)%{FUTUR})+(p."lastCallAt"-date_trunc('day',p."lastCallAt")) END,'Rappeler',replace(p.id,'-7001-','-7003-'),now()
		FROM "prospects" p JOIN "call_outcome_reasons" cr ON cr.id=p."lastReasonId" AND cr.code IN ('CALLBACK','RV_CPI') WHERE p.id LIKE '0199f100-0000-7001-8000-%'
		ON CONFLICT (id) DO UPDATE SET "assignedToId"=EXCLUDED."assignedToId","scheduledAt"=EXCLUDED."scheduledAt"`,
		`UPDATE "prospects" p SET
		  "rendezVousIssue"=CASE WHEN sc."scheduledAt"<now() THEN CASE WHEN right(p.id,12)::int%3=0 THEN 'NON_HONORE' ELSE 'HONORE' END END,
		  "rendezVousConfirmation"=CASE WHEN sc."scheduledAt">=now() AND right(p.id,12)::int%2=0 THEN 'CONFIRME' END
		FROM "scheduled_callbacks" sc
		WHERE sc.id=replace(p.id,'-7001-','-7009-') AND p."phase2Status"='APPOINTMENT' AND p.id LIKE '0199f100-0000-7001-8000-%'`,
		`UPDATE "call_attempts" a SET "siteId"=s.id,"pointRencontreId"=pr.id
		FROM "prospects" p
		JOIN (SELECT id,row_number() OVER (ORDER BY ordre,nom) AS rang,count(*) OVER () AS n FROM "ventes_sites" WHERE actif) s ON s.rang=1+right(p.id,12)::int%s.n
		JOIN (SELECT id,row_number() OVER (ORDER BY id) AS rang,count(*) OVER () AS n FROM "points_rencontre") pr ON pr.rang=1+right(p.id,12)::int%pr.n
		WHERE a.id=replace(p.id,'-7001-','-7003-') AND p."phase2Status"='APPOINTMENT' AND p.id LIKE '0199f100-0000-7001-8000-%'`,
		`DELETE FROM "rendez_vous_closings" WHERE "prospectId" LIKE '0199f100-0000-7001-8000-%'`,
		`INSERT INTO "rendez_vous_closings" ("prospectId","prochaineAction","dateRelance","auteurId","compteRendu")
		SELECT p.id,'Rappel',(sc."scheduledAt"+interval '7 days')::date,u.id,'Closing de démonstration'
		FROM "prospects" p JOIN "scheduled_callbacks" sc ON sc.id=replace(p.id,'-7001-','-7009-')
		JOIN "users" u ON u.email='fixture.accueil@cpi.sn'
		WHERE p.id LIKE '0199f100-0000-7001-8000-%' AND p."rendezVousIssue"='HONORE' AND right(p.id,12)::int%2=0`,
		`INSERT INTO "agent_activity_slots" ("userId","slot","firstSeenAt","lastSeenAt","activeSeconds") SELECT "id",date_trunc('hour',now()),now()-interval '1 hour',now()-interval '50 minutes',600 FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "agent_heartbeats" ("userId","lastPullAt","lastPushAt","pendingOps","appVersion","updatedAt") SELECT "id",now(),now(),1,'dev-factory',now() FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "device_tokens" ("id","userId","token","platform","appVersion","updatedAt") SELECT '0199f100-0000-700a-8000-000000000001',"id",'dev-token','WEB'::"DevicePlatform",'2.0.0',now() FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "dashboard_layouts" ("userId","ecran","layout","updatedAt") SELECT "id",'dev-factory','{}'::jsonb,now() FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "app_settings" ("key","value","updatedById","updatedAt") SELECT 'dev.factory','true',"id",now() FROM "users" WHERE "email"='fixture.superviseur@cpi.sn' ON CONFLICT ("key") DO UPDATE SET "value"=EXCLUDED."value"`,
		`INSERT INTO "audit_logs" ("id","userId","action","entity","entityId","after") SELECT '0199f100-0000-700b-8000-000000000001',"id",'CREATE','prospects','0199f100-0000-7001-8000-000000000001','{}'::jsonb FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "import_jobs" ("id","kind","status","mode","requestedById","fileName","fileBytes","storagePath","expiresAt","updatedAt") SELECT '0199f100-0000-700c-8000-000000000001','PROSPECTS'::"ImportKind",'succeeded'::"ImportStatus",'APPLY'::"ImportMode","id",'demo.csv',1024,'dev/demo.csv',now()+interval '30 days',now() FROM "users" WHERE "email"='fixture.superviseur@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "lots_export" ("id","name","cible","projet","filters","itemCount","createdById","createdAt")
		SELECT '0199f100-0000-700d-8000-'||lpad(g::text,12,'0'),'Campagne de démonstration '||g,
		  CASE WHEN g=1 THEN 'REPRESENTANTS'::"LotExportCible" ELSE 'PROSPECTS'::"LotExportCible" END,
		  CASE WHEN g=1 THEN 'CHUES'::"Projet" ELSE 'GRAND_PUBLIC'::"Projet" END,'{}'::jsonb,4,u.id,date_trunc('day',now())
		FROM generate_series(1,2) g JOIN "users" u ON u.email='fixture.superviseur@cpi.sn'
		ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,cible=EXCLUDED.cible,projet=EXCLUDED.projet,"itemCount"=EXCLUDED."itemCount","createdAt"=EXCLUDED."createdAt"`,
		`INSERT INTO "lot_export_items" ("lotId","representantId","prospectId","position","assigneeId")
		SELECT '0199f100-0000-700d-8000-000000000001',r.id,NULL,row_number() OVER (ORDER BY r.id),r."lastCallById"
		FROM "representants" r WHERE r.id LIKE '0199f100-0000-7000-8000-%' AND r."lastCallAt">=date_trunc('day',now())
		UNION ALL
		SELECT '0199f100-0000-700d-8000-000000000002',NULL,p.id,row_number() OVER (ORDER BY p.id),p."lastCallById"
		FROM "prospects" p WHERE p.id LIKE '0199f100-0000-7001-8000-%' AND p.projet='GRAND_PUBLIC' AND p."lastCallAt">=date_trunc('day',now())
		ON CONFLICT ("lotId",position) DO UPDATE SET "representantId"=EXCLUDED."representantId","prospectId"=EXCLUDED."prospectId","assigneeId"=EXCLUDED."assigneeId"`,
		`INSERT INTO "notification_templates" ("id","name","titleTemplate","bodyTemplate","createdById","updatedAt") SELECT '0199f100-0000-700e-8000-000000000001','Factory','Données prêtes','La base de démonstration est prête.',"id",now() FROM "users" WHERE "email"='fixture.superviseur@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "notifications" ("id","title","body","createdById","updatedAt") SELECT '0199f100-0000-700f-8000-000000000001','Données de démonstration','La base est prête.',"id",now() FROM "users" WHERE "email"='fixture.superviseur@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "notification_deliveries" ("id","notificationId","userId","status","updatedAt") SELECT '0199f100-0000-7010-8000-000000000001','0199f100-0000-700f-8000-000000000001',"id",'DELIVERED'::"NotificationDeliveryStatus",now() FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "refresh_tokens" ("id","userId","tokenHash","familyId","expiresAt") SELECT '0199f100-0000-7011-8000-000000000001',"id",'dev-hash','dev-family',now()+interval '30 days' FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "sync_batches" ("userId","idempotency_key","requestHash","status","expiresAt") SELECT "id",'dev-batch-001','dev-hash','COMPLETED'::"BatchStatus",now()+interval '1 day' FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "sync_operations" ("opId","userId","batchKey","entityType","entityId","result") SELECT '0199f100-0000-7012-8000-000000000001',"id",'dev-batch-001','prospect','0199f100-0000-7001-8000-000000000001','APPLIED'::"OperationResult" FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "references_bancaires" ("projet","annee","dernier") VALUES ('CHUES'::"Projet",2026,12),('GRAND_PUBLIC'::"Projet",2026,8) ON CONFLICT ("projet","annee") DO NOTHING`,
		`INSERT INTO "courriels" ("id","type","sujet","destinataires","objetType","objetId","html","texte","statut") VALUES ('0199f100-0000-701e-8000-000000000001','NOTIFICATION','Démonstration',ARRAY['fixture.awa@cpi.sn'],'prospect','0199f100-0000-7001-8000-000000000001','<p>Demo</p>','Demo','ENVOYE') ON CONFLICT DO NOTHING`,
		`INSERT INTO "app_setting_changes" ("id","key","oldValue","newValue","changedById") SELECT '0199f100-0000-7013-8000-000000000001','dev.factory','false','true',"id" FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "android_releases" ("versionCode","versionName","fileName","fileSize","sha256","signerSha256","publishedById","notes") SELECT 9001,'9.0.1','demo.apk',1024,'dev-sha256','dev-signer-sha256',"id",'Version de démonstration' FROM "users" WHERE "email"='fixture.direction@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "device_call_detections" ("id","performedById","representantId","prospectId","deviceCallType","deviceCallDurationSeconds","deviceCallAt","detectedAt") SELECT '0199f100-0000-7014-8000-000000000001',u."id",r."id",p."id",'OUTGOING',90,now()-interval '1 hour',now() FROM "users" u CROSS JOIN "representants" r CROSS JOIN "prospects" p WHERE u."email"='fixture.awa@cpi.sn' ORDER BY p."id" LIMIT 1 ON CONFLICT DO NOTHING`,
		`INSERT INTO "client_creation_requests" ("id","nom","prenom","phoneE164","note","banqueId","requestedById","updatedAt") SELECT '0199f100-0000-7015-8000-000000000001','Ndiaye','Aïssatou','+221770008001','Demande de démonstration',(SELECT "id" FROM "banques" LIMIT 1),"id",now() FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "ouvertures_fiche" ("id","openedById","prospectId","openedAt","firstInputAt","closedAt","closingAttemptId","createdAt","updatedAt")
		SELECT replace(p.id,'-7001-','-7016-'),p."lastCallById",p.id,p."clientCreatedAt"+(p."lastCallAt"-p."clientCreatedAt")*.9,
		  p."clientCreatedAt"+(p."lastCallAt"-p."clientCreatedAt")*.95,p."lastCallAt",replace(p.id,'-7001-','-7003-'),p."clientCreatedAt",now()
		FROM "prospects" p WHERE p.id LIKE '0199f100-0000-7001-8000-%'
		ON CONFLICT (id) DO UPDATE SET "openedById"=EXCLUDED."openedById","prospectId"=EXCLUDED."prospectId","openedAt"=EXCLUDED."openedAt",
		  "firstInputAt"=EXCLUDED."firstInputAt","closedAt"=EXCLUDED."closedAt","closingAttemptId"=EXCLUDED."closingAttemptId","createdAt"=EXCLUDED."createdAt"`,
		`INSERT INTO "prospect_conversions" ("id","journeyId","offerId","paymentMode","amountXof","confirmedById","confirmedAt")
		SELECT gen_random_uuid()::text,j.id,(SELECT id FROM "offers" ORDER BY code LIMIT 1),'COMPTANT'::"PaymentMode",150000,j."convertedById",j."convertedAt"
		FROM "prospect_journeys" j JOIN "prospects" p ON p.id=j."prospectId" AND p.projet=j.projet
		WHERE p.id LIKE '0199f100-0000-7001-8000-%' AND j.statut='CONVERTI'
		ON CONFLICT ("journeyId") DO UPDATE SET "confirmedById"=EXCLUDED."confirmedById","confirmedAt"=EXCLUDED."confirmedAt"`,
		`INSERT INTO "segment_changes" ("id","prospectId","fromSegment","toSegment","fromBanqueId","toBanqueId","fromSyndicatId","toSyndicatId","reason","changedById","source") SELECT '0199f100-0000-7018-8000-000000000001',p."id",'BDD1'::"BddSegment",'BDD2'::"BddSegment",b."id",b."id",s."id",s."id",'Répartition initiale',u."id",'WEB'::"ChangeSource" FROM "banques" b CROSS JOIN "syndicats" s CROSS JOIN "users" u CROSS JOIN "prospects" p WHERE u."email"='fixture.superviseur@cpi.sn' ORDER BY p."id" LIMIT 1 ON CONFLICT DO NOTHING`,
		`INSERT INTO "representant_comments" ("id","representantId","authorId","body","clientCreatedAt") SELECT '0199f100-0000-7019-8000-000000000001',(SELECT "id" FROM "representants" WHERE "id"='0199f100-0000-7000-8000-000000000001'),"id",'Contact établi pendant la démonstration.',now() FROM "users" WHERE "email"='fixture.awa@cpi.sn' ON CONFLICT DO NOTHING`,
		`INSERT INTO "representant_relation_changes" ("id","representantId","fromStatus","toStatus","reason","changedById","source") SELECT '0199f100-0000-701a-8000-000000000001',(SELECT "id" FROM "representants" WHERE "id"='0199f100-0000-7000-8000-000000000001'),'INCONNU'::"RepresentantRelation",'AMBASSADEUR'::"RepresentantRelation",'Qualification initiale',"id",'WEB'::"ChangeSource" FROM "users" WHERE "email"='fixture.superviseur@cpi.sn' ON CONFLICT DO NOTHING`,
		`DELETE FROM "representant_suggestions" WHERE "note"='Recommandation de démonstration' AND "id"<>'0199f100-0000-701b-8000-000000000001'`,
		`INSERT INTO "representant_suggestions" ("id","sourceRepresentantId","suggestedName","suggestedPhoneE164","note","suggestedById","sourceAttemptId","clientCreatedAt") SELECT '0199f100-0000-701b-8000-000000000001',(SELECT "id" FROM "representants" WHERE "id"='0199f100-0000-7000-8000-000000000001'),'Moussa Fall','+221776439021','Recommandation de démonstration',u."id",'0199f100-0000-7004-8000-000000000001',now() FROM "users" u WHERE u."email"='fixture.awa@cpi.sn' ON CONFLICT (id) DO UPDATE SET "suggestedPhoneE164"=EXCLUDED."suggestedPhoneE164"`,
		`INSERT INTO "lot_export_reaffectations" ("id","lotId","toAssigneeId","fiches","performedById","positions") SELECT '0199f100-0000-701c-8000-000000000001','0199f100-0000-700d-8000-000000000001',u."id",1,u."id",ARRAY[1] FROM "users" u WHERE u."email"='fixture.fatou@cpi.sn' ON CONFLICT DO NOTHING`,
		// Les ventes ont un identifiant de séquence : rattachées à un classeur fixe,
		// elles sont remplacées à chaque semis au lieu de s'additionner.
		`INSERT INTO "ventes_classeurs" ("id","nomFichier","contenu","importeParId") SELECT '0199f100-0000-7021-8000-000000000001','demonstration.xlsx','\x'::bytea,"id" FROM "users" WHERE "email"='fixture.superviseur@cpi.sn' ON CONFLICT DO NOTHING`,
		`DELETE FROM "ventes" WHERE "classeurId"='0199f100-0000-7021-8000-000000000001'`,
		`INSERT INTO "ventes" ("classeurId","numero","canal","dateSouscription","client","telephone","site","nombreLots","numerosLots","superficie","prixUnitaire","prixTotal","acompte","reliquat",
		  "partProprietaire","partApporteur","partCpi","modePaiement","nombreEcheances","periodiciteMois","jourVersement","premierVersement","nomTeleconseiller")
		SELECT '0199f100-0000-7021-8000-000000000001',g,c.libelle,jour,
		  (ARRAY['Aminata','Mamadou','Fatou','Ibrahima','Awa','Cheikh'])[1+(g-1)%6]||' '||(ARRAY['Diop','Ndiaye','Fall','Sow','Diallo','Sarr','Ba'])[1+(g-1)%7],
		  '+22178'||lpad(g::text,7,'0'),s.nom,lots,'L-'||g,'150 m²',pu,pu*lots,
		  CASE WHEN credit THEN pu*lots*3/10 ELSE pu*lots END,CASE WHEN credit THEN pu*lots-pu*lots*3/10 ELSE 0 END,
		  s."partProprietaireParLot"*lots,0,pu*lots-s."partProprietaireParLot"*lots,
		  CASE WHEN credit THEN 'CREDIT' ELSE 'COMPTANT' END,CASE WHEN credit THEN 12 END,1,CASE WHEN credit THEN 5 END,
		  CASE WHEN credit THEN (date_trunc('month',jour)+interval '1 month 4 days')::date END,u."fullName"
		FROM generate_series(1,{VENTES}) g
		CROSS JOIN LATERAL (SELECT current_date-(g-1)%{J} AS jour,1+g%3 AS lots,g%3=0 AS credit) v
		JOIN (SELECT nom,"partProprietaireParLot",COALESCE(NULLIF("prixUnitaireDefaut",0),5000000) AS pu,row_number() OVER (ORDER BY ordre,nom) AS rang,count(*) OVER () AS n
		  FROM "ventes_sites" WHERE actif) s ON s.rang=1+(g-1)%s.n
		JOIN (SELECT libelle,row_number() OVER (ORDER BY ordre,libelle) AS rang,count(*) OVER () AS n FROM "ventes_canaux" WHERE actif) c ON c.rang=1+(g/2)%c.n
		JOIN "users" u ON u.email=CASE WHEN g%2=0 THEN 'fixture.awa@cpi.sn' ELSE 'fixture.fatou@cpi.sn' END`,
		// Une vente à crédit sur deux paie ses échéances échues, l'autre alimente les retards.
		`INSERT INTO "ventes_versements" ("venteId","rang","date","montant")
		SELECT v.id,r,(v."premierVersement"+make_interval(months=>r-1))::date,(v."prixTotal"-v."acompte")/12
		FROM "ventes" v CROSS JOIN LATERAL generate_series(1,12) r
		WHERE v."classeurId"='0199f100-0000-7021-8000-000000000001' AND v."modePaiement"='CREDIT' AND v.numero%2=0
		  AND v."premierVersement"+make_interval(months=>r-1)<=current_date`,
		`UPDATE "ventes" v SET "reliquat"=v."prixTotal"-v."acompte"-(SELECT COALESCE(SUM(vv."montant"),0) FROM "ventes_versements" vv WHERE vv."venteId"=v.id)
		WHERE v."classeurId"='0199f100-0000-7021-8000-000000000001'`,
		`INSERT INTO "visite_import_changes" ("id","importJobId","sheet","rowNumber","kind","reference","visiteId","label","fields") SELECT '0199f100-0000-701d-8000-000000000001','0199f100-0000-700c-8000-000000000001','Visites',2,'CREATE'::"VisiteImportChangeKind",'DEV-VISITE-001','0199f100-0000-7007-8000-000000000001','Visite de démonstration','{}'::jsonb ON CONFLICT DO NOTHING`,
	}
	jetons := factoryVolumes.jetons()
	for i, statement := range statements {
		statement = jetons.Replace(statement)
		if _, err := tx.Exec(ctx, statement); err != nil {
			return fmt.Errorf("factory statement %d (%s): %w", i+1, statement, err)
		}
	}
	return nil
}
