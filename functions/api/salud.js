export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: !!env.STRIPE_SECRET_KEY }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
