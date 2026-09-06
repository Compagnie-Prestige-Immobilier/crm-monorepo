package sn.cpi.go

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock

/**
 * Le receveur de flutter_local_notifications repose les alarmes ; celui-ci ne
 * note que la date, lue par le diagnostic.
 *
 * La date notee est celle du demarrage, pas l'heure de reception : Android
 * rejoue BOOT_COMPLETED chaque fois que le paquet sort de l'etat arrete, et
 * l'heure de reception ferait passer un simple relancement pour un
 * redemarrage.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val demarrage = System.currentTimeMillis() - SystemClock.elapsedRealtime()
        TelephoniePrefs.de(context).edit()
            .putString(TelephoniePrefs.DERNIER_BOOT_TRAITE, isoUtc(demarrage))
            .apply()
    }
}
