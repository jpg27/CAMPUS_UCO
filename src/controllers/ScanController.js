// ═══════════════════════════════════════════
// ScanController.js — Orquestador de la página AR (ar.html)
// ═══════════════════════════════════════════
import { EDIFICIOS_AR, PUNTOS, obtenerEdificioPorId } from '../config.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';
import { obtenerParticipante, obtenerSesion, limpiarTodo, limpiarPuntos } from '../utils/storage.js';
import { ARView } from '../views/ARView.js';
import { NotificacionComponent } from '../views/components/NotificacionComponent.js';
import { PuntosDisplay } from '../views/components/PuntosDisplay.js';
import { PuntosController } from './PuntosController.js';
import { ModoLibre } from '../strategies/ModoLibre.js';
import { ModoCarrera } from '../strategies/ModoCarrera.js';
import { SesionObserver } from '../observers/SesionObserver.js';
import { obtenerPreguntaAleatoria } from '../models/PreguntaModel.js';
import { obtenerEdificiosSesion } from '../models/EdificioModel.js';
import { supabase } from '../config.js';

function validarStrategy(obj) {
  const metodos = ['registrarEscaneo','obtenerProgreso','estaActivo','obtenerTotalEdificios'];
  for (const m of metodos) {
    if (typeof obj[m] !== 'function') throw new Error(`Strategy inválida: falta ${m}`);
  }
}

export class ScanController {
  constructor() {
    this.view = new ARView();
    this.notificacion = new NotificacionComponent('notificacion');
    this.puntosController = null;
    this.sesionObserver = null;
    this.estrategia = null;
    this.preguntaActual = null;
    this.edificioActual = null;
    this.targetActual = null;       // referencia al <a-entity> del target actual
    this.respuestaRegistrada = false;
    this.respondioCorrectamente = false;
    this.edificiosHabilitados = [];  // IDs de edificios de la carrera
    this.unsubSesionCerrada = null;
  }

  destruir() {
    this.unsubSesionCerrada?.();
    this.sesionObserver?.destruir();
  }

