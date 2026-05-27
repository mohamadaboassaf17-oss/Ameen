package com.ameen.app.services

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.SecureRandom

class EmergencyKitService(private val context: Context) {

    companion object {
        private const val TAG = "EmergencyKitService"
    }

    data class EmergencyKitData(
        val profileName: String,
        val backupPassphrase: String,
        val createdAt: Long = System.currentTimeMillis()
    )

    /**
     * Generate a secure backup passphrase (6 groups of 4 hex chars).
     */
    fun generateBackupPassphrase(): String {
        val bytes = ByteArray(12)
        SecureRandom().nextBytes(bytes)
        return bytes.toList()
            .chunked(2)
            .joinToString("-") { pair ->
                "%02X%02X".format(pair[0], pair[1])
            }
    }

    /**
     * Create an Emergency Kit data object.
     */
    fun createKit(profileName: String): EmergencyKitData {
        val kit = EmergencyKitData(
            profileName = profileName,
            backupPassphrase = generateBackupPassphrase()
        )
        Log.d(TAG, "تم إنشاء طقم طوارئ لـ: $profileName")
        return kit
    }

    /**
     * Generate a PDF document for the Emergency Kit and write to SAF URI.
     */
    suspend fun generateAndSavePdf(kit: EmergencyKitData, uri: Uri): Boolean = withContext(Dispatchers.IO) {
        try {
            val document = PdfDocument()
            val pageWidth = 595  // A4 width in points
            val pageHeight = 842 // A4 height in points

            val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
            val page = document.startPage(pageInfo)
            val canvas: Canvas = page.canvas

            var y = 50f
            val margin = 40f
            val contentWidth = pageWidth - 2 * margin

            // ── Title ──
            val titlePaint = Paint().apply {
                color = 0xFF1565C0.toInt()
                textSize = 26f
                typeface = Typeface.DEFAULT_BOLD
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText("أمين — طقم الطوارئ", pageWidth / 2f, y, titlePaint)

            // ── Subtitle ──
            y += 30f
            val subtitlePaint = Paint().apply {
                color = 0xFF666666.toInt()
                textSize = 12f
                textAlign = Paint.Align.CENTER
            }
            val dateStr = java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", java.util.Locale("ar")).format(java.util.Date(kit.createdAt))
            canvas.drawText("تم إنشاؤه بتاريخ: $dateStr", pageWidth / 2f, y, subtitlePaint)

            // ── Warning box ──
            y += 40f
            val warningPaint = Paint().apply {
                color = 0xFFE65100.toInt()
                textSize = 11f
            }
            val warningText = "⚠️ تحذير أمني: احتفظ بهذا المستند في مكان آمن جداً. أي شخص يطلع على كلمة مرور الطوارئ يمكنه الوصول إلى جميع بيانات خزنتك."

            val textPaint = Paint().apply {
                color = 0xFF333333.toInt()
                textSize = 13f
            }

            // Draw warning box background
            val warnBgPaint = Paint().apply { color = 0x4DFFF3E0.toInt() }
            val warnBoxHeight = 50f
            canvas.drawRect(margin, y - 15f, margin + contentWidth, y + warnBoxHeight, warnBgPaint)
            drawArabicText(canvas, warningText, margin + 8f, y + 5f, contentWidth - 16f, warningPaint)
            y += warnBoxHeight + 20f

            // ── Profile info ──
            val labelPaint = Paint().apply {
                color = 0xFF555555.toInt()
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
            }
            canvas.drawText("الملف الشخصي:", margin, y, labelPaint)
            canvas.drawText(kit.profileName, margin + 110f, y, textPaint)

            y += 25f
            canvas.drawText("التطبيق:", margin, y, labelPaint)
            canvas.drawText("أمين (Ameen) — مدير كلمات المرور", margin + 110f, y, textPaint)
            y += 35f

            // ── Passphrase section ──
            val sectionPaint = Paint().apply {
                color = 0xFF1565C0.toInt()
                textSize = 18f
                typeface = Typeface.DEFAULT_BOLD
            }
            canvas.drawText("🔑 كلمة مرور الطوارئ", margin, y, sectionPaint)
            y += 28f

            val passPaint = Paint().apply {
                color = 0xFF0D47A1.toInt()
                textSize = 22f
                typeface = Typeface.MONOSPACE
            }
            val passBgPaint = Paint().apply { color = 0x33E0E0E0.toInt() }
            val passBoxHeight = 50f
            canvas.drawRect(margin, y - 10f, margin + contentWidth, y + passBoxHeight, passBgPaint)
            canvas.drawText(kit.backupPassphrase, margin + 16f, y + 22f, passPaint)
            y += passBoxHeight + 24f

            // ── Instructions ──
            canvas.drawText("📋 تعليمات الاستخدام", margin, y, sectionPaint)
            y += 28f

            val instructions = listOf(
                "1. اطبع هذا المستند واحتفظ بالنسخة المطبوعة في مكان آمن.",
                "2. إذا نسيت كلمة المرور الرئيسية، افتح تطبيق أمين واختر \"استعادة بخزنة الطوارئ\".",
                "3. أدخل كلمة مرور الطوارئ الموضحة أعلاه.",
                "4. سيقوم التطبيق بفك تشفير خزنتك وسيُطلب منك تعيين كلمة مرور جديدة.",
                "5. بعد الاستعادة، اصنع طقم طوارئ جديد واحذف القديم فوراً."
            )
            val instPaint = Paint().apply {
                color = 0xFF333333.toInt()
                textSize = 12f
            }
            for (line in instructions) {
                drawArabicText(canvas, line, margin, y, contentWidth, instPaint)
                y += 22f
            }

            // ── Footer ──
            y += 20f
            val footerPaint = Paint().apply {
                color = 0xFF999999.toInt()
                textSize = 10f
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText("أمين (Ameen) — مدير كلمات مرور مجاني ومفتوح المصدر | Zero-Knowledge Architecture", pageWidth / 2f, y, footerPaint)

            document.finishPage(page)

            // Write to SAF
            context.contentResolver.openOutputStream(uri)?.use { os ->
                document.writeTo(os)
            }
            document.close()

            Log.d(TAG, "تم حفظ طقم الطوارئ كملف PDF")
            true
        } catch (e: Exception) {
            Log.e(TAG, "فشل إنشاء PDF طقم الطوارئ: ${e.message}", e)
            throw e
        }
    }

    /**
     * Simple word-wrapping text drawing for Arabic (RTL-friendly).
     * Draws left-aligned with manual wrapping.
     */
    private fun drawArabicText(
        canvas: Canvas,
        text: String,
        x: Float,
        y: Float,
        maxWidth: Float,
        paint: Paint
    ) {
        var currentY = y
        val words = text.split(" ")
        val line = StringBuilder()
        var lineWidth = 0f

        for (word in words) {
            val wordWidth = paint.measureText("$word ")
            if (lineWidth + wordWidth > maxWidth && line.isNotEmpty()) {
                canvas.drawText(line.toString().trim(), x, currentY, paint)
                line.clear()
                line.append(word).append(" ")
                lineWidth = paint.measureText("$word ")
                currentY += paint.textSize + 6f
            } else {
                line.append(word).append(" ")
                lineWidth += wordWidth
            }
        }
        if (line.isNotEmpty()) {
            canvas.drawText(line.toString().trim(), x, currentY, paint)
        }
    }
}
