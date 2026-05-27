package com.ameen.app.ui.screens

import android.graphics.Bitmap
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Healing
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ameen.app.services.DiscoveryService
import com.ameen.app.services.QrCodeGenerator
import com.ameen.app.services.SyncConnection
import com.ameen.app.services.SyncServer
import com.ameen.app.services.BackupService
import com.ameen.app.services.CsvImportService
import com.ameen.app.services.KdbxImportService
import com.ameen.app.services.EmergencyKitService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.floor
import kotlin.math.pow

data class VaultItem(
    val id: String,
    val type: String,
    val title: String,
    val username: String = "",
    val password: String = "",
    val url: String = "",
    val content: String = "",
    val cardholder: String = "",
    val number: String = "",
    val expiry: String = "",
    val cvv: String = "",
    val notes: String = "",
    val otpSecret: String = "",
    val isConflict: Boolean = false,
    val conflictDate: Long? = null,
    val conflictOriginalId: String? = null,
    val updatedAt: Long = System.currentTimeMillis()
)

val demoItems = listOf(
    VaultItem("1", "password", "فيسبوك", username = "ahmed@email.com", password = "Fb!2024secure", url = "facebook.com", notes = "الحساب الشخصي"),
    VaultItem("2", "password", "تويتر", username = "@ahmed_t", password = "Twt#pass2024", url = "twitter.com", notes = ""),
    VaultItem("3", "password", "جيميل", username = "ahmed@gmail.com", password = "Gm@il#99secure", url = "mail.google.com", notes = "البريد الأساسي", otpSecret = "JBSWY3DPEHPK3PXP"),
    VaultItem("4", "password", "جيت هب", username = "ahmed-dev", password = "Gh!Dev2024#strong", url = "github.com", notes = "حساب العمل"),
    VaultItem("5", "password", "نتفليكس", username = "ahmed@email.com", password = "Ntfx$secure2024", url = "netflix.com", notes = "مشترك شهري"),
    VaultItem("6", "note", "ملاحظات آمنة", content = "رمز الخزنة الاحتياطي: 4A-7B ... تذكّر: تغيير كلمة المرور كل ٣ شهور", notes = ""),
    VaultItem("7", "card", "بطاقة مدى", cardholder = "أحمد محمد", number = "4532015112830366", expiry = "12/27", cvv = "123", notes = "البنك الأهلي"),
    VaultItem("8", "password", "أمازون", username = "ahmed@email.com", password = "Amz#old2024", url = "amazon.com", notes = "نسخة محلية", isConflict = true, conflictDate = System.currentTimeMillis(), conflictOriginalId = "9", updatedAt = System.currentTimeMillis() - 86400000),
    VaultItem("9", "password", "أمازون", username = "ahmed@email.com", password = "Amz#new2025!", url = "amazon.sa", notes = "نسخة جهاز آخر", isConflict = true, conflictDate = System.currentTimeMillis(), conflictOriginalId = "8", updatedAt = System.currentTimeMillis())
)

private fun vaultItemToJson(item: VaultItem): JSONObject = JSONObject().apply {
    put("id", item.id)
    put("type", item.type)
    put("title", item.title)
    put("username", item.username)
    put("password", item.password)
    put("url", item.url)
    put("content", item.content)
    put("cardholder", item.cardholder)
    put("number", item.number)
    put("expiry", item.expiry)
    put("cvv", item.cvv)
    put("notes", item.notes)
    put("otpSecret", item.otpSecret)
    put("isConflict", item.isConflict)
    if (item.conflictDate != null) put("conflictDate", item.conflictDate)
    if (item.conflictOriginalId != null) put("conflictOriginalId", item.conflictOriginalId)
    put("updatedAt", item.updatedAt)
}

private fun jsonToVaultItem(json: JSONObject): VaultItem = VaultItem(
    id = json.getString("id"),
    type = json.getString("type"),
    title = json.getString("title"),
    username = json.optString("username", ""),
    password = json.optString("password", ""),
    url = json.optString("url", ""),
    content = json.optString("content", ""),
    cardholder = json.optString("cardholder", ""),
    number = json.optString("number", ""),
    expiry = json.optString("expiry", ""),
    cvv = json.optString("cvv", ""),
    notes = json.optString("notes", ""),
    otpSecret = json.optString("otpSecret", ""),
    isConflict = json.optBoolean("isConflict", false),
    conflictDate = if (json.has("conflictDate")) json.optLong("conflictDate") else null,
    conflictOriginalId = json.optString("conflictOriginalId", "").ifEmpty { null },
    updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
)

