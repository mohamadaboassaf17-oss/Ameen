package com.ameen.app.services

import android.util.Base64
import java.net.ServerSocket
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.spec.X509EncodedKeySpec
import javax.crypto.KeyAgreement
import javax.crypto.spec.SecretKeySpec

class SyncServer {
    var fingerprint: String = ""
        private set
    var publicKeyBase64: String = ""
        private set
    var ownIp: String = ""
        private set
    var ownPort: Int = 0
        private set

    private var serverSocket: ServerSocket? = null
    private var keyPair: KeyPair? = null
    private var running = false

    fun start(): Int {
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(256)
        keyPair = kpg.generateKeyPair()

        val pubBytes = keyPair!!.public.encoded
        publicKeyBase64 = Base64.encodeToString(pubBytes, Base64.NO_WRAP)

        val md = MessageDigest.getInstance("SHA-256")
        val hash = md.digest(pubBytes)
        fingerprint = hash.take(6).joinToString("") { "%02X".format(it) }

        ownIp = getLocalIpAddress()
        serverSocket = ServerSocket(0)
        ownPort = serverSocket!!.localPort
        running = true
        return ownPort
    }

    fun accept(): SyncConnection {
        val clientSocket = serverSocket!!.accept()
        return performHandshake(clientSocket, keyPair!!)
    }

    fun isRunning(): Boolean = running

    fun stop() {
        running = false
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
    }

    fun connect(host: String, port: Int, serverPublicKeyB64: String, expectedFingerprint: String): SyncConnection {
        val serverPubBytes = Base64.decode(serverPublicKeyB64, Base64.NO_WRAP)
        val md = MessageDigest.getInstance("SHA-256")
        val hash = md.digest(serverPubBytes)
        val computedFp = hash.take(6).joinToString("") { "%02X".format(it) }
        if (computedFp != expectedFingerprint.uppercase()) {
            throw SecurityException("بصمة المفتاح غير متطابقة — هجوم وسيط محتمل!")
        }

        if (keyPair == null) {
            val kpg = KeyPairGenerator.getInstance("EC")
            kpg.initialize(256)
            keyPair = kpg.generateKeyPair()
        }

        val plainPubBytes = keyPair!!.public.encoded
        publicKeyBase64 = Base64.encodeToString(plainPubBytes, Base64.NO_WRAP)

        val fpMd = MessageDigest.getInstance("SHA-256")
        val fph = fpMd.digest(plainPubBytes)
        fingerprint = fph.take(6).joinToString("") { "%02X".format(it) }

        val clientSocket = java.net.Socket(host, port)
        return performHandshake(clientSocket, keyPair!!)
    }

    private fun performHandshake(socket: java.net.Socket, myKeyPair: KeyPair): SyncConnection {
        val output = socket.getOutputStream().bufferedWriter()
        val input = socket.getInputStream().bufferedReader()

        val myPubB64 = Base64.encodeToString(myKeyPair.public.encoded, Base64.NO_WRAP)
        output.write(myPubB64)
        output.newLine()
        output.flush()

        val theirPubB64 = input.readLine()
        val theirPubBytes = Base64.decode(theirPubB64, Base64.NO_WRAP)
        val theirPubKey = KeyFactory.getInstance("EC").generatePublic(
            X509EncodedKeySpec(theirPubBytes)
        )

        val remoteFpMd = MessageDigest.getInstance("SHA-256")
        val remoteFpHash = remoteFpMd.digest(theirPubBytes)
        val remoteFp = remoteFpHash.take(6).joinToString("") { "%02X".format(it) }

        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(myKeyPair.private)
        ka.doPhase(theirPubKey, true)
        val sharedSecret = ka.generateSecret()

        val aesKeyBytes = MessageDigest.getInstance("SHA-256").digest(sharedSecret)
        val aesKey = SecretKeySpec(aesKeyBytes, "AES")

        val conn = SyncConnection(socket, aesKey)
        conn.clientFingerprint = remoteFp
        return conn
    }

    private fun getLocalIpAddress(): String {
        return java.net.NetworkInterface.getNetworkInterfaces()?.asSequence()
            ?.flatMap { it.inetAddresses.asSequence() }
            ?.firstOrNull { !it.isLoopbackAddress && it is java.net.Inet4Address }
            ?.hostAddress ?: "127.0.0.1"
    }
}
