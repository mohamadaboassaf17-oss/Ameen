package com.ameen.app.services

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import org.json.JSONObject
import java.security.MessageDigest

object QrCodeGenerator {
    fun generate(ip: String, port: Int, fingerprint: String, publicKeyB64: String): Bitmap {
        val json = JSONObject().apply {
            put("ip", ip)
            put("port", port)
            put("fp", fingerprint)
            put("pk", publicKeyB64)
        }

        val size = 512
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val data = json.toString()
        val qrSize = 29
        val moduleSize = (size * 0.7f / qrSize).toInt()
        val offsetX = ((size - qrSize * moduleSize) / 2).toInt()
        val offsetY = ((size - qrSize * moduleSize) / 2).toInt()

        val darkPaint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = false
        }

        val md = MessageDigest.getInstance("SHA-256")
        val hash = md.digest(data.toByteArray())
        val hashBits = hash.flatMap { b ->
            (0..7).map { (b.toInt() shr (7 - it)) and 1 }
        }

        var bitIdx = 0
        for (r in 0 until qrSize) {
            for (c in 0 until qrSize) {
                val inTopLeft = r < 7 && c < 7
                val inTopRight = r < 7 && c >= qrSize - 7
                val inBottomLeft = r >= qrSize - 7 && c < 7

                val isDark = if (inTopLeft || inTopRight || inBottomLeft) {
                    val localR: Int
                    val localC: Int
                    when {
                        inTopRight -> { localR = r; localC = c - (qrSize - 7) }
                        inBottomLeft -> { localR = r - (qrSize - 7); localC = c }
                        else -> { localR = r; localC = c }
                    }
                    localR == 0 || localR == 6 || localC == 0 || localC == 6 ||
                            (localR in 2..4 && localC in 2..4)
                } else {
                    if (bitIdx < hashBits.size) hashBits[bitIdx++] == 1 else false
                }
                if (isDark) {
                    canvas.drawRect(
                        (offsetX + c * moduleSize).toFloat(),
                        (offsetY + r * moduleSize).toFloat(),
                        (offsetX + (c + 1) * moduleSize).toFloat(),
                        (offsetY + (r + 1) * moduleSize).toFloat(),
                        darkPaint
                    )
                }
            }
        }

        val textPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 22f
            isAntiAlias = true
        }
        canvas.drawText(
            "بصمة: $fingerprint",
            (size * 0.1f),
            size * 0.91f,
            textPaint
        )

        return bitmap
    }
}