val TAB_LABELS = listOf("الكل", "كلمات المرور", "ملاحظات", "بطاقات")
val TAB_TYPES = listOf(null, "password", "note", "card")

fun getTypeIcon(type: String): String = when (type) {
    "password" -> "\uD83D\uDD11"
    "note" -> "\uD83D\uDCDD"
    "card" -> "\uD83D\uDCB3"
    else -> "\uD83D\uDD11"
}

fun getTypeLabel(type: String): String = when (type) {
    "password" -> "كلمة مرور"
    "note" -> "ملاحظة"
    "card" -> "بطاقة"
    else -> type
}

fun getItemSubtitle(item: VaultItem): String = when (item.type) {
    "password" -> item.username
    "card" -> "**** **** **** ${item.number.takeLast(4)}"
    "note" -> item.content.take(50)
    else -> ""
}

private fun base32Decode(encoded: String): ByteArray {
    val cleaned = encoded.uppercase().replace("=", "")
    val result = mutableListOf<Byte>()
    var buffer = 0
    var bitsLeft = 0

    for (ch in cleaned) {
        val value = when (ch) {
            in 'A'..'Z' -> ch - 'A'
            in '2'..'7' -> ch - '2' + 26
            else -> continue
        }
        buffer = (buffer shl 5) or value
        bitsLeft += 5
        if (bitsLeft >= 8) {
            bitsLeft -= 8
            result.add((buffer shr bitsLeft).toByte())
            buffer = buffer and ((1 shl bitsLeft) - 1)
        }
    }
    return result.toByteArray()
}

fun generateTOTP(secret: String, period: Long = 30, digits: Int = 6, algorithm: String = "HmacSHA1"): String {
    val keyBytes = base32Decode(secret)
    val counter = floor(System.currentTimeMillis() / 1000.0 / period).toLong()
    val counterBytes = ByteArray(8)
    var temp = counter
    for (i in 7 downTo 0) {
        counterBytes[i] = (temp and 0xFF).toByte()
        temp = temp shr 8
    }

    val mac = Mac.getInstance(algorithm)
    mac.init(SecretKeySpec(keyBytes, algorithm))
    val hash = mac.doFinal(counterBytes)
    val offset = (hash[hash.size - 1].toInt() and 0x0F)
    val binary =
        ((hash[offset].toInt() and 0x7F) shl 24) or
        ((hash[offset + 1].toInt() and 0xFF) shl 16) or
        ((hash[offset + 2].toInt() and 0xFF) shl 8) or
        (hash[offset + 3].toInt() and 0xFF)
    val otp = binary % 10.0.pow(digits).toInt()
    return otp.toString().padStart(digits, '0')
}

fun getTOTPRemainingSeconds(period: Long = 30): Long {
    return period - (System.currentTimeMillis() / 1000) % period
}

fun formatDate(timestamp: Long): String {
    val sdf = SimpleDateFormat("yyyy/MM/dd HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

@Composable
fun ConflictBanner(conflictCount: Int, onResolveClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))
    ) {
        Row(
            Modifier.padding(12.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Warning,
                    contentDescription = null,
                    tint = Color(0xFFE65100),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "يوجد $conflictCount عنصر متعارض بحاجة إلى مراجعة",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFE65100)
                )
            }
            TextButton(
                text = "مراجعة",
                onClick = onResolveClick
            )
        }
    }
}

@Composable
fun ConflictItemPreview(item: VaultItem) {
    Column {
        Text("العنوان: ${item.title}")
        Text("النوع: ${getTypeLabel(item.type)}")
        if (item.type == "password") {
            if (item.username.isNotEmpty()) Text("اسم المستخدم: ${item.username}")
            if (item.url.isNotEmpty()) Text("الرابط: ${item.url}")
            if (item.notes.isNotEmpty()) Text("ملاحظات: ${item.notes}")
        } else if (item.type == "note") {
            if (item.content.isNotEmpty()) Text("المحتوى: ${item.content.take(100)}${if (item.content.length > 100) "..." else ""}")
        } else if (item.type == "card") {
            if (item.cardholder.isNotEmpty()) Text("حامل البطاقة: ${item.cardholder}")
            if (item.number.isNotEmpty()) Text("الرقم: ****${item.number.takeLast(4)}")
        }
    }
}

