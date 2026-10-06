/**
 * PuntosDisplay.js
 * Componente para mostrar los puntos acumulados (chip de puntos en AR y mapa).
 */

const ESTRELLA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';

export class PuntosDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    actualizar(puntos) {
        if (this.container) {
            this.container.innerHTML = `${ESTRELLA}<span>${puntos}</span>`;
            this.container.setAttribute('aria-label', `${puntos} puntos`);
        }
    }

    mostrar() {
        // '' quita el display:none en línea y deja el display del CSS (inline-flex)
        if (this.container) {
            this.container.style.display = '';
        }
    }

    ocultar() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
}
