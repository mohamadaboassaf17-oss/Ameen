package com.ameen.app.services

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ClipboardService(private val context: Context) {

    companion object {
        private const val TAG = "ClipboardService"
        private const val PREFS_NAME = "ameen_vault_prefs"
        private const val KEY_CLEAR_SECONDS = "clipboard_clear_seconds"
        private const val DEFAULT_CLEAR_SECONDS = 30
    }

    private val clipboardManager: ClipboardManager =
        context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Main)

    private var clearJob: Job? = null

    val isActive: Boolean
        get() = clearJob?.isActive == true

    fun copyToClipboard(text: String, clearAfterSeconds: Int = prefs.getInt(KEY_CLEAR_SECONDS, DEFAULT_CLEAR_SECONDS)) {
        try {
            val clip = ClipData.newPlainText("ameen_copy", text)
            clipboardManager.setPrimaryClip(clip)
            Log.d(TAG, "تم نسخ النص إلى الحافظة — سيُمسح تلقائياً بعد $clearAfterSeconds ثانية")
            clearClipboardAfterDelay(clearAfterSeconds)
        } catch (e: Exception) {
            Log.e(TAG, "فشل النسخ إلى الحافظة: ${e.message}", e)
        }
    }

    fun clearClipboardAfterDelay(seconds: Int) {
        cancelAutoClear()
        clearJob = scope.launch {
            try {
                delay(seconds * 1000L)
                clipboardManager.setPrimaryClip(ClipData.newPlainText("", ""))
                Log.d(TAG, "تم مسح الحافظة تلقائياً بعد $seconds ثانية")
            } catch (e: Exception) {
                Log.e(TAG, "فشل مسح الحافظة تلقائياً: ${e.message}", e)
            }
        }
    }

    fun cancelAutoClear() {
        try {
            clearJob?.cancel()
            clearJob = null
            Log.d(TAG, "تم إلغاء المسح التلقائي للحافظة")
        } catch (e: Exception) {
            Log.e(TAG, "فشل إلغاء المسح التلقائي: ${e.message}", e)
        }
    }

    fun onBackground() {
        if (isActive) {
            try {
                clearJob?.cancel()
                clipboardManager.setPrimaryClip(ClipData.newPlainText("", ""))
                clearJob = null
                Log.d(TAG, "تم مسح الحافظة عند الانتقال إلى الخلفية")
            } catch (e: Exception) {
                Log.e(TAG, "فشل مسح الحافظة عند الخلفية: ${e.message}", e)
            }
        }
    }

    fun getClearAfterSeconds(): Int {
        return prefs.getInt(KEY_CLEAR_SECONDS, DEFAULT_CLEAR_SECONDS)
    }

    fun setClearAfterSeconds(seconds: Int) {
        prefs.edit().putInt(KEY_CLEAR_SECONDS, seconds).apply()
    }
}
