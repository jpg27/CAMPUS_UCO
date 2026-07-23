// ═══════════════════════════════════════════
// SUPABASE.JS — Re-exports de compatibilidad
// Este archivo mantiene la interfaz original para imports existentes.
// Toda la lógica real ahora vive en /src/models/ y /src/config.js
// ═══════════════════════════════════════════

// Re-export del cliente Supabase
export { supabase } from './src/config.js';

// Re-export de funciones de sesiones
export { obtenerSesionPorCodigo, crearSesion, activarSesion, cerrarSesion } from './src/models/SesionModel.js';

// Re-export de funciones de participantes
export { unirseASesion, obtenerParticipantes } from './src/models/ParticipanteModel.js';

// Re-export de funciones de preguntas
export { obtenerPreguntaAleatoria, obtenerPreguntas, crearPregunta, eliminarPregunta } from './src/models/PreguntaModel.js';

// Re-export de funciones de escaneos
export { registrarEscaneo } from './src/models/EscaneoModel.js';