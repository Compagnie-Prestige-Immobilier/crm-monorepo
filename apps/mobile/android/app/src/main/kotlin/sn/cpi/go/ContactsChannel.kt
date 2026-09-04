package sn.cpi.go

import android.Manifest
import android.accounts.Account
import android.accounts.AccountManager
import android.app.Activity
import android.content.ContentProviderOperation
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.ContactsContract
import android.provider.ContactsContract.CommonDataKinds.Phone
import android.provider.ContactsContract.CommonDataKinds.StructuredName
import android.provider.ContactsContract.Data
import android.provider.ContactsContract.RawContacts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executors

/**
 * Écrit le portefeuille du téléconseiller dans le répertoire du téléphone, sous
 * le compte de [CpiAccountAuthenticatorService].
 *
 * C'est le dialer natif, quel qu'il soit, qui résout ensuite le numéro entrant
 * et affiche le nom. Aucun rôle de téléphonie n'est demandé : `ROLE_CALL_SCREENING`
 * exige l'API 29 alors que le plancher est 24, et son budget de 5 secondes
 * pendant lequel le téléphone ne sonne pas n'est vérifiable sur aucune des ROM
 * Transsion et Xiaomi du parc.
 *
 * Le Dart décide QUOI écrire et QUAND ; ce canal ne fait que poser le lot. Toute
 * ligne ici est hors périmètre Shorebird et ne se corrige que par un APK complet.
 */
class ContactsChannel(private val activity: Activity) {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var pending: MethodChannel.Result? = null

