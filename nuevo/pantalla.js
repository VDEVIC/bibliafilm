'use strict';
const $ = selector => document.querySelector(selector);
const video = $('#film');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mayAutoplay = !reduceMotion.matches && !navigator.connection?.saveData;
const views = ['pelicula', 'proyecto', 'apoyar'];
let activeView = 'pelicula', videoVisible = true, resumeWhenVisible = false;
let filmPrepared = false;

function prepareFilm() {
  if (filmPrepared) return;
  filmPrepared = true;
  const smallScreen = matchMedia('(max-width: 850px)').matches || navigator.connection?.saveData;
  video.src = smallScreen ? '/nuevo/assets/genesis-ligero.mp4?v=3' : '/nuevo/assets/genesis-movil.mp4?v=2';
  video.preload = mayAutoplay ? 'metadata' : 'none';
  if (mayAutoplay) video.play().catch(() => {});
}

function pauseForVisibility() {
  if (!video.paused) { resumeWhenVisible = true; video.pause(); }
}
function resumeVideo() {
  if (resumeWhenVisible && activeView === 'pelicula' && videoVisible && !document.hidden) {
    resumeWhenVisible = false;
    video.play().catch(() => {});
  }
}
function viewFromHash() {
  const hash = location.hash.slice(1);
  return hash === 'aportacion' || hash === 'apoyar-proyecto' ? 'apoyar' : views.includes(hash) ? hash : 'pelicula';
}
function showView(name, updateURL = true, resetScroll = true) {
  if (!views.includes(name)) return;
  if (name !== 'pelicula') pauseForVisibility();
  activeView = name;
  for (const view of views) {
    const selected = name === view;
    $('#panel-' + view).hidden = !selected;
    const tab = $('#tab-' + view);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  if (updateURL && location.hash !== '#' + name) history.pushState(null, '', '#' + name);
  if (resetScroll) window.scrollTo({top: 0, behavior: 'instant'});
  if (name === 'pelicula') { measureRail(); prepareFilm(); resumeVideo(); }
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  showView(button.dataset.view);
  $('#tab-' + button.dataset.view).focus({preventScroll: true});
}));
$('.view-tabs').addEventListener('keydown', event => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = views.indexOf(activeView);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
  showView(views[next]);
  $('#tab-' + views[next]).focus({preventScroll: true});
});
window.addEventListener('popstate', () => showView(viewFromHash(), false));
window.addEventListener('hashchange', () => {
  if ([...views, 'aportacion', 'apoyar-proyecto'].includes(location.hash.slice(1)) && activeView !== viewFromHash()) showView(viewFromHash(), false);
});

// Native scrolling keeps the horizontal cards on the browser's scrolling path.
const rail = $('#story-rail');
const cards = [...rail.children];
const railCounter = $('#rail-counter'), railPrev = $('#rail-prev'), railNext = $('#rail-next'), railHint = $('#rail-hint');
let railMax = 0, railStep = 1, railState = '', railTimer;
function measureRail() {
  const width = rail.clientWidth;
  if (!width) return;
  railMax = rail.scrollWidth - width;
  railStep = cards[1].offsetLeft - cards[0].offsetLeft;
  updateRail();
}
function updateRail() {
  const left = rail.scrollLeft, fits = railMax <= 2, first = left <= 2, last = left >= railMax - 2;
  const current = fits || last ? cards.length : Math.min(cards.length, Math.round(left / railStep) + 1);
  const state = [fits, first, last, current].join(':');
  if (state === railState) return;
  railState = state;
  railCounter.textContent = fits ? '3 ideas' : current + ' / ' + cards.length;
  railPrev.disabled = first; railNext.disabled = last;
  railPrev.hidden = fits; railNext.hidden = fits;
  railHint.textContent = fits ? 'Palabra, creación y comunidad.' : 'Desliza para descubrir más';
}
function scrollRail(direction) {
  rail.scrollBy({left: railStep * direction, behavior: reduceMotion.matches ? 'instant' : 'smooth'});
}
$('#rail-prev').addEventListener('click', () => scrollRail(-1));
$('#rail-next').addEventListener('click', () => scrollRail(1));
rail.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); scrollRail(event.key === 'ArrowRight' ? 1 : -1);
  }
});
if ('onscrollend' in rail) rail.addEventListener('scrollend', updateRail, {passive: true});
else rail.addEventListener('scroll', () => { clearTimeout(railTimer); railTimer = setTimeout(updateRail, 160); }, {passive: true});
new ResizeObserver(measureRail).observe(rail);

