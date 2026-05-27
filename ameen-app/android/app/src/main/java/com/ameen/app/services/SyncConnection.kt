package com.ameen.app.services

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class SyncConnection(
    private val socket: java.net.Socket,
    private val aesKey: SecretKeySpec
) {
    var clientFingerprint: String = ""

    private val random = SecureRandom()

    fun send(data: ByteArray) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val iv = ByteArray(12)
        random.nextBytes(iv)
        cipher.init(Cipher.ENCRYPT_MODE, aesKey, GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(data)

        val output = socket.getOutputStream()
        output.write(iv)
        output.write((encrypted.size shr 24) and 0xFF)
        output.write((encrypted.size shr 16) and 0xFF)
        output.write((encrypted.size shr 8) and 0xFF)
        output.write(encrypted.size and 0xFF)
        output.write(encrypted)
        output.flush()
    }

    fun receive(): ByteArray {
        val input = socket.getInputStream()
        val iv = ByteArray(12)
        readFully(input, iv)

        val sizeBuf = ByteArray(4)
        readFully(input, sizeBuf)
        val size = ((sizeBuf[0].toInt() and 0xFF) shl 24) or
                ((sizeBuf[1].toInt() and 0xFF) shl 16) or
                ((sizeBuf[2].toInt() and 0xFF) shl 8) or
                (sizeBuf[3].toInt() and 0xFF)

        val encrypted = ByteArray(size)
        readFully(input, encrypted)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, aesKey, GCMParameterSpec(128, iv))
        return cipher.doFinal(encrypted)
    }

    private fun readFully(input: java.io.InputStream, buffer: ByteArray) {
        var read = 0
        while (read < buffer.size) {
            val n = input.read(buffer, read, buffer.size - read)
            if (n == -1) throw java.io.EOFException("Connection closed")
            read += n
        }
    }

    fun close() {
        try { socket.close() } catch (_: Exception) {}
    }
}
