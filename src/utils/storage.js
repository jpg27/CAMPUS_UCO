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
export function guardarPuntos(puntos, sesionId) {
  localStorage.setItem('puntos_actuales', puntos);
  localStorage.setItem('puntos_timestamp', Date.now());
  localStorage.setItem('puntos_sesion', sesionId);
}

export function obtenerPuntos(sesionId) {
  const pts = localStorage.getItem('puntos_actuales');
  const ts = localStorage.getItem('puntos_timestamp');
  const sid = localStorage.getItem('puntos_sesion');

  if (pts && ts && sid === sesionId) {
    return {
      puntos: parseInt(pts),
      timestamp: parseInt(ts),
      valido: true
    };
  }
  return { puntos: 0, timestamp: 0, valido: false };
}

export function limpiarPuntos() {
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
