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

export class ScanController {
  constructor() {
    this.view = new ARView();
    this.notificacion = new NotificacionComponent('notificacion');
    this.puntosController = null;
    this.sesionObserver = null;
    this.estrategia = null;
    this.preguntaActual = null;
    this.edificioActual = null;
    this.respuestaRegistrada = false;
    this.respondioCorrectamente = false;
  }

  init() {
    this.view.init();

    const participante = obtenerParticipante();
    const sesion = obtenerSesion();

    // ── Seleccionar estrategia ──
    if (participante && sesion) {
      this.estrategia = new ModoCarrera(participante, sesion);
    } else {
      this.estrategia = new ModoLibre();
      // En modo libre: ocultar display de puntos, no mostrar "sin sesion"
    }

    // ── Si no hay sesión Y no hay modo libre, mostrar modal ──
    if (!participante && !sesion) {
      // Modo libre está activo, no bloqueamos la experiencia
      // Pero ocultamos el display de puntos
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
      eventBus.on(EVENTOS.SESION_CERRADA, () => {
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

        // Verificar si ya escaneó este edificio
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
          await this._registrarSinPregunta(edificio, participante, sesion);
          return;
        }

        // Mostrar pregunta
        this.edificioActual = edificio;
        this.preguntaActual = pregunta;
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

      if (this.respondioCorrectamente) {
        // Hacer visible la estrella 3D
        const model = document.querySelector('a-gltf-model');
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

      try {
        const puntos = this.puntosController ? this.puntosController.obtenerPuntos() : 0;

        const resultado = await this.estrategia.registrarEscaneo(
          this.edificioActual.id,
          puntos,
          this.preguntaActual.id,
          this.respondioCorrectamente
        );

        if (resultado.esUltimo) {
          this.notificacion.mostrar('🎉 ¡Completaste la carrera!', 'Has visitado todos los edificios', puntos);
        } else {
          this.notificacion.mostrar(
            this.edificioActual.icono + ' ' + this.edificioActual.nombre,
            'Edificio registrado — sigue al siguiente',
            puntos
          );
        }

        // Reset puntos para siguiente edificio
        if (this.puntosController && sesion) {
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
    document.querySelector('.btn-cerrar-logros')?.addEventListener('click', () => {
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

  async _registrarSinPregunta(edificio, participante, sesion) {
    try {
      const puntos = this.puntosController ? this.puntosController.obtenerPuntos() : 0;
      const resultado = await this.estrategia.registrarEscaneo(edificio.id, puntos);

      if (resultado.duplicado) {
        this.notificacion.mostrar(edificio.icono + ' Ya escaneado', `${edificio.nombre} ya fue registrado`, null);
        return;
      }

      if (this.puntosController) this.puntosController.detener();

      if (resultado.esUltimo) {
        this.notificacion.mostrar('🎉 ¡Completaste la carrera!', 'Has visitado todos los edificios', puntos);
      } else {
        this.notificacion.mostrar(edificio.icono + ' ' + edificio.nombre, 'Edificio registrado', puntos);
      }

      if (this.puntosController && sesion) {
        setTimeout(() => {
          this.puntosController.resetear(sesion.id);
        }, 3000);
      }
    } catch (e) {
      this.notificacion.mostrar('❌ Error', 'No se pudo registrar', null);
    }
  }
}
