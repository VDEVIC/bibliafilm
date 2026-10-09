'use strict';
const country = document.getElementById('country');
const offers = document.getElementById('offers');
const kindleId = 'B0HM5JGYSD';
const validCountries = new Set(Array.from(country.options, option => option.value).filter(Boolean));
const markets = {
  ES: {store: 'amazon.es', price: '7,49 €', button: 'Comprar Kindle en Amazon.es'},
  MX: {store: 'amazon.com.mx', price: '179 MXN', button: 'Comprar Kindle en Amazon México'},
  BR: {store: 'amazon.com.br', price: '44,90 R$', button: 'Comprar Kindle en Amazon Brasil'}
};
function makeOffer(title, price, description, href, label, secondary = false) {
  const article = document.createElement('article');
  article.className = 'offer';
  const heading = document.createElement('div');
  heading.className = 'offer-heading';
  const name = document.createElement('h3');
  name.textContent = title;
  const cost = document.createElement('span');
  cost.className = 'price';
  cost.textContent = price;
  heading.append(name, cost);
  const text = document.createElement('p');
  text.className = 'offer-description';
  text.textContent = description;
  const link = document.createElement('a');
  link.className = secondary ? 'button secondary' : 'button';
  link.href = href;
  link.textContent = label + ' ↗';
  article.append(heading, text, link);
  return article;
}
function updateOffers() {
  const code = validCountries.has(country.value) ? country.value : '';
  offers.replaceChildren();
  if (!code) {
    const initial = document.createElement('p');
    initial.className = 'initial';
    initial.textContent = 'Consulta la edición y la tienda para tu país.';
    offers.append(initial);
    return;
  }
  const countryName = country.selectedOptions[0].textContent;
  const market = markets[code];
  const summary = document.createElement('p');
  summary.className = 'selection-summary';
  const destination = document.createElement('strong');
  destination.textContent = 'Compra para ' + countryName;
  const store = document.createElement('span');
  store.textContent = market ? market.store : 'amazon.com · edición digital';
  summary.append(destination, store);
  offers.append(summary);

  if (code !== 'ES') {
    const availability = document.createElement('p');
    availability.className = 'availability-note';
    availability.textContent = 'Para ' + countryName + ' ofrecemos por ahora la edición digital.';
    offers.append(availability);
  }
  if (code === 'ES') {
    offers.append(makeOffer('Libro en papel', '15,49 €', 'Tapa blanda · 162 páginas a color. Compra en la tienda española; el envío y la entrega se calculan según tu dirección y pedido.', 'https://www.amazon.es/dp/B0HM5F1M4P', 'Comprar en papel · Amazon España'));
  }
  offers.append(makeOffer('Libro digital · Kindle', market ? market.price : 'Base: 8,49 USD', code === 'BR' ? 'Edición en español. Consulta los dispositivos compatibles en Amazon.' : 'Edición ilustrada en español. Consulta los dispositivos compatibles en Amazon.', `https://www.${market ? market.store : 'amazon.com'}/dp/${kindleId}`, market ? market.button : 'Consultar Kindle en Amazon.com', code === 'ES'));
  const note = document.createElement('p');
  note.className = 'fineprint';
  note.textContent = market ? 'La compra se realiza en Amazon, que confirma la disponibilidad y el importe final antes de pagar.' : 'Amazon.com atiende a países sin tienda Kindle propia. Inicia sesión con una cuenta de tu país para confirmar la disponibilidad y el precio final, incluidos los impuestos aplicables.';
  offers.append(note);
}
function restoreCountry() {
  const saved = new URL(location.href).searchParams.get('pais');
  country.value = validCountries.has(saved) ? saved : '';
  updateOffers();
}
country.addEventListener('change', () => {
  const url = new URL(location.href);
  if (validCountries.has(country.value)) url.searchParams.set('pais', country.value);
  else url.searchParams.delete('pais');
  // La selección queda visible en el enlace y se conserva al volver de Amazon.
  history.replaceState(null, '', url);
  updateOffers();
});
restoreCountry();
window.addEventListener('pageshow', restoreCountry);
window.addEventListener('popstate', restoreCountry);
