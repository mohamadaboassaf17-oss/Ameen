package com.ameen.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import android.security.SecureRandom
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy

private val ARABIC_WORDLIST = listOf(
    "كتاب", "قلم", "شمس", "قمر", "نجم", "بحر", "جبل", "ورد", "شجرة", "طائر",
    "زهرة", "سحاب", "مطر", "رعد", "برق", "نهر", "غابة", "صحراء", "حجر", "ذهب",
    "بيت", "باب", "نافذة", "سرير", "مصباح", "ساعة", "مفتاح", "هاتف", "سيارة", "طائرة",
    "سفينة", "دراجة", "طريق", "جسر", "حديقة", "مدينة", "قرية", "سوق", "مسجد", "مدرسة",
    "طعام", "ماء", "خبز", "تفاح", "برتقال", "عنب", "تمر", "عسل", "لبن", "قهوة",
    "شاي", "سكر", "ملح", "زيت", "لحم", "سمك", "دجاج", "أرز", "قمح", "شعير",
    "كبير", "صغير", "طويل", "قصير", "جميل", "قوي", "ضعيف", "جديد", "قديم", "حار",
    "بارد", "نظيف", "غني", "فقير", "سعيد", "حزين", "ذكي", "شجاع", "لطيف", "كريم",
    "أحمر", "أزرق", "أخضر", "أصفر", "أبيض", "أسود", "بني", "رمادي", "ذهبي", "فضي",
    "أسد", "نمر", "فيل", "حصان", "جمل", "كلب", "قط", "عصفور", "حمامة", "فراشة"
)

private val UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
private val LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz"
private val DIGIT_CHARS = "0123456789"
private val SYMBOL_CHARS = "!@#\$%^&*()_+-=[]{}|;:,.<>?"
private val AMBIGUOUS_CHARS = "il1Lo0O"

private fun generatePassword(
    length: Int,
    useUpper: Boolean,
    useLower: Boolean,
    useDigits: Boolean,
    useSymbols: Boolean,
    avoidAmbiguous: Boolean
): String {
    if (!useUpper && !useLower && !useDigits && !useSymbols) return ""

    val secureRandom = SecureRandom()
    val charset = buildString {
        if (useUpper) append(if (avoidAmbiguous) UPPERCASE_CHARS.filter { it !in AMBIGUOUS_CHARS } else UPPERCASE_CHARS)
        if (useLower) append(if (avoidAmbiguous) LOWERCASE_CHARS.filter { it !in AMBIGUOUS_CHARS } else LOWERCASE_CHARS)
        if (useDigits) append(if (avoidAmbiguous) DIGIT_CHARS.filter { it !in AMBIGUOUS_CHARS } else DIGIT_CHARS)
        if (useSymbols) append(SYMBOL_CHARS)
    }
    if (charset.isEmpty()) return ""

    val password = StringBuilder(length)
    // Ensure at least one character from each selected set
    var remaining = length
    if (useUpper) {
        val pool = if (avoidAmbiguous) UPPERCASE_CHARS.filter { it !in AMBIGUOUS_CHARS } else UPPERCASE_CHARS
        password.append(pool[secureRandom.nextInt(pool.length)])
        remaining--
    }
    if (useLower) {
        val pool = if (avoidAmbiguous) LOWERCASE_CHARS.filter { it !in AMBIGUOUS_CHARS } else LOWERCASE_CHARS
        password.append(pool[secureRandom.nextInt(pool.length)])
        remaining--
    }
    if (useDigits) {
        val pool = if (avoidAmbiguous) DIGIT_CHARS.filter { it !in AMBIGUOUS_CHARS } else DIGIT_CHARS
        password.append(pool[secureRandom.nextInt(pool.length)])
        remaining--
    }
    if (useSymbols) {
        password.append(SYMBOL_CHARS[secureRandom.nextInt(SYMBOL_CHARS.length)])
        remaining--
    }
    for (i in 0 until remaining) {
        password.append(charset[secureRandom.nextInt(charset.length)])
    }
    // Shuffle
    return password.toList().shuffled(SecureRandom()).joinToString("")
}

private fun generatePassphrase(
    wordCount: Int,
    separator: String,
    capitalize: Boolean
): String {
    val secureRandom = SecureRandom()
    val words = (1..wordCount).map {
        var word = ARABIC_WORDLIST[secureRandom.nextInt(ARABIC_WORDLIST.size)]
        if (capitalize && word.isNotEmpty()) {
            word = word[0].uppercase() + word.drop(1)
        }
        word
    }
    return words.joinToString(separator)
}

