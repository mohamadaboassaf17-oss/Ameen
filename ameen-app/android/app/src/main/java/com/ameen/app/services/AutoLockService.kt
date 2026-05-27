package com.ameen.app.services

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class AutoLockService(
    private val context: Context,
    private val onLock: () -> Unit,
) {

    companion object {
        private const val TAG = "AutoLockService"
        private const val PREFS_NAME = "ameen_vault_prefs"
        private const val KEY_AUTO_LOCK_MINUTES = "auto_lock_minutes"
        private const val KEY_AUTO_LOCK_ON_BACKGROUND = "auto_lock_on_background"
        private const val DEFAULT_AUTO_LOCK_MINUTES = 5
        private const val DEFAULT_AUTO_LOCK_ON_BACKGROUND = true

        val LOCK_OPTIONS_MINUTES: List<Int> = listOf(1, 5, 15, 30, 0)
        val LOCK_OPTION_LABELS: List<String> = listOf(
            "دقيقة واحدة",
            "٥ دقائق",
            "١٥ دقيقة",
            "٣٠ دقيقة",
            "أبداً",
        )
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Main)

    private var lockJob: Job? = null

    val isActive: Boolean
        get() = lockJob?.isActive == true

    val autoLockMinutes: Int
        get() = prefs.getInt(KEY_AUTO_LOCK_MINUTES, DEFAULT_AUTO_LOCK_MINUTES)

    val autoLockOnBackground: Boolean
        get() = prefs.getBoolean(KEY_AUTO_LOCK_ON_BACKGROUND, DEFAULT_AUTO_LOCK_ON_BACKGROUND)

    fun startTimer() {
        val minutes = autoLockMinutes
        if (minutes <= 0) {
            Log.d(TAG, "قفل تلقائي: معطّل (مُعين على أبداً)")
            return
        }
        cancelTimer()
        lockJob = scope.launch {
            try {
                Log.d(TAG, "بدأ مؤقت القفل التلقائي — $minutes دقيقة")
                delay(minutes * 60 * 1000L)
                Log.d(TAG, "انتهى مؤقت القفل التلقائي — جارٍ قفل الخزنة")
                onLock()
            } catch (e: Exception) {
                Log.e(TAG, "فشل مؤقت القفل التلقائي: ${e.message}", e)
            }
        }
    }

    fun resetTimer() {
        if (lockJob?.isActive == true) {
            Log.d(TAG, "إعادة ضبط مؤقت القفل التلقائي")
            startTimer()
        }
    }

    fun cancelTimer() {
        try {
            lockJob?.cancel()
            lockJob = null
            Log.d(TAG, "تم إلغاء مؤقت القفل التلقائي")
        } catch (e: Exception) {
            Log.e(TAG, "فشل إلغاء مؤقت القفل التلقائي: ${e.message}", e)
        }
    }

    fun onBackground() {
        if (autoLockOnBackground) {
            Log.d(TAG, "قفل فوري عند الانتقال إلى الخلفية")
            cancelTimer()
            onLock()
        } else {
            Log.d(TAG, "الخلفية: القفل التلقائي عند الخلفية معطّل")
        }
    }

    fun setAutoLockMinutes(minutes: Int) {
        prefs.edit().putInt(KEY_AUTO_LOCK_MINUTES, minutes).apply()
        Log.d(TAG, "تم تعيين القفل التلقائي: $minutes دقيقة")
    }

    fun setAutoLockOnBackground(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_LOCK_ON_BACKGROUND, enabled).apply()
        Log.d(TAG, "تم تعيين القفل عند الخلفية: $enabled")
    }
}
