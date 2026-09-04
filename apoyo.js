(function(){
  const PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  if (!window.Stripe) return;
  const stripe = Stripe(PK);
  const $ = id => document.getElementById(id);
  const boton = $('apoyar'), aviso = $('aviso'), otro = $('otro'), detalle = $('detalle'), o = $('o');
  const chips = [...document.querySelectorAll('#importes button')];
  let importe = 5, abierto = false, ocupado = false, servidorOk = true;
  const cts = () => Math.round(importe * 100);
  const aspecto = { theme: 'stripe', variables: { colorPrimary: '#1d1d1f', colorText: '#1d1d1f', colorBackground: '#ffffff', colorDanger: '#a3362c', borderRadius: '12px', fontFamily: 'EB Garamond, Georgia, serif', fontSizeBase: '17px', spacingUnit: '4px' }, rules: { '.Input': { borderColor: '#e4e0d8', boxShadow: 'none' }, '.Input:focus': { borderColor: '#1d1d1f', boxShadow: '0 0 0 1px #1d1d1f' }, '.Tab': { borderColor: '#e4e0d8' } } };
  const fuentes = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&display=swap' }];
  function nota(t, suave){ aviso.textContent = t; aviso.classList.toggle('suave', !!suave); aviso.hidden = false; }

  fetch('/api/salud').then(r=>r.json()).then(s => { servidorOk = !!s.ok; }).catch(() => { servidorOk = false; });

  // todo se monta al cargar la página: al pulsar el botón solo se despliega, sin esperas
  const elements = stripe.elements({ mode: 'payment', amount: cts(), currency: 'eur', appearance: aspecto, fonts: fuentes, locale: 'es', paymentMethodTypes: ['card'] });
  const express = elements.create('expressCheckout', { buttonHeight: 48, buttonTheme: { applePay: 'black', googlePay: 'black' }, layout: { maxColumns: 2, overflow: 'never' }, paymentMethods: { link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' } });
  express.mount('#express');
  express.on('ready', ev => { const m = ev.availablePaymentMethods || {}; const hay = Object.values(m).some(Boolean); o.hidden = !hay; if (!hay) $('express').style.display = 'none'; });
  express.on('confirm', () => confirma());
  const pago = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } });
  pago.mount('#tarjeta');

  function fija(v, desdeChip){
    importe = Math.max(1, Math.min(1000, Number(v) || 1));
    chips.forEach(b => b.classList.toggle('on', desdeChip && Number(b.dataset.v) === importe));
    elements.update({ amount: cts() });
  }
  chips.forEach(b => b.onclick = () => { otro.value = ''; fija(b.dataset.v, true); });
  otro.oninput = () => { if (otro.value) fija(otro.value, false); };

  async function intento(){
    const r = await fetch('/api/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importe }) });
    const j = await r.json(); if (!r.ok || !j.clientSecret) throw new Error(j.error || 'No se ha podido preparar el pago'); return j.clientSecret;
  }
  async function confirma(){
    if (ocupado) return; ocupado = true; aviso.hidden = true; boton.disabled = true;
    try {
      const { error: e1 } = await elements.submit(); if (e1) throw e1;
      const clientSecret = await intento();
      const { error } = await stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: location.origin + '/gracias.html' } });
      if (error) throw error;
    } catch (e) { nota(e.message || 'No se ha podido completar el pago.'); }
    finally { ocupado = false; boton.disabled = false; }
  }
  boton.onclick = () => {
    if (!servidorOk) { fetch('episodios.json').then(r=>r.json()).then(d => { location.href = d.apoyo; }); return; }
    if (!abierto) { abierto = true; detalle.classList.add('abierto'); setTimeout(() => detalle.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120); return; }
    confirma();
  };
})();
