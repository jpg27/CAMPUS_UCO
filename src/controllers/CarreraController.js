// ═══════════════════════════════════════════
// CarreraController.js — Orquestador de unirse a carrera
// ═══════════════════════════════════════════
import { CarreraView } from '../views/CarreraView.js';
import { obtenerSesionPorCodigo } from '../models/SesionModel.js';
import { unirseASesion } from '../models/ParticipanteModel.js';
import { guardarParticipante, guardarSesion, asegurarTramo } from '../utils/storage.js';
import { SesionObserver } from '../observers/SesionObserver.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';

export class CarreraController {
  constructor() {
    this.view = new CarreraView();
    this.sesionObserver = null;
    this.unsubSesionActivada = null;
    this.unsubSesionCerrada = null;
  }

  destruir() {
    this.unsubSesionActivada?.();
    this.unsubSesionCerrada?.();
    this.sesionObserver?.destruir();
  }

  init() {
    this.view.onUnirse(() => this.unirse());
    this.view.onEnterCodigo(() => this.unirse());
    this.view.onEnterNombre();
  }

  async unirse() {
    const { nombre, codigo } = this.view.obtenerDatosFormulario();

    this.view.ocultarError();

    if (!nombre) {
      this.view.mostrarError('Escribe tu nombre y tu apellido para unirte.', { titulo: 'Falta tu nombre', campo: 'input-nombre' });
      return;
    }
    // Al menos dos palabras de 2+ letras (nombre y apellido), para poder
    // distinguir a dos "Juan" en la misma carrera.
    const palabras = nombre.split(' ').filter(p => /^[\p{L}'-]{2,}$/u.test(p));
    if (palabras.length < 2) {
      this.view.mostrarError('Escribe nombre y apellido separados por un espacio, por ejemplo: Juan Pérez.', { titulo: 'Falta tu apellido', campo: 'input-nombre' });
      return;
    }
    if (!codigo) {
      this.view.mostrarError('Pídele el código al organizador de la carrera.', { titulo: 'Falta el código', campo: 'input-codigo' });
      return;
    }

    this.view.deshabilitarBoton('Buscando sesión...');

    try {
      const sesion = await obtenerSesionPorCodigo(codigo);

      if (!sesion) {
        this.view.mostrarError('Revisa que el código esté bien escrito. Si es correcto, la carrera ya terminó.', { titulo: 'No encontramos esa carrera', tipo: 'error', campo: 'input-codigo' });
        this.view.habilitarBoton();
        return;
      }

      const participante = await unirseASesion(sesion.id, nombre);

      // Guardar en localStorage
      guardarParticipante(participante);
      guardarSesion(sesion);

      // Mostrar pantalla de espera
      this.view.mostrarEspera(nombre, sesion);

      // Si ya está activa, ir directo
      if (sesion.estado === 'activa') {
        // El contador de puntos arranca cuando la carrera está activa
        asegurarTramo(sesion.id);
        setTimeout(() => {
          window.location.href = 'ar.html';
        }, 1500);
        return;
      }

      // Escuchar cambios de sesión
      this.sesionObserver = new SesionObserver(sesion.id);

      this.unsubSesionActivada = eventBus.on(EVENTOS.SESION_ACTIVADA, () => {
        // El contador de puntos arranca cuando la carrera está activa
        asegurarTramo(sesion.id);
        
        this.view.mostrarSesionActivada();
        setTimeout(() => {
          window.location.href = 'ar.html';
        }, 1500);
      });

      this.unsubSesionCerrada = eventBus.on(EVENTOS.SESION_CERRADA, () => {
        this.view.mostrarSesionCerrada();
      });

    } catch (e) {
      this.view.mostrarError('Revisa tu conexión a internet e intenta de nuevo.', { titulo: 'No pudimos unirte', tipo: 'error' });
      this.view.habilitarBoton();
    }
  }
}
