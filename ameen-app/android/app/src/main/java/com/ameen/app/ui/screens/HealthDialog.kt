package com.ameen.app.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SYMBOL_CHARS_PATTERN = Regex("[!@#\$%^&*()_+\\-=\\[\\]{}|;:,.<>?]")

private data class PasswordHealth(
    val score: Int,
    val label: String,
    val color: Color,
    val item: VaultItem,
    val issues: List<String>
)

private fun evaluatePassword(item: VaultItem): PasswordHealth {
    val pass = item.password
    var score = 0
    val issues = mutableListOf<String>()

    if (pass.length < 8) {
        issues.add("قصيرة جداً")
    } else if (pass.length >= 8 && pass.length < 12) {
        score++
    } else if (pass.length >= 12 && pass.length < 16) {
        score += 2
    } else {
        score += 3
    }

    if (pass.any { it.isUpperCase() }) score++ else issues.add("لا تحتوي على أحرف كبيرة")
    if (pass.any { it.isLowerCase() }) score++ else issues.add("لا تحتوي على أحرف صغيرة")
    if (pass.any { it.isDigit() }) score++ else issues.add("لا تحتوي على أرقام")
    if (SYMBOL_CHARS_PATTERN.containsMatchIn(pass)) score++ else issues.add("لا تحتوي على رموز")

    val (label, color) = when {
        score <= 2 -> "ضعيف" to Color(0xFFD32F2F)
        score <= 4 -> "مقبول" to Color(0xFFFFA000)
        score <= 6 -> "قوي" to Color(0xFF388E3C)
        else -> "قوي جداً" to Color(0xFF1B5E20)
    }

    return PasswordHealth(score, label, color, item, issues)
}

private fun getHealthScore(items: List<VaultItem>): Float {
    val passwords = items.filter { it.type == "password" }
    if (passwords.isEmpty()) return 1f

    val evaluations = passwords.map { evaluatePassword(it) }
    val avg = evaluations.map { it.score }.average().toFloat()
    return (avg / 8f).coerceIn(0f, 1f)
}

private fun findDuplicates(items: List<VaultItem>): List<List<VaultItem>> {
    val passwords = items.filter { it.type == "password" && it.password.isNotBlank() }
    return passwords.groupBy { it.password }
        .filter { it.value.size > 1 }
        .values
        .toList()
}

@Composable
fun HealthDialog(
    items: List<VaultItem>,
    onDismiss: () -> Unit
) {
    val passwords = items.filter { it.type == "password" }
    val evaluations = passwords.map { evaluatePassword(it) }
    val weakPasswords = evaluations.filter { it.label == "ضعيف" || it.label == "مقبول" }
    val duplicates = findDuplicates(items)

    val overallScore = getHealthScore(items)
    val scoreColor = when {
        overallScore < 0.3f -> Color(0xFFD32F2F)
        overallScore < 0.5f -> Color(0xFFFFA000)
        overallScore < 0.7f -> Color(0xFF388E3C)
        else -> Color(0xFF1B5E20)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "صحة كلمات المرور",
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                // Overall score circle
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .clip(CircleShape)
                            .background(scoreColor.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${(overallScore * 100).toInt()}%",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = scoreColor
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = when {
                            passwords.isEmpty() -> "لا توجد كلمات مرور لتقييمها"
                            overallScore < 0.3f -> "الوضع حرج — يجب تحسين كلمات المرور"
                            overallScore < 0.5f -> "بحاجة إلى تحسين"
                            overallScore < 0.7f -> "حالة مقبولة"
                            else -> "حالة ممتازة"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = scoreColor,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Weak passwords section
                if (weakPasswords.isNotEmpty()) {
                    Text(
                        text = "🔴 كلمات مرور ضعيفة",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFD32F2F)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    weakPasswords.forEach { health ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFD32F2F).copy(alpha = 0.08f))
                                .padding(12.dp)
                                .padding(bottom = 8.dp)
                        ) {
                            Text(
                                text = "${health.label}: ${health.item.title}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            if (health.issues.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                health.issues.forEach { issue ->
                                    Text(
                                        text = "• $issue",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Duplicate passwords section
                if (duplicates.isNotEmpty()) {
                    Text(
                        text = "🟡 كلمات مرور مكررة",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFFFA000)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    duplicates.forEach { dupGroup ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFFFA000).copy(alpha = 0.08f))
                                .padding(12.dp)
                                .padding(bottom = 8.dp)
                        ) {
                            Text(
                                text = "كلمة المرور مكررة ${dupGroup.size} مرات:",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            dupGroup.forEach { item ->
                                Text(
                                    text = "• ${item.title} (${item.username})",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Recommendations
                Text(
                    text = "💡 توصيات",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                val recommendations = mutableListOf<String>()
                if (weakPasswords.isNotEmpty()) {
                    recommendations.add("قم بتغيير كلمات المرور الضعيفة أو المقبولة إلى كلمات مرور أطول وأكثر تعقيداً")
                }
                if (duplicates.isNotEmpty()) {
                    recommendations.add("لا تستخدم نفس كلمة المرور لأكثر من حساب — استخدم كلمات مرور فريدة لكل خدمة")
                }
                if (passwords.any { it.password.length < 12 }) {
                    recommendations.add("استخدم كلمات مرور لا يقل طولها عن 12 حرفاً")
                }
                if (recommendations.isEmpty()) {
                    recommendations.add("كلمات مرورك في حالة جيدة — استمر في الحفاظ عليها")
                }

                recommendations.forEach { rec ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Text(
                            text = "• ",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = rec,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (passwords.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "إجمالي كلمات المرور: ${passwords.size}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("حسناً")
            }
        }
    )
}
