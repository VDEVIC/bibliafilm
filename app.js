(async function(){
  const $ = id => document.getElementById(id);
  const [d, biblia, prog] = await Promise.all([
    fetch('episodios.json?'+Date.now()).then(r=>r.json()),
    fetch('biblia.json?'+Date.now()).then(r=>r.json()),
    fetch('progreso.json?'+Date.now()).then(r=>r.json())
  ]);
  const cdn = (d.cdn||'media').replace(/\/$/,'');
  const url = p => p ? ((p.startsWith('http') || p.startsWith('./') || p.startsWith('/')) ? p : cdn+'/'+p) : '';
  const hecho = prog.hecho || {};
  const fmtPct = x => (x >= 10 ? Math.round(x) : Math.round(x*10)/10).toLocaleString('es-ES') + ' %';
  const num = n => n.toLocaleString('es-ES');
  let palHechas = 0, capsHechos = 0;
  biblia.libros.forEach(L => L.capitulos.forEach(C => { const h = (hecho[L.id]||{})[C.c]; if (!h) return; const f = Math.min(1,(h.clips||0)/C.clips); palHechas += C.palabras*f; if (f>=1) capsHechos++; }));
  const pct = palHechas / biblia.palabras * 100;
  $('pro-pct').textContent = fmtPct(pct);
  $('pro-lleno').style.width = (pct > 0 ? Math.max(pct, 0.6) : 0) + '%';
  $('pro-pie').textContent = `${num(capsHechos)} de ${num(biblia.capitulos)} capítulos · ${num(biblia.libros.length)} libros`;
  // idiomas: textos de la página y pista de subtítulos de la película
  const T = {
    es:{titulo:'Película completa <span>de la Biblia.</span>',intro:'Cada día iremos sumando contenido según vayamos recibiendo apoyo para terminar el proyecto.',progreso:'Progreso del proyecto',caps:(h,t,l)=>`${h} de ${t} capítulos · ${l} libros`,apoyar:'Apoyar el proyecto',elige:'Elige el método de pago',acepto:'He leído y acepto las <a href="/condiciones" target="_blank" rel="noopener">condiciones del apoyo</a>.',con:'Apoyar con',otro:'otro'},
    en:{titulo:'The complete film <span>of the Bible.</span>',intro:'Every day we add more, as support comes in, until the project is finished.',progreso:'Project progress',caps:(h,t,l)=>`${h} of ${t} chapters · ${l} books`,apoyar:'Support the project',elige:'Choose a payment method',acepto:'I have read and accept the <a href="/condiciones" target="_blank" rel="noopener">support terms</a>.',con:'Support with',otro:'other'},
    pt:{titulo:'O filme completo <span>da Bíblia.</span>',intro:'Cada dia acrescentamos mais conteúdo, conforme chega o apoio, até terminar o projeto.',progreso:'Progresso do projeto',caps:(h,t,l)=>`${h} de ${t} capítulos · ${l} livros`,apoyar:'Apoiar o projeto',elige:'Escolhe a forma de pagamento',acepto:'Li e aceito as <a href="/condiciones" target="_blank" rel="noopener">condições do apoio</a>.',con:'Apoiar com',otro:'outro'},
    fr:{titulo:'Le film complet <span>de la Bible.</span>',intro:'Chaque jour nous ajoutons du contenu, au rythme des soutiens, jusqu’à terminer le projet.',progreso:'Avancement du projet',caps:(h,t,l)=>`${h} sur ${t} chapitres · ${l} livres`,apoyar:'Soutenir le projet',elige:'Choisissez le mode de paiement',acepto:'J’ai lu et j’accepte les <a href="/condiciones" target="_blank" rel="noopener">conditions du soutien</a>.',con:'Soutenir avec',otro:'autre'},
    de:{titulo:'Der komplette Film <span>der Bibel.</span>',intro:'Jeden Tag kommt neuer Inhalt hinzu, je nach Unterstützung, bis das Projekt fertig ist.',progreso:'Fortschritt des Projekts',caps:(h,t,l)=>`${h} von ${t} Kapiteln · ${l} Bücher`,apoyar:'Projekt unterstützen',elige:'Zahlungsart wählen',acepto:'Ich habe die <a href="/condiciones" target="_blank" rel="noopener">Bedingungen</a> gelesen und akzeptiere sie.',con:'Unterstützen mit',otro:'andere'},
    zh:{titulo:'圣经 <span>完整电影。</span>',intro:'我们每天都会随着支持的到来增加内容，直到项目完成。',progreso:'项目进度',caps:(h,t,l)=>`${t} 章中已完成 ${h} 章 · ${l} 卷`,apoyar:'支持这个项目',elige:'选择支付方式',acepto:'我已阅读并接受<a href="/condiciones" target="_blank" rel="noopener">支持条款</a>。',con:'支持',otro:'其他'},
    ru:{titulo:'Полный фильм <span>по Библии.</span>',intro:'Каждый день мы добавляем новый материал по мере поддержки, пока проект не будет завершён.',progreso:'Прогресс проекта',caps:(h,t,l)=>`${h} из ${t} глав · ${l} книг`,apoyar:'Поддержать проект',elige:'Выберите способ оплаты',acepto:'Я прочитал и принимаю <a href="/condiciones" target="_blank" rel="noopener">условия поддержки</a>.',con:'Поддержать на',otro:'другая'}
  };
  const sel = $('idioma');
  let lang = (() => { try { const g = localStorage.getItem('idioma'); if (g && T[g]) return g; } catch(_){} const n = (navigator.language||'es').slice(0,2).toLowerCase(); return T[n] ? n : 'es'; })();
  function aplica(){
    const t = T[lang]; document.documentElement.lang = lang; sel.value = lang;
    $('t-titulo').innerHTML = t.titulo; $('t-intro').textContent = t.intro; $('t-progreso').textContent = t.progreso;
    $('apoyar').textContent = t.apoyar; $('t-elige').textContent = t.elige; $('t-acepto').innerHTML = t.acepto;
    const otro = $('otro'); if (otro) otro.placeholder = t.otro;
    $('pro-pie').textContent = t.caps(num(capsHechos), num(biblia.capitulos), num(biblia.libros.length));
    window.__idioma = lang; window.dispatchEvent(new CustomEvent('idioma', { detail: lang }));
    subtitulos(lang);
  }
  sel.onchange = () => { lang = sel.value; try { localStorage.setItem('idioma', lang); } catch(_){} aplica(); };

  // la película: emisión por trozos y en 3 calidades (HLS) desde el almacén; cada móvil coge la que aguanta su cobertura.
  // Safari la lee sola. El resto usa hls.js, que se prepara en un rato libre tras cargar la página (nunca estorba a la página)
  // y deja 6 s adelantados, así al tocar reproducir arranca al instante. Nunca se sirve el archivo original entero.
  const v = $('pelicula'), play = $('play');
  const HLSJS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js';
  let hls = null, listo = null, cargando = false;
  v.poster = url(d.pelicula.poster);
  function subtitulos(l){
    if (hls) { const i = (hls.subtitleTracks || []).findIndex(t => t.lang === l); hls.subtitleTrack = (l === 'es') ? -1 : i; return; }
    [...v.textTracks].forEach(tt => { tt.mode = (l !== 'es' && tt.language === l) ? 'showing' : 'disabled'; });
  }
  const src = d.pelicula.video ? url(d.pelicula.video) : '';
  const esHls = /\.m3u8(\?|$)/.test(src);
  const nativo = esHls && v.canPlayType('application/vnd.apple.mpegurl');
  const mp4 = d.pelicula.mp4 ? url(d.pelicula.mp4) : (esHls ? '' : src);
  const HLSJS_SRI = 'sha512-laeOywAR8veaLuF0pnbe9aXnZF0OhY25VdUkVgeRDUezc5IB1XVvqNYASMEVLh2nFvLEX/MStxGvpaNoVH6hRQ==';
  const guion = u => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = u; s.integrity = HLSJS_SRI; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = () => { s.remove(); ko(Error('hls.js')); }; document.head.append(s); });
  function directo(){ if (hls) { hls.destroy(); hls = null; } if (mp4) { v.src = mp4; v.addEventListener('loadedmetadata', () => subtitulos(lang), { once: true }); } }
  async function prepara(){
    if (!esHls || nativo) { v.src = src; v.addEventListener('loadedmetadata', () => subtitulos(lang), { once: true }); return; }
    try { if (!window.Hls) await guion(HLSJS); } catch(_) { directo(); return; }
    if (!Hls.isSupported()) { directo(); return; }
    // en reposo solo se adelantan 6 s (como hace Safari con preload="metadata"); al reproducir, 30 s
    hls = new Hls({ enableWebVTT: true, maxBufferLength: 6 });
    hls.on(Hls.Events.MANIFEST_PARSED, () => subtitulos(lang));
    hls.on(Hls.Events.ERROR, (_, e) => { if (e.fatal) { const seguia = !v.paused; directo(); if (seguia) v.play().catch(()=>{}); } });
    hls.loadSource(src); hls.attachMedia(v);
  }
  function arranca(){ if (hls && !cargando) { cargando = true; hls.config.maxBufferLength = 30; hls.startLoad(); } }
  if (src) {
    const enRatoLibre = () => { if (navigator.connection && navigator.connection.saveData) return; (window.requestIdleCallback || (f => setTimeout(f, 200)))(() => { if (!listo) listo = prepara(); }); };
    if (document.readyState === 'complete') enRatoLibre(); else window.addEventListener('load', enRatoLibre, { once: true });
  } else { play.hidden = true; v.removeAttribute('controls'); }
  aplica();
  play.onclick = async () => { play.hidden = true; try { await (listo || (listo = prepara())); arranca(); await v.play(); } catch(_) { play.hidden = false; } };
  v.addEventListener('play', () => { play.hidden = true; if (!listo) listo = prepara(); listo.then(arranca); });
  v.addEventListener('pause', ()=>{ if (!v.ended) play.hidden = false; });
  v.addEventListener('ended', ()=>{ play.hidden = false; });
})();
