// Notas de Vic en bibliafilm.com/plan/: cada caja amarilla guarda su texto en el almacén R2 «bibliafilm-media», carpeta plan-notas/.
// Se leen desde el Mac con registro/plan/leer-notas.py. Solo guarda el nombre de la caja y su texto (ni IP ni nada más).
const CAB = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const MAX_TEXTO = 8000;
const ORIGENES = /^https:\/\/((www\.)?bibliafilm\.com|([a-z0-9-]+\.)?bibliafilm\.pages\.dev)$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const mal = (error, status) => new Response(JSON.stringify({ ok: false, error }), { status, headers: CAB });

export async function onRequestPost({ request, env }) {
  const origen = request.headers.get('Origin') || '';
  if (origen && !ORIGENES.test(origen)) return mal('origen', 403);
  if (!env.LAB) return mal('sin-almacen', 500);
  const texto = await request.text();
  if (texto.length > MAX_TEXTO * 2) return mal('grande', 413);
  let d;
  try { d = JSON.parse(texto); } catch (e) { return mal('json', 400); }
  const caja = String((d && d.caja) || '');
  if (!/^[a-z0-9-]{1,40}$/.test(caja) || typeof d.texto !== 'string') return mal('datos', 400);
  const fecha = new Date().toISOString();
  const azar = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const clave = `plan-notas/${fecha.slice(0, 10)}/${fecha.slice(11, 19).replace(/:/g, '')}-${caja}-${azar}.json`;
  const nota = { fecha, caja, texto: d.texto.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, MAX_TEXTO) };
  await env.LAB.put(clave, JSON.stringify(nota), { httpMetadata: { contentType: 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), { headers: CAB });
}

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: !!env.LAB }), { headers: CAB });
}