    fun register(messenger: BinaryMessenger) {
        MethodChannel(messenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "hasPermission" -> result.success(granted())
                "requestPermission" -> requestPermission(result)
                "write" -> write(call, result)
                "clear" -> clear(result)
                else -> result.notImplemented()
            }
        }
    }

    fun dispose() {
        pending = null
        worker.shutdown()
    }

    /** Rendu par `MainActivity.onRequestPermissionsResult`. */
    fun onPermissionResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != PERMISSION_REQUEST) return
        val answer = pending ?: return
        pending = null
        answer.success(grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED)
    }

    private fun granted(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.WRITE_CONTACTS) ==
            PackageManager.PERMISSION_GRANTED

    private fun requestPermission(result: MethodChannel.Result) {
        if (granted()) {
            result.success(true)
            return
        }
        // Un second appel pendant que la boîte de dialogue est ouverte laisserait
        // le premier `Result` sans réponse, et le Future Dart attendrait à jamais.
        pending?.success(false)
        pending = result
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.WRITE_CONTACTS),
            PERMISSION_REQUEST,
        )
    }

    private fun write(call: MethodCall, result: MethodChannel.Result) {
        val fiches = call.argument<List<Map<String, String>>>("contacts")
        if (fiches == null) {
            result.error("arguments", "Portefeuille manquant.", null)
            return
        }
        if (!granted()) {
            result.error("permission", "Accès aux contacts refusé.", null)
            return
        }
        worker.execute {
            try {
                val millis = replace(fiches)
                main.post { result.success(millis) }
            } catch (e: Exception) {
                main.post { result.error("ecriture", e.message ?: e.javaClass.simpleName, null) }
            }
        }
    }

    private fun clear(result: MethodChannel.Result) {
        worker.execute {
            try {
                val manager = AccountManager.get(activity)
                for (account in manager.getAccountsByType(CPI_ACCOUNT_TYPE)) {
                    // Le fournisseur supprime déjà les fiches d'un compte retiré.
                    // La purge explicite couvre les ROM qui ne le font pas : une
                    // fiche du téléconseiller précédent lisible par le suivant
                    // est le défaut SEC-01, pas un désagrément d'affichage.
                    if (granted()) purge(account)
                    manager.removeAccountExplicitly(account)
                }
                main.post { result.success(null) }
            } catch (e: Exception) {
                main.post { result.error("purge", e.message ?: e.javaClass.simpleName, null) }
            }
        }
    }

    private fun replace(fiches: List<Map<String, String>>): Long {
        val debut = SystemClock.elapsedRealtime()
        val manager = AccountManager.get(activity)
        val account = Account(activity.getString(R.string.compte_contacts), CPI_ACCOUNT_TYPE)
        manager.addAccountExplicitly(account, null, null)
        // Sans compte, le fournisseur accepte les insertions puis supprime les
        // fiches à sa prochaine revue des comptes : une écriture qui ne rate pas
        // et qui ne laisse rien.
        if (manager.getAccountsByType(CPI_ACCOUNT_TYPE).none { it.name == account.name }) {
            throw IllegalStateException("Compte $CPI_ACCOUNT_TYPE indisponible.")
        }
        purge(account)

        val lot = ArrayList<ContentProviderOperation>(BATCH + 3)
        for (fiche in fiches) {
            val nom = fiche["nom"] ?: continue
            val tel = fiche["tel"] ?: continue
            val racine = lot.size
            lot.add(
                ContentProviderOperation.newInsert(asSyncAdapter(RawContacts.CONTENT_URI, account))
                    .withValue(RawContacts.ACCOUNT_NAME, account.name)
                    .withValue(RawContacts.ACCOUNT_TYPE, account.type)
                    .withValue(RawContacts.SOURCE_ID, fiche["id"])
                    // Le fournisseur garde la transaction ouverte pendant tout le
                    // lot : sans cette permission de céder la main, le dialer qui
                    // cherche un nom pendant l'écriture attend la fin.
                    .withYieldAllowed(true)
                    .build(),
            )
            lot.add(
                ContentProviderOperation.newInsert(asSyncAdapter(Data.CONTENT_URI, account))
                    .withValueBackReference(Data.RAW_CONTACT_ID, racine)
                    .withValue(Data.MIMETYPE, StructuredName.CONTENT_ITEM_TYPE)
                    .withValue(StructuredName.DISPLAY_NAME, nom)
                    .build(),
            )
            lot.add(
                ContentProviderOperation.newInsert(asSyncAdapter(Data.CONTENT_URI, account))
                    .withValueBackReference(Data.RAW_CONTACT_ID, racine)
                    .withValue(Data.MIMETYPE, Phone.CONTENT_ITEM_TYPE)
                    .withValue(Phone.NUMBER, tel)
                    .withValue(Phone.TYPE, Phone.TYPE_MOBILE)
                    .build(),
            )
            if (lot.size >= BATCH) {
                activity.contentResolver.applyBatch(ContactsContract.AUTHORITY, lot)
                lot.clear()
            }
        }
        if (lot.isNotEmpty()) {
            activity.contentResolver.applyBatch(ContactsContract.AUTHORITY, lot)
        }
        return SystemClock.elapsedRealtime() - debut
    }

    private fun purge(account: Account) {
        activity.contentResolver.delete(
            asSyncAdapter(RawContacts.CONTENT_URI, account),
            "${RawContacts.ACCOUNT_NAME} = ? AND ${RawContacts.ACCOUNT_TYPE} = ?",
            arrayOf(account.name, account.type),
        )
    }

    /**
     * Sans `CALLER_IS_SYNCADAPTER`, une suppression ne fait que poser `DELETED`
     * et les fiches restent en base en attendant un adaptateur qui ne viendra
     * jamais ; les colonnes de compte deviennent en plus non modifiables.
     */
    private fun asSyncAdapter(uri: Uri, account: Account): Uri = uri.buildUpon()
        .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
        .appendQueryParameter(RawContacts.ACCOUNT_NAME, account.name)
        .appendQueryParameter(RawContacts.ACCOUNT_TYPE, account.type)
        .build()

    private companion object {
        const val CHANNEL = "sn.cpi.go/contacts"
        const val PERMISSION_REQUEST = 4711

        /** Trois opérations par fiche, et une transaction Binder plafonne à 1 Mo. */
        const val BATCH = 300
    }
}
