"""Nombres por contenido: una publicación nunca reutiliza el JS/CSS cacheado anterior."""
from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parents[1]
page=root/'libros/index.html'
html=page.read_text()
for ext in ('css','js'):
 data=(root/f'libros/libro.{ext}').read_bytes()
 name=f'libro.{hashlib.sha256(data).hexdigest()[:12]}.{ext}'
 (root/'libros/assets'/name).write_bytes(data)
 pattern=rf'/libros/(?:assets/)?libro(?:\.[a-f0-9]{{12}})?\.{ext}(?:\?v=[^"\s]+)?'
 html,n=re.subn(pattern,'/libros/assets/'+name,html)
 assert n==1,(ext,n)
page.write_text(html)
data=(root/'libros/pixel.js').read_bytes()
name=f'pixel.{hashlib.sha256(data).hexdigest()[:12]}.js'
(root/'libros/assets'/name).write_bytes(data)
html,n=re.subn(r'/libros/(?:assets/)?pixel(?:\.[a-f0-9]{12})?\.js', '/libros/assets/'+name, html)
assert n==1,('pixel',n)
page.write_text(html)
print('Referencias de CSS y JavaScript ligadas a su contenido.')
