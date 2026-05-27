package com.ameen.app

import android.app.Application
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver
import androidx.lifecycle.OnLifecycleEvent
import androidx.lifecycle.ProcessLifecycleOwner
import com.ameen.app.services.AutoLockService
import com.ameen.app.services.ClipboardService

class AmeenApplication : Application(), LifecycleObserver {

    val clipboardService: ClipboardService by lazy {
        ClipboardService(this)
    }

    val autoLockService: AutoLockService by lazy {
        AutoLockService(this) {
            // Lock callback managed externally via VaultScreen
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }

    @OnLifecycleEvent(Lifecycle.Event.ON_STOP)
    fun onAppBackground() {
        clipboardService.onBackground()
        autoLockService.onBackground()
    }

    companion object {
        lateinit var instance: AmeenApplication
            private set
    }
}