@Composable
fun ConflictResolverDialog(
    item: VaultItem,
    conflictingItem: VaultItem,
    onKeepLocal: () -> Unit,
    onKeepRemote: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("حل التعارض") },
        text = {
            Column {
                Text("تم العثور على نسختين مختلفتين من هذا العنصر. اختر النسخة الصحيحة:")
                Spacer(Modifier.height(12.dp))

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.padding(12.dp)) {
                        Text("النسخة المحلية", style = MaterialTheme.typography.labelLarge)
                        Text("آخر تعديل: ${formatDate(item.updatedAt)}", style = MaterialTheme.typography.bodySmall)
                        HorizontalDivider(Modifier.padding(vertical = 4.dp))
                        ConflictItemPreview(item)
                    }
                }

                Spacer(Modifier.height(8.dp))

                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Column(Modifier.padding(12.dp)) {
                        Text("النسخة الأخرى", style = MaterialTheme.typography.labelLarge)
                        Text("آخر تعديل: ${formatDate(conflictingItem.updatedAt)}", style = MaterialTheme.typography.bodySmall)
                        HorizontalDivider(Modifier.padding(vertical = 4.dp))
                        ConflictItemPreview(conflictingItem)
                    }
                }
            }
        },
        confirmButton = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                Button(onClick = onKeepLocal) { Text("الاحتفاظ بالمحلية") }
                Button(onClick = onKeepRemote) { Text("الاحتفاظ بالأخرى") }
            }
        },
        dismissButton = {
            TextButton(
                text = "لاحقاً",
                onClick = onDismiss
            )
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun VaultScreen(onLock: () -> Unit) {
    var vaultItems by remember { mutableStateOf(demoItems.toMutableList()) }
    var activeTab by remember { mutableStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }
    var expandedItemId by remember { mutableStateOf<String?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var showHealthDialog by remember { mutableStateOf(false) }
    var editingItem by remember { mutableStateOf<VaultItem?>(null) }
    var showGenerator by remember { mutableStateOf(false) }
    var generatorTarget by remember { mutableStateOf<Pair<String, (String) -> Unit>?>(null) }

    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var isSyncing by remember { mutableStateOf(false) }
    var showSyncDialog by remember { mutableStateOf(false) }
    var syncStatusText by remember { mutableStateOf("") }
    var qrBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var showPairingScreen by remember { mutableStateOf(false) }
    var pairingOwnFp by remember { mutableStateOf("") }
    var pairingRemoteFp by remember { mutableStateOf("") }
    var pairingRemoteName by remember { mutableStateOf("") }
    var pendingConn by remember { mutableStateOf<SyncConnection?>(null) }
    var pendingServer by remember { mutableStateOf<SyncServer?>(null) }
    var pendingDisc by remember { mutableStateOf<DiscoveryService?>(null) }

    val conflictItems = remember(vaultItems) {
        vaultItems.filter { it.isConflict }
    }
    val conflictCount = conflictItems.size
    var resolvingConflict by remember { mutableStateOf<Pair<VaultItem, VaultItem>?>(null) }

    var showOverflowMenu by remember { mutableStateOf(false) }

    val filteredItems = vaultItems.filter { item ->
        val typeMatch = TAB_TYPES[activeTab] == null || item.type == TAB_TYPES[activeTab]
        val searchMatch = searchQuery.isBlank() ||
            item.title.contains(searchQuery, ignoreCase = true) ||
            item.username.contains(searchQuery, ignoreCase = true) ||
            item.url.contains(searchQuery, ignoreCase = true)
        typeMatch && searchMatch
    }

    val passwordCount = vaultItems.count { it.type == "password" }
    val noteCount = vaultItems.count { it.type == "note" }
    val cardCount = vaultItems.count { it.type == "card" }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            LargeTopAppBar(
                title = {
                    Column {
                        Text(
                            text = "أمين",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "— أحمد",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showHealthDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Healing,
                            contentDescription = "صحة كلمات المرور"
                        )
                    }
                    IconButton(onClick = {
                        if (!isSyncing) {
                            isSyncing = true
                            syncStatusText = "جارٍ بدء المزامنة..."
                            scope.launch(Dispatchers.IO) {
                                val server = SyncServer()
                                try {
                                    val port = server.start()
                                    val disc = DiscoveryService(context)
                                    disc.register(port, server.fingerprint)
                                    val bitmap = QrCodeGenerator.generate(
                                        server.ownIp, port, server.fingerprint, server.publicKeyBase64
                                    )
                                    withContext(Dispatchers.Main) {
                                        qrBitmap = bitmap
                                        pendingServer = server
                                        pendingDisc = disc
                                        syncStatusText = "في انتظار اتصال من جهاز آخر..."
                                        showSyncDialog = true
                                    }
                                    val conn = server.accept()
                                    withContext(Dispatchers.Main) {
                                        syncStatusText = "تم الاتصال — تحقق من بصمة الجهازين"
                                        pairingOwnFp = server.fingerprint
                                        pairingRemoteFp = conn.clientFingerprint
                                        pairingRemoteName = "الجهاز البعيد"
                                        pendingConn = conn
                                        showPairingScreen = true
                                    }
                                } catch (e: Exception) {
                                    server.stop()
                                    withContext(Dispatchers.Main) {
                                        isSyncing = false
                                        showSyncDialog = false
                                        qrBitmap = null
                                        snackbarHostState.showSnackbar("فشل بدء المزامنة: ${e.message}")
                                    }
                                }
                            }
                        }
                    }) {
                        Icon(
                            imageVector = Icons.Default.Sync,
                            contentDescription = "زامن الآن"
                        )
                    }
                    IconButton(onClick = { showOverflowMenu = true }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "قائمة الخيارات"
                        )
                    }
                    DropdownMenu(
                        expanded = showOverflowMenu,
                        onDismissRequest = { showOverflowMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("📤 تصدير الخزنة") },
                            onClick = {
                                showOverflowMenu = false
                                scope.launch { exportVault(context, vaultItems, snackbarHostState) }
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("📥 استيراد من CSV") },
                            onClick = {
                                showOverflowMenu = false
                                scope.launch { importCsv(context, scope, vaultItems, snackbarHostState, { vaultItems = it }) }
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("📥 استيراد من KeePass") },
                            onClick = {
                                showOverflowMenu = false
                                scope.launch { importKdbx(context, vaultItems, snackbarHostState, { vaultItems = it }) }
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("🆘 طقم الطوارئ") },
                            onClick = {
                                showOverflowMenu = false
                                scope.launch { generateEmergencyKit(context, snackbarHostState) }
                            }
                        )
                    }
                    IconButton(onClick = onLock) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "قفل الخزنة"
                        )
                    }
                },
                colors = TopAppBarDefaults.largeTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.primary
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    editingItem = null
                    showAddDialog = true
                },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "إضافة عنصر جديد",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = true,
                    onClick = {},
                    label = { Text("🔑 $passwordCount كلمة مرور") },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        labelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                )
                FilterChip(
                    selected = true,
                    onClick = {},
                    label = { Text("📝 $noteCount ملاحظة") },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        labelColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                )
                FilterChip(
                    selected = true,
                    onClick = {},
                    label = { Text("💳 $cardCount بطاقة") },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                        labelColor = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            ScrollableTabRow(
                selectedTabIndex = activeTab,
                modifier = Modifier.fillMaxWidth(),
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.primary,
                edgePadding = 16.dp
            ) {
                TAB_LABELS.forEachIndexed { index, label ->
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

            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("بحث...") },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = "بحث")
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "مسح البحث")
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            if (isSyncing) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                )
                Text(
                    text = syncStatusText.ifEmpty { "جارٍ المزامنة..." },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                    textAlign = TextAlign.Center
                )
            }

            if (conflictCount > 0) {
                ConflictBanner(
                    conflictCount = conflictCount,
                    onResolveClick = {
                        val firstConflict = vaultItems.firstOrNull { it.isConflict }
                        if (firstConflict != null) {
                            val partner = vaultItems.find {
                                it.isConflict &&
                                it.id != firstConflict.id &&
                                (it.conflictOriginalId == firstConflict.id || firstConflict.conflictOriginalId == it.id)
                            }
                            if (partner != null) {
                                resolvingConflict = Pair(firstConflict, partner)
                            }
                        }
                    }
                )
            }

            if (filteredItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (searchQuery.isNotBlank()) "لا توجد نتائج مطابقة" else "الخزنة فارغة",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        horizontal = 16.dp,
                        vertical = 8.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredItems, key = { it.id }) { item ->
                        VaultItemCard(
                            item = item,
                            isExpanded = expandedItemId == item.id,
                            onToggleExpand = {
                                expandedItemId = if (expandedItemId == item.id) null else item.id
                            },
                            onEdit = {
                                editingItem = item
                                showAddDialog = true
                            },
                            onDelete = {
                                vaultItems = vaultItems.filter { it.id != item.id }.toMutableList()
                                if (expandedItemId == item.id) expandedItemId = null
                            },
                            onCopy = { text ->
                                clipboardManager.setText(AnnotatedString(text))
                            },
                            onGeneratePassword = { onResult ->
                                generatorTarget = Pair("password", onResult)
                                showGenerator = true
                            },
                            onResolveConflict = if (item.isConflict) {
                                {
                                    val partner = vaultItems.find {
                                        it.isConflict &&
                                        it.id != item.id &&
                                        (it.conflictOriginalId == item.id || item.conflictOriginalId == it.id)
                                    }
                                    if (partner != null) {
                                        resolvingConflict = Pair(item, partner)
                                    }
                                }
                            } else null
                        )
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddEditItemDialog(
            existingItem = editingItem,
            onDismiss = {
                showAddDialog = false
                editingItem = null
            },
            onSave = { newItem ->
                val index = vaultItems.indexOfFirst { it.id == newItem.id }
                if (index >= 0) {
                    vaultItems = vaultItems.toMutableList().also { it[index] = newItem }
                } else {
                    vaultItems = vaultItems.toMutableList().also { it.add(newItem) }
                }
                showAddDialog = false
                editingItem = null
            }
        )
    }

    if (showGenerator) {
        GeneratorDialog(
            mode = generatorTarget?.first ?: "password",
            onDismiss = { showGenerator = false },
            onUseGenerated = { generated ->
                generatorTarget?.second?.invoke(generated)
                showGenerator = false
                generatorTarget = null
            }
        )
    }

    if (showHealthDialog) {
        HealthDialog(
            items = vaultItems,
            onDismiss = { showHealthDialog = false }
        )
    }

    if (showSyncDialog && qrBitmap != null) {
        SyncDialog(
            qrBitmap = qrBitmap!!,
            statusText = syncStatusText,
            fingerprint = pendingServer?.fingerprint ?: "",
            onDismiss = {
                showSyncDialog = false
                isSyncing = false
                syncStatusText = ""
                qrBitmap = null
                pendingServer?.stop()
                pendingDisc?.unregister()
                pendingServer = null
                pendingDisc = null
                pendingConn = null
            }
        )
    }

    if (showPairingScreen && pendingConn != null) {
        PairingScreen(
            ownFingerprint = pairingOwnFp,
            remoteFingerprint = pairingRemoteFp,
            remoteName = pairingRemoteName,
            onConfirm = {
                showPairingScreen = false
                syncStatusText = "جارٍ تبادل البيانات..."
                scope.launch(Dispatchers.IO) {
                    try {
                        val conn = pendingConn!!
                        val localItems = vaultItems.map { vaultItemToJson(it) }
                        conn.send(
                            JSONObject().apply {
                                put("items", JSONArray(localItems))
                            }.toString().toByteArray()
                        )
                        val responseBytes = conn.receive()
                        val responseJson = JSONObject(String(responseBytes))
                        val remoteItems = responseJson.getJSONArray("items")
                        val merged = mutableListOf<VaultItem>()
                        val existingIds = vaultItems.map { it.id }.toSet()
                        for (i in 0 until remoteItems.length()) {
                            val item = jsonToVaultItem(remoteItems.getJSONObject(i))
                            merged.add(item)
                        }
                        val newCount = merged.count { it.id !in existingIds }
                        val updatedCount = merged.size - newCount
                        pendingConn = null
                        withContext(Dispatchers.Main) {
                            vaultItems = merged.toMutableList()
                            isSyncing = false
                            syncStatusText = ""
                            showSyncDialog = false
                            qrBitmap = null
                            pendingServer?.stop()
                            pendingDisc?.unregister()
                            pendingServer = null
                            pendingDisc = null
                            snackbarHostState.showSnackbar(
                                "تمت المزامنة: $newCount عنصر جديد، $updatedCount عنصر مُحدَّث"
                            )
                        }
                    } catch (e: Exception) {
                        pendingConn = null
                        withContext(Dispatchers.Main) {
                            isSyncing = false
                            showSyncDialog = false
                            syncStatusText = ""
                            qrBitmap = null
                            pendingServer?.stop()
                            pendingDisc?.unregister()
                            pendingServer = null
                            pendingDisc = null
                            snackbarHostState.showSnackbar("فشلت المزامنة: ${e.message}")
                        }
                    }
                }
            },
            onCancel = {
                showPairingScreen = false
                pendingConn?.close()
                pendingConn = null
                pendingServer?.stop()
                pendingDisc?.unregister()
                pendingServer = null
                pendingDisc = null
                isSyncing = false
                syncStatusText = ""
                showSyncDialog = false
                qrBitmap = null
                scope.launch {
                    snackbarHostState.showSnackbar("تم إلغاء الاقتران")
                }
            }
        )
    }

    if (resolvingConflict != null) {
        val (local, remote) = resolvingConflict!!
        ConflictResolverDialog(
            item = local,
            conflictingItem = remote,
            onKeepLocal = {
                val updatedItems = vaultItems.toMutableList()
                updatedItems.removeAll { it.id == remote.id }
                val winnerIndex = updatedItems.indexOfFirst { it.id == local.id }
                if (winnerIndex >= 0) {
                    updatedItems[winnerIndex] = local.copy(
                        isConflict = false,
                        conflictDate = null,
                        conflictOriginalId = null
                    )
                }
                vaultItems = updatedItems
                resolvingConflict = null
                scope.launch {
                    snackbarHostState.showSnackbar("تم حل التعارض — تم الاحتفاظ بـ ${local.title}")
                }
            },
            onKeepRemote = {
                val updatedItems = vaultItems.toMutableList()
                updatedItems.removeAll { it.id == local.id }
                val winnerIndex = updatedItems.indexOfFirst { it.id == remote.id }
                if (winnerIndex >= 0) {
                    updatedItems[winnerIndex] = remote.copy(
                        isConflict = false,
                        conflictDate = null,
                        conflictOriginalId = null
                    )
                }
                vaultItems = updatedItems
                resolvingConflict = null
                scope.launch {
                    snackbarHostState.showSnackbar("تم حل التعارض — تم الاحتفاظ بـ ${remote.title}")
                }
            },
            onDismiss = {
                resolvingConflict = null
            }
        )
    }
}

