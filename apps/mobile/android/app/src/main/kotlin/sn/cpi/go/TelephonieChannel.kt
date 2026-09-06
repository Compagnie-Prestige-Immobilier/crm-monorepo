package sn.cpi.go

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.CallLog
import android.provider.Settings
import android.telephony.TelephonyManager
import androidx.core.app.ActivityCompat
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

object TelephonieEvents {
    @Volatile
    var sink: EventChannel.EventSink? = null

    private val principal = Handler(Looper.getMainLooper())

    fun emettre(evenement: Map<String, Any?>) {
        val cible = sink ?: return
        principal.post { runCatching { cible.success(evenement) } }
    }
}

private val PERMISSIONS = mapOf(
    "CALL_PHONE" to Manifest.permission.CALL_PHONE,
    "READ_PHONE_STATE" to Manifest.permission.READ_PHONE_STATE,
    "READ_CALL_LOG" to Manifest.permission.READ_CALL_LOG,
)

/**
 * Ce que l'appareil autorise et ce qu'il a réellement fait des appels CRM :
 * permissions, exemption batterie, rôle de filtrage, services au premier plan et
 * journal d'appels. Le rapprochement fin d'une preuve d'appel se fait en Dart ;
 * ici on ne remonte jamais un numéro qui n'est pas celui demandé.
 */
class TelephonieChannel(private val activity: Activity) {
    private var methodes: MethodChannel? = null
    private var evenements: EventChannel? = null
    private var ecoute: EcouteAppel? = null

    private var permissionEnVol: String? = null
    private var resultatPermission: MethodChannel.Result? = null
    private var resultatBatterie: MethodChannel.Result? = null
    private var resultatRole: MethodChannel.Result? = null

