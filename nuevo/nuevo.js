'use strict';
const $=s=>document.querySelector(s);
let amount=5, paymentReady, previousFocus;
const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
const sourceOrigin=location.hostname==='localhost'||location.hostname==='127.0.0.1'?'https://bibliafilm.com':location.origin;
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),3500);}
function selectAmount(n){amount=n;document.querySelectorAll('[data-amount]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.amount)===n&&!$('#custom-amount').value)));$('#support-label').textContent=Number.isFinite(n)&&n>=.5&&n<=1000?'Continuar con '+euro(n):'Elige una cantidad';}
document.querySelectorAll('[data-amount]').forEach(b=>b.addEventListener('click',()=>{$('#custom-amount').value='';selectAmount(Number(b.dataset.amount));}));
$('#custom-amount').addEventListener('input',e=>selectAmount(e.target.value?Number(e.target.value):5));
const dialog=$('#payment-dialog');
$('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.style.overflow='';$('#acepto').checked=false;previousFocus?.focus({preventScroll:true});});
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('No se ha podido conectar con el servicio de pago.'));};document.head.append(script);});}
async function preparePayment(){
 if(!window.Stripe)await loadScript('https://js.stripe.com/v3/');
 await loadScript('/nuevo/apoyo.js?v=1');
}
$('#support-form').addEventListener('submit',async e=>{
 e.preventDefault();const custom=$('#custom-amount');if(!Number.isFinite(amount)||amount<.5||amount>1000){custom.setCustomValidity('Elige una cantidad entre 0,50 € y 1.000 €.');custom.reportValidity();custom.setCustomValidity('');return;}
 amount=Math.round(amount*100)/100;previousFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';
 if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){$('#payment-loading').textContent='Vista de prueba: los pagos se activan únicamente en bibliafilm.com.';return;}
 try{
  if(!paymentReady)paymentReady=preparePayment().catch(error=>{paymentReady=null;throw error;});await paymentReady;
  $('#payment-loading').hidden=true;$('#payment-content').hidden=false;
  const preset=$('#importes [data-v="'+amount+'"]');
  if(preset)preset.click();else{$('#otro').value=String(amount);$('#otro').dispatchEvent(new Event('input',{bubbles:true}));}
  if(dialog.open)$('#apoyar').click();
 }catch(error){$('#payment-loading').textContent=error.message+' Puedes volver a intentarlo cerrando esta ventana.';}
});
const video=$('#film'),overlay=$('#play-film');
$('#play-film').addEventListener('click',async()=>{try{await video.play();}catch{$('#film-error').hidden=false;}});
video.addEventListener('playing',()=>{overlay.hidden=true;$('#film-error').hidden=true;});
video.addEventListener('pause',()=>{overlay.hidden=false;});
video.addEventListener('ended',()=>{overlay.hidden=false;});
video.addEventListener('error',()=>{$('#film-error').hidden=false;});
function setDuration(seconds){if(!Number.isFinite(seconds)||seconds<=0)return;const total=Math.round(seconds);const text=Math.floor(total/60)+':'+String(total%60).padStart(2,'0');document.querySelectorAll('[data-duration]').forEach(e=>e.textContent=text);}
video.addEventListener('loadedmetadata',()=>setDuration(video.duration));
fetch(sourceOrigin+'/episodios.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('metadata');return r.json();}).then(data=>{
 const validURL=value=>{const u=new URL(value,sourceOrigin+'/');if(!['https://bibliafilm.com','https://media.bibliafilm.com'].includes(u.origin))throw Error('Origen de vídeo no permitido');return u.href;};
 const movie=data.pelicula;if(!movie)return;
 if(movie.poster)video.poster=validURL(movie.poster);
 if(movie.video){const source=validURL(/^https?:|^\//.test(movie.video)?movie.video:(data.cdn||sourceOrigin+'/media').replace(/\/$/,'')+'/'+movie.video);video.querySelector('source').src=source;video.load();}
 if(movie.minutos)setDuration(Number(movie.minutos)*60);
}).catch(()=>{/* The verified film remains available if the metadata request fails. */});
$('#share-project').addEventListener('click',async()=>{
 const url=location.hostname==='bibliafilm.com'?location.origin+location.pathname:'https://bibliafilm.com/nuevo';
 if(navigator.share){try{await navigator.share({title:'Biblia Film · La Biblia, hecha cine',text:'Una película que crece con el apoyo de personas como tú.',url});return;}catch(e){if(e.name==='AbortError')return;}}
 try{await navigator.clipboard.writeText(url);toast('Enlace copiado. Gracias por compartirlo.');}catch{toast('Puedes compartir la dirección de esta página.');}
});
