(function(){
  const PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  if (!window.Stripe) return;
  const stripe = Stripe(PK);
  const $ = id => document.getElementById(id);
  const boton = $('pagar'), aviso = $('aviso'), otro = $('otro'), chips = [...document.querySelectorAll('#importes button')], enlace = $('enlace');
  // si el servidor de cobros aún no está listo, se enseña el enlace de pago de Stripe
  fetch('/api/salud').then(r=>r.json()).then(s => { if (!s.ok) throw 0; }).catch(() => { fetch('episodios.json').then(r=>r.json()).then(d => { enlace.href = d.apoyo; }); ['importes','express','tarjeta','pagar'].forEach(id => { const e=$(id); if(e) e.hidden = true; }); $('importes').style.display='none'; enlace.hidden = false; });
  let importe = 5, elements, pago, express, listo = false, ocupado = false;
  const cts = () => Math.round(importe * 100);
  const aspecto = { theme: 'stripe', variables: { colorPrimary: '#1d1d1f', colorText: '#1d1d1f', colorBackground: '#ffffff', borderRadius: '12px', fontFamily: 'EB Garamond, Georgia, serif', fontSizeBase: '17px' } };
  const fuentes = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&display=swap' }];

  function pinta(){ boton.textContent = 'Apoyar con ' + importe.toLocaleString('es-ES') + ' €'; }
  function fija(v, desdeChip){
    importe = Math.max(1, Math.min(1000, Number(v) || 1)); pinta();
    chips.forEach(b => b.classList.toggle('on', desdeChip && Number(b.dataset.v) === importe));
    if (elements) elements.update({ amount: cts() });
  }
  chips.forEach(b => b.onclick = () => { otro.value = ''; fija(b.dataset.v, true); });
  otro.oninput = () => { if (otro.value) fija(otro.value, false); };

  function monta(){
    elements = stripe.elements({ mode: 'payment', amount: cts(), currency: 'eur', appearance: aspecto, fonts: fuentes, locale: 'es' });
    express = elements.create('expressCheckout', { buttonHeight: 48, buttonTheme: { applePay: 'black', googlePay: 'black' }, layout: { maxColumns: 2, overflow: 'never' } });
    express.mount('#express');
    express.on('confirm', async () => { await confirma(); });
    pago = elements.create('payment', { layout: 'tabs', fields: { billingDetails: { name: 'never', email: 'auto', address: 'never' } }, wallets: { applePay: 'never', googlePay: 'never' } });
    pago.mount('#tarjeta');
    pago.on('ready', () => { listo = true; });
  }
  async function intento(){
    const r = await fetch('/api/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importe }) });
    const j = await r.json(); if (!r.ok || !j.clientSecret) throw new Error(j.error || 'No se ha podido preparar el pago');
    return j.clientSecret;
  }
  async function confirma(){
    if (ocupado) return; ocupado = true; aviso.hidden = true; boton.disabled = true;
    try {
      const { error: e1 } = await elements.submit(); if (e1) throw e1;
      const clientSecret = await intento();
      const { error } = await stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: location.origin + '/gracias.html' } });
      if (error) throw error;
    } catch (e) { aviso.textContent = e.message || 'No se ha podido completar el pago.'; aviso.hidden = false; }
    finally { ocupado = false; boton.disabled = false; }
  }
  boton.onclick = confirma;
  pinta(); monta();
})();
