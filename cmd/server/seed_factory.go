package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Les identifiants fixes réactualisent seulement les fixtures sur 60 jours, aujourd’hui inclus.
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
		FROM generate_series(1,240) g
		CROSS JOIN LATERAL (SELECT (ARRAY['Aminata','Moussa','Fatou','Ibrahima','Awa','Cheikh','Mariama','Ousmane','Khady','Abdou','Ndèye','Pape'])[1+(g-1)%12] AS p) prenoms
		CROSS JOIN LATERAL (SELECT date_trunc('day',now())-make_interval(days=>(g-1)%60) AS jour,now()-date_trunc('day',now()) AS ecoule) dates
		JOIN "users" u ON u.email=CASE WHEN ((g-1)/60+(g-1)%60)%2=0 THEN 'fixture.awa@cpi.sn' ELSE 'fixture.fatou@cpi.sn' END
		JOIN (SELECT id,name,row_number() OVER (ORDER BY code) AS rang FROM "departements" WHERE code IN ('DK-DAK','TH-THI','SL-STL','TH-MBO')) d ON d.rang=1+(g-1)%4
		JOIN "statuts_qualification" sq ON sq.code=(ARRAY['ACCEPTE','REFUSE','A_RAPPELER','PAS_DE_REPONSE'])[1+(g-1)/60]
		ON CONFLICT (id) DO UPDATE SET "phoneE164"=EXCLUDED."phoneE164","fullName"=EXCLUDED."fullName","prenom"=EXCLUDED."prenom","clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt",
		  "lastCallAt"=EXCLUDED."lastCallAt","lastCallById"=EXCLUDED."lastCallById",
		  "statutQualificationId"=EXCLUDED."statutQualificationId","relationStatus"=EXCLUDED."relationStatus","departementId"=EXCLUDED."departementId"`,
		`INSERT INTO "prospects" ("id","nom","prenom","phoneE164","banqueId","syndicatId","representantId","createdById","clientCreatedAt","createdAt","updatedAt","projet","statut","type","professionId","incomeBandId","employeurId","canalProvenanceId","paysResidenceId","villeResidence","email","phase2Status","enrollmentMethod","enrollmentCapturedAt","enrollmentCapturedById","lastCallAt","lastCallById","lastReasonId")
		SELECT '0199f100-0000-7001-8000-'||lpad(g::text,12,'0'),
		  (ARRAY['Diop','Ndiaye','Fall','Sow','Diallo','Sarr','Ba','Gueye','Faye','Thiam','Kane','Mbaye','Cissé'])[1+(g-1)%13],
		  (ARRAY['Aminata','Mamadou','Fatou','Ibrahima','Awa','Cheikh','Mariama','Ousmane','Khady','Abdou','Ndèye','Pape'])[1+(g-1)%12],
		  '+2217'||(ARRAY['7','8','6','0'])[1+(g-1)%4]||((g*104729+51)%9000000+1000000)::text,b.id,sy.id,'0199f100-0000-7000-8000-'||lpad((1+(g-1)%240)::text,12,'0'),
		  u.id,jour+ecoule*.4,jour+ecoule*.4,now(),CASE WHEN ((g-1)/60)%2=0 THEN 'CHUES'::"Projet" ELSE 'GRAND_PUBLIC'::"Projet" END,
		  CASE WHEN g<=240 THEN 'CONVERTI'::"ProspectStatut" ELSE 'CONTACTE'::"ProspectStatut" END,'FONCTIONNAIRE'::"ProspectType",
		  (SELECT id FROM "professions" WHERE "isTeaching" ORDER BY code LIMIT 1),(SELECT id FROM "income_bands" ORDER BY "position" LIMIT 1),
		  (SELECT id FROM "employeurs" ORDER BY code LIMIT 1),c.id,(SELECT id FROM "pays" WHERE code='SN'),'Dakar','dev'||g||'@example.test',
		  CASE WHEN g<=240 THEN 'METHOD_OBTAINED'::"Phase2Status" ELSE 'PENDING'::"Phase2Status" END,
		  CASE WHEN g<=240 THEN (ARRAY['PLATFORM','WHATSAPP','VOICE_OR_ELECTRONIC_MESSAGING']::"EnrollmentMethod"[])[1+((g-1)/60+(g-1)%60)%3] END,
		  CASE WHEN g<=240 THEN jour+ecoule*.6 END,CASE WHEN g<=240 THEN u.id END,jour+ecoule*.6,u.id,cr.id
		FROM generate_series(1,480) g
		CROSS JOIN LATERAL (SELECT date_trunc('day',now())-make_interval(days=>(g-1)%60) AS jour,now()-date_trunc('day',now()) AS ecoule) dates
		JOIN "users" u ON u.email=CASE WHEN ((g-1)/120+(g-1)%60)%2=0 THEN 'fixture.awa@cpi.sn' ELSE 'fixture.fatou@cpi.sn' END
		JOIN "call_outcome_reasons" cr ON cr.code=CASE WHEN g<=240 THEN 'INTERESSE' WHEN g<=360 THEN 'CALLBACK' ELSE 'PAS_DE_REPONSE' END
		JOIN (SELECT id,row_number() OVER (ORDER BY "shortName") AS rang FROM "banques" WHERE "isActive") b ON b.rang=1+((g-1)/60+(g-1)%60)%4
		JOIN (SELECT id,row_number() OVER (ORDER BY sigle) AS rang FROM "syndicats" WHERE "isActive") sy ON sy.rang=1+(g-1)%3
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "canaux_provenance" WHERE "isActive") c ON c.rang=1+((g-1)/60+(g-1)%60)%4
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
		SELECT replace(p.id,'7001','7003'),p.id,p."lastCallById",p."enrollmentMethod",r.id,p."lastCallAt",p."lastCallAt",true,true,
		  'sortant',CASE WHEN NOT r."countsAsReached" THEN 0 ELSE 120+(right(p.id,3)::int%5)*30 END,p."lastCallAt"
		FROM "prospects" p JOIN "call_outcome_reasons" r ON r.id=p."lastReasonId" WHERE p.id LIKE '0199f100-0000-7001-8000-%'
		ON CONFLICT (id) DO UPDATE SET "prospectId"=EXCLUDED."prospectId","performedById"=EXCLUDED."performedById",method=EXCLUDED.method,"reasonId"=EXCLUDED."reasonId",
		  "clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt","deviceCallType"=EXCLUDED."deviceCallType",
		  "deviceCallDurationSeconds"=EXCLUDED."deviceCallDurationSeconds","deviceCallAt"=EXCLUDED."deviceCallAt"`,
		`INSERT INTO "rep_call_attempts" ("id","representantId","performedById","statutQualificationId","clientCreatedAt","createdAt","deviceCallType","deviceCallDurationSeconds","deviceCallAt")
		SELECT replace(r.id,'7000','7004'),r.id,r."lastCallById",
		  r."statutQualificationId",r."lastCallAt",r."lastCallAt",'sortant',CASE WHEN sq.effect='UNREACHABLE' THEN 0 ELSE 180 END,r."lastCallAt"
		FROM "representants" r JOIN "statuts_qualification" sq ON sq.id=r."statutQualificationId" WHERE r.id LIKE '0199f100-0000-7000-8000-%'
		ON CONFLICT (id) DO UPDATE SET "representantId"=EXCLUDED."representantId","performedById"=EXCLUDED."performedById",
		  "statutQualificationId"=EXCLUDED."statutQualificationId","clientCreatedAt"=EXCLUDED."clientCreatedAt","createdAt"=EXCLUDED."createdAt",
		  "deviceCallType"=EXCLUDED."deviceCallType","deviceCallDurationSeconds"=EXCLUDED."deviceCallDurationSeconds","deviceCallAt"=EXCLUDED."deviceCallAt"`,
		`INSERT INTO "bank_cases" ("id","reference","referenceKey","prospectId","customerName","customerPhoneE164","processingBankId","currentStageId","createdById","updatedAt") SELECT '0199f100-0000-7005-8000-000000000001','DEV-BANK-001','DEV-BANK-001',p."id",p."prenom"||' '||p."nom",p."phoneE164",(SELECT "id" FROM "banques" LIMIT 1),(SELECT "id" FROM "bank_case_stages" WHERE "code"='A_TRAITER' LIMIT 1),(SELECT "id" FROM "users" WHERE "email"='fixture.banque@cpi.sn'),now() FROM "prospects" p ORDER BY p."id" LIMIT 1 ON CONFLICT DO NOTHING`,
		`INSERT INTO "bank_case_transitions" ("id","caseId","toStageId","performedById","createdAt") SELECT '0199f100-0000-7006-8000-000000000001','0199f100-0000-7005-8000-000000000001',"currentStageId",(SELECT "id" FROM "users" WHERE "email"='fixture.banque@cpi.sn'),now() FROM "bank_cases" WHERE "id"='0199f100-0000-7005-8000-000000000001' ON CONFLICT DO NOTHING`,
		`INSERT INTO "visites" ("id","reference","visitedAt","visitorName","phoneE164","entrepriseId","objetId","directionId","destinataireId","createdById","updatedAt")
		SELECT '0199f100-0000-7007-8000-'||lpad(g::text,12,'0'),'FACTORY-VISITE-'||lpad(g::text,3,'0'),
		  date_trunc('day',now())-make_interval(days=>(g-1)%60)+(now()-date_trunc('day',now()))*.5,
		  (ARRAY['Aminata Diop','Mamadou Fall','Fatou Sarr'])[1+(g-1)%3],'+221770008'||lpad(g::text,3,'0'),e.id,o.id,d.id,dest.id,u.id,now()
		FROM generate_series(1,180) g JOIN "users" u ON u.email='fixture.accueil@cpi.sn'
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_entreprises") e ON e.rang=1+(g-1)%2
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_objets") o ON o.rang=1+(g-1)%4
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_directions") d ON d.rang=1+(g-1)%4
		JOIN (SELECT id,row_number() OVER (ORDER BY code) AS rang FROM "visite_destinataires") dest ON dest.rang=1+(g-1)%4
		ON CONFLICT (id) DO UPDATE SET reference=EXCLUDED.reference,"visitedAt"=EXCLUDED."visitedAt","entrepriseId"=EXCLUDED."entrepriseId","objetId"=EXCLUDED."objetId","directionId"=EXCLUDED."directionId","destinataireId"=EXCLUDED."destinataireId"`,
		`INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","statutDistant","prospectId","chargeUtile","dernierTirageAt","updatedAt") SELECT '0199f100-0000-7008-8000-000000000001','CHUES'::"Projet",'DEV-001','Diallo','Mariama','soumis',p."id",'{}'::jsonb,now(),now() FROM "prospects" p ORDER BY p."id" LIMIT 1 ON CONFLICT DO NOTHING`,
		`INSERT INTO "inscriptions_plateforme" ("id","projet","identifiantDistant","nom","prenom","phoneE164","email","statutDistant","etapeDistante","inscriteLe","soumiseLe","decideeLe","prospectId","chargeUtile","premierTirageAt","dernierTirageAt","updatedAt")
		SELECT replace(p.id,'7001','7020'),p.projet,'FACTORY-PLATEFORME-'||lpad(right(p.id,12)::int::text,3,'0'),p.nom,p.prenom,p."phoneE164",p.email,
		  CASE WHEN right(p.id,12)::int%5=0 THEN 'soumis' ELSE 'approved' END,CASE WHEN right(p.id,12)::int%5=0 THEN 2 ELSE 4 END,
		  p."enrollmentCapturedAt",p."enrollmentCapturedAt",CASE WHEN right(p.id,12)::int%5<>0 THEN p."enrollmentCapturedAt" END,p.id,
		  jsonb_build_object('source','factory','revenu','250000','ville','Dakar',
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
		SELECT replace(p.id,'7001','7030'),'FACTORY-BF-'||lpad(g::text,3,'0'),'FACTORY-BF-'||lpad(g::text,3,'0'),p.id,p.prenom||' '||p.nom,p."phoneE164",p."banqueId",st.id,
		  CASE WHEN st.type='CASHED' THEN 150000+g*1000 END,CASE WHEN st.type='REJECTED' THEN (SELECT id FROM "bank_rejection_reasons" WHERE code='DOCUMENT_MANQUANT') END,
		  u.id,p."lastCallAt"+(p."lastCallAt"-p."clientCreatedAt")*.25,now(),replace(p.id,'7001','7020')
		FROM generate_series(1,240) g JOIN "prospects" p ON p.id='0199f100-0000-7001-8000-'||lpad(g::text,12,'0') AND g%6<>0
		JOIN "users" u ON u.email='fixture.banque@cpi.sn'
		JOIN "bank_case_stages" st ON st.code=CASE WHEN g<=120 THEN 'ENCAISSE' WHEN g%3=0 THEN 'REJETE' ELSE 'EN_TRAITEMENT_BANQUE' END
		ON CONFLICT (id) DO UPDATE SET reference=EXCLUDED.reference,"referenceKey"=EXCLUDED."referenceKey","currentStageId"=EXCLUDED."currentStageId","amountXof"=EXCLUDED."amountXof","rejectionReasonId"=EXCLUDED."rejectionReasonId","createdAt"=EXCLUDED."createdAt","processingBankId"=EXCLUDED."processingBankId"`,
		`INSERT INTO "bank_case_transitions" ("id","caseId","toStageId","performedById","amountXof","rejectionReasonId","comment","createdAt")
		SELECT replace(bc.id,'7030','7040'),bc.id,bc."currentStageId",bc."createdById",bc."amountXof",bc."rejectionReasonId",'Traitement de démonstration',
		  bc."createdAt"+(bc."createdAt"-p."lastCallAt")
		FROM "bank_cases" bc JOIN "prospects" p ON p.id=bc."prospectId" WHERE bc.id LIKE '0199f100-0000-7030-8000-%'
		ON CONFLICT (id) DO UPDATE SET "toStageId"=EXCLUDED."toStageId","amountXof"=EXCLUDED."amountXof","rejectionReasonId"=EXCLUDED."rejectionReasonId","createdAt"=EXCLUDED."createdAt"`,
		`INSERT INTO "scheduled_callbacks" ("id","prospectId","assignedToId","scheduledAt","comment","sourceAttemptId","updatedAt")
		SELECT replace(p.id,'7001','7009'),p.id,p."lastCallById",p."lastCallAt"+interval '2 days','Rappeler',replace(p.id,'7001','7003'),now()
		FROM "prospects" p JOIN "call_outcome_reasons" cr ON cr.id=p."lastReasonId" AND cr.code='CALLBACK' WHERE p.id LIKE '0199f100-0000-7001-8000-%'
		ON CONFLICT (id) DO UPDATE SET "assignedToId"=EXCLUDED."assignedToId","scheduledAt"=EXCLUDED."scheduledAt"`,
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
		SELECT replace(p.id,'7001','7016'),p."lastCallById",p.id,p."clientCreatedAt"+(p."lastCallAt"-p."clientCreatedAt")*.9,
		  p."clientCreatedAt"+(p."lastCallAt"-p."clientCreatedAt")*.95,p."lastCallAt",replace(p.id,'7001','7003'),p."clientCreatedAt",now()
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
		`INSERT INTO "visite_import_changes" ("id","importJobId","sheet","rowNumber","kind","reference","visiteId","label","fields") SELECT '0199f100-0000-701d-8000-000000000001','0199f100-0000-700c-8000-000000000001','Visites',2,'CREATE'::"VisiteImportChangeKind",'DEV-VISITE-001','0199f100-0000-7007-8000-000000000001','Visite de démonstration','{}'::jsonb ON CONFLICT DO NOTHING`,
	}
	for i, statement := range statements {
		if _, err := tx.Exec(ctx, statement); err != nil {
			return fmt.Errorf("factory statement %d (%s): %w", i+1, statement, err)
		}
	}
	return nil
}
