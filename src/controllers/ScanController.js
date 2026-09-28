// ═══════════════════════════════════════════
// ScanController.js — Orquestador de la página AR (ar.html)
// No conoce los detalles de cada modo: solo instancia la estrategia
// correcta (ModoLibre / ModoCarrera) y le delega todo el flujo.
// ═══════════════════════════════════════════
import { EDIFICIOS_AR, obtenerEdificioPorId } from '../config.js';
import { obtenerParticipante, obtenerSesion } from '../utils/storage.js';
import { ARView } from '../views/ARView.js';
import { NotificacionComponent } from '../views/components/NotificacionComponent.js';
import { ModoLibre } from '../strategies/ModoLibre.js';
import { ModoCarrera } from '../strategies/ModoCarrera.js';

function validarStrategy(obj) {
  const metodos = ['init', 'manejarDeteccion', 'estaActivo', 'obtenerTotalEdificios'];
  for (const m of metodos) {
    if (typeof obj[m] !== 'function') throw new Error(`Strategy inválida: falta ${m}`);
  }
}

export class ScanController {
  constructor() {
    this.view = new ARView();
    this.notificacion = new NotificacionComponent('notificacion');
    this.estrategia = null;
    this.contexto = null;
  }

  destruir() {
    this.estrategia?.destruir();
  }

  async init() {
    this.view.init();

    const participante = obtenerParticipante();
    const sesion = obtenerSesion();

    this.estrategia = (participante && sesion)
      ? new ModoCarrera(participante, sesion)
      : new ModoLibre();
    validarStrategy(this.estrategia);

    this.contexto = { view: this.view, notificacion: this.notificacion };
    await this.estrategia.init(this.contexto);

    if (!this.estrategia.tieneLogros()) {
      this.view.ocultarBotonLogros();
    }

    // ── Detección de marcadores (genérico: no distingue modos) ──
    Object.entries(EDIFICIOS_AR).forEach(([index, edificioId]) => {
      const target = document.querySelector(`[mindar-image-target="targetIndex: ${index}"]`);
      if (!target) return;

      target.addEventListener('targetFound', async () => {
        const edificio = obtenerEdificioPorId(edificioId);
        if (!edificio) return;
        await this.estrategia.manejarDeteccion(edificio, target, this.contexto);
      });

      target.addEventListener('targetLost', async () => {
        const edificio = obtenerEdificioPorId(edificioId);
        if (!edificio) return;
        await this.estrategia.manejarPerdida(edificio, target, this.contexto);
      });
    });

    // ── Panel de logros ──
    document.getElementById('btn-logros')?.addEventListener('click', async () => {
      if (!this.estrategia.tieneLogros()) return;
      this.view.mostrarLogros();
      document.getElementById('logros-lista').innerHTML =
        '<p style="text-align:center;color:#888;padding:20px;">Cargando...</p>';
      await this.estrategia.mostrarLogros(this.contexto);
    });

    document.getElementById('btn-cerrar-logros')?.addEventListener('click', () => {
      this.view.ocultarLogros();
    });

    // ── Notificar a la estrategia al ir al mapa ──
    document.getElementById('btn-mapa')?.addEventListener('click', () => {
      this.estrategia.alIrAlMapa(this.contexto);
    });

    // ── Ocultar overlay de MindAR ──
    const mutationObs = new MutationObserver(() => {
      const overlay = document.querySelector('.mindar-ui-overlay');
      if (overlay) { overlay.style.display = 'none'; mutationObs.disconnect(); }
    });
    mutationObs.observe(document.body, { childList: true, subtree: true });

    // ── Notificar a la estrategia cuando la escena de A-Frame cargó ──
    document.querySelector('a-scene')?.addEventListener('loaded', () => {
      this.estrategia.alCargarEscena(this.contexto);
    });
  }
}
