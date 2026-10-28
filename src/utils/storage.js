// ═══════════════════════════════════════════
// STORAGE.JS — Wrapper centralizado de localStorage
// ═══════════════════════════════════════════

// ── Participante ──
export function guardarParticipante(participante) {
  localStorage.setItem('participante', JSON.stringify(participante));
}

export function obtenerParticipante() {
  const str = localStorage.getItem('participante');
  return str ? JSON.parse(str) : null;
}

export function limpiarParticipante() {
  localStorage.removeItem('participante');
}

// ── Sesión ──
export function guardarSesion(sesion) {
  localStorage.setItem('sesion', JSON.stringify(sesion));
}

export function obtenerSesion() {
  const str = localStorage.getItem('sesion');
  return str ? JSON.parse(str) : null;
}

export function limpiarSesion() {
  localStorage.removeItem('sesion');
}

// ── Puntos (cronómetro) ──
// Se guarda el "tramo" en curso: cuándo empezó y cuánta penalización lleva.
// Los puntos se calculan a partir de eso (ver PuntosController), así que el
// valor es el mismo en AR y en el mapa y no se reinicia al cambiar de vista.
const CLAVE_TRAMO = 'puntos_tramo';

export function obtenerTramo(sesionId) {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE_TRAMO));
    return t && String(t.sesionId) === String(sesionId) && Number.isFinite(t.inicio) ? t : null;
  } catch { return null; }
}

export function guardarTramo(tramo) {
  localStorage.setItem(CLAVE_TRAMO, JSON.stringify(tramo));
}

/** Crea (y guarda) un tramo que empieza ahora, con 0 de penalización. */
export function crearTramo(sesionId, inicio = Date.now()) {
  const tramo = { sesionId, inicio, penalizacion: 0 };
  guardarTramo(tramo);
  return tramo;
}

/** Crea el tramo solo si todavía no existe uno para esta sesión. */
export function asegurarTramo(sesionId) {
  return obtenerTramo(sesionId) || crearTramo(sesionId);
}

export function limpiarPuntos() {
  localStorage.removeItem(CLAVE_TRAMO);
  // Claves del formato anterior (contador que se guardaba en cada tick)
  localStorage.removeItem('puntos_actuales');
  localStorage.removeItem('puntos_timestamp');
  localStorage.removeItem('puntos_sesion');
}

// ── Modo Libre (progreso local) ──
export function guardarProgresoLibre(edificioId, datos) {
  const progreso = obtenerProgresoLibre();
  progreso[edificioId] = {
    ...datos,
    timestamp: Date.now()
  };
  localStorage.setItem('progreso_libre', JSON.stringify(progreso));
}

export function obtenerProgresoLibre() {
  const str = localStorage.getItem('progreso_libre');
  return str ? JSON.parse(str) : {};
}

export function limpiarProgresoLibre() {
  localStorage.removeItem('progreso_libre');
}

// ── Cookie de reconexión a la carrera ──
// Guarda en el navegador a qué carrera se unió la persona y con qué
// participante, para que si recarga, cierra la app o borra sin querer los
// datos de la carrera (p. ej. tocando "Modo Libre"), vuelva a entrar con el
// MISMO participante en vez de crear uno nuevo.
// La cookie vence cuando vence la carrera (3 horas desde que se activó),
// así que solo sirve mientras la carrera está abierta.
const COOKIE_CARRERA = 'campus_carrera';
export const HORAS_MAX_CARRERA = 3;

function rutaCookie() {
  const p = location.pathname;
  return p.slice(0, p.lastIndexOf('/') + 1) || '/';
}

/** Momento (ms) en que vence la carrera: activación (o creación) + 3 h. */
export function vencimientoCarrera(sesion) {
  const base = new Date(sesion?.activada_en || sesion?.creada_en || Date.now()).getTime();
  return base + HORAS_MAX_CARRERA * 60 * 60 * 1000;
}

/**
 * @param {{s:string, p:string, n:string, c:string}} datos
 *        s = id de la sesión, p = id del participante, n = nombre, c = código
 */
export function guardarCookieCarrera(datos, venceEnMs) {
  const segundos = Math.floor((venceEnMs - Date.now()) / 1000);
  if (segundos <= 0) { borrarCookieCarrera(); return; }
  const seguro = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_CARRERA}=${encodeURIComponent(JSON.stringify(datos))}; Max-Age=${segundos}; Path=${rutaCookie()}; SameSite=Lax${seguro}`;
}

export function leerCookieCarrera() {
  const par = document.cookie.split('; ').find(c => c.startsWith(COOKIE_CARRERA + '='));
  if (!par) return null;
  try {
    const datos = JSON.parse(decodeURIComponent(par.slice(COOKIE_CARRERA.length + 1)));
    return datos && datos.s && datos.p ? datos : null;
  } catch { return null; }
}

export function borrarCookieCarrera() {
  document.cookie = `${COOKIE_CARRERA}=; Max-Age=0; Path=${rutaCookie()}; SameSite=Lax`;
}

// ── Limpiar todo al cerrar sesión ──
export function limpiarTodo() {
  limpiarParticipante();
  limpiarSesion();
  limpiarPuntos();
  borrarCookieCarrera();
}