private fun getPasswordStrength(password: String): Pair<Int, String> {
    if (password.isEmpty()) return Pair(0, "ضعيف")

    var score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (password.length >= 16) score++
    if (password.any { it.isUpperCase() }) score++
    if (password.any { it.isLowerCase() }) score++
    if (password.any { it.isDigit() }) score++
    if (password.any { it in SYMBOL_CHARS }) score++

    val label = when {
        score <= 2 -> "ضعيف"
        score <= 4 -> "مقبول"
        score <= 5 -> "قوي"
        else -> "قوي جداً"
    }
    return Pair(score, label)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GeneratorDialog(
    mode: String = "password",
    onDismiss: () -> Unit,
    onUseGenerated: (String) -> Unit
) {
    var activeTab by remember { mutableIntStateOf(if (mode == "passphrase") 1 else 0) }
    var generatedOutput by remember { mutableStateOf("") }

    // Password mode state
    var length by remember { mutableIntStateOf(16) }
    var useUpper by remember { mutableStateOf(true) }
    var useLower by remember { mutableStateOf(true) }
    var useDigits by remember { mutableStateOf(true) }
    var useSymbols by remember { mutableStateOf(true) }
    var avoidAmbiguous by remember { mutableStateOf(false) }

    // Passphrase mode state
    var wordCount by remember { mutableIntStateOf(5) }
    var separator by remember { mutableStateOf("-") }
    var capitalize by remember { mutableStateOf(false) }

    val clipboardManager = LocalClipboardManager.current

    val tabs = listOf("🔐 كلمة مرور", "📜 عبارة مرور")

    // Regenerate when any setting changes via effect
    fun regenerate() {
        generatedOutput = if (activeTab == 0) {
            generatePassword(length, useUpper, useLower, useDigits, useSymbols, avoidAmbiguous)
        } else {
            generatePassphrase(wordCount, separator, capitalize)
        }
    }

    if (generatedOutput.isEmpty()) {
        regenerate()
    }

    val (strengthScore, strengthLabel) = getPasswordStrength(generatedOutput)
    val strengthProgress = (strengthScore.toFloat() / 7f).coerceIn(0f, 1f)
    val strengthColor = when {
        strengthScore <= 2 -> Color(0xFFD32F2F)
        strengthScore <= 4 -> Color(0xFFFFA000)
        strengthScore <= 5 -> Color(0xFF388E3C)
        else -> Color(0xFF1B5E20)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "مولّد كلمات المرور",
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                ScrollableTabRow(
                    selectedTabIndex = activeTab,
                    modifier = Modifier.fillMaxWidth(),
                    edgePadding = 0.dp
                ) {
                    tabs.forEachIndexed { index, label ->
                        Tab(
                            selected = activeTab == index,
                            onClick = { activeTab = index },
                            text = {
                                Text(
                                    text = label,
                                    fontWeight = if (activeTab == index) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (activeTab == 0) {
                    // Password mode
                    Text(
                        text = "طول كلمة المرور: $length",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Slider(
                        value = length.toFloat(),
                        onValueChange = { length = it.toInt() },
                        valueRange = 8f..64f,
                        steps = 55,
                        colors = SliderDefaults.colors(
                            thumbColor = MaterialTheme.colorScheme.primary,
                            activeTrackColor = MaterialTheme.colorScheme.primary
                        )
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    ToggleRow("أحرف كبيرة (A-Z)", useUpper) { useUpper = it }
                    ToggleRow("أحرف صغيرة (a-z)", useLower) { useLower = it }
                    ToggleRow("أرقام (0-9)", useDigits) { useDigits = it }
                    ToggleRow("رموز (!@#\$)", useSymbols) { useSymbols = it }
                    ToggleRow("تجنب الأحرف المتشابهة", avoidAmbiguous) { avoidAmbiguous = it }
                } else {
                    // Passphrase mode
                    Text(
                        text = "عدد الكلمات: $wordCount",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Slider(
                        value = wordCount.toFloat(),
                        onValueChange = { wordCount = it.toInt() },
                        valueRange = 4f..10f,
                        steps = 5,
                        colors = SliderDefaults.colors(
                            thumbColor = MaterialTheme.colorScheme.primary,
                            activeTrackColor = MaterialTheme.colorScheme.primary
                        )
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "الفاصل بين الكلمات",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("-", "_", ".", " ").forEach { sep ->
                            val isSelected = separator == sep
                            val display = if (sep == " ") "مسافة" else sep
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .then(
                                        if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer)
                                        else Modifier
                                    )
                                    .clickable { separator = sep }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = display,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isSelected) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.onSurface,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }

                    ToggleRow("تكبير أول حرف", capitalize) { capitalize = it }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Generated output
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = generatedOutput.ifEmpty { "..." },
                        style = MaterialTheme.typography.bodyLarge,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Strength indicator
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    LinearProgressIndicator(
                        progress = strengthProgress,
                        modifier = Modifier
                            .weight(1f)
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = strengthColor,
                        trackColor = strengthColor.copy(alpha = 0.2f),
                        strokeCap = StrokeCap.Round
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = strengthLabel,
                        style = MaterialTheme.typography.labelMedium,
                        color = strengthColor,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { regenerate() },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("توليد جديد")
                    }
                    Button(
                        onClick = {
                            clipboardManager.setText(AnnotatedString(generatedOutput))
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondary
                        )
                    ) {
                        Icon(
                            Icons.Default.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("نسخ")
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onUseGenerated(generatedOutput) },
                enabled = generatedOutput.isNotEmpty()
            ) {
                Text("استخدام")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء")
            }
        }
    )
}

@Composable
private fun ToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}
