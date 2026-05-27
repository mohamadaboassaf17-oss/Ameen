package com.ameen.app.security

data class BiometricState(
    val isAvailable: Boolean = false,
    val isKeyStored: Boolean = false,
    val requiresMasterPassword: Boolean = false,
    val encryptedVaultKey: ByteArray? = null,
    val iv: ByteArray? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BiometricState) return false
        return isAvailable == other.isAvailable &&
                isKeyStored == other.isKeyStored &&
                requiresMasterPassword == other.requiresMasterPassword &&
                encryptedVaultKey.contentEquals(other.encryptedVaultKey) &&
                iv.contentEquals(other.iv)
    }

    override fun hashCode(): Int {
        var result = isAvailable.hashCode()
        result = 31 * result + isKeyStored.hashCode()
        result = 31 * result + requiresMasterPassword.hashCode()
        result = 31 * result + (encryptedVaultKey?.contentHashCode() ?: 0)
        result = 31 * result + (iv?.contentHashCode() ?: 0)
        return result
    }
}
