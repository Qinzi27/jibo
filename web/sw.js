/* Offline precache. Same-origin resources only. No remote calls. */
const CACHE = "lean-crew-877dad54b2cc";
const ASSETS = ["./", "./index.html", "./styles.css", "./core.js", "./exercises.js", "./plans.js", "./theory.js", "./app.js", "./manifest.webmanifest", "./assets/biceps-curl.svg", "./assets/calf-raise.svg", "./assets/chest-press.svg", "./assets/dead-bug.svg", "./assets/dumbbell-row.svg", "./assets/glute-bridge.svg", "./assets/goblet-squat.svg", "./assets/hero.svg", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon.svg", "./assets/lat-pulldown.svg", "./assets/lateral-raise.svg", "./assets/leg-curl.svg", "./assets/leg-press.svg", "./assets/plank.svg", "./assets/push-up.svg", "./assets/reverse-lunge.svg", "./assets/seated-row.svg", "./assets/shoulder-press.svg", "./assets/theory/alan-lean-diet.png", "./assets/theory/sun-version-answer.png", "./assets/triceps-pushdown.svg"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lean-crew-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
