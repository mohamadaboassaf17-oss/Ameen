# Keep Argon2 native bindings
-keep class com.lambdapioneer.argon2kt.** { *; }

# Keep Android security classes
-keep class androidx.security.** { *; }
-keep class androidx.biometric.** { *; }

# Keep Room entities and DAOs
-keep class com.ameen.app.** { *; }
-keepattributes *Annotation*

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Keep Kotlin metadata
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
