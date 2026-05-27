package com.ameen.app.security

import com.lambdapioneer.argon2kt.Argon2Kt
import java.security.SecureRandom

class KeyDerivation {

    private val argon2 = Argon2Kt()

    fun deriveKey(password: String, salt: ByteArray): DerivationResult {
        val hash = argon2.hash(
            Argon2Kt.HashMode.ARGON2_ID,
            password.toByteArray(Charsets.UTF_8),
            salt,
            ITERATIONS,
            MEMORY,
            PARALLELISM,
            HASH_LENGTH
        )
        val vaultKey = hash.copyOfRange(0, KEY_LENGTH)
        val verificationHash = hash.copyOfRange(KEY_LENGTH, HASH_LENGTH)
        return DerivationResult(vaultKey, verificationHash)
    }

    fun verifyKey(
        password: String,
        salt: ByteArray,
        expectedVerificationHash: ByteArray
    ): Boolean {
        val result = deriveKey(password, salt)
        return result.verificationHash.contentEquals(expectedVerificationHash)
    }

    fun generateSalt(): ByteArray {
        val salt = ByteArray(SALT_LENGTH)
        SecureRandom().nextBytes(salt)
        return salt
    }

    data class DerivationResult(
        val vaultKey: ByteArray,
        val verificationHash: ByteArray
    )

    companion object {
        private const val ITERATIONS = 3
        private const val MEMORY = 64 * 1024
        private const val PARALLELISM = 4
        private const val SALT_LENGTH = 32
        private const val KEY_LENGTH = 32
        private const val HASH_LENGTH = 64
    }
}
