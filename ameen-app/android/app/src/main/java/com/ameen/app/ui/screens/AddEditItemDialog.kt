package com.ameen.app.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.security.SecureRandom
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditItemDialog(
    existingItem: VaultItem?,
    onDismiss: () -> Unit,
    onSave: (VaultItem) -> Unit
) {
    val isEditing = existingItem != null

    var itemType by remember { mutableStateOf(existingItem?.type ?: "password") }
    var title by remember { mutableStateOf(existingItem?.title ?: "") }
    var username by remember { mutableStateOf(existingItem?.username ?: "") }
    var password by remember { mutableStateOf(existingItem?.password ?: "") }
    var url by remember { mutableStateOf(existingItem?.url ?: "") }
    var content by remember { mutableStateOf(existingItem?.content ?: "") }
    var cardholder by remember { mutableStateOf(existingItem?.cardholder ?: "") }
    var number by remember { mutableStateOf(existingItem?.number ?: "") }
    var expiry by remember { mutableStateOf(existingItem?.expiry ?: "") }
    var cvv by remember { mutableStateOf(existingItem?.cvv ?: "") }
    var notes by remember { mutableStateOf(existingItem?.notes ?: "") }
    var otpSecret by remember { mutableStateOf(existingItem?.otpSecret ?: "") }

    var dropdownExpanded by remember { mutableStateOf(false) }
    var showGenerator by remember { mutableStateOf(false) }

    val typeOptions = listOf(
        "password" to "🔑 كلمة مرور",
        "note" to "📝 ملاحظة",
        "card" to "💳 بطاقة"
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (isEditing) "تعديل عنصر" else "إضافة عنصر جديد",
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded,
                    onExpandedChange = { dropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = typeOptions.first { it.first == itemType }.second,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("النوع") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
                    )
                    ExposedDropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        typeOptions.forEach { (type, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    itemType = type
                                    dropdownExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("العنوان") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))

                when (itemType) {
                    "password" -> {
                        OutlinedTextField(
                            value = username,
                            onValueChange = { username = it },
                            label = { Text("اسم المستخدم") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("كلمة المرور") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                Row {
                                    TextButton(
                                        onClick = { showGenerator = true },
                                        modifier = Modifier.padding(horizontal = 4.dp)
                                    ) {
                                        Text("🎲")
                                    }
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = otpSecret,
                            onValueChange = { otpSecret = it },
                            label = { Text("رمز OTP السري") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = url,
                            onValueChange = { url = it },
                            label = { Text("الرابط") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    "note" -> {
                        OutlinedTextField(
                            value = content,
                            onValueChange = { content = it },
                            label = { Text("المحتوى") },
                            minLines = 4,
                            maxLines = 10,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                    "card" -> {
                        OutlinedTextField(
                            value = cardholder,
                            onValueChange = { cardholder = it },
                            label = { Text("حامل البطاقة") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = number,
                            onValueChange = { number = it },
                            label = { Text("رقم البطاقة") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(modifier = Modifier.fillMaxWidth()) {
                            OutlinedTextField(
                                value = expiry,
                                onValueChange = { expiry = it },
                                label = { Text("انتهاء") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            OutlinedTextField(
                                value = cvv,
                                onValueChange = { cvv = it },
                                label = { Text("CVV") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("ملاحظات") },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val newId = existingItem?.id ?: UUID.randomUUID().toString()
                    onSave(
                        VaultItem(
                            id = newId,
                            type = itemType,
                            title = title,
                            username = username,
                            password = password,
                            url = url,
                            content = content,
                            cardholder = cardholder,
                            number = number,
                            expiry = expiry,
                            cvv = cvv,
                            notes = notes,
                            otpSecret = otpSecret
                        )
                    )
                },
                enabled = title.isNotBlank()
            ) {
                Text(if (isEditing) "حفظ" else "إضافة")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء")
            }
        }
    )

    if (showGenerator) {
        GeneratorDialog(
            mode = "password",
            onDismiss = { showGenerator = false },
            onUseGenerated = { generated ->
                password = generated
                showGenerator = false
            }
        )
    }
}
