# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest 1.x minor release receives security patches. Pre-release builds (alpha, beta, RC) are not supported.

## Reporting a Vulnerability

**DO NOT open a public issue.**

We practice **coordinated disclosure**:
1. Report the vulnerability privately via email.
2. We acknowledge receipt within **48 hours**.
3. We aim to release a fix within **30 days** (sooner for critical severity).
4. After the fix ships, we publish an advisory. Credit is given to reporters who follow coordinated disclosure (unless you request anonymity).

### Contact

- **Email**: `[security@ameen.example.com]` *(placeholder — fill with actual address)*
- **Subject line**: `Security: Ameen — <short description>`
- **PGP key**: `[paste ASCII-armored PGP public key here]`

Include as much detail as possible: affected component, steps to reproduce, proof-of-concept code, and the impact you believe it has.

We will never threaten legal action against researchers who follow this policy.

---

## Cryptographic Design

Ameen is built on a **zero-knowledge architecture**. No plaintext secrets, master passwords, OTP seeds, or derived keys ever leave the device. The server (if any) sees only opaque encrypted blobs.

### Key Derivation

- **Algorithm**: Argon2id (RFC 9106)
- **Parameters**: 3 iterations, 64 MB memory, 4 degrees of parallelism
- **Output**: 256-bit master key
- **Inputs**: master password (user-chosen) + 256-bit cryptographically random salt
- **Salt**: unique per vault, stored alongside the vault file

The master key is derived once on unlock and held in process memory only. It is zeroed on lock or timeout.

### Vault Encryption

- **Cipher**: AES-256-GCM
- **Key size**: 256 bits
- **Nonce (IV)**: 96 bits, randomly generated per encryption operation (never reused with the same key)
- **Authentication tag**: 128 bits (included in the GCM ciphertext)

Each vault file is encrypted with its own **random vault key** (256-bit, CSRNG). The vault key is then **wrapped** (encrypted) with the Argon2id-derived master key, also using AES-256-GCM. This design avoids re-encrypting the entire vault on master password change — only the vault key needs re-wrapping.

### Peer-to-Peer Sync

- **Key exchange**: ECDH on NIST P-256 (secp256r1) — one ephemeral keypair per sync session
- **Session encryption**: AES-256-GCM with session keys derived from the shared ECDH secret via HKDF-SHA-256
- **Pairing**: 12-character visual fingerprint (truncated SHA-256 of the public keys), displayed on both devices; user must visually confirm a match before pairing completes
- **Discovery**: mDNS / NSD (LAN only), no broadcast beyond the local subnet
- **No relay servers**: mDNS-based discovery requires devices to be on the same LAN. P2P encryption is end-to-end even if a malicious device is on the same network.

### Platform Security

| Platform | Secure storage | Biometric unlock |
| -------- | -------------- | ---------------- |
| Android  | Android Keystore (hardware-backed, TEE) | BiometricPrompt (Class 3 / Strong) |
| Windows  | Windows Hello / TPM-backed key wrapping where available; software fallback otherwise | Windows Hello |
| Browser extensions | Native Messaging to local Windows app; **zero outbound network requests** for autofill data | Delegated to desktop app |

Password fields are marked `FLAG_SECURE` on Android and use secure text controls on Windows. Clipboard is cleared after 30 seconds by default, configurable by the user.

---

## Threat Model

### What Ameen protects against

| Threat | Mitigation |
| ------ | ---------- |
| Offline vault theft (disk/backup) | AES-256-GCM with Argon2id-derived keys |
| Device theft | Biometric lock + vault auto-lock on timeout |
| Network eavesdropping | All sync traffic is AES-256-GCM encrypted after ECDH key exchange |
| Cloud provider compromise | Server never sees plaintext or keys |
| Rogue sync attempts | Visual fingerprint verification required for pairing |
| Brute-force / dictionary attacks | Argon2id with 64 MB memory cost raises attacker cost |

### What Ameen does NOT protect against

| Threat | Reason |
| ------ | ------ |
| Compromised device OS (rootkit, malware) | Encryption keys are held in memory while vault is unlocked |
| Keyloggers | Master password is typed; biometric unlock mitigates this |
| Physical coercion / shoulder-surfing | Cryptography cannot stop a forced disclosure |
| Side-channel attacks on the CPU running Argon2id / AES | Mitigation is platform-dependent; not in scope for v1 |

---

## Audit Status

| Item | Status |
| ---- | ------ |
| Independent third-party security audit | **Not yet conducted** (planned) |
| Dependency vulnerability monitoring | Automated via CI (Dependabot / npm audit / cargo audit) |
| Static analysis (SAST) | CodeQL enabled on all code paths (`*/.ts`, `*/*.kt`, `*/*.swift`, `*/*.rs`) |
| Supply chain (provenance) | Pinned lockfiles; SBOM generation in CI |

### Penetration Testing

If you are a security researcher and would like to perform a penetration test against a local installation of Ameen, you do not need prior authorization as long as you:
- Test only against your own vaults and devices.
- Do not attack infrastructure belonging to Ameen-PW or other users.
- Follow the coordinated disclosure policy above.

---

## Known Gaps

- **KDBX4 import**: Only KDBX 3.1 is supported for Keepass import. KDBX4 support is tracked in a separate milestone.
- **Google Drive backup (Android)**: The backup module requires production OAuth credentials (currently uses placeholder dev keys). Manual export is the supported backup path for v1.
- **iOS / Swift**: No iOS native app exists yet. The `shared-crypto` crate is platform-agnostic, but a Swift wrapper and UI are not yet implemented.
- **Hardware token (FIDO2 / YubiKey)**: Not yet supported as a second factor or key-derivation input.

These gaps are acknowledged, not hidden. Refer to the public roadmap for planned milestones.

---

## Responsible Disclosure Hall of Fame

We maintain a public list of researchers who have responsibly disclosed security issues. If you report a valid vulnerability and follow coordinated disclosure, we will list your name here (or keep you anonymous, per your preference).

*(No entries yet — be the first.)*
