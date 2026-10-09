// Ofrece la tienda del país desde la primera respuesta, sin GPS ni servicios externos.
// Solo modifica el documento; imágenes, vídeo y JS conservan su entrega estática.
const countries = new Set('INT ES MX GT EC AR BZ BO BR CL CO CR SV US HT HN NI PA PY PE PR DO UY VE'.split(' '));

export function countryFor(request) {
  // Ignora selecciones antiguas y enlaces compartidos con otro país.
  const detected = request.cf?.country;
  return countries.has(detected) ? detected : 'INT';
}

export function storeFor(country) {
  return ({ES: ['amazon.es', 'Amazon España', '2,69 €'], MX: ['amazon.com.mx', 'Amazon México', '34,99 MXN'], BR: ['amazon.com.br', 'Amazon Brasil', 'R$ 5,99']})[country] || ['amazon.com', 'Amazon.com', '2,99 USD'];
}

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (!/^\/libros\/(?:index\.html)?$/.test(path)) return context.next();
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const country = countryFor(context.request);
  const [store, name, price] = storeFor(country);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.delete('ETag');
  const personalized = new Response(response.body, {status: response.status, headers});
  return new HTMLRewriter()
    .on('html', {element(element) { element.setAttribute('data-country', country); }})
    .on('#offers', {element(element) {
      element.setInnerContent(`<p class="initial"><strong>Digital Kindle · ${price}</strong></p><a class="buy-link" href="https://www.${store}/dp/B0HM5JGYSD"><span>Quiero el libro digital</span><span class="arrow" aria-hidden="true">→</span></a><p class="buy-caption">${name} está actualizando la rebaja. Confirma el precio al comprar.</p>`, {html: true});
    }})
    .transform(personalized);
}