  async init() {
    this.view.init();

    const participante = obtenerParticipante();
    const sesion = obtenerSesion();

    // ── Seleccionar estrategia ──
    if (participante && sesion) {
      this.estrategia = new ModoCarrera(participante, sesion);
      // Cargar los edificios habilitados para esta sesión
      const edificiosSesion = await obtenerEdificiosSesion(sesion.id);
      this.edificiosHabilitados = edificiosSesion.map(e => e.edificio_id);
    } else {
      this.estrategia = new ModoLibre();
    }
    validarStrategy(this.estrategia);

    // ── Si no hay sesión: modo libre, ocultar puntos ──
    if (!participante && !sesion) {
      document.getElementById('display-puntos').style.display = 'none';
    }

    // ── Sistema de puntos (solo modo carrera) ──
    if (participante && sesion) {
      const display = new PuntosDisplay('display-puntos');
      this.puntosController = new PuntosController(display, PUNTOS.MS_POR_TICK_AR);
    }

    // ── Escuchar cierre de sesión ──
    if (sesion) {
      this.sesionObserver = new SesionObserver(sesion.id);
      this.unsubSesionCerrada = eventBus.on(EVENTOS.SESION_CERRADA, () => {
        if (this.puntosController) this.puntosController.detener();
        limpiarTodo();
        this.view.detenerAR();
        this.view.mostrarSesionCerrada();
      });
    }

    // ── Detección de marcadores ──
    Object.entries(EDIFICIOS_AR).forEach(([index, edificioId]) => {
      const target = document.querySelector(`[mindar-image-target="targetIndex: ${index}"]`);
      if (!target) return;

      target.addEventListener('targetFound', async () => {
        const edificio = obtenerEdificioPorId(edificioId);
        if (!edificio) return;

        // ══ VALIDACIÓN 1: Verificar si este edificio está habilitado en la carrera ══
        if (participante && sesion) {
          if (!this.edificiosHabilitados.includes(edificioId)) {
            this.notificacion.mostrar(
              '🚫 ' + edificio.nombre,
              'Este edificio no forma parte de tu carrera',
              null
            );
            return;
          }
        }

        // ══ VALIDACIÓN 2: Verificar si ya escaneó este edificio ══
        if (participante && sesion) {
          const { data: yaEscaneado } = await supabase
            .from('escaneos')
            .select('id')
            .eq('participante_id', participante.id)
            .eq('edificio_id', edificioId)
            .maybeSingle();

          if (yaEscaneado) {
            this.notificacion.mostrar(
              edificio.icono + ' ' + edificio.nombre,
              'Ya completaste este edificio ✅',
              null
            );
            return;
          }
        } else {
          // Modo libre: verificar en progreso local
          const progreso = await this.estrategia.obtenerProgreso();
          if (progreso[edificioId]) {
            this.notificacion.mostrar(
              edificio.icono + ' ' + edificio.nombre,
              'Ya completaste este edificio ✅',
              null
            );
            return;
          }
        }

        // Buscar pregunta aleatoria
        const pregunta = await obtenerPreguntaAleatoria(edificioId);

        if (!pregunta) {
          await this._registrarSinPregunta(edificio, participante, sesion, target);
          return;
        }

        // Mostrar pregunta
        this.edificioActual = edificio;
        this.preguntaActual = pregunta;
        this.targetActual = target;
        this.respuestaRegistrada = false;
        this.respondioCorrectamente = false;
        if (this.puntosController) this.puntosController.detener();
        this.view.mostrarModalPregunta(edificio, pregunta);
      });
    });

    // ── Responder pregunta ──
    this.view.onResponder((letra) => {
      if (this.respuestaRegistrada) return;
      this.respuestaRegistrada = true;
      this.respondioCorrectamente = this.preguntaActual.respuesta_correcta === letra;

      this.view.marcarRespuesta(letra, this.preguntaActual.respuesta_correcta);

      if (this.respondioCorrectamente && this.targetActual) {
        // Hacer visible la estrella 3D del target específico que se escaneó
        const model = this.targetActual.querySelector('a-gltf-model');
        if (model) model.setAttribute('visible', 'true');
      }

      if (this.puntosController) {
        if (this.respondioCorrectamente) {
          this.puntosController.aplicarBonus();
        } else {
          this.puntosController.aplicarPenalizacion();
        }
      }
    });

    // ── Continuar después de pregunta ──
    this.view.onContinuar(async () => {
      this.view.ocultarModalPregunta();

      // Ocultar la estrella del target actual
      if (this.targetActual) {
        const model = this.targetActual.querySelector('a-gltf-model');
        if (model) model.setAttribute('visible', 'false');
      }

      try {
        const puntos = this.puntosController ? this.puntosController.obtenerPuntos() : 0;

        const resultado = await this.estrategia.registrarEscaneo(
          this.edificioActual.id,
          puntos,
          this.preguntaActual.id,
          this.respondioCorrectamente
        );

        if (resultado.esUltimo && participante) {
          // ══ PANTALLA DE FINALIZACIÓN ══
          this._mostrarPantallaFinalizacion(participante, sesion);
        } else {
          this.notificacion.mostrar(
            this.edificioActual.icono + ' ' + this.edificioActual.nombre,
            'Edificio registrado — sigue al siguiente',
            puntos
          );
        }

        // Reset puntos para siguiente edificio
        if (this.puntosController && sesion && !resultado.esUltimo) {
          setTimeout(() => {
            this.puntosController.resetear(sesion.id);
          }, 3000);
        }
      } catch (e) {
        console.error('Error:', e);
        this.notificacion.mostrar('❌ Error', 'No se pudo registrar el escaneo', null);
        if (this.puntosController && sesion) {
          this.puntosController.resetear(sesion.id);
        }
      }
    });

    // ── Panel de logros ──
    document.getElementById('btn-logros')?.addEventListener('click', async () => {
      this.view.mostrarLogros();
      document.getElementById('logros-lista').innerHTML =
        '<p style="text-align:center;color:#888;padding:20px;">Cargando...</p>';

      if (!participante || !sesion) {
        document.getElementById('logros-puntos').textContent = '0';
        return;
      }

      const { data: escaneos } = await supabase
        .from('escaneos')
        .select('edificio_id, escaneado_en, puntos, respondio_correctamente')
        .eq('participante_id', participante.id)
        .eq('sesion_id', sesion.id);

      const { data: edificiosSesion } = await supabase
        .from('edificios_sesion')
        .select('*')
        .eq('sesion_id', sesion.id)
        .order('orden');

      const puntosAcumulados = (escaneos || []).reduce((sum, e) => sum + (e.puntos || 0), 0);
      this.view.renderizarLogros(edificiosSesion, escaneos, puntosAcumulados);
    });

    // Cerrar logros
    document.getElementById('btn-cerrar-logros')?.addEventListener('click', () => {
      this.view.ocultarLogros();
    });

    // ── Guardar puntos al ir al mapa ──
    document.getElementById('btn-mapa')?.addEventListener('click', () => {
      if (this.puntosController && sesion) {
        this.puntosController.guardar(sesion.id);
      }
    });

    // ── Ocultar overlay de MindAR ──
    const mutationObs = new MutationObserver(() => {
      const overlay = document.querySelector('.mindar-ui-overlay');
      if (overlay) { overlay.style.display = 'none'; mutationObs.disconnect(); }
    });
    mutationObs.observe(document.body, { childList: true, subtree: true });

    // ── Iniciar puntos cuando AR cargue ──
    document.querySelector('a-scene')?.addEventListener('loaded', () => {
      if (this.puntosController && sesion) {
        this.puntosController.iniciar(sesion.id);
      }
    });
  }