    fun register(messenger: BinaryMessenger) {
        methodes = MethodChannel(messenger, CANAL).also { canal ->
            canal.setMethodCallHandler { appel, resultat -> traiter(appel, resultat) }
        }
        evenements = EventChannel(messenger, CANAL_EVENEMENTS).also { canal ->
            canal.setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    TelephonieEvents.sink = events
                    ecoute = EcouteAppel(activity) { etat ->
                        TelephonieEvents.emettre(mapOf("type" to "etatAppel", "etat" to etat))
                    }.also { it.demarrer() }
                }

                override fun onCancel(arguments: Any?) {
                    ecoute?.arreter()
                    ecoute = null
                    TelephonieEvents.sink = null
                }
            })
        }
    }

    fun dispose() {
        ecoute?.arreter()
        ecoute = null
        TelephonieEvents.sink = null
        evenements?.setStreamHandler(null)
        evenements = null
        methodes?.setMethodCallHandler(null)
        methodes = null
        resultatPermission = null
        permissionEnVol = null
        resultatBatterie = null
        resultatRole = null
    }

    private fun traiter(appel: MethodCall, resultat: MethodChannel.Result) {
        when (appel.method) {
            "etat" -> resultat.success(etat())
            "demanderPermission" -> demanderPermission(appel.argument<String>("nom"), resultat)
            "demanderExemptionBatterie" -> demanderExemptionBatterie(resultat)
            "demanderRoleScreening" -> demanderRoleScreening(resultat)
            "appeler" -> appeler(appel.argument<String>("e164"), resultat)
            "journal" -> resultat.success(
                journal(
                    appel.argument<String>("e164"),
                    appel.argument<Number>("depuisMillis")?.toLong() ?: 0L,
                ),
            )
            "synchroService" -> {
                val actif = appel.argument<Boolean>("actif") == true
                if (actif) {
                    SynchroService.demarrer(activity, appel.argument<String>("titre"))
                } else {
                    SynchroService.arreter(activity)
                }
                resultat.success(SynchroService.running)
            }
            "arreterServiceAppel" -> {
                AppelService.arreter(activity)
                resultat.success(null)
            }
            else -> resultat.notImplemented()
        }
    }

    private fun etat(): Map<String, Any?> {
        val prefs = TelephoniePrefs.de(activity)
        val telephonie = activity.getSystemService(TelephonyManager::class.java)
        return mapOf(
            "permissions" to PERMISSIONS.keys.associateWith(::etatPermission),
            "batterieExemptee" to batterieExemptee(),
            "telephone" to mapOf(
                "etatAppel" to etatAppel(telephonie),
                "sim" to etatSim(telephonie),
                "reseau" to reseau(telephonie),
            ),
            "roleScreening" to roleScreening(),
            "services" to mapOf(
                "synchro" to SynchroService.running,
                "appel" to AppelService.running,
                "typeAppel" to prefs.getString(TelephoniePrefs.TYPE_SERVICE_APPEL, null),
            ),
            "dernierBoot" to isoUtc(System.currentTimeMillis() - SystemClock.elapsedRealtime()),
            "dernierBootTraite" to prefs.getString(TelephoniePrefs.DERNIER_BOOT_TRAITE, null),
            "appelsHorsCrmIgnores" to prefs.getInt(TelephoniePrefs.APPELS_HORS_CRM, 0),
            "dernierHorsCrm" to objetJson(prefs.getString(TelephoniePrefs.DERNIER_HORS_CRM, null)),
            "dernierEntrantCrm" to objetJson(prefs.getString(TelephoniePrefs.DERNIER_ENTRANT_CRM, null)),
        )
    }

    private fun objetJson(brut: String?): Map<String, Any?>? {
        if (brut.isNullOrBlank()) return null
        return runCatching {
            val objet = JSONObject(brut)
            objet.keys().asSequence().associateWith { objet.opt(it) }
        }.getOrNull()
    }

    private fun etatPermission(nom: String): String {
        val permission = PERMISSIONS[nom] ?: return "refusee"
        val prefs = TelephoniePrefs.de(activity)
        if (permissionAccordee(activity, permission)) {
            prefs.edit().remove("definitive.$nom").apply()
            return "accordee"
        }
        if (prefs.getBoolean("definitive.$nom", false)) return "definitive"
        return "refusee"
    }

    // Le verdict « definitive » n'est pose qu'apres un refus rendu sans boite
    // de dialogue : une deduction depuis l'historique survivrait a la remise a
    // zero des permissions par Android et enverrait vers les reglages a tort.
    private fun consignerVerdict(cle: String, permission: String) {
        val accordee = permissionAccordee(activity, permission)
        val definitive = !accordee &&
            !ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
        TelephoniePrefs.de(activity).edit().putBoolean("definitive.$cle", definitive).apply()
    }

    private fun batterieExemptee(): Boolean =
        activity.getSystemService(PowerManager::class.java)
            ?.isIgnoringBatteryOptimizations(activity.packageName) == true

    @Suppress("DEPRECATION")
    private fun etatAppel(telephonie: TelephonyManager?): String {
        if (telephonie == null) return "aucun"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            !permissionAccordee(activity, Manifest.permission.READ_PHONE_STATE)
        ) {
            return "aucun"
        }
        return nomEtatAppel(telephonie.callState)
    }

    private fun etatSim(telephonie: TelephonyManager?): String = when (telephonie?.simState) {
        TelephonyManager.SIM_STATE_READY -> "prete"
        TelephonyManager.SIM_STATE_ABSENT -> "absente"
        TelephonyManager.SIM_STATE_PIN_REQUIRED,
        TelephonyManager.SIM_STATE_PUK_REQUIRED,
        TelephonyManager.SIM_STATE_NETWORK_LOCKED,
        -> "verrouillee"
        else -> "inconnue"
    }

    private fun reseau(telephonie: TelephonyManager?): String {
        if (telephonie == null) return "inconnu"
        if (!permissionAccordee(activity, Manifest.permission.READ_PHONE_STATE)) return "inconnu"
        return when (telephonie.dataNetworkType) {
            TelephonyManager.NETWORK_TYPE_NR -> "5g"
            TelephonyManager.NETWORK_TYPE_LTE, TelephonyManager.NETWORK_TYPE_IWLAN -> "lte"
            TelephonyManager.NETWORK_TYPE_UMTS,
            TelephonyManager.NETWORK_TYPE_HSDPA,
            TelephonyManager.NETWORK_TYPE_HSUPA,
            TelephonyManager.NETWORK_TYPE_HSPA,
            TelephonyManager.NETWORK_TYPE_HSPAP,
            TelephonyManager.NETWORK_TYPE_EVDO_0,
            TelephonyManager.NETWORK_TYPE_EVDO_A,
            TelephonyManager.NETWORK_TYPE_EVDO_B,
            TelephonyManager.NETWORK_TYPE_EHRPD,
            TelephonyManager.NETWORK_TYPE_TD_SCDMA,
            -> "3g"
            TelephonyManager.NETWORK_TYPE_GPRS,
            TelephonyManager.NETWORK_TYPE_EDGE,
            TelephonyManager.NETWORK_TYPE_CDMA,
            TelephonyManager.NETWORK_TYPE_1xRTT,
            TelephonyManager.NETWORK_TYPE_IDEN,
            TelephonyManager.NETWORK_TYPE_GSM,
            -> "2g"
            else -> "inconnu"
        }
    }

    private fun roleScreening(): Map<String, Any?> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return mapOf("disponible" to false, "tenu" to false)
        }
        val roles = activity.getSystemService(RoleManager::class.java)
        return mapOf(
            "disponible" to (roles?.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) == true),
            "tenu" to (roles?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true),
        )
    }

    private fun demanderPermission(nom: String?, resultat: MethodChannel.Result) {
        val cle = nom?.substringAfterLast('.')
        val permission = PERMISSIONS[cle]
        if (cle == null || permission == null) {
            resultat.error("PERMISSION_INCONNUE", "Permission inconnue: $nom", null)
            return
        }
        if (permissionAccordee(activity, permission)) {
            resultat.success("accordee")
            return
        }
        if (resultatPermission != null) {
            resultat.error("EN_VOL", "Une demande de permission est deja en cours.", null)
            return
        }
        resultatPermission = resultat
        permissionEnVol = cle
        ActivityCompat.requestPermissions(activity, arrayOf(permission), DEMANDE_PERMISSION)
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != DEMANDE_PERMISSION) return
        val attendu = resultatPermission ?: return
        val cle = permissionEnVol
        resultatPermission = null
        permissionEnVol = null
        ecoute?.demarrer()
        // Boite fermee sans choix : Android rend un tableau vide et le refus
        // n'est pas definitif, alors que la permission n'a toujours pas ete vue.
        if (grantResults.isEmpty() || cle == null) {
            attendu.success("refusee")
            return
        }
        PERMISSIONS[cle]?.let { consignerVerdict(cle, it) }
        attendu.success(etatPermission(cle))
    }

    private fun demanderExemptionBatterie(resultat: MethodChannel.Result) {
        if (batterieExemptee()) {
            resultat.success(true)
            return
        }
        if (resultatBatterie != null) {
            resultat.error("EN_VOL", "Une demande d'exemption est deja en cours.", null)
            return
        }
        val intention = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${activity.packageName}"),
        )
        try {
            activity.startActivityForResult(intention, DEMANDE_BATTERIE)
            resultatBatterie = resultat
        } catch (absente: ActivityNotFoundException) {
            resultat.success(false)
        }
    }

    private fun demanderRoleScreening(resultat: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            resultat.success(false)
            return
        }
        val roles = activity.getSystemService(RoleManager::class.java)
        if (roles == null || !roles.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
            resultat.success(false)
            return
        }
        if (roles.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
            resultat.success(true)
            return
        }
        if (resultatRole != null) {
            resultat.error("EN_VOL", "Une demande de role est deja en cours.", null)
            return
        }
        try {
            activity.startActivityForResult(
                roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING),
                DEMANDE_ROLE,
            )
            resultatRole = resultat
        } catch (absente: ActivityNotFoundException) {
            resultat.success(false)
        }
    }

    fun onActivityResult(requestCode: Int) {
        when (requestCode) {
            DEMANDE_BATTERIE -> {
                resultatBatterie?.success(batterieExemptee())
                resultatBatterie = null
            }
            DEMANDE_ROLE -> {
                val tenu = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    activity.getSystemService(RoleManager::class.java)
                        ?.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) == true
                resultatRole?.success(tenu)
                resultatRole = null
            }
        }
    }

    private fun appeler(e164: String?, resultat: MethodChannel.Result) {
        if (e164.isNullOrBlank()) {
            resultat.error("NUMERO_ABSENT", "Aucun numero a composer.", null)
            return
        }
        val destination = Uri.fromParts("tel", e164, null)
        if (permissionAccordee(activity, Manifest.permission.CALL_PHONE)) {
            val lance = runCatching {
                activity.startActivity(
                    Intent(Intent.ACTION_CALL, destination).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            }.isSuccess
            if (lance) {
                AppelService.demarrer(activity)
                resultat.success("call")
                return
            }
        }
        try {
            activity.startActivity(
                Intent(Intent.ACTION_DIAL, destination).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            resultat.success("dial")
        } catch (absente: ActivityNotFoundException) {
            resultat.success("aucun")
        }
    }

    private fun journal(e164: String?, depuisMillis: Long): List<Map<String, Any?>> {
        if (!permissionAccordee(activity, Manifest.permission.READ_CALL_LOG)) return emptyList()
        val cible = e164.orEmpty().filter(Char::isDigit).takeLast(9)
        if (cible.isNotEmpty() && cible.length < 9) return emptyList()
        val veille = veillePartielle(activity, "sn.cpi.go:journal", 10_000L)
        try {
            return lireJournal(cible, depuisMillis)
        } finally {
            veille?.takeIf { it.isHeld }?.release()
        }
    }

    private fun lireJournal(cible: String, depuisMillis: Long): List<Map<String, Any?>> {
        val entrees = mutableListOf<Map<String, Any?>>()
        val curseur = runCatching {
            activity.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                ),
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(depuisMillis.toString()),
                "${CallLog.Calls.DATE} DESC",
            )
        }.getOrNull() ?: return entrees
        curseur.use {
            while (it.moveToNext() && entrees.size < MAX_JOURNAL) {
                val numero = it.getString(0) ?: continue
                if (cible.isNotEmpty() && numero.filter(Char::isDigit).takeLast(9) != cible) continue
                entrees += mapOf(
                    "type" to typeJournal(it.getInt(1)),
                    "at" to it.getLong(2),
                    "dureeSecondes" to it.getLong(3),
                    "numero" to numero,
                )
            }
        }
        return entrees
    }

    private fun typeJournal(type: Int): String = when (type) {
        CallLog.Calls.OUTGOING_TYPE -> "sortant"
        CallLog.Calls.INCOMING_TYPE -> "entrant"
        CallLog.Calls.MISSED_TYPE -> "manque"
        CallLog.Calls.REJECTED_TYPE -> "rejete"
        CallLog.Calls.BLOCKED_TYPE -> "bloque"
        CallLog.Calls.VOICEMAIL_TYPE -> "messagerie"
        CallLog.Calls.ANSWERED_EXTERNALLY_TYPE -> "externe"
        else -> "inconnu"
    }

    companion object {
        const val CANAL = "sn.cpi.go/telephonie"
        const val CANAL_EVENEMENTS = "sn.cpi.go/telephonie/events"
        const val DEMANDE_PERMISSION = 1001
        const val DEMANDE_BATTERIE = 1002
        const val DEMANDE_ROLE = 1003
        private const val MAX_JOURNAL = 500
    }
}
