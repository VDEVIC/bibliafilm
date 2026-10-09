// Respaldo privado; nunca se envía la tabla de cambios al navegador.
export const fallbackRates = {"updated":1791504151,"next":1791591741,"rates":{"USD":1,"GTQ":7.631071,"COP":3236.417658,"PEN":3.43997,"CLP":977.542882,"ARS":1518.4363,"DOP":60.414607,"BOB":11.947745,"UYU":40.046537,"CRC":455.520788,"PYG":5818.502131,"HNL":26.809103,"NIO":36.753301,"BZD":2,"HTG":130.805506,"VES":875.6505,"PAB":1}};
const countries = new Set('INT ES MX GT EC AR BZ BO BR CL CO CR SV US HT HN NI PA PY PE PR DO UY VE'.split(' '));
const currencies = {GT:'GTQ',CO:'COP',PE:'PEN',CL:'CLP',AR:'ARS',DO:'DOP',BO:'BOB',UY:'UYU',CR:'CRC',PY:'PYG',HN:'HNL',NI:'NIO',BZ:'BZD',HT:'HTG',VE:'VES',PA:'PAB'};
const nativeMarkets = {
  ES: {store:'amazon.es',name:'Amazon España',price:'2,69 €',currency:'EUR'},
  MX: {store:'amazon.com.mx',name:'Amazon México',price:'34,99 MXN',currency:'MXN'},
  BR: {store:'amazon.com.br',name:'Amazon Brasil',price:'R$ 5,99',currency:'BRL'}
};
const maxAge = 7 * 86400;
export function countryFor(request) {
  const detected = request.cf?.country;
  return countries.has(detected) ? detected : 'INT';
}
export function storeFor(country) {
  const market = nativeMarkets[country];
  return market ? [market.store,market.name,market.price] : ['amazon.com','Amazon.com','2,99 USD'];
}
export function offerFor(country, snapshot = fallbackRates, now = Date.now()/1000) {
  const native = nativeMarkets[country];
  const currency = native?.currency || currencies[country] || 'USD';
  const offer = {...(native || {store:'amazon.com',name:'Amazon.com',price:'2,99 USD',currency:'USD'}),basePrice:native?.price || '2,99 USD',approx:false};
  offer.url = `https://www.${offer.store}/dp/B0HM5JGYSD`;
  if (native || currency === 'USD') return offer;
  const rate = snapshot?.rates?.[currency];
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(snapshot.updated) && now - snapshot.updated <= maxAge && snapshot.updated <= now + 300) {
    const digits = ['COP','CLP','PYG'].includes(currency) ? 0 : 2;
    const amount = new Intl.NumberFormat('es-ES',{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:true}).format(2.99 * rate);
    Object.assign(offer,{price:`≈ ${amount} ${currency}`,currency,approx:true,asOf:new Date(snapshot.updated * 1000).toISOString().slice(0,10)});
  }
  offer.requestedCurrency = currency;
  offer.amazonSupportsCurrency = !['HTG','VES'].includes(currency);
  // Amazon ignora ?currency= si mantiene otra preferencia. No prometemos cambiarla.
  if (offer.amazonSupportsCurrency) offer.preferencesUrl = 'https://www.amazon.com/-/es/customer-preferences/edit?ie=UTF8&ref_=footer_cop&preferencesReturnUrl=%2Fdp%2FB0HM5JGYSD';
  return offer;
}
export function validSnapshot(value, now = Date.now()/1000) {
  return !!value && Number.isFinite(value.updated) && value.updated <= now+300 && now-value.updated <= maxAge && Number.isFinite(value.next) && value.next > value.updated && Object.values(currencies).every(code => Number.isFinite(value.rates?.[code]) && value.rates[code]>0);
}
let memoryRates = fallbackRates;
let refreshPromise;
let retryAfter = 0;
export async function ratesFor(context) {
  const now = Date.now()/1000;
  const cache = globalThis.caches?.default;
  const key = new Request(new URL('/__private_book_fx_v1',context.request.url));
  if (cache) {
    try {
      const cached = await cache.match(key);
      if (cached) {
        const parsed = await cached.json();
        if (validSnapshot(parsed,now) && parsed.updated > memoryRates.updated) memoryRates = parsed;
      }
    } catch { /* Un fallo de caché no debe bloquear la página. */ }
  }
  if (now >= memoryRates.next && now >= retryAfter && !refreshPromise) {
    retryAfter = now + 900;
    refreshPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),3000);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD',{signal:controller.signal});
        if (!response.ok) return;
        const data = await response.json();
        const fresh = {updated:data.time_last_update_unix,next:data.time_next_update_unix,rates:data.rates};
        if (data.result!=='success' || data.base_code!=='USD' || !validSnapshot(fresh)) return;
        memoryRates = fresh;
        if (cache) await cache.put(key,new Response(JSON.stringify(fresh),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=604800'}}));
      } catch { /* Conserva el último cambio válido, sin retrasar al visitante. */ }
      finally { clearTimeout(timeout); refreshPromise = undefined; }
    })();
    context.waitUntil(refreshPromise);
  }
  return memoryRates;
}
const escapeHtml = text => String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (!/^\/libros\/(?:index\.html)?$/.test(path)) return context.next();
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const country = countryFor(context.request);
  const offer = offerFor(country,await ratesFor(context));
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','private, no-store');
  headers.set('CDN-Cache-Control','no-store');
  headers.delete('ETag');
  const personalized = new Response(response.body,{status:response.status,headers});
  return new HTMLRewriter()
    .on('html',{element(element) {element.setAttribute('data-country',country);element.setAttribute('data-offer',JSON.stringify(offer));}})
    .on('#offers',{element(element) {
      element.setInnerContent(`<p class="initial"><strong>Digital Kindle · ${escapeHtml(offer.price)}</strong></p><a class="buy-link" href="${offer.url}"><span>Quiero el libro digital</span><span class="arrow" aria-hidden="true">→</span></a><p class="buy-caption">${offer.name} está actualizando la rebaja. Confirma el precio al comprar.</p>`,{html:true});
    }})
    .on('#currency-note',{element(element) {
      if (!offer.approx) return;
      element.removeAttribute('hidden');
      element.setInnerContent(`<p>Importe aproximado en ${offer.currency}. Amazon aplica su propio cambio. Cambio orientativo del ${offer.asOf}. <a href="https://www.exchangerate-api.com">Rates By Exchange Rate API</a></p>`,{html:true});
    }})
    .transform(personalized);
}
