import { computeCertFingerprint, formatFingerprint } from '../../../shared-crypto/src/cert-fingerprint';

export async function verifyFingerprint(
  ourFingerprint: string,
  theirFingerprint: string
): Promise<boolean> {
  return ourFingerprint === theirFingerprint;
}

export async function savePairingState(paired: boolean): Promise<void> {
  await chrome.storage.local.set({ isExtensionPaired: paired });
}

export async function isAlreadyPaired(): Promise<boolean> {
  const result = await chrome.storage.local.get('isExtensionPaired');
  return result.isExtensionPaired === true;
}

export async function unpair(): Promise<void> {
  await chrome.storage.local.remove('isExtensionPaired');
}

export { computeCertFingerprint, formatFingerprint };
