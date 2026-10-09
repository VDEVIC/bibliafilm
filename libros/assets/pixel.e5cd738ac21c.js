'use strict';
(() => {
  const pixelId = 'DB4IV8RC77U074LG1GRG';
  const storageKey = 'bf_publicidad_v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById('pixel-consent');
  const settings = document.getElementById('pixel-settings');
  const status = document.getElementById('pixel-status');
  let loaded = false;
  let choice = null;

  function loadPixel() {
    if (loaded) {
      window.ttq.grantConsent();
      return;
    }
    loaded = true;
    // The SDK is not requested until the visitor explicitly accepts advertising cookies.
    window.TiktokAnalyticsObject = 'ttq';
    const ttq = window.ttq = window.ttq || [];
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    ttq.setAndDefer = (target, method) => { target[method] = function () { target.push([method].concat(Array.prototype.slice.call(arguments))); }; };
    ttq.methods.forEach(method => ttq.setAndDefer(ttq, method));
    ttq.instance = id => {
      const instance = ttq._i[id] || [];
      ttq.methods.forEach(method => ttq.setAndDefer(instance, method));
      return instance;
    };
    ttq.load = (id, options) => {
      const endpoint = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._i[id]._u = endpoint;
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};
      const script = document.createElement('script');
      script.async = true;
      script.src = endpoint + '?sdkid=' + id + '&lib=ttq';
      document.head.append(script);
    };
    ttq.holdConsent();
    ttq.load(pixelId);
    ttq.grantConsent();
    ttq.page();
    ttq.track('ViewContent');
    // Purchases finish at Amazon. A visit or an outbound click is never a Purchase event.
  }

  function apply(value, remember) {
    choice = value;
    if (remember) {
      try { localStorage.setItem(storageKey, JSON.stringify({choice, expires: Date.now() + lifetime})); } catch {}
    }
    banner.hidden = true;
    status.textContent = choice === 'accepted' ? 'Medición publicitaria aceptada.' : 'Medición publicitaria rechazada.';
    if (choice === 'accepted') loadPixel();
    else if (loaded) window.ttq.revokeConsent();
  }

  document.querySelectorAll('[data-pixel-choice]').forEach(button => button.addEventListener('click', () => {
    apply(button.dataset.pixelChoice, true);
    if (settings.open) settings.close();
  }));
  document.getElementById('pixel-preferences').addEventListener('click', () => {
    status.textContent = choice === null ? 'Todavía no has elegido.' : choice === 'accepted' ? 'Medición publicitaria aceptada.' : 'Medición publicitaria rechazada.';
    settings.showModal();
  });
  document.getElementById('pixel-more').addEventListener('click', () => settings.showModal());

  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
  if (saved && saved.expires > Date.now() && ['accepted', 'rejected'].includes(saved.choice)) apply(saved.choice, false);
  else banner.hidden = false;
})();
