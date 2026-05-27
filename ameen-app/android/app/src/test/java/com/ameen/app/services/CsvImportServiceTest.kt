package com.ameen.app.services

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.json.JSONObject

class CsvImportServiceTest {

    private val service = createCsvImportServiceForReflection()

    @Test
    fun `detectFormat identifies Chrome format`() {
        val result = service.parseCsv("name,url,username,password\nMySite,https://example.com,user,pass")
        assertEquals(CsvImportService.CsvFormat.CHROME, result.detectedFormat)
    }

    @Test
    fun `detectFormat identifies Firefox format`() {
        val result = service.parseCsv(
            "url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged\n" +
            "https://example.com,user,pass,,,,,,"
        )
        assertEquals(CsvImportService.CsvFormat.FIREFOX, result.detectedFormat)
    }

    @Test
    fun `detectFormat identifies Edge format`() {
        val result = service.parseCsv(
            "name,url,username,password,note\nMySite,https://example.com,user,pass,"
        )
        assertEquals(CsvImportService.CsvFormat.EDGE, result.detectedFormat)
    }

    @Test
    fun `detectFormat identifies Safari format`() {
        val result = service.parseCsv(
            "Title,URL,Username,Password,OTPAuth\nMySite,https://example.com,user,pass,otpauth://"
        )
        assertEquals(CsvImportService.CsvFormat.SAFARI, result.detectedFormat)
    }

    @Test
    fun `detectFormat identifies Ameen format`() {
        val result = service.parseCsv(
            "id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpsecret\n" +
            "a1,password,MySite,user,pass,https://example.com,,,,,,,"
        )
        assertEquals(CsvImportService.CsvFormat.AMEEN, result.detectedFormat)
    }

    @Test
    fun `detectFormat returns UNKNOWN for unrecognized headers`() {
        val result = service.parseCsv("foo,bar,baz\n1,2,3")
        assertEquals(CsvImportService.CsvFormat.UNKNOWN, result.detectedFormat)
        assertEquals(0, result.items.length())
    }

    @Test
    fun `parseCsv returns empty result for empty input`() {
        val result = service.parseCsv("")
        assertEquals(0, result.items.length())
        assertEquals(CsvImportService.CsvFormat.UNKNOWN, result.detectedFormat)
    }

    @Test
    fun `parseCsv returns empty result for headers-only CSV`() {
        val result = service.parseCsv("name,url,username,password")
        assertEquals(0, result.items.length())
        assertEquals(CsvImportService.CsvFormat.UNKNOWN, result.detectedFormat)
    }

    @Test
    fun `parseCsv extracts Chrome fields correctly`() {
        val csv = "name,url,username,password\n" +
            "Google,https://google.com,myuser,mypass\n" +
            "GitHub,https://github.com,dev,token123"

        val result = service.parseCsv(csv)

        assertEquals(2, result.items.length())
        assertEquals(CsvImportService.CsvFormat.CHROME, result.detectedFormat)

        val item1 = result.items.getJSONObject(0)
        assertEquals("Google", item1.getString("title"))
        assertEquals("https://google.com", item1.getString("url"))
        assertEquals("myuser", item1.getString("username"))
        assertEquals("mypass", item1.getString("password"))
        assertEquals("password", item1.getString("type"))

        val item2 = result.items.getJSONObject(1)
        assertEquals("GitHub", item2.getString("title"))
        assertEquals("https://github.com", item2.getString("url"))
        assertEquals("dev", item2.getString("username"))
        assertEquals("token123", item2.getString("password"))
    }

    @Test
    fun `parseCsv maps Firefox entries with URL as title fallback`() {
        val csv = "url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timePasswordChanged\n" +
            "https://example.com,user1,pass1,,,,,,\n" +
            ",user2,pass2,,,,,,"

        val result = service.parseCsv(csv)

        assertEquals(2, result.items.length())

        val item1 = result.items.getJSONObject(0)
        assertEquals("https://example.com", item1.getString("title"))

        val item2 = result.items.getJSONObject(1)
        assertEquals("user2", item2.getString("title"))
    }

    @Test
    fun `parseCsv extracts Edge fields with notes`() {
        val csv = "name,url,username,password,note\n" +
            "Bank,https://bank.com,acct,secret,My banking notes"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("Bank", item.getString("title"))
        assertEquals("My banking notes", item.getString("notes"))
    }

