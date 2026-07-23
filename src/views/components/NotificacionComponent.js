/**
 * NotificacionComponent.js
 * Componente para manejar las notificaciones toast.
 */

export class NotificacionComponent {
    constructor(containerId = 'notificacion') {
        this.container = document.getElementById(containerId);
        this.tituloEl = document.getElementById('not-titulo');
        this.descEl = document.getElementById('not-desc');
        this.puntosEl = document.getElementById('not-puntos');
        this.iconoEl = document.getElementById('not-icono');
        this.timeoutId = null;
    }

    mostrar(titulo, descripcion, puntos) {
        if (!this.container) return;
        
        if (this.iconoEl) {
            this.iconoEl.remove();
            this.iconoEl = null;
        }

        if (this.tituloEl) this.tituloEl.textContent = titulo;
        if (this.descEl) this.descEl.textContent = descripcion;
        if (this.puntosEl) this.puntosEl.textContent = puntos ? `+${puntos} pts` : '';

        this.container.classList.add('visible');

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.ocultar();
        }, 5000);
    }

    ocultar() {
        if (this.container) {
            this.container.classList.remove('visible');
        }
    }
}