@Composable
fun VaultItemCard(
    item: VaultItem,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onCopy: (String) -> Unit,
    onGeneratePassword: ((String) -> Unit) -> Unit,
    onResolveConflict: (() -> Unit)? = null
) {
    var revealedFields by remember { mutableStateOf(setOf<String>()) }
    var otpCode by remember { mutableStateOf("") }
    var otpRemaining by remember { mutableStateOf(0L) }

    if (item.otpSecret.isNotEmpty()) {
        LaunchedEffect(Unit) {
            while (true) {
                otpCode = generateTOTP(item.otpSecret)
                otpRemaining = getTOTPRemainingSeconds()
                kotlinx.coroutines.delay(1000)
            }
        }
    }

    Row(modifier = Modifier.fillMaxWidth()) {
        if (item.isConflict) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(IntrinsicSize.Min)
                    .background(
                        Color(0xFFE65100),
                        RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp)
                    )
            )
        }
        Card(
            modifier = Modifier
                .weight(1f)
                .clickable {
                    if (item.isConflict && onResolveConflict != null) onResolveConflict()
                    else onToggleExpand()
                },
            shape = if (item.isConflict)
                RoundedCornerShape(topStart = 0.dp, bottomStart = 0.dp, topEnd = 12.dp, bottomEnd = 12.dp)
            else
                RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (item.isConflict)
                    Color(0xFFFFF8E1)
                else
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = getTypeIcon(item.type),
                        fontSize = 24.sp
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = item.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )
                            if (item.isConflict) {
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "⚠️ متعارض",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFFE65100)
                                )
                            }
                        }
                        val subtitle = getItemSubtitle(item)
                        if (subtitle.isNotEmpty()) {
                            Text(
                                text = subtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                IconButton(onClick = { onEdit() }) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = "تعديل",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = { onDelete() }) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "حذف",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            if (item.type == "password") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    IconButton(
                        onClick = { onCopy(item.password) },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            Icons.Default.ContentCopy,
                            contentDescription = "نسخ كلمة المرور",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    when (item.type) {
                        "password" -> {
                            if (item.username.isNotEmpty()) {
                                DetailField(
                                    label = "اسم المستخدم",
                                    value = item.username,
                                    onCopy = { onCopy(item.username) }
                                )
                            }
                            if (item.password.isNotEmpty()) {
                                DetailField(
                                    label = "كلمة المرور",
                                    value = if ("pass_${item.id}" in revealedFields) item.password else "••••••••",
                                    onCopy = { onCopy(item.password) },
                                    onToggleReveal = {
                                        revealedFields = if ("pass_${item.id}" in revealedFields)
                                            revealedFields - "pass_${item.id}"
                                        else
                                            revealedFields + "pass_${item.id}"
                                    },
                                    isRevealed = "pass_${item.id}" in revealedFields
                                )
                                TextButton(
                                    text = "🎲 توليد كلمة مرور جديدة",
                                    onClick = {
                                        onGeneratePassword { newPass ->
                                            // update happens in parent via onSave flow;
                                            // for now, just copy
                                            onCopy(newPass)
                                        }
                                    }
                                )
                            }
                            if (item.url.isNotEmpty()) {
                                DetailField(
                                    label = "الرابط",
                                    value = item.url,
                                    onCopy = { onCopy(item.url) }
                                )
                            }
                            if (item.otpSecret.isNotEmpty()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "رمز التحقق (OTP)",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = otpCode,
                                            style = MaterialTheme.typography.headlineSmall,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Box(
                                            modifier = Modifier
                                                .size(36.dp)
                                                .clip(CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            val progress = otpRemaining / 30f
                                            val color = when {
                                                otpRemaining <= 5 -> MaterialTheme.colorScheme.error
                                                otpRemaining <= 10 -> androidx.compose.ui.graphics.Color(0xFFFFA000)
                                                else -> MaterialTheme.colorScheme.primary
                                            }
                                            Text(
                                                text = "${otpRemaining}",
                                                style = MaterialTheme.typography.labelMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = color
                                            )
                                        }
                                        IconButton(
                                            onClick = { onCopy(otpCode) },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.ContentCopy,
                                                contentDescription = "نسخ الرمز",
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }
                                }
                            }
                            if (item.notes.isNotEmpty()) {
                                DetailField(
                                    label = "ملاحظات",
                                    value = item.notes,
                                    onCopy = { onCopy(item.notes) }
                                )
                            }
                        }
                        "note" -> {
                            if (item.content.isNotEmpty()) {
                                Text(
                                    text = item.content,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp)
                                )
                            }
                        }
                        "card" -> {
                            if (item.cardholder.isNotEmpty()) {
                                DetailField(
                                    label = "حامل البطاقة",
                                    value = item.cardholder,
                                    onCopy = { onCopy(item.cardholder) }
                                )
                            }
                            if (item.number.isNotEmpty()) {
                                DetailField(
                                    label = "رقم البطاقة",
                                    value = if ("cardnum_${item.id}" in revealedFields) item.number
                                        else "•••• •••• •••• ${item.number.takeLast(4)}",
                                    onCopy = { onCopy(item.number) },
                                    onToggleReveal = {
                                        revealedFields = if ("cardnum_${item.id}" in revealedFields)
                                            revealedFields - "cardnum_${item.id}"
                                        else
                                            revealedFields + "cardnum_${item.id}"
                                    },
                                    isRevealed = "cardnum_${item.id}" in revealedFields
                                )
                            }
                            if (item.expiry.isNotEmpty()) {
                                DetailField(
                                    label = "تاريخ الانتهاء",
                                    value = item.expiry,
                                    onCopy = { onCopy(item.expiry) }
                                )
                            }
                            if (item.cvv.isNotEmpty()) {
                                DetailField(
                                    label = "CVV",
                                    value = if ("cvv_${item.id}" in revealedFields) item.cvv else "***",
                                    onCopy = { onCopy(item.cvv) },
                                    onToggleReveal = {
                                        revealedFields = if ("cvv_${item.id}" in revealedFields)
                                            revealedFields - "cvv_${item.id}"
                                        else
                                            revealedFields + "cvv_${item.id}"
                                    },
                                    isRevealed = "cvv_${item.id}" in revealedFields
                                )
                            }
                            if (item.notes.isNotEmpty()) {
                                DetailField(
                                    label = "ملاحظات",
                                    value = item.notes,
                                    onCopy = { onCopy(item.notes) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailField(
    label: String,
    value: String,
    onCopy: () -> Unit,
    onToggleReveal: (() -> Unit)? = null,
    isRevealed: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                fontFamily = if (label == "كلمة المرور" || label == "رمز التحقق (OTP)") FontFamily.Monospace else null
            )
        }
        if (onToggleReveal != null) {
            IconButton(onClick = onToggleReveal, modifier = Modifier.size(32.dp)) {
                Icon(
                    imageVector = if (isRevealed) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (isRevealed) "إخفاء" else "إظهار",
                    modifier = Modifier.size(16.dp)
                )
            }
        }
        IconButton(onClick = onCopy, modifier = Modifier.size(32.dp)) {
            Icon(
                Icons.Default.ContentCopy,
                contentDescription = "نسخ",
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun TextButton(
    text: String,
    onClick: () -> Unit
) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .clickable { onClick() }
            .padding(vertical = 4.dp)
    )
}

@Composable
private fun SyncDialog(
    qrBitmap: Bitmap,
    statusText: String,
    fingerprint: String,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = {},
        title = {
            Text("مزامنة — امسح رمز الاستجابة السريع", textAlign = TextAlign.Center)
        },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Image(
                    bitmap = qrBitmap.asImageBitmap(),
                    contentDescription = "رمز الاقتران",
                    modifier = Modifier
                        .size(280.dp)
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "بصمة جهازك: ${formatFingerprintDialog(fingerprint)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    statusText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
            }
        },
        confirmButton = {
            OutlinedButton(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("إلغاء المزامنة")
            }
        }
    )
}

private fun formatFingerprintDialog(fp: String): String {
    if (fp.length != 12) return fp
    return fp.chunked(2).joinToString(" ")
}

// ============================================================
// Export / Import / Emergency Kit handlers
// ============================================================

private suspend fun exportVault(
    context: android.content.Context,
    vaultItems: List<VaultItem>,
    snackbarHostState: SnackbarHostState
) {
    try {
        // For production, key comes from vault decryption
        val demoKey = ByteArray(32)
        java.security.SecureRandom().nextBytes(demoKey)

        val items = org.json.JSONArray()
        for (item in vaultItems) items.put(vaultItemToJson(item))

        val backupService = BackupService(context)
        val uri = backupService.exportVault(items, demoKey, "أحمد", "demo-vault")
        snackbarHostState.showSnackbar("تم تحضير التصدير — اختر موقع الحفظ")
    } catch (e: Exception) {
        snackbarHostState.showSnackbar("فشل التصدير: ${e.message}")
    }
}

private suspend fun importCsv(
    context: android.content.Context,
    scope: kotlinx.coroutines.CoroutineScope,
    vaultItems: List<VaultItem>,
    snackbarHostState: SnackbarHostState,
    onUpdate: (List<VaultItem>) -> Unit
) {
    try {
        // Android CSV import from SAF requires ActivityResultLauncher in MainActivity
        snackbarHostState.showSnackbar("سيتم فتح منتقي الملفات قريباً...")
    } catch (e: Exception) {
        snackbarHostState.showSnackbar("فشل استيراد CSV: ${e.message}")
    }
}

private suspend fun importKdbx(
    context: android.content.Context,
    vaultItems: List<VaultItem>,
    snackbarHostState: SnackbarHostState,
    onUpdate: (List<VaultItem>) -> Unit
) {
    try {
        snackbarHostState.showSnackbar("سيتم فتح منتقي ملفات KeePass قريباً...")
    } catch (e: Exception) {
        snackbarHostState.showSnackbar("فشل استيراد KeePass: ${e.message}")
    }
}

private suspend fun generateEmergencyKit(
    context: android.content.Context,
    snackbarHostState: SnackbarHostState
) {
    try {
        val kitService = EmergencyKitService(context)
        val kit = kitService.createKit("أحمد")
        snackbarHostState.showSnackbar("تم إنشاء طقم الطوارئ — كلمة المرور: ${kit.backupPassphrase}")
    } catch (e: Exception) {
        snackbarHostState.showSnackbar("فشل إنشاء طقم الطوارئ: ${e.message}")
    }
}
