package com.ameen.app.security

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class BiometricAuth(private val context: Context) {

    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }

    fun canUseBiometrics(): Boolean {
        val result = BiometricManager.from(context).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        )
        return result == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun isKeyPermanent(): Boolean {
        return keyStore.containsAlias(KEY_ALIAS)
    }

    @Suppress("DEPRECATION")
    fun generateBiometricKey(): SecretKey {
        keyStore.load(null)
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        val builder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                0,
                KeyProperties.AUTH_BIOMETRIC_STRONG
            )
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(0)
        }

        keyGenerator.init(builder.build())
        return keyGenerator.generateKey()
    }

    fun getBiometricCipher(): Cipher {
        val key = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
            ?: throw IllegalStateException("Biometric key not found in keystore")
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        return cipher
    }

    fun getBiometricDecryptCipher(iv: ByteArray): Cipher {
        val key = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
            ?: throw IllegalStateException("Biometric key not found in keystore")
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return cipher
    }

    fun encryptVaultKey(vaultKey: ByteArray): Pair<ByteArray, ByteArray> {
        val cipher = getBiometricCipher()
        val encryptedBytes = cipher.doFinal(vaultKey)
        return Pair(cipher.iv, encryptedBytes)
    }

    fun decryptVaultKey(iv: ByteArray, encryptedKey: ByteArray): ByteArray {
        val cipher = getBiometricDecryptCipher(iv)
        return cipher.doFinal(encryptedKey)
    }

    @Suppress("DEPRECATION")
    fun showBiometricPrompt(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        onSuccess: (Cipher) -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit
    ) {
        val cipher: Cipher
        try {
            cipher = getBiometricCipher()
        } catch (e: Exception) {
            onError("تعذر تهيئة المفتاح البيومتري: ${e.message}")
            return
        }

        val promptInfoBuilder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setConfirmationRequired(false)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promptInfoBuilder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
        } else {
            promptInfoBuilder.setNegativeButtonText(
                context.getString(android.R.string.cancel)
            )
        }

        val promptInfo = promptInfoBuilder.build()
        val executor = ContextCompat.getMainExecutor(context)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(
                    result: BiometricPrompt.AuthenticationResult
                ) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess(result.cryptoObject?.cipher ?: cipher)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onFailed()
                }

                override fun onAuthenticationError(
                    errorCode: Int,
                    errString: CharSequence
                ) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }
            }
        )

        biometricPrompt.authenticate(
            promptInfo,
            BiometricPrompt.CryptoObject(cipher)
        )
    }

    fun storeEncryptedVaultKey(iv: ByteArray, encryptedKey: ByteArray) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
            .putString(
                PREF_ENCRYPTED_KEY,
                Base64.encodeToString(encryptedKey, Base64.NO_WRAP)
            )
            .apply()
    }

    fun getStoredEncryptedVaultKey(): Pair<ByteArray, ByteArray>? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ivB64 = prefs.getString(PREF_IV, null) ?: return null
        val keyB64 = prefs.getString(PREF_ENCRYPTED_KEY, null) ?: return null
        return Pair(
            Base64.decode(ivB64, Base64.NO_WRAP),
            Base64.decode(keyB64, Base64.NO_WRAP)
        )
    }

    fun deleteBiometricKey() {
        keyStore.load(null)
        if (keyStore.containsAlias(KEY_ALIAS)) {
            keyStore.deleteEntry(KEY_ALIAS)
        }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(PREF_IV)
            .remove(PREF_ENCRYPTED_KEY)
            .apply()
    }

    companion object {
        const val KEY_ALIAS = "ameen_biometric_key"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_SIZE = 256
        const val TRANSFORMATION = "AES/GCM/NoPadding"

        private const val PREFS_NAME = "ameen_biometric_prefs"
        private const val PREF_IV = "vault_key_iv"
        private const val PREF_ENCRYPTED_KEY = "encrypted_vault_key"
    }
}
