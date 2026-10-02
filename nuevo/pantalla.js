'use strict';
const $ = selector => document.querySelector(selector);

// Pestañas: una sola pantalla, cada pestaña ya está montada; cambiar es mostrar una y ocultar las demás.
const views = ['pelicula', 'historia', 'proyecto', 'apoyar'];
const aliases = {aportacion: 'apoyar', 'apoyar-proyecto': 'apoyar'};
let activeView = null;
function viewFromHash() {
  const hash = location.hash.slice(1);
  return aliases[hash] || (views.includes(hash) ? hash : hash ? null : 'pelicula');
}
function showView(name, updateURL = true) {
  if (!views.includes(name) || name === activeView) return;
  activeView = name;
  for (const view of views) {
    const selected = name === view;
    $('#panel-' + view).classList.toggle('activo', selected);
    const tab = $('#tab-' + view);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  if (updateURL && location.hash !== '#' + name) history.pushState(null, '', '#' + name);
  if (name === 'historia') measureRail();
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  showView(button.dataset.view);
  $('#tab-' + button.dataset.view).focus({preventScroll: true});
}));
$('.tabbar-in').addEventListener('keydown', event => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = views.indexOf(activeView), last = views.length - 1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : (index + (event.key === 'ArrowRight' ? 1 : last)) % views.length;
  showView(views[next]);
  $('#tab-' + views[next]).focus({preventScroll: true});
});
// «Atrás» del navegador: solo responde a las direcciones de pestaña; cualquier otra se ignora
const followHash = () => { const view = viewFromHash(); if (view) showView(view, false); };
window.addEventListener('popstate', followHash);
window.addEventListener('hashchange', followHash);
$('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#panel-' + activeView).focus({preventScroll: true}); });

// Historia: una tarjeta a la vez. Se mueve con transform (flechas, puntos, teclado o deslizando a los lados).
const rail = $('#story-rail'), track = $('#story-track'), cards = [...track.children];
const railPrev = $('#rail-prev'), railNext = $('#rail-next'), railCounter = $('#rail-counter');
const dots = [...document.querySelectorAll('#rail-dots button')];
let slide = 0, perView = 1, step = 0;
const lastSlide = () => Math.max(0, cards.length - perView);
function measureRail() {
  const width = rail.clientWidth;
  if (!width) return;
  const style = getComputedStyle(track);
  perView = Math.max(1, Math.round(Number(style.getPropertyValue('--per-view')) || 1));
  step = (width + (parseFloat(style.columnGap) || 0)) / perView;
  goTo(slide, false);
}
function place(offset = 0) {
  track.style.transform = 'translate3d(' + (offset - slide * step) + 'px,0,0)';
}
function goTo(index, animate = true) {
  slide = Math.max(0, Math.min(lastSlide(), index));
  track.classList.toggle('arrastrando', !animate);
  place();
  const fits = lastSlide() === 0;
  railPrev.hidden = railNext.hidden = fits;
  railPrev.disabled = slide === 0;
  railNext.disabled = slide === lastSlide();
  dots.forEach((dot, k) => dot.setAttribute('aria-current', String(k === slide)));
  cards.forEach((card, k) => card.setAttribute('aria-hidden', String(k < slide || k >= slide + perView)));
  railCounter.textContent = fits ? '' : 'Tarjeta ' + (slide + 1) + ' de ' + cards.length;
}
railPrev.addEventListener('click', () => { goTo(slide - 1); if (railPrev.disabled) railNext.focus(); });
railNext.addEventListener('click', () => { goTo(slide + 1); if (railNext.disabled) railPrev.focus(); });
dots.forEach((dot, k) => dot.addEventListener('click', () => goTo(k)));
rail.addEventListener('keydown', event => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault(); goTo(slide + (event.key === 'ArrowRight' ? 1 : -1));
});
let pointer = null;
rail.addEventListener('pointerdown', event => {
  if (lastSlide() === 0 || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, dx: 0, dragging: false};
}, {passive: true});
rail.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const moveX = event.clientX - pointer.x, moveY = event.clientY - pointer.y;
  if (!pointer.dragging) {
    if (Math.abs(moveY) > 12 && Math.abs(moveY) > Math.abs(moveX)) { pointer = null; return; }
    if (Math.abs(moveX) < 8) return;
    pointer.dragging = true;
    track.classList.add('arrastrando');
    try { rail.setPointerCapture(event.pointerId); } catch {}
  }
  const atEdge = (slide === 0 && moveX > 0) || (slide === lastSlide() && moveX < 0);
  pointer.dx = atEdge ? moveX / 3 : moveX;
  place(pointer.dx);
}, {passive: true});
function endDrag(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  const {dx, dragging, t} = pointer;
  pointer = null;
  if (!dragging) return;
  const quick = Math.abs(dx) > 30 && event.timeStamp - t < 280;
  const direction = event.type === 'pointerup' && (Math.abs(dx) > step * .2 || quick) ? (dx < 0 ? 1 : -1) : 0;
  goTo(slide + direction);
}
rail.addEventListener('pointerup', endDrag, {passive: true});
rail.addEventListener('pointercancel', endDrag, {passive: true});
new ResizeObserver(measureRail).observe(rail);

