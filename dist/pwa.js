const option = document.querySelector('#install-option');
const button = document.querySelector('#install-app');
const dialog = document.querySelector('#install-dialog');
const standalone = matchMedia('(display-mode: standalone)');
let installPrompt = null, offlineReady = false;
const isInstalled = () => standalone.matches || navigator.standalone === true;
const refresh = () => { option.hidden = !offlineReady || isInstalled(); };

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  refresh();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  option.hidden = true;
  if (dialog.open) dialog.close();
});
standalone.addEventListener('change', refresh);

button.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') option.hidden = true;
    } catch {
      showInstructions();
    } finally {
      button.disabled = false;
    }
  } else {
    showInstructions();
  }
});

function showInstructions() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const macSafari = /Mac/.test(navigator.platform) &&
    /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
  document.querySelector('#install-instructions').textContent = ios
    ? 'Open this page in your browser, tap Share, then Add to Home Screen. Turn on Open as Web App if that option appears.'
    : macSafari
      ? 'In Safari, choose File → Add to Dock. PocketCompress will open in its own app window.'
      : 'Open this page in Chrome or Edge and use the Install app option in the address bar or browser menu. On a Mac, Safari also offers File → Add to Dock.';
  dialog.showModal();
}

dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), { updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready)
    .then(registration => new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error('Offline preparation timed out.'));
      }, 15000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel.port1.close();
        if (event.data?.offlineReady) resolve();
        else reject(new Error('Offline files could not be prepared.'));
      };
      registration.active.postMessage({ type: 'PREPARE_OFFLINE' }, [channel.port2]);
    }))
    .then(() => { offlineReady = true; refresh(); })
    .catch(() => { option.hidden = true; });
}
