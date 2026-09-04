package sn.cpi.go

import android.accounts.AbstractAccountAuthenticator
import android.accounts.Account
import android.accounts.AccountAuthenticatorResponse
import android.accounts.AccountManager
import android.app.Service
import android.content.AbstractThreadedSyncAdapter
import android.content.ContentProviderClient
import android.content.Context
import android.content.Intent
import android.content.SyncResult
import android.os.Bundle
import android.os.IBinder

const val CPI_ACCOUNT_TYPE = "sn.cpi.go"

/**
 * Le compte propriétaire des fiches posées par [ContactsChannel].
 *
 * Il n'authentifie rien et ne détient aucun jeton. Il existe pour deux
 * propriétés du fournisseur de contacts : une écriture `CALLER_IS_SYNCADAPTER`
 * exige un compte propriétaire, et retirer ce compte fait supprimer par le
 * système toutes les fiches qui lui appartiennent.
 *
 * `UnsupportedOperationException` est le refus que `AbstractAccountAuthenticator`
 * sait traduire : « Ajouter un compte » depuis les réglages Android échoue
 * proprement au lieu de planter.
 */
class CpiAccountAuthenticatorService : Service() {
    override fun onBind(intent: Intent?): IBinder = CpiAuthenticator(this).iBinder
}

private class CpiAuthenticator(context: Context) : AbstractAccountAuthenticator(context) {
    override fun editProperties(
        response: AccountAuthenticatorResponse?,
        accountType: String?,
    ): Bundle = throw UnsupportedOperationException()

    override fun addAccount(
        response: AccountAuthenticatorResponse?,
        accountType: String?,
        authTokenType: String?,
        requiredFeatures: Array<String>?,
        options: Bundle?,
    ): Bundle = throw UnsupportedOperationException()

    override fun confirmCredentials(
        response: AccountAuthenticatorResponse?,
        account: Account?,
        options: Bundle?,
    ): Bundle = throw UnsupportedOperationException()

    override fun getAuthToken(
        response: AccountAuthenticatorResponse?,
        account: Account?,
        authTokenType: String?,
        options: Bundle?,
    ): Bundle = throw UnsupportedOperationException()

    override fun getAuthTokenLabel(authTokenType: String?): String =
        throw UnsupportedOperationException()

    override fun updateCredentials(
        response: AccountAuthenticatorResponse?,
        account: Account?,
        authTokenType: String?,
        options: Bundle?,
    ): Bundle = throw UnsupportedOperationException()

    override fun hasFeatures(
        response: AccountAuthenticatorResponse?,
        account: Account?,
        features: Array<String>?,
    ): Bundle = Bundle().apply { putBoolean(AccountManager.KEY_BOOLEAN_RESULT, false) }
}

/**
 * Adaptateur SOUCHE : il ne synchronise rien.
 *
 * Sans adaptateur déclaré pour `com.android.contacts`, le compte n'est pas un
 * compte de contacts aux yeux du fournisseur, et les applications Contacts des
 * constructeurs peuvent masquer ses fiches.
 */
class CpiContactsSyncService : Service() {
    override fun onBind(intent: Intent?): IBinder = synchronized(lock) {
        (adapter ?: CpiSyncAdapter(applicationContext).also { adapter = it }).syncAdapterBinder
    }

    private companion object {
        val lock = Any()
        var adapter: CpiSyncAdapter? = null
    }
}

private class CpiSyncAdapter(context: Context) : AbstractThreadedSyncAdapter(context, true) {
    override fun onPerformSync(
        account: Account?,
        extras: Bundle?,
        authority: String?,
        provider: ContentProviderClient?,
        syncResult: SyncResult?,
    ) = Unit
}
