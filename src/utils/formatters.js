// ═══════════════════════════════════════════
// FORMATTERS.JS — Funciones de formato reutilizables
// ═══════════════════════════════════════════

/**
 * Formatea segundos a formato m:ss
 * @param {number} segundos
 * @returns {string}
 */
export function formatearTiempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formatea una fecha ISO a hora local (HH:MM)
 * @param {string} fechaISO
 * @returns {string}
 */
export function formatearHora(fechaISO) {
  return new Date(fechaISO).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formatea una fecha ISO a fecha local (DD/MM/YYYY)
 * @param {string} fechaISO
 * @returns {string}
 */
export function formatearFecha(fechaISO) {
  return new Date(fechaISO).toLocaleDateString('es-CO');
}
