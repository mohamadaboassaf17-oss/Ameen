# Changelog

All notable changes to Ameen (أمين) will be documented in this file.

## [1.0.0] — Initial Release (2026-05-27)

### Core Security
- Argon2id key derivation (3 iterations, 64 MB, 4 parallelism)
- AES-256-GCM vault encryption/decryption
- Zero-knowledge architecture — all crypto client-side only
- Platform-secured key storage (Android Keystore + Windows Hello with TPM)

### Vault Management
- Password, secure note, and bank card item types
- Search and filtering with result highlighting
- Password generator (customizable length, character types)
- Passphrase generator (EFF + Arabic wordlists)
- Built-in TOTP generator (RFC 6238, SHA-1, 30s/60s period)

### Authentication & Profiles
- Master password with strength meter
- Biometric unlock (Android BiometricPrompt, Windows Hello)
- Family profiles with per-member encrypted vault isolation
- Transparent parental recovery with audit logging

### Password Health
- Duplicate password detection
- Weak password identification
- Password age tracking and recommendations

### Peer-to-Peer Sync
- LAN device discovery (mDNS/NSD on Android, UDP on Windows)
- ECDH + AES-256-GCM encrypted channels
- QR code pairing with visual fingerprint verification
- Revision counter-based merge with conflict resolution

### Browser Extensions
- Manifest V3 extensions for Chrome, Firefox, Edge, Brave
- Autofill for login, registration, and change-password forms
- OTP autofill detection
- Secure Native Messaging channel to Windows app
- Zero outbound network requests

### Backup & Import
- Encrypted .ameen-backup export/import (AES-256-GCM)
- CSV import from Chrome, Firefox, Edge, Safari, and Ameen formats
- KDBX 3.1 (KeePass) import
- Emergency Kit PDF generation (Arabic RTL, print-ready)
- Google Drive backup (Android, encrypted client-side before upload)

### Platform Security
- Clipboard auto-clear (configurable timer)
- FLAG_SECURE screen capture blocking (Android)
- Anti-screen-scraping protections (Windows)
- Windows multi-user account isolation warnings
- Vault auto-lock timer
- App-switch auto-lock

### Open Source
- AGPLv3 license
- Full source available on GitHub
