/**
 * EscaneoObserver.js
 * Observador para los nuevos escaneos en una sesión.
 */
import { supabase } from '../config.js';
import { eventBus, EVENTOS } from './EventBus.js';

export class EscaneoObserver {
  constructor(sesionId) {
    this.sesionId = sesionId;
    this.canal = supabase.channel('escaneos-' + sesionId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'escaneos',
          filter: `sesion_id=eq.${sesionId}`
        },
        (payload) => {
          eventBus.emit(EVENTOS.ESCANEO_NUEVO, payload.new);
        }
      )
      .subscribe();
  }

  destruir() {
    supabase.removeChannel(this.canal);
  }
}
