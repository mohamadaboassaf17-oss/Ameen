package com.ameen.app.services

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

class EmergencyKitServiceTest {

    private val service = createEmergencyKitServiceForReflection()

    @Test
    fun `generateBackupPassphrase returns 6 groups of 4 hex chars separated by dashes`() {
        val passphrase = service.generateBackupPassphrase()

        val groups = passphrase.split("-")
        assertEquals(6, groups.size, "يجب أن تحتوي على 6 مجموعات")

        for (group in groups) {
            assertEquals(4, group.length, "كل مجموعة يجب أن تكون 4 أحرف")
            assertTrue(group.all { it in "0123456789ABCDEF" }, "كل حرف يجب أن يكون digit hex")
        }
    }

    @Test
    fun `generateBackupPassphrase total length is 29 characters`() {
        val passphrase = service.generateBackupPassphrase()

        assertEquals(29, passphrase.length, "6×4 + 5 dash = 29")
        assertEquals(5, passphrase.count { it == '-' }, "يجب أن تحتوي على 5 شرطات")
    }

    @Test
    fun `generateBackupPassphrase produces different values each call`() {
        val passphrases = List(10) { service.generateBackupPassphrase() }

        val unique = passphrases.toSet()
        assertEquals(10, unique.size, "كل المكالمات يجب أن تنتج كلمة مرور فريدة")
    }

    @Test
    fun `generateBackupPassphrase never contains ambiguous characters`() {
        for (i in 1..50) {
            val passphrase = service.generateBackupPassphrase()
            val cleaned = passphrase.replace("-", "")
            for (ch in cleaned) {
                assertTrue(ch in "0123456789ABCDEF", "لا يسمح بالأحرف الصغيرة أو أحرف خاصة: $passphrase")
            }
        }
    }

    @Test
    fun `createKit returns EmergencyKitData with correct profile name`() {
        val kit = service.createKit("أحمد")

        assertEquals("أحمد", kit.profileName)
        assertTrue(kit.createdAt > 0)
    }

    @Test
    fun `createKit generates unique passphrase per kit`() {
        val kit1 = service.createKit("Profile1")
        val kit2 = service.createKit("Profile2")

        assertNotEquals(kit1.backupPassphrase, kit2.backupPassphrase)
    }

    @Test
    fun `createKit createdAt is close to current time`() {
        val before = System.currentTimeMillis()
        val kit = service.createKit("Test")
        val after = System.currentTimeMillis()

        assertTrue(kit.createdAt >= before)
        assertTrue(kit.createdAt <= after)
    }

    @Test
    fun `passphrase format is consistent across many generations`() {
        val regex = Regex("^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$")

        for (i in 1..100) {
            val passphrase = service.generateBackupPassphrase()
            assertTrue(regex.matches(passphrase), "تنسيق كلمة المرور غير صحيح: $passphrase")
        }
    }

    private fun createEmergencyKitServiceForReflection(): EmergencyKitService {
        val constructor = EmergencyKitService::class.java.getDeclaredConstructor(android.content.Context::class.java)
        constructor.isAccessible = true
        return constructor.newInstance(null as android.content.Context?)
    }
}
