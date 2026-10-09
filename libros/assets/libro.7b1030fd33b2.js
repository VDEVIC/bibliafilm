'use strict';
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
  const code = detectedCountry;
  offers.replaceChildren();
  if (!validCountries.has(code)) {
    const initial = make('p', 'initial');
    initial.append(make('strong', '', 'Libro digital '), 'disponible en Amazon.');
    offers.append(initial);
    return;
  }
  const market = serverOffer || markets[code] || {store: 'amazon.com', name: 'Amazon.com', price: '2,99 USD'};
  const price = make('p', 'offer-price');
  price.append(make('span', '', 'Edición Kindle'), make('strong', '', market.price));
  const link = make('a', 'buy-link');
  link.href = market.url || `https://www.${market.store}/dp/B0HM5JGYSD`;
  const storeOrigin = new URL(link.href).origin;
  if (storeConnection.href !== storeOrigin + '/') storeConnection.href = storeOrigin;
  link.append(make('span', '', 'Comprar en Amazon'), make('span', 'arrow', '→'));
  const note = make('p', 'buy-caption', `${market.name} · Precio final al comprar.`);
  offers.append(price, link, note);
  const currencyNote = document.getElementById('currency-note');
  currencyNote.replaceChildren();
  currencyNote.hidden = !market.requestedCurrency;
  if (market.requestedCurrency) {
    const explanation = make('p', '', market.approx
      ? `El importe en ${market.currency} es aproximado; Amazon aplica su propio cambio. La moneda del cobro se confirma en Amazon.`
      : 'El precio está en dólares. La moneda del cobro se confirma en Amazon.');
    currencyNote.append(explanation);
    if (market.preferencesUrl) {
      const settings = make('a', '', `Cambiar la moneda en Amazon a ${market.requestedCurrency}`);
      settings.href = market.preferencesUrl;
      currencyNote.append(make('p', '', `Si Amazon muestra otra moneda, elige ${market.requestedCurrency} en sus preferencias y guarda los cambios para volver al libro.`), settings);
    } else {
      currencyNote.append(make('p', '', `Amazon no incluye ${market.requestedCurrency} entre sus monedas de visualización. Su ficha puede aparecer en dólares.`));
    }
    if (market.approx) {
      const source = make('p', '', `Cambio orientativo del ${market.asOf}. `);
      const attribution = make('a', '', 'Rates By Exchange Rate API');
      attribution.href = 'https://www.exchangerate-api.com';
      source.append(attribution);
      currencyNote.append(source);
    }
  }
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
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.button) {
      buyLink.firstElementChild.textContent = 'Abriendo Amazon…';
      buyLink.setAttribute('aria-busy', 'true');
    }
    return;
  }
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
const count = document.getElementById('page-count');
const caption = document.getElementById('page-caption');
let sampleIndex = 0;
let scrollFrame;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const positionFor = index => slides[index].offsetLeft - slides[0].offsetLeft;
function setActive(index) {
  sampleIndex = index;
  previous.disabled = index === 0;
  next.disabled = index === slides.length - 1;
  count.textContent = `${index + 1} / ${slides.length}`;
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
previous.addEventListener('click', () => showSample(sampleIndex - 1));
next.addEventListener('click', () => showSample(sampleIndex + 1));
slider.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') {event.preventDefault(); showSample(sampleIndex + 1);}
  if (event.key === 'ArrowLeft') {event.preventDefault(); showSample(sampleIndex - 1);}
  if (event.key === 'Home') {event.preventDefault(); showSample(0);}
  if (event.key === 'End') {event.preventDefault(); showSample(slides.length - 1);}
});
