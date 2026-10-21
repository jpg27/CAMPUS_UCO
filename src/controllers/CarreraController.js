// ═══════════════════════════════════════════
// CarreraController.js — Orquestador de unirse a carrera
// ═══════════════════════════════════════════
import { CarreraView } from '../views/CarreraView.js';
import { obtenerSesionPorCodigo, obtenerSesionAbiertaPorId } from '../models/SesionModel.js';
import { unirseASesion, obtenerParticipanteDeSesion, horaUltimoEscaneo } from '../models/ParticipanteModel.js';
import {
  guardarParticipante, guardarSesion, asegurarTramo, obtenerTramo, crearTramo,
  obtenerParticipante, obtenerSesion,
  guardarCookieCarrera, leerCookieCarrera, borrarCookieCarrera, vencimientoCarrera
} from '../utils/storage.js';
import { SesionObserver } from '../observers/SesionObserver.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';

export class CarreraController {
  constructor() {
    this.view = new CarreraView();
    this.sesionObserver = null;
    this.unsubSesionActivada = null;
    this.unsubSesionCerrada = null;
    this.reconexion = null;   // { participante, sesion } si hay una carrera para retomar
  }

  destruir() {
    this.unsubSesionActivada?.();
    this.unsubSesionCerrada?.();
    this.sesionObserver?.destruir();
  }

  async init() {
    this.view.onUnirse(() => this.unirse());
    this.view.onEnterCodigo(() => this.unirse());
    this.view.onEnterNombre();
    this.view.onReconectar(() => this.reconectar());
    this.view.onNoSoyYo(() => this.descartarReconexion());

    await this._buscarCarreraPendiente();
  }

  /**
   * ¿Este navegador ya está en una carrera abierta? Se mira la cookie de
   * reconexión (y, por compatibilidad, los datos guardados en el celular).
   * Si la carrera sigue abierta, se ofrece "Continuar como …".
   */
  async _buscarCarreraPendiente() {
    const datos = this._datosGuardados();
    if (!datos) return;
    try {
      const sesion = await obtenerSesionAbiertaPorId(datos.s);
      const participante = sesion ? await obtenerParticipanteDeSesion(datos.p, sesion.id) : null;
      if (!sesion || !participante) {
        borrarCookieCarrera();
        return;
      }
      this.reconexion = { participante, sesion };
      // Si ya terminó, se le ofrece ver su resultado (y no puede volver a
      // unirse como participante nuevo a la misma carrera desde este navegador)
      this.view.mostrarReconexion(participante.nombre, sesion, { completado: !!participante.completado });
    } catch (e) {
      // Sin conexión: se deja el formulario normal
    }
  }

  _datosGuardados() {
    const cookie = leerCookieCarrera();
    if (cookie) return cookie;
    const p = obtenerParticipante();
    const s = obtenerSesion();
    return p && s ? { s: s.id, p: p.id, n: p.nombre, c: s.codigo } : null;
  }

  async reconectar() {
    if (!this.reconexion) return;
    const { participante, sesion } = this.reconexion;
    this.view.deshabilitarBotonReconectar('Reconectando...');
    try {
      await this._entrar(participante, sesion, { reconectado: true });
    } catch (e) {
      this.view.habilitarBotonReconectar();
      this.view.mostrarError('Revisa tu conexión a internet e intenta de nuevo.', { titulo: 'No pudimos reconectarte', tipo: 'error' });
    }
  }

  descartarReconexion() {
    borrarCookieCarrera();
    this.reconexion = null;
    this.view.ocultarReconexion();
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

      // Si este navegador ya se había unido a ESTA carrera, se reutiliza el
      // mismo participante en lugar de crear un duplicado.
      const previo = this._datosGuardados();
      if (previo && String(previo.s) === String(sesion.id)) {
        const existente = await obtenerParticipanteDeSesion(previo.p, sesion.id);
        if (existente) {
          await this._entrar(existente, sesion, { reconectado: true });
          return;
        }
      }

      const participante = await unirseASesion(sesion.id, nombre);
      await this._entrar(participante, sesion, { reconectado: false });

    } catch (e) {
      this.view.mostrarError('Revisa tu conexión a internet e intenta de nuevo.', { titulo: 'No pudimos unirte', tipo: 'error' });
      this.view.habilitarBoton();
    }
  }

  /** Guarda los datos, deja la cookie de reconexión y entra a la espera o a la cámara. */
  async _entrar(participante, sesion, { reconectado }) {
    guardarParticipante(participante);
    guardarSesion(sesion);
    this._guardarCookie(participante, sesion);

    this.view.mostrarEspera(participante.nombre, sesion, { reconectado });

    if (sesion.estado === 'activa') {
      await this._prepararTramo(participante, sesion, reconectado);
      setTimeout(() => { window.location.href = 'ar.html'; }, reconectado ? 900 : 1500);
      return;
    }

    // Escuchar cambios de sesión
    this.sesionObserver = new SesionObserver(sesion.id);

    this.unsubSesionActivada = eventBus.on(EVENTOS.SESION_ACTIVADA, (nueva) => {
      const activa = { ...sesion, ...(nueva || {}), estado: 'activa' };
      guardarSesion(activa);
      // Ahora la cookie vence 3 horas después de la activación
      this._guardarCookie(participante, activa);
      // El contador de puntos arranca cuando la carrera está activa
      asegurarTramo(sesion.id);

      this.view.mostrarSesionActivada();
      setTimeout(() => {
        window.location.href = 'ar.html';
      }, 1500);
    });

    this.unsubSesionCerrada = eventBus.on(EVENTOS.SESION_CERRADA, () => {
      borrarCookieCarrera();
      this.view.mostrarSesionCerrada();
    });
  }

  _guardarCookie(participante, sesion) {
    guardarCookieCarrera(
      { s: sesion.id, p: participante.id, n: participante.nombre, c: sesion.codigo },
      vencimientoCarrera(sesion)
    );
  }

  /**
   * Cronómetro del tramo. Si al reconectar se perdió (se borraron los datos
   * del celular), NO se reinicia en 1000: se retoma desde el último edificio
   * registrado o, si aún no tiene ninguno, desde que se activó la carrera.
   */
  async _prepararTramo(participante, sesion, reconectado) {
    if (obtenerTramo(sesion.id)) return;
    if (!reconectado) { asegurarTramo(sesion.id); return; }
    let inicio = null;
    try { inicio = await horaUltimoEscaneo(participante.id); } catch (e) { /* sin red */ }
    if (!inicio && sesion.activada_en) inicio = new Date(sesion.activada_en).getTime();
    crearTramo(sesion.id, inicio || Date.now());
  }
}
