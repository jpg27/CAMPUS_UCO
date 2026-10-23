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

    /**
     * Reacción del chip al responder.
     *  - 'mal': se pone rojo, tiembla y deja caer un "−100" (delta negativo).
     *  - 'bien': late en verde.
     * El número flotante va en <body> porque el chip se repinta cada medio
     * segundo y borraría cualquier cosa que tenga adentro.
     */
    animarCambio(delta, tipo) {
        const chip = this.container;
        if (!chip || chip.style.display === 'none') return;
        const clase = tipo === 'mal' ? 'penalizado' : 'acierto';
        chip.classList.remove('penalizado', 'acierto');
        void chip.offsetWidth;               // reinicia la animación si se repite
        chip.classList.add(clase);
        clearTimeout(this._timerAnim);
        this._timerAnim = setTimeout(() => chip.classList.remove(clase), 1600);

        if (tipo === 'mal' && delta) {
            const r = chip.getBoundingClientRect();
            const flotante = document.createElement('div');
            flotante.className = 'puntos-flotante';
            flotante.setAttribute('aria-hidden', 'true');
            flotante.textContent = `−${Math.abs(delta)}`;
            flotante.style.left = `${r.left + r.width / 2}px`;
            flotante.style.top = `${r.bottom + 4}px`;
            document.body.appendChild(flotante);
            setTimeout(() => flotante.remove(), 1700);
        }
    }
}
