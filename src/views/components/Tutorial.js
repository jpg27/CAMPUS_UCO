// ═══════════════════════════════════════════
// Tutorial.js — Tutorial deslizable de bienvenida
//
// Uso:
//   import { mostrarTutorial, tutorialPendiente } from './src/views/components/Tutorial.js';
//   if (tutorialPendiente()) mostrarTutorial();          // solo la primera vez
//   mostrarTutorial({ desde: 'camara' });                 // desde la ayuda
//
// Necesita styles/tokens.css y styles/tutorial.css en la página.
// La marca de "ya lo vio" se guarda en localStorage (CLAVE_VISTO).
// ═══════════════════════════════════════════

const CLAVE_VISTO = 'tutorial_visto_v1';

const C = { verde: '#087A45', medio: '#91C59D', suave: '#C2DDCC', tinta: '#123D2A', oro: '#C8960C', blanco: '#FFFFFF' };

const PASOS = [
  {
    id: 'bienvenida',
    titulo: 'Explora el campus de la UCO',
    texto: 'Mapa, carrera y cámara en una sola app. Te mostramos cómo funciona en 30 segundos.',
    svg: `
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <path d="M40 190 Q60 110 150 105 Q245 100 262 180 Q270 240 150 248 Q30 252 40 190Z" fill="${C.suave}"/>
        <rect x="70" y="150" width="56" height="44" rx="6" fill="${C.blanco}"/>
        <rect x="70" y="150" width="56" height="10" rx="4" fill="${C.medio}"/>
        <rect x="140" y="128" width="44" height="66" rx="6" fill="${C.blanco}"/>
        <rect x="140" y="128" width="44" height="10" rx="4" fill="${C.medio}"/>
        <rect x="196" y="160" width="40" height="34" rx="6" fill="${C.blanco}"/>
        <rect x="196" y="160" width="40" height="10" rx="4" fill="${C.medio}"/>
        <circle cx="96" cy="222" r="12" fill="${C.medio}"/><circle cx="222" cy="220" r="10" fill="${C.medio}"/>
        <g class="tut-pin">
          <path d="M162 60c-17 0-30 13-30 29 0 22 30 47 30 47s30-25 30-47c0-16-13-29-30-29z" fill="${C.verde}"/>
          <circle cx="162" cy="89" r="10" fill="${C.blanco}"/>
        </g>
      </svg>`
  },
  {
    id: 'mapa',
    titulo: 'Encuentra cualquier edificio',
    texto: 'Toca un edificio en el mapa para ver su foto y qué hay en cada piso. Arrastra y pellizca para moverte.',
    svg: `
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <rect x="45" y="40" width="210" height="150" rx="18" fill="${C.suave}"/>
        <path d="M60 150 Q120 110 170 140 T245 120" stroke="${C.blanco}" stroke-width="10" fill="none" stroke-linecap="round"/>
        <rect x="80" y="70" width="46" height="34" rx="6" fill="${C.blanco}"/>
        <rect x="160" y="64" width="62" height="40" rx="6" fill="${C.blanco}" stroke="${C.oro}" stroke-width="4"/>
        <g class="tut-pin">
          <circle cx="191" cy="48" r="16" fill="${C.verde}"/>
          <rect x="184" y="41" width="14" height="14" rx="2" fill="none" stroke="${C.blanco}" stroke-width="3"/>
        </g>
        <rect x="55" y="200" width="190" height="62" rx="16" fill="${C.blanco}" stroke="${C.suave}" stroke-width="2"/>
        <rect x="68" y="212" width="50" height="38" rx="8" fill="${C.medio}"/>
        <rect x="130" y="216" width="80" height="10" rx="5" fill="${C.tinta}"/>
        <rect x="130" y="234" width="100" height="8" rx="4" fill="${C.suave}"/>
      </svg>`
  },
  {
    id: 'carrera',
    titulo: 'Compite en la carrera',
    texto: 'Únete con el código del organizador. En cada edificio empiezas con 1000 puntos y pierdes 1 cada 2 segundos: ¡ve rápido!',
    svg: `
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <rect x="40" y="70" width="150" height="86" rx="14" fill="${C.blanco}" stroke="${C.suave}" stroke-width="3"/>
        <circle cx="40" cy="113" r="12" fill="${C.suave}"/><circle cx="190" cy="113" r="12" fill="${C.suave}"/>
        <text x="115" y="104" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="600" fill="${C.verde}">CÓDIGO</text>
        <text x="115" y="134" text-anchor="middle" font-family="Inter, sans-serif" font-size="24" font-weight="700" fill="${C.tinta}">UCO-25</text>
        <circle cx="200" cy="196" r="62" fill="${C.blanco}"/>
        <circle cx="200" cy="196" r="52" fill="none" stroke="${C.suave}" stroke-width="10"/>
        <path d="M200 144 A52 52 0 1 1 152 214" fill="none" stroke="${C.verde}" stroke-width="10" stroke-linecap="round"/>
        <text x="200" y="204" text-anchor="middle" font-family="Inter, sans-serif" font-size="26" font-weight="700" fill="${C.tinta}">1000</text>
        <path d="M200 120 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2z" fill="${C.oro}"/>
      </svg>`
  },
  {
    id: 'camara',
    titulo: 'Apunta la cámara al marcador',
    texto: 'En cada edificio busca el marcador y enfócalo completo, a 1 o 2 metros, hasta que aparezca la pregunta o la información.',
    svg: `
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <rect x="88" y="28" width="124" height="244" rx="24" fill="${C.tinta}"/>
        <rect x="98" y="46" width="104" height="208" rx="14" fill="${C.blanco}"/>
        <rect x="118" y="96" width="64" height="76" rx="6" fill="${C.suave}"/>
        <path d="M131 152v-24l19-12 19 12v24" fill="none" stroke="${C.verde}" stroke-width="4" stroke-linejoin="round"/>
        <rect x="143" y="138" width="14" height="14" fill="${C.verde}"/>
        <path d="M110 92v-12h12M178 80h12v12M190 176v12h-12M122 188h-12v-12" fill="none" stroke="${C.verde}" stroke-width="4" stroke-linecap="round"/>
        <rect class="tut-escaneo" x="112" y="92" width="76" height="4" rx="2" fill="${C.verde}" opacity=".9"/>
        <path class="tut-estrella" d="M150 72 l7 14 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2z" fill="${C.oro}"/>
        <rect x="128" y="214" width="44" height="8" rx="4" fill="${C.suave}"/>
      </svg>`
  }
];

