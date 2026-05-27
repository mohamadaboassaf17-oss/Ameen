# Ameen (أمين)

*The trustworthy password manager. Zero-knowledge, local-first, open-source.*

*مدير كلمات مرور محلي بالكامل، مفتوح المصدر، قائم على مبدأ "عدم الإفصاح عن البيانات".*

<p align="center">
  <img src="https://img.shields.io/github/license/mohamadaboassaf17-oss/Ameen?color=blue" alt="License: AGPLv3" />
  <img src="https://img.shields.io/badge/core-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Android-Kotlin-7F52FF?logo=kotlin&logoColor=white" alt="Kotlin" />
  <img src="https://img.shields.io/badge/Windows-.NET_MAUI-512BD4?logo=dotnet&logoColor=white" alt=".NET MAUI" />
  <img src="https://img.shields.io/badge/extension-Chrome-FBBC04?logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/extension-Firefox-FF7139?logo=firefox&logoColor=white" alt="Firefox Extension" />
  <img src="https://img.shields.io/github/v/release/mohamadaboassaf17-oss/Ameen?include_prereleases" alt="GitHub release" />
</p>

---

## Features *(الميزات)*

- **Zero-Knowledge Vaults** *(خزائن بعدم الإفصاح عن البيانات)* — All encryption, decryption, and key derivation happen exclusively on your device. No secrets, master passwords, recovery keys, or OTP seeds ever leave.
- **Cross-Platform** *(متعدد المنصات)* — Native apps for Android and Windows, plus browser extensions for Chrome, Firefox, Edge, and Brave.
- **Biometric Authentication** *(مصادقة بيومترية)* — Android Keystore + BiometricPrompt on Android; Windows Hello with TPM-backed protection on Windows.
- **Password & Passphrase Generator** *(مولّد كلمات المرور وعبارات المرور)* — Configurable length, character sets, and memorable passphrase mode.
- **TOTP (Time-based One-Time Passwords)** *(رموز التحقق لمرة واحدة)* — Built-in TOTP generator alongside stored credentials.
- **Password Health** *(صحة كلمات المرور)* — Detect reused, weak, and compromised passwords locally without external API calls.
- **Family Profiles** *(ملفات تعريف عائلية)* — Isolated encrypted vaults per family member with transparent, auditable parental recovery (ولي الأمر).
- **LAN Sync** *(مزامنة عبر الشبكة المحلية)* — Peer-to-peer vault sync over Wi-Fi using mDNS service discovery, ECDH key exchange, and AES-256-GCM transport encryption. Pairing requires visual fingerprint verification on both devices.
- **Browser Autofill** *(تعبئة تلقائية للمتصفح)* — Browser extensions communicate exclusively with the local app. No cloud relay.
- **Import & Export** *(استيراد وتصدير)* — Import from CSV and KDBX; export to CSV and `.ameen-backup`. Emergency Kit PDF with recovery instructions.
- **Google Drive Backup (Android)** *(نسخ احتياطي إلى Google Drive)* — Optional encrypted backup to Google Drive on Android.
- **Clipboard Clearing** *(مسح الحافظة)* — Automatic clipboard wipe after a configurable timeout.
- **Screenshot Protection** *(حماية من لقطات الشاشة)* — Block screenshots and screen recording where platform APIs support it.
- **No Ads, No Trackers, No Cloud** *(بدون إعلانات، بدون تتبع، بدون سحابة)* — Free and open source. Forever.

---

## Architecture *(الهندسة المعمارية)*

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser Extensions                        │
│            (Chrome · Firefox · Edge · Brave — MV3)               │
│           Autofill · OTP · Native Messaging Bridge               │
└──────────────────────────────┬───────────────────────────────────┘
                               │  Native Messaging
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Android App · Windows App                     │
│                  Kotlin / Jetpack Compose  |  .NET MAUI           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Platform Secure Storage                        │  │
│  │   Android Keystore + BiometricPrompt  |  Windows Hello      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      SHARED CRYPTO CORE                     │  │
│  │                     (TypeScript · WASM)                     │  │
│  │                                                             │  │
│  │   ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌────────┐  │  │
│  │   │ Argon2id │  │AES-256-  │  │   ECDH     │  │ HMAC   │  │  │
│  │   │  (KDF)   │  │  GCM     │  │ (P-521)    │  │ SHA-512│  │  │
│  │   └──────────┘  └──────────┘  └────────────┘  └────────┘  │  │
│  │                                                             │  │
│  │   ┌──────────┐  ┌──────────┐  ┌────────────┐               │  │
│  │   │   OTP    │  │ Password │  │  Backup /   │               │  │
│  │   │ (TOTP)   │  │   Gen    │  │  Import     │               │  │
│  │   └──────────┘  └──────────┘  └────────────┘               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Local Vault Storage                       │  │
│  │   ┌────────────────────┐    ┌─────────────────────────┐     │  │
│  │   │ Encrypted Vault    │    │  Plaintext Metadata      │     │  │
│  │   │ (AES-256-GCM)      │    │  Index (URLs, titles,    │     │  │
│  │   │ Secrets, keys,     │    │  timestamps — NO secrets)│     │  │
│  │   │ TOTP, recovery     │    └─────────────────────────┘     │  │
│  │   └────────────────────┘                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    LAN Sync Engine                          │  │
│  │  mDNS Discovery ─► ECDH Handshake ─► AES-256-GCM Transport │  │
│  │  Pairing: visual fingerprint verification on both devices  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security Model *(نموذج الأمان)*

