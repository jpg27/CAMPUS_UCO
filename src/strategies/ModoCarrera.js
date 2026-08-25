/**
 * ModoCarrera.js
 * Estrategia para el modo carrera (competitivo).
 * Dueña de su flujo completo: validaciones, preguntas, puntos, registro en
 * Supabase, panel de logros y pantalla de finalización.
 */
import { GameStrategy } from './GameStrategy.js';
import { registrarEscaneo } from '../models/EscaneoModel.js';
import { obtenerPreguntaAleatoria } from '../models/PreguntaModel.js';
import { obtenerEdificiosSesion } from '../models/EdificioModel.js';
import { supabase, PUNTOS } from '../config.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';
import { SesionObserver } from '../observers/SesionObserver.js';
import { limpiarTodo } from '../utils/storage.js';
import { PuntosDisplay } from '../views/components/PuntosDisplay.js';
import { PuntosController } from '../controllers/PuntosController.js';

export class ModoCarrera extends GameStrategy {
  constructor(participante, sesion) {
    super();
    this.participante = participante;
    this.sesion = sesion;
    this.edificiosHabilitados = [];
    this.puntosController = null;
    this.sesionObserver = null;
    this.unsubSesionCerrada = null;

    // Estado de la pregunta en curso
    this.edificioActual = null;
    this.preguntaActual = null;
    this.targetActual = null;
    this.respuestaRegistrada = false;
    this.respondioCorrectamente = false;
  }

  async init(contexto) {
    const { view } = contexto;

    const edificiosSesion = await obtenerEdificiosSesion(this.sesion.id);
    this.edificiosHabilitados = edificiosSesion.map(e => e.edificio_id);

    const display = new PuntosDisplay('display-puntos');
    this.puntosController = new PuntosController(display, PUNTOS.MS_POR_TICK_AR);

    this.sesionObserver = new SesionObserver(this.sesion.id);
    this.unsubSesionCerrada = eventBus.on(EVENTOS.SESION_CERRADA, () => {
      this.puntosController?.detener();
      limpiarTodo();
      view.detenerAR();
      view.mostrarSesionCerrada();
    });

    view.onResponder((letra) => this._responder(letra, view));
    view.onContinuar(() => this._continuar(contexto));
  }

  async manejarDeteccion(edificio, targetEntity, contexto) {
    const { view, notificacion } = contexto;

    if (!this.edificiosHabilitados.includes(edificio.id)) {
      notificacion.mostrar('🚫 ' + edificio.nombre, 'Este edificio no forma parte de tu carrera', null);
      return;
    }

    const { data: yaEscaneado } = await supabase
      .from('escaneos')
      .select('id')
      .eq('participante_id', this.participante.id)
      .eq('edificio_id', edificio.id)
      .maybeSingle();

    if (yaEscaneado) {
      notificacion.mostrar(edificio.icono + ' ' + edificio.nombre, 'Ya completaste este edificio ✅', null);
      return;
    }

    const pregunta = await obtenerPreguntaAleatoria(edificio.id);

    if (!pregunta) {
      await this._registrarSinPregunta(edificio, targetEntity, contexto);
      return;
    }

    this.edificioActual = edificio;
    this.preguntaActual = pregunta;
    this.targetActual = targetEntity;
    this.respuestaRegistrada = false;
    this.respondioCorrectamente = false;
    this.puntosController?.detener();
    view.mostrarModalPregunta(edificio, pregunta);
  }

  _responder(letra, view) {
    if (this.respuestaRegistrada) return;
    this.respuestaRegistrada = true;
    this.respondioCorrectamente = this.preguntaActual.respuesta_correcta === letra;

    view.marcarRespuesta(letra, this.preguntaActual.respuesta_correcta);

    if (this.respondioCorrectamente && this.targetActual) {
      const model = this.targetActual.querySelector('a-gltf-model');
      if (model) model.setAttribute('visible', 'true');
    }

    if (this.respondioCorrectamente) {
      this.puntosController?.aplicarBonus();
    } else {
      this.puntosController?.aplicarPenalizacion();
    }
  }

