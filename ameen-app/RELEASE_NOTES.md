## Installing

### Android
Download the APK from the [Releases page](https://github.com/Ameen-PW/ameen/releases/tag/v1.0.0) and sideload, or install from Google Play Store.

### Windows
Download the MSIX installer from the Releases page.

### Browser Extensions
Install from:
- [Chrome Web Store]
- [Firefox Add-ons]
- [Edge Add-ons]

Or build from source: `cd extension && npm ci && npm run build`

## Verification

All builds are signed. Verify signatures before installing.

SHA-256 checksums:
```
(TBD — add after builds)
```

## Known Issues
- KDBX 4.x (KeePass 2.x) import not yet supported; KDBX 3.1 only
- Google Drive backup requires OAuth setup (Android)
- No iOS/macOS support yet
- Demo data shown in UI by default (real encrypted vault I/O in development)

## What's Next (v1.1+)
- KDBX 4.x import support
- Real vault persistence (currently uses demo data in UI)
- Google Drive backup production integration
- iOS/macOS support
- WebAuthn/FIDO2 support
