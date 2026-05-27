export { deriveKey } from './key-derivation';
export type { Argon2Params } from './key-derivation';
export { DEFAULT_ARGON2_PARAMS } from './key-derivation';

export { encrypt, decrypt, encryptString, decryptToString } from './encryption';

export { generatePassword, estimateStrength, PASSWORD_CHARSETS } from './password-generator';
export type { PasswordOptions, PasswordResult } from './password-generator';

export { generatePassphrase, EFF_WORDLIST_LENGTH, ARABIC_WORDLIST_LENGTH } from './passphrase-generator';
export type { PassphraseOptions, PassphraseResult } from './passphrase-generator';

export { scanPasswordHealth, generateHealthRecommendations, hashPasswordForComparison } from './password-health';
export type { WeakPassword, DuplicatePassword, OldPassword, PasswordHealthResult } from './password-health';

export { serializeVault, deserializeVault, encryptVault, decryptVault, incrementRevision } from './vault-format';
export type { VaultItem, VaultData } from './vault-format';

export {
  serializeIndex,
  deserializeIndex,
  readIndex,
  writeIndex,
  createAuditEntry,
  serializeAuditLog,
  deserializeAuditLog,
  readAuditLog,
  writeAuditLog,
  appendAuditEntry,
} from './index-format';
export type { ProfileEntry, IndexData, PairedDevice, RecoveryAction, RecoveryAuditEntry, AuditLog } from './index-format';

export {
  generateRecoveryKeyPair,
  importRecoveryPublicKey,
  importRecoveryPrivateKey,
  encryptRecoveryKey,
  decryptRecoveryKey,
  generateVaultKey,
  reEncryptVault,
} from './recovery';

export { generateTOTP, generateTOTPSecret, parseOTPAuthURI, getRemainingSeconds } from './totp';
export type { TOTPOptions, TOTPResult, TOTPURIResult } from './totp';

export type { SyncRequest, SyncResponse, SyncMessage } from './sync-types';
export { isSyncRequest, isSyncResponse } from './sync-types';

export { mergeVaults } from './sync-merge';
export type { MergeResult } from './sync-merge';

export { computeCertFingerprint, formatFingerprint } from './cert-fingerprint';

export { createSyncAuditEntry } from './sync-audit';
export type { SyncAuditEntry, SyncAuditLog } from './sync-audit';

export {
  encryptBackup,
  decryptBackup,
  serializeBackup,
  deserializeBackup,
  validateBackupManifest,
} from './backup-format';
export type { BackupManifest } from './backup-format';

export {
  generateBackupPassphrase,
  wrapVaultKey,
  unwrapVaultKey,
  serializeBackupKeyData,
  deserializeBackupKeyData,
} from './emergency-kit';
export type { BackupKeyData } from './emergency-kit';

export { detectCsvFormat, parseCsvToVaultItems, vaultItemsToAmeenCsv } from './csv-parser';
export type { CsvFormat, DetectedCsv } from './csv-parser';

export { readKdbx } from './kdbx-reader';
export type { KdbxResult } from './kdbx-reader';
