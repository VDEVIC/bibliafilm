(function(){
  const PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  if (!window.Stripe) return;
  const stripe = Stripe(PK);
  const $ = id => document.getElementById(id);
  const boton = $('apoyar'), aviso = $('aviso'), otro = $('otro'), detalle = $('detalle'), eligeCaja = $('eligeCaja'), zonaTarjeta = $('tarjeta'), zonaExpress = $('express'), metodosCaja = $('metodos');
  const chips = [...document.querySelectorAll('#importes button')], metodos = [...document.querySelectorAll('#metodos button')];
  let importe = 5, metodo = null, elements = null, pago = null, express = null, ocupado = false, servidorOk = true;
  const disponible = { apple: null, google: null, tarjeta: true };
  const cts = () => Math.round(importe * 100);
  const aspecto = { theme: 'stripe', variables: { colorPrimary: '#1d1d1f', colorText: '#1d1d1f', colorBackground: '#ffffff', borderRadius: '12px', fontFamily: 'EB Garamond, Georgia, serif', fontSizeBase: '17px' } };
  const fuentes = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&display=swap' }];
  const abre = el => el.classList.add('abierto');
  const cierra = el => el.classList.remove('abierto');
  function nota(t, suave){ aviso.textContent = t; aviso.classList.toggle('suave', !!suave); aviso.hidden = false; }

  fetch('/api/salud').then(r=>r.json()).then(s => { servidorOk = !!s.ok; }).catch(() => { servidorOk = false; });

  // qué monederos tiene este dispositivo (se comprueba en silencio; los iconos se ven siempre, se atenúan si no sirven aquí)
  (function sonda(){
    const e = stripe.elements({ mode: 'payment', amount: 500, currency: 'eur' });
    const s = e.create('expressCheckout', { paymentMethods: { link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' } });
    const caja = document.createElement('div'); caja.style.cssText = 'position:absolute;left:-9999px;top:0;width:300px'; document.body.appendChild(caja);
    s.mount(caja);
    const fin = () => { try { s.unmount(); caja.remove(); } catch(_){} };
    s.on('ready', ev => { const m = ev.availablePaymentMethods || {}; disponible.apple = !!m.applePay; disponible.google = !!m.googlePay; pinta(); fin(); });
    setTimeout(() => { if (disponible.apple === null) { disponible.apple = false; disponible.google = false; pinta(); } fin(); }, 8000);
  })();
  function pinta(){ metodos.forEach(b => b.classList.toggle('no', disponible[b.dataset.m] === false)); }

  function fija(v, desdeChip){
    importe = Math.max(1, Math.min(1000, Number(v) || 1));
    chips.forEach(b => b.classList.toggle('on', desdeChip && Number(b.dataset.v) === importe));
    if (elements) elements.update({ amount: cts() });
  }
  chips.forEach(b => b.onclick = () => { otro.value = ''; fija(b.dataset.v, true); });
  otro.oninput = () => { if (otro.value) fija(otro.value, false); };

  function limpia(){ if (pago) { pago.unmount(); pago = null; } if (express) { express.unmount(); express = null; } zonaTarjeta.innerHTML = ''; zonaExpress.innerHTML = ''; boton.hidden = false; }
  function elige(m){
    aviso.hidden = true;
    if (m !== 'tarjeta' && disponible[m] === false) {
      nota(m === 'apple' ? 'Apple Pay funciona en iPhone, iPad y Mac con Safari. Aquí puedes apoyar con tarjeta.' : 'Google Pay no está activo en este navegador. Aquí puedes apoyar con tarjeta.', true);
      return;
    }
    metodo = m; metodos.forEach(b => b.classList.toggle('on', b.dataset.m === m)); cierra(eligeCaja); limpia();
    elements = stripe.elements({ mode: 'payment', amount: cts(), currency: 'eur', appearance: aspecto, fonts: fuentes, locale: 'es', paymentMethodTypes: ['card'] });
    if (m === 'tarjeta') {
      pago = elements.create('payment', { layout: 'tabs', fields: { billingDetails: { name: 'never', email: 'auto', address: 'never' } }, wallets: { applePay: 'never', googlePay: 'never' } });
      pago.mount(zonaTarjeta);
    } else {
      express = elements.create('expressCheckout', { buttonHeight: 54, buttonTheme: { applePay: 'black', googlePay: 'black' }, layout: { maxColumns: 1, overflow: 'never' },
        paymentMethods: { applePay: m === 'apple' ? 'always' : 'never', googlePay: m === 'google' ? 'always' : 'never', link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' } });
      express.mount(zonaExpress); boton.hidden = true;
      express.on('confirm', () => confirma());
    }
    abre(detalle);
  }
  metodos.forEach(b => b.onclick = () => elige(b.dataset.m));

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
    if (!metodo) { abre(eligeCaja); metodosCaja.classList.remove('pide'); void metodosCaja.offsetWidth; metodosCaja.classList.add('pide'); return; }
    if (metodo === 'tarjeta') confirma();
  };
})();
