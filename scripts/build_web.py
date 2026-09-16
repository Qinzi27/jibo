#!/usr/bin/env python3
"""Build an offline single-file HTML and precache list using Python's standard library.
Inputs contain no remote resources; assets are embedded as data URIs in the standalone copy.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'web'
DIST=ROOT/'dist'
DIST.mkdir(exist_ok=True)
def uri(path: Path):
    types={'.svg':'image/svg+xml','.png':'image/png'}
    return 'data:'+types[path.suffix]+';base64,'+base64.b64encode(path.read_bytes()).decode()
html=(WEB/'index.html').read_text(encoding='utf-8')
styles=(WEB/'styles.css').read_text(encoding='utf-8')
script_names=['core.js','exercises.js','plans.js','app.js']
images={f'assets/{p.name}':uri(p) for p in sorted((WEB/'assets').glob('*.svg'))}
bootstrap='\nwindow.LEAN_SINGLE_FILE = true;\nwindow.LEAN_HERO_IMAGE = '+json.dumps(images['assets/hero.svg'])+';\n'
bootstrap+='window.LEAN_EMBEDDED_IMAGES = '+json.dumps(images)+';\nwindow.LEAN_EXERCISES.forEach(function(e){e.image=window.LEAN_EMBEDDED_IMAGES[e.image];});\n'
scripts=[(WEB/name).read_text(encoding='utf-8')+(bootstrap if name=='exercises.js' else '') for name in script_names]
html=re.sub(r'  <link rel="manifest"[^>]+>\n','',html)
html=re.sub(r'  <link rel="apple-touch-icon"[^>]+>\n','',html)
html=html.replace('href="assets/icon.svg"','href="'+images['assets/icon.svg']+'"')
html=html.replace('  <link rel="stylesheet" href="styles.css">','  <style>'+styles+'</style>')
for src in script_names:
    html=html.replace(f'  <script src="{src}" defer></script>\n','')
hashes=' '.join("'sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()+"'" for s in scripts)
html=html.replace("script-src 'self';",f'script-src {hashes};')
html=html.replace("connect-src 'self';", "connect-src 'none';")
html=html.replace('</body>', ''.join('<script>'+s+'</script>\n' for s in scripts)+'</body>')
for filename in ['jibo-offline.html','lean-crew-offline.html']:
    (DIST/filename).write_text(html,encoding='utf-8')
assets=['./','./index.html','./styles.css']+['./'+name for name in script_names]+['./manifest.webmanifest']
assets += ['./assets/'+p.name for p in sorted((WEB/'assets').iterdir()) if p.is_file()]
# Include images and manifest in the cache identity so every changed offline resource refreshes.
version=hashlib.sha256(b''.join(x.encode()+b'\0'+(WEB/x[2:]).read_bytes() for x in assets if x!='./')).hexdigest()[:12]
sw='''/* Offline precache. Same-origin resources only. No remote calls. */
const CACHE = '''+json.dumps('lean-crew-'+version)+''';
const ASSETS = '''+json.dumps(assets,ensure_ascii=False)+''';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lean-crew-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
'''
(WEB/'sw.js').write_text(sw,encoding='utf-8')
print('Built:', DIST/'jibo-offline.html')
print('Compatibility copy:', DIST/'lean-crew-offline.html')
print('Standalone bytes:',(DIST/'jibo-offline.html').stat().st_size)
print('Precache entries:',len(assets))
