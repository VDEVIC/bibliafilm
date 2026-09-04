(async function(){
  const d = await fetch('episodios.json?'+Date.now()).then(r=>r.json());
  const cdn = d.cdn.replace(/\/$/,'');
  const url = p => p ? (p.startsWith('http') ? p : cdn+'/'+p) : '';
  const hechos = d.episodios.filter(e=>e.video);
  const ultimo = hechos[hechos.length-1];
  const libro = d.libro || 'Génesis';
  const v = document.getElementById('pelicula');
  const play = document.getElementById('play');
  v.poster = url(d.pelicula.poster);
  if (d.pelicula.video) {
    v.src = url(d.pelicula.video);
    const min = d.pelicula.minutos;
    const dur = min >= 1 ? `${Math.round(min)} min` : `${Math.round(min*60)} s`;
    document.getElementById('estado').textContent = `${libro} · día ${ultimo ? ultimo.n : hechos.length} de ${d.total} · ${dur} de película`;
  } else {
    play.hidden = true; v.removeAttribute('controls');
    document.getElementById('estado').textContent = `${libro} 1:1 · el primer clip llega muy pronto`;
  }
  play.onclick = () => { play.hidden = true; v.play(); };
  v.addEventListener('pause', ()=>{ if (!v.ended) play.hidden = false; });
  v.addEventListener('ended', ()=>{ play.hidden = false; });
  const a = document.getElementById('apoyar');
  if (d.apoyo) a.href = d.apoyo;
})();
