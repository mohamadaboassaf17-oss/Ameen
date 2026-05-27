export function matchUrl(pageUrl: string, vaultUrl: string): boolean {
  try {
    const page = new URL(pageUrl);
    const vault = new URL(vaultUrl);
    if (page.hostname === vault.hostname) return true;
    if (page.hostname.endsWith('.' + vault.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function scoreUrlMatch(pageUrl: string, vaultUrl: string): number {
  try {
    const page = new URL(pageUrl);
    const vault = new URL(vaultUrl);
    const pageHost = page.hostname;
    const vaultHost = vault.hostname;

    if (pageHost === vaultHost) return 100;
    if (pageHost.endsWith('.' + vaultHost)) return 80;
    const pageParts = pageHost.split('.');
    const vaultParts = vaultHost.split('.');
    if (
      pageParts.length >= 2 &&
      vaultParts.length >= 2 &&
      pageParts[pageParts.length - 1] === vaultParts[vaultParts.length - 1] &&
      pageParts[pageParts.length - 2] === vaultParts[vaultParts.length - 2]
    ) {
      return 60;
    }
    return 0;
  } catch {
    return 0;
  }
}
