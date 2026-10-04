'use strict';
const film = document.querySelector('#film');
const play = document.querySelector('#play-film');
const error = document.querySelector('#film-error');
const direct = document.querySelector('#direct-film');
const duration = document.querySelector('#duration');
// Idioma de la página (<html lang>): es (/nuevo/ver/), en (/en/ver/) o pt (/pt/ver/).
const LANG = (/^(en|pt)\b/i.exec(document.documentElement.lang || '') || ['es'])[0].toLowerCase();
// Selector de idioma (ES · EN · PT): guarda la elección en la cookie «idioma» (la lee functions/index.js en bibliafilm.com/).
// Entrar por /en/ o /pt/ también la guarda.
function guardaIdioma(lang) {
  try { document.cookie = 'idioma=' + lang + '; Path=/; Max-Age=31536000; SameSite=Lax; Secure'; } catch {}
}
if (LANG !== 'es') guardaIdioma(LANG);
document.querySelectorAll('.idiomas a[data-idioma]').forEach(link => link.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
  event.preventDefault();
  guardaIdioma(link.dataset.idioma);
  if (link.dataset.idioma !== LANG) location.href = link.getAttribute('href').split('#')[0] + location.hash;
}));
// La película llega por trozos y en 3 calidades (HLS) desde el almacén: cada móvil coge la que aguanta su cobertura.
// Nunca se sirve el archivo original entero. Safari la lee sola; el resto usa hls.js.
const HLSJS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js';
const HLSJS_SRI = 'sha512-laeOywAR8veaLuF0pnbe9aXnZF0OhY25VdUkVgeRDUezc5IB1XVvqNYASMEVLh2nFvLEX/MStxGvpaNoVH6hRQ==';
// Película de cada idioma. Manda episodios.json: «pelicula» es la española; «peliculas.en» y «.pt» solo cuentan si dicen
// "publicada": true (se marca cuando su película ya está subida al almacén). Estos son los valores de reserva por si
// episodios.json no llega: publicar.sh reescribe la española (hls/clipN/, ?v=clipN); en y pt, null (sin película propia
// se ve la española) hasta que tengan sus direcciones definitivas.
const PELIS = {
  es: {hls: 'https://media.bibliafilm.com/hls/clip15/pelicula.m3u8', mp4: 'https://media.bibliafilm.com/pelicula-720.mp4?v=clip15'},
  en: null,
  pt: null
};
let source = PELIS.es.hls;
let fallback = PELIS.es.mp4, fallbackEs = PELIS.es.mp4;
const native = film.canPlayType('application/vnd.apple.mpegurl');
let hls = null, ready = null, started = false, loading = false;
// chosen: ya se sabe qué película toca (en /en/ y /pt/, al leer episodios.json). locked: ya se ha cargado (desde ahí nada
// la cambia). own: la elegida es la del idioma de la página, no la española.
let chosen = LANG === 'es', locked = false, own = false;
direct.href = fallback;
play.hidden = false;
// Aviso «Audio en español» de /en/ver/ y /pt/ver/ (lo pone construir.py junto a la duración; la página española no lo lleva)
function spanishAudio(on) { document.querySelectorAll('[data-audio-es]').forEach(element => { element.hidden = !on; }); }
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.integrity = HLSJS_SRI; script.crossOrigin = 'anonymous'; script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error('hls.js')); };
    document.head.append(script);
  });
}
function useFallback() {
  if (hls) { hls.destroy(); hls = null; }
  if (LANG !== 'es' && fallback === fallbackEs) { own = false; spanishAudio(true); }   // el respaldo es el mp4 español
  film.src = fallback;
  if (started) film.play().catch(() => {});
}
async function prepare() {
  // /en/ver/ o /pt/ver/ antes de saber si su película está publicada: se espera a episodios.json, como mucho 1,5 s
  if (!chosen) await Promise.race([choice, new Promise(resolve => setTimeout(resolve, 1500))]);
  locked = true;
  if (native) { film.src = source; return; }
  try { if (!window.Hls) await loadScript(HLSJS); } catch { useFallback(); return; }
  if (!Hls.isSupported()) { useFallback(); return; }
  // en reposo solo se adelantan 6 s (como hace Safari con preload="metadata"); al reproducir, 30 s
  hls = new Hls({maxBufferLength: 6, capLevelToPlayerSize: true});
  hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) useFallback(); });
  hls.loadSource(source);
  hls.attachMedia(film);
}
function startLoad() {
  if (hls && !loading) { loading = true; hls.config.maxBufferLength = 30; hls.startLoad(); }
}
// Preparar (guion de hls.js y listas) en un rato libre tras cargar la página, para que al tocar solo falte el primer trozo.
function prepareWhenIdle() {
  if (navigator.connection?.saveData) return;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 200));
  idle(() => { if (!ready) ready = prepare(); });
}
play.addEventListener('click', async () => {
  started = true; play.hidden = true;
  try {
    await (ready || (ready = prepare()));
    startLoad();
    await film.play();
  } catch (reason) {
    play.hidden = false;
    // NotAllowedError: el navegador pide otro toque (pasa si hubo que esperar a episodios.json); no es un fallo
    if (reason.name !== 'AbortError' && reason.name !== 'NotAllowedError') error.hidden = false;
  }
});
film.addEventListener('play', () => {
  started = true; play.hidden = true; error.hidden = true;
  if (!ready) ready = prepare();
  ready.then(startLoad);
});
film.addEventListener('error', () => {
  if (hls) return;
  // la emisión del idioma no responde (Safari la lee sin hls.js): su mp4 de reserva (como en la portada)
  if (own && film.src === source) { useFallback(); return; }
  // tampoco responde la reserva del idioma: la española
  if (fallback !== fallbackEs && film.src === fallback) { fallback = fallbackEs; direct.href = fallback; useFallback(); return; }
  error.hidden = false;
});
function setDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const total = Math.round(seconds);
  duration.textContent = Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}
