/**
 * LoginAdminController.js
 * Orquesta login-admin.html: usa AuthModel (Supabase Auth real),
 * nada de credenciales hardcodeadas ni sessionStorage como "autenticación".
 */
import { iniciarSesionAdmin, obtenerSesionAdmin } from '../models/AuthModel.js';
import { mostrarAviso, ocultarAviso } from '../views/components/Avisos.js';

export class LoginAdminController {
  async init() {
    // Si ya hay una sesión de Supabase Auth activa, entra directo al panel.
    let sesion = null;
    try {
      sesion = await obtenerSesionAdmin();
    } catch (e) { /* sin sesión, seguimos al formulario de login */ }

    if (sesion) {
      window.location.href = 'admin.html';
      return;
    }

    this._exposeWindowFunctions();
    this._initEnterKey();
  }

  _exposeWindowFunctions() {
    window.login = async () => {
      const email    = document.getElementById('input-usuario').value.trim();
      const password = document.getElementById('input-password').value.trim();
      const btn      = document.getElementById('btn-login');
      ocultarAviso();

      if (!email || !password) {
        mostrarAviso({ tipo: 'aviso', titulo: 'Faltan datos', texto: 'Escribe tu correo y tu contraseña.' });
        (email ? document.getElementById('input-password') : document.getElementById('input-usuario')).focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Verificando...';

      try {
        await iniciarSesionAdmin(email, password);
        window.location.href = 'admin.html';
      } catch (e) {
        mostrarAviso({ tipo: 'error', titulo: 'No pudimos iniciar sesión', texto: 'El correo o la contraseña no son correctos.' });
        btn.disabled = false;
        btn.textContent = 'Ingresar';
      }
    };
  }

  _initEnterKey() {
    document.getElementById('input-password').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') window.login();
    });
    document.getElementById('input-usuario').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') document.getElementById('input-password').focus();
    });
  }
}
