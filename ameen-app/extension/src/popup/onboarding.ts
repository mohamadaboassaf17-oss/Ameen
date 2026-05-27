import { ConnectionState, type ExtensionState } from '../background/state';

function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Element not found: ${id}`);
  return found;
}

let currentStep = 1;
let maxStep = 1;
let state: ExtensionState | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

const steps = document.querySelectorAll('.step');
const errorTextEl = el('errorText');
const btnStartPair = el('btnStartPair') as HTMLButtonElement;
const btnFinish = el('btnFinish') as HTMLButtonElement;
const fingerprintDisplayEl = el('fingerprintDisplay');
const fpContainer = el('fpContainer');
const pairActions = el('pairActions');

function formatFingerprintForDisplay(fp: string): string {
  if (!fp || fp.length < 8) return fp;
  const parts: string[] = [];
  for (let i = 0; i < fp.length; i += 2) {
    parts.push(fp.substring(i, i + 2));
  }
  return parts.join(' ');
}

function updateStepVisual(): void {
  steps.forEach(s => {
    const stepNum = parseInt(s.getAttribute('data-step') || '0', 10);
    s.classList.remove('active', 'completed');
    if (stepNum < currentStep) s.classList.add('completed');
    else if (stepNum === currentStep) s.classList.add('active');
  });

  if (currentStep >= 2) {
    btnStartPair.disabled = false;
  }
}

function showError(message: string): void {
  errorTextEl.textContent = message;
  errorTextEl.style.display = 'block';
}

function hideError(): void {
  errorTextEl.style.display = 'none';
}

function advanceStep(): void {
  if (currentStep < 4) {
    currentStep++;
    maxStep = Math.max(maxStep, currentStep);
    updateStepVisual();
  }
}

function requestState(): void {
  chrome.runtime.sendMessage(
    { type: 'get_state' },
    (response: Record<string, unknown>) => {
      if (chrome.runtime.lastError) return;
      if (response && response.state) {
        handleState(response.state as ExtensionState);
      }
    }
  );
}

function startPolling(): void {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(requestState, 1000);
}

function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function handleState(newState: ExtensionState): void {
  state = newState;
  hideError();

  if (state.connectionState === ConnectionState.CONNECTED && state.isPaired) {
    stopPolling();
    currentStep = 4;
    maxStep = 4;
    updateStepVisual();
    return;
  }

  if (state.connectionState === ConnectionState.PAIRING && state.serverFingerprint) {
    currentStep = 3;
    maxStep = 3;
    updateStepVisual();
    fpContainer.style.display = 'block';
    pairActions.style.display = 'flex';
    fingerprintDisplayEl.textContent = formatFingerprintForDisplay(state.serverFingerprint);
    return;
  }

  if (state.connectionState === ConnectionState.CONNECTING) {
    if (currentStep < 2) return;
    return;
  }

  if (state.lastError) {
    showError(state.lastError);
  }
}

chrome.runtime.onMessage.addListener((message: Record<string, unknown>) => {
  if (message.type === 'state_update' && message.state) {
    handleState(message.state as ExtensionState);
  }
});

el('btnStartPair').addEventListener('click', () => {
  hideError();
  advanceStep();
  btnStartPair.disabled = true;
  btnStartPair.textContent = 'جاري الاتصال...';
  chrome.runtime.sendMessage({ type: 'connect' }, () => {
    startPolling();
  });
});

el('btnConfirmPair').addEventListener('click', () => {
  hideError();
  chrome.runtime.sendMessage({ type: 'confirm_pairing', confirmed: true });
});

el('btnRejectPair').addEventListener('click', () => {
  hideError();
  chrome.runtime.sendMessage({ type: 'reject_pairing' });
  stopPolling();
  currentStep = 2;
  updateStepVisual();
  fpContainer.style.display = 'none';
  pairActions.style.display = 'none';
  btnStartPair.disabled = false;
  btnStartPair.textContent = 'بدء الاقتران';
  showError('تم رفض الاقتران. يمكنك المحاولة مرة أخرى.');
});

el('btnFinish').addEventListener('click', () => {
  stopPolling();
  chrome.action.setPopup({ popup: 'popup/index.html' }).catch(() => {});
  window.close();
});

function init(): void {
  updateStepVisual();
  requestState();
}

document.addEventListener('DOMContentLoaded', init);
