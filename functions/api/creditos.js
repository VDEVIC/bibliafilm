// Los créditos: nombres de quienes apoyan.
// GET  → lista pública de nombres (pagos completados con nombre), con caché de 5 minutos.
// POST → guarda el nombre elegido como dato del pago; solo quien tiene el secreto del pago (la propia página) puede hacerlo.
const CAB = { 'Content-Type': 'application/json; charset=utf-8' };
const API = 'https://api.stripe.com/v1/payment_intents';
const LIMPIA = /[\u0000-\u001f\u007f<>]/g;

function limpiaNombre(n) {
  n = String(n || '').replace(LIMPIA, '').replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();
  return n.slice(0, 40).trim();
}

export async function onRequestGet({ request, env }) {
  const cache = caches.default, clave = new Request(new URL(request.url).origin + '/api/creditos', { method: 'GET' });
  const guardada = await cache.match(clave);
  if (guardada) return guardada;
  const nombres = [];
  try {
    let despues = '';
    for (let pagina = 0; pagina < 5; pagina++) {
      const r = await fetch(API + '?limit=100' + (despues ? '&starting_after=' + despues : ''), { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
      const j = await r.json();
      if (!r.ok) break;
      for (const p of j.data) { if (p.status === 'succeeded' && p.metadata && p.metadata.creditos) nombres.push(p.metadata.creditos); }
      if (!j.has_more || !j.data.length) break;
      despues = j.data[j.data.length - 1].id;
    }
  } catch (e) {}
  const resp = new Response(JSON.stringify({ nombres }), { headers: Object.assign({ 'Cache-Control': 'public, max-age=120, s-maxage=300' }, CAB) });
  try { await cache.put(clave, resp.clone()); } catch (e) {}
  return resp;
}

export async function onRequestPost({ request, env }) {
  const cab = Object.assign({ 'Cache-Control': 'no-store' }, CAB);
  const error = (e, status) => new Response(JSON.stringify({ ok: false, error: e }), { status, headers: cab });
  let id, secreto, nombre;
  try { ({ id, secreto, nombre } = await request.json()); } catch (e) { return error('peticion', 400); }
  nombre = limpiaNombre(nombre);
  if (!/^pi_[A-Za-z0-9]+$/.test(String(id || '')) || typeof secreto !== 'string' || !secreto.startsWith(id + '_secret_') || !nombre) return error('datos', 400);
  const auth = { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY };
  const r = await fetch(API + '/' + id, { headers: auth });
  const p = await r.json();
  if (!r.ok || p.client_secret !== secreto) return error('pago', 403);
  if (p.status !== 'succeeded' && p.status !== 'processing') return error('estado', 409);
  const r2 = await fetch(API + '/' + id, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, auth), body: new URLSearchParams({ 'metadata[creditos]': nombre }) });
  if (!r2.ok) return error('stripe', 502);
  try { await caches.default.delete(new Request(new URL(request.url).origin + '/api/creditos', { method: 'GET' })); } catch (e) {}
  return new Response(JSON.stringify({ ok: true, nombre }), { headers: cab });
}
