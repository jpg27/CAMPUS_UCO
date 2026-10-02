// ═══════════════════════════════════════════
// CONFIG.JS — Configuración centralizada de Campus UCO
// ═══════════════════════════════════════════
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── Supabase ──
const SUPABASE_URL = 'https://cycuqoogdmxrywxutjbg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nVkVjEh2OOeYLDVb6LyJCg_IRmm5T0s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mantener Supabase activo (ping cada 3 días)
const ultimoPing = localStorage.getItem('supabase_ping');
const ahora = Date.now();
if (!ultimoPing || ahora - parseInt(ultimoPing) > 259200000) {
  supabase.from('sesiones').select('id').limit(1);
  localStorage.setItem('supabase_ping', ahora);
}

// ── Base URL ──
export const BASE_URL = location.pathname.includes('CAMPUS_UCO')
  ? '/CAMPUS_UCO/'
  : './';

// ── Mapa ilustrado del campus ──
// Las coordenadas de `mapa.zona` y `mapa.pin` de cada edificio están en píxeles
// de esta imagen (ancho × alto). Si cambias la imagen por otra de la MISMA
// composición y tamaño, las zonas siguen sirviendo.
export const MAPA = {
  imagen: 'sprites/campus_mapa.jpg',
  ancho: 1600,
  alto: 961,
  // true mientras la imagen traiga los pines dibujados. Al cambiarla por la
  // versión sin etiquetas, pon false y la app dibuja sus propios pines.
  imagenConEtiquetas: true
};

// ── Edificios (fuente única de verdad) ──
export const EDIFICIOS = [
    {
    id: 'bloque_edc',
    nombre: 'Bloque EDC',
    icono: '📚',
    descripcion: 'Bloque de laboratorios y biblioteca.',
    localizacion: '📍 Campus parte media',
    mapa: {
      nombreCorto: 'EDC',
      pinIcono: 'ciencia',
      pin:  [82, 615],
      zona: [[130,705], [240,655], [322,702], [455,760], [457,890], [400,906], [240,862], [130,782]]
    },
    puntosDeInteres: [
      { texto: "Biblioteca central", direccion: 'arriba' },
      { texto: "Laboratorios de sistemas", direccion: 'derecha' },
      { texto: "Sala de estudio 24 horas", direccion: 'abajo-derecha' }
    ]
  },
    {
    id: 'edificio_j',
    nombre: 'Edificio J',
    icono: '🏢',
    descripcion: 'Bloque de salones.',
    localizacion: '📍 Campus parte baja',
    mapa: {
      nombreCorto: 'Bloque J',
      pinIcono: 'casas',
      pin:  [690, 535],
      zona: [[668,620], [770,595], [808,598], [836,626], [890,700], [890,762], [810,832], [730,800], [668,690]]
    },
    puntosDeInteres: [
      { texto: "Salones de clase - pisos 1 y 2", direccion: 'arriba' },
      { texto: "Cafetería", direccion: 'izquierda' }
    ]
  },
    {
    id: 'coliseo',
    nombre: 'Coliseo',
    icono: '🏟️',
    descripcion: 'Coliseo deportivo.',
    localizacion: '📍 Campus parte alta',
    mapa: {
      nombreCorto: 'Coliseo',
      pinIcono: 'deporte',
      pin:  [118, 358],
      zona: [[210,428], [340,315], [452,355], [456,448], [330,508], [210,470]]
    },
    puntosDeInteres: [
      { texto: "Canchas múltiples", direccion: 'centro' },
      { texto: "Gimnasio", direccion: 'arriba-derecha' }
    ]
  },
  {
    id: 'bloque_col',
    nombre: 'Bloque COL',
    icono: '🔬',
    descripcion: 'Edificio del colegio de la universidad.',
    localizacion: '📍 Campus parte alta',
    mapa: {
      nombreCorto: 'Colegio',
      pinIcono: 'colegio',
      pin:  [175, 135],
      zona: [[203,222], [290,170], [590,250], [592,312], [520,322], [380,292], [205,268]]
    },
    puntosDeInteres: [
      { texto: "Colegio de la universidad", direccion: 'arriba' },
      { texto: "Zonas verdes", direccion: 'abajo' }
    ]
  },
  {
    id: 'bloque_m',
    nombre: 'Bloque M',
    icono: '🏫',
    descripcion: 'Bloque principal de la universidad.',
    localizacion: '📍 Campus parte alta',
    mapa: {
      nombreCorto: 'Bloque M',
      pinIcono: 'edificio',
      pin:  [590, 58],
      zona: [[545,162], [650,108], [870,195], [870,258], [805,268], [775,298], [690,282], [545,212]]
    },
    puntosDeInteres: [
      { texto: "Rectoría y administración", direccion: 'arriba' },
      { texto: "Facultad de Ingeniería", direccion: 'arriba-derecha' },
      { texto: "Sala de profesores", direccion: 'izquierda' }
    ]
  },
  {
    id: 'auditorio',
    nombre: 'Auditorio',
    icono: '🎭',
    descripcion: 'Auditorio principal.',
    localizacion: '📍 Campus parte alta',
    mapa: {
      nombreCorto: 'Auditorio',
      pinIcono: 'auditorio',
      pin:  [942, 58],
      zona: [[855,172], [935,112], [1040,160], [1040,202], [985,216], [940,203], [855,196]]
    },
    puntosDeInteres: [
      { texto: "Auditorio principal", direccion: 'centro' },
      { texto: "Camerinos", direccion: 'derecha' }
    ]
  },
  {
    id: 'bloque_innova',
    nombre: 'Bloque INNOVA',
    icono: '💡',
    descripcion: 'Centro de idiomas, sala de sistemas y auditorio.',
    localizacion: '📍 Campus parte baja',
    mapa: {
      nombreCorto: 'Innovamater',
      pinIcono: 'idea',
      pin:  [1287, 228],
      zona: [[1190,348], [1250,320], [1340,330], [1356,348], [1356,452], [1262,487], [1195,452]]
    },
    puntosDeInteres: [
      { texto: "Centro de idiomas", direccion: 'arriba' },
      { texto: "Sala de sistemas", direccion: 'abajo-izquierda' }
    ]
  },
    {
    id: 'capilla',
    nombre: 'Capilla',
    icono: '⛪',
    descripcion: 'Capilla del campus.',
    localizacion: '📍 Campus parte baja',
    mapa: {
      nombreCorto: 'Capilla',
      pinIcono: 'capilla',
      pin:  [1449, 295],
      zona: [[1356,358], [1410,345], [1440,350], [1456,432], [1400,442], [1356,432]]
    },
    puntosDeInteres: [
      { texto: "Capilla del campus", direccion: 'centro' }
    ]
  },
  {
    id: 'bloque_nuevo',
    nombre: 'Fundacional',
    icono: '🏛️',
    descripcion: 'Edificio Fundacional de la universidad.',
    localizacion: '📍 Campus parte baja',
    mapa: {
      nombreCorto: 'Fundacional',
      pinIcono: 'edificio',
      pin:  [995, 365],
      zona: [[930,432], [1050,390], [1200,470], [1205,578], [1080,630], [935,552]]
    },
  },
  {
    id: 'bloque_de',
    nombre: 'Bloque D y E',
    icono: '⚙️',
    descripcion: 'Bloque de deportes.',
    localizacion: '📍 Campus parte media',
    // Sin `mapa`: no aparece en la ilustración del campus, así que no se dibuja.
  }
];

