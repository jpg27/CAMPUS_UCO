// ════════════════════════════
// DATOS DE LOS EDIFICIOS
// Aquí defines toda la información de cada lugar del campus
// ════════════════════════════
const edificios = [
  {
    id: 'ingenieria',
    nombre: 'Facultad de Ingeniería',
    icono: '🏗️',
    color: '#E3F2FD',
    desc: 'Ingeniería Agroindustrial, Civil y Ambiental. Centro de innovación y tecnología del campus UCO.',
    dato: 'La Facultad de Ingeniería fue pionera en Ingeniería Agroindustrial en el Oriente Antioqueño.',
    visitado: false
  },
  {
    id: 'biblioteca',
    nombre: 'Biblioteca UCO',
    icono: '📚',
    color: '#FCE4EC',
    desc: 'Más de 40.000 títulos físicos y digitales. Salas de estudio y recursos en línea disponibles 24/7.',
    dato: 'La biblioteca conserva archivos históricos del Oriente Antioqueño con documentos desde el siglo XIX.',
    visitado: false
  },
  {
    id: 'capilla',
    nombre: 'Capilla San José',
    icono: '⛪',
    color: '#EDE7F6',
    desc: 'Espacio de fe, reflexión y espiritualidad en el corazón del campus. Abierta a toda la comunidad UCO.',
    dato: 'La Capilla es el corazón espiritual de la UCO y refleja los valores que dan nombre a la universidad.',
    visitado: false
  },
  {
    id: 'bienestar',
    nombre: 'Bienestar Universitario',
    icono: '💙',
    color: '#E8F5E9',
    desc: 'Salud, psicología, cultura y deportes. Tu aliado durante toda la carrera universitaria.',
    dato: 'Bienestar UCO atiende más de 2.000 estudiantes por semestre con servicios gratuitos de salud.',
    visitado: false
  },
  {
    id: 'admin',
    nombre: 'Bloque Administrativo',
    icono: '🏛️',
    color: '#FFF8E1',
    desc: 'Rectoría, Registro Académico y servicios financieros. Centro de gestión institucional de la UCO.',
    dato: 'El bloque administrativo alberga la Sala de Juntas donde se toman las decisiones más importantes.',
    visitado: false
  },
  {
    id: 'ciencias',
    nombre: 'Ciencias y Educación',
    icono: '🔬',
    color: '#E0F7FA',
    desc: 'Licenciaturas y programas de Ciencias Básicas. Laboratorios especializados para la investigación.',
    dato: 'El programa de Licenciatura en Ciencias Naturales es uno de los más antiguos de la región.',
    visitado: false
  },
  {
    id: 'deportes',
    nombre: 'Zona Deportiva',
    icono: '⚽',
    color: '#F3E5F5',
    desc: 'Canchas múltiples, gimnasio y zonas de esparcimiento. Deporte y bienestar físico para todos.',
    dato: 'El equipo de fútbol UCO ha ganado múltiples campeonatos interuniversitarios del Oriente Antioqueño.',
    visitado: false
  }
]


// ════════════════════════════
// NAVEGACIÓN
// ════════════════════════════
const pantallas_sin_nav = ['ingresar-carrera', 'en-carrera']

function mostrarPantalla(nombre) {
  // Ocultar todas las pantallas
  document.querySelectorAll('.pantalla').forEach(function(p) {
    p.classList.remove('activa')
  })

  // Mostrar la pantalla pedida
  document.getElementById(nombre).classList.add('activa')

  // Actualizar navegación inferior
  if (!pantallas_sin_nav.includes(nombre)) {
    document.querySelectorAll('.nav-item').forEach(function(item) {
      item.classList.remove('activo')
    })
    const navActivo = document.getElementById('nav-' + nombre)
    if (navActivo) navActivo.classList.add('activo')
  }

  // Cerrar panel de edificio si estaba abierto
  cerrarPanelEdificio()
}


// ════════════════════════════
// PANEL DE EDIFICIO
// ════════════════════════════
function abrirPanelEdificio(idEdificio) {
  // Buscar el edificio en el array
  const edificio = edificios.find(function(e) {
    return e.id === idEdificio
  })

  if (!edificio) return

  // Verificar si ya fue visitado (guardado en localStorage)
  const visitados = obtenerVisitados()
  const yaVisitado = visitados.includes(idEdificio)

  // Llenar el panel con la info del edificio
  document.getElementById('panel-icono').textContent   = edificio.icono
  document.getElementById('panel-icono').style.background = edificio.color
  document.getElementById('panel-nombre').textContent  = edificio.nombre
  document.getElementById('panel-desc').textContent    = edificio.desc
  document.getElementById('panel-dato').textContent    = edificio.dato

  const tag = document.getElementById('panel-tag')
  if (yaVisitado) {
    tag.textContent  = '✓ Visitado'
    tag.className    = 'panel-edificio-tag tag-visitado'
  } else {
    tag.textContent  = '🔒 Escanea para desbloquear'
    tag.className    = 'panel-edificio-tag tag-pendiente'
  }

  // Mostrar el panel y el overlay
  document.getElementById('panel-edificio').classList.add('visible')
  document.getElementById('overlay').classList.add('visible')
}

