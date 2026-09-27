/* Medidor del laboratorio de tirones (bibliafilm.com/prueba/). Solo mide: no cambia nada de la página.
   Mientras hay un dedo en la pantalla y 1,5 s después, apunta en cada fotograma la hora y la posición de la página.
   «Atasco» = fotograma en el que el dedo se ha movido y la página no, una vez que la página ya había empezado a moverse
   (el tirón de la grabación de Vic: +85, 0, 0, 0, +59…). Al tocar «Con tirones» o «Fluida» envía el resumen a /api/lab
   y pasa a la siguiente prueba. Todos los oyentes son pasivos: nunca frenan el desplazamiento. */
(function () {
  'use strict';
  var CARGA = performance.now();
  var VENTANA_MS = 1500;   // se sigue midiendo 1,5 s tras soltar (la inercia)
  var INICIO_MS = 250;     // «inicio» del deslizamiento: el tirón medido dura ~0,15 s; 250 ms le da margen
  var TOPE_CUADROS = 150;  // fotogramas guardados uno a uno por deslizamiento (1,25 s a 120 Hz): cabe en un envío
  var META = 6;            // deslizamientos que se piden por página
  var PASIVO = { passive: true, capture: true };

  var m = location.pathname.match(/\/prueba\/(\d+)\//);
  var variante = m ? +m[1] : 0;
  var q = new URLSearchParams(location.search);
  var sesion = (q.get('s') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  var orden = (q.get('o') || '').split('-').map(Number).filter(function (n) { return n > 0 && n < 100; });
  var paso = orden.length ? parseInt(q.get('i'), 10) : NaN;
  if (!(paso >= 0 && paso < orden.length)) paso = -1;

  var intervalos = [], tramos = [], tramo = null, gestos = [], g = null;
  var dedo = false, finDedo = 0, enMarcha = false, tAnt = 0, yAnt = 0, enviado = false, cuenta = null;

  function pos() { return window.scrollY + (document.body ? document.body.scrollTop : 0); }
  function maxPos() {
    var d = document.scrollingElement || document.documentElement, b = document.body;
    return Math.max(d.scrollHeight - window.innerHeight, b ? b.scrollHeight - b.clientHeight : 0);
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function tipo(el) {
    if (!el || !el.closest) return 'otro';
    if (el.closest('#lab')) return 'lab';
    if (el.closest('.story-rail')) return 'carrusel';
    if (el.closest('a,button,summary,input,select,label')) return 'boton';
    if (el.closest('img,video,picture')) return 'imagen';
    return 'texto';
  }

  function cierraRacha() { g.rachas++; if (g.racha > g.rachaMax) g.rachaMax = g.racha; g.racha = 0; }
  function cerrarGesto() {
    if (!g) return;
    if (g.racha) cierraRacha();
    var dx = g.x - g.x0, dy = g.y - g.y0, desliz = !g.multi && Math.abs(dy) >= 30 && Math.abs(dy) > Math.abs(dx);
    var r = {
      t: Math.round(g.t0 - CARGA), dur: Math.round((g.fin || performance.now()) - g.t0), sobre: g.sobre, desliz: desliz,
      dedoDy: Math.round(dy), dedoDx: Math.round(dx), pagDy: Math.round(pos() - g.yPag0), movs: g.movs,
      arranque: g.arranque, dedoAntes: g.dedoAntes, saltoMax: r1(g.saltoMax),
      atascos: g.atascos, atascosInicio: g.atascosInicio, rachas: g.rachas, rachaMax: g.rachaMax, msQuieto: Math.round(g.msQuieto)
    };
    if (g.multi) r.multi = true;
    if (desliz) r.cuadros = g.cuadros; // [ms desde el anterior, px que se movió la página, px que se movió el dedo]
    gestos.push(r);
    g = null;
  }

  function anotar(ts, dt, y, dy) {
    var abajo = g.fin == null, df = g.y - g.yAntDedo;
    g.yAntDedo = g.y;
    var mueveDedo = abajo && Math.abs(df) >= 1, muevePag = Math.abs(dy) >= 0.5;
    if (g.cuadros.length < TOPE_CUADROS) g.cuadros.push([r1(dt), r1(dy), abajo ? r1(df) : 0]);
    if (abajo && !g.mov && muevePag) {
      g.mov = true; g.tMov = ts; g.arranque = Math.round(ts - g.t0); g.dedoAntes = Math.round(Math.abs(g.y - g.y0));
    }
    if (g.mov && ts - g.tMov <= INICIO_MS && Math.abs(dy) > g.saltoMax) g.saltoMax = Math.abs(dy);
    if (g.mov && mueveDedo && !muevePag) {
      var quiere = -df, mx = maxPos(); // no cuenta si la página ya está en su tope en esa dirección
      if (!((y <= 0.5 && quiere < 0) || (y >= mx - 0.5 && quiere > 0))) {
        g.atascos++; g.msQuieto += dt; g.racha++;
        if (ts - g.tMov <= INICIO_MS) g.atascosInicio++;
        return;
      }
    }
    if (muevePag && g.racha) cierraRacha();
  }

  function cuadro(ts) {
    var y = pos();
    if (tAnt) {
      var dt = ts - tAnt, dy = y - yAnt;
      intervalos.push(dt); tramo.push(dy);
      if (g) anotar(ts, dt, y, dy);
    }
    tAnt = ts; yAnt = y;
    if (dedo || performance.now() - finDedo < VENTANA_MS) { requestAnimationFrame(cuadro); return; }
    enMarcha = false; tAnt = 0;
    cerrarGesto();
    if (tramo.length) tramos.push(tramo);
    tramo = null;
    pintarCuenta();
  }

  function alTocar(e) {
    var t = e.touches[0];
    if (!t) return;
    if (e.touches.length > 1) { if (g) g.multi = true; return; }
    cerrarGesto();
    g = { t0: performance.now(), sobre: tipo(e.target), x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, yAntDedo: t.clientY,
          movs: 0, multi: false, fin: null, yPag0: pos(), mov: false, tMov: 0, arranque: null, dedoAntes: null, saltoMax: 0,
          atascos: 0, atascosInicio: 0, rachas: 0, rachaMax: 0, racha: 0, msQuieto: 0, cuadros: [] };
    dedo = true;
    if (!enMarcha) { enMarcha = true; tAnt = 0; tramo = []; requestAnimationFrame(cuadro); }
  }
  function alMover(e) {
    var t = e.touches[0];
    if (!g || !t) return;
    g.x = t.clientX; g.y = t.clientY; g.movs++;
  }
  function alSoltar(e) {
    if (e.touches.length) return;
    if (g) {
      var t = e.changedTouches && e.changedTouches[0];
      if (t) { g.x = t.clientX; g.y = t.clientY; }
      if (g.fin == null) g.fin = performance.now();
    }
    dedo = false; finDedo = performance.now();
  }
  addEventListener('touchstart', alTocar, PASIVO);
  addEventListener('touchmove', alMover, PASIVO);
  addEventListener('touchend', alSoltar, PASIVO);
  addEventListener('touchcancel', alSoltar, PASIVO);

  function mediana(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[s.length >> 1];
  }
  // «Huecos»: fotogramas quietos entre dos fotogramas en los que la página iba claramente en la misma dirección
  // (≥3 px por fotograma = ≥180 px/s a 60 Hz: no es el final natural de la inercia). No necesita el dedo.
  function huecos() {
    var n = 0, cuadrosH = 0, todos = tramos.concat(tramo && tramo.length ? [tramo] : []);
    todos.forEach(function (s) {
      for (var i = 1; i < s.length; i++) {
        if (Math.abs(s[i]) >= 0.5 || Math.abs(s[i - 1]) < 3) continue;
        var j = i;
        while (j < s.length && Math.abs(s[j]) < 0.5) j++;
        if (j < s.length && j - i <= 8 && Math.abs(s[j]) >= 3 && (s[j] > 0) === (s[i - 1] > 0)) { n++; cuadrosH += j - i; }
        i = j;
      }
    });
    return [n, cuadrosH];
  }

  function resumen(respuesta) {
    cerrarGesto();
    var med = mediana(intervalos), n = intervalos.length;
    var p25 = intervalos.filter(function (x) { return x > 25; }).length;
    var pRel = intervalos.filter(function (x) { return x > 1.5 * med; }).length;
    var desl = gestos.filter(function (x) { return x.desliz; });
    var suma = function (k) { return desl.reduce(function (a, x) { return a + (x[k] || 0); }, 0); };
    var h = huecos(), vv = window.visualViewport;
    var mm = function (qq) { try { return matchMedia(qq).matches; } catch (e) { return null; } };
    return {
      v: variante, sesion: sesion, orden: orden, paso: paso, respuesta: respuesta, segundos: Math.round((performance.now() - CARGA) / 1000),
      entorno: {
        ua: navigator.userAgent, dpr: window.devicePixelRatio, pantalla: [screen.width, screen.height], ventana: [innerWidth, innerHeight],
        vv: vv ? [Math.round(vv.width), Math.round(vv.height), r1(vv.scale)] : null, alto: (document.scrollingElement || document.documentElement).scrollHeight,
        app: !!navigator.standalone, menosMov: mm('(prefers-reduced-motion: reduce)'), menosTransp: mm('(prefers-reduced-transparency: reduce)'),
        cf: !!document.querySelector('script[src*="cloudflareinsights"]')
      },
      total: {
        deslizamientos: desl.length, toques: gestos.length - desl.length, cuadros: n, medianaMs: r1(med),
        hz: !med ? 0 : med < 11 ? 120 : med < 20 ? 60 : Math.round(1000 / med),
        perdidos25: p25, pctPerdidos25: n ? r1(100 * p25 / n) : 0, perdidosRel: pRel, pctPerdidosRel: n ? r1(100 * pRel / n) : 0,
        intervaloMax: r1(n ? Math.max.apply(null, intervalos) : 0),
        atascos: suma('atascos'), atascosInicio: suma('atascosInicio'), rachas: suma('rachas'),
        rachaMax: desl.reduce(function (a, x) { return Math.max(a, x.rachaMax); }, 0), msQuieto: suma('msQuieto'),
        atascosPorDesliz: desl.length ? r1(suma('atascos') / desl.length) : null,
        arranqueMediana: mediana(desl.map(function (x) { return x.arranque; }).filter(function (x) { return x != null; })),
        dedoAntesMediana: mediana(desl.map(function (x) { return x.dedoAntes; }).filter(function (x) { return x != null; })),
        huecos: h[0], cuadrosHueco: h[1]
      },
      gestos: gestos
    };
  }

  function enviar(respuesta) {
    if (enviado) return;
    enviado = true;
    var datos = resumen(respuesta), txt = JSON.stringify(datos);
    if (txt.length > 60000) { datos.gestos.forEach(function (x) { if (x.cuadros) x.cuadros = x.cuadros.slice(0, 40); }); txt = JSON.stringify(datos); }
    if (txt.length > 60000) { datos.gestos.forEach(function (x) { delete x.cuadros; }); txt = JSON.stringify(datos); }
    var ok = false;
    try { ok = navigator.sendBeacon('/api/lab', new Blob([txt], { type: 'text/plain' })); } catch (e) {}
    if (!ok) { try { fetch('/api/lab', { method: 'POST', body: txt, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) {} }
  }
  function siguiente(respuesta) {
    enviar(respuesta);
    var i = paso + 1;
    var url = paso >= 0 && i < orden.length ? '/prueba/' + orden[i] + '/?s=' + sesion + '&o=' + orden.join('-') + '&i=' + i
      : '/prueba/?fin=1' + (sesion ? '&s=' + sesion : '');
    setTimeout(function () { location.href = url; }, 60);
  }
  addEventListener('pagehide', function () { if (!enviado && gestos.length + (g ? 1 : 0) > 0) enviar('salida'); }, { passive: true });
  addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); }, { passive: true });

  function pintarCuenta() {
    if (!cuenta) return;
    var n = gestos.filter(function (x) { return x.desliz; }).length;
    cuenta.textContent = 'Llevas ' + n + '.';
  }
  // El rótulo y los botones van al final de la página, dentro del texto (sin nada fijo en pantalla: no añaden capas).
  function montar() {
    var caja = document.createElement('div');
    caja.id = 'lab';
    caja.setAttribute('style', 'display:block;position:static;margin:0;padding:22px 16px calc(30px + env(safe-area-inset-bottom));background:#fff;color:#222;border-top:1px solid #bbb;font:16px/1.45 -apple-system,system-ui,sans-serif;text-align:left;letter-spacing:0');
    var titulo = paso >= 0 ? 'Prueba ' + (paso + 1) + ' de ' + orden.length : 'Prueba ' + variante;
    var boton = 'flex:1;min-height:50px;margin:0;padding:10px;border:1px solid #888;border-radius:10px;background:#f1f1f1;color:#111;font:600 17px/1.2 -apple-system,system-ui,sans-serif';
    caja.innerHTML = '<p style="margin:0 0 4px;font-weight:600;font-size:16px;color:#222">' + titulo + '</p>' +
      '<p style="margin:0 0 14px;font-size:16px;color:#222">Desliza arriba y abajo ' + META + ' veces y di cómo iba. <span id="lab-cuenta">Llevas 0.</span></p>' +
      '<div style="display:flex;gap:10px"><button type="button" data-r="tirones" style="' + boton + '">Con tirones</button>' +
      '<button type="button" data-r="fluida" style="' + boton + '">Fluida</button></div>';
    document.body.appendChild(caja);
    cuenta = caja.querySelector('#lab-cuenta');
    [].forEach.call(caja.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { siguiente(b.getAttribute('data-r')); }, { passive: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { passive: true });
  else montar();
})();
