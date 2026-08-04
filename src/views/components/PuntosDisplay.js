/**
 * PuntosDisplay.js
 * Componente para mostrar los puntos acumulados.
 */

export class PuntosDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    actualizar(puntos) {
        if (this.container) {
            this.container.textContent = '⭐ ' + puntos;
        }
    }

    mostrar() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    ocultar() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
}