  async _continuar(contexto) {
    const { view, notificacion } = contexto;
    view.ocultarModalPregunta();

    if (this.targetActual) {
      const model = this.targetActual.querySelector('a-gltf-model');
      if (model) model.setAttribute('visible', 'false');
    }

    try {
      const puntos = this.puntosController ? this.puntosController.obtenerPuntos() : 0;

      const resultado = await registrarEscaneo(
        this.participante.id,
        this.sesion.id,
        this.edificioActual.id,
        this.sesion.total_edificios,
        puntos,
        this.preguntaActual.id,
        this.respondioCorrectamente
      );

      if (resultado.esUltimo) {
        await this._mostrarPantallaFinalizacion(view);
      } else {
        notificacion.mostrar(
          this.edificioActual.icono + ' ' + this.edificioActual.nombre,
          'Edificio registrado — sigue al siguiente',
          puntos
        );
      }

      if (this.puntosController && !resultado.esUltimo) {
        setTimeout(() => this.puntosController.resetear(this.sesion.id), 3000);
      }
    } catch (e) {
      console.error('Error:', e);
      notificacion.mostrar('❌ Error', 'No se pudo registrar el escaneo', null);
      this.puntosController?.resetear(this.sesion.id);
    }
  }

  async _registrarSinPregunta(edificio, targetEntity, contexto) {
    const { view, notificacion } = contexto;
    try {
      const puntos = this.puntosController ? this.puntosController.obtenerPuntos() : 0;
      const resultado = await registrarEscaneo(
        this.participante.id,
        this.sesion.id,
        edificio.id,
        this.sesion.total_edificios,
        puntos
      );

      if (resultado.duplicado) {
        notificacion.mostrar(edificio.icono + ' Ya escaneado', `${edificio.nombre} ya fue registrado`, null);
        return;
      }

      this.puntosController?.detener();

      if (targetEntity) {
        const model = targetEntity.querySelector('a-gltf-model');
        if (model) {
          model.setAttribute('visible', 'true');
          setTimeout(() => model.setAttribute('visible', 'false'), 4000);
        }
      }

      if (resultado.esUltimo) {
        await this._mostrarPantallaFinalizacion(view);
      } else {
        notificacion.mostrar(edificio.icono + ' ' + edificio.nombre, 'Edificio registrado', puntos);
      }

      if (this.puntosController && !resultado.esUltimo) {
        setTimeout(() => this.puntosController.resetear(this.sesion.id), 3000);
      }
    } catch (e) {
      notificacion.mostrar('❌ Error', 'No se pudo registrar', null);
    }
  }

  async _mostrarPantallaFinalizacion(view) {
    this.puntosController?.detener();

    const { data: datosFinales } = await supabase
      .from('participantes')
      .select('nombre, puntos_total, tiempo_total, posicion')
      .eq('id', this.participante.id)
      .single();

    const nombre = datosFinales?.nombre || this.participante.nombre || 'Participante';
    const puntosTotal = datosFinales?.puntos_total || 0;
    const tiempoTotal = datosFinales?.tiempo_total || 0;

    const min = Math.floor(tiempoTotal / 60);
    const seg = tiempoTotal % 60;
    const tiempoStr = `${min}m ${seg}s`;

    view.mostrarPantallaFinalizacion(nombre, puntosTotal, tiempoStr);
  }

  alCargarEscena(contexto) {
    this.puntosController?.iniciar(this.sesion.id);
  }

  alIrAlMapa(contexto) {
    this.puntosController?.guardar(this.sesion.id);
  }

  tieneLogros() {
    return true;
  }

  async mostrarLogros(contexto) {
    const { view } = contexto;

    const { data: escaneos } = await supabase
      .from('escaneos')
      .select('edificio_id, escaneado_en, puntos, respondio_correctamente')
      .eq('participante_id', this.participante.id)
      .eq('sesion_id', this.sesion.id);

    const { data: edificiosSesion } = await supabase
      .from('edificios_sesion')
      .select('*')
      .eq('sesion_id', this.sesion.id)
      .order('orden');

    const puntosAcumulados = (escaneos || []).reduce((sum, e) => sum + (e.puntos || 0), 0);
    view.renderizarLogros(edificiosSesion, escaneos, puntosAcumulados);
  }

  estaActivo() {
    return !!(this.participante && this.sesion);
  }

  obtenerTotalEdificios() {
    return this.sesion.total_edificios;
  }

  destruir() {
    this.unsubSesionCerrada?.();
    this.sesionObserver?.destruir();
    this.puntosController?.detener();
  }
}
