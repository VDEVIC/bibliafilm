// Crea el cobro (PaymentIntent) para el apoyo, en la moneda de quien apoya (ver moneda.js). Importe libre entre el mínimo
// y el máximo de esa moneda (en euros, de 0,50 € a 1000 €). Corre en Cloudflare Pages.
import { MONEDAS } from './moneda.js';

export async function onRequestPost({ request, env }) {
  const cab = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { importe, moneda, agradecer, nombre, tiktok } = await request.json();
    const codigo = String(moneda || 'eur').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(MONEDAS, codigo)) return new Response(JSON.stringify({ error: 'moneda' }), { status: 400, headers: cab });
    const M = MONEDAS[codigo];
    const valor = Number(importe);
    if (!Number.isFinite(valor) || valor < M.min || valor > M.max) return new Response(JSON.stringify({ error: 'importe' }), { status: 400, headers: cab });
    // en las monedas sin céntimos de uso (pesos, soles…) el importe va en unidades enteras
    const unidades = M.paso >= 1 ? Math.round(valor) : valor;
    const cts = Math.round(unidades * 10 ** M.dec);
    const cuerpo = new URLSearchParams({
      amount: String(cts), currency: codigo, description: 'Apoyo a Biblia Film',
      'payment_method_types[0]': 'card', statement_descriptor_suffix: 'APOYO',
      'metadata[proyecto]': 'bibliafilm', 'metadata[origen]': 'web',
      // permiso expreso para salir en los agradecimientos (casilla opcional, desmarcada por defecto) y el nombre que eligió
      'metadata[agradecimientos]': agradecer === true ? 'si' : 'no'
    });
    const limpio = String(nombre || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
    if (agradecer === true && limpio) cuerpo.append('metadata[nombre_agradecimientos]', limpio);
    const usuario = String(tiktok || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 24);
    if (agradecer === true && usuario) cuerpo.append('metadata[tiktok_agradecimientos]', '@' + usuario);
    const r = await fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo });
    const j = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: (j.error && j.error.message) || 'stripe' }), { status: 502, headers: cab });
    return new Response(JSON.stringify({ clientSecret: j.client_secret }), { headers: cab });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'peticion' }), { status: 400, headers: cab });
  }
}
