/**
 * sw.js — Service Worker de Campus UCO (BP-04: funcionamiento offline del Modo Libre).
 *
 * Qué hace:
 *  - Al instalarse descarga y guarda en caché la app (HTML, JS, CSS, imágenes,
 *    marcadores de MindAR, modelo 3D) y las librerías de CDN que necesita.
 *  - Después de esa primera visita con internet, el Modo Libre y el mapa abren
 *    y funcionan sin conexión.
 *  - Las llamadas a Supabase (Modo Carrera, ranking, admin) NUNCA se guardan en
 *    caché: siempre van a la red. Sin internet, el Modo Carrera no funciona.
 *
 * Al cambiar archivos de la app, sube VERSION para que los teléfonos descarguen
 * la nueva versión.
 */
const VERSION = 'v12-2026-10-23';
const CACHE = `campus-uco-${VERSION}`;

// Archivos propios (rutas relativas a la carpeta donde está sw.js).
const ARCHIVOS_APP = [
  './',
  'index.html',
  'mapa.html',
  'ar.html',
  'ayuda.html',
  'carrera.html',
  'manifest.json',
  'favicon.ico',
  'img/favicon-32.png',
  'img/favicon-192.png',
  'img/apple-touch-icon.png',

  // Estilos
  'styles/tokens.css',
  'styles/mapa.css',
  'styles/ayuda.css',
  'styles/tutorial.css',
  'styles/avisos.css',

  // Código
  'src/config.js',
  'src/controllers/CarreraController.js',
  'src/controllers/MapaController.js',
  'src/controllers/PuntosController.js',
  'src/controllers/ScanController.js',
  'src/models/AuthModel.js',
  'src/models/EdificioModel.js',
  'src/models/EscaneoModel.js',
  'src/models/ParticipanteModel.js',
  'src/models/PreguntaModel.js',
  'src/models/SesionModel.js',
  'src/observers/EventBus.js',
  'src/observers/SesionObserver.js',
  'src/strategies/GameStrategy.js',
  'src/strategies/ModoCarrera.js',
  'src/strategies/ModoLibre.js',
  'src/utils/clasificacion.js',
  'src/utils/formatters.js',
  'src/utils/storage.js',
  'src/views/ARView.js',
  'src/views/CarreraView.js',
  'src/views/MapaView.js',
  'src/views/components/Avisos.js',
  'src/views/components/NotificacionComponent.js',
  'src/views/components/PuntosDisplay.js',
  'src/views/components/Tutorial.js',
  'src/views/mapa/PanZoom.js',
  'src/views/mapa/iconos.js',

  // Realidad aumentada
  'mindar.js',
  'mind/targets.mind',
  'models/estrella.glb',

  // Imágenes
  'img/ucolargo.webp',
  'img/uco-emblema.webp',
  'img/edc.webp',
  'img/bloque_J.webp',
  'img/coliseo.webp',
  'img/colegio.webp',
  'img/bloque_m.webp',
  'img/auditorio.webp',
  'img/innova.webp',
  'img/capilla.webp',
  'sprites/campus_mapa.jpg',
  'img/mapa/bloque_innova.webp',
  'img/mapa/edificio_j.webp',
  'img/mapa/auditorio.webp',
  'img/mapa/capilla.webp',
  'img/mapa/bloque_nuevo.webp',
  'img/mapa/bloque_edc.webp',
  'img/mapa/coliseo.webp',
  'img/mapa/bloque_col.webp',
  'img/mapa/bloque_m.webp'
];

