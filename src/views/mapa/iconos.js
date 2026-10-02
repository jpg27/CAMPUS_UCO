// ═══════════════════════════════════════════
// iconos.js — Íconos del mapa con Lucide (mismo set que el resto de la app)
// Uso: icono('ciencia')  →  string <svg>…</svg>
// Requiere el script UMD de Lucide en la página (window.lucide).
// Si Lucide no cargó (sin red / CDN caído), usa un trazo propio de respaldo.
// ═══════════════════════════════════════════

// Nombre en la app → ícono de Lucide
const LUCIDE = {
  // Pines de edificios
  edificio:  'Landmark',
  colegio:   'School',
  ciencia:   'FlaskConical',
  deporte:   'Dumbbell',
  capilla:   'Church',
  auditorio: 'Theater',
  idea:      'Lightbulb',
  casas:     'House',

  // Interfaz (los mismos que usa index.html)
  mapa:      'Map',
  carrera:   'GraduationCap',
  camara:    'Camera',
  mas:       'Ellipsis',
  inicio:    'House',
  admin:     'Settings',
  trofeo:    'Trophy',
  ubicacion: 'MapPin',
  encuadrar: 'Maximize',
  zoomMas:   'Plus',
  zoomMenos: 'Minus',
  cerrar:    'X',
  chevron:   'ChevronRight',
  check:     'Check',
  candado:   'Lock'
};

const RESPALDO = 'M3 9l9-5 9 5M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 20h18';

function nodoASvg([tag, attrs = {}, hijos = []]) {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<${tag} ${a}>${hijos.map(nodoASvg).join('')}</${tag}>`;
}

export function icono(nombre, clase = '') {
  const comunes = `class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const nodo = window.lucide?.icons?.[LUCIDE[nombre]];
  if (!nodo) return `<svg ${comunes}><path d="${RESPALDO}"/></svg>`;
  const hijos = Array.isArray(nodo[0]) ? nodo : (nodo[2] || []); // formato [svg, attrs, hijos] o lista de hijos
  return `<svg ${comunes}>${hijos.map(nodoASvg).join('')}</svg>`;
}
