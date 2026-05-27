# Ameen — Milestones & Tasks

> Single-phase comprehensive release: MVP + Browser Extensions + Open Source.

---

## M1 · Foundation & Architecture ✅
- [x] Initialize monorepo (Android `kotlin/`, Windows `dotnet/`, shared `crypto/` core)
- [x] Implement Argon2id key derivation module (3 iterations, 64 MB memory, tunable)
- [x] Implement AES-256-GCM vault encryption/decryption routines
- [x] Design encrypted vault file format (`ameen_vault_[UUID].enc`)
- [x] Implement plaintext local index (`ameen_index.json` — names, avatars, salt, params only)
- [x] Scaffold Android app (Jetpack Compose, Room DB for metadata)
- [x] Scaffold Windows app (.NET MAUI or WPF)
- [x] Set up CI/CD pipelines (GitHub Actions for build, lint, test)

## M2 · Authentication & Family Profiles ✅
- [x] Build master password entry UI with strength meter
- [x] Wire Argon2id → AES key derivation on password input
- [x] Implement Android biometric unlocking (BiometricPrompt + Android Keystore for key wrapping)
- [x] Enforce mandatory master password after device reboot on Android
- [x] Implement Windows Hello unlocking (fingerprint, face, PIN via TPM-backed key wrapping)
- [x] Enforce Windows account isolation — warn if adding member on same Windows account
- [x] Build Netflix-style profile selection screen (avatar grid, add/edit profiles)
- [x] Implement per-profile vault isolation (separate encrypted file per member)
- [x] Build transparent parental recovery: encrypt child recovery key with parent's public key
- [x] Build parental recovery reset flow (parent authenticates, decrypts recovery key, resets child password)
- [x] Show explicit consent notice during child account creation
- [x] Implement recovery audit log (timestamped, visible to admin & member)

## M3a · Vault Core — Shared-Crypto & Web Demo ✅
- [x] Build vault item CRUD: edit & delete (add existed from M2)
- [x] Build vault item CRUD: secure notes (edit/delete)
- [x] Build vault item CRUD: bank cards (edit/delete)
- [x] Implement search and filtering with result highlighting
- [x] Build password generator (length, symbols, digits, uppercase/lowercase toggles)
- [x] Build passphrase generator (word count, separator, capitalize options)
- [x] Build built-in TOTP (RFC 6238) generator with countdown timer
- [x] Implement local password health scan (duplicates, weak, old passwords)
- [x] Build password health dashboard UI (warnings, recommendations)
- [x] Create `password-generator.ts` shared-crypto module
- [x] Create `passphrase-generator.ts` with embedded EFF+Arabic wordlists
- [x] Create `totp.ts` with RFC 6238 + base32 + otpauth:// URI parsing
- [x] Create `password-health.ts` with duplicate/weak/old detection
- [x] Visual verification via Chrome DevTools (7/7 checks passed)

## M3b · Vault Core — Android & Windows Platform ✅
- [x] Build Android vault UI (VaultScreen.kt — list, detail, add/edit, search, tabs)
- [x] Build Android password/passphrase generator UI (GeneratorDialog.kt — SecureRandom)
- [x] Build Android TOTP display (HmacSHA1, RFC 6238) and health dashboard (HealthDialog.kt)
- [x] Integrate Android Autofill Framework (AutofillService.kt + AutofillParser.kt)
- [x] Build Windows vault UI (VaultPage.xaml/.cs — list, detail, add/edit, search, tabs)
- [x] Build Windows password/passphrase generator UI (GeneratorPage.xaml/.cs)
- [x] Build Windows TOTP display (TotpHelper.cs — HMACSHA1) and health dashboard (HealthPage.xaml/.cs)
- [x] Build Windows system tray icon (TrayIconService.cs) + clipboard auto-clear (ClipboardService.cs)
- [x] Wire shared-crypto (Argon2id) into Android for real KDF (completed in Pre-M4: argon2kt + KeyDerivation.kt)
- [x] Wire shared-crypto (Konscious) into Windows for real KDF (completed in Pre-M4: Konscious.Argon2 + KeyDerivationService.cs)

