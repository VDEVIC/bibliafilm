(function(){
  const PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  if (!window.Stripe) return;
  const $ = id => document.getElementById(id);
  const boton = $('apoyar'), pagar = $('pagar'), aviso = $('aviso'), otro = $('otro'), marcas = $('marcas');
  const zonas = { eligir: $('zEligir'), importes: $('zImportes'), apple: $('zApple'), google: $('zGoogle'), tarjeta: $('zTarjeta'), paypal: $('zPaypal') };
  const chips = [...document.querySelectorAll('#importes button')], iconos = [...document.querySelectorAll('#marcas button')], acepto = $('acepto');
  const agradecer = $('agradecer'), nombreAgr = $('nombre-agradecer'), tiktokAgr = $('tiktok-agradecer');
  // usuario de TikTok (opcional): sin @ ni espacios, solo letras, números, punto y guion bajo, como mucho 24 (límite de TikTok)
  const tiktok = () => (tiktokAgr.value || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 24);
  const nombrePublico = () => (nombreAgr.value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  const aceptado = () => {
    if (!acepto.checked) { nota('Marca la casilla de las condiciones para continuar.', true); acepto.focus(); return false; }
    if (agradecer.checked && !nombrePublico()) { nota('Escribe cómo quieres que aparezca tu nombre, o desmarca la casilla de los agradecimientos.', true); nombreAgr.focus(); return false; }
    return true;
  };
  agradecer.onchange = () => { nombreAgr.hidden = tiktokAgr.hidden = !agradecer.checked; if (agradecer.checked) nombreAgr.focus(); aviso.hidden = true; };
  // la moneda de quien apoya la decide la página (pantalla.js → /api/moneda); por defecto, euros
  const M = window.__moneda || { moneda: 'eur', dec: 2, paso: 0.01, min: 0.5, max: 1000, importes: [3, 5, 10, 20] };
  const fmt = v => M.moneda === 'eur' ? v.toLocaleString('es-ES') + ' €' : new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 2 }).format(v) + ' ' + M.moneda.toUpperCase();
  let importe = M.importes[1], metodo = null, ocupado = false, servidorOk = true;
  const disponible = { apple: null, google: null, tarjeta: true, paypal: true };
  // PayPal por Stripe solo cobra en estas monedas (docs.stripe.com/payments/paypal, 29-sep-2026); en las demás (pesos, soles…) va en dólares
  const PP_MONEDAS = ['eur','usd','gbp','chf','czk','dkk','nok','pln','sek','aud','cad','hkd','nzd','sgd'];
  const ppMoneda = PP_MONEDAS.includes(M.moneda) ? M.moneda : 'usd';
  let usd = null; if (ppMoneda !== M.moneda) fetch('/api/moneda?m=usd').then(r => r.json()).then(j => { usd = j; notaPP(); }).catch(() => {});
  // importe en la moneda de PayPal: el botón elegido equivale al mismo botón en dólares; «otra cantidad», en proporción
  const ppImporte = () => { if (ppMoneda === M.moneda || !usd) return importe; const i = M.importes.indexOf(importe); return i >= 0 ? usd.importes[i] : Math.max(usd.min, Math.round(importe * usd.importes[1] / M.importes[1])); };
  const ppCts = () => Math.round(ppImporte() * 100);
  function notaPP(){ const n = $('ppNota'); if (!n) return; if (ppMoneda !== M.moneda) { n.textContent = 'Con PayPal el apoyo se paga en dólares: ' + ppImporte().toLocaleString('es-ES') + ' USD.'; n.hidden = false; } }
  const cts = () => Math.round(importe * Math.pow(10, M.dec));
  const eur = () => fmt(importe);
  // los botones de importe y la casilla «otro» de esta ventana, en esa moneda
  chips.forEach((b, i) => { const v = M.importes[i]; if (v == null) return; b.dataset.v = String(v); b.setAttribute('aria-label', fmt(v)); b.textContent = M.moneda === 'eur' ? fmt(v) : new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(v); });
  otro.min = String(M.min); otro.max = String(M.max); otro.step = String(M.paso);
  otro.setAttribute('aria-label', 'Otra aportación en ' + (M.moneda === 'eur' ? 'euros' : M.moneda.toUpperCase()));
  if (otro.previousElementSibling) otro.previousElementSibling.textContent = M.moneda === 'eur' ? '€' : M.moneda.toUpperCase();
  pagar.textContent = 'Apoyar con ' + eur();
  const aspecto = { theme: 'stripe', variables: { colorPrimary: '#243724', colorText: '#1d1d1f', colorBackground: '#ffffff', colorDanger: '#a3362c', borderRadius: '4px', fontFamily: 'Arial, sans-serif', fontSizeBase: '16px' }, rules: { '.Input': { borderColor: '#e4e0d8', boxShadow: 'none' }, '.Input:focus': { borderColor: '#1d1d1f', boxShadow: '0 0 0 1px #1d1d1f' } } };
  const fuentes = [];
  const abre = z => z.classList.add('abierto'), cierra = z => z.classList.remove('abierto');
  function nota(t, suave){ aviso.textContent = t; aviso.classList.toggle('suave', !!suave); aviso.hidden = false; }
  window.addEventListener('idioma', ev => { const con = {es:'Apoyar con',en:'Support with',pt:'Apoiar com',fr:'Soutenir avec',de:'Unterstützen mit',zh:'支持',ru:'Поддержать на'}[ev.detail] || 'Apoyar con'; window.__con = con; pagar.textContent = con + ' ' + eur(); });
  fetch('/api/salud').then(r=>r.json()).then(s => { servidorOk = !!s.ok; }).catch(() => { servidorOk = false; });

  // Los marcos de pago de Stripe se montan la PRIMERA vez que se pulsa «Apoyar el proyecto», no al cargar:
  // así la página arranca sin ningún iframe de pago (más ligera y nada puede moverla), y quien no va a
  // apoyar no descarga Stripe. Stripe solo admite un botón exprés por instancia: Apple Pay, Google Pay y
  // tarjeta van cada uno en la suya, cada una en su caja plegada.
  let stripe = null, els = null;
  function monta(){
    if (els) return;
    stripe = Stripe(PK);
    const base = { mode: 'payment', currency: M.moneda, appearance: aspecto, fonts: fuentes, locale: 'es', paymentMethodTypes: ['card'] };
    const nunca = { link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' };
    const nuevo = () => stripe.elements(Object.assign({ amount: cts() }, base));
    els = { apple: nuevo(), google: nuevo(), tarjeta: nuevo() };
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
    els.tarjeta.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }).mount('#tarjeta');
    // PayPal: el botón oficial de Stripe; mientras PayPal no esté activado en la cuenta (Stripe da error), una maqueta del botón
    try {
      els.paypal = stripe.elements(Object.assign({}, base, { amount: ppCts(), currency: ppMoneda, paymentMethodTypes: ['paypal'] }));
      const exPaypal = els.paypal.create('expressCheckout', { buttonHeight: 54, buttonTheme: { paypal: 'gold' }, layout: { maxColumns: 1, overflow: 'never' }, paymentMethods: { paypal: 'always', applePay: 'never', googlePay: 'never', link: 'never', amazonPay: 'never', klarna: 'never' } });
      exPaypal.mount('#expressPaypal');
      exPaypal.on('ready', ev => { if (!(ev.availablePaymentMethods||{}).paypal) maquetaPP(); });
      exPaypal.on('loaderror', () => maquetaPP());
      exPaypal.on('click', ev => { if (aceptado()) ev.resolve(); });
      exPaypal.on('confirm', () => confirma());
      setTimeout(() => { if (!$('expressPaypal').querySelector('iframe') || !$('expressPaypal').offsetHeight) maquetaPP(); }, 8000);
    } catch (e) { delete els.paypal; maquetaPP(); }
    notaPP();
    setTimeout(() => { if (disponible.apple === null) disponible.apple = false; if (disponible.google === null) disponible.google = false; pinta(); }, 8000);
  }
  function maquetaPP(){
    const c = $('expressPaypal'); if (c.dataset.maqueta) return; c.dataset.maqueta = '1';
    c.innerHTML = '<button type="button" class="ppMaqueta" aria-label="Pagar con PayPal"><img src="/img/paypal.svg" alt="PayPal"></button>';
    c.firstChild.onclick = () => { if (aceptado()) nota('Vista de prueba: el cobro con PayPal se activa cuando Vic dé el visto bueno y active PayPal en Stripe.', true); };
  }
  function pinta(){
    iconos.forEach(b => b.classList.toggle('no', disponible[b.dataset.m] === false));
    // si ya había elegido un método que resulta no estar disponible, se cierra su caja y se le explica
    if (metodo && disponible[metodo] === false) { const m = metodo; metodo = null; cierra(zonas[m]); cierra(zonas.importes); iconos.forEach(b => b.classList.remove('on')); abre(zonas.eligir); elige(m); }
  }

  function fija(v, desdeChip){
    const n = Number(v) || M.min;
    importe = Math.max(M.min, Math.min(M.max, M.paso >= 1 ? Math.round(n) : Math.round(n * 100) / 100));
    chips.forEach(b => b.classList.toggle('on', desdeChip && Number(b.dataset.v) === importe));
    if (els) Object.entries(els).forEach(([k, e]) => e.update({ amount: k === 'paypal' ? ppCts() : cts() })); notaPP(); pagar.textContent = (window.__con || 'Apoyar con') + ' ' + eur();
  }
  chips.forEach(b => b.onclick = () => { otro.value = ''; fija(b.dataset.v, true); });
  otro.oninput = () => { if (otro.value) fija(otro.value, false); };

  function elige(m){
    aviso.hidden = true;
    if (disponible[m] === false) { nota(m === 'apple' ? 'Apple Pay funciona en iPhone, iPad y Mac con Safari. Aquí puedes apoyar con tarjeta.' : 'Google Pay no está activo en este navegador. Aquí puedes apoyar con tarjeta.', true); return; }
    metodo = m; iconos.forEach(b => b.classList.toggle('on', b.dataset.m === m));
    cierra(zonas.eligir); abre(zonas.importes);
    ['apple','google','tarjeta','paypal'].forEach(k => (k === m ? abre : cierra)(zonas[k]));
  }
  iconos.forEach(b => b.onclick = () => elige(b.dataset.m));

  async function intento(){
    const r = await fetch('/api/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importe: metodo === 'paypal' ? ppImporte() : importe, moneda: metodo === 'paypal' ? ppMoneda : M.moneda, metodo: metodo === 'paypal' ? 'paypal' : 'card', agradecer: agradecer.checked, nombre: agradecer.checked ? nombrePublico() : '', tiktok: agradecer.checked ? tiktok() : '' }) });
    const j = await r.json(); if (!r.ok || !j.clientSecret) throw new Error(j.error || 'No se ha podido preparar el pago'); return j.clientSecret;
  }
  async function confirma(){
    if (ocupado) return; ocupado = true; aviso.hidden = true; pagar.disabled = true;
    try {
      monta(); const elements = els[metodo || 'tarjeta'];
      const { error: e1 } = await elements.submit(); if (e1) throw e1;
      const clientSecret = await intento();
      const { error } = await stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: location.origin + '/gracias.html' } });
      if (error) throw error;
    } catch (e) { nota((e.message || 'No se ha podido completar el pago.') + (M.moneda !== 'eur' && e.type === 'card_error' ? ' Si es American Express, prueba con Visa o Mastercard.' : '')); }
    finally { ocupado = false; pagar.disabled = false; }
  }
  pagar.onclick = () => { if (aceptado()) confirma(); };
  acepto.onchange = () => { if (acepto.checked) aviso.hidden = true; };
  boton.onclick = () => {
    if (!servidorOk) { fetch('/episodios.json').then(r=>r.json()).then(d => { location.href = d.apoyo; }); return; }
    monta(); abre(zonas.eligir); abre($('zMarcas'));
    marcas.classList.remove('pide'); void marcas.offsetWidth; marcas.classList.add('pide');
  };
})();