film.addEventListener('loadedmetadata', () => setDuration(film.duration));
// episodios.json dice qué película está publicada. Solo se acepta una emisión por trozos (.m3u8) del almacén;
// cualquier otra cosa (por ejemplo el archivo original entero) se ignora y se sigue con la emisión conocida.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
// Una entrada de episodios.json ({video, mp4}) resuelta contra el almacén: solo una emisión .m3u8 y una reserva .mp4 de
// bibliafilm.com (también las de en/ y pt/ de los otros idiomas).
function sourcesOf(movie, cdn) {
  const resolve = value => value ? new URL(/^https?:|^\//.test(value) ? value : cdn + '/' + value, sourceOrigin + '/') : null;
  const ok = u => u && ['https://bibliafilm.com', 'https://www.bibliafilm.com', 'https://media.bibliafilm.com'].includes(u.origin);
  const m3u8 = resolve(movie.video), mp4 = resolve(movie.mp4);
  return {hls: ok(m3u8) && /\.m3u8(\?|$)/.test(m3u8.pathname) ? m3u8.href : null, mp4: ok(mp4) && /\.mp4(\?|$)/.test(mp4.pathname) ? mp4.href : null};
}
// Qué película toca. En /en/ver/ y /pt/ver/ basta con episodios.json (sin comprobar el almacén, que costaría otra espera):
// si da la del idioma por publicada, esa; si luego no respondiera, se pasa a su mp4 y, si tampoco, a la española.
const choice = fetch(sourceOrigin + '/i18n/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => data, () => null).then(data => {
  const cdn = ((data && data.cdn) || 'https://media.bibliafilm.com').replace(/\/$/, '');
  const films = (data && data.peliculas) || {};
  // la española: «pelicula» (la que mantienen terminar-clip.py y publicar.sh), igual a peliculas.es
  const movie = data && (data.pelicula || films.es);
  if (LANG === 'es') {
    if (!movie) return;
    if (movie.minutos) setDuration(Number(movie.minutos) * 60);
    if (ready || started) return;               // una respuesta lenta nunca reinicia una película ya elegida
    const s = sourcesOf(movie, cdn);
    if (s.hls) source = s.hls;
    if (s.mp4) { fallback = fallbackEs = s.mp4; direct.href = fallback; }
    return;
  }
  // Otro idioma: su película si episodios.json la da por publicada (si no llega, la de reserva de PELIS); si no, la española.
  const entry = data ? (films[LANG] && films[LANG].publicada === true ? films[LANG] : null)
    : PELIS[LANG] && {video: PELIS[LANG].hls, mp4: PELIS[LANG].mp4};
  const es = movie ? sourcesOf(movie, cdn) : {}, s = entry ? sourcesOf(entry, cdn) : {};
  if (!locked) {                                // una respuesta lenta nunca reinicia una película ya elegida
    if (es.hls) source = es.hls;
    if (es.mp4) fallback = fallbackEs = es.mp4;
    if (s.hls) { source = s.hls; if (s.mp4) fallback = s.mp4; own = true; }
    direct.href = fallback;
  }
  spanishAudio(!own);
  const minutes = Number(own ? entry.minutos || (movie && movie.minutos) : movie && movie.minutos);
  if (minutes) setDuration(minutes * 60);
}).catch(() => {}).finally(() => { chosen = true; });
choice.then(prepareWhenIdle);
// Leave a paused page in the back/forward cache; never resume playback automatically.
window.addEventListener('pagehide', () => film.pause());
