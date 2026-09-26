// Página /nuevo/ de Biblia Film: una sola página que se desliza. Película arriba, avance, apoyo dentro de la página.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CDN = 'https://media.bibliafilm.com';
  var PK = 'pk_live_51UC5QCAeAJ1ecB8ZIMliN6fE9geFRi0kGrT80F07h1ZalAnsnvby7QQ8xncdWgHEy3n2ZRNHnescnqOv2te3P1Z600ZWdeNwnl';
  // Formas de pago dentro del bloque de tarjeta. Cuando Bizum esté activado en la cuenta de Stripe, añadir 'bizum'
  // aquí y en functions/api/apoyo.js (hoy Stripe lo rechaza: «bizum is invalid»).
  var METODOS = ['card'];

  // ---------- estado de la película (valores inline en el HTML; estado.json los refresca) ----------
  var estado = { tramo: 'Génesis 1 y 2', voz_hecha: 284.02, voz_total: 348.5, capitulos_biblia: 1189,
    pelicula: { segundos: 234.4, version: 'clip8', fecha: '2026-09-26', movil: 'pelicula-720.mp4', grande: 'pelicula.mp4' } };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function mmss(s) { s = Math.round(s); var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
  function fechaLarga(iso) { var p = (iso || '').split('-'); if (p.length !== 3) return iso || ''; return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1] + ' de ' + p[0]; }
  function pintaEstado() {
    var p = estado.pelicula, pct = Math.max(0, Math.min(100, Math.round(estado.voz_hecha / estado.voz_total * 100)));
    $('dur').textContent = mmss(p.segundos); $('hecho-min').textContent = mmss(p.segundos);
    $('tramo').textContent = estado.tramo; $('tramo-pct').textContent = pct + ' %'; $('tramo-lleno').style.width = pct + '%';
    $('caps').textContent = Number(estado.capitulos_biblia).toLocaleString('es-ES'); $('fecha').textContent = fechaLarga(p.fecha);
  }
  var cargada = false;
  fetch('estado.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    if (j && j.pelicula) { estado = j; pintaEstado(); if (cargada) preparaVideo(); }
  }).catch(function () {});

  // ---------- la película: el móvil recibe SIEMPRE la versión de 720p; nunca el original ----------
  var video = $('video'), ver = $('ver'), fijo = $('fijo');
  var pequeno = window.matchMedia('(max-width: 1024px)').matches || window.matchMedia('(pointer: coarse)').matches;
  var red = navigator.connection || {}, lenta = !!red.saveData || /(^|-)(2g|3g)$/.test(red.effectiveType || '');
  var srcPuesto = '';
  function preparaVideo() {
    var p = estado.pelicula, archivo = (pequeno || lenta || !p.grande) ? p.movil : p.grande;
    var src = CDN + '/' + archivo + '?v=' + p.version;
    if (src === srcPuesto) return; srcPuesto = src;
    video.src = src; video.preload = 'metadata';
  }
  // Se prepara (solo los datos, no el vídeo) cuando la página ya ha pintado, para no competir con el fotograma.
  var trasCarga = function () { cargada = true; setTimeout(preparaVideo, 300); };
  if (document.readyState === 'complete') trasCarga(); else window.addEventListener('load', trasCarga);
  ver.addEventListener('click', function () {
    preparaVideo(); ver.hidden = true; video.controls = true;
    var p = video.play(); if (p && p.catch) p.catch(function () { ver.hidden = false; });
  });
  var suena = false;
  video.addEventListener('play', function () { suena = true; fijoPinta(); });
  video.addEventListener('pause', function () { suena = false; fijoPinta(); });
  video.addEventListener('ended', function () { suena = false; ver.hidden = false; video.controls = false; fijoPinta(); });

  // ---------- botón fijo «Apoyar»: fuera cuando el bloque de apoyo está a la vista o suena la película ----------
  var apoyoVisible = false, pagado = false;
  function fijoPinta() { fijo.classList.toggle('oculto', apoyoVisible || suena || pagado); }
  if ('IntersectionObserver' in window) {
    // «a la vista» = se ve al menos la mitad de los importes
    new IntersectionObserver(function (es) { apoyoVisible = es[0].isIntersecting; fijoPinta(); }, { threshold: 0.5 }).observe($('importes'));
  } else { fijo.classList.add('oculto'); }

  // ---------- importes ----------
  var importe = 5, chips = Array.prototype.slice.call(document.querySelectorAll('#importes .chip[data-v]'));
  var otra = $('otra'), otraBoton = $('otra-boton'), otraInput = $('otra-input'), pagar = $('pagar'), aviso = $('aviso');
  function eur(n) { return n.toLocaleString('es-ES', { minimumFractionDigits: (n % 1 ? 2 : 0), maximumFractionDigits: 2 }) + ' €'; }
  function fija(v, desdeChip) {
    var n = Math.round(Number(v) * 100) / 100;
    if (!isFinite(n) || n < 0.5) n = 0.5; if (n > 1000) n = 1000;
    importe = n;
    chips.forEach(function (b) { b.classList.toggle('on', desdeChip && Number(b.dataset.v) === n); });
    otra.classList.toggle('on', !desdeChip);
    pagar.textContent = 'Apoyar con ' + eur(n);
    if (elements) elements.update({ amount: Math.round(n * 100) });
  }
  chips.forEach(function (b) { b.addEventListener('click', function () { otraInput.value = ''; otraInput.hidden = true; otraBoton.hidden = false; fija(b.dataset.v, true); }); });
  otraBoton.addEventListener('click', function () { otraBoton.hidden = true; otraInput.hidden = false; otraInput.focus(); otra.classList.add('on'); chips.forEach(function (b) { b.classList.remove('on'); }); });
  otraInput.addEventListener('input', function () { if (otraInput.value) fija(otraInput.value, false); });
  otraInput.addEventListener('blur', function () { if (!otraInput.value) { otraInput.hidden = true; otraBoton.hidden = false; fija(5, true); } });

  // ---------- pago: Stripe se carga al acercarse al bloque, en huecos con el alto ya reservado ----------
  var stripe = null, elements = null, expres = null, tarjeta = null, cargando = false, ocupado = false;
  var vuelta = new URLSearchParams(location.search), secretoVuelta = vuelta.get('payment_intent_client_secret');
  function nota(t) { aviso.textContent = t || ''; }
  function cargaStripe(cb) {
    if (window.Stripe) return cb();
    if (cargando) return; cargando = true;
    var s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.async = true;
    s.onload = cb; s.onerror = function () { cargando = false; nota('No se ha podido cargar el pago seguro. Inténtalo de nuevo.'); };
    document.head.appendChild(s);
  }
  var aspecto = { theme: 'night', variables: { colorPrimary: '#c9a55c', colorBackground: '#26262a', colorText: '#ece6d8', colorTextSecondary: '#a9a297', colorTextPlaceholder: '#7d786f', colorDanger: '#e39a8a', borderRadius: '10px', fontSizeBase: '17px', fontFamily: 'ui-serif, "Iowan Old Style", Palatino, Georgia, serif', spacingUnit: '4px' },
    rules: { '.Input': { border: '1px solid #3a3a3e', boxShadow: 'none', padding: '12px 14px' }, '.Input:focus': { borderColor: '#c9a55c', boxShadow: 'none' }, '.Label': { color: '#a9a297', fontSize: '13px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', letterSpacing: '0.04em' }, '.Tab': { border: '1px solid #3a3a3e', boxShadow: 'none' }, '.Tab--selected': { borderColor: '#c9a55c', boxShadow: 'none' } } };
  function monta() {
    if (elements || !window.Stripe) return;
    stripe = Stripe(PK);
    elements = stripe.elements({ mode: 'payment', currency: 'eur', amount: Math.round(importe * 100), paymentMethodTypes: METODOS, appearance: aspecto, locale: 'es' });
    expres = elements.create('expressCheckout', { buttonHeight: 54, buttonTheme: { applePay: 'white-outline', googlePay: 'white' }, layout: { maxColumns: 1, maxRows: 1, overflow: 'auto' },
      paymentMethods: { applePay: 'auto', googlePay: 'auto', link: 'never', paypal: 'never', amazonPay: 'never', klarna: 'never' } });
    expres.mount('#expres');
    expres.on('ready', function (ev) {
      var hay = ev.availablePaymentMethods && (ev.availablePaymentMethods.applePay || ev.availablePaymentMethods.googlePay);
      if (hay) return;
      // sin Apple Pay ni Google Pay, el hueco se cierra en cuanto deja de estar a la vista (así nada se mueve delante de nadie)
      var caja = $('expres');
      var cierra = function () { caja.classList.add('sin'); };
      var r = caja.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return cierra();
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (!es[0].isIntersecting) { o.disconnect(); cierra(); } }).observe(caja);
    });
    expres.on('click', function (ev) { ev.resolve(); });
    expres.on('confirm', function () { confirma(); });
    tarjeta = elements.create('payment', { layout: { type: 'tabs' }, wallets: { applePay: 'never', googlePay: 'never' }, terms: { card: 'never' } });
    tarjeta.mount('#tarjeta');
    tarjeta.on('ready', function () { $('tarjeta-zona').classList.add('lista'); });
    tarjeta.on('loaderror', function () { nota('No se ha podido cargar el pago seguro. Inténtalo de nuevo.'); });
  }
  if (secretoVuelta) {
    // vuelta de un pago con redirección (por ejemplo Bizum)
    cargaStripe(function () { stripe = Stripe(PK); stripe.retrievePaymentIntent(secretoVuelta).then(function (r) {
      var pi = r.paymentIntent;
      if (pi && (pi.status === 'succeeded' || pi.status === 'processing')) gracias(pi.id, secretoVuelta);
      else { nota('El pago no ha llegado a hacerse. Puedes intentarlo de nuevo cuando quieras.'); monta(); }
      history.replaceState(null, '', location.pathname + '#apoyo');
    }); });
  } else {
    // Stripe se prepara cuando el bloque de apoyo se acerca, y nunca antes de que la página haya pintado del todo.
    var vigila = function () {
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); cargaStripe(monta); } }, { rootMargin: '900px 0px' }).observe($('apoyo'));
      else cargaStripe(monta);
    };
    if (document.readyState === 'complete') vigila(); else window.addEventListener('load', vigila);
  }

  function intento() {
    return fetch('/api/apoyo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importe: importe }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.clientSecret) throw new Error(j.error === 'importe' ? 'Importe no válido.' : 'No se ha podido preparar el pago.'); return j; }); });
  }
  function confirma() {
    if (ocupado) return; ocupado = true; nota(''); pagar.disabled = true;
    var datos;
    (elements ? Promise.resolve() : Promise.reject(new Error('El pago aún se está preparando.')))
      .then(function () { return elements.submit(); }).then(function (r) { if (r && r.error) throw r.error; return intento(); })
      .then(function (j) { datos = j; return stripe.confirmPayment({ elements: elements, clientSecret: j.clientSecret, redirect: 'if_required', confirmParams: { return_url: location.origin + '/nuevo/' } }); })
      .then(function (r) {
        if (r.error) throw r.error;
        var pi = r.paymentIntent; if (pi && (pi.status === 'succeeded' || pi.status === 'processing')) gracias(pi.id, datos.clientSecret);
        else nota('El pago no ha llegado a hacerse.');
      })
      .catch(function (e) { nota((e && e.message) || 'No se ha podido completar el pago.'); })
      .then(function () { ocupado = false; pagar.disabled = false; });
  }
  pagar.addEventListener('click', confirma);

  // ---------- tras pagar: gracias, nombre en los créditos, compartir ----------
  var pagoId = '', pagoSecreto = '';
  function gracias(id, secreto) {
    pagoId = id; pagoSecreto = secreto; pagado = true; fijoPinta();
    $('pagar-zona').hidden = true; $('gracias').hidden = false;
    $('apoyo').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  $('nombre-boton').addEventListener('click', function () {
    var n = $('nombre').value.replace(/\s+/g, ' ').trim(); if (!n) { $('nombre').focus(); return; }
    var b = $('nombre-boton'); b.disabled = true;
    fetch('/api/creditos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pagoId, secreto: pagoSecreto, nombre: n }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(); return j; }); })
      .then(function (j) { $('nombre-hecho').textContent = 'Listo: «' + j.nombre + '» saldrá en los créditos.'; $('nombre').disabled = true; pintaCreditos(); })
      .catch(function () { $('nombre-hecho').textContent = 'No se ha podido guardar. Inténtalo de nuevo.'; b.disabled = false; });
  });
  $('compartir').addEventListener('click', function () {
    var datos = { title: 'Biblia Film', text: 'La Biblia, palabra por palabra, convertida en película.', url: 'https://bibliafilm.com' };
    if (navigator.share) { navigator.share(datos).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(datos.url).then(function () { $('compartir').textContent = 'Enlace copiado'; });
  });

  // ---------- los créditos: solo cuando hay nombres de verdad ----------
  function pintaCreditos() {
    fetch('/api/creditos').then(function (r) { return r.json(); }).then(function (j) {
      var ns = (j && j.nombres) || []; if (!ns.length) return;
      var ul = $('nombres'); ul.textContent = '';
      ns.forEach(function (n) { var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
      $('creditos').hidden = false;
    }).catch(function () {});
  }
  pintaCreditos();
  pintaEstado();
})();
