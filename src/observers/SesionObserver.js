/**
 * SesionObserver.js
 * Observador para los cambios de estado en las sesiones.
 */
import { supabase } from '../config.js';
import { eventBus, EVENTOS } from './EventBus.js';

export class SesionObserver {
  constructor(sesionId) {
    this.sesionId = sesionId;
    this.canal = supabase.channel('sesion-' + sesionId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sesiones',
          filter: `id=eq.${sesionId}`
        },
        (payload) => {
          if (payload.new.estado === 'activa') {
            eventBus.emit(EVENTOS.SESION_ACTIVADA, payload.new);
          } else if (payload.new.estado === 'cerrada') {
            eventBus.emit(EVENTOS.SESION_CERRADA, payload.new);
          }
        }
      )
      .subscribe();
  }

  destruir() {
    supabase.removeChannel(this.canal);
  }
}
