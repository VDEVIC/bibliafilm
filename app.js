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
  const v = $('pelicula'), play = $('play');
  v.poster = url(d.pelicula.poster);
  if (d.pelicula.video) { v.src = url(d.pelicula.video); } else { play.hidden = true; v.removeAttribute('controls'); }
  play.onclick = () => { play.hidden = true; v.play(); };
  v.addEventListener('pause', ()=>{ if (!v.ended) play.hidden = false; });
  v.addEventListener('ended', ()=>{ play.hidden = false; });
})();
