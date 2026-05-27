package com.ameen.app.services

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class BackupServiceTest {

    @Test
    fun `AES GCM encrypt and decrypt round-trip restores original data`() {
        val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val originalData = "أهلاً بك في أمين — هذه بيانات اختبار التشفير".toByteArray(Charsets.UTF_8)

        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val keySpec = SecretKeySpec(key, "AES")
        val gcmSpec = GCMParameterSpec(128, iv)

        val encryptCipher = Cipher.getInstance("AES/GCM/NoPadding")
        encryptCipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
        val ciphertext = encryptCipher.doFinal(originalData)

        val decryptCipher = Cipher.getInstance("AES/GCM/NoPadding")
        decryptCipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)
        val decrypted = decryptCipher.doFinal(ciphertext)

        assertArrayEquals(originalData, decrypted, "فك التشفير يجب أن يعيد البيانات الأصلية")
    }

    @Test
    fun `wrong key fails decryption`() {
        val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val wrongKey = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val data = "بيانات سرية".toByteArray(Charsets.UTF_8)

        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val keySpec = SecretKeySpec(key, "AES")
        val gcmSpec = GCMParameterSpec(128, iv)

        val encryptCipher = Cipher.getInstance("AES/GCM/NoPadding")
        encryptCipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
        val ciphertext = encryptCipher.doFinal(data)

        val wrongKeySpec = SecretKeySpec(wrongKey, "AES")
        val decryptCipher = Cipher.getInstance("AES/GCM/NoPadding")
        decryptCipher.init(Cipher.DECRYPT_MODE, wrongKeySpec, gcmSpec)

        assertThrows(Exception::class.java) {
            decryptCipher.doFinal(ciphertext)
        }
    }

    @Test
    fun `bytesToHex and hexToBytes round-trip via reflection`() {
        val backupService = createBackupServiceForReflection()
        val method_hexToBytes = BackupService::class.java.getDeclaredMethod("hexToBytes", String::class.java)
        method_hexToBytes.isAccessible = true
        val method_bytesToHex = BackupService::class.java.getDeclaredMethod("bytesToHex", ByteArray::class.java)
        method_bytesToHex.isAccessible = true

        val original = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val hex = method_bytesToHex.invoke(backupService, original) as String
        val restored = method_hexToBytes.invoke(backupService, hex) as ByteArray

        assertArrayEquals(original, restored, "hexToBytes يجب أن يعكس bytesToHex")
    }

    @Test
    fun `hexToBytes handles lowercase hex`() {
        val backupService = createBackupServiceForReflection()
        val method = BackupService::class.java.getDeclaredMethod("hexToBytes", String::class.java)
        method.isAccessible = true

        val hex = "a1b2c3d4"
        val bytes = method.invoke(backupService, hex) as ByteArray

        assertEquals(4, bytes.size)
        assertEquals(0xA1.toByte(), bytes[0])
        assertEquals(0xB2.toByte(), bytes[1])
        assertEquals(0xC3.toByte(), bytes[2])
        assertEquals(0xD4.toByte(), bytes[3])
    }

    @Test
    fun `hexToBytes round-trips single byte values`() {
        val backupService = createBackupServiceForReflection()
        val hexToBytes = BackupService::class.java.getDeclaredMethod("hexToBytes", String::class.java)
        hexToBytes.isAccessible = true
        val bytesToHex = BackupService::class.java.getDeclaredMethod("bytesToHex", ByteArray::class.java)
        bytesToHex.isAccessible = true

        for (b in 0..255) {
            val original = byteArrayOf(b.toByte())
            val hex = bytesToHex.invoke(backupService, original) as String
            val restored = hexToBytes.invoke(backupService, hex) as ByteArray
            assertArrayEquals(original, restored, "فشل لـ byte=$b, hex=$hex")
        }
    }

    private fun createBackupServiceForReflection(): BackupService {
        val constructor = BackupService::class.java.getDeclaredConstructor(android.content.Context::class.java)
        constructor.isAccessible = true
        return constructor.newInstance(null as android.content.Context?)
    }
}
