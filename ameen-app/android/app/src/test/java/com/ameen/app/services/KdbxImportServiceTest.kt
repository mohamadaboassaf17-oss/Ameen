package com.ameen.app.services

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class KdbxImportServiceTest {

    private val service = createKdbxImportServiceForReflection()

    @Test
    fun `invalid signature sig1 throws exception`() {
        val bytes = buildKdbxFileHeaderOnly(
            sig1 = 0xDEADBEEFL,
            sig2 = 0xB54BFB67L,
            ver = 0x00030001L
        )
        val ex = assertThrows(IllegalStateException::class.java) {
            service.readKdbx(bytes, "test")
        }
        assertTrue(ex.message!!.contains("ليس ملف KDBX صالح"))
    }

    @Test
    fun `invalid signature sig2 throws exception`() {
        val bytes = buildKdbxFileHeaderOnly(
            sig1 = 0x9AA2D903L,
            sig2 = 0xDEADBEEFL,
            ver = 0x00030001L
        )
        val ex = assertThrows(IllegalStateException::class.java) {
            service.readKdbx(bytes, "test")
        }
        assertTrue(ex.message!!.contains("ليس ملف KDBX صالح"))
    }

    @Test
    fun `unsupported version throws exception`() {
        val bytes = buildKdbxFileHeaderOnly(
            sig1 = 0x9AA2D903L,
            sig2 = 0xB54BFB67L,
            ver = 0x00040000L
        )
        val ex = assertThrows(IllegalStateException::class.java) {
            service.readKdbx(bytes, "test")
        }
        assertTrue(ex.message!!.contains("إصدار KDBX غير مدعوم"))
    }

    @Test
    fun `file too small throws exception`() {
        val bytes = ByteArray(5) { 0x00 }
        val ex = assertThrows(IllegalStateException::class.java) {
            service.readKdbx(bytes, "test")
        }
        assertTrue(ex.message!!.contains("صغير جداً"))
    }

    @Test
    fun `bytesToInt and intToBytes round-trip`() {
        val bytesToInt = KdbxImportService::class.java.getDeclaredMethod("bytesToInt", ByteArray::class.java, Int::class.java)
        bytesToInt.isAccessible = true
        val intToBytes = KdbxImportService::class.java.getDeclaredMethod("intToBytes", Int::class.java, ByteArray::class.java, Int::class.java)
        intToBytes.isAccessible = true

        val testValues = listOf(0, 1, -1, Int.MAX_VALUE, Int.MIN_VALUE, 0x12345678, 0xDEADBEEF.toInt(), 42)

        for (expected in testValues) {
            val out = ByteArray(4)
            intToBytes.invoke(service, expected, out, 0)
            val result = bytesToInt.invoke(service, out, 0) as Int
            assertEquals(expected, result, "فشل round-trip لـ $expected")
        }
    }

    @Test
    fun `intToBytes is little-endian`() {
        val intToBytes = KdbxImportService::class.java.getDeclaredMethod("intToBytes", Int::class.java, ByteArray::class.java, Int::class.java)
        intToBytes.isAccessible = true

        val out = ByteArray(4)
        intToBytes.invoke(service, 0x01020304, out, 0)

        assertEquals(0x04.toByte(), out[0])
        assertEquals(0x03.toByte(), out[1])
        assertEquals(0x02.toByte(), out[2])
        assertEquals(0x01.toByte(), out[3])
    }

    @Test
    fun `quarter-round with all zeros preserves zeros`() {
        val qr = KdbxImportService::class.java.getDeclaredMethod("qr", IntArray::class.java, Int::class.java, Int::class.java, Int::class.java, Int::class.java)
        qr.isAccessible = true

        val state = IntArray(16) { 0 }
        qr.invoke(service, state, 0, 4, 8, 12)

        for (i in state.indices) {
            assertEquals(0, state[i], "state[$i] should be 0")
        }
    }

    @Test
    fun `quarter-round produces deterministic output`() {
        val qr = KdbxImportService::class.java.getDeclaredMethod("qr", IntArray::class.java, Int::class.java, Int::class.java, Int::class.java, Int::class.java)
        qr.isAccessible = true

        val state1 = intArrayOf(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        val state2 = intArrayOf(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

        qr.invoke(service, state1, 0, 4, 8, 12)
        qr.invoke(service, state2, 0, 4, 8, 12)

        assertArrayEquals(state1, state2, "نفس المدخلات يجب أن تنتج نفس المخرجات")
    }

    @Test
    fun `parse XML extracts title username password URL and notes`() {
        val parseXml = KdbxImportService::class.java.getDeclaredMethod(
            "parseXml", String::class.java, ByteArray::class.java
        )
        parseXml.isAccessible = true

        val xml = """
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Meta>
    <DatabaseName>MyVault</DatabaseName>
  </Meta>
  <Root>
    <Group>
      <Entry>
        <String>
          <Key>Title</Key>
          <Value>ExampleSite</Value>
        </String>
        <String>
          <Key>UserName</Key>
          <Value>admin</Value>
        </String>
        <String>
          <Key>Password</Key>
          <Value Protected="False">secret123</Value>
        </String>
        <String>
          <Key>URL</Key>
          <Value>https://example.com</Value>
        </String>
        <String>
          <Key>Notes</Key>
          <Value>Some notes here</Value>
        </String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>
        """.trimIndent()

        val protectedKey = ByteArray(32)
        val result = parseXml.invoke(service, xml, protectedKey) as KdbxImportService.KdbxImportResult

        assertEquals("MyVault", result.databaseName)
        assertEquals(1, result.entryCount)
        assertEquals(1, result.items.length())

        val item = result.items.getJSONObject(0)
        assertEquals("ExampleSite", item.getString("title"))
        assertEquals("admin", item.getString("username"))
        assertEquals("secret123", item.getString("password"))
        assertEquals("https://example.com", item.getString("url"))
        assertEquals("Some notes here", item.getString("notes"))
        assertEquals("password", item.getString("type"))
    }

    @Test
    fun `parse XML returns empty items for empty file`() {
        val parseXml = KdbxImportService::class.java.getDeclaredMethod(
            "parseXml", String::class.java, ByteArray::class.java
        )
        parseXml.isAccessible = true

        val xml = """
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Meta>
    <DatabaseName>EmptyVault</DatabaseName>
  </Meta>
  <Root>
    <Group>
    </Group>
  </Root>
</KeePassFile>
        """.trimIndent()

        val result = parseXml.invoke(service, xml, ByteArray(32)) as KdbxImportService.KdbxImportResult

        assertEquals("EmptyVault", result.databaseName)
        assertEquals(0, result.entryCount)
        assertEquals(0, result.items.length())
    }

    @Test
    fun `parse XML handles multiple entries`() {
        val parseXml = KdbxImportService::class.java.getDeclaredMethod(
            "parseXml", String::class.java, ByteArray::class.java
        )
        parseXml.isAccessible = true

        val entries = (1..50).joinToString("\n") { i ->
            """
      <Entry>
        <String>
          <Key>Title</Key>
          <Value>Site$i</Value>
        </String>
        <String>
          <Key>UserName</Key>
          <Value>user$i</Value>
        </String>
        <String>
          <Key>Password</Key>
          <Value>pass$i</Value>
        </String>
      </Entry>
            """.trimIndent()
        }

        val xml = """
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Meta>
    <DatabaseName>BigVault</DatabaseName>
  </Meta>
  <Root>
    <Group>
$entries
    </Group>
  </Root>
</KeePassFile>
        """.trimIndent()

        val result = parseXml.invoke(service, xml, ByteArray(32)) as KdbxImportService.KdbxImportResult

        assertEquals(50, result.entryCount)
        assertEquals(50, result.items.length())
        assertEquals("Site25", result.items.getJSONObject(24).getString("title"))
    }

    @Test
    fun `parse XML decodes XML entities in values`() {
        val parseXml = KdbxImportService::class.java.getDeclaredMethod(
            "parseXml", String::class.java, ByteArray::class.java
        )
        parseXml.isAccessible = true

        val xml = """
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Root>
    <Group>
      <Entry>
        <String>
          <Key>Title</Key>
          <Value>AT&amp;T</Value>
        </String>
        <String>
          <Key>UserName</Key>
          <Value>user</Value>
        </String>
        <String>
          <Key>Password</Key>
          <Value>p"a's&lt;s&gt;</Value>
        </String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>
        """.trimIndent()

        val result = parseXml.invoke(service, xml, ByteArray(32)) as KdbxImportService.KdbxImportResult

        val item = result.items.getJSONObject(0)
        assertEquals("AT&T", item.getString("title"))
        assertEquals("p\"a's<s>", item.getString("password"))
    }

    @Test
    fun `readKdbx full round-trip with minimal valid KDBX 3_1 file`() {
        val password = "roundTripTest123"
        val masterSeed = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val transformSeed = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val encryptionIv = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val protectedStreamKey = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val streamStartBytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val transformRounds = 2L

        val xmlContent = """
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Meta>
    <DatabaseName>RoundTripVault</DatabaseName>
  </Meta>
  <Root>
    <Group>
      <Entry>
        <String>
          <Key>Title</Key>
          <Value>TestSite</Value>
        </String>
        <String>
          <Key>UserName</Key>
          <Value>testuser</Value>
        </String>
        <String>
          <Key>Password</Key>
          <Value Protected="False">testpass</Value>
        </String>
        <String>
          <Key>URL</Key>
          <Value>https://test.example.com</Value>
        </String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>
        """.trimIndent()

        val xmlBytes = xmlContent.toByteArray(Charsets.UTF_8)
        val payload = streamStartBytes + xmlBytes
        val paddedPayload = payload + ByteArray(16 - (payload.size % 16)) { 0 }
        val finalKey = deriveKdbxKey(password, transformSeed, transformRounds, masterSeed)

        val cbcCipher = Cipher.getInstance("AES/CBC/NoPadding")
        cbcCipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(finalKey, "AES"), IvParameterSpec(encryptionIv))
        val encryptedPayload = cbcCipher.doFinal(paddedPayload)

        val headerBytes = buildKdbxHeader(
            masterSeed, transformSeed, transformRounds, encryptionIv,
            protectedStreamKey, streamStartBytes, compression = 0
        )
        val fullFile = headerBytes + encryptedPayload

        val result = service.readKdbx(fullFile, password)

        assertEquals("RoundTripVault", result.databaseName)
        assertEquals(1, result.entryCount)
        assertEquals(1, result.items.length())

        val item = result.items.getJSONObject(0)
        assertEquals("TestSite", item.getString("title"))
        assertEquals("testuser", item.getString("username"))
        assertEquals("testpass", item.getString("password"))
        assertEquals("https://test.example.com", item.getString("url"))
    }

    @Test
    fun `readKdbx with wrong password throws exception`() {
        val password = "correctPassword"
        val masterSeed = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val transformSeed = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val encryptionIv = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val protectedStreamKey = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val streamStartBytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val transformRounds = 1L

        val xmlContent = """
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Root>
    <Group>
    </Group>
  </Root>
</KeePassFile>
        """.trimIndent()

        val xmlBytes = xmlContent.toByteArray(Charsets.UTF_8)
        val payload = streamStartBytes + xmlBytes
        val paddedPayload = payload + ByteArray(16 - (payload.size % 16)) { 0 }
        val finalKey = deriveKdbxKey(password, transformSeed, transformRounds, masterSeed)

        val cbcCipher = Cipher.getInstance("AES/CBC/NoPadding")
        cbcCipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(finalKey, "AES"), IvParameterSpec(encryptionIv))
        val encryptedPayload = cbcCipher.doFinal(paddedPayload)

        val headerBytes = buildKdbxHeader(
            masterSeed, transformSeed, transformRounds, encryptionIv,
            protectedStreamKey, streamStartBytes, compression = 0
        )
        val fullFile = headerBytes + encryptedPayload

        val ex = assertThrows(IllegalStateException::class.java) {
            service.readKdbx(fullFile, "wrongPassword")
        }
        assertTrue(ex.message!!.contains("كلمة المرور غير صحيحة"))
    }

    @Test
    fun `Salsa20 decrypt round-trips data`() {
        val salsa20Decrypt = KdbxImportService::class.java.getDeclaredMethod(
            "salsa20Decrypt", ByteArray::class.java, ByteArray::class.java, ByteArray::class.java
        )
        salsa20Decrypt.isAccessible = true

        val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val iv = ByteArray(8).also { SecureRandom().nextBytes(it) }

        val plaintext = "Salsa20 stream cipher test data for round-trip validation".toByteArray(Charsets.UTF_8)
        val ciphertext = salsa20Decrypt.invoke(service, key, iv, plaintext) as ByteArray
        val restored = salsa20Decrypt.invoke(service, key, iv, ciphertext) as ByteArray

        assertArrayEquals(plaintext, restored, "Salsa20 XOR should be its own inverse")
    }

    private fun deriveKdbxKey(
        password: String,
        transformSeed: ByteArray,
        transformRounds: Long,
        masterSeed: ByteArray
    ): ByteArray {
        val compositeKey = MessageDigest.getInstance("SHA-256")
            .digest(password.toByteArray(Charsets.UTF_8))

        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(compositeKey, "AES"))

        var transformed = transformSeed.clone()
        for (round in 0 until transformRounds) {
            transformed = cipher.doFinal(transformed)
        }

        val combined = transformed + masterSeed
        return MessageDigest.getInstance("SHA-256").digest(combined)
    }

    private fun buildKdbxHeader(
        masterSeed: ByteArray,
        transformSeed: ByteArray,
        transformRounds: Long,
        encryptionIv: ByteArray,
        protectedStreamKey: ByteArray,
        streamStartBytes: ByteArray,
        compression: Long
    ): ByteArray {
        val sig = byteArrayOf(
            0x03, 0xD9, 0xA2.toByte(), 0x9A.toByte(),
            0x67, 0xFB, 0x4B, 0xB5.toByte(),
            0x01, 0x00, 0x03, 0x00
        )
        val fields = mutableListOf<Byte>()

        fun addField(type: Int, data: ByteArray) {
            fields.add(type.toByte())
            fields.add((data.size and 0xFF).toByte())
            fields.add(((data.size shr 8) and 0xFF).toByte())
            fields.addAll(data.toList())
        }

        addField(2, byteArrayOf(
            0x31.toByte(), 0xC1.toByte(), 0xF2.toByte(), 0xE6.toByte(),
            0xBF.toByte(), 0x71.toByte(), 0x43.toByte(), 0x50.toByte(),
            0xBE.toByte(), 0x58.toByte(), 0x05.toByte(), 0x21.toByte(),
            0x6A.toByte(), 0xFC.toByte(), 0x5A.toByte(), 0xFF.toByte()
        ))
        addField(3, byteArrayOf(
            (compression and 0xFF).toByte(),
            ((compression shr 8) and 0xFF).toByte(),
            ((compression shr 16) and 0xFF).toByte(),
            ((compression shr 24) and 0xFF).toByte()
        ))
        addField(4, masterSeed)
        addField(5, transformSeed)
        addField(6, longToBytesLE(transformRounds))
        addField(7, encryptionIv)
        addField(8, protectedStreamKey)
        addField(9, streamStartBytes)

        fields.add(0)
        fields.add(0)
        fields.add(0)

        return sig + fields.toByteArray()
    }

    private fun buildKdbxFileHeaderOnly(sig1: Long, sig2: Long, ver: Long): ByteArray {
        val header = byteArrayOf(
            (sig1 and 0xFF).toByte(),
            ((sig1 shr 8) and 0xFF).toByte(),
            ((sig1 shr 16) and 0xFF).toByte(),
            ((sig1 shr 24) and 0xFF).toByte(),
            (sig2 and 0xFF).toByte(),
            ((sig2 shr 8) and 0xFF).toByte(),
            ((sig2 shr 16) and 0xFF).toByte(),
            ((sig2 shr 24) and 0xFF).toByte(),
            (ver and 0xFF).toByte(),
            ((ver shr 8) and 0xFF).toByte(),
            ((ver shr 16) and 0xFF).toByte(),
            ((ver shr 24) and 0xFF).toByte(),
            0, 0, 0
        )
        return header
    }

    private fun longToBytesLE(value: Long): ByteArray {
        return ByteArray(8) { i -> ((value shr (8 * i)) and 0xFF).toByte() }
    }

    private fun createKdbxImportServiceForReflection(): KdbxImportService {
        val constructor = KdbxImportService::class.java.getDeclaredConstructor(android.content.Context::class.java)
        constructor.isAccessible = true
        return constructor.newInstance(null as android.content.Context?)
    }
}
