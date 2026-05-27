function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Element not found: ${id}`);
  return found;
}

el('versionDisplay').textContent = chrome.runtime.getManifest().version || '1.0.0';

el('btnDisconnect').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
    const info = el('disconnectedInfo');
    info.style.display = 'block';
    setTimeout(() => {
      info.style.display = 'none';
    }, 3000);
  });
});

el('btnResetPairing').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
    chrome.storage.local.remove('isExtensionPaired', () => {
      const info = el('disconnectedInfo');
      info.textContent = '✓ تمت إعادة التعيين بنجاح';
      info.style.display = 'block';
      setTimeout(() => {
        info.style.display = 'none';
      }, 3000);
    });
  });
});
