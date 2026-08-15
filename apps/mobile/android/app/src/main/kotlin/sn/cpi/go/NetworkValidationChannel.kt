package sn.cpi.go

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel

/**
 * Le verdict de validation d'Internet, tel qu'Android le calcule déjà.
 *
 * ## Pourquoi ce canal existe
 *
 * `connectivity_plus` rapporte le TYPE d'interface (wifi, mobile, aucune). Il ne
 * dit pas si cette interface route réellement quelque chose. Or c'est exactement
 * la question posée au Sénégal : portail captif d'hôtel ou de salle de
 * formation, forfait data épuisé, antenne saturée : le téléphone affiche des
 * barres et rien ne sort.
 *
 * Android connaît déjà la réponse. `NET_CAPABILITY_VALIDATED` est posée par le
 * système après sa propre sonde de portail captif ; c'est la même capacité que
 * `androidx.work` consulte pour `NetworkType.CONNECTED`, et c'est pour cela que
 * la contrainte du worker est PLUS STRICTE que ce que `connectivity_plus`
 * annonce. Ce canal se contente de lire ce verdict.
 *
 * ## Ce qu'on ne fait PAS
 *
 * On ne sonde aucun hôte tiers. Une bibliothèque de « vérification Internet »
 * interroge un serveur public toutes les dix secondes ; derrière le CGNAT d'un
 * opérateur sénégalais, une cinquantaine d'appareils partagent une même IP
 * publique et épuiseraient le plafond de 300 requêtes/minute de notre API, qui
 * se mettrait alors à répondre 429 au trafic de synchronisation réel. Ici : zéro
 * octet, zéro requête, une lecture locale.
 *
 * `NET_CAPABILITY_NOT_SUSPENDED` est lue en plus : un appel entrant sur une
 * ligne 2G suspend la donnée sans retirer la validation, et l'utilisateur voit
 * alors une synchronisation qui n'avance pas sans rien comprendre.
 */
class NetworkValidationChannel(context: Context) {
    private val appContext = context.applicationContext

    fun register(messenger: BinaryMessenger) {
        MethodChannel(messenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isValidated" -> result.success(isValidated())
                else -> result.notImplemented()
            }
        }
    }

    /**
     * `true` si le système a validé un accès Internet, `false` s'il l'a
     * explicitement infirmé, `null` s'il ne sait pas encore.
     *
     * Le `null` compte autant que les deux autres : juste après un changement
     * d'antenne, la sonde système n'a pas encore tranché. Rendre `false` à ce
     * moment-là ferait clignoter un bandeau de panne à chaque déplacement.
     */
    private fun isValidated(): Boolean? {
        val manager = appContext.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager ?: return null
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return null
        if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
            return false
        }
        if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_SUSPENDED)) {
            return false
        }
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    companion object {
        const val CHANNEL = "sn.cpi.go/network"
    }
}
