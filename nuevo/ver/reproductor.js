'use strict';
const film = document.querySelector('#film');
const play = document.querySelector('#play-film');
const error = document.querySelector('#film-error');
const direct = document.querySelector('#direct-film');
const duration = document.querySelector('#duration');
let started = false;
const smallScreen = matchMedia('(max-width: 850px)').matches || navigator.connection?.saveData;
const initialSource = smallScreen ? '/nuevo/assets/genesis-ligero.mp4?v=4' : '/nuevo/assets/genesis-movil.mp4?v=4';
film.src = initialSource;
direct.href = initialSource;
play.hidden = false;
play.addEventListener('click', () => {
  started = true;
  film.play().catch(reason => {
    play.hidden = false;
    if (reason.name !== 'AbortError') error.hidden = false;
  });
});
film.addEventListener('play', () => { started = true; play.hidden = true; error.hidden = true; });
film.addEventListener('error', () => { error.hidden = false; });
function setDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const total = Math.round(seconds);
  duration.textContent = Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}
film.addEventListener('loadedmetadata', () => setDuration(film.duration));
// A slow metadata response must never restart a film already selected by the viewer.
const sourceOrigin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://bibliafilm.com' : location.origin;
fetch(sourceOrigin + '/episodios.json').then(response => {
  if (!response.ok) throw Error('metadata');
  return response.json();
}).then(data => {
  if (started || !film.paused || !data.pelicula) return;
  const movie = data.pelicula;
  if (movie.video) {
    const value = /^https?:|^\//.test(movie.video) ? movie.video : (data.cdn || sourceOrigin + '/media').replace(/\/$/, '') + '/' + movie.video;
    const source = new URL(value, sourceOrigin + '/');
    if (!['https://bibliafilm.com', 'https://www.bibliafilm.com', 'https://media.bibliafilm.com'].includes(source.origin)) return;
    if (source.href !== 'https://media.bibliafilm.com/pelicula.mp4?v=clip8') {
      film.src = source.href;
      direct.href = source.href;
    }
  }
  if (movie.minutos) setDuration(Number(movie.minutos) * 60);
}).catch(() => {});
// Leave a paused page in the back/forward cache; never resume playback automatically.
window.addEventListener('pagehide', () => film.pause());
