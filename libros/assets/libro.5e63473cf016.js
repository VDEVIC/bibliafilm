'use strict';
const offers = document.getElementById('offers');
const validCountries = new Set('INT ES MX GT EC AR BZ BO BR CL CO CR SV US HT HN NI PA PY PE PR DO UY VE'.split(' '));
let detectedCountry = document.documentElement.dataset.country || 'INT';
const markets = {
  ES: {store: 'amazon.es', name: 'Amazon España', price: '2,69 €'},
  MX: {store: 'amazon.com.mx', name: 'Amazon México', price: '34,99 MXN'},
  BR: {store: 'amazon.com.br', name: 'Amazon Brasil', price: 'R$ 5,99'}
};
// Precios rebajados enviados a KDP; el usuario pide mostrarlos durante la actualización.
// Son importes configurados aquí, sin sincronización automática con Amazon.
let serverOffer;
try { serverOffer = JSON.parse(document.documentElement.dataset.offer || 'null'); } catch {}
let selectedFormat = 'digital';
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
  if (code !== 'ES') selectedFormat = 'digital';
  const formats = make('div', code === 'ES' ? 'format-options' : 'format-options single-format');
  formats.setAttribute('role', 'group');
  formats.setAttribute('aria-label', 'Formato del libro');
  function option(format, name, detail, price) {
    const button = make('button', 'format-option');
    button.type = 'button';
    button.dataset.format = format;
    button.setAttribute('aria-pressed', String(format === selectedFormat));
    const label = make('span', 'label', name);
    label.append(make('small', '', detail));
    button.append(label, make('span', 'price', price));
    formats.append(button);
  }
  if (code === 'ES') option('paper', 'En papel', 'Tapa blanda', '15,49 €');
  option('digital', 'Digital', market.approx ? `Kindle · Equivale a ${market.basePrice}` : 'Edición Kindle', market.price);
  const link = make('a', 'buy-link');
  const isPaper = selectedFormat === 'paper';
  link.href = isPaper ? 'https://www.amazon.es/dp/B0HM5F1M4P' : (market.url || `https://www.${market.store}/dp/B0HM5JGYSD`);
  const storeOrigin = new URL(link.href).origin;
  if (storeConnection.href !== storeOrigin + '/') storeConnection.href = storeOrigin;
  link.append(make('span', '', isPaper ? 'Quiero el libro' : 'Quiero el libro digital'), make('span', 'arrow', '→'));
  link.setAttribute('aria-label', `${isPaper ? 'Comprar el libro en papel' : 'Comprar el libro digital Kindle'} en ${market.name}`);
  const note = make('p', 'buy-caption');
  note.textContent = isPaper ? 'Amazon España · Envío calculado antes de pagar.' : `${market.name} está actualizando la rebaja. Confirma el precio al comprar.`;
  offers.append(formats, link, note);
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
  const button = event.target.closest('[data-format]');
  if (!button) return;
  selectedFormat = button.dataset.format;
  updateOffers();
  offers.querySelector(`[data-format="${selectedFormat}"]`).focus({preventScroll: true});
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
const preview = document.getElementById('preview-dialog');
const sampleImage = document.getElementById('sample-image');
const sampleStatus = document.getElementById('sample-status');
const sampleView = sampleImage.parentElement;
const pageCaption = document.getElementById('page-caption');
const samples = [
  {file: 'moises.webp', caption: 'Moisés · Un camino entre las aguas', alt: 'Páginas 50 y 51: Moisés y las familias cruzan el mar, con el texto del cuento.'},
  {file: 'daniel.webp', caption: 'Daniel · La ventana abierta', alt: 'Páginas 90 y 91 del cuento de Daniel, con las ilustraciones y su texto.'},
  {file: 'jesus.webp', caption: 'Jesús hace sitio', alt: 'Páginas 150 y 151: Jesús recibe a los niños, con las ilustraciones y su texto.'}
];
let sampleIndex = 0;
function sampleReady() {
  sampleView.setAttribute('aria-busy', 'false');
  sampleStatus.hidden = true;
  sampleImage.hidden = false;
}
sampleImage.addEventListener('load', sampleReady);
sampleImage.addEventListener('error', () => {
  sampleView.setAttribute('aria-busy', 'false');
  sampleStatus.textContent = 'No se pudo cargar esta página. Prueba con la flecha para ver otra.';
  sampleStatus.hidden = false;
});
function showSample(index) {
  sampleIndex = (index + samples.length) % samples.length;
  const sample = samples[sampleIndex];
  sampleView.setAttribute('aria-busy', 'true');
  sampleStatus.textContent = 'Cargando páginas…';
  sampleStatus.hidden = false;
  sampleImage.hidden = true;
  sampleImage.alt = sample.alt;
  pageCaption.textContent = `${sampleIndex + 1} / ${samples.length} · ${sample.caption}`;
  sampleImage.src = '/libros/assets/' + sample.file;
  if (sampleImage.complete && sampleImage.naturalWidth) sampleReady();
}
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => {showSample(0); preview.showModal();}));
document.getElementById('previous-page').addEventListener('click', () => showSample(sampleIndex - 1));
document.getElementById('next-page').addEventListener('click', () => showSample(sampleIndex + 1));
preview.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') {event.preventDefault(); showSample(sampleIndex + 1);}
  if (event.key === 'ArrowLeft') {event.preventDefault(); showSample(sampleIndex - 1);}
});
const videoDialog = document.getElementById('video-dialog');
const promo = document.getElementById('promo-video');
document.getElementById('play-video').addEventListener('click', () => {
  videoDialog.showModal();
  promo.src = promo.dataset.src;
  promo.play().catch(() => {});
});
videoDialog.addEventListener('close', () => {
  promo.pause();
  promo.removeAttribute('src');
  promo.load();
});
window.addEventListener('pagehide', () => promo.pause());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
