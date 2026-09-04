(async function(){
  const d = await fetch('episodios.json?'+Date.now()).then(r=>r.json());
  const cdn = d.cdn.replace(/\/$/,'');
  const url = p => p ? (p.startsWith('http') ? p : cdn+'/'+p) : '';
  const hechos = d.episodios.filter(e=>e.video);
  const ultimo = hechos[hechos.length-1];
  const total = d.total;

  const libro = d.libro || 'Génesis';
  document.getElementById('dia').textContent = ultimo ? `${libro} · Día ${ultimo.n} de ${total}` : `${libro} · Día 1, muy pronto`;
  document.getElementById('lleno').style.width = (hechos.length/total*100)+'%';
  const min = d.pelicula.minutos;
  const dur = min >= 1 ? `${Math.round(min)} min` : `${Math.round(min*60)} s`;
  document.getElementById('estado').textContent = ultimo ? `${hechos.length} de ${total} clips · ${dur} de película` : `Aquí empieza. Génesis 1:1, el primer clip.`;

  const v = document.getElementById('pelicula');
  const play = document.getElementById('play');
  if (d.pelicula.video) { v.src = url(d.pelicula.video); v.poster = url(d.pelicula.poster); }
  else { play.hidden = true; v.poster = url(d.pelicula.poster); }
  play.onclick = () => { play.hidden = true; v.play(); };
  v.addEventListener('pause', ()=>{ if (!v.ended) play.hidden = false; });
  v.addEventListener('ended', ()=>{ play.hidden = false; });

  const visor = document.getElementById('visor'), clip = document.getElementById('clip');
  function abrir(e){
    if (!e.video) return;
    clip.src = url(e.video);
    document.getElementById('visor-titulo').textContent = `${e.n}. ${e.titulo}`;
    document.getElementById('visor-ref').textContent = `Éxodo ${e.versiculos}`;
    visor.hidden = false; v.pause(); clip.play().catch(()=>{});
  }
  function cerrar(){ clip.pause(); clip.removeAttribute('src'); clip.load(); visor.hidden = true; }
  document.getElementById('cerrar').onclick = cerrar;
  visor.addEventListener('click', ev => { if (ev.target === visor) cerrar(); });

  const hoy = document.getElementById('hoy');
  if (ultimo) {
    hoy.innerHTML = `<div class="num"><small>HOY</small>${ultimo.n}</div><div><div class="tit">${ultimo.titulo}</div><div class="ref">Éxodo ${ultimo.versiculos}</div></div><div class="ir">▶</div>`;
    hoy.onclick = () => abrir(ultimo);
  } else hoy.remove();

  const ol = document.getElementById('capitulos');
  const proximos = d.episodios.filter(e=>!e.video).slice(0,3);
  [...proximos.reverse(), ...hechos.slice().reverse()].forEach(e => {
    const li = document.createElement('li');
    if (!e.video) li.className = 'pronto';
    li.innerHTML = `<div class="n">${e.n}</div><div><div class="t">${e.titulo}</div><div class="r">Éxodo ${e.versiculos}</div></div><div class="f">${e.video ? (e.fecha||'') : 'pronto'}</div>`;
    li.onclick = () => abrir(e);
    ol.appendChild(li);
  });

  const a = document.getElementById('apoyar');
  if (d.apoyo) a.href = d.apoyo; else a.parentElement.hidden = true;
  document.getElementById('redes').innerHTML = Object.entries(d.redes).map(([k,u])=>`<a href="${u}" target="_blank" rel="noopener">${k}</a>`).join('');
})();
