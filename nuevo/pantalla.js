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

// Only duration is fetched here. The player lives on its own page.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
fetch(sourceOrigin + '/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => {
  const movie = data.pelicula;
  if (!movie) return;
  if (movie.minutos) setDuration(Number(movie.minutos) * 60);
}).catch(() => {});

let amount = 5, paymentReady, previousFocus;
const euro = number => new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR', maximumFractionDigits: 2}).format(number);
function toast(text) {
  const element = $('#toast'); element.textContent = text; element.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('visible'), 3500);
}
function selectAmount(number) {
  amount = number;
  document.querySelectorAll('[data-amount]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.amount) === number && !$('#custom-amount').value)));
  $('#support-label').textContent = Number.isFinite(number) && number >= .5 && number <= 1000 ? 'Continuar con ' + euro(number) : 'Elige una cantidad';
}
document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => { $('#custom-amount').value = ''; selectAmount(Number(button.dataset.amount)); }));
$('#custom-amount').addEventListener('input', event => selectAmount(event.target.value ? Number(event.target.value) : 5));
const dialog = $('#payment-dialog');
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { $('#acepto').checked = false; previousFocus?.focus({preventScroll: true}); });
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error('No se ha podido conectar con el servicio de pago.')); };
    document.head.append(script);
  });
}
async function preparePayment() {
  if (!window.Stripe) await loadScript('https://js.stripe.com/v3/');
  await loadScript('/nuevo/apoyo.js?v=1790515616');
}
$('#support-form').addEventListener('submit', async event => {
  event.preventDefault();
  const custom = $('#custom-amount');
  if (!Number.isFinite(amount) || amount < .5 || amount > 1000) {
    custom.setCustomValidity('Elige una cantidad entre 0,50 € y 1.000 €.'); custom.reportValidity(); custom.setCustomValidity(''); return;
  }
  amount = Math.round(amount * 100) / 100; previousFocus = document.activeElement;
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
