// Prepara el cobro (PaymentIntent) del apoyo desde la página /nuevo/. Importe libre entre 0,50 € (mínimo de Stripe) y 1000 €.
// Formas de pago: tarjeta (Apple Pay y Google Pay van por la tarjeta). Cuando Bizum esté activado en la cuenta de Stripe,
// añadir 'bizum' a METODOS aquí y en nuevo/nuevo.js (hoy Stripe lo rechaza: «bizum is invalid»).
const METODOS = ['card'];

export async function onRequestPost({ request, env }) {
  const cab = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const error = (e, status) => new Response(JSON.stringify({ error: e }), { status, headers: cab });
  if (!env.STRIPE_SECRET_KEY) return error('sin-clave', 500);
  let importe;
  try { ({ importe } = await request.json()); } catch (e) { return error('peticion', 400); }
  const cts = Math.round(Number(importe) * 100);
  if (!Number.isFinite(cts) || cts < 50 || cts > 100000) return error('importe', 400);
  const cuerpo = new URLSearchParams({
    amount: String(cts), currency: 'eur', description: 'Apoyo a Biblia Film', statement_descriptor_suffix: 'APOYO',
    'metadata[proyecto]': 'bibliafilm', 'metadata[origen]': 'web-nuevo'
  });
  METODOS.forEach((m, i) => cuerpo.set('payment_method_types[' + i + ']', m));
  const r = await fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo });
  const j = await r.json();
  if (!r.ok) return error((j.error && j.error.message) || 'stripe', 502);
  return new Response(JSON.stringify({ clientSecret: j.client_secret, id: j.id }), { headers: cab });
}