function cerrarPanelEdificio() {
  document.getElementById('panel-edificio').classList.remove('visible')
  document.getElementById('overlay').classList.remove('visible')
}


// ════════════════════════════
// LOGROS Y VISITADOS
// ════════════════════════════
function obtenerVisitados() {
  const guardados = localStorage.getItem('uco_visitados')
  return guardados ? JSON.parse(guardados) : []
}

function marcarVisitado(idEdificio) {
  const visitados = obtenerVisitados()
  if (!visitados.includes(idEdificio)) {
    visitados.push(idEdificio)
    localStorage.setItem('uco_visitados', JSON.stringify(visitados))
    actualizarLogros()
  }
}

function actualizarLogros() {
  const visitados = obtenerVisitados()
  // Actualizar cada tarjeta de logro en la pantalla
  edificios.forEach(function(edificio) {
    const icono = document.getElementById('logro-icono-' + edificio.id)
    if (icono) {
      if (visitados.includes(edificio.id)) {
        icono.className = 'logro-icono desbloqueado'
      } else {
        icono.className = 'logro-icono bloqueado'
      }
    }
  })
}


// ════════════════════════════
// INGRESAR A LA CARRERA
// ════════════════════════════
function ingresarCarrera() {
  const codigo = document.getElementById('input-codigo').value.trim()
  const nombre = document.getElementById('input-nombre').value.trim()
  const error  = document.getElementById('ingreso-error')

  if (codigo === '' || nombre === '') {
    error.classList.remove('oculto')
    return
  }

  error.classList.add('oculto')
  localStorage.setItem('uco_nombre',     nombre)
  localStorage.setItem('uco_codigo',     codigo)
  localStorage.setItem('uco_en_carrera', 'true')

  document.getElementById('carrera-nombre-usuario').textContent =
    'Hola, ' + nombre + ' 👋'

  mostrarPantalla('en-carrera')
}


// ════════════════════════════
// AL CARGAR LA APP
// ════════════════════════════
window.onload = function() {
  // Reconstruir pantalla de logros dinámicamente
  const contenedorLogros = document.getElementById('lista-logros')
  const visitados = obtenerVisitados()

  edificios.forEach(function(edificio) {
    const card = document.createElement('div')
    card.className = 'logro-card'
    card.innerHTML =
      '<div class="logro-icono ' + (visitados.includes(edificio.id) ? 'desbloqueado' : 'bloqueado') + '" id="logro-icono-' + edificio.id + '">' +
        edificio.icono +
      '</div>' +
      '<div>' +
        '<div class="logro-nombre">' + edificio.nombre + '</div>' +
        '<div class="logro-desc">' +
          (visitados.includes(edificio.id) ? 'Edificio visitado ✓' : 'Escanea este edificio para desbloquearlo') +
        '</div>' +
      '</div>'
    contenedorLogros.appendChild(card)
  })

  // Reconstruir botones del mapa placeholder
  const botonesEdificios = document.getElementById('botones-edificios')
  edificios.forEach(function(edificio) {
    const btn = document.createElement('button')
    btn.style.cssText = 'padding:8px 14px; margin:4px; background:white; border:none; border-radius:20px; font-size:13px; cursor:pointer;'
    btn.textContent = edificio.icono + ' ' + edificio.nombre
    btn.onclick = function() { abrirPanelEdificio(edificio.id) }
    botonesEdificios.appendChild(btn)
  })
// ════════════════════════════
// SALIR DE LA CARRERA
// ════════════════════════════
function salirDeCarrera() {
  localStorage.removeItem('uco_en_carrera')
  localStorage.removeItem('uco_nombre')
  localStorage.removeItem('uco_codigo')
  mostrarPantalla('inicio')
}
  // Si ya estaba en carrera, retomar sesión
  const enCarrera = localStorage.getItem('uco_en_carrera')
  const nombre    = localStorage.getItem('uco_nombre')
  if (enCarrera === 'true' && nombre) {
    document.getElementById('carrera-nombre-usuario').textContent =
      'Hola, ' + nombre + ' 👋'
    mostrarPantalla('en-carrera')
  }
}