function updateSound() {
  $('#sound-toggle').setAttribute('aria-pressed', String(!video.muted));
  $('#sound-label').textContent = video.muted ? 'Activar sonido' : 'Silenciar';
}
$('#sound-toggle').addEventListener('click', () => {
  video.muted = !video.muted;
  updateSound();
  if (video.paused) video.play().catch(() => { $('#film-error').hidden = false; });
});
video.addEventListener('volumechange', updateSound);
video.addEventListener('playing', () => {
  $('#film-error').hidden = true;
  if (activeView !== 'pelicula' || !videoVisible || document.hidden) pauseForVisibility();
});
video.addEventListener('ended', () => { resumeWhenVisible = false; });
video.addEventListener('error', () => { $('#film-error').hidden = false; });
new IntersectionObserver(entries => {
  videoVisible = entries[0].isIntersecting;
  if (!videoVisible) pauseForVisibility(); else resumeVideo();
}, {threshold: 0.1}).observe(video);
document.addEventListener('visibilitychange', () => document.hidden ? pauseForVisibility() : resumeVideo());
function setDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const total = Math.round(seconds), text = Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  document.querySelectorAll('[data-duration]').forEach(element => { element.textContent = text; });
}
video.addEventListener('loadedmetadata', () => setDuration(video.duration));
showView(viewFromHash(), false, false);

// Keep new films discoverable without reloading the already playing, optimized film.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
fetch(sourceOrigin + '/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => {
  const movie = data.pelicula;
  if (!movie) return;
  const validURL = value => {
    const url = new URL(value, sourceOrigin + '/');
    if (!['https://bibliafilm.com', 'https://media.bibliafilm.com'].includes(url.origin)) throw Error('Origen de vídeo no permitido');
    return url.href;
  };
  if (movie.video) {
    const source = validURL(/^https?:|^\//.test(movie.video) ? movie.video : (data.cdn || sourceOrigin + '/media').replace(/\/$/, '') + '/' + movie.video);
    if (source !== 'https://media.bibliafilm.com/pelicula.mp4?v=clip8' && source !== video.src) {
      // An unoptimized future upload must not start a large background download.
      video.pause();
      resumeWhenVisible = false;
      filmPrepared = true;
      video.autoplay = false;
      video.preload = 'none';
      video.src = source;
    }
  }
  if (movie.poster) {
    const poster = validURL(movie.poster);
    if (poster !== video.poster) video.poster = poster;
  }
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
dialog.addEventListener('close', () => { document.body.style.overflow = ''; $('#acepto').checked = false; previousFocus?.focus({preventScroll: true}); });
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error('No se ha podido conectar con el servicio de pago.')); };
    document.head.append(script);
  });
}
async function preparePayment() {
  if (!window.Stripe) await loadScript('https://js.stripe.com/v3/');
  await loadScript('/nuevo/apoyo.js?v=2');
}
$('#support-form').addEventListener('submit', async event => {
  event.preventDefault();
  const custom = $('#custom-amount');
  if (!Number.isFinite(amount) || amount < .5 || amount > 1000) {
    custom.setCustomValidity('Elige una cantidad entre 0,50 € y 1.000 €.'); custom.reportValidity(); custom.setCustomValidity(''); return;
  }
  amount = Math.round(amount * 100) / 100; previousFocus = document.activeElement;
  dialog.showModal(); document.body.style.overflow = 'hidden';
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
  const url = 'https://bibliafilm.com/nuevo';
  if (navigator.share) {
    try { await navigator.share({title: 'Biblia Film · La Biblia, hecha cine', text: 'Mira Génesis gratis y ayuda a crear lo que viene.', url}); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado. Gracias por compartirlo.'); }
  catch { toast('Puedes compartir la dirección de esta página.'); }
});
