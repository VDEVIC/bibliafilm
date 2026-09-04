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

  // progreso total: palabras rodadas / palabras de la Biblia
  let palHechas = 0, capsHechos = 0, capsEmpezados = 0;
  biblia.libros.forEach(L => L.capitulos.forEach(C => {
    const h = (hecho[L.id]||{})[C.c]; if (!h) return;
    const f = Math.min(1, (h.clips||0) / C.clips); palHechas += C.palabras * f; if (f >= 1) capsHechos++; else if (f > 0) capsEmpezados++;
  }));
  const pctTotal = palHechas / biblia.palabras * 100;
  $('pro-pct').textContent = fmtPct(pctTotal);
  $('pro-lleno').style.width = Math.max(pctTotal, pctTotal > 0 ? 0.6 : 0) + '%';
  $('pro-pie').textContent = `${num(capsHechos)} de ${num(biblia.capitulos)} capítulos terminados` + (capsEmpezados ? ` · ${num(capsEmpezados)} en marcha` : '') + ` · ${num(biblia.libros.length)} libros`;

  // vídeo principal: la película montada hasta hoy
  const v = $('pelicula'), play = $('play');
  v.poster = url(d.pelicula.poster);
  function ponVideo(src, poster){ v.pause(); if (src) { v.src = url(src); play.hidden = false; v.setAttribute('controls',''); } else { v.removeAttribute('src'); v.load(); play.hidden = true; v.removeAttribute('controls'); } if (poster) v.poster = url(poster); }
  ponVideo(d.pelicula.video, d.pelicula.poster);
  play.onclick = () => { play.hidden = true; v.play(); };
  v.addEventListener('pause', ()=>{ if (!v.ended) play.hidden = false; });
  v.addEventListener('ended', ()=>{ play.hidden = false; });

  // libros y capítulos
  const libros = $('libros'), grid = $('grid');
  let actual = biblia.libros.find(L => L.id === (d.libroActual||'L1')) || biblia.libros[0];
  function pctLibro(L){ let p=0,t=0; L.capitulos.forEach(C=>{ t+=C.palabras; const h=(hecho[L.id]||{})[C.c]; if(h) p+=C.palabras*Math.min(1,(h.clips||0)/C.clips); }); return t? p/t*100 : 0; }
  function pintaLibros(){
    libros.innerHTML = '';
    biblia.libros.forEach(L => {
      const b = document.createElement('button'); const p = pctLibro(L);
      b.innerHTML = `${L.nombre}<small>${p>0 ? fmtPct(p) : L.capitulos.length + ' cap.'}</small>`;
      if (L === actual) b.className = 'on';
      b.onclick = () => { actual = L; pintaLibros(); pintaCaps(); };
      libros.appendChild(b);
    });
    const on = libros.querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function pintaCaps(){
    grid.innerHTML = '';
    $('caps-sub').textContent = `${actual.nombre} · ${actual.parte} · ${actual.capitulos.length} capítulos`;
    actual.capitulos.forEach(C => {
      const h = (hecho[actual.id]||{})[C.c] || null; const f = h ? Math.min(1,(h.clips||0)/C.clips) : 0; const p = f*100;
      const t = document.createElement('div'); t.className = 'tarj' + (f>=1 ? ' hecho' : (f>0 ? '' : ' pronto'));
      t.innerHTML = `<div class="n"><small>Capítulo</small>${C.c}</div><div class="pct${p?'':' cero'}">${fmtPct(p)}</div><div class="barra"><div class="lleno" style="width:${p}%"></div></div><div class="v">${num(C.versiculos)} versículos · ${num(C.clips)} clips</div>`;
      t.onclick = () => {
        if (h && h.video) { ponVideo(h.video, h.poster || d.pelicula.poster); document.querySelector('.marco').scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(()=>{ play.hidden = true; v.play().catch(()=>{}); }, 500); }
        else { t.animate([{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:260}); }
      };
      grid.appendChild(t);
    });
  }
  pintaLibros(); pintaCaps();
})();
