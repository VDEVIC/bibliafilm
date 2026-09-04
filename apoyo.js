(function(){
  const PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  if (!window.Stripe) return;
  const stripe = Stripe(PK);
  const $ = id => document.getElementById(id);
  const boton = $('apoyar'), pagar = $('pagar'), aviso = $('aviso'), otro = $('otro'), marcas = $('marcas');
  const zonas = { eligir: $('zEligir'), importes: $('zImportes'), apple: $('zApple'), google: $('zGoogle'), tarjeta: $('zTarjeta') };
  const chips = [...document.querySelectorAll('#importes button')], iconos = [...document.querySelectorAll('#marcas button')], acepto = $('acepto');
  const aceptado = () => { if (acepto.checked) return true; nota('Marca la casilla de las condiciones para continuar.', true); acepto.focus(); return false; };
  let importe = 5, metodo = null, abierto = false, ocupado = false, servidorOk = true;
  const disponible = { apple: null, google: null, tarjeta: true };
  const cts = () => Math.round(importe * 100);
  const eur = () => importe.toLocaleString('es-ES') + ' €';
  const aspecto = { theme: 'stripe', variables: { colorPrimary: '#1d1d1f', colorText: '#1d1d1f', colorBackground: '#ffffff', colorDanger: '#a3362c', borderRadius: '12px', fontFamily: 'EB Garamond, Georgia, serif', fontSizeBase: '17px' }, rules: { '.Input': { borderColor: '#e4e0d8', boxShadow: 'none' }, '.Input:focus': { borderColor: '#1d1d1f', boxShadow: '0 0 0 1px #1d1d1f' } } };
  const fuentes = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&display=swap' }];
  const abre = z => z.classList.add('abierto'), cierra = z => z.classList.remove('abierto');
  function nota(t, suave){ aviso.textContent = t; aviso.classList.toggle('suave', !!suave); aviso.hidden = false; }
  fetch('/api/salud').then(r=>r.json()).then(s => { servidorOk = !!s.ok; }).catch(() => { servidorOk = false; });

  // todo precargado: cada forma de pago vive en su propia caja plegada y solo se abre la elegida
  // (Stripe solo admite un botón exprés por instancia, así que Apple Pay, Google Pay y tarjeta van cada uno en la suya)
  const base = { mode: 'payment', currency: 'eur', appearance: aspecto, fonts: fuentes, locale: 'es', paymentMethodTypes: ['card'] };
  const nunca = { link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' };
  const els = { apple: stripe.elements(Object.assign({ amount: cts() }, base)), google: stripe.elements(Object.assign({ amount: cts() }, base)), tarjeta: stripe.elements(Object.assign({ amount: cts() }, base)) };
  const exApple = els.apple.create('expressCheckout', { buttonHeight: 54, buttonTheme: { applePay: 'black' }, layout: { maxColumns: 1, overflow: 'never' }, paymentMethods: Object.assign({ applePay: 'always', googlePay: 'never' }, nunca) });
  exApple.mount('#expressApple');
  exApple.on('ready', ev => { disponible.apple = !!(ev.availablePaymentMethods||{}).applePay; pinta(); });
  exApple.on('click', ev => { if (aceptado()) ev.resolve(); });
  exApple.on('confirm', () => confirma());
  const exGoogle = els.google.create('expressCheckout', { buttonHeight: 54, buttonTheme: { googlePay: 'black' }, layout: { maxColumns: 1, overflow: 'never' }, paymentMethods: Object.assign({ applePay: 'never', googlePay: 'always' }, nunca) });
  exGoogle.mount('#expressGoogle');
  exGoogle.on('ready', ev => { disponible.google = !!(ev.availablePaymentMethods||{}).googlePay; pinta(); });
  exGoogle.on('click', ev => { if (aceptado()) ev.resolve(); });
  exGoogle.on('confirm', () => confirma());
  const pago = els.tarjeta.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } });
  pago.mount('#tarjeta');
  setTimeout(() => { if (disponible.apple === null) disponible.apple = false; if (disponible.google === null) disponible.google = false; pinta(); }, 8000);
  function pinta(){ iconos.forEach(b => b.classList.toggle('no', disponible[b.dataset.m] === false)); }

  function fija(v, desdeChip){
    importe = Math.max(0.5, Math.min(1000, Math.round((Number(v) || 0.5) * 100) / 100));
    chips.forEach(b => b.classList.toggle('on', desdeChip && Number(b.dataset.v) === importe));
    Object.values(els).forEach(e => e.update({ amount: cts() })); pagar.textContent = 'Apoyar con ' + eur();
  }
  chips.forEach(b => b.onclick = () => { otro.value = ''; fija(b.dataset.v, true); });
  otro.oninput = () => { if (otro.value) fija(otro.value, false); };

  function elige(m){
    aviso.hidden = true;
    if (disponible[m] === false) { nota(m === 'apple' ? 'Apple Pay funciona en iPhone, iPad y Mac con Safari. Aquí puedes apoyar con tarjeta.' : 'Google Pay no está activo en este navegador. Aquí puedes apoyar con tarjeta.', true); return; }
    metodo = m; iconos.forEach(b => b.classList.toggle('on', b.dataset.m === m));
    cierra(zonas.eligir); abre(zonas.importes);
    ['apple','google','tarjeta'].forEach(k => (k === m ? abre : cierra)(zonas[k]));
  }
  iconos.forEach(b => b.onclick = () => { if (!abierto) { abierto = true; } elige(b.dataset.m); });

  async function intento(){
    const r = await fetch('/api/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importe }) });
    const j = await r.json(); if (!r.ok || !j.clientSecret) throw new Error(j.error || 'No se ha podido preparar el pago'); return j.clientSecret;
  }
  async function confirma(){
    if (ocupado) return; ocupado = true; aviso.hidden = true; pagar.disabled = true;
    try {
      const elements = els[metodo || 'tarjeta'];
      const { error: e1 } = await elements.submit(); if (e1) throw e1;
      const clientSecret = await intento();
      const { error } = await stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: location.origin + '/gracias.html' } });
      if (error) throw error;
    } catch (e) { nota(e.message || 'No se ha podido completar el pago.'); }
    finally { ocupado = false; pagar.disabled = false; }
  }
  pagar.onclick = () => { if (aceptado()) confirma(); };
  acepto.onchange = () => { if (acepto.checked) aviso.hidden = true; };
  boton.onclick = () => {
    if (!servidorOk) { fetch('episodios.json').then(r=>r.json()).then(d => { location.href = d.apoyo; }); return; }
    abierto = true; abre(zonas.eligir); abre($('zMarcas'));
    marcas.classList.remove('pide'); void marcas.offsetWidth; marcas.classList.add('pide');
  };
})();
