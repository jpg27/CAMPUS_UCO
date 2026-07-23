/**
 * ParticipanteObserver.js
 * Observador para los cambios en los participantes de una sesión.
 */
import { supabase } from '../config.js';
import { eventBus, EVENTOS } from './EventBus.js';

export class ParticipanteObserver {
  constructor(sesionId) {
    this.sesionId = sesionId;
    this.canal = supabase.channel('participantes-' + sesionId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participantes',
          filter: `sesion_id=eq.${sesionId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            eventBus.emit(EVENTOS.PARTICIPANTE_NUEVO, payload.new);
          } else if (payload.eventType === 'UPDATE') {
            eventBus.emit(EVENTOS.PARTICIPANTE_ACTUALIZADO, payload.new);
          }
        }
      )
      .subscribe();
  }

  destruir() {
    supabase.removeChannel(this.canal);
  }
}
