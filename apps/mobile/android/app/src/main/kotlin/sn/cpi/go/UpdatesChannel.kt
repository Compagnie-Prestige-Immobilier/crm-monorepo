package sn.cpi.go

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * Pose l'APK téléchargé par [AppUpdateController] avec `PackageInstaller`.
 *
 * `ACTION_VIEW` sur un `content://` ouvrait le paquet dans l'installeur système
 * et rendait la main tout de suite : l'application ne savait ni si l'écran
 * s'était affiché, ni pourquoi la pose avait échoué. Une session, elle, rend un
 * statut : `STATUS_PENDING_USER_ACTION` (il faut montrer l'écran système),
 * `STATUS_SUCCESS`, ou un `STATUS_FAILURE_*` que le Dart peut traduire.
 *
 * `USER_ACTION_NOT_REQUIRED` ne rend la pose silencieuse que si CPI GO est
 * propriétaire de la mise à jour du paquet. Cette propriété se demande à
 * l'INSTALLATION INITIALE (`setRequestUpdateOwnership`, API 34+) : la première
 * mise à jour après une pose par `adb` ou par le gestionnaire de fichiers
 * repasse donc par l'écran système, les suivantes non.
 */
class UpdatesChannel(private val activity: Activity) {
    private var channel: MethodChannel? = null
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, Int.MIN_VALUE)
            if (status == PackageInstaller.STATUS_SUCCESS) return
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                val confirm = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java)
                if (confirm == null) {
                    report(status, "Écran de confirmation absent.")
                    return
                }
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.startActivity(confirm)
                return
            }
            report(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))
        }
    }

    fun register(messenger: BinaryMessenger) {
        val channel = MethodChannel(messenger, CHANNEL)
        this.channel = channel
        ContextCompat.registerReceiver(
            activity,
            receiver,
            IntentFilter(ACTION_STATUS),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "canInstall" -> result.success(canInstall())
                "freeSpaceBytes" -> result.success(freeSpaceBytes(call.argument<String>("path")))
                "openUnknownSourcesSettings" -> {
                    openUnknownSources()
                    result.success(null)
                }
                "install" -> install(
                    call.argument<String>("path"),
                    call.argument<String>("signerSha256"),
                    result,
                )
                else -> result.notImplemented()
            }
        }
    }

    fun dispose() {
        runCatching { activity.unregisterReceiver(receiver) }
        channel?.setMethodCallHandler(null)
        channel = null
        worker.shutdown()
    }

    private fun canInstall(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            activity.packageManager.canRequestPackageInstalls()

    private fun openUnknownSources() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        activity.startActivity(
            Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    private fun freeSpaceBytes(path: String?): Long {
        val target = path?.let(::File)?.takeIf { it.exists() } ?: activity.filesDir
        return StatFs(target.absolutePath).availableBytes
    }

    private fun install(path: String?, signerSha256: String?, result: MethodChannel.Result) {
        val apk = path?.let(::File)
        if (apk == null || !apk.isFile) {
            result.error("APK_ABSENT", "Fichier de mise à jour introuvable.", null)
            return
        }
        if (!canInstall()) {
            result.error("INSTALL_NOT_ALLOWED", "Installation de sources inconnues refusée.", null)
            return
        }
        val expected = signerSha256?.lowercase()
        if (expected != null && expected != archiveSigner(apk)) {
            result.error("SIGNER_MISMATCH", "Le fichier n'est pas signé par CPI.", null)
            return
        }
        // L'APK fait des dizaines de mégaoctets : le recopier dans la session sur
        // le fil principal fige l'interface assez longtemps pour un ANR.
        worker.execute {
            val outcome = runCatching { openSessionAndCommit(apk) }
            main.post {
                outcome.fold(
                    onSuccess = { result.success(it) },
                    onFailure = { result.error("INSTALLER_FAILED", it.message, null) },
                )
            }
        }
    }

    private fun openSessionAndCommit(apk: File): Int {
        val installer = activity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(activity.packageName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            params.setRequestUpdateOwnership(true)
        }
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite(APK_NAME, 0, apk.length()).use { sink ->
                apk.inputStream().use { it.copyTo(sink) }
                session.fsync(sink)
            }
            session.commit(statusIntent(sessionId).intentSender)
        }
        return sessionId
    }

    private fun statusIntent(sessionId: Int): PendingIntent {
        val intent = Intent(ACTION_STATUS).setPackage(activity.packageName)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        // Le système remplit les extras de statut : un PendingIntent immuable les
        // perdrait et la session resterait sans verdict.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
        return PendingIntent.getBroadcast(activity, sessionId, intent, flags)
    }

    @Suppress("DEPRECATION")
    private fun archiveSigner(apk: File): String? {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        val info = activity.packageManager.getPackageArchiveInfo(apk.absolutePath, flags) ?: return null
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.signingInfo?.apkContentsSigners
        } else {
            info.signatures
        }
        val certificate = signatures?.firstOrNull() ?: return null
        return MessageDigest.getInstance("SHA-256")
            .digest(certificate.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }

    private fun report(status: Int, message: String?) {
        channel?.invokeMethod(
            "installFailed",
            mapOf("status" to status, "message" to message),
        )
    }

    companion object {
        const val CHANNEL = "sn.cpi.go/updates"
        private const val ACTION_STATUS = "sn.cpi.go.INSTALL_STATUS"
        private const val APK_NAME = "cpi-go"
    }
}
