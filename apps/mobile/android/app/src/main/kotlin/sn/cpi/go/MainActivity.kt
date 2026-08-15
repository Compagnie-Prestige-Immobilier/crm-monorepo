package sn.cpi.go

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val channelName = "sn.cpi.go/updates"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Le verdict de portail captif d'Android, lu tel quel. Voir
        // NetworkValidationChannel : c'est la même capacité que `androidx.work`
        // consulte, et connectivity_plus ne l'expose pas.
        NetworkValidationChannel(this).register(flutterEngine.dartExecutor.binaryMessenger)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            if (call.method != "installApk") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val path = call.argument<String>("path")
            if (path == null) {
                result.error("INVALID_PATH", "Chemin APK absent", null)
                return@setMethodCallHandler
            }
            try {
                val apk = File(path)
                val uri: Uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
                startActivity(Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                })
                result.success(null)
            } catch (error: Exception) {
                result.error("INSTALLER_FAILED", error.message, null)
            }
        }
    }
}
