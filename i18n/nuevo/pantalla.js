'use strict';
const $ = selector => document.querySelector(selector);

// Idioma de la página, de <html lang>: es (bibliafilm.com/), en (/en/) o pt (/pt/). Los textos de esta JS salen en
// español; las copias /en/ y /pt/ (las genera 10-idiomas/web-i18n/construir.py) traen los suyos en
// <script type="application/json" id="textos">, que sustituyen a estos. La portada española no lleva ese bloque: lee igual que siempre.
const LANG = (/^(en|pt)\b/i.exec(document.documentElement.lang || '') || ['es'])[0].toLowerCase();
const LOCALE = {es: 'es-ES', en: 'en-US', pt: 'pt-BR'}[LANG];
const T = Object.assign({
  tarjetaDe: 'Tarjeta {n} de {total}',
  otraCantidadEn: 'Otra cantidad en {moneda}',
  continuarCon: 'Continuar con {importe}',
  eligeCantidad: 'Elige una cantidad',
  sinConexionPago: 'No se ha podido conectar con el servicio de pago.',
  cantidadEntre: 'Elige una cantidad entre {min} y {max}.',
  vistaPrueba: 'Vista de prueba: los pagos se activan únicamente en bibliafilm.com.',
  entornoPruebas: 'Entorno de pruebas: pagos desactivados',
  reintentar: '{error} Puedes volver a intentarlo cerrando esta ventana.',
  compartirUrl: 'https://bibliafilm.com/',
  compartirTitulo: 'Biblia Film · La Biblia, hecha cine',
  compartirTexto: 'Mira Génesis gratis y ayuda a crear lo que viene.',
  enlaceCopiado: 'Enlace copiado. Gracias por compartirlo.',
  compartirDireccion: 'Puedes compartir la dirección de esta página.'
}, (() => { try { return JSON.parse($('#textos')?.textContent || '{}'); } catch { return {}; } })());
const t = (key, values = {}) => String(T[key] ?? '').replace(/\{(\w+)\}/g, (all, name) => name in values ? values[name] : all);
// Entorno de pruebas (vista previa de Cloudflare Pages, *.pages.dev): nunca se monta el pago.
const PRUEBAS = /\.pages\.dev$/i.test(location.hostname);

