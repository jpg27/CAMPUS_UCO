// ═══════════════════════════════════════════
// EVENTBUS.JS — Pub/Sub interno para comunicación entre capas
// ═══════════════════════════════════════════

class EventBus {
  #listeners = {};

  /**
   * Suscribe un callback a un evento
   * @param {string} event - Nombre del evento
   * @param {Function} callback - Función a ejecutar
   * @returns {Function} Función para desuscribirse
   */
  on(event, callback) {
    if (!this.#listeners[event]) {
      this.#listeners[event] = new Set();
    }
    this.#listeners[event].add(callback);

    // Retorna función de limpieza
    return () => {
      this.#listeners[event]?.delete(callback);
      if (this.#listeners[event]?.size === 0) {
        delete this.#listeners[event];
      }
    };
  }

  /**
   * Suscribe un callback que se ejecuta solo una vez
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Función para desuscribirse
   */
  once(event, callback) {
    const wrapper = (data) => {
      unsub();
      callback(data);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  /**
   * Emite un evento con datos opcionales
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (this.#listeners[event]) {
      for (const callback of this.#listeners[event]) {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EventBus] Error en handler de '${event}':`, err);
        }
      }
    }
  }

  /**
   * Elimina todas las suscripciones de un evento
   * @param {string} event
   */
  off(event) {
    delete this.#listeners[event];
  }

  /**
   * Elimina TODAS las suscripciones
   */
  destruir() {
    this.#listeners = {};
  }
}

// Instancia singleton
export const eventBus = new EventBus();

// ── Nombres de eventos del sistema ──
export const EVENTOS = {
  // Sesión
  SESION_ACTIVADA: 'sesion:activada',
  SESION_CERRADA: 'sesion:cerrada',

  // Participantes
  PARTICIPANTE_NUEVO: 'participante:nuevo',
  PARTICIPANTE_ACTUALIZADO: 'participante:actualizado',

  // Escaneos
  ESCANEO_NUEVO: 'escaneo:nuevo',
  ESCANEO_DUPLICADO: 'escaneo:duplicado',

  // Puntos
  PUNTOS_ACTUALIZADOS: 'puntos:actualizados',
  PUNTOS_RESET: 'puntos:reset',

  // Carrera
  CARRERA_COMPLETADA: 'carrera:completada'
};
