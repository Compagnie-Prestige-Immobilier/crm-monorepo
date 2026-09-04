package sn.cpi.go

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import java.time.Instant

object TelephoniePrefs {
    const val FICHIER = "sn.cpi.go.telephonie"

    const val DERNIER_BOOT_TRAITE = "dernierBootTraite"
    const val APPELS_HORS_CRM = "appelsHorsCrmIgnores"
    const val DERNIER_HORS_CRM = "dernierHorsCrm"
    const val DERNIER_ENTRANT_CRM = "dernierEntrantCrm"
    const val TYPE_SERVICE_APPEL = "typeServiceAppel"

    fun de(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(FICHIER, Context.MODE_PRIVATE)
}

fun isoUtc(millis: Long): String = Instant.ofEpochMilli(millis).toString()

fun isoMaintenant(): String = isoUtc(System.currentTimeMillis())

/**
 * Reflète `Phone.toE164` côté Dart : neuf chiffres sont un numéro sénégalais
 * national, douze commençant par 221 le sont déjà en international.
 */
fun normaliserE164(brut: String): String? {
    val chiffres = brut.filter(Char::isDigit)
    if (chiffres.length == 9) return "+221$chiffres"
    if (chiffres.length == 12 && chiffres.startsWith("221")) return "+$chiffres"
    if (chiffres.length >= 7) return "+$chiffres"
    return null
}

/** Ne laisse fuir que l'indicatif, l'opérateur et deux chiffres de fin. */
fun masquerE164(e164: String): String {
    val chiffres = e164.filter(Char::isDigit)
    if (chiffres.length < 6) return "***"
    val senegalais = chiffres.startsWith("221")
    val national = if (senegalais) chiffres.drop(3) else chiffres
    val indicatif = if (senegalais) "+221" else "+"
    return "$indicatif ${national.take(2)} *** ** ${national.takeLast(2)}"
}

fun permissionAccordee(context: Context, permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

fun nomEtatAppel(etat: Int): String = when (etat) {
    TelephonyManager.CALL_STATE_RINGING -> "sonne"
    TelephonyManager.CALL_STATE_OFFHOOK -> "decroche"
    else -> "aucun"
}

@RequiresApi(Build.VERSION_CODES.S)
private class RappelEtatAppel(private val surEtat: (String) -> Unit) :
    TelephonyCallback(), TelephonyCallback.CallStateListener {
    override fun onCallStateChanged(state: Int) = surEtat(nomEtatAppel(state))
}

@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
private class RappelEtatAppelHerite(private val surEtat: (String) -> Unit) : PhoneStateListener() {
    override fun onCallStateChanged(state: Int, phoneNumber: String?) = surEtat(nomEtatAppel(state))
}

/** L'état d'appel du système, sans écoute possible si READ_PHONE_STATE manque. */
class EcouteAppel(private val context: Context, private val surEtat: (String) -> Unit) {
    private var rappel: Any? = null

    @Suppress("DEPRECATION")
    fun demarrer(): Boolean {
        if (rappel != null) return true
        if (!permissionAccordee(context, Manifest.permission.READ_PHONE_STATE)) return false
        val telephonie = context.getSystemService(TelephonyManager::class.java) ?: return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val cible = RappelEtatAppel(surEtat)
            telephonie.registerTelephonyCallback(ContextCompat.getMainExecutor(context), cible)
            rappel = cible
        } else {
            val cible = RappelEtatAppelHerite(surEtat)
            telephonie.listen(cible, PhoneStateListener.LISTEN_CALL_STATE)
            rappel = cible
        }
        return true
    }

    @Suppress("DEPRECATION")
    fun arreter() {
        val cible = rappel ?: return
        rappel = null
        val telephonie = context.getSystemService(TelephonyManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && cible is TelephonyCallback) {
            telephonie.unregisterTelephonyCallback(cible)
        } else if (cible is PhoneStateListener) {
            telephonie.listen(cible, PhoneStateListener.LISTEN_NONE)
        }
    }
}