    @Test
    fun `parseCsv extracts Safari fields with OTP`() {
        val csv = "Title,URL,Username,Password,OTPAuth\n" +
            "MySite,https://example.com,admin,admin123,otpauth://totp/test"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("MySite", item.getString("title"))
        assertEquals("otpauth://totp/test", item.getString("otpSecret"))
    }

    @Test
    fun `parseCsv extracts Ameen fields with all metadata`() {
        val csv = "id,type,title,username,password,url,content,cardholder,number,expiry,cvv,notes,otpsecret\n" +
            "abc123,password,MainSite,admin,pass,https://main.com,,,4111111111111111,12/28,123,important,otp_key"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("MainSite", item.getString("title"))
        assertEquals("admin", item.getString("username"))
        assertEquals("pass", item.getString("password"))
        assertEquals("https://main.com", item.getString("url"))
        assertEquals("important", item.getString("notes"))
        assertEquals("otp_key", item.getString("otpSecret"))
    }

    @Test
    fun `parseCsv handles quoted fields containing commas`() {
        val csv = "name,url,username,password\n" +
            "\"My Site, LLC\",https://example.com,user,pass"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("My Site, LLC", item.getString("title"))
    }

    @Test
    fun `parseCsv handles escaped double quotes in fields`() {
        val csv = "name,url,username,password\n" +
            "\"He said \"\"hello\"\"\",https://example.com,user,pass"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("He said \"hello\"", item.getString("title"))
    }

    @Test
    fun `parseCsv handles mixed quoted and unquoted fields`() {
        val csv = "name,url,username,password\n" +
            "\"Special, Name\",https://example.com,\"user,name\",pass"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("Special, Name", item.getString("title"))
        assertEquals("user,name", item.getString("username"))
    }

    @Test
    fun `parseCsv skips rows with all fields empty`() {
        val csv = "name,url,username,password\n,,,"

        val result = service.parseCsv(csv)

        assertEquals(0, result.items.length())
    }

    @Test
    fun `parseCsv assigns default title when title and url are empty`() {
        val csv = "name,url,username,password\n, ,user,pass"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("مستورد", item.getString("title"))
    }

    @Test
    fun `parseCsv generates id and timestamps for each item`() {
        val csv = "name,url,username,password\nTest,https://test.com,user,pass"

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertTrue(item.getString("id").length <= 12)
        assertTrue(item.getLong("updatedAt") > 0)
        assertFalse(item.getBoolean("isConflict"))
    }

    @Test
    fun `parseCsv handles large CSV with multiple entries`() {
        val entries = (1..100).joinToString("\n") { i ->
            "Site$i,https://site$i.com,user$i,pass$i"
        }
        val csv = "name,url,username,password\n$entries"

        val result = service.parseCsv(csv)

        assertEquals(100, result.items.length())
    }

    @Test
    fun `parseCsv trims whitespace from field values`() {
        val csv = "name,url,username,password\n  MySite  ,  https://example.com  ,  user  ,  pass  "

        val result = service.parseCsv(csv)

        assertEquals(1, result.items.length())
        val item = result.items.getJSONObject(0)
        assertEquals("MySite", item.getString("title"))
        assertEquals("https://example.com", item.getString("url"))
        assertEquals("user", item.getString("username"))
        assertEquals("pass", item.getString("password"))
    }

    @Test
    fun `detectFormat is case-insensitive`() {
        val csv = "NAME,URL,USERNAME,PASSWORD\nMySite,https://example.com,user,pass"

        val result = service.parseCsv(csv)

        assertEquals(CsvImportService.CsvFormat.CHROME, result.detectedFormat)
    }

    @Test
    fun `detectFormat normalizes spaces in headers`() {
        val csv = "Name , Url , User Name , Password\nMySite,https://example.com,user,pass"

        val result = service.parseCsv(csv)

        assertEquals(CsvImportService.CsvFormat.CHROME, result.detectedFormat)
    }

    private fun createCsvImportServiceForReflection(): CsvImportService {
        val constructor = CsvImportService::class.java.getDeclaredConstructor(android.content.Context::class.java)
        constructor.isAccessible = true
        return constructor.newInstance(null as android.content.Context?)
    }
}
