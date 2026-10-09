import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../libros/pixel.js',import.meta.url),'utf8');
function fixture(saved, broken=false) {
  const scripts=[]; const items=new Map(saved ? [['bf_publicidad_v1',JSON.stringify(saved)]] : []);
  const element=()=>({hidden:true,open:false,handlers:{},dataset:{},addEventListener(type,fn){this.handlers[type]=fn;},click(){this.handlers.click?.();},showModal(){this.open=true;},close(){this.open=false;}});
  const ids=Object.fromEntries(['pixel-consent','pixel-settings','pixel-status','pixel-preferences','pixel-more'].map(id=>[id,element()]));
  const buttons=['accepted','rejected'].map(choice=>Object.assign(element(),{dataset:{pixelChoice:choice}}));
  const window={};
  const document={getElementById:id=>ids[id],querySelectorAll:()=>buttons,createElement:()=>({}),head:{append:script=>scripts.push(script)}};
  const localStorage={getItem:key=>{if(broken)throw Error('denied');return items.get(key)||null;},setItem:(key,value)=>{if(broken)throw Error('denied');items.set(key,value);}};
  vm.runInNewContext(source,{window,document,localStorage,Date});
  return {scripts,ids,window,buttons,items};
}
const fresh=fixture(); assert.equal(fresh.scripts.length,0); assert.equal(fresh.ids['pixel-consent'].hidden,false);
fresh.buttons[1].click(); assert.equal(fresh.scripts.length,0); assert.equal(fresh.ids['pixel-consent'].hidden,true);
fresh.ids['pixel-preferences'].click(); assert.equal(fresh.ids['pixel-settings'].open,true);
fresh.buttons[0].click(); assert.equal(fresh.scripts.length,1); assert.equal(fresh.ids['pixel-settings'].open,false);
assert.match(fresh.scripts[0].src,/sdkid=DB4IV8RC77U074LG1GRG/);
assert.deepEqual(Array.from(fresh.window.ttq,entry=>entry[0]),['holdConsent','grantConsent','page']);
fresh.buttons[1].click(); assert.equal(fresh.window.ttq.at(-1)[0],'revokeConsent');
fresh.buttons[0].click(); assert.equal(fresh.scripts.length,1); assert.equal(fresh.window.ttq.at(-1)[0],'grantConsent');
assert.equal(fixture({choice:'rejected',expires:Date.now()+100000}).scripts.length,0);
assert.equal(fixture({choice:'accepted',expires:Date.now()-1}).scripts.length,0);
assert.equal(fixture({choice:'accepted',expires:Date.now()+100000}).scripts.length,1);
const deniedStorage=fixture(null,true); deniedStorage.buttons[1].click(); assert.equal(deniedStorage.scripts.length,0);
assert.equal(source.includes("track('Purchase'"),false); assert.equal(source.includes("track('CompletePayment'"),false);
console.log('Consentimiento comprobado: sin carga antes de aceptar, rechazo, caducidad, revocación y carga única. Sin eventos de compra ficticios.');