// Librerías externas que cargan las páginas.
const LIBRERIAS_CDN = [
  'https://aframe.io/releases/1.4.0/aframe.min.js',
  'https://cdn.jsdelivr.net/npm/lucide@0.469.0/dist/umd/lucide.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];
const FUENTES_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

// Hosts que nunca se guardan en caché (datos en vivo).
const SOLO_RED = ['supabase.co', 'supabase.in'];

// ─── Instalación ─────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Archivos propios: uno por uno, para que un archivo faltante no
    // impida guardar los demás.
    await Promise.allSettled(ARCHIVOS_APP.map(async (ruta) => {
      const url = new URL(ruta, self.registration.scope).href;
      const resp = await fetch(url, { cache: 'reload' });
      if (resp.ok) await cache.put(url, resp);
    }));

    // Librerías de CDN (y los módulos que importan internamente).
    await Promise.allSettled(LIBRERIAS_CDN.map((url) => guardarConImports(cache, url, new Set())));

    // Fuente Inter: la hoja de estilos y los archivos .woff2 que referencia.
    try {
      const resp = await fetch(FUENTES_CSS, { mode: 'cors' });
      if (resp.ok) {
        const css = await resp.clone().text();
        await cache.put(FUENTES_CSS, resp);
        const fuentes = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
        await Promise.allSettled(fuentes.map((f) => guardar(cache, f)));
      }
    } catch (_) { /* sin fuentes: se usa la del sistema */ }

    await self.skipWaiting();
  })());
});

/** Descarga y guarda una URL externa (CORS si se puede; si no, opaca). */
async function guardar(cache, url) {
  let resp;
  try {
    resp = await fetch(url, { mode: 'cors' });
  } catch (_) {
    resp = await fetch(url, { mode: 'no-cors' });
  }
  if (resp.ok || resp.type === 'opaque') await cache.put(url, resp.clone());
  return resp;
}

/**
 * Guarda un módulo ES de CDN y, recursivamente, los módulos que importa
 * (jsDelivr "+esm" divide supabase-js en varios archivos).
 */
async function guardarConImports(cache, url, vistos) {
  if (vistos.has(url) || vistos.size > 60) return;
  vistos.add(url);
  const resp = await guardar(cache, url);
  if (!resp.ok || !url.includes('+esm')) return;
  const codigo = await resp.text();
  const patron = /(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  const hijos = [];
  for (const m of codigo.matchAll(patron)) {
    const spec = m[1] || m[2];
    if (!spec || !/^(\/|\.|https?:)/.test(spec)) continue;
    hijos.push(new URL(spec, url).href);
  }
  await Promise.allSettled(hijos.map((h) => guardarConImports(cache, h, vistos)));
}

// ─── Activación: borrar cachés de versiones anteriores ───────────────

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter((n) => n.startsWith('campus-uco-') && n !== CACHE)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// ─── Peticiones ──────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // POST/PATCH a Supabase, etc.

  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;
  if (SOLO_RED.some((h) => url.hostname.endsWith(h))) return; // datos en vivo: siempre red

  const mismoOrigen = url.origin === self.location.origin;
  const esPagina = req.mode === 'navigate';
  const esCodigo = mismoOrigen && /\.(html|js|css|json)$/.test(url.pathname);

  if (esPagina || esCodigo) {
    // Red primero (para recibir actualizaciones) y caché si no hay red
    // o si la red tarda demasiado.
    event.respondWith(redPrimero(req, esPagina));
  } else {
    // Imágenes, modelos, marcadores, librerías y fuentes: caché primero.
    event.respondWith(cachePrimero(req));
  }
});

async function redPrimero(req, esPagina) {
  const cache = await caches.open(CACHE);
  try {
    // Archivos propios: se revalidan con el servidor para no recibir una
    // copia vieja de la caché HTTP del navegador.
    const mismoOrigen = new URL(req.url).origin === self.location.origin;
    const peticion = mismoOrigen ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req);
    let resp = await conLimite(peticion, 4000);
    // Una página que llegó por redirección no se puede entregar así a la navegación
    if (resp.redirected && esPagina) resp = await conLimite(fetch(req), 4000);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (_) {
    const guardado = await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    if (esPagina) {
      const inicio = await cache.match(new URL('index.html', self.registration.scope).href);
      if (inicio) return inicio;
    }
    return Response.error();
  }
}

async function cachePrimero(req) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(req, { ignoreSearch: req.url.includes('fonts.gstatic') });
  if (guardado) return guardado;
  try {
    const resp = await fetch(req);
    if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone());
    return resp;
  } catch (_) {
    return Response.error();
  }
}

function conLimite(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promesa.then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}
