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

// ── Edificios (fuente única de verdad) ──
export const EDIFICIOS = [
    {
    id: 'bloque_edc',
    nombre: 'Bloque EDC',
    icono: '📚',
    descripcion: 'Bloque de laboratorios y biblioteca.',
    localizacion: '📍 Campus parte media',
    archivo: 'sprites/Bloque_EDC.png',
    x: -2.76, y: -2.40, ancho: 2.04
  },
    {
    id: 'edificio_j',
    nombre: 'Edificio J',
    icono: '🏢',
    descripcion: 'Bloque de salones.',
    localizacion: '📍 Campus parte baja',
    archivo: 'sprites/Bloque_J.png',
    x: -0.02, y: -1.23, ancho: 1.3
  },
    {
    id: 'coliseo',
    nombre: 'Coliseo',
    icono: '🏟️',
    descripcion: 'Coliseo deportivo.',
    localizacion: '📍 Campus parte alta',
    archivo: 'sprites/Coliseo.png',
    x: -2.58, y: 0.55, ancho: 1.4
  },
  {
    id: 'bloque_col',
    nombre: 'Bloque COL',
    icono: '🔬',
    descripcion: 'Edificio del colegio de la universidad.',
    localizacion: '📍 Campus parte alta',
    archivo: 'sprites/Bloque_Col.png',
    x: -2.18, y: 1.66, ancho: 2.05
  },
  {
    id: 'bloque_m',
    nombre: 'Bloque M',
    icono: '🏫',
    descripcion: 'Bloque principal de la universidad.',
    localizacion: '📍 Campus parte alta',
    archivo: 'sprites/Bloque_M.png',
    x: -1.09, y: 1.91, ancho: 2.3
  },
  {
    id: 'auditorio',
    nombre: 'Auditorio',
    icono: '🎭',
    descripcion: 'Auditorio principal.',
    localizacion: '📍 Campus parte alta',
    archivo: 'sprites/Auditorio.png',
    x: 0.40, y: 2.23, ancho: 1.22
  },
  {
    id: 'bloque_innova',
    nombre: 'Bloque INNOVA',
    icono: '💡',
    descripcion: 'Centro de idiomas, sala de sistemas y auditorio.',
    localizacion: '📍 Campus parte baja',
    archivo: 'sprites/Bloque_INNOVA.png',
    x: 2.60, y: 0.22, ancho: 0.99
  },
    {
    id: 'capilla',
    nombre: 'Capilla',
    icono: '⛪',
    descripcion: 'Capilla del campus.',
    localizacion: '📍 Campus parte baja',
    archivo: 'sprites/Capilla.png',
    x: 3.28, y: 0.09, ancho: 0.4
  },
  {
    id: 'bloque_nuevo',
    nombre: 'Bloque Nuevo',
    icono: '🏗️',
    descripcion: 'Bloque en construcción.',
    localizacion: '📍 Campus parte baja',
    archivo: 'sprites/Bloque_Nuevo_v2.png',
    x: 1.43, y: -0.14, ancho: 1.79
  },
  {
    id: 'bloque_de',
    nombre: 'Bloque D y E',
    icono: '⚙️',
    descripcion: 'Bloque de deportes.',
    localizacion: '📍 Campus parte media',
    archivo: 'sprites/Bloque_D_E.png',
    x: 2.15, y: 0.66, ancho: 1.6
  }
];

// ── Mapeo de target indexes de MindAR a edificios ──
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
  MS_POR_TICK_AR: 10000,
  MS_POR_TICK_MAPA: 5000,
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
