package sn.cpi.go

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

private const val CANAL_TRAVAIL = "cpi_go_travail"

fun notificationTravail(context: Context, titre: String, icone: Int): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(
            NotificationChannel(CANAL_TRAVAIL, "Travail en cours", NotificationManager.IMPORTANCE_LOW),
        )
    }
    return NotificationCompat.Builder(context, CANAL_TRAVAIL)
        .setSmallIcon(icone)
        .setContentTitle(titre)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .setSilent(true)
        .build()
}

fun demarrerAuPremierPlan(service: Service, id: Int, notification: Notification, type: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        service.startForeground(id, notification, type)
    } else {
        service.startForeground(id, notification)
    }
}

fun veillePartielle(context: Context, etiquette: String, dureeMillis: Long): PowerManager.WakeLock? =
    context.getSystemService(PowerManager::class.java)
        ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, etiquette)
        ?.also { it.acquire(dureeMillis) }

/** Tient la synchronisation éveillée pendant qu'elle vide l'outbox. */
class SynchroService : Service() {
    private var veille: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val titre = intent?.getStringExtra(EXTRA_TITRE)?.takeIf(String::isNotBlank)
            ?: "Synchronisation en cours"
        demarrerAuPremierPlan(
            this,
            NOTIFICATION,
            notificationTravail(this, titre, android.R.drawable.stat_notify_sync),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
        if (veille == null) veille = veillePartielle(this, "sn.cpi.go:synchro", DUREE_MAX)
        running = true
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        running = false
        veille?.takeIf { it.isHeld }?.release()
        veille = null
        super.onDestroy()
    }

    @RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
    override fun onTimeout(startId: Int, fgsType: Int) {
        stopSelf()
    }

    companion object {
        private const val EXTRA_TITRE = "titre"
        private const val NOTIFICATION = 4301
        private const val DUREE_MAX = 10L * 60L * 1000L

        @Volatile
        var running = false
            private set

        fun demarrer(context: Context, titre: String?) {
            running = true
            val intent = Intent(context, SynchroService::class.java).putExtra(EXTRA_TITRE, titre)
            runCatching { ContextCompat.startForegroundService(context, intent) }
                .onFailure { running = false }
        }

        fun arreter(context: Context) {
            context.stopService(Intent(context, SynchroService::class.java))
            running = false
        }
    }
}