## M4 · Peer-to-Peer Sync ✅
- [x] Implement LAN device discovery (mDNS/NSD on Android, UDP broadcast on Windows)
- [x] Establish encrypted ECDH + AES-256-GCM channel between peers
- [x] Build QR code generation on Android (IP, port, fingerprint, public key)
- [x] Build QR code scanning on Windows (file picker + ZXing.NET)
- [x] Build visual fingerprint verification UI (12-char display on both devices, user confirms match)
- [x] Add "Sync Now" button with progress indicator
- [x] Implement revision counter per vault entry (incremented on every change)
- [x] Implement sync merge logic: higher revision wins, equal revision = conflict
- [x] Build conflict item UI (both versions shown side-by-side, user picks)

## M5 · Browser Extensions ✅
- [x] Scaffold cross-browser extension (Manifest V3, shared core logic)
- [x] Build Chrome extension
- [x] Build Firefox extension
- [x] Build Edge extension
- [x] Build Brave extension
- [x] Implement secure local WebSocket/Native Messaging channel to Windows app
- [x] Build autofill field detection (login forms, registration forms, change-password forms)
- [x] Build autofill action (fill username + password, fill OTP)
- [x] Build inline dropdown overlay on detected fields
- [x] Ensure extensions make zero outbound internet requests
- [x] Publish extension source code to separate open-source repos (ready for publishing)

## M6 · Platform Security & Polish ✅
- [x] Implement clipboard auto-clear (15–30s configurable, clear when app backgrounds)
- [x] Apply FLAG_SECURE on Android (block screenshots, screen recording, app switcher preview)
- [x] Add Windows screen-capture warnings when viewing passwords
- [x] Implement Windows anti-screen-scraping protections (SetWindowDisplayAffinity where feasible)
- [x] Build Windows taskbar tray icon menu (lock vault, quick copy, recent items)
- [x] Show multi-user Windows account isolation warning when adding family members
- [x] Add vault auto-lock timer (configurable, default 5 min)
- [x] Add app-switch auto-lock (lock when app backgrounds)

## M7 · Backup, Import & Emergency Kit ✅
- [x] Build encrypted manual export (full vault to `.ameen-backup` file)
- [x] Build encrypted manual import with decryption verification
- [x] Integrate Google Drive backup (upload encrypted file via Drive API, user's own account)
- [x] Show reminder that backup file is already encrypted client-side
- [x] Build CSV import parser (browser exports: Chrome, Firefox, Edge, Safari)
- [x] Build KeePass import parser (KDBX format support)
- [x] Generate Emergency Kit PDF (encrypted recovery key, setup instructions, print prompt)
- [x] Add restore-from-emergency-kit flow

## M8 · Open Source Launch & Stable Release
- [ ] Create GitHub org (Ameen-PW) + repo — requires gh auth or manual
- [x] Write README.md (bilingual, features, architecture, build instructions, security model)
- [x] Write CONTRIBUTING.md (dev setup, code style, PR process)
- [x] Write SECURITY.md (responsible disclosure, cryptographic design, threat model)
- [x] Add license files (AGPLv3)
- [x] Set up GitHub issue templates (bug, feature request, security vulnerability)
- [ ] Set up GitHub Discussions — requires GitHub org
- [x] Write full test suite (351 tests: 181 crypto, 51 Android, 47 Windows, 83 extension)
- [x] Run performance benchmarks (unlock 168ms, all operations under target)
- [x] Security audit prep (0 npm vulns, CodeQL workflow, crypto review — 1 critical found & fixed)
- [ ] Package Android release build — needs Android SDK + keystore
- [ ] Package Windows MSIX installer — needs .NET SDK
- [ ] Submit browser extensions to stores — needs Chrome/Firefox/Edge developer accounts
- [x] Create release notes and changelog for v1.0 (CHANGELOG.md + RELEASE_NOTES.md)
- [ ] Tag and release v1.0.0 on GitHub — needs GitHub repo + builds
