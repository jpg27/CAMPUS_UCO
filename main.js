// ═══════════════════════════════════════════
// MAIN.JS — Inicializador del mapa (punto de entrada para mapa.html)
// Toda la lógica ahora vive en /src/views/MapaView.js
// ═══════════════════════════════════════════
import { MapaView } from './src/views/MapaView.js';

const view = new MapaView();
view.init();
view.cargarFondo();
view.cargarBloques();
view.iniciarRenderLoop();

// ── Detección de clicks/taps ──
function handleClick(x, y) {
  const result = view.detectarBloque(x, y);
  if (result) {
    view.seleccionarBloque(result.mesh);
    view.mostrarPanel(result.edificio);
  } else {
    view.deseleccionarBloque();
    view.ocultarPanel();
  }
}

window.addEventListener('click', (e) => handleClick(e.clientX, e.clientY));
window.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  handleClick(t.clientX, t.clientY);
});

// ── Cerrar panel ──
document.getElementById('cerrar-panel')?.addEventListener('click', () => {
  view.ocultarPanel();
  view.deseleccionarBloque();
});