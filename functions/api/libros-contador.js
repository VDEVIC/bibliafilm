// Solo dos cantidades. Sin cookies, IP, agente, origen guardado ni identificador de visitante.
// Cada marca vacía tiene un nombre aleatorio del servidor: no identifica ni enlaza visitas.
const hosts = new Set(['bibliafilm.com', 'www.bibliafilm.com']);
const headers = {'Cache-Control':'no-store', 'X-Robots-Tag':'noindex'};
const reply = status => new Response(null, {status, headers});
const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid', year:'numeric', month:'2-digit', day:'2-digit'});
export function dayInMadrid(now = new Date()) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export async function onRequest({request, env}) {
  if (request.method !== 'POST') return reply(405);
  const url = new URL(request.url);
  // Las maquetas y los entornos de pruebas nunca alimentan el contador real.
  if (!hosts.has(url.hostname)) return reply(204);
  if (request.headers.get('Origin') !== url.origin) return reply(403);
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return reply(403);
  if (request.cf?.botManagement?.verifiedBot) return reply(204);
  if (Number(request.headers.get('Content-Length')) > 6) return reply(413);
  if (!request.body) return reply(400);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 6) {await reader.cancel(); return reply(413);}
    chunks.push(...value);
  }
  const event = new TextDecoder().decode(new Uint8Array(chunks));
  if (!['visita', 'amazon'].includes(event)) return reply(400);
  if (!env.LIBROS_CONTADORES) return reply(503);
  const key = `libros/v1/${dayInMadrid()}/${event}/${crypto.randomUUID()}`;
  try {
    await env.LIBROS_CONTADORES.put(key, '', {httpMetadata:{contentType:'application/octet-stream'}});
    return reply(204);
  } catch {
    // Un fallo de medición jamás cambia ni bloquea el enlace de compra.
    return reply(503);
  }
}
