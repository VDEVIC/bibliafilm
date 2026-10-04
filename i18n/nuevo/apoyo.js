(function(){
  const PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  // vista previa *.pages.dev (entorno de pruebas): nunca se monta el pago
  if (!window.Stripe || /\.pages\.dev$/i.test(location.hostname)) return;
  const $ = id => document.getElementById(id);
  // Idioma de la página (<html lang>) y sus textos: en español salvo que la página traiga los suyos en #textos (/en/, /pt/).
  const LANG = (/^(en|pt)\b/i.exec(document.documentElement.lang || '') || ['es'])[0].toLowerCase();
  const LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR' }[LANG];
  const T = Object.assign({
    marcaCondiciones: 'Marca la casilla de las condiciones para continuar.',
    escribeNombre: 'Escribe cómo quieres que aparezca tu nombre, o desmarca la casilla de los agradecimientos.',
    otraAportacionEn: 'Otra aportación en {moneda}',
    euros: 'euros',
    apoyarCon: 'Apoyar con {importe}',
    applePayNo: 'Apple Pay funciona en iPhone, iPad y Mac con Safari. Aquí puedes apoyar con tarjeta.',
    googlePayNo: 'Google Pay no está activo en este navegador. Aquí puedes apoyar con tarjeta.',
    prepararFallo: 'No se ha podido preparar el pago',
    pagoFallo: 'No se ha podido completar el pago.',
    amex: ' Si es American Express, prueba con Visa o Mastercard.'
  }, (() => { try { return JSON.parse(($('textos') || {}).textContent || '{}'); } catch (e) { return {}; } })());
  const t = (key, values) => String(T[key] == null ? '' : T[key]).replace(/\{(\w+)\}/g, (all, name) => values && name in values ? values[name] : all);
  // Los códigos del servidor (functions/api/intento.js: 'moneda', 'importe', 'peticion' o el mensaje de Stripe) se
  // traducen si la página trae frase para ellos (error_moneda…, errorServicio); en español se enseñan como siempre.
  const errorServidor = codigo => (codigo && (T['error_' + codigo] || T.errorServicio)) || codigo || T.prepararFallo;
  const boton = $('apoyar'), pagar = $('pagar'), aviso = $('aviso'), otro = $('otro'), marcas = $('marcas');
  const zonas = { eligir: $('zEligir'), importes: $('zImportes'), apple: $('zApple'), google: $('zGoogle'), tarjeta: $('zTarjeta') };
  const chips = [...document.querySelectorAll('#importes button')], iconos = [...document.querySelectorAll('#marcas button')], acepto = $('acepto');
  const agradecer = $('agradecer'), nombreAgr = $('nombre-agradecer'), tiktokAgr = $('tiktok-agradecer');
  // usuario de TikTok (opcional): sin @ ni espacios, solo letras, números, punto y guion bajo, como mucho 24 (límite de TikTok)
  const tiktok = () => (tiktokAgr.value || '').trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 24);
  const nombrePublico = () => (nombreAgr.value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  const aceptado = () => {
    if (!acepto.checked) { nota(T.marcaCondiciones, true); acepto.focus(); return false; }
    if (agradecer.checked && !nombrePublico()) { nota(T.escribeNombre, true); nombreAgr.focus(); return false; }
    return true;
  };
  agradecer.onchange = () => { nombreAgr.hidden = tiktokAgr.hidden = !agradecer.checked; if (agradecer.checked) nombreAgr.focus(); aviso.hidden = true; };
  // la moneda de quien apoya la decide la página (pantalla.js → /api/moneda); por defecto, euros
  const M = window.__moneda || { moneda: 'eur', dec: 2, paso: 0.01, min: 0.5, max: 1000, importes: [3, 5, 10, 20] };
  // en español, como siempre (5 €, 20.000 COP); en inglés y portugués, el formato de moneda de su idioma ($5, R$ 20)
  const fmt = v => LANG === 'es'
    ? (M.moneda === 'eur' ? v.toLocaleString('es-ES') + ' €' : new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 2 }).format(v) + ' ' + M.moneda.toUpperCase())
    : new Intl.NumberFormat(LOCALE, { style: 'currency', currency: M.moneda.toUpperCase(), minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  let importe = M.importes[1], metodo = null, ocupado = false, servidorOk = true;
  const disponible = { apple: null, google: null, tarjeta: true };
  const cts = () => Math.round(importe * Math.pow(10, M.dec));
  const eur = () => fmt(importe);
  // los botones de importe y la casilla «otro» de esta ventana, en esa moneda
  chips.forEach((b, i) => { const v = M.importes[i]; if (v == null) return; b.dataset.v = String(v); b.setAttribute('aria-label', fmt(v)); b.textContent = M.moneda === 'eur' ? fmt(v) : new Intl.NumberFormat(LOCALE, { useGrouping: 'always' }).format(v); });
  otro.min = String(M.min); otro.max = String(M.max); otro.step = String(M.paso);
  otro.setAttribute('aria-label', t('otraAportacionEn', { moneda: M.moneda === 'eur' ? T.euros : M.moneda.toUpperCase() }));
  if (otro.previousElementSibling) otro.previousElementSibling.textContent = M.moneda === 'eur' ? '€' : M.moneda.toUpperCase();
  pagar.textContent = t('apoyarCon', { importe: eur() });
  const aspecto = { theme: 'stripe', variables: { colorPrimary: '#243724', colorText: '#1d1d1f', colorBackground: '#ffffff', colorDanger: '#a3362c', borderRadius: '4px', fontFamily: 'Arial, sans-serif', fontSizeBase: '16px' }, rules: { '.Input': { borderColor: '#e4e0d8', boxShadow: 'none' }, '.Input:focus': { borderColor: '#1d1d1f', boxShadow: '0 0 0 1px #1d1d1f' } } };
  const fuentes = [];
  const abre = z => z.classList.add('abierto'), cierra = z => z.classList.remove('abierto');
  function nota(t, suave){ aviso.textContent = t; aviso.classList.toggle('suave', !!suave); aviso.hidden = false; }
  fetch('/api/salud').then(r=>r.json()).then(s => { servidorOk = !!s.ok; }).catch(() => { servidorOk = false; });

  // Los marcos de pago de Stripe se montan la PRIMERA vez que se pulsa «Apoyar el proyecto», no al cargar:
  // así la página arranca sin ningún iframe de pago (más ligera y nada puede moverla), y quien no va a
  // apoyar no descarga Stripe. Stripe solo admite un botón exprés por instancia: Apple Pay, Google Pay y
  // tarjeta van cada uno en la suya, cada una en su caja plegada.
  let stripe = null, els = null;
  function monta(){
    if (els) return;
    // los mensajes de Stripe (tarjeta rechazada…) salen en el idioma de la página; en español, como siempre (sin locale)
    stripe = LANG === 'es' ? Stripe(PK) : Stripe(PK, { locale: { en: 'en', pt: 'pt-BR' }[LANG] });
    const base = { mode: 'payment', currency: M.moneda, appearance: aspecto, fonts: fuentes, locale: { es: 'es', en: 'en', pt: 'pt-BR' }[LANG], paymentMethodTypes: ['card'] };
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
    setTimeout(() => { if (disponible.apple === null) disponible.apple = false; if (disponible.google === null) disponible.google = false; pinta(); }, 8000);
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
    if (els) Object.values(els).forEach(e => e.update({ amount: cts() })); pagar.textContent = t('apoyarCon', { importe: eur() });
  }
  chips.forEach(b => b.onclick = () => { otro.value = ''; fija(b.dataset.v, true); });
  otro.oninput = () => { if (otro.value) fija(otro.value, false); };

  function elige(m){
    aviso.hidden = true;
    if (disponible[m] === false) { nota(m === 'apple' ? T.applePayNo : T.googlePayNo, true); return; }
    metodo = m; iconos.forEach(b => b.classList.toggle('on', b.dataset.m === m));
    cierra(zonas.eligir); abre(zonas.importes);
    ['apple','google','tarjeta'].forEach(k => (k === m ? abre : cierra)(zonas[k]));
  }
  iconos.forEach(b => b.onclick = () => elige(b.dataset.m));

  async function intento(){
    const r = await fetch('/api/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importe, moneda: M.moneda, idioma: LANG, agradecer: agradecer.checked, nombre: agradecer.checked ? nombrePublico() : '', tiktok: agradecer.checked ? tiktok() : '' }) });
    const j = await r.json(); if (!r.ok || !j.clientSecret) throw new Error(errorServidor(j.error)); return j.clientSecret;
  }
  async function confirma(){
    if (ocupado) return; ocupado = true; aviso.hidden = true; pagar.disabled = true;
    try {
      monta(); const elements = els[metodo || 'tarjeta'];
      const { error: e1 } = await elements.submit(); if (e1) throw e1;
      const clientSecret = await intento();
      const { error } = await stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: location.origin + { es: '/gracias.html', en: '/en/gracias', pt: '/pt/gracias' }[LANG] } });
      if (error) throw error;
    } catch (e) { nota((e.message || T.pagoFallo) + (M.moneda !== 'eur' && e.type === 'card_error' ? T.amex : '')); }
    finally { ocupado = false; pagar.disabled = false; }
  }
  pagar.onclick = () => { if (aceptado()) confirma(); };
  acepto.onchange = () => { if (acepto.checked) aviso.hidden = true; };
  boton.onclick = () => {
    // sin servidor de pago: el enlace de pago de Stripe (si episodios.json trae uno para este idioma, «apoyo_en» o «apoyo_pt», ese)
    if (!servidorOk) { fetch('/i18n/episodios.json').then(r=>r.json()).then(d => { location.href = (LANG !== 'es' && d['apoyo_' + LANG]) || d.apoyo; }); return; }
    monta(); abre(zonas.eligir); abre($('zMarcas'));
    marcas.classList.remove('pide'); void marcas.offsetWidth; marcas.classList.add('pide');
  };
})();
