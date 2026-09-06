package sn.cpi.go

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat

/**
 * Tient l'appel CRM visible et l'appareil éveillé le temps de l'appel, puis
 * s'arrête dès que la ligne redevient libre.
 */
class AppelService : Service() {
    private val principal = Handler(Looper.getMainLooper())
    private val arretDiffere = Runnable { stopSelf() }
    private var veille: PowerManager.WakeLock? = null
    private var ecoute: EcouteAppel? = null
    private var ligneOccupee = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = demarrerAvecRepli(
            notificationTravail(this, "Appel CRM en cours", android.R.drawable.stat_sys_phone_call),
        )
        if (type == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        TelephoniePrefs.de(this).edit().putString(TelephoniePrefs.TYPE_SERVICE_APPEL, type).apply()
        // Sans READ_PHONE_STATE rien ne signale la fin de l'appel : le service
        // camperait jusqu'a DUREE_MAX avec sa veille et sa notification.
        if (ecoute == null) {
            val cible = EcouteAppel(this) { etat -> surEtatAppel(etat) }
            if (!cible.demarrer()) {
                stopSelf()
                return START_NOT_STICKY
            }
            ecoute = cible
        }
        running = true
        if (veille == null) veille = veillePartielle(this, "sn.cpi.go:appel", DUREE_MAX)
        principal.removeCallbacks(arretDiffere)
        principal.postDelayed(arretDiffere, DUREE_MAX)
        return START_NOT_STICKY
    }

    private fun surEtatAppel(etat: String) {
        if (etat != "aucun") {
            ligneOccupee = true
            return
        }
        if (ligneOccupee) stopSelf()
    }

    /**
     * Android 14 réserve le type `phoneCall` aux applications qui gèrent leurs
     * propres appels ; CPI GO passe par le composeur système et retombe donc sur
     * `dataSync`, le diagnostic affichant le type réellement accepté.
     */
    private fun demarrerAvecRepli(notification: Notification): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val accepte = runCatching {
                demarrerAuPremierPlan(
                    this,
                    NOTIFICATION,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
                )
            }.isSuccess
            if (accepte) return "phoneCall"
        }
        return runCatching {
            demarrerAuPremierPlan(
                this,
                NOTIFICATION,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        }.map { "dataSync" }.getOrNull()
    }

    override fun onDestroy() {
        running = false
        principal.removeCallbacks(arretDiffere)
        ecoute?.arreter()
        ecoute = null
        veille?.takeIf { it.isHeld }?.release()
        veille = null
        super.onDestroy()
    }

    @RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
    override fun onTimeout(startId: Int, fgsType: Int) {
        stopSelf()
    }

    companion object {
        private const val NOTIFICATION = 4302
        private const val DUREE_MAX = 2L * 60L * 60L * 1000L

        @Volatile
        var running = false
            private set

        fun demarrer(context: Context) {
            running = true
            runCatching {
                ContextCompat.startForegroundService(context, Intent(context, AppelService::class.java))
            }.onFailure { running = false }
        }

        fun arreter(context: Context) {
            context.stopService(Intent(context, AppelService::class.java))
            running = false
        }
    }
}
