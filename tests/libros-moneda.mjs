import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../functions/libros/_middleware.js',import.meta.url),'utf8');
const {countryFor,offerFor,validSnapshot,fallbackRates,ratesFor,onRequest} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now = fallbackRates.updated+60;
const expected = {ES:'EUR',MX:'MXN',BR:'BRL',GT:'GTQ',CO:'COP',EC:'USD',AR:'ARS',BZ:'BZD',BO:'BOB',CL:'CLP',CR:'CRC',SV:'USD',US:'USD',HT:'HTG',HN:'HNL',NI:'NIO',PA:'PAB',PY:'PYG',PE:'PEN',PR:'USD',DO:'DOP',UY:'UYU',VE:'VES',INT:'USD'};
for(const [country,currency] of Object.entries(expected)) {
  const offer = offerFor(country,fallbackRates,now);
  assert.equal(offer.currency,currency,country);
  assert.ok(!offer.price.includes('NaN'));
  assert.ok(offer.url.endsWith('/dp/B0HM5JGYSD'));
  assert.equal(offer.approx,!['EUR','MXN','BRL','USD'].includes(currency));
  assert.equal(countryFor({cf:{country},url:'https://bibliafilm.com/libros/?pais=ES'}),country);
}
assert.equal(countryFor({cf:{country:'ZZ'}}),'INT');
assert.equal(countryFor({headers:new Headers({'Cookie':'pais=ES','CF-IPCountry':'MX'})}),'INT');
assert.equal(offerFor('ES',null).price,'2,69 €');
assert.equal(offerFor('CO',fallbackRates,now+8*86400).price,'2,99 USD');
assert.equal(offerFor('CO',{...fallbackRates,rates:{COP:NaN}},now).approx,false);
assert.equal(offerFor('CO',{...fallbackRates,updated:now+1000},now).approx,false);
for(const c of ['HT','VE']) assert.equal(offerFor(c,fallbackRates,now).preferencesUrl,undefined);
assert.ok(offerFor('GT',fallbackRates,now).preferencesUrl.includes('preferencesReturnUrl=%2Fdp%2FB0HM5JGYSD'));
assert.equal(validSnapshot({...fallbackRates,rates:{COP:-1}},now),false);
const asset = new Response('image');
assert.equal(await onRequest({request:new Request('https://bibliafilm.com/libros/assets/moises.webp'),next:async()=>asset}),asset);
// A stalled exchange service never blocks delivery of a valid fallback.
const originalFetch = globalThis.fetch;
let resolveFetch;
globalThis.fetch = () => new Promise(resolve => {resolveFetch=resolve;});
fallbackRates.next = 0;
let background;
const immediate = await ratesFor({request:new Request('https://bibliafilm.com/libros/'),waitUntil:p=>background=p});
assert.equal(immediate,fallbackRates);
assert.ok(background instanceof Promise);
resolveFetch(new Response('',{status:503}));
await background;
globalThis.fetch = originalFetch;
console.log(`OK: ${Object.keys(expected).length} países/rutas, ${new Set(Object.values(expected)).size} monedas, caducidad, datos inválidos, activos y API lenta.`);
