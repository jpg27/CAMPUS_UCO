/**
 * NotificacionComponent.js
 * Componente para manejar las notificaciones toast.
 *
 * Tipos: 'exito' (verde, por defecto), 'aviso' (ámbar), 'error' (rojo).
 * El icono vive en el HTML (ar.html) y cambia según el tipo mediante CSS.
 */

const TIPOS = ['exito', 'aviso', 'error'];

export class NotificacionComponent {
    constructor(containerId = 'notificacion') {
        this.container = document.getElementById(containerId);
        this.tituloEl = document.getElementById('not-titulo');
        this.descEl = document.getElementById('not-desc');
        this.puntosEl = document.getElementById('not-puntos');
        this.detalleEl = document.getElementById('not-detalle');
        this.timeoutId = null;
    }

    /**
     * @param {object} [opciones]
     * @param {string} [opciones.detalle]  línea pequeña bajo los puntos (p. ej. "800 − 100 penalización")
     * @param {number} [opciones.duracion] ms visible (5000 por defecto)
     */
    mostrar(titulo, descripcion, puntos, tipo = 'exito', opciones = {}) {
        if (!this.container) return;

        if (!TIPOS.includes(tipo)) tipo = 'exito';
        TIPOS.forEach(t => this.container.classList.remove('tipo-' + t));
        this.container.classList.add('tipo-' + tipo);

        if (this.tituloEl) this.tituloEl.textContent = titulo;
        if (this.descEl) this.descEl.textContent = descripcion;
        const conDetalle = !!opciones.detalle;
        if (this.puntosEl) {
            this.puntosEl.textContent = (puntos || (conDetalle && puntos === 0)) ? `+${puntos.toLocaleString('es-CO')} pts` : '';
        }
        if (this.detalleEl) this.detalleEl.textContent = opciones.detalle || '';

        this.container.classList.add('visible');

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.ocultar();
        }, opciones.duracion || 5000);
    }

    ocultar() {
        if (this.container) {
            this.container.classList.remove('visible');
        }
    }
}