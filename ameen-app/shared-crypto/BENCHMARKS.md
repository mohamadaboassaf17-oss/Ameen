# Performance Benchmarks

Measured on: Windows (Node.js vitest runner). All measurements via `performance.now()` around real implementations only — no mocks.

| Operation | Time | Target | Status |
|-----------|------|--------|--------|
| Key Derivation (Argon2id unlock) | 171ms | <2000ms | ✅ |
| AES-256-GCM encrypt (1KB) | 1.82ms | <5ms | ✅ |
| AES-256-GCM encrypt (10KB) | 0.21ms | <5ms | ✅ |
| AES-256-GCM encrypt (100KB) | 0.66ms | <10ms | ✅ |
| AES-256-GCM decrypt (1KB) | 0.23ms | <5ms | ✅ |
| AES-256-GCM decrypt (10KB) | 0.13ms | <5ms | ✅ |
| AES-256-GCM decrypt (100KB) | 0.57ms | <10ms | ✅ |
| TOTP generation (1000 ops) | 77ms | <100ms | ✅ |
| Password generation (1000 ops, len=20) | 30ms | <50ms | ✅ |
| CSV parsing (1000 items) | 8ms | <100ms | ✅ |
| Backup encrypt (100 items) | 3ms | <50ms | ✅ |
| Backup decrypt (100 items) | 3ms | <50ms | ✅ |
| Backup round-trip (100 items) | 5ms | <100ms | ✅ |

## Notes
- Argon2id key derivation completes in ~171ms with default parameters (3 iterations, 64MB memory, 4 parallelism), well under the 2000ms threshold for comfortable unlock UX.
- AES-256-GCM uses Web Crypto API hardware acceleration; throughput scales linearly with data size.
- TOTP per-code cost is ~0.08ms (dominated by HMAC-SHA1 import + sign).
- Password generation is synchronous and fast (~0.03ms per password).
- CSV parsing of 1000 Ameen-format rows completes in ~8ms.
- Full vault backup round-trip (serialize + encrypt + decrypt + deserialize) for 100 items takes ~5ms total.
