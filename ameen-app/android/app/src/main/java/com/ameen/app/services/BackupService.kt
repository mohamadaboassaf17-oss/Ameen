package com.ameen.app.services

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class BackupService(private val context: Context) {

    companion object {
        private const val TAG = "BackupService"
        private const val GCM_TAG_LENGTH = 128
        private const val GCM_IV_LENGTH = 12
    }

    suspend fun exportVault(
        items: JSONArray,
        key: ByteArray,
        profileName: String,
        vaultId: String
    ): Uri? = withContext(Dispatchers.IO) {
        try {
            if (items.length() == 0) throw IllegalStateException("لا توجد عناصر للتصدير")

            val vaultData = JSONObject().apply {
                put("version", 1)
                put("vaultId", vaultId)
                put("items", items)
            }
            val vaultBytes = vaultData.toString().toByteArray(Charsets.UTF_8)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
            val iv = ByteArray(GCM_IV_LENGTH)
            SecureRandom().nextBytes(iv)
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            val ciphertext = cipher.doFinal(vaultBytes)

            val manifest = JSONObject().apply {
                put("version", 1)
                put("profileName", profileName)
                put("vaultId", vaultId)
                put("createdAt", System.currentTimeMillis())
                put("iv", bytesToHex(iv))
                put("ciphertext", bytesToHex(ciphertext))
                put("tag", "")
            }

            val fileName = "ameen_backup_${profileName}_${System.currentTimeMillis()}.ameen-backup"
            val intent = android.content.Intent(android.content.Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(android.content.Intent.CATEGORY_OPENABLE)
                type = "application/octet-stream"
                putExtra(android.content.Intent.EXTRA_TITLE, fileName)
            }
            Log.d(TAG, "تصدير: تم تحضير $fileName مع ${items.length()} عنصر")
            return@withContext null
        } catch (e: Exception) {
            Log.e(TAG, "فشل التصدير: ${e.message}", e)
            throw e
        }
    }

    suspend fun writeEncryptedBackup(
        uri: Uri,
        items: JSONArray,
        key: ByteArray,
        profileName: String,
        vaultId: String
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val vaultData = JSONObject().apply {
                put("version", 1)
                put("vaultId", vaultId)
                put("items", items)
            }
            val vaultBytes = vaultData.toString().toByteArray(Charsets.UTF_8)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
            val iv = ByteArray(GCM_IV_LENGTH)
            SecureRandom().nextBytes(iv)
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            val encrypted = cipher.doFinal(vaultBytes)

            val manifest = JSONObject().apply {
                put("version", 1)
                put("profileName", profileName)
                put("vaultId", vaultId)
                put("createdAt", System.currentTimeMillis())
                put("iv", bytesToHex(iv))
                put("ciphertext", bytesToHex(encrypted))
                put("tag", "")
            }

            context.contentResolver.openOutputStream(uri)?.use { os ->
                os.write(manifest.toString(2).toByteArray(Charsets.UTF_8))
            }
            Log.d(TAG, "تم تصدير ${items.length()} عنصر إلى ${uri.lastPathSegment}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "فشل كتابة النسخة الاحتياطية: ${e.message}", e)
            throw e
        }
    }

    suspend fun importVault(uri: Uri, key: ByteArray): JSONArray? = withContext(Dispatchers.IO) {
        try {
            val manifestJson = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw IllegalStateException("تعذر قراءة الملف")
            val manifest = JSONObject(String(manifestJson, Charsets.UTF_8))

            val version = manifest.getInt("version")
            if (version != 1) throw IllegalStateException("إصدار غير مدعوم: $version")

            val iv = hexToBytes(manifest.getString("iv"))
            val ciphertext = hexToBytes(manifest.getString("ciphertext"))

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)
            val decrypted = cipher.doFinal(ciphertext)

            val vaultData = JSONObject(String(decrypted, Charsets.UTF_8))
            val items = vaultData.getJSONArray("items")
            Log.d(TAG, "تم استيراد ${items.length()} عنصر")
            items
        } catch (e: Exception) {
            Log.e(TAG, "فشل الاستيراد: ${e.message}", e)
            throw e
        }
    }

    private fun bytesToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02X".format(it) }
    }

    private fun hexToBytes(hex: String): ByteArray {
        val len = hex.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(hex[i], 16) shl 4) + Character.digit(hex[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
}