// ── Fotos de los edificios (carpeta img) ──
// Cambia cada ruta por el nombre real de tu archivo.
// En GitHub Pages las mayúsculas y minúsculas importan.
export const FOTOS_EDIFICIOS = {
  bloque_edc:    'img/edc.png',
  edificio_j:    'img/bloque_j.png',
  coliseo:       'img/coliseo.png',
  bloque_col:    'img/colegio.png',
  bloque_m:      'img/bloque_m.png',
  auditorio:     'img/auditorio.png',
  bloque_innova: 'img/innova.png',
  capilla:       'img/capilla.png',
  bloque_nuevo:  'img/bloque_nuevo.png',
  bloque_de:     'img/bloque_de.png'
};

// ── Mapeo de target indexes de MindAR a edificios ──
// El orden de estas claves debe coincidir con el orden de los targets en mind/targets.mind.
export const EDIFICIOS_AR = {
  0: 'bloque_edc',
  1: 'edificio_j',
  2: 'coliseo',
  3: 'bloque_col',
  4: 'bloque_m',
  5: 'auditorio',
  6: 'bloque_innova',
  7: 'capilla'
};

// ── Constantes de puntos ──
export const PUNTOS = {
  INICIO: 1000,
  POR_TICK: 1,
  MS_POR_TICK: 2000,
  BONUS_CORRECTO: 0,
  PENALIZACION: 100
};

// ── Helpers de edificios ──
export function obtenerEdificioPorId(id) {
  return EDIFICIOS.find(e => e.id === id) || null;
}

export function obtenerEdificioInfo(id) {
  const e = obtenerEdificioPorId(id);
  return e ? { nombre: e.nombre, icono: e.icono } : { nombre: id, icono: '🏛️' };
}