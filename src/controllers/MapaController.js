// ═══════════════════════════════════════════
// MapaController.js — Orquestador del mapa del campus (mapa.html)
// ═══════════════════════════════════════════
import { PUNTOS, supabase, obtenerEdificioInfo } from '../config.js';
import { eventBus, EVENTOS } from '../observers/EventBus.js';
import { obtenerParticipante, obtenerSesion, limpiarTodo } from '../utils/storage.js';
import { formatearHora } from '../utils/formatters.js';
import { MapaView } from '../views/MapaView.js';
import { PuntosDisplay } from '../views/components/PuntosDisplay.js';
import { PuntosController } from './PuntosController.js';
import { SesionObserver } from '../observers/SesionObserver.js';

export class MapaController {
  constructor() {
    this.view = new MapaView();
    this.puntosController = null;
    this.sesionObserver = null;
    this.participante = obtenerParticipante();
    this.sesion = obtenerSesion();
    this.enCarrera = !!(this.sesion && this.participante);

    // Estado de la carrera para pines y ficha (null si no hay carrera)
    this.escaneados = new Set();
    this.idsCarrera = null;
  }

  init() {
    this.view.init({
      onSeleccionar:   (edificio) => this.seleccionar(edificio),
      onDeseleccionar: () => this.deseleccionar()
    });
    this.view.cargarFondo();
    this.view.cargarBloques();
    this.view.configurarModo({ enCarrera: this.enCarrera });

    // ── Sistema de puntos ──
    if (this.enCarrera) {
      const display = new PuntosDisplay('display-puntos-mapa');
      this.puntosController = new PuntosController(display, PUNTOS.MS_POR_TICK);
      this.puntosController.iniciar(this.sesion.id);
      this.actualizarEstadosCarrera();
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

    // ── Hojas: Más y Mis logros ──
    document.getElementById('btn-mas').addEventListener('click', () => this.view.abrirCapa('hoja-mas'));
    document.getElementById('btn-progreso').addEventListener('click', () => this.verProgreso());
    document.getElementById('mas-logros').addEventListener('click', () => {
      this.view.cerrarCapa('hoja-mas');
      this.verProgreso();
    });
  }

  // ── Selección de edificios ──
  seleccionar(edificio) {
    this.view.seleccionarBloque(edificio.id);
    this.view.mostrarPanel(edificio, this.estadoDe(edificio.id));
  }

  deseleccionar() {
    this.view.deseleccionarBloque();
    this.view.ocultarPanel();
  }

  estadoDe(id) {
    if (!this.enCarrera || !this.idsCarrera) return null;
    if (!this.idsCarrera.has(id)) return 'fuera';
    return this.escaneados.has(id) ? 'escaneado' : 'pendiente';
  }

  // ── Datos de la carrera ──
  async cargarProgreso() {
    const [{ data: escaneos }, { data: edificiosSesion }] = await Promise.all([
      supabase
        .from('escaneos')
        .select('edificio_id, escaneado_en')
        .eq('participante_id', this.participante.id)
        .eq('sesion_id', this.sesion.id),
      supabase
        .from('edificios_sesion')
        .select('*')
        .eq('sesion_id', this.sesion.id)
        .order('orden')
    ]);
    return { escaneos: escaneos || [], edificiosSesion: edificiosSesion || [] };
  }

  async actualizarEstadosCarrera() {
    const { escaneos, edificiosSesion } = await this.cargarProgreso();
    this.escaneados = new Set(escaneos.map(e => e.edificio_id));
    this.idsCarrera = new Set(edificiosSesion.map(e => e.edificio_id));
    this.view.marcarEstados({ escaneados: this.escaneados, enCarrera: this.idsCarrera });
    return { escaneos, edificiosSesion };
  }

  async verProgreso() {
    this.view.abrirCapa('panel-progreso');
    if (!this.enCarrera) return;

    const { escaneos, edificiosSesion } = await this.actualizarEstadosCarrera();
    const total       = edificiosSesion.length;
    const completados = Math.min(this.escaneados.size, total);

    this.view.renderLogros({
      completados,
      total,
      items: edificiosSesion.map(ed => {
        const escaneo = escaneos.find(e => e.edificio_id === ed.edificio_id);
        return {
          nombre: obtenerEdificioInfo(ed.edificio_id).nombre,
          escaneado: !!escaneo,
          hora: escaneo ? formatearHora(escaneo.escaneado_en) : null
        };
      })
    });
  }
}