export function tutorialPendiente() {
  try { return !localStorage.getItem(CLAVE_VISTO); } catch { return false; }
}

function marcarVisto() {
  try { localStorage.setItem(CLAVE_VISTO, '1'); } catch { /* sin almacenamiento: no pasa nada */ }
}

/** Abre el tutorial. `desde` = id del paso inicial ('bienvenida' | 'mapa' | 'carrera' | 'camara'). */
export function mostrarTutorial({ desde = 'bienvenida', alCerrar = null } = {}) {
  document.querySelector('.tutorial')?.remove();
  const focoPrevio = document.activeElement;

  const raiz = document.createElement('div');
  raiz.className = 'tutorial';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-label', 'Cómo funciona Campus UCO');
  raiz.innerHTML = `
    <div class="tutorial-barra">
      <button type="button" class="tutorial-saltar">Saltar</button>
    </div>
    <div class="tutorial-carril" tabindex="-1">
      ${PASOS.map((p, i) => `
        <section class="tutorial-paso" aria-roledescription="paso" aria-label="${i + 1} de ${PASOS.length}">
          <div class="tutorial-ilustracion">${p.svg}</div>
          <div class="tutorial-texto">
            <h2>${p.titulo}</h2>
            <p>${p.texto}</p>
          </div>
        </section>`).join('')}
    </div>
    <div class="tutorial-pie">
      <div class="tutorial-puntos" aria-hidden="true">${PASOS.map(() => '<span></span>').join('')}</div>
      <button type="button" class="tutorial-siguiente"></button>
    </div>`;
  document.body.appendChild(raiz);
  document.body.style.overflow = 'hidden';

  const carril = raiz.querySelector('.tutorial-carril');
  const puntos = [...raiz.querySelectorAll('.tutorial-puntos span')];
  const btnSiguiente = raiz.querySelector('.tutorial-siguiente');
  let actual = 0;

  const flecha = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const pintar = () => {
    puntos.forEach((p, i) => p.setAttribute('aria-current', String(i === actual)));
    const ultimo = actual === PASOS.length - 1;
    btnSiguiente.innerHTML = ultimo ? 'Empezar' : `Siguiente ${flecha}`;
  };
  const irA = (i, suave = true) => {
    actual = Math.max(0, Math.min(PASOS.length - 1, i));
    carril.scrollTo({ left: actual * carril.clientWidth, behavior: suave ? 'smooth' : 'auto' });
    pintar();
  };
  const cerrar = () => {
    marcarVisto();
    raiz.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', teclas);
    focoPrevio?.focus?.();
    alCerrar?.();
  };
  const teclas = (e) => {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowRight') irA(actual + 1);
    else if (e.key === 'ArrowLeft') irA(actual - 1);
  };

  // Al deslizar con el dedo, actualizar el paso según la posición del carril
  let espera;
  carril.addEventListener('scroll', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const i = Math.round(carril.scrollLeft / carril.clientWidth);
      if (i !== actual) { actual = i; pintar(); }
    }, 80);
  });
  btnSiguiente.addEventListener('click', () => (actual === PASOS.length - 1 ? cerrar() : irA(actual + 1)));
  raiz.querySelector('.tutorial-saltar').addEventListener('click', cerrar);
  document.addEventListener('keydown', teclas);
  window.addEventListener('resize', () => irA(actual, false));

  const inicio = Math.max(0, PASOS.findIndex(p => p.id === desde));
  requestAnimationFrame(() => irA(inicio, false));
  // El foco va al diálogo (no al botón) para que no aparezca el anillo de
  // foco apenas se abre; Tab lleva luego a "Saltar" y "Siguiente".
  raiz.tabIndex = -1;
  raiz.style.outline = 'none';
  raiz.focus();
}