// Selector de idioma (ES · EN · PT): guarda la elección en la cookie «idioma» (la lee functions/index.js al entrar por
// bibliafilm.com/) y conserva la pestaña abierta (#apoyar…). Entrar por /en/ o /pt/ también la guarda: esa puerta manda.
// Las pastillas de la portada van a bibliafilm.com/?idioma=es|en|pt: la puerta guarda la cookie desde el servidor (dura un
// año también en Safari, que borra a los 7 días las que escribe la JS) y lleva a /, /en/ o /pt/; sin JS funcionan igual.
function guardaIdioma(lang) {
  try { document.cookie = 'idioma=' + lang + '; Path=/; Max-Age=31536000; SameSite=Lax; Secure'; } catch {}
}
if (LANG !== 'es') guardaIdioma(LANG);
document.querySelectorAll('.idiomas a[data-idioma]').forEach(link => link.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
  event.preventDefault();
  guardaIdioma(link.dataset.idioma);
  if (link.dataset.idioma === LANG) return;
  let destino = link.getAttribute('href').split('#')[0];
  // en local (python -m http.server) no hay puerta: directo a la portada del idioma
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) destino = destino.replace(/^\/\?idioma=(es|en|pt)$/, (all, l) => l === 'es' ? '/' : '/' + l + '/');
  location.href = destino + location.hash;   // la redirección de la puerta conserva el #apoyar…
}));

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
  railCounter.textContent = fits ? '' : t('tarjetaDe', {n: slide + 1, total: cards.length});
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
// Película de cada idioma. Manda episodios.json: «pelicula» es la española; «peliculas.en» y «.pt» solo cuentan si dicen
// "publicada": true (se marca cuando su película ya está subida al almacén). Estos son los valores de reserva por si
// episodios.json no llega: publicar.sh reescribe la española (hls/clipN/, ?v=clipN); en y pt, null (sin película propia
// se ve la española) hasta que tengan sus direcciones definitivas.
const PELIS = {
  es: {hls: 'https://media.bibliafilm.com/hls/clip15/pelicula.m3u8', mp4: 'https://media.bibliafilm.com/pelicula-720.mp4?v=clip15'},
  en: null,
  pt: null
};
let peliHls = PELIS.es.hls, peliMp4 = PELIS.es.mp4, mp4Es = PELIS.es.mp4;
// peliPreparada: la película ya se ha cargado en el visor (desde ahí nada la cambia). peliElegida: ya se sabe cuál toca (en
// /en/ y /pt/, al leer episodios.json). peliPropia: la elegida es la del idioma de la página, no la española.
let peliPreparada = false, peliElegida = LANG === 'es', peliPropia = false, hlsPeli = null, esperandoPeli = null;
const visor = $('#visor'), visorVideo = $('#visor-video');
// Aviso «Audio en español» de /en/ y /pt/ (lo pone construir.py junto a la duración; la portada española no lo lleva)
function audioEspanol(si) {
  let cambia = false;
  document.querySelectorAll('[data-audio-es]').forEach(element => { if (element.hidden === si) { element.hidden = !si; cambia = true; } });
  if (cambia) fitAll();
}
function cargaHlsJs() {
  return new Promise((resolve, reject) => {
    if (window.Hls) return resolve();
    const s = document.createElement('script'); s.src = HLSJS; s.integrity = HLSJS_SRI; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = () => { s.remove(); reject(Error('hls.js')); }; document.head.append(s);
  });
}
function respaldoPeli() {
  if (hlsPeli) { hlsPeli.destroy(); hlsPeli = null; }
  if (LANG !== 'es' && peliMp4 === mp4Es) { peliPropia = false; audioEspanol(true); }   // el respaldo es el mp4 español
  visorVideo.src = peliMp4; visorVideo.play().catch(() => {});
}
// Si a los 8 s no ha echado a andar (algunos Android dicen que leen la emisión por trozos y se quedan cargando sin dar
// error), se pasa al mp4 de respaldo. Comentario de un espectador en TikTok, 27-sep: «no funciona la aplicación».
function vigilaArranque() {
  setTimeout(() => {
    if (!visor.hidden && visorVideo.currentTime < 0.3 && visorVideo.readyState < 3 && visorVideo.src !== peliMp4) respaldoPeli();
  }, 8000);
}
function abrePeli() {
  visor.hidden = false; $('#visor-cerrar').focus({preventScroll: true});
  if (peliPreparada) { visorVideo.play().catch(() => {}); return; }
  if (peliElegida) { arrancaPeli(); return; }
  // /en/ o /pt/ antes de saber si su película está publicada (episodios.json aún no ha llegado): se espera esa respuesta,
  // como mucho 1,5 s, para no abrir la española por haber tocado deprisa. Si se cierra el visor mientras, no arranca.
  if (!esperandoPeli) esperandoPeli = Promise.race([eleccion, new Promise(resolve => setTimeout(resolve, 1500))])
    .then(() => { esperandoPeli = null; if (!visor.hidden && !peliPreparada) arrancaPeli(); });
}
function arrancaPeli() {
  peliPreparada = true; vigilaArranque();
  // Recomendación oficial de hls.js (README): canPlayType dice «maybe» también en Chrome y Android, que luego no siempre
  // pueden; la emisión directa solo en Safari moderno (ManagedMediaSource) o en iPhones antiguos sin MediaSource.
  const nativo = visorVideo.canPlayType('application/vnd.apple.mpegurl') &&
    ('ManagedMediaSource' in window || !('MediaSource' in window));
  if (nativo) { visorVideo.src = peliHls; visorVideo.play().catch(() => {}); return; }
  cargaHlsJs().then(() => {
    if (!window.Hls.isSupported()) return respaldoPeli();
    hlsPeli = new window.Hls({capLevelToPlayerSize: true}); hlsPeli.on(window.Hls.Events.ERROR, (_, d) => { if (d.fatal) respaldoPeli(); });
    hlsPeli.loadSource(peliHls); hlsPeli.attachMedia(visorVideo); visorVideo.play().catch(() => {});
  }).catch(respaldoPeli);
}
function cierraPeli() { visorVideo.pause(); visor.hidden = true; }
$('#film-link').addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;   // abrir aparte sigue funcionando
  event.preventDefault(); abrePeli();
});
$('#visor-cerrar').addEventListener('click', cierraPeli);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !visor.hidden) cierraPeli(); });
visorVideo.addEventListener('error', () => {
  if (!hlsPeli && visorVideo.src !== peliMp4) respaldoPeli();
  else if (!hlsPeli && peliMp4 !== mp4Es) { peliMp4 = mp4Es; respaldoPeli(); }   // tampoco responde la del idioma: la española (con su aviso)
});
window.addEventListener('pagehide', () => visorVideo.pause());

