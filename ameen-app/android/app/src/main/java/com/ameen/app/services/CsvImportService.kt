package com.ameen.app.services

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.UUID

class CsvImportService(private val context: Context) {

    companion object {
        private const val TAG = "CsvImportService"
    }

    enum class CsvFormat {
        UNKNOWN, CHROME, FIREFOX, EDGE, SAFARI, AMEEN
    }

    data class CsvImportResult(
        val items: JSONArray = JSONArray(),
        val detectedFormat: CsvFormat = CsvFormat.UNKNOWN,
        val totalRows: Int = 0,
        val importedRows: Int = 0,
        val skippedRows: Int = 0
    )

    suspend fun importFromUri(uri: Uri): CsvImportResult = withContext(Dispatchers.IO) {
        try {
            val csvText = context.contentResolver.openInputStream(uri)?.use { input ->
                val reader = BufferedReader(InputStreamReader(input, Charsets.UTF_8))
                reader.readText()
            } ?: throw IllegalStateException("تعذر قراءة ملف CSV")

            parseCsv(csvText)
        } catch (e: Exception) {
            Log.e(TAG, "فشل استيراد CSV: ${e.message}", e)
            throw e
        }
    }

    fun parseCsv(csvText: String): CsvImportResult {
        val result = CsvImportResult()

        try {
            val lines = csvText.lines().filter { it.isNotBlank() }
            if (lines.size < 2) {
                Log.d(TAG, "ملف CSV لا يحتوي على بيانات")
                return result
            }

            val headers = splitCsvLine(lines[0])
            val format = detectFormat(headers)

            if (format == CsvFormat.UNKNOWN) {
                Log.d(TAG, "تنسيق CSV غير معروف: ${headers.joinToString(",")}")
                return result
            }

            val now = System.currentTimeMillis()

            for (i in 1 until lines.size) {
                val fields = splitCsvLine(lines[i])
                if (fields.isEmpty()) continue

                val item = mapToVaultItem(fields, headers, format, now)
                if (item != null) {
                    result.items.put(item)
                }
            }

            Log.d(TAG, "تم استيراد ${result.items.length()} عنصر (تنسيق: $format)")
        } catch (e: Exception) {
            Log.e(TAG, "خطأ في تحليل CSV: ${e.message}", e)
            throw e
        }

        return result
    }

    private fun detectFormat(headers: List<String>): CsvFormat {
        val normalized = headers.map { it.trim().lowercase().replace(" ", "_") }
        return when (normalized.joinToString("_")) {
            "name_url_username_password" -> CsvFormat.CHROME
            "url_username_password_httprealm_formactionorigin_guid_timecreated_timepasswordchanged" -> CsvFormat.FIREFOX
            "name_url_username_password_note" -> CsvFormat.EDGE
            "title_url_username_password_otpauth" -> CsvFormat.SAFARI
            "id_type_title_username_password_url_content_cardholder_number_expiry_cvv_notes_otpsecret" -> CsvFormat.AMEEN
            else -> CsvFormat.UNKNOWN
        }
    }

    private fun mapToVaultItem(
        fields: List<String>,
        headers: List<String>,
        format: CsvFormat,
        now: Long
    ): JSONObject? {
        fun getField(name: String): String {
            val n = name.lowercase().replace(" ", "_")
            val idx = headers.indexOfFirst { it.trim().lowercase().replace(" ", "_") == n }
            return if (idx in fields.indices) fields[idx].trim() else ""
        }

        var title = ""
        var username = ""
        var password = ""
        var url = ""
        var notes = ""
        var otpSecret = ""

        when (format) {
            CsvFormat.CHROME -> {
                title = getField("name")
                url = getField("url")
                username = getField("username")
                password = getField("password")
            }
            CsvFormat.FIREFOX -> {
                url = getField("url")
                username = getField("username")
                password = getField("password")
                title = if (url.isNotEmpty()) url else username
            }
            CsvFormat.EDGE -> {
                title = getField("name")
                url = getField("url")
                username = getField("username")
                password = getField("password")
                notes = getField("note")
            }
            CsvFormat.SAFARI -> {
                title = getField("title")
                url = getField("url")
                username = getField("username")
                password = getField("password")
                otpSecret = getField("otpauth")
            }
            CsvFormat.AMEEN -> {
                title = getField("title")
                username = getField("username")
                password = getField("password")
                url = getField("url")
                notes = getField("notes")
                otpSecret = getField("otpsecret")
            }
            CsvFormat.UNKNOWN -> return null
        }

        if (title.isEmpty() && username.isEmpty() && password.isEmpty() && url.isEmpty()) return null

        return JSONObject().apply {
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
            put("otpSecret", otpSecret)
            put("updatedAt", now)
            put("isConflict", false)
        }
    }

    private fun splitCsvLine(line: String): List<String> {
        val fields = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false
        var i = 0

        while (i < line.length) {
            val ch = line[i]
            if (inQuotes) {
                if (ch == '"') {
                    if (i + 1 < line.length && line[i + 1] == '"') {
                        current.append('"')
                        i += 2
                        continue
                    } else {
                        inQuotes = false
                    }
                } else {
                    current.append(ch)
                }
            } else {
                if (ch == '"') {
                    inQuotes = true
                } else if (ch == ',') {
                    fields.add(current.toString().trim())
                    current.clear()
                } else {
                    current.append(ch)
                }
            }
            i++
        }
        fields.add(current.toString().trim())
        return fields
    }
}
