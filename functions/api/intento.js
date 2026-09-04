// Crea el cobro (PaymentIntent) para el apoyo. Importe libre entre 0,50 € (mínimo de Stripe) y 1000 €. Corre en Cloudflare Pages.
export async function onRequestPost({ request, env }) {
  const cab = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { importe } = await request.json();
    const cts = Math.round(Number(importe) * 100);
    if (!Number.isFinite(cts) || cts < 50 || cts > 100000) return new Response(JSON.stringify({ error: 'importe' }), { status: 400, headers: cab });
    const cuerpo = new URLSearchParams({
      amount: String(cts), currency: 'eur', description: 'Apoyo a Biblia Film',
      'payment_method_types[0]': 'card', statement_descriptor_suffix: 'APOYO',
      'metadata[proyecto]': 'bibliafilm', 'metadata[origen]': 'web'
    });
    const r = await fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo });
    const j = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: (j.error && j.error.message) || 'stripe' }), { status: 502, headers: cab });
    return new Response(JSON.stringify({ clientSecret: j.client_secret }), { headers: cab });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'peticion' }), { status: 400, headers: cab });
  }
}