// Duration and the film's current sources come from episodios.json.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
// Una entrada de episodios.json ({video, mp4, minutos}) resuelta contra el almacén. Solo se acepta una emisión .m3u8 y una
// reserva .mp4 de bibliafilm.com (también las de en/ y pt/ de los otros idiomas).
function fuentesDe(movie, cdn) {
  const url = v => v ? new URL(/^https?:|^\//.test(v) ? v : cdn + '/' + v, sourceOrigin + '/') : null;
  const vale = u => u && ['https://bibliafilm.com', 'https://www.bibliafilm.com', 'https://media.bibliafilm.com'].includes(u.origin);
  const m3u8 = url(movie.video), mp4 = url(movie.mp4);
  return {hls: vale(m3u8) && /\.m3u8(\?|$)/.test(m3u8.pathname) ? m3u8.href : null, mp4: vale(mp4) && /\.mp4(\?|$)/.test(mp4.pathname) ? mp4.href : null};
}
// Qué película toca. En /en/ y /pt/ basta con episodios.json (sin comprobar el almacén, que costaría otra espera): si da
// la del idioma por publicada, esa; si luego no respondiera, el reproductor pasa a su mp4 y, si tampoco, a la española.
const eleccion = fetch(sourceOrigin + '/i18n/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => data, () => null).then(data => {
  const cdn = ((data && data.cdn) || 'https://media.bibliafilm.com').replace(/\/$/, '');
  const pelis = (data && data.peliculas) || {};
  // la española: «pelicula» (la que mantienen terminar-clip.py y publicar.sh), igual a peliculas.es
  const movie = data && (data.pelicula || pelis.es);
  if (LANG === 'es') {
    if (!movie) return;
    if (movie.minutos) setDuration(Number(movie.minutos) * 60);
    if (peliPreparada) return;                    // una respuesta lenta nunca cambia una película ya en marcha
    const f = fuentesDe(movie, cdn);
    if (f.hls) peliHls = f.hls;
    if (f.mp4) peliMp4 = mp4Es = f.mp4;
    return;
  }
  // Otro idioma: su película si episodios.json la da por publicada (si no llega, la de reserva de PELIS); si no, la española.
  const propia = data ? (pelis[LANG] && pelis[LANG].publicada === true ? pelis[LANG] : null)
    : PELIS[LANG] && {video: PELIS[LANG].hls, mp4: PELIS[LANG].mp4};
  const es = movie ? fuentesDe(movie, cdn) : {}, f = propia ? fuentesDe(propia, cdn) : {};
  if (!peliPreparada) {                           // una respuesta lenta nunca cambia una película ya en marcha
    if (es.hls) peliHls = es.hls;
    if (es.mp4) peliMp4 = mp4Es = es.mp4;
    if (f.hls) { peliHls = f.hls; if (f.mp4) peliMp4 = f.mp4; peliPropia = true; }
  }
  audioEspanol(!peliPropia);
  const minutos = Number(peliPropia ? propia.minutos || (movie && movie.minutos) : movie && movie.minutos);
  if (minutos) setDuration(minutos * 60);
}).catch(() => {}).finally(() => { peliElegida = true; });