// Que cada pestaña quepa entera, en cualquier pantalla: si algo no cabe, se quita lo secundario
// (primero lo marcado con data-prescindible="1", luego "2"…). Solo se mide al abrir y al cambiar de tamaño.
const panels = views.map(view => $('#panel-' + view));
const boxes = '.film-feature,.story-card,.project-art,.support-card,#support-form';
function overflows(panel) {
  const inner = panel.firstElementChild;
  if (inner.scrollHeight > inner.clientHeight || inner.scrollWidth > inner.clientWidth) return true;
  for (const box of panel.querySelectorAll(boxes)) if (box.getClientRects().length && box.scrollHeight > box.clientHeight) return true;
  return false;
}
function fit(panel) {
  const items = [...panel.querySelectorAll('[data-prescindible]')];
  const level = item => Number(item.dataset.prescindible);
  const hide = (item, on) => item.classList.toggle(item.hasAttribute('data-lector') ? 'recortado-lector' : 'recortado', on);
  items.forEach(item => hide(item, false));
  let reached = 0;
  for (const step of [...new Set(items.map(level))].sort((a, b) => a - b)) {
    if (!overflows(panel)) break;
    items.forEach(item => { if (level(item) === step) hide(item, true); });
    reached = step;
  }
  // Lo que se quitó antes de tiempo vuelve si ya cabe (del más importante al menos importante)
  for (const item of items.filter(item => level(item) < reached).sort((a, b) => level(b) - level(a))) {
    hide(item, false);
    if (overflows(panel)) hide(item, true);
  }
}
let fitFrame = 0;
function fitAll() { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(() => { panels.forEach(fit); measureRail(); }); }
new ResizeObserver(fitAll).observe($('.stage'));

function setDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const total = Math.round(seconds), text = Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  document.querySelectorAll('[data-duration]').forEach(element => { element.textContent = text; });
}
showView(viewFromHash() || 'pelicula', false);

// La película se abre encima de la portada, sin ir a otra página: el navegador de TikTok, en algunos móviles, no deja
// abrir /nuevo/ver/ («Abre este enlace en el navegador»). Misma emisión por trozos que /nuevo/ver/ (Safari la lee sola; el
// resto con hls.js) y el mp4 de respaldo. /nuevo/ver/ sigue existiendo para quien abra el enlace aparte.
const HLSJS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js';
const HLSJS_SRI = 'sha512-laeOywAR8veaLuF0pnbe9aXnZF0OhY25VdUkVgeRDUezc5IB1XVvqNYASMEVLh2nFvLEX/MStxGvpaNoVH6hRQ==';
let peliHls = 'https://media.bibliafilm.com/hls/clip13/pelicula.m3u8', peliMp4 = 'https://media.bibliafilm.com/pelicula-720.mp4?v=clip13';
let peliPreparada = false, hlsPeli = null;
const visor = $('#visor'), visorVideo = $('#visor-video');
function cargaHlsJs() {
  return new Promise((resolve, reject) => {
    if (window.Hls) return resolve();
    const s = document.createElement('script'); s.src = HLSJS; s.integrity = HLSJS_SRI; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = () => { s.remove(); reject(Error('hls.js')); }; document.head.append(s);
  });
}
function respaldoPeli() { if (hlsPeli) { hlsPeli.destroy(); hlsPeli = null; } visorVideo.src = peliMp4; visorVideo.play().catch(() => {}); }
// Si a los 8 s no ha echado a andar (algunos Android dicen que leen la emisión por trozos y se quedan cargando sin dar
// error), se pasa al mp4 de respaldo. Comentario de un espectador en TikTok, 27-sep: «no funciona la aplicación».
function vigilaArranque() {
  setTimeout(() => {
    if (!visor.hidden && visorVideo.currentTime < 0.3 && visorVideo.readyState < 3 && visorVideo.src !== peliMp4) respaldoPeli();
  }, 8000);
}
function abrePeli() {
  visor.hidden = false; $('#visor-cerrar').focus({preventScroll: true});
  if (!peliPreparada) {
    peliPreparada = true; vigilaArranque();
    // Recomendación oficial de hls.js (README): canPlayType dice «maybe» también en Chrome y Android, que luego no siempre
    // pueden; la emisión directa solo en Safari moderno (ManagedMediaSource) o en iPhones antiguos sin MediaSource.
    const nativo = visorVideo.canPlayType('application/vnd.apple.mpegurl') &&
      ('ManagedMediaSource' in window || !('MediaSource' in window));
    if (nativo) visorVideo.src = peliHls;
    else {
      cargaHlsJs().then(() => {
        if (!window.Hls.isSupported()) return respaldoPeli();
        hlsPeli = new window.Hls({capLevelToPlayerSize: true}); hlsPeli.on(window.Hls.Events.ERROR, (_, d) => { if (d.fatal) respaldoPeli(); });
        hlsPeli.loadSource(peliHls); hlsPeli.attachMedia(visorVideo); visorVideo.play().catch(() => {});
      }).catch(respaldoPeli);
      return;
    }
  }
  visorVideo.play().catch(() => {});
}
function cierraPeli() { visorVideo.pause(); visor.hidden = true; }
$('#film-link').addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;   // abrir aparte sigue funcionando
  event.preventDefault(); abrePeli();
});
$('#visor-cerrar').addEventListener('click', cierraPeli);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !visor.hidden) cierraPeli(); });
visorVideo.addEventListener('error', () => { if (!hlsPeli && visorVideo.src !== peliMp4) respaldoPeli(); });
window.addEventListener('pagehide', () => visorVideo.pause());

