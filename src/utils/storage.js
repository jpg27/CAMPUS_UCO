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

// ── Limpiar todo al cerrar sesión ──
export function limpiarTodo() {
  limpiarParticipante();
  limpiarSesion();
  limpiarPuntos();
}
