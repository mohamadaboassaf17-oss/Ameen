package com.ameen.app.services

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.zip.GZIPInputStream
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class KdbxImportService(private val context: Context) {

    companion object {
        private const val TAG = "KdbxImportService"
        private const val KDBX_SIG1 = 0x9AA2D903L
        private const val KDBX_SIG2 = 0xB54BFB67L
        private const val KDBX_VER_3_1 = 0x00030001L

        private const val HDR_END = 0
        private const val HDR_CIPHER_ID = 2
        private const val HDR_COMPRESSION = 3
        private const val HDR_MASTER_SEED = 4
        private const val HDR_TRANSFORM_SEED = 5
        private const val HDR_TRANSFORM_ROUNDS = 6
        private const val HDR_ENCRYPTION_IV = 7
        private const val HDR_PROTECTED_KEY = 8
        private const val HDR_STREAM_START = 9
        private const val HDR_INNER_STREAM_ID = 10

        private val CIPHER_AES256 = byteArrayOf(
            0x31.toByte(), 0xC1.toByte(), 0xF2.toByte(), 0xE6.toByte(),
            0xBF.toByte(), 0x71.toByte(), 0x43.toByte(), 0x50.toByte(),
            0xBE.toByte(), 0x58.toByte(), 0x05.toByte(), 0x21.toByte(),
            0x6A.toByte(), 0xFC.toByte(), 0x5A.toByte(), 0xFF.toByte()
        )
    }

    data class KdbxImportResult(
        val items: JSONArray = JSONArray(),
        val databaseName: String = "",
        val entryCount: Int = 0
    )

    suspend fun importFromUri(uri: Uri, password: String): KdbxImportResult = withContext(Dispatchers.IO) {
        try {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw IllegalStateException("تعذر قراءة ملف KDBX")
            readKdbx(bytes, password)
        } catch (e: Exception) {
            Log.e(TAG, "فشل استيراد KDBX: ${e.message}", e)
            throw e
        }
    }

    fun readKdbx(kdbxBytes: ByteArray, password: String): KdbxImportResult {
        try {
            if (kdbxBytes.size < 12) throw IllegalStateException("ملف KDBX صغير جداً")

            val buf = kdbxBytes.inputStream().buffered()
            val sig1 = readUInt32(buf)
            val sig2 = readUInt32(buf)
            val ver = readUInt32(buf)

            if (sig1 != KDBX_SIG1 || sig2 != KDBX_SIG2)
                throw IllegalStateException("ليس ملف KDBX صالح")
            if (ver != KDBX_VER_3_1)
                throw IllegalStateException("إصدار KDBX غير مدعوم — يدعم فقط 3.1")

            val header = parseHeader(buf)
            val encryptedPayload = buf.readBytes()

            val aesKey = deriveKey(password, header.transformSeed!!, header.transformRounds, header.masterSeed!!)

            val decrypted = decryptAesCbc(aesKey, header.encryptionIv!!, encryptedPayload)

            header.streamStartBytes?.let { start ->
                for (i in start.indices) {
                    if (i < decrypted.size && decrypted[i] != start[i])
                        throw IllegalStateException("كلمة المرور غير صحيحة")
                }
            }

            val xmlBytes = if (header.compression == 1L) gzipDecompress(decrypted) else decrypted
            val xmlText = String(xmlBytes, Charsets.UTF_8)

            return parseXml(xmlText, header.protectedStreamKey ?: ByteArray(32))
        } catch (e: Exception) {
            Log.e(TAG, "فشل قراءة KDBX: ${e.message}", e)
            throw e
        }
    }

    // ============================================================
    // Header Parsing
    // ============================================================

    data class KdbxHeader(
        var masterSeed: ByteArray? = null,
        var transformSeed: ByteArray? = null,
        var transformRounds: Long = 0,
        var encryptionIv: ByteArray? = null,
        var protectedStreamKey: ByteArray? = null,
        var streamStartBytes: ByteArray? = null,
        var compression: Long = 0
    )

    private fun parseHeader(buf: java.io.InputStream): KdbxHeader {
        val header = KdbxHeader()

        while (true) {
            val fieldType = buf.read()
            if (fieldType < 0) break
            if (fieldType == HDR_END) break

            val fieldSize = (buf.read() or (buf.read() shl 8))
            val fieldData = ByteArray(fieldSize)
            buf.read(fieldData)

            when (fieldType) {
                HDR_CIPHER_ID -> {
                    if (!fieldData.contentEquals(CIPHER_AES256))
                        throw IllegalStateException("نوع تشفير غير مدعوم — يتطلب AES-256")
                }
                HDR_COMPRESSION -> {
                    if (fieldSize >= 4)
                        header.compression = (fieldData[0].toLong() and 0xFF) or
                            ((fieldData[1].toLong() and 0xFF) shl 8) or
                            ((fieldData[2].toLong() and 0xFF) shl 16) or
                            ((fieldData[3].toLong() and 0xFF) shl 24)
                }
                HDR_MASTER_SEED -> header.masterSeed = fieldData
                HDR_TRANSFORM_SEED -> header.transformSeed = fieldData
                HDR_TRANSFORM_ROUNDS -> {
                    var rounds = 0L
                    for (i in 7 downTo 0) {
                        val b = if (i < fieldSize) fieldData[i].toLong() and 0xFF else 0
                        rounds = (rounds shl 8) or b
                    }
                    header.transformRounds = rounds
                }
                HDR_ENCRYPTION_IV -> header.encryptionIv = fieldData
                HDR_PROTECTED_KEY -> header.protectedStreamKey = fieldData
                HDR_STREAM_START -> header.streamStartBytes = fieldData
            }
        }
        return header
    }

    // ============================================================
    // Key Derivation
    // ============================================================

    private fun deriveKey(
        password: String,
        transformSeed: ByteArray,
        transformRounds: Long,
        masterSeed: ByteArray
    ): ByteArray {
        val compositeKey = MessageDigest.getInstance("SHA-256")
            .digest(password.toByteArray(Charsets.UTF_8))

        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(compositeKey, "AES"))

        var transformed = transformSeed.clone()
        for (round in 0 until transformRounds) {
            transformed = cipher.doFinal(transformed)
        }

        val combined = transformed + masterSeed
        return MessageDigest.getInstance("SHA-256").digest(combined)
    }

    // ============================================================
    // AES-256-CBC
    // ============================================================

    private fun decryptAesCbc(key: ByteArray, iv: ByteArray, data: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/CBC/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        return cipher.doFinal(data)
    }

    // ============================================================
    // GZip
    // ============================================================

    private fun gzipDecompress(data: ByteArray): ByteArray {
        GZIPInputStream(ByteArrayInputStream(data)).use { gz ->
            ByteArrayOutputStream().use { out ->
                gz.copyTo(out)
                return out.toByteArray()
            }
        }
    }

    // ============================================================
    // Salsa20
    // ============================================================

    private fun salsa20Decrypt(key: ByteArray, iv: ByteArray, data: ByteArray): ByteArray {
        val output = ByteArray(data.size)
        val block = ByteArray(64)
        var counter = 0L

        var pos = 0
        while (pos < data.size) {
            generateSalsa20Block(key, iv, counter, block)
            counter++
            val remaining = minOf(64, data.size - pos)
            for (i in 0 until remaining) {
                output[pos + i] = (data[pos + i].toInt() xor block[i].toInt()).toByte()
            }
            pos += 64
        }
        return output
    }

    private fun generateSalsa20Block(key: ByteArray, iv: ByteArray, counter: Long, output: ByteArray) {
        val state = IntArray(16)
        state[0] = 0x61707865
        state[5] = 0x3320646E
        state[10] = 0x79622D32
        state[15] = 0x6B206574

        for (i in 0..3) state[1 + i] = bytesToInt(key, i * 4)
        state[6] = bytesToInt(iv, 0)
        state[7] = bytesToInt(iv, 4)
        state[8] = (counter and 0xFFFFFFFFL).toInt()
        state[9] = ((counter ushr 32) and 0xFFFFFFFFL).toInt()
        for (i in 0..3) state[11 + i] = bytesToInt(key, 16 + i * 4)

        val working = state.clone()

        for (i in 0 until 10) {
            qr(working, 0, 4, 8, 12)
            qr(working, 5, 9, 13, 1)
            qr(working, 10, 14, 2, 6)
            qr(working, 15, 3, 7, 11)
            qr(working, 0, 1, 2, 3)
            qr(working, 5, 6, 7, 4)
            qr(working, 10, 11, 8, 9)
            qr(working, 15, 12, 13, 14)
        }

        for (i in 0 until 16) {
            val v = (working[i] + state[i])
            intToBytes(v, output, i * 4)
        }
    }

    private fun qr(state: IntArray, a: Int, b: Int, c: Int, d: Int) {
        state[b] = state[b] xor ((state[a] + state[d]) shl 7 or ((state[a] + state[d]) ushr 25))
        state[c] = state[c] xor ((state[b] + state[a]) shl 9 or ((state[b] + state[a]) ushr 23))
        state[d] = state[d] xor ((state[c] + state[b]) shl 13 or ((state[c] + state[b]) ushr 19))
        state[a] = state[a] xor ((state[d] + state[c]) shl 18 or ((state[d] + state[c]) ushr 14))
    }

    private fun bytesToInt(bytes: ByteArray, offset: Int): Int {
        return ((bytes[offset].toInt() and 0xFF))
            or ((bytes[offset + 1].toInt() and 0xFF) shl 8)
            or ((bytes[offset + 2].toInt() and 0xFF) shl 16)
            or ((bytes[offset + 3].toInt() and 0xFF) shl 24)
    }

    private fun intToBytes(value: Int, out: ByteArray, offset: Int) {
        out[offset] = (value and 0xFF).toByte()
        out[offset + 1] = ((value ushr 8) and 0xFF).toByte()
        out[offset + 2] = ((value ushr 16) and 0xFF).toByte()
        out[offset + 3] = ((value ushr 24) and 0xFF).toByte()
    }

    // ============================================================
    // XML Parsing
    // ============================================================

    private fun parseXml(xml: String, protectedKey: ByteArray): KdbxImportResult {
        val items = JSONArray()
        val entryRegex = Regex("<Entry>([\\s\\S]*?)</Entry>")
        val dbNameMatch = Regex("<DatabaseName>(.*?)</DatabaseName>").find(xml)
        val dbName = dbNameMatch?.groupValues?.get(1)?.trim() ?: "KeePass"

        for (match in entryRegex.findAll(xml)) {
            val entryBlock = match.groupValues[1]
            val title = extractString(entryBlock, "Title", protectedKey)
            val username = extractString(entryBlock, "UserName", protectedKey)
            val password = extractString(entryBlock, "Password", protectedKey)
            val url = extractString(entryBlock, "URL", protectedKey)
            val notes = extractString(entryBlock, "Notes", protectedKey)

            if (title.isNotEmpty() || username.isNotEmpty() || password.isNotEmpty()) {
                items.put(JSONObject().apply {
                    put("id", UUID.randomUUID().toString().take(12))
                    put("type", "password")
                    put("title", title.ifEmpty { url.ifEmpty { "مستورد" } })
                    put("username", username)
                    put("password", password)
                    put("url", url)
                    put("content", "")
                    put("cardholder", "")
                    put("number", "")
                    put("expiry", "")
                    put("cvv", "")
                    put("notes", notes)
                    put("otpSecret", "")
                    put("updatedAt", System.currentTimeMillis())
                    put("isConflict", false)
                })
            }
        }

        Log.d(TAG, "تم استيراد ${items.length()} عنصر من '$dbName'")
        return KdbxImportResult(items, dbName, items.length())
    }

    private fun extractString(entryBlock: String, key: String, protectedKey: ByteArray): String {
        val stringRegex = Regex("<String>[\\s\\S]*?<Key>$key</Key>[\\s\\S]*?<Value([^>]*)>([\\s\\S]*?)</Value>[\\s\\S]*?</String>")
        val match = stringRegex.find(entryBlock) ?: return ""

        val attrs = match.groupValues[1]
        val value = match.groupValues[2]
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")

        val isProtected = attrs.contains("Protected=\"True\"", ignoreCase = true)
        return if (isProtected) decryptProtectedValue(protectedKey, value) else value
    }

    private fun decryptProtectedValue(protectedKey: ByteArray, base64Value: String): String {
        return try {
            val raw = android.util.Base64.decode(base64Value, android.util.Base64.DEFAULT)
            if (raw.size < 8) return base64Value
            val iv = raw.copyOfRange(0, 8)
            val ciphertext = raw.copyOfRange(8, raw.size)
            val plaintext = salsa20Decrypt(protectedKey, iv, ciphertext)
            val end = plaintext.indexOfLast { it != 0.toByte() } + 1
            String(plaintext, 0, end.coerceAtLeast(0), Charsets.UTF_8)
        } catch (e: Exception) {
            base64Value
        }
    }

    private fun readUInt32(buf: java.io.InputStream): Long {
        val b1 = buf.read().toLong()
        val b2 = buf.read().toLong()
        val b3 = buf.read().toLong()
        val b4 = buf.read().toLong()
        return (b1 and 0xFF) or ((b2 and 0xFF) shl 8) or ((b3 and 0xFF) shl 16) or ((b4 and 0xFF) shl 24)
    }
}
