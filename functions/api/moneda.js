// Moneda de la aportación según el país de quien visita (Cloudflare lo da en request.cf.country). La tarjeta paga en su
// moneda y Stripe nos ingresa en euros. Vic, 29-sep-2026: «tengo un contacto en Colombia que me dice que le aparece en
// euros». El formulario de la web (Elements + PaymentIntents) no admite la conversión automática de Stripe (Adaptive
// Pricing), así que la moneda se elige aquí. Importes sugeridos ≈ 3, 5, 10 y 20 € redondeados (cambio del 29-sep-2026).
// Mínimos ≈ 0,70 € (Stripe exige ≥ 0,50 € al convertir) y máximos ≈ 1.000 € (COP: 999.999, Stripe admite 8 cifras). «dec» = decimales que usa Stripe para esa moneda.
// Para probar desde España: /api/moneda?m=cop (y en la web, bibliafilm.com/?moneda=cop).
export const MONEDAS = {
  eur: { dec: 2, paso: 0.01, min: 0.5,  max: 1000,    importes: [3, 5, 10, 20] },
  usd: { dec: 2, paso: 0.01, min: 1,    max: 1000,    importes: [3, 5, 10, 20] },
  mxn: { dec: 2, paso: 1,    min: 15,   max: 20000,   importes: [60, 100, 200, 400] },
  cop: { dec: 2, paso: 1,    min: 3000, max: 999999,  importes: [15000, 20000, 40000, 80000] },
  pen: { dec: 2, paso: 1,    min: 3,    max: 4000,    importes: [12, 20, 40, 80] },
  clp: { dec: 0, paso: 1,    min: 700,  max: 1000000, importes: [3000, 5000, 10000, 20000] },
  dop: { dec: 2, paso: 1,    min: 50,   max: 70000,   importes: [200, 350, 700, 1400] },
  gtq: { dec: 2, paso: 1,    min: 6,    max: 9000,    importes: [25, 45, 90, 180] },
  bob: { dec: 2, paso: 1,    min: 8,    max: 14000,   importes: [20, 35, 70, 140] },
  uyu: { dec: 2, paso: 1,    min: 35,   max: 50000,   importes: [150, 250, 500, 1000] },
  crc: { dec: 2, paso: 1,    min: 400,  max: 500000,  importes: [1500, 2500, 5000, 10000] },
  pyg: { dec: 0, paso: 1,    min: 6000, max: 7000000, importes: [20000, 35000, 70000, 140000] },
  hnl: { dec: 2, paso: 1,    min: 20,   max: 30000,   importes: [90, 150, 300, 600] },
  brl: { dec: 2, paso: 1,    min: 5,    max: 6000,    importes: [20, 30, 60, 120] }
};
// Los países que usan el dólar o cuya moneda no está en la lista (Argentina, Venezuela, Nicaragua) pagan en dólares.
const PAISES = {
  US: 'usd', PR: 'usd', EC: 'usd', SV: 'usd', PA: 'usd', VE: 'usd', AR: 'usd', NI: 'usd',
  MX: 'mxn', CO: 'cop', PE: 'pen', CL: 'clp', DO: 'dop', GT: 'gtq', BO: 'bob', UY: 'uyu', CR: 'crc', PY: 'pyg',
  HN: 'hnl', BR: 'brl'
};
export const monedaDePais = pais => PAISES[String(pais || '').toUpperCase()] || 'eur';

export async function onRequestGet({ request }) {
  const pedida = (new URL(request.url).searchParams.get('m') || '').toLowerCase();
  const pais = (request.cf && request.cf.country) || '';
  const moneda = Object.prototype.hasOwnProperty.call(MONEDAS, pedida) ? pedida : monedaDePais(pais);
  return new Response(JSON.stringify(Object.assign({ pais, moneda }, MONEDAS[moneda])),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
