(() => {
  'use strict';

  const CACHE_PREFIX = 'etf-rechner-';
  const VERSION_TIMEOUT_MS = 1500;
  const REFRESH_TIMEOUT_MS = 20000;

  const isStandalone = () =>
    globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const isAppleMobile = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');

  /* ---------------------------------------------------------------- Install */

  function setupInstall() {
    const button = document.querySelector('#installBtn');
    const hint = document.querySelector('#installHint');
    if (!button || !hint) return;

    let installPrompt = null;

    function show(text, withButton) {
      hint.textContent = text;
      button.hidden = !withButton;
    }

    function sync() {
      if (isStandalone()) show('Der ETF-Rechner ist bereits als App installiert.', false);
      else if (installPrompt) show('Der ETF-Rechner kann jetzt als eigenständige App installiert werden.', true);
      else if (isAppleMobile()) show('Auf iPhone und iPad: unten das Teilen-Symbol antippen und „Zum Home-Bildschirm“ wählen.', false);
      else show('Im Browsermenü „App installieren“ beziehungsweise „Zum Startbildschirm hinzufügen“ wählen.', false);
    }

    sync();

    globalThis.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      sync();
    });

    globalThis.addEventListener('appinstalled', () => { installPrompt = null; sync(); });

    button.addEventListener('click', async () => {
      if (!installPrompt) { sync(); return; }
      const prompt = installPrompt;
      installPrompt = null;
      button.hidden = true;
      try {
        const result = await prompt.prompt();
        const choice = prompt.userChoice ? await prompt.userChoice : result;
        hint.textContent = choice?.outcome === 'accepted' ? 'Installation gestartet.' : 'Installation abgebrochen.';
      } catch (_) {
        sync();
      }
    });
  }

  /* ----------------------------------------------------------------- Update */

  function setupUpdate() {
    const section = document.querySelector('#updateSection');
    const button = document.querySelector('#updateBtn');
    const hint = document.querySelector('#updateHint');
    if (!section || !button || !hint) return;

    if (!('serviceWorker' in navigator)) {
      section.hidden = true;
      return;
    }

    let version = '';
    let busy = false;
    let statusToken = 0;

    function setStatus(text) {
      statusToken += 1;
      hint.textContent = text;
    }

    function baseHint() {
      const prefix = version ? `Installierte Version: ${version}. ` : '';
      return `${prefix}Holt die neueste Fassung vom Server und leert den Zwischenspeicher.`;
    }

    function ask(message, timeoutMs) {
      const controller = navigator.serviceWorker.controller;
      if (!controller) return Promise.resolve(null);
      return new Promise(resolve => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), timeoutMs);
        channel.port1.onmessage = event => {
          clearTimeout(timer);
          resolve(event.data || null);
        };
        controller.postMessage(message, [channel.port2]);
      });
    }

    async function readVersion() {
      const answer = await ask({ type: 'etf-version' }, VERSION_TIMEOUT_MS);
      return answer?.version || '';
    }

    async function refreshVersion() {
      const token = statusToken;
      const next = await readVersion();
      if (token !== statusToken) return;
      version = next;
      hint.textContent = baseHint();
    }

    async function clearCaches() {
      if (typeof caches === 'undefined') return;
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX)).map(name => caches.delete(name)));
    }

    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      setStatus('Suche nach der neuesten Fassung …');

      try {
        if (!navigator.onLine) throw new Error('offline');
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) await registration.update();
        const answer = await ask({ type: 'etf-refresh' }, REFRESH_TIMEOUT_MS);
        if (!answer?.ok) await clearCaches();
        setStatus('Neueste Fassung wird geladen …');
        location.reload();
      } catch (_) {
        busy = false;
        button.disabled = false;
        setStatus(navigator.onLine
          ? 'Update fehlgeschlagen. Server nicht erreichbar — später erneut versuchen.'
          : 'Keine Verbindung. Für ein Update ins WLAN gehen und erneut versuchen.');
      }
    });

    document.querySelector('#settingsBtn')?.addEventListener('click', refreshVersion);
    navigator.serviceWorker.addEventListener('controllerchange', refreshVersion);
    navigator.serviceWorker.ready.then(refreshVersion).catch(() => {});
    refreshVersion();
  }

  /* ---------------------------------------------------------- Einstellungen */

  function setupSettings() {
    const button = document.querySelector('#settingsBtn');
    const closeButton = document.querySelector('#settingsCloseBtn');
    const overlay = document.querySelector('#settingsOverlay');
    if (!button || !closeButton || !overlay) return;

    function close() {
      overlay.hidden = true;
      button.focus();
    }

    button.addEventListener('click', () => {
      overlay.hidden = !overlay.hidden;
      if (!overlay.hidden) closeButton.focus();
    });
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    globalThis.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !overlay.hidden) close();
    });
  }

  /* --------------------------------------------------------- Service Worker */

  function registerServiceWorker() {
    const canRegister =
      'serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    if (!canRegister) return;
    globalThis.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(() => {});
    });
  }

  setupInstall();
  setupUpdate();
  setupSettings();
  registerServiceWorker();
})();
