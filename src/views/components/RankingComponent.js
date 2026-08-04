/**
 * RankingComponent.js
 * Componente para renderizar la lista de participantes y sus logros.
 */

import { obtenerEdificioInfo } from '../../config.js';
import { formatearTiempo, formatearHora } from '../../utils/formatters.js';

export class RankingComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    renderizar(participantes) {
        if (!this.container) return;

        if (!participantes || participantes.length === 0) {
            this.container.innerHTML = '<div class="ranking-item">Esperando participantes...</div>';
            return;
        }

        this.container.innerHTML = participantes.map((p, index) => {
            let badge = (index + 1).toString();
            if (index === 0) badge = '🥇';
            else if (index === 1) badge = '🥈';
            else if (index === 2) badge = '🥉';

            const tiempo = p.tiempo_fin ? formatearTiempo(new Date(p.tiempo_inicio), new Date(p.tiempo_fin)) : '--:--';
            const estadoClase = p.estado === 'completado' ? 'estado-completado' : 'estado-carrera';
            const estadoTexto = p.estado === 'completado' ? 'Completado' : 'En carrera';

            return `
                <div class="ranking-item">
                    <div class="rank-pos">${badge}</div>
                    <div class="rank-info">
                        <div class="rank-nombre">${p.nombre}</div>
                        <div class="rank-estado ${estadoClase}">${estadoTexto}</div>
                    </div>
                    <div class="rank-stats">
                        <div class="rank-tiempo">⏱️ ${tiempo}</div>
                        <div class="rank-puntos">⭐ ${p.puntos}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderizarLogros(edificiosSesion, escaneos) {
        if (!this.container) return;

        this.container.innerHTML = edificiosSesion.map(edificioId => {
            const info = obtenerEdificioInfo(edificioId);
            const escaneo = escaneos.find(e => e.edificio_id === edificioId);
            
            const estadoTexto = escaneo ? `✅ ${formatearHora(new Date(escaneo.created_at))}` : '⏳ Pendiente';
            const iconoEstado = escaneo ? '🏆' : '🔒';
            const claseEstado = escaneo ? 'logro-completado' : 'logro-pendiente';

            return `
                <div class="logro-item ${claseEstado}">
                    <div class="logro-icono">${info.icono || '🏢'}</div>
                    <div class="logro-info">
                        <div class="logro-nombre">${info.nombre || edificioId}</div>
                        <div class="logro-estado">${estadoTexto}</div>
                    </div>
                    <div class="logro-trofeo">${iconoEstado}</div>
                </div>
            `;
        }).join('');
    }
}
