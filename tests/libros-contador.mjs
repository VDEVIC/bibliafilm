import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../functions/api/libros-contador.js', import.meta.url), 'utf8');
const {onRequest, dayInMadrid} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(dayInMadrid(new Date('2026-10-11T22:30:00Z')), '2026-10-12');
assert.equal(dayInMadrid(new Date('2026-01-11T22:30:00Z')), '2026-01-11');
const writes = [];
const env = {LIBROS_CONTADORES:{put:async(...args) => writes.push(args)}};
function request(body='visita', origin='https://bibliafilm.com', url=origin+'/api/libros-contador') {
  return new Request(url,{method:'POST',body,headers:{Origin:origin,'Sec-Fetch-Site':'same-origin'}});
}
for (const event of ['visita','amazon']) {
  const response = await onRequest({request:request(event),env});
  assert.equal(response.status,204);
  assert.equal(response.headers.has('Set-Cookie'),false);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
}
assert.equal(writes.length,2);
assert.match(writes[0][0],/^libros\/v1\/\d{4}-\d{2}-\d{2}\/visita\/[a-f0-9-]{36}$/);
assert.match(writes[1][0],/\/amazon\//);
assert.equal(writes[0][1],'');
assert.deepEqual(writes[0][2],{httpMetadata:{contentType:'application/octet-stream'}});
assert.equal((await onRequest({request:request('visita','https://evil.example','https://bibliafilm.com/api/libros-contador'),env})).status,403);
assert.equal((await onRequest({request:new Request('https://bibliafilm.com/api/libros-contador'),env})).status,405);
assert.equal((await onRequest({request:request('visita','https://preview.bibliafilm.pages.dev'),env})).status,204);
assert.equal((await onRequest({request:request('invalid'),env})).status,413);
assert.equal((await onRequest({request:request('otro'),env})).status,400);
assert.equal((await onRequest({request:request('visita'),env:{}})).status,503);
assert.equal((await onRequest({request:request('visita'),env:{LIBROS_CONTADORES:{put:async()=>{throw Error('storage');}}}})).status,503);
assert.equal(writes.length,2);
// La apertura se cuenta una sola vez cuando la pestaña se hace visible; el envío no lleva credenciales.
const client = await readFile(new URL('../libros/libro.js',import.meta.url),'utf8');
const counter = client.slice(0,client.indexOf('const offers ='));
let listener;
const sent=[];
const document={visibilityState:'hidden',addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>{}};
const sandbox={document,location:{hostname:'bibliafilm.com'},fetch:(url,options)=>{sent.push({url,options}); return Promise.resolve();}};
vm.runInNewContext(counter,sandbox);
assert.equal(sent.length,0);
document.visibilityState='visible'; listener(); listener();
assert.equal(sent.length,1);
assert.equal(sent[0].options.body,'visita');
assert.equal(sent[0].options.credentials,'omit');
assert.equal(sent[0].options.mode,'cors');
assert.equal(sent[0].options.referrerPolicy,'no-referrer');
assert.equal(sent[0].options.keepalive,true);
sandbox.fetch=()=>{throw Error('offline');};
vm.runInNewContext("countBookEvent('amazon')",sandbox);
const handler=client.slice(client.indexOf("offers.addEventListener('click'"),client.indexOf('syncUrl();'));
assert.ok(!handler.includes('preventDefault'));
assert.ok(!handler.includes('await '));
console.log('OK: medición mínima, privacidad, orígenes, payload, fallos, zona horaria y apertura única.');
