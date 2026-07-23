// ═══════════════════════════════════════════
// CarreraView.js — Vista de unirse a carrera
// Extraído fielmente de carrera.html original
// ═══════════════════════════════════════════

export class CarreraView {
  obtenerDatosFormulario() {
    return {
      nombre: document.getElementById('input-nombre').value.trim(),
      codigo: document.getElementById('input-codigo').value.trim()
    };
  }

  mostrarError(msg) {
    const error = document.getElementById('mensaje-error');
    error.textContent = msg;
    error.classList.add('visible');
  }

  ocultarError() {
    document.getElementById('mensaje-error').classList.remove('visible');
  }

  deshabilitarBoton(texto) {
    const btn = document.getElementById('btn-unirse');
    btn.disabled = true;
    btn.textContent = texto;
  }

  habilitarBoton() {
    const btn = document.getElementById('btn-unirse');
    btn.disabled = false;
    btn.textContent = ' Unirse a la carrera';
  }

  mostrarEspera(nombre, sesion) {
    document.getElementById('pantalla-form').classList.add('oculto');
    document.getElementById('pantalla-espera').classList.add('visible');
    document.getElementById('espera-nombre').textContent = '👋 Hola, ' + nombre;
    document.getElementById('espera-sesion').textContent = 'Sesión: ' + sesion.nombre + ' · ' + sesion.codigo;
  }

  mostrarSesionActivada() {
    document.querySelector('.espera-estado').innerHTML =
      '<span style="color: #3a7a1a; font-weight: bold;"> ¡Iniciando carrera!</span>';
  }

  mostrarSesionCerrada() {
    document.querySelector('.espera-estado').innerHTML =
      '<span style="color: #cc0000;"> La sesión fue cerrada</span>';
  }

  onUnirse(callback) {
    document.getElementById('btn-unirse')?.addEventListener('click', callback);
  }

  onEnterCodigo(callback) {
    document.getElementById('input-codigo')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') callback();
    });
  }

  onEnterNombre() {
    document.getElementById('input-nombre')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') document.getElementById('input-codigo').focus();
    });
  }
}