// Duration and the film's current sources come from episodios.json.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
fetch(sourceOrigin + '/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => {
  const movie = data.pelicula;
  if (!movie) return;
  if (movie.minutos) setDuration(Number(movie.minutos) * 60);
  if (peliPreparada) return;                    // una respuesta lenta nunca cambia una película ya en marcha
  const cdn = (data.cdn || 'https://media.bibliafilm.com').replace(/\/$/, '');
  const url = v => v ? new URL(/^https?:|^\//.test(v) ? v : cdn + '/' + v, sourceOrigin + '/') : null;
  const vale = u => u && ['https://bibliafilm.com', 'https://www.bibliafilm.com', 'https://media.bibliafilm.com'].includes(u.origin);
  const m3u8 = url(movie.video), mp4 = url(movie.mp4);
  if (vale(m3u8) && /\.m3u8(\?|$)/.test(m3u8.pathname)) peliHls = m3u8.href;
  if (vale(mp4) && /\.mp4(\?|$)/.test(mp4.pathname)) peliMp4 = mp4.href;
}).catch(() => {});

let amount = 5, paymentReady, previousFocus;
const euro = number => new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(number) ? 0 : 2, maximumFractionDigits: 2}).format(number);   // 5 €, 7,50 €
// Moneda de quien visita (functions/api/moneda.js, Vic 29-sep-2026: «en Colombia le aparece en euros»): los importes y
// el botón salen en su moneda y se paga en ella (Stripe nos ingresa en euros). ?moneda=cop la fuerza para probar.
let moneda = {moneda: 'eur', dec: 2, paso: .01, min: .5, max: 1000, importes: [3, 5, 10, 20]};
window.__moneda = moneda;
const money = number => moneda.moneda === 'eur' ? euro(number)
  : new Intl.NumberFormat('es-ES', {useGrouping: 'always', minimumFractionDigits: Number.isInteger(number) ? 0 : 2, maximumFractionDigits: 2}).format(number) + ' ' + moneda.moneda.toUpperCase();   // 20.000 COP
