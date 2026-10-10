'use strict';
// Medición propia y mínima: solo página abierta y botón de Amazon pulsado.
// No lee ni escribe cookies/almacenamiento; no envía URL, país ni datos del visitante.
function countBookEvent(event) {
  if (!['bibliafilm.com', 'www.bibliafilm.com'].includes(location.hostname)) return;
  try {
    fetch('/api/libros-contador', {
      method:'POST', body:event, credentials:'omit', mode:'cors',
      cache:'no-store', keepalive:true, referrerPolicy:'no-referrer'
    }).catch(() => {});
  } catch { /* La compra continúa aunque no se pueda medir. */ }
}
let bookVisitCounted = false;
function countVisibleBookVisit() {
  if (bookVisitCounted || document.visibilityState !== 'visible') return;
  bookVisitCounted = true;
  countBookEvent('visita');
  document.removeEventListener('visibilitychange', countVisibleBookVisit);
}
document.addEventListener('visibilitychange', countVisibleBookVisit);
countVisibleBookVisit();
const offers = document.getElementById('offers');
const validCountries = new Set('INT ES MX GT EC AR BZ BO BR CL CO CR SV US HT HN NI PA PY PE PR DO UY VE'.split(' '));
let detectedCountry = document.documentElement.dataset.country || 'INT';
const markets = {
  ES: {store: 'amazon.es', name: 'Amazon España', price: '2,69 €'},
  MX: {store: 'amazon.com.mx', name: 'Amazon México', price: '34,99 MXN'},
  BR: {store: 'amazon.com.br', name: 'Amazon Brasil', price: 'R$ 5,99'}
};
// Precios rebajados verificados en las cuatro fichas de Amazon el 9 de octubre de 2026.
// Son importes configurados aquí, sin sincronización automática con Amazon.
let serverOffer;
try { serverOffer = JSON.parse(document.documentElement.dataset.offer || 'null'); } catch {}
const storeConnection = document.createElement('link');
storeConnection.rel = 'preconnect';
document.head.append(storeConnection);
function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function updateOffers() {
  const code = validCountries.has(detectedCountry) ? detectedCountry : 'INT';
  const market = serverOffer || markets[code] || {store:'amazon.com', name:'Amazon.com', price:'2,99 USD'};
  const prices = make('dl', code === 'ES' ? 'format-options' : 'format-options single-format');
  function priceCard(name, detail, price) {
    const card = make('div', 'format-card');
    const label = make('dt', '', name);
    label.append(make('small', '', detail));
    card.append(label, make('dd', '', price));
    prices.append(card);
  }
  if (code === 'ES') priceCard('En papel', 'Tapa blanda', '15,49 €');
  priceCard('Digital', 'Edición Kindle', market.price);
  const link = make('a', 'buy-link');
  link.href = market.url || `https://www.${market.store}/dp/B0HM5JGYSD`;
  const storeOrigin = new URL(link.href).origin;
  if (storeConnection.href !== storeOrigin + '/') storeConnection.href = storeOrigin;
  const arrow = make('span', 'arrow', '→');
  arrow.setAttribute('aria-hidden','true');
  link.append(make('span', '', 'Comprar en Amazon'), arrow);
  offers.replaceChildren(prices, link);
}
function syncUrl() {
  const url = new URL(location.href);
  // Un enlace compartido debe detectar el país de quien lo abre.
  url.searchParams.delete('pais');
  history.replaceState(null, '', url);
}
offers.addEventListener('click', event => {
  const buyLink = event.target.closest('.buy-link');
  if (buyLink) {
    countBookEvent('amazon');
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.button) {
      buyLink.firstElementChild.textContent = 'Abriendo Amazon…';
      buyLink.setAttribute('aria-busy', 'true');
    }
    return;
  }
});
offers.addEventListener('auxclick', event => {
  if (event.button === 1 && event.target.closest('.buy-link')) countBookEvent('amazon');
});
syncUrl();
updateOffers();
window.addEventListener('pageshow', updateOffers);
// En producción el país llega en el propio HTML, sin peticiones ni permisos adicionales.
// El respaldo mantiene la detección automática si se sirve el HTML sin personalizar.
if (!document.documentElement.dataset.country) {
  fetch('/api/moneda', {cache: 'no-store'}).then(response => response.ok ? response.json() : null).then(data => {
    if (!data || !validCountries.has(data.pais)) return;
    detectedCountry = data.pais;
    updateOffers();
  }).catch(() => {});
}
const slider = document.getElementById('page-slider');
const slides = [...slider.querySelectorAll('.sample-slide')];
const previous = document.getElementById('previous-page');
const next = document.getElementById('next-page');
const dots = [...document.querySelectorAll('[data-slide]')];
const caption = document.getElementById('page-caption');
let sampleIndex = 0;
let scrollFrame;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const positionFor = index => slides[index].offsetLeft - slides[0].offsetLeft;
function setActive(index) {
  sampleIndex = index;
  previous.disabled = index === 0;
  next.disabled = index === slides.length - 1;
  dots.forEach((dot, i) => {
    if (i === index) dot.setAttribute('aria-current','true');
    else dot.removeAttribute('aria-current');
  });
  const title = slides[index].dataset.title;
  if (caption.textContent !== title) caption.textContent = title;
}
function showSample(index) {
  const target = Math.max(0, Math.min(slides.length - 1, index));
  slider.scrollTo({left:positionFor(target), behavior:reducedMotion.matches ? 'instant' : 'smooth'});
}
slider.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    let nearest = 0;
    slides.forEach((slide, index) => {
      if (Math.abs(positionFor(index) - slider.scrollLeft) < Math.abs(positionFor(nearest) - slider.scrollLeft)) nearest = index;
    });
    setActive(nearest);
  });
}, {passive:true});
dots.forEach(dot => dot.addEventListener('click', () => showSample(Number(dot.dataset.slide))));
previous.addEventListener('click', () => showSample(sampleIndex - 1));
next.addEventListener('click', () => showSample(sampleIndex + 1));
slider.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') {event.preventDefault(); showSample(sampleIndex + 1);}
  if (event.key === 'ArrowLeft') {event.preventDefault(); showSample(sampleIndex - 1);}
  if (event.key === 'Home') {event.preventDefault(); showSample(0);}
  if (event.key === 'End') {event.preventDefault(); showSample(slides.length - 1);}
});
