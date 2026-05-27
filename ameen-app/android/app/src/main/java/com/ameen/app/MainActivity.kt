package com.ameen.app

import android.os.Bundle
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.ameen.app.security.BiometricAuth
import com.ameen.app.security.BiometricState
import com.ameen.app.security.KeyDerivation
import com.ameen.app.ui.screens.VaultScreen
import com.ameen.app.ui.theme.AmeenTheme

enum class UnlockState {
    CHECKING,
    LOCKED_NEED_PASSWORD,
    LOCKED_BIOMETRIC,
    UNLOCKED
}

class MainActivity : ComponentActivity() {

    private lateinit var biometricAuth: BiometricAuth

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Prevent screenshots and screen recording
        window.setFlags(
            android.view.WindowManager.LayoutParams.FLAG_SECURE,
            android.view.WindowManager.LayoutParams.FLAG_SECURE
        )

        biometricAuth = BiometricAuth(this)
        enableEdgeToEdge()
        setContent {
            AmeenTheme {
                AmeenApp(
                    biometricAuth = biometricAuth,
                    activity = this
                )
            }
        }
    }
}

@Composable
fun AmeenApp(
    biometricAuth: BiometricAuth,
    activity: FragmentActivity
) {
    var unlockState by remember { mutableStateOf(UnlockState.CHECKING) }
    var statusText by remember { mutableStateOf("") }
    var errorText by remember { mutableStateOf<String?>(null) }
    var biometricState by remember { mutableStateOf(BiometricState()) }

    LaunchedEffect(Unit) {
        val canUseBio = biometricAuth.canUseBiometrics()
        val keyExists = biometricAuth.isKeyPermanent()

        biometricState = BiometricState(
            isAvailable = canUseBio,
            isKeyStored = keyExists,
            requiresMasterPassword = !keyExists
        )

        if (!canUseBio) {
            unlockState = UnlockState.LOCKED_NEED_PASSWORD
            statusText = "لا تتوفر البصمة — يُرجى إدخال كلمة المرور الرئيسية"
        } else if (keyExists) {
            unlockState = UnlockState.LOCKED_BIOMETRIC
            statusText = "استخدم البصمة لفتح الخزنة"
        } else {
            unlockState = UnlockState.LOCKED_NEED_PASSWORD
            statusText = "يُرجى إدخال كلمة المرور الرئيسية"
        }
    }

    if (unlockState == UnlockState.UNLOCKED) {
        VaultScreen(
            onLock = {
                if (biometricState.isAvailable && biometricState.isKeyStored) {
                    unlockState = UnlockState.LOCKED_BIOMETRIC
                    statusText = "استخدم البصمة لفتح الخزنة"
                } else {
                    unlockState = UnlockState.LOCKED_NEED_PASSWORD
                    statusText = if (!biometricState.isAvailable)
                        "لا تتوفر البصمة — يُرجى إدخال كلمة المرور الرئيسية"
                    else "يُرجى إدخال كلمة المرور الرئيسية"
                }
                errorText = null
            }
        )
    } else {
        Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "أمين",
                    style = MaterialTheme.typography.headlineLarge,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "مدير كلمات المرور",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(48.dp))

                when (unlockState) {
                    UnlockState.CHECKING -> {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "جارٍ التحقق...",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }

                    UnlockState.LOCKED_NEED_PASSWORD -> {
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        var masterPassword by remember { mutableStateOf("") }

                        OutlinedTextField(
                            value = masterPassword,
                            onValueChange = { masterPassword = it },
                            label = { Text("كلمة المرور الرئيسية") },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = {
                                if (masterPassword.isBlank()) {
                                    errorText = "يُرجى إدخال كلمة المرور"
                                    return@Button
                                }
                                errorText = null

                                try {
                                    val prefs = activity.getSharedPreferences(
                                        "ameen_vault_prefs",
                                        android.content.Context.MODE_PRIVATE
                                    )
                                    val storedSaltB64 = prefs.getString("salt", null)
                                    val derivation = KeyDerivation()
                                    val vaultKey: ByteArray

                                    if (storedSaltB64 == null) {
                                        val salt = derivation.generateSalt()
                                        val result = derivation.deriveKey(masterPassword, salt)
                                        vaultKey = result.vaultKey

                                        prefs.edit()
                                            .putString("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
                                            .putString("verification_hash", Base64.encodeToString(result.verificationHash, Base64.NO_WRAP))
                                            .apply()

                                        biometricAuth.generateBiometricKey()
                                        val (iv, encryptedKey) = biometricAuth.encryptVaultKey(vaultKey)
                                        biometricAuth.storeEncryptedVaultKey(iv, encryptedKey)
                                    } else {
                                        val salt = Base64.decode(storedSaltB64, Base64.NO_WRAP)
                                        val storedHashB64 = prefs.getString("verification_hash", null)
                                        val storedHash = Base64.decode(storedHashB64, Base64.NO_WRAP)

                                        if (!derivation.verifyKey(masterPassword, salt, storedHash)) {
                                            errorText = "كلمة المرور غير صحيحة"
                                            return@Button
                                        }

                                        val result = derivation.deriveKey(masterPassword, salt)
                                        vaultKey = result.vaultKey
                                    }

                                    unlockState = UnlockState.UNLOCKED
                                    statusText = "تم فتح الخزنة بنجاح"
                                } catch (e: Exception) {
                                    errorText = "خطأ: ${e.message}"
                                }
                            }
                        ) {
                            Text("فتح الخزنة")
                        }
                    }

                    UnlockState.LOCKED_BIOMETRIC -> {
                        Text(
                            text = statusText,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = {
                                errorText = null
                                biometricAuth.showBiometricPrompt(
                                    activity = activity,
                                    title = "التحقق البيومتري",
                                    subtitle = "استخدم بصمتك لفتح الخزنة",
                                    onSuccess = { cipher ->
                                        try {
                                            val storedData =
                                                biometricAuth.getStoredEncryptedVaultKey()
                                            if (storedData != null) {
                                                val (iv, encryptedKey) = storedData
                                                biometricAuth.decryptVaultKey(
                                                    iv,
                                                    encryptedKey
                                                )
                                            }
                                            unlockState = UnlockState.UNLOCKED
                                            statusText = "تم فتح الخزنة بنجاح"
                                        } catch (e: Exception) {
                                            errorText =
                                                "فشل فك تشفير الخزنة: ${e.message}"
                                        }
                                    },
                                    onError = { errString ->
                                        when {
                                            errString.contains("cancel", ignoreCase = true) ||
                                                    errString.contains("إلغاء") -> {
                                                errorText = "تم إلغاء التحقق"
                                            }
                                            errString.contains("No biometrics") ||
                                                    errString.contains("BIOMETRIC_ERROR_NONE_ENROLLED") -> {
                                                unlockState =
                                                    UnlockState.LOCKED_NEED_PASSWORD
                                                statusText =
                                                    "لا توجد بصمات مسجلة — يُرجى إدخال كلمة المرور"
                                            }
                                            else -> {
                                                errorText =
                                                    "خطأ في التحقق: $errString"
                                                unlockState =
                                                    UnlockState.LOCKED_NEED_PASSWORD
                                                statusText =
                                                    "يُرجى إدخال كلمة المرور الرئيسية"
                                            }
                                        }
                                    },
                                    onFailed = {
                                        errorText = "فشل التحقق — حاول مرة أخرى"
                                    }
                                )
                            }
                        ) {
                            Text("التحقق بالبصمة")
                        }

                        if (unlockState == UnlockState.LOCKED_NEED_PASSWORD && errorText != null) {
                            Spacer(modifier = Modifier.height(16.dp))

                            var fallbackPassword by remember { mutableStateOf("") }

                            OutlinedTextField(
                                value = fallbackPassword,
                                onValueChange = { fallbackPassword = it },
                                label = { Text("كلمة المرور الرئيسية") },
                                visualTransformation = PasswordVisualTransformation(),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            Button(
                                onClick = {
                                    if (fallbackPassword.isBlank()) {
                                        errorText = "يُرجى إدخال كلمة المرور"
                                        return@Button
                                    }
                                    errorText = null
                                    try {
                                        val prefs = activity.getSharedPreferences(
                                            "ameen_vault_prefs",
                                            android.content.Context.MODE_PRIVATE
                                        )
                                        val storedSaltB64 = prefs.getString("salt", null)
                                        val derivation = KeyDerivation()
                                        val vaultKey: ByteArray

                                        if (storedSaltB64 == null) {
                                            val salt = derivation.generateSalt()
                                            val result = derivation.deriveKey(fallbackPassword, salt)
                                            vaultKey = result.vaultKey

                                            prefs.edit()
                                                .putString("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
                                                .putString("verification_hash", Base64.encodeToString(result.verificationHash, Base64.NO_WRAP))
                                                .apply()

                                            biometricAuth.generateBiometricKey()
                                            val (iv, encryptedKey) = biometricAuth.encryptVaultKey(vaultKey)
                                            biometricAuth.storeEncryptedVaultKey(iv, encryptedKey)
                                        } else {
                                            val salt = Base64.decode(storedSaltB64, Base64.NO_WRAP)
                                            val storedHashB64 = prefs.getString("verification_hash", null)
                                            val storedHash = Base64.decode(storedHashB64, Base64.NO_WRAP)

                                            if (!derivation.verifyKey(fallbackPassword, salt, storedHash)) {
                                                errorText = "كلمة المرور غير صحيحة"
                                                return@Button
                                            }

                                            val result = derivation.deriveKey(fallbackPassword, salt)
                                            vaultKey = result.vaultKey
                                        }

                                        unlockState = UnlockState.UNLOCKED
                                        statusText = "تم فتح الخزنة بنجاح"
                                    } catch (e: Exception) {
                                        errorText = "خطأ: ${e.message}"
                                    }
                                }
                            ) {
                                Text("فتح الخزنة")
                            }
                        }
                    }

                    else -> {}
                }

                if (errorText != null) {
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = errorText!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
