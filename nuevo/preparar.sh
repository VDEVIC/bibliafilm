#!/bin/zsh
# Prepara lo que la página /nuevo/ necesita de la película después de montar-pelicula.sh y ANTES de publicar.sh:
#   1) web/media/pelicula-720.mp4  → la versión ligera que reciben los móviles (nunca el original de 1080p)
#   2) web/nuevo/fotograma.webp/.jpg → fotograma real de espera, a partir de web/media/portada.jpg
#   3) web/nuevo/estado.json         → duración y versión de la película, fecha del último trozo
# Uso: ./web/nuevo/preparar.sh [version]   (la versión por defecto sale de episodios.json, p. ej. clip9)
set -e
N="$(cd "$(dirname "$0")" && pwd)"; W="$(dirname "$N")"
FF=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg; FP=/opt/homebrew/opt/ffmpeg-full/bin/ffprobe
ORIG="$W/media/pelicula.mp4"; [ -f "$ORIG" ] || { echo "falta $ORIG"; exit 1; }
V="${1:-$(python3 -c "import json,re;m=re.search(r'v=([\w-]+)',json.load(open('$W/episodios.json'))['pelicula']['video']);print(m.group(1) if m else 'v1')")}"
# 1) 720p, faststart, fotograma clave cada 2 s, ~1,2 Mbit/s de tope
if [ ! -f "$W/media/pelicula-720.mp4" ] || [ "$ORIG" -nt "$W/media/pelicula-720.mp4" ]; then
  "$FF" -y -loglevel error -i "$ORIG" -vf "scale=1280:-2" -c:v libx264 -profile:v high -preset medium -crf 23 -maxrate 1200k -bufsize 2400k -g 48 -keyint_min 48 -sc_threshold 0 -c:a aac -b:a 96k -movflags +faststart "$W/media/pelicula-720.mp4"
  echo "hecho: media/pelicula-720.mp4"
fi
# 2) fotograma de espera (1280 px) desde la portada que deja montar-pelicula.sh
cwebp -quiet -q 72 -resize 1280 720 "$W/media/portada.jpg" -o "$N/fotograma.webp"
sips -s format jpeg -s formatOptions 70 -Z 1280 "$W/media/portada.jpg" --out "$N/fotograma.jpg" >/dev/null
# 3) estado.json: duración, versión y fecha (el tramo y la voz se cambian a mano cuando toque)
SEG=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$ORIG")
python3 - "$N/estado.json" "$SEG" "$V" <<'PY'
import json, sys, datetime
f, seg, v = sys.argv[1], float(sys.argv[2]), sys.argv[3]
e = json.load(open(f)); p = e['pelicula']
p['segundos'] = round(seg, 1); p['version'] = v; p['fecha'] = datetime.date.today().isoformat()
json.dump(e, open(f, 'w'), ensure_ascii=False, indent=1)
print(f"estado.json: {p['segundos']} s, versión {v}, {p['fecha']}")
PY
# la versión también va en el HTML (fotograma y og:image) para que ningún navegador enseñe la vieja
sed -i "" -E "s/(fotograma\.(webp|jpg))\?v=[A-Za-z0-9_-]+/\1?v=$V/g" "$N/index.html"
echo "listo: ahora ./publicar.sh"
