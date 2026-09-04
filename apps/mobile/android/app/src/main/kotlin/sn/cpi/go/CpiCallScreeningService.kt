package sn.cpi.go

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

private const val REQUETE_CRM =
    "SELECT 'representant' AS kind, id FROM representants WHERE phone_e164 = ? " +
        "UNION ALL SELECT 'prospect', id FROM prospects WHERE phone_e164 = ? LIMIT 1"

/**
 * Reconnait un appel entrant deja au CRM. Ne bloque, ne rejette et ne silencie
 * jamais : la reponse rendue a Telecom est vide, et rendue avant toute lecture.
 */
class CpiCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        respondToCall(details, CallResponse.Builder().build())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            details.callDirection != Call.Details.DIRECTION_INCOMING
        ) {
            return
        }
        val numero = details.handle?.schemeSpecificPart?.let(::normaliserE164) ?: return
        lecteur.execute { consigner(numero) }
    }

    private fun consigner(e164: String) {
        val trouve = chercherDansCrm(e164)
        val prefs = TelephoniePrefs.de(this)
        val at = isoMaintenant()
        if (trouve == null) {
            val objet = JSONObject()
                .put("at", at)
                .put("numeroMasque", masquerE164(e164))
            prefs.edit()
                .putInt(TelephoniePrefs.APPELS_HORS_CRM, prefs.getInt(TelephoniePrefs.APPELS_HORS_CRM, 0) + 1)
                .putString(TelephoniePrefs.DERNIER_HORS_CRM, objet.toString())
                .apply()
            TelephonieEvents.emettre(mapOf("type" to "horsCrm", "at" to at))
            return
        }
        val (kind, id) = trouve
        val objet = JSONObject().put("at", at).put("kind", kind).put("id", id)
        prefs.edit().putString(TelephoniePrefs.DERNIER_ENTRANT_CRM, objet.toString()).apply()
        TelephonieEvents.emettre(mapOf("type" to "entrantCrm", "kind" to kind, "id" to id, "at" to at))
    }

    /**
     * `getApplicationDocumentsDirectory` de path_provider pointe sur
     * `getDir("flutter")`, pas sur `filesDir` : c'est la que drift_flutter pose
     * `cpi_go.sqlite`.
     */
    private fun fichierBase(): File? = listOf(
        File(getDir("flutter", Context.MODE_PRIVATE), "cpi_go.sqlite"),
        File(filesDir, "cpi_go.sqlite"),
    ).firstOrNull(File::isFile)

    private fun chercherDansCrm(e164: String): Pair<String, String>? {
        val fichier = fichierBase() ?: return null
        var base: SQLiteDatabase? = null
        try {
            base = SQLiteDatabase.openDatabase(
                fichier.absolutePath,
                null,
                SQLiteDatabase.OPEN_READONLY,
            )
            base.rawQuery(REQUETE_CRM, arrayOf(e164, e164)).use { curseur ->
                if (!curseur.moveToFirst()) return null
                val kind = curseur.getString(0) ?: return null
                val id = curseur.getString(1) ?: return null
                return kind to id
            }
        } catch (indisponible: SQLiteException) {
            return null
        } finally {
            runCatching { base?.close() }
        }
    }

    companion object {
        private val lecteur = Executors.newSingleThreadExecutor()
    }
}
