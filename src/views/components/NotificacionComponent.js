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
        this.timeoutId = null;
    }

    mostrar(titulo, descripcion, puntos, tipo = 'exito') {
        if (!this.container) return;

        if (!TIPOS.includes(tipo)) tipo = 'exito';
        TIPOS.forEach(t => this.container.classList.remove('tipo-' + t));
        this.container.classList.add('tipo-' + tipo);

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