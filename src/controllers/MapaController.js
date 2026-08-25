// ═══════════════════════════════════════════
// MapaController.js — Orquestador del mapa 3D (mapa.html)
// ═══════════════════════════════════════════
import { PUNTOS } from '../config.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';
import { obtenerParticipante, obtenerSesion, limpiarTodo } from '../utils/storage.js';
import { obtenerEdificioInfo } from '../config.js';
import { formatearHora } from '../utils/formatters.js';
import { MapaView } from '../views/MapaView.js';
import { PuntosDisplay } from '../views/components/PuntosDisplay.js';
import { PuntosController } from './PuntosController.js';
import { SesionObserver } from '../observers/SesionObserver.js';
import { obtenerEdificiosSesion, obtenerEscaneosPorParticipante } from '../models/EdificioModel.js';
import { supabase } from '../config.js';

export class MapaController {
  constructor() {
    this.view = new MapaView();
    this.puntosController = null;
    this.sesionObserver = null;
    this.participante = obtenerParticipante();
    this.sesion = obtenerSesion();
  }

  init() {
    this.view.init();
    this.view.cargarFondo();
    this.view.cargarBloques();
    this.view.iniciarRenderLoop();

    // ── Sistema de puntos ──
    if (this.sesion && this.participante) {
      const display = new PuntosDisplay('display-puntos-mapa');
      this.puntosController = new PuntosController(display, PUNTOS.MS_POR_TICK_MAPA);
      this.puntosController.iniciar(this.sesion.id);

      // Con carrera activa sí se puede volver a la cámara a seguir escaneando.
      const btnAr = document.getElementById('btn-ar');
      if (btnAr) btnAr.style.display = 'inline-block';
    } else {
      const btnProgreso = document.getElementById('btn-progreso');
      if (btnProgreso) btnProgreso.style.display = 'none';
      const dp = document.getElementById('display-puntos-mapa');
      if (dp) dp.style.display = 'none';
      // Sin carrera activa (Mapa como entrada independiente): nada de cámara.
      const btnAr = document.getElementById('btn-ar');
      if (btnAr) btnAr.style.display = 'none';
    }

    // ── Escuchar cierre de sesión ──
    if (this.sesion) {
      this.sesionObserver = new SesionObserver(this.sesion.id);
      eventBus.on(EVENTOS.SESION_CERRADA, () => {
        if (this.puntosController) this.puntosController.detener();
        limpiarTodo();
        this.view.mostrarSesionCerrada();
      });
    }

    // ── Detección de clicks/taps ──
    const handleClick = (x, y) => {
      const result = this.view.detectarBloque(x, y);
      if (result) {
        this.view.seleccionarBloque(result.mesh);
        this.view.mostrarPanel(result.edificio);
      } else {
        this.view.deseleccionarBloque();
        this.view.ocultarPanel();
      }
    };

    window.addEventListener('click', (e) => handleClick(e.clientX, e.clientY));
    window.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      handleClick(t.clientX, t.clientY);
    });

    // ── Cerrar panel ──
    document.getElementById('cerrar-panel')?.addEventListener('click', () => {
      this.view.ocultarPanel();
      this.view.deseleccionarBloque();
    });

    // ── Panel de logros ──
    window.verProgreso = async () => {
      document.getElementById('panel-progreso').style.display = 'flex';
      if (!this.participante || !this.sesion) return;

      const { data: escaneos } = await supabase
        .from('escaneos')
        .select('edificio_id, escaneado_en')
        .eq('participante_id', this.participante.id)
        .eq('sesion_id', this.sesion.id);

      const { data: edificiosSesion } = await supabase
        .from('edificios_sesion')
        .select('*')
        .eq('sesion_id', this.sesion.id)
        .order('orden');

      const escaneadosIds = (escaneos || []).map(e => e.edificio_id);
      const total         = edificiosSesion ? edificiosSesion.length : 0;
      const completados   = Math.min(escaneadosIds.length, total);
      const porcentaje    = total > 0 ? (completados / total) * 100 : 0;

      document.getElementById('texto-progreso').textContent = `${completados} / ${total} edificios`;
      document.getElementById('barra-progreso').style.width = porcentaje + '%';

      const lista = document.getElementById('lista-logros');
      if (!edificiosSesion || edificiosSesion.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color:#888; font-family:Arial;">No hay edificios</p>';
        return;
      }

      lista.innerHTML = edificiosSesion.map(ed => {
        const escaneado = escaneadosIds.includes(ed.edificio_id);
        const info      = obtenerEdificioInfo(ed.edificio_id);
        const escaneo   = (escaneos || []).find(e => e.edificio_id === ed.edificio_id);
        const hora      = escaneo ? formatearHora(escaneo.escaneado_en) : null;

        return `
          <div style="
            display:flex; align-items:center; gap:14px; padding:14px 16px;
            border-radius:14px; margin-bottom:10px; font-family:Arial;
            background:${escaneado ? '#f0f8f0' : '#f8f8f8'};
            border:2px solid ${escaneado ? '#3a7a1a' : '#e0e0e0'};
          ">
            <div style="font-size:28px;">${info.icono}</div>
            <div style="flex:1;">
              <div style="font-weight:bold; color:#1a2e1a; font-size:15px;">${info.nombre}</div>
              <div style="font-size:12px; color:#888; margin-top:2px;">
                ${escaneado ? '✅ Escaneado a las ' + hora : '⏳ Pendiente'}
              </div>
            </div>
            <div style="font-size:24px;">${escaneado ? '🏆' : '🔒'}</div>
          </div>
        `;
      }).join('');
    };

    window.cerrarProgreso = () => {
      document.getElementById('panel-progreso').style.display = 'none';
    };
  }
}