Ameen operates on a **zero-knowledge** principle. The server (if any, for optional backups) knows nothing about your data.

| Layer | Algorithm / Mechanism |
|-------|----------------------|
| Key Derivation | **Argon2id** (memory-hard, tuneable iterations) |
| Vault Encryption | **AES-256-GCM** (authenticated encryption) |
| Transport Encryption | **AES-256-GCM** over **ECDH (P-521)** negotiated session keys |
| Integrity | **HMAC-SHA-512** on vault metadata |
| Authentication | Biometric (Android Keystore, Windows Hello) with master password fallback |
| TOTP | Per-entry TOTP seeds encrypted within the vault |

- Master password never stored, never transmitted.
- All crypto operations run **client-side only**.
- No remote-accessible recovery mechanism — recovery is local (Emergency Kit PDF) or family-profile mediated.
- Sensitive data is held exclusively in platform secure storage.
- LAN sync requires explicit pairing with visual fingerprint comparison on both devices. No automatic trust.

---

## Quick Start *(بداية سريعة)*

### Prerequisites *(المتطلبات المسبقة)*

- **Node.js** ≥ 18 (shared crypto core and browser extension)
- **Android Studio** Hedgehog+ (Android)
- **.NET 8 SDK** (Windows)
- **Chrome / Firefox / Edge / Brave** (browser extension)

### Shared Crypto Core *(نواة التشفير المشتركة)*

```bash
cd ameen-app/shared-crypto
npm ci
npm run build          # Outputs to ameen-app/shared-crypto/dist/
```

### Android *(أندرويد)*

```bash
cd ameen-app/android
./gradlew assembleDebug    # Debug APK at ameen-app/android/app/build/outputs/apk/debug/
```

To run on a connected device or emulator:

```bash
./gradlew installDebug
```

### Windows *(ويندوز)*

```bash
dotnet build ameen-app/windows/Ameen.Windows.sln
```

To run:

```bash
dotnet run --project ameen-app/windows/Ameen.Windows/Ameen.Windows.csproj
```

### Browser Extension *(إضافة المتصفح)*

```bash
cd ameen-app/extension
npm ci
npm run build            # Outputs to ameen-app/extension/dist/
```

Load unpacked:
- **Chrome/Edge/Brave:** `chrome://extensions` → Developer mode → Load unpacked → select `ameen-app/extension/dist/`
- **Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → select `ameen-app/extension/dist/manifest.json`

---

## Project Structure *(هيكل المشروع)*

```
Ameen/
├── README.md                # You are here
├── tasks.md                 # Development milestones & tracking
├── AGENTS.md                # Agent instructions (Arabic)
├── (Ameen PRD).md           # Product requirements document
├── ameen-app/
│   ├── shared-crypto/       # TypeScript crypto core (shared by all platforms)
│   │   ├── src/
│   │   │   ├── kdf.ts       # Argon2id key derivation
│   │   │   ├── vault.ts     # AES-256-GCM vault seal/unseal
│   │   │   ├── sync.ts      # ECDH key exchange + session encryption
│   │   │   ├── totp.ts      # TOTP (RFC 6238)
│   │   │   ├── password-gen.ts # Password and passphrase generator
│   │   │   ├── health.ts    # Password health checks (local)
│   │   │   └── backup.ts    # .ameen-backup / CSV / KDBX I/O
│   │   ├── tests/
│   │   └── package.json
│   ├── android/             # Android app (Kotlin, Jetpack Compose)
│   │   ├── app/
│   │   │   └── src/main/kotlin/com/ameenpw/android/
│   │   ├── gradle/
│   │   └── build.gradle.kts
│   ├── windows/             # Windows app (.NET MAUI)
│   │   ├── Ameen.Windows/
│   │   └── Ameen.Windows.sln
│   ├── extension/           # Browser extension (MV3)
│   │   ├── src/
│   │   │   ├── background/
│   │   │   ├── content/
│   │   │   ├── popup/
│   │   │   └── native-messaging/
│   │   └── package.json
│   ├── web-demo/            # Web-based demo playground
│   ├── .github/             # CI/CD workflows & issue templates
│   ├── LICENSE              # AGPLv3
│   ├── SECURITY.md          # Security policy and reporting
│   ├── CONTRIBUTING.md      # Contributor guide
│   ├── CHANGELOG.md         # Release history
│   └── RELEASE_NOTES.md     # Latest release details
```

---

## Screenshots *(لقطات)*

*Screenshots to be added — planned views:*

- Vault list with search
- Entry detail (username, password, TOTP, notes)
- Password/passphrase generator
- Password health dashboard
- Family profile picker
- LAN sync pairing screen (fingerprint verification)
- Browser extension popup (autofill suggestions)
- Emergency Kit PDF preview

---

## License *(الترخيص)*

Ameen is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. See [LICENSE](./ameen-app/LICENSE) for the full text.

This means you are free to use, study, modify, and distribute this software, provided that any modified versions distributed over a network also make their source code available under the same license.

---

## Community *(المجتمع)*

- **Discussions:** [GitHub Discussions](https://github.com/mohamadaboassaf17-oss/Ameen/discussions) — questions, ideas, help
- **Security:** See [SECURITY.md](./ameen-app/SECURITY.md) for reporting vulnerabilities responsibly
- **Contributing:** See [CONTRIBUTING.md](./ameen-app/CONTRIBUTING.md) for guidelines and development setup

---

<p align="center">
  <sub>لا تخضع ولا تنكسر. محلي. آمن. مفتوح.</sub><br />
  <sub>Local. Secure. Open.</sub>
</p>
