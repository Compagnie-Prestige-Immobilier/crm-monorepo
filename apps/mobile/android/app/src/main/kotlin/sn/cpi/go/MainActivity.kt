package sn.cpi.go

import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    private var updates: UpdatesChannel? = null
    private var contacts: ContactsChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Le verdict de portail captif d'Android, lu tel quel. Voir
        // NetworkValidationChannel : c'est la même capacité que `androidx.work`
        // consulte, et connectivity_plus ne l'expose pas.
        NetworkValidationChannel(this).register(flutterEngine.dartExecutor.binaryMessenger)
        updates = UpdatesChannel(this).also {
            it.register(flutterEngine.dartExecutor.binaryMessenger)
        }
        contacts = ContactsChannel(this).also {
            it.register(flutterEngine.dartExecutor.binaryMessenger)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        contacts?.onPermissionResult(requestCode, grantResults)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        updates?.dispose()
        updates = null
        contacts?.dispose()
        contacts = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
