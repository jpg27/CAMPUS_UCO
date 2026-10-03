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
    nombre: 'EDC',
    icono: '📚',
    descripcion: 'Bloque de laboratorios y biblioteca.',
    localizacion: '📍 Campus parte media',
    mapa: {
      pinIcono: 'ciencia',
      pin:  [82, 615],
      zona: [[129,708], [194,663], [209,671], [234,654], [325,700], [325,730], [456,797], [458,885],[406,921],[332,878],[323,882],[301,868],[257,847],[254,837],[254,825],[243,819],[216,833],[130,797]]
    },
    puntosDeInteres: [
      { texto: "Biblioteca central", direccion: 'arriba' },
      { texto: "Laboratorios de sistemas", direccion: 'derecha' },
      { texto: "Sala de estudio 24 horas", direccion: 'abajo-derecha' }
    ]
  },
    {
    id: 'edificio_j',
    nombre: 'Bloque J',
    icono: '🏢',
    descripcion: 'Bloque de salones.',
    localizacion: '📍 Campus parte baja',
    mapa: {
      pinIcono: 'casas',
      pin:  [690, 535],
      zona: [[665,616],[684,605],[708,604],[715,614],[717,614],[717,607],[734,601],[751,601],[762,615],[764,615],[764,604],[786,595],[811,595],[834,625],[834,645],[842,645],[864,681],[861,682],[863,712],[871,712],[890,748],[888,750],[889,772],[835,782],[803,795],[805,812],[771,832],[729,812],[729,783],[732,779],[699,752],[698,734],[695,730],[706,723],[674,699],[673,674],[683,666],[668,641],[668,621]]
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
      pinIcono: 'deporte',
      pin:  [118, 358],
      zona: [[209,423], [329,319], [342,316], [349,315], [357,314], [369,315],[383,317],[391,320],[399,323],[407,327],[416,332],[424,337],[431,342],[436,346],[441,350],[455,354],[457,392],[340,510],[210,468]]
    },
    puntosDeInteres: [
      { texto: "Canchas múltiples", direccion: 'centro' },
      { texto: "Gimnasio", direccion: 'arriba-derecha' }
    ]
  },
  {
    id: 'bloque_col',
    nombre: 'Colegio',
    icono: '🔬',
    descripcion: 'Edificio del colegio de la universidad.',
    localizacion: '📍 Campus parte alta',
    mapa: {
      pinIcono: 'colegio',
      pin:  [175, 135],
      zona: [[203,218], [300,169], [392,197], [404,193], [588,251], [590,295], [549,321],[348,253],[314,269],[274,257],[252,271],[203,254]]
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
      pinIcono: 'edificio',
      pin:  [590, 58],
      zona: [[543,155], [553,150], [553,139], [563,131], [567,133], [594,118], [612,124], [647,106],[692,125],[693,130],[805,177],[809,174],[828,182],[832,181],[869,196],[870,238],[842,259],[808,245],[803,248],[804,262],[749,296],[691,270],[676,272],[632,248],[620,238],[613,241],[543,209]]
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
      pinIcono: 'auditorio',
      pin:  [942, 58],
      zona: [[854,173], [853,188], [870,195], [870,200], [906,216], [938,193], [942,194],[945,192],[999,213],[1040,182],[1040,154],[1043,152],[933,112],[920,118],[916,118],[850,169]]
    },
    puntosDeInteres: [
      { texto: "Auditorio principal", direccion: 'centro' },
      { texto: "Camerinos", direccion: 'derecha' }
    ]
  },
  {
    id: 'bloque_innova',
    nombre: 'Innovamater',
    icono: '💡',
    descripcion: 'Centro de idiomas, sala de sistemas y auditorio.',
    localizacion: '📍 Campus parte baja',
    mapa: {
      pinIcono: 'idea',
      pin:  [1287, 228],
      zona: [[1355,354],[1357,449],[1264,486],[1255,481],[1241,487],[1197,448],[1197,442],[1189,437],[1191,359],[1217,344],[1219,339],[1253,328],[1256,330],[1276,324],[1280,327],[1292,324],[1297,327],[1297,321],[1311,315],[1323,324],[1324,335]]
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
      pinIcono: 'capilla',
      pin:  [1449, 295],
      zona: [[1356,357],[1374,348],[1390,347],[1408,346],[1418,353],[1429,352],[1440,343],[1453,359],[1454,422],[1437,430],[1427,427],[1421,431],[1410,434],[1392,435],[1375,438],[1358,437]]
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
      pinIcono: 'edificio',
      pin:  [995, 365],
      zona: [[929,430],[1036,390],[1062,378],[1205,482],[1204,570],[1066,631],[929,524]]
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
// Las usan el panel admin y la ficha del mapa. Un edificio sin foto aquí
// muestra su ícono en admin y un recorte de la ilustración en el mapa.
// Ojo: en el servidor las mayúsculas importan (bloque_J ≠ bloque_j).
export const FOTOS_EDIFICIOS = {
  bloque_edc:    'img/edc.webp',
  edificio_j:    'img/bloque_J.webp',
  coliseo:       'img/coliseo.webp',
  bloque_col:    'img/colegio.webp',
  bloque_m:      'img/bloque_m.webp',
  auditorio:     'img/auditorio.webp',
  bloque_innova: 'img/innova.webp',
  capilla:       'img/capilla.webp'
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
