# Contributing to Ameen

## Development Setup

### Prerequisites

- Node.js 20+
- .NET 8 SDK
- Android Studio (Hedgehog+)
- JDK 17

### Clone & Install

```bash
git clone https://github.com/Ameen-PW/ameen.git
cd ameen
cd shared-crypto && npm ci && npm run build
cd ../extension && npm ci && npm run build
```

## Project Structure

```
ameen-app/
├── shared-crypto/        # TypeScript — shared cryptographic primitives
├── android/              # Kotlin — Android vault (Jetpack Compose)
├── windows/              # .NET MAUI C# — Windows vault
├── extension/            # TypeScript + Webpack — browser extension
└── web-demo/             # Svelte — web demo frontend
```

## Code Style

- **TypeScript**: 4-space indent, explicit types, JSDoc on every export
- **Kotlin**: Kotlin convention + KDoc, Compose state hoisting
- **C#**: Microsoft convention + XML doc on public members
- **RTL**: All user-facing UI text must be in Arabic (right-to-left)
- **No silent catches**: always log errors before re-throwing or swallowing
- **Functions do one thing**: keep them small and testable

## Pull Request Process

1. Fork the repository and branch from `main`
2. Make your changes and write tests that cover them
3. Run tests for each affected subproject:
   - `npm test` (shared-crypto)
   - `./gradlew testDebug` (android)
   - `dotnet test` (windows)
4. Ensure the full build passes
5. Open a pull request with a clear description and linked issues
6. Security-sensitive changes require extra scrutiny and may need a companion SECURITY.md disclosure

## Security Guidelines

- Never hardcode keys, secrets, or tokens
- Always use platform-native crypto APIs (Android Keystore, Windows TPM/DPAPI, Web Crypto)
- No external network calls except Google Drive backup (with explicit user consent)
- See SECURITY.md for the full vulnerability disclosure policy

## License

By contributing, you agree that your code will be licensed under the GNU Affero General Public License v3.0 (AGPLv3).
