/**
 * ModoCarrera.js
 * Estrategia para el modo carrera (competitivo).
 * Dueña de su flujo completo: validaciones, preguntas, puntos, registro en
 * Supabase, panel de logros y pantalla de finalización.
 */
import { GameStrategy } from './GameStrategy.js';
import { registrarEscaneo } from '../models/EscaneoModel.js';
import { obtenerPreguntaAleatoria, obtenerPreguntasPorIds } from '../models/PreguntaModel.js';
import { resumirEscaneos } from '../utils/clasificacion.js';
import { obtenerEdificiosSesion } from '../models/EdificioModel.js';
import { supabase, PUNTOS } from '../config.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';
import { SesionObserver } from '../observers/SesionObserver.js';
import { limpiarTodo, guardarCookieCarrera, vencimientoCarrera } from '../utils/storage.js';
import { PuntosDisplay } from '../views/components/PuntosDisplay.js';
import { PuntosController } from '../controllers/PuntosController.js';

// Cuánto se queda el panel mostrando la respuesta antes de cerrarse solo
const TIEMPO_RESULTADO_MS = 3000;

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

    // Evita procesar dos detecciones a la vez (MindAR puede disparar
    // targetFound varias veces seguidas si el marcador "parpadea").
    this._procesandoDeteccion = false;
    this._timerEstrella = null;
    this._finalizado = false;     // ya vio la pantalla de carrera completada
    this._cerrada = false;        // la sesión ya se cerró (evita repetir el resumen)
  }

  async init(contexto) {
    const { view } = contexto;

    const edificiosSesion = await obtenerEdificiosSesion(this.sesion.id);
    this.edificiosHabilitados = edificiosSesion.map(e => e.edificio_id);

    const display = new PuntosDisplay('display-puntos');
    this.puntosController = new PuntosController(display, PUNTOS.MS_POR_TICK);

    this.sesionObserver = new SesionObserver(this.sesion.id);
    this.unsubSesionCerrada = eventBus.on(EVENTOS.SESION_CERRADA, () => this._alCerrarSesion(view));

    // Ya no hay botón "Continuar": al tocar una opción se registra el
    // edificio de inmediato y el panel se cierra solo unos segundos después.
    view.onResponder((letra) => this._responder(letra, contexto));

    // Si la carrera se cerró (o el participante terminó) mientras la app
    // estaba cerrada o sin conexión, mostrarlo apenas abre la cámara.
    await this._revisarEstadoAlAbrir(view);
  }

  async _revisarEstadoAlAbrir(view) {
    try {
      const [{ data: sesion }, { data: yo }] = await Promise.all([
        supabase.from('sesiones').select('estado, activada_en, creada_en, codigo').eq('id', this.sesion.id).maybeSingle(),
        supabase.from('participantes').select('completado').eq('id', this.participante.id).maybeSingle()
      ]);
      if (yo?.completado) {
        await this._mostrarPantallaFinalizacion(view);
        try { view.detenerAR(); } catch (e) { /* cámara aún no iniciada */ }
      } else if (!sesion) {
        // La sesión fue eliminada por el organizador
        this._cerrada = true;
        this.puntosController?.detener();
        try { view.detenerAR(); } catch (e) { /* cámara aún no iniciada */ }
        view.mostrarSesionCerrada();
        limpiarTodo();
      } else if (sesion.estado === 'cerrada') {
        await this._alCerrarSesion(view);
      } else {
        // Carrera en curso: la cookie de reconexión vence 3 h después de activarse
        const ses = { ...this.sesion, ...sesion };
        guardarCookieCarrera(
          { s: ses.id, p: this.participante.id, n: this.participante.nombre, c: ses.codigo },
          vencimientoCarrera(ses)
        );
      }
    } catch (e) {
      // Sin conexión: se sigue normal y el observer avisará cuando vuelva
    }
  }

  /**
   * El organizador cerró la carrera. Si el participante ya había terminado,
   * se deja su pantalla final; si no, se le muestra "Carrera incompleta"
   * con los edificios y los puntos que alcanzó a sumar.
   */
  async _alCerrarSesion(view) {
    if (this._cerrada) return;
    this._cerrada = true;
    this.puntosController?.detener();
    // Apagar la cámara no debe impedir que se muestre el resumen
    try { view.ocultarPreguntaAR?.(); } catch (e) { /* sin pregunta abierta */ }
    try { view.detenerAR(); } catch (e) { console.warn('[ModoCarrera] No se pudo detener la cámara:', e); }

    if (this._finalizado) { limpiarTodo(); return; }

    try {
      const { data: escaneos, error } = await supabase
        .from('escaneos')
        .select('puntos, respondio_correctamente')
        .eq('participante_id', this.participante.id)
        .eq('sesion_id', this.sesion.id);
      if (error) throw error;
      const resumen = resumirEscaneos(escaneos || []);
      view.mostrarCarreraIncompleta(
        this.participante.nombre || 'Participante',
        { ...resumen, total: this.sesion.total_edificios || 0 },
        { sesion: this.sesion, fecha: new Date() }
      );
    } catch (e) {
      view.mostrarSesionCerrada();
    } finally {
      limpiarTodo();
    }
  }

  async manejarDeteccion(edificio, targetEntity, contexto) {
    const { view, notificacion } = contexto;

    // Si ya hay una pregunta en pantalla (sin registrar), una nueva detección
    // no debe abrir otra: antes, perder y volver a ver el marcador mostraba
    // una pregunta nueva (otra oportunidad de responder) mientras la
    // estrella de la anterior seguía visible.
    if (this.preguntaActual) return;
    if (this._procesandoDeteccion) return;
    this._procesandoDeteccion = true;
    try {
      await this._procesarDeteccion(edificio, targetEntity, contexto);
    } finally {
      this._procesandoDeteccion = false;
    }
  }

  async _procesarDeteccion(edificio, targetEntity, contexto) {
    const { view, notificacion } = contexto;

    if (!this.edificiosHabilitados.includes(edificio.id)) {
      notificacion.mostrar(edificio.nombre, 'Este edificio no forma parte de tu carrera', null, 'aviso');
      return;
    }

    const { data: yaEscaneado } = await supabase
      .from('escaneos')
      .select('id')
      .eq('participante_id', this.participante.id)
      .eq('edificio_id', edificio.id)
      .maybeSingle();

    if (yaEscaneado) {
      notificacion.mostrar(edificio.nombre, 'Ya completaste este edificio', null, 'aviso');
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
    // El contador sigue corriendo mientras se lee y responde la pregunta:
    // los puntos se toman en el momento de responder.
    view.mostrarPreguntaAR(edificio, pregunta, targetEntity);
  }

  async _responder(letra, contexto) {
    if (!this.preguntaActual || this.respuestaRegistrada) return;
    const { view, notificacion } = contexto;
    this.respuestaRegistrada = true;

    const edificio = this.edificioActual;
    const pregunta = this.preguntaActual;
    const target   = this.targetActual;
    const correcta = pregunta.respuesta_correcta === letra;
    this.respondioCorrectamente = correcta;

    view.marcarRespuestaAR(letra, pregunta.respuesta_correcta);

    if (correcta) this.puntosController?.aplicarBonus();
    else this.puntosController?.aplicarPenalizacion();

    // Puntos en el momento exacto de responder (ya con la penalización)
    const puntos = this.puntosController ? this.puntosController.calcular() : 0;

    // Se registra YA, sin esperar a que el panel se cierre: si el marcador se
    // pierde o la persona se va, el edificio igual queda completado.
    // Los 3 segundos del panel cuentan desde que se responde (en paralelo al registro)
    const espera = new Promise(r => setTimeout(r, TIEMPO_RESULTADO_MS));
    let resultado = null;
    let fallo = false;
    try {
      resultado = await registrarEscaneo(
        this.participante.id,
        this.sesion.id,
        edificio.id,
        this.sesion.total_edificios,
        puntos,
        pregunta.id,
        correcta,
        letra
      );
      // El tramo del siguiente edificio empieza ahora mismo
      if (resultado.duplicado) { /* ya estaba registrado: no se toca el tramo */ }
      else if (!resultado.esUltimo) this.puntosController?.resetear(this.sesion.id);
      else this.puntosController?.detener();
    } catch (e) {
      console.error('Error al registrar el escaneo:', e);
      fallo = true;
    }

    // El panel queda unos segundos mostrando el resultado y se cierra solo
    await espera;
    view.ocultarPreguntaAR();

    try {
      if (fallo) {
        notificacion.mostrar('Error', 'No se pudo registrar el edificio. Vuelve a escanear el marcador.', null, 'error');
        return;
      }
      if (resultado.duplicado) {
        notificacion.mostrar(edificio.nombre, 'Ya completaste este edificio', null, 'aviso');
        return;
      }
      if (correcta) this._mostrarEstrella(target);

      if (resultado.esUltimo) {
        await this._mostrarPantallaFinalizacion(view);
      } else {
        notificacion.mostrar(edificio.nombre, 'Edificio registrado — sigue al siguiente', puntos, 'exito');
      }
    } finally {
      // La pregunta terminó: ya se pueden procesar nuevas detecciones.
      this.preguntaActual = null;
      this.edificioActual = null;
      this.targetActual = null;
    }
  }

  /** Muestra la estrella sobre el marcador unos segundos. */
  _mostrarEstrella(targetEntity, ms = 4000) {
    const model = targetEntity?.querySelector('a-gltf-model');
    if (!model) return;
    clearTimeout(this._timerEstrella);
    model.setAttribute('visible', 'true');
    this._timerEstrella = setTimeout(() => model.setAttribute('visible', 'false'), ms);
  }

  async _registrarSinPregunta(edificio, targetEntity, contexto) {
    const { view, notificacion } = contexto;
    try {
      const puntos = this.puntosController ? this.puntosController.calcular() : 0;
      const resultado = await registrarEscaneo(
        this.participante.id,
        this.sesion.id,
        edificio.id,
        this.sesion.total_edificios,
        puntos
      );

      if (resultado.duplicado) {
        notificacion.mostrar('Ya escaneado', `${edificio.nombre} ya fue registrado`, null, 'aviso');
        return;
      }

      this._mostrarEstrella(targetEntity);

      if (resultado.esUltimo) {
        await this._mostrarPantallaFinalizacion(view);
      } else {
        notificacion.mostrar(edificio.nombre, 'Edificio registrado', puntos, 'exito');
      }

      if (!resultado.esUltimo) this.puntosController?.resetear(this.sesion.id);
    } catch (e) {
      notificacion.mostrar('Error', 'No se pudo registrar', null, 'error');
    }
  }

  async _mostrarPantallaFinalizacion(view) {
    this._finalizado = true;
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

    view.mostrarPantallaFinalizacion(nombre, puntosTotal, tiempoStr, { sesion: this.sesion, fecha: new Date() });
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

    // select('*') para incluir respuesta_elegida si la columna ya existe
    const { data: escaneos } = await supabase
      .from('escaneos')
      .select('*')
      .eq('participante_id', this.participante.id)
      .eq('sesion_id', this.sesion.id);

    const { data: edificiosSesion } = await supabase
      .from('edificios_sesion')
      .select('*')
      .eq('sesion_id', this.sesion.id)
      .order('orden');

    const puntosAcumulados = (escaneos || []).reduce((sum, e) => sum + (e.puntos || 0), 0);
    const preguntas = await obtenerPreguntasPorIds((escaneos || []).map(e => e.pregunta_id));
    const mapa = new Map(preguntas.map(p => [String(p.id), p]));
    view.renderizarLogros(edificiosSesion, escaneos, puntosAcumulados, mapa);
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