function applyCurrency(data) {
  moneda = data; window.__moneda = data;
  document.querySelectorAll('[data-amount]').forEach((button, i) => {
    const value = data.importes[i]; if (value == null) return;
    button.dataset.amount = String(value); button.setAttribute('aria-label', money(value));
    button.textContent = new Intl.NumberFormat('es-ES', {useGrouping: 'always'}).format(value);   // en el móvil solo cabe la cifra
  });
  const input = $('#custom-amount');
  input.min = String(data.min); input.max = String(data.max); input.step = String(data.paso); input.value = '';
  input.setAttribute('aria-label', 'Otra cantidad en ' + data.moneda.toUpperCase());
  if (input.nextElementSibling) input.nextElementSibling.textContent = data.moneda.toUpperCase();
  selectAmount(data.importes[1]);
}
const monedaForzada = (new URLSearchParams(location.search).get('moneda') || '').replace(/[^a-z]/gi, '').toLowerCase();
// se pide una sola vez, al acercarse al apoyo (no en cada visita), y el pago siempre la espera: nunca se cobra una cifra
// pensada en otra moneda
let monedaLista = null;
const pideMoneda = () => monedaLista || (monedaLista = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? Promise.resolve()
  : fetch('/api/moneda' + (monedaForzada ? '?m=' + monedaForzada : ''), {cache: 'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (data && data.moneda && data.moneda !== 'eur' && Array.isArray(data.importes) && data.importes.length) applyCurrency(data); })
    .catch(() => {}));
if (monedaForzada || !('IntersectionObserver' in window)) pideMoneda();
else {
  const vigia = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { vigia.disconnect(); pideMoneda(); } }, {rootMargin: '600px'});
  const tarjetaApoyo = document.querySelector('#support-form'); if (tarjetaApoyo) vigia.observe(tarjetaApoyo); else pideMoneda();
}
function toast(text) {
  const element = $('#toast'); element.textContent = text; element.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('visible'), 3500);
}
function selectAmount(number) {
  amount = number;
  document.querySelectorAll('[data-amount]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.amount) === number && !$('#custom-amount').value)));
  $('#support-label').textContent = Number.isFinite(number) && number >= moneda.min && number <= moneda.max ? 'Continuar con ' + money(number) : 'Elige una cantidad';
}
document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => { $('#custom-amount').value = ''; selectAmount(Number(button.dataset.amount)); }));
$('#custom-amount').addEventListener('input', event => selectAmount(event.target.value ? Number(event.target.value) : moneda.importes[1]));
const dialog = $('#payment-dialog');
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { $('#acepto').checked = false; if ($('#agradecer')) { $('#agradecer').checked = false; $('#nombre-agradecer').hidden = true; $('#tiktok-agradecer').hidden = true; } previousFocus?.focus({preventScroll: true}); });
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error('No se ha podido conectar con el servicio de pago.')); };
    document.head.append(script);
  });
}
async function preparePayment() {
  await pideMoneda();
  if (!window.Stripe) await loadScript('https://js.stripe.com/v3/');
  await loadScript('/nuevo/apoyo.js?v=1790966580');
}
$('#support-form').addEventListener('submit', async event => {
  event.preventDefault();
  await pideMoneda();
  const custom = $('#custom-amount');
  if (!Number.isFinite(amount) || amount < moneda.min || amount > moneda.max) {
    custom.setCustomValidity('Elige una cantidad entre ' + money(moneda.min) + ' y ' + money(moneda.max) + '.'); custom.reportValidity(); custom.setCustomValidity(''); return;
  }
  amount = moneda.paso >= 1 ? Math.round(amount) : Math.round(amount * 100) / 100; previousFocus = document.activeElement;
  $('#payment-amount').textContent = money(amount);
  dialog.showModal();
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    $('#payment-loading').textContent = 'Vista de prueba: los pagos se activan únicamente en bibliafilm.com.'; return;
  }
  try {
    if (!paymentReady) paymentReady = preparePayment().catch(error => { paymentReady = null; throw error; });
    await paymentReady;
    $('#payment-loading').hidden = true; $('#payment-content').hidden = false;
    const preset = $('#importes [data-v="' + amount + '"]');
    if (preset) preset.click();
    else { $('#otro').value = String(amount); $('#otro').dispatchEvent(new Event('input', {bubbles: true})); }
    if (dialog.open) $('#apoyar').click();
  } catch (error) { $('#payment-loading').textContent = error.message + ' Puedes volver a intentarlo cerrando esta ventana.'; }
});
$('#share-project').addEventListener('click', async () => {
  const url = 'https://bibliafilm.com/';
  if (navigator.share) {
    try { await navigator.share({title: 'Biblia Film · La Biblia, hecha cine', text: 'Mira Génesis gratis y ayuda a crear lo que viene.', url}); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado. Gracias por compartirlo.'); }
  catch { toast('Puedes compartir la dirección de esta página.'); }
});

// iPhone: Safari cambia el alto visible al abrir/cerrar el teclado o plegar sus barras, y a veces deja la página
// corrida hacia arriba (se esconde la cabecera y queda un hueco bajo las pestañas). La app se ajusta siempre al
// alto que de verdad se ve y, si no se está escribiendo, vuelve a su sitio.
(() => {
  const vv = window.visualViewport;
  const escribiendo = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  let pendiente = 0;
  function encaja() {
    pendiente = 0;
    const alto = vv ? vv.height * vv.scale : window.innerHeight;
    if (alto > 200) document.documentElement.style.setProperty('--alto', Math.round(alto) + 'px');
    if (!escribiendo() && (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop)) {
      window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
    }
  }
  const luego = () => { if (!pendiente) pendiente = requestAnimationFrame(encaja); };
  vv?.addEventListener('resize', luego);
  vv?.addEventListener('scroll', luego);
  window.addEventListener('resize', luego);
  window.addEventListener('pageshow', luego);
  window.addEventListener('orientationchange', () => setTimeout(encaja, 300));
  document.addEventListener('focusout', () => setTimeout(encaja, 80));   // al cerrar el teclado
  encaja();
})();
