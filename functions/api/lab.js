// Laboratorio de tirones (bibliafilm.com/prueba/): guarda cada envío del medidor en el almacén R2 «bibliafilm-media», carpeta lab/.
// Se leen desde el Mac con registro/lab/leer-lab.py. Solo guarda números y textos cortos del medidor (y el userAgent):
// ni IP ni nada personal. El contenido se vuelve a escribir campo a campo, así que no se puede colar otra cosa.
const CAB = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const MAX_BYTES = 64 * 1024; // lo máximo que admite sendBeacon en Safari
const ORIGENES = /^https:\/\/((www\.)?bibliafilm\.com|([a-z0-9-]+\.)?bibliafilm\.pages\.dev)$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Copia solo datos simples: números, sí/no, textos cortos, listas y objetos pequeños, con nombres de campo sencillos.
function limpia(v, fondo) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 400);
  if (fondo > 5) return null;
  if (Array.isArray(v)) return v.slice(0, 400).map(x => limpia(x, fondo + 1));
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 60)) if (/^[A-Za-z0-9_]{1,24}$/.test(k)) o[k] = limpia(v[k], fondo + 1);
    return o;
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  const origen = request.headers.get('Origin') || '';
  if (origen && !ORIGENES.test(origen)) return new Response(JSON.stringify({ ok: false, error: 'origen' }), { status: 403, headers: CAB });
  if (!env.LAB) return new Response(JSON.stringify({ ok: false, error: 'sin-almacen' }), { status: 500, headers: CAB });
  const texto = await request.text();
  if (texto.length > MAX_BYTES) return new Response(JSON.stringify({ ok: false, error: 'grande' }), { status: 413, headers: CAB });
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { return new Response(JSON.stringify({ ok: false, error: 'json' }), { status: 400, headers: CAB }); }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return new Response(JSON.stringify({ ok: false, error: 'datos' }), { status: 400, headers: CAB });
  const limpio = limpia(datos, 0);
  const ahora = new Date(), fecha = ahora.toISOString();
  const sesion = String(limpio.sesion || 'suelta').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'suelta';
  const variante = Number.isInteger(limpio.v) && limpio.v >= 0 && limpio.v < 100 ? limpio.v : 0;
  const azar = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const clave = `lab/${fecha.slice(0, 10)}/${fecha.slice(11, 19).replace(/:/g, '')}-${sesion}-v${variante}-${azar}.json`;
  await env.LAB.put(clave, JSON.stringify(Object.assign({ fecha }, limpio)), { httpMetadata: { contentType: 'application/json' } });
  return new Response(JSON.stringify({ ok: true, clave }), { headers: CAB });
}

// Comprobación rápida desde fuera: {"ok":true} si el almacén está enlazado a la web.
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: !!env.LAB }), { headers: CAB });
}
