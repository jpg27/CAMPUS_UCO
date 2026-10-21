// ═══════════════════════════════════════════
// clasificacion.js — Puntos parciales y orden del ranking
// ═══════════════════════════════════════════
// Une los participantes con sus escaneos para mostrar cuántos edificios
// lleva cada uno y cuántos puntos tiene, aunque no haya terminado.
//
// Orden:
//   1. Quienes completaron la carrera, por su posición oficial (la calcula
//      el servidor en finalizar_participante).
//   2. Quienes no terminaron, por número de edificios y luego por puntos.

/**
 * @param {Array} participantes  filas de `participantes`
 * @param {Array} escaneos       filas de `escaneos` de la sesión
 *                               (participante_id, puntos, respondio_correctamente)
 * @returns {Array} participantes con: edificios, puntos, correctas, incorrectas
 */
export function clasificarParticipantes(participantes = [], escaneos = []) {
  const porParticipante = new Map();
  (escaneos || []).forEach(e => {
    const id = String(e.participante_id);
    const acc = porParticipante.get(id) || { edificios: 0, puntos: 0, correctas: 0, incorrectas: 0 };
    acc.edificios += 1;
    acc.puntos += e.puntos || 0;
    if (e.respondio_correctamente === true) acc.correctas += 1;
    if (e.respondio_correctamente === false) acc.incorrectas += 1;
    porParticipante.set(id, acc);
  });

  const lista = (participantes || []).map(p => {
    const acc = porParticipante.get(String(p.id)) || { edificios: 0, puntos: 0, correctas: 0, incorrectas: 0 };
    return {
      ...p,
      edificios: acc.edificios,
      // Si ya completó, manda el total oficial del servidor
      puntos: p.completado && p.puntos_total != null ? p.puntos_total : acc.puntos,
      correctas: acc.correctas,
      incorrectas: acc.incorrectas
    };
  });

  return lista.sort((a, b) => {
    if (a.completado !== b.completado) return a.completado ? -1 : 1;
    if (a.completado) {
      const pa = a.posicion ?? Infinity, pb = b.posicion ?? Infinity;
      if (pa !== pb) return pa - pb;
      return (b.puntos || 0) - (a.puntos || 0);
    }
    if (a.edificios !== b.edificios) return b.edificios - a.edificios;
    return (b.puntos || 0) - (a.puntos || 0);
  });
}

/** Resumen de un participante a partir de sus escaneos. */
export function resumirEscaneos(escaneos = []) {
  return (escaneos || []).reduce((acc, e) => {
    acc.edificios += 1;
    acc.puntos += e.puntos || 0;
    if (e.respondio_correctamente === true) acc.correctas += 1;
    if (e.respondio_correctamente === false) acc.incorrectas += 1;
    return acc;
  }, { edificios: 0, puntos: 0, correctas: 0, incorrectas: 0 });
}

/** 2450 → "2.450" */
export function formatearPuntos(n) {
  return Number(n || 0).toLocaleString('es-CO');
}
