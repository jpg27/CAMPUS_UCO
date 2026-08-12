// ═══════════════════════════════════════════
// CarreraController.js — Orquestador de unirse a carrera
// ═══════════════════════════════════════════
import { CarreraView } from '../views/CarreraView.js';
import { obtenerSesionPorCodigo } from '../models/SesionModel.js';
import { unirseASesion } from '../models/ParticipanteModel.js';
import { guardarParticipante, guardarSesion } from '../utils/storage.js';
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
      this.view.mostrarError('Por favor ingresa tu nombre o nickname');
      return;
    }
    if (!codigo) {
      this.view.mostrarError('Por favor ingresa el código de sesión');
      return;
    }

    this.view.deshabilitarBoton('Buscando sesión...');

    try {
      const sesion = await obtenerSesionPorCodigo(codigo);

      if (!sesion) {
        this.view.mostrarError('Código incorrecto o la sesión no está activa todavía. Espera a que el administrador la inicie.');
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
        setTimeout(() => {
          window.location.href = 'ar.html';
        }, 1500);
        return;
      }

      // Escuchar cambios de sesión
      this.sesionObserver = new SesionObserver(sesion.id);

      this.unsubSesionActivada = eventBus.on(EVENTOS.SESION_ACTIVADA, () => {
        this.view.mostrarSesionActivada();
        setTimeout(() => {
          window.location.href = 'ar.html';
        }, 1500);
      });

      this.unsubSesionCerrada = eventBus.on(EVENTOS.SESION_CERRADA, () => {
        this.view.mostrarSesionCerrada();
      });

    } catch (e) {
      this.view.mostrarError('Ocurrió un error. Intenta de nuevo.');
      this.view.habilitarBoton();
    }
  }
}
