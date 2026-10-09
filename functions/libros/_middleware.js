// Ofrece la tienda del país desde la primera respuesta, sin GPS ni servicios externos.
// Solo modifica el documento; imágenes, vídeo y JS conservan su entrega estática.
const countries = new Set('INT ES MX GT EC AR BZ BO BR CL CO CR SV US HT HN NI PA PY PE PR DO UY VE'.split(' '));

export function countryFor(request) {
  const query = (new URL(request.url).searchParams.get('pais') || '').toUpperCase();
  const saved = (request.headers.get('cookie') || '').match(/(?:^|;\s*)bf_libro_pais=([A-Z]{2,3})(?:;|$)/)?.[1];
  const detected = request.cf?.country;
  return [query, saved, detected, 'INT'].find(code => countries.has(code));
}

export function storeFor(country) {
  return ({ES: ['amazon.es', 'Amazon España'], MX: ['amazon.com.mx', 'Amazon México'], BR: ['amazon.com.br', 'Amazon Brasil']})[country] || ['amazon.com', 'Amazon.com'];
}

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (!/^\/libros\/(?:index\.html)?$/.test(path)) return context.next();
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const country = countryFor(context.request);
  const [store, name] = storeFor(country);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.delete('ETag');
  const personalized = new Response(response.body, {status: response.status, headers});
  return new HTMLRewriter()
    .on('html', {element(element) { element.setAttribute('data-country', country); }})
    .on('#country option', {element(element) {
      if (element.getAttribute('value') === country) element.setAttribute('selected', '');
      else element.removeAttribute('selected');
    }})
    .on('#offers', {element(element) {
      element.setInnerContent(`<a class="buy-link" href="https://www.${store}/dp/B0HM5JGYSD"><span>Quiero el libro digital</span><span class="arrow" aria-hidden="true">→</span></a><p class="buy-caption">${name} · Precio final y disponibilidad al comprar.</p>`, {html: true});
    }})
    .transform(personalized);
}
