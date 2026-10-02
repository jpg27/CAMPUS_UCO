// ═══════════════════════════════════════════
// iconos.js — Íconos SVG de trazo (24×24) usados en el mapa
// Uso: icono('ciencia')  →  string <svg>…</svg>
// ═══════════════════════════════════════════

const TRAZOS = {
  // Edificios (pines)
  edificio:  'M3 9l9-5 9 5M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 20h18',
  colegio:   'M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0 0 4h13M8 7h7',
  ciencia:   'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  deporte:   'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
  capilla:   'M12 2v4M10 4h4M5 21V11l7-5 7 5v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4',
  auditorio: 'M3 4h18v3c-2 0-3 1.5-3 4H6c0-2.5-1-4-3-4zM6 11v9M18 11v9M3 20h18',
  idea:      'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  casas:     'M2 20v-9l5-4 5 4v9M12 20v-6l5-4 5 4v6M1 20h22M6 20v-4h2v4',

  // Interfaz
  mapa:      'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  carrera:   'M5 21V4M5 4h11l-2 4 2 4H5',
  camara:    'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  mas:       'M5 12h.01M12 12h.01M19 12h.01',
  inicio:    'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  admin:     'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z',
  trofeo:    'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4c0 3 2 4 4 4M16 6h4c0 3-2 4-4 4M12 13v4M8 21h8M9 17h6',
  ubicacion: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  encuadrar: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  zoomMas:   'M12 5v14M5 12h14',
  zoomMenos: 'M5 12h14',
  cerrar:    'M6 6l12 12M18 6L6 18',
  chevron:   'M9 6l6 6-6 6',
  check:     'M5 12.5l4.5 4.5L19 7.5',
  candado:   'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'
};

export function icono(nombre, clase = '') {
  const d = TRAZOS[nombre] || TRAZOS.edificio;
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
