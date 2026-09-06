package sn.cpi.go

import android.content.Intent
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    private var updates: UpdatesChannel? = null
    private var telephonie: TelephonieChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Le verdict de portail captif d'Android, lu tel quel. Voir
        // NetworkValidationChannel : c'est la même capacité que `androidx.work`
        // consulte, et connectivity_plus ne l'expose pas.
        NetworkValidationChannel(this).register(flutterEngine.dartExecutor.binaryMessenger)
        updates = UpdatesChannel(this).also {
            it.register(flutterEngine.dartExecutor.binaryMessenger)
        }
        telephonie = TelephonieChannel(this).also {
            it.register(flutterEngine.dartExecutor.binaryMessenger)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        telephonie?.onRequestPermissionsResult(requestCode, grantResults)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        telephonie?.onActivityResult(requestCode)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        telephonie?.dispose()
        telephonie = null
        updates?.dispose()
        updates = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