let amount = 5, paymentReady, previousFocus;
const euro = number => new Intl.NumberFormat(LOCALE, {style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(number) ? 0 : 2, maximumFractionDigits: 2}).format(number);   // 5 €, 7,50 € (en: €5, €7.50; pt: € 5)
// Moneda de quien visita (functions/api/moneda.js, Vic 29-sep-2026: «en Colombia le aparece en euros»): los importes y
// el botón salen en su moneda y se paga en ella (Stripe nos ingresa en euros). ?moneda=cop la fuerza para probar.
let moneda = {moneda: 'eur', dec: 2, paso: .01, min: .5, max: 1000, importes: [3, 5, 10, 20]};
window.__moneda = moneda;
const money = number => moneda.moneda === 'eur' ? euro(number)
  : LANG === 'es' ? new Intl.NumberFormat('es-ES', {useGrouping: 'always', minimumFractionDigits: Number.isInteger(number) ? 0 : 2, maximumFractionDigits: 2}).format(number) + ' ' + moneda.moneda.toUpperCase()   // 20.000 COP
  : new Intl.NumberFormat(LOCALE, {style: 'currency', currency: moneda.moneda.toUpperCase(), minimumFractionDigits: Number.isInteger(number) ? 0 : 2, maximumFractionDigits: 2}).format(number);   // $5, R$ 20, COP 20,000
function applyCurrency(data) {
  moneda = data; window.__moneda = data;
  document.querySelectorAll('[data-amount]').forEach((button, i) => {
    const value = data.importes[i]; if (value == null) return;
    button.dataset.amount = String(value); button.setAttribute('aria-label', money(value));
    button.textContent = new Intl.NumberFormat(LOCALE, {useGrouping: 'always'}).format(value);   // en el móvil solo cabe la cifra
  });
  const input = $('#custom-amount');
  input.min = String(data.min); input.max = String(data.max); input.step = String(data.paso); input.value = '';
  input.setAttribute('aria-label', t('otraCantidadEn', {moneda: data.moneda.toUpperCase()}));
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
  $('#support-label').textContent = Number.isFinite(number) && number >= moneda.min && number <= moneda.max ? t('continuarCon', {importe: money(number)}) : T.eligeCantidad;
}
document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => { $('#custom-amount').value = ''; selectAmount(Number(button.dataset.amount)); }));
$('#custom-amount').addEventListener('input', event => selectAmount(event.target.value ? Number(event.target.value) : moneda.importes[1]));
const dialog = $('#payment-dialog');
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { $('#acepto').checked = false; if ($('#agradecer')) { $('#agradecer').checked = false; $('#nombre-agradecer').hidden = true; $('#tiktok-agradecer').hidden = true; } previousFocus?.focus({preventScroll: true}); });
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error(T.sinConexionPago)); };
    document.head.append(script);
  });
}
async function preparePayment() {
  await pideMoneda();
  if (!window.Stripe) await loadScript('https://js.stripe.com/v3/');
  await loadScript('/i18n/nuevo/apoyo.js?v=1791024010');
}
$('#support-form').addEventListener('submit', async event => {
  event.preventDefault();
  await pideMoneda();
  const custom = $('#custom-amount');
  if (!Number.isFinite(amount) || amount < moneda.min || amount > moneda.max) {
    custom.setCustomValidity(t('cantidadEntre', {min: money(moneda.min), max: money(moneda.max)})); custom.reportValidity(); custom.setCustomValidity(''); return;
  }
  amount = moneda.paso >= 1 ? Math.round(amount) : Math.round(amount * 100) / 100; previousFocus = document.activeElement;
  $('#payment-amount').textContent = money(amount);
  dialog.showModal();
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    $('#payment-loading').textContent = T.vistaPrueba; return;
  }
  // vista previa *.pages.dev: ni Stripe ni cobros (la clave publicable es la real)
  if (PRUEBAS) { $('#payment-loading').textContent = T.entornoPruebas; return; }
  try {
    if (!paymentReady) paymentReady = preparePayment().catch(error => { paymentReady = null; throw error; });
    await paymentReady;
    $('#payment-loading').hidden = true; $('#payment-content').hidden = false;
    const preset = $('#importes [data-v="' + amount + '"]');
    if (preset) preset.click();
    else { $('#otro').value = String(amount); $('#otro').dispatchEvent(new Event('input', {bubbles: true})); }
    if (dialog.open) $('#apoyar').click();
  } catch (error) { $('#payment-loading').textContent = t('reintentar', {error: error.message}); }
});
$('#share-project').addEventListener('click', async () => {
  const url = T.compartirUrl;
  if (navigator.share) {
    try { await navigator.share({title: T.compartirTitulo, text: T.compartirTexto, url}); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast(T.enlaceCopiado); }
  catch { toast(T.compartirDireccion); }
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