  async _mostrarPantallaFinalizacion(participante, sesion) {
    if (this.puntosController) this.puntosController.detener();

    // Obtener datos finales del participante
    const { data: datosFinales } = await supabase
      .from('participantes')
      .select('nombre, puntos_total, tiempo_total, posicion')
      .eq('id', participante.id)
      .single();

    const nombre = datosFinales?.nombre || participante.nombre || 'Participante';
    const puntosTotal = datosFinales?.puntos_total || 0;
    const tiempoTotal = datosFinales?.tiempo_total || 0;
    const posicion = datosFinales?.posicion || '-';

    // Formatear tiempo
    const min = Math.floor(tiempoTotal / 60);
    const seg = tiempoTotal % 60;
    const tiempoStr = `${min}m ${seg}s`;

    this.view.mostrarPantallaFinalizacion(nombre, puntosTotal, tiempoStr);
  }

  async _registrarSinPregunta(edificio, participante, sesion, target) {
    try {
      // Validar que el edificio pertenece a la carrera
      if (participante && sesion && !this.edificiosHabilitados.includes(edificio.id)) {
        this.notificacion.mostrar(
          '🚫 ' + edificio.nombre,
          'Este edificio no forma parte de tu carrera',
          null
        );
        return;
      }

      const puntos = this.puntosController ? this.puntosController.obtenerPuntos() : 0;
      const resultado = await this.estrategia.registrarEscaneo(edificio.id, puntos);

      if (resultado.duplicado) {
        this.notificacion.mostrar(edificio.icono + ' Ya escaneado', `${edificio.nombre} ya fue registrado`, null);
        return;
      }

      if (this.puntosController) this.puntosController.detener();

      // Mostrar la estrella del target
      if (target) {
        const model = target.querySelector('a-gltf-model');
        if (model) {
          model.setAttribute('visible', 'true');
          setTimeout(() => model.setAttribute('visible', 'false'), 4000);
        }
      }

      if (resultado.esUltimo && participante) {
        this._mostrarPantallaFinalizacion(participante, sesion);
      } else {
        this.notificacion.mostrar(edificio.icono + ' ' + edificio.nombre, 'Edificio registrado', puntos);
      }

      if (this.puntosController && sesion && !resultado.esUltimo) {
        setTimeout(() => {
          this.puntosController.resetear(sesion.id);
        }, 3000);
      }
    } catch (e) {
      this.notificacion.mostrar('❌ Error', 'No se pudo registrar', null);
    }
  }
}
