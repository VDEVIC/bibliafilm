'use strict';
const film = document.querySelector('#film');
const play = document.querySelector('#play-film');
const error = document.querySelector('#film-error');
const direct = document.querySelector('#direct-film');
const duration = document.querySelector('#duration');
// La película llega por trozos y en 3 calidades (HLS) desde el almacén: cada móvil coge la que aguanta su cobertura.
// Nunca se sirve el archivo original entero. Safari la lee sola; el resto usa hls.js.
const HLSJS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js';
const HLSJS_SRI = 'sha512-laeOywAR8veaLuF0pnbe9aXnZF0OhY25VdUkVgeRDUezc5IB1XVvqNYASMEVLh2nFvLEX/MStxGvpaNoVH6hRQ==';
let source = 'https://media.bibliafilm.com/hls/clip12/pelicula.m3u8';
let fallback = 'https://media.bibliafilm.com/pelicula-720.mp4?v=clip12';
const native = film.canPlayType('application/vnd.apple.mpegurl');
let hls = null, ready = null, started = false, loading = false;
direct.href = fallback;
play.hidden = false;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.integrity = HLSJS_SRI; script.crossOrigin = 'anonymous'; script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error('hls.js')); };
    document.head.append(script);
  });
}
function useFallback() {
  if (hls) { hls.destroy(); hls = null; }
  film.src = fallback;
  if (started) film.play().catch(() => {});
}
async function prepare() {
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
    if (reason.name !== 'AbortError') error.hidden = false;
  }
});
film.addEventListener('play', () => {
  started = true; play.hidden = true; error.hidden = true;
  if (!ready) ready = prepare();
  ready.then(startLoad);
});
film.addEventListener('error', () => { if (!hls) error.hidden = false; });
function setDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const total = Math.round(seconds);
  duration.textContent = Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}
film.addEventListener('loadedmetadata', () => setDuration(film.duration));
// episodios.json dice qué película está publicada. Solo se acepta una emisión por trozos (.m3u8) del almacén;
// cualquier otra cosa (por ejemplo el archivo original entero) se ignora y se sigue con la emisión conocida.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
fetch(sourceOrigin + '/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => {
  const movie = data.pelicula;
  if (!movie) return;
  if (movie.minutos) setDuration(Number(movie.minutos) * 60);
  if (ready || started) return;               // una respuesta lenta nunca reinicia una película ya elegida
  const cdn = (data.cdn || 'https://media.bibliafilm.com').replace(/\/$/, '');
  const resolve = value => value ? new URL(/^https?:|^\//.test(value) ? value : cdn + '/' + value, sourceOrigin + '/') : null;
  const m3u8 = resolve(movie.video), mp4 = resolve(movie.mp4);
  const ok = u => u && ['https://bibliafilm.com', 'https://www.bibliafilm.com', 'https://media.bibliafilm.com'].includes(u.origin);
  if (ok(m3u8) && /\.m3u8(\?|$)/.test(m3u8.pathname)) source = m3u8.href;
  if (ok(mp4) && /\.mp4(\?|$)/.test(mp4.pathname)) { fallback = mp4.href; direct.href = fallback; }
}).catch(() => {}).finally(prepareWhenIdle);
// Leave a paused page in the back/forward cache; never resume playback automatically.
window.addEventListener('pagehide', () => film.pause